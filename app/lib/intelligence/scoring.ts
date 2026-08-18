import { COMPONENT_WEIGHTS } from "./config";
import type {
  IntelligenceDirection,
  IntelligenceIndicatorConfig,
  IntelligenceIndicatorResult,
  IntelligenceRankingRow,
  IntelligenceSeriesPoint,
  IntelligenceSignal,
  IntelligenceTrend,
} from "./types";

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values) ?? 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function targetDistance(
  value: number,
  config: Pick<IntelligenceIndicatorConfig, "targetMin" | "targetMax">,
) {
  const min = config.targetMin;
  const max = config.targetMax;

  if (min == null || max == null) return Math.abs(value);
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

export function desirability(
  value: number,
  config: Pick<
    IntelligenceIndicatorConfig,
    "direction" | "targetMin" | "targetMax"
  >,
) {
  if (config.direction === "higher-better") return value;
  if (config.direction === "lower-better") return -value;
  return -targetDistance(value, config);
}

function percentileFromUtilities(values: number[], selected: number) {
  if (!values.length) return null;

  const below = values.filter((value) => value < selected).length;
  const equal = values.filter((value) => value === selected).length;
  const percentile = ((below + equal * 0.5) / values.length) * 100;

  return clamp(percentile);
}

export function percentileScore(
  rows: IntelligenceRankingRow[],
  selectedIso3: string,
  config: IntelligenceIndicatorConfig,
) {
  const selected = rows.find((row) => row.iso3 === selectedIso3);
  if (!selected) return null;

  const utilities = rows.map((row) => desirability(row.value, config));
  const selectedUtility = desirability(selected.value, config);
  return percentileFromUtilities(utilities, selectedUtility);
}

export function favorableRank(
  rows: IntelligenceRankingRow[],
  selectedIso3: string,
  config: IntelligenceIndicatorConfig,
) {
  const ranked = [...rows].sort(
    (a, b) => desirability(b.value, config) - desirability(a.value, config),
  );
  const index = ranked.findIndex((row) => row.iso3 === selectedIso3);
  return index >= 0 ? index + 1 : null;
}

export function momentumScore(
  history: IntelligenceSeriesPoint[],
  config: IntelligenceIndicatorConfig,
) {
  const recent = history
    .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.value))
    .sort((a, b) => a.year - b.year)
    .slice(-4);

  if (recent.length < 3) return null;

  const utilities = recent.map((point) => desirability(point.value, config));
  const utilityMean = average(utilities) ?? 0;
  const utilityStd = standardDeviation(utilities);

  if (utilityStd < 1e-9) return 50;

  const xMean = (recent.length - 1) / 2;
  let numerator = 0;
  let denominator = 0;

  utilities.forEach((value, index) => {
    numerator += (index - xMean) * (value - utilityMean);
    denominator += (index - xMean) ** 2;
  });

  const slope = denominator > 0 ? numerator / denominator : 0;
  const normalizedSlope = slope / utilityStd;

  return clamp(50 + normalizedSlope * 30);
}

export function stabilityScore(history: IntelligenceSeriesPoint[]) {
  const recent = history
    .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.value))
    .sort((a, b) => a.year - b.year)
    .slice(-6)
    .map((point) => point.value);

  if (recent.length < 3) return null;

  const changes = recent.slice(1).map((value, index) => value - recent[index]);
  const changeVolatility = standardDeviation(changes);
  const meanAbsoluteLevel =
    average(recent.map((value) => Math.abs(value))) ?? 0;
  const scale = Math.max(meanAbsoluteLevel, 1);
  const relativeVolatility = changeVolatility / scale;

  return clamp(100 / (1 + relativeVolatility * 1.5));
}

export function weightedScore(
  components: Array<{ value: number | null; weight: number }>,
) {
  const available = components.filter(
    (component): component is { value: number; weight: number } =>
      component.value !== null && Number.isFinite(component.value),
  );

  const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
  if (!totalWeight) return null;

  return available.reduce(
    (sum, component) => sum + component.value * (component.weight / totalWeight),
    0,
  );
}

export function trendFromMomentum(momentum: number | null): IntelligenceTrend {
  if (momentum === null) return "stable";
  if (momentum >= 58) return "improving";
  if (momentum <= 42) return "deteriorating";
  return "stable";
}

export function indicatorConfidence(args: {
  components: {
    globalPosition: number | null;
    regionalPosition: number | null;
    momentum: number | null;
    stability: number | null;
  };
  history: IntelligenceSeriesPoint[];
  latestYear: number | null;
  currentYear: number;
}) {
  const availableComponentWeight =
    (args.components.globalPosition !== null ? COMPONENT_WEIGHTS.globalPosition : 0) +
    (args.components.regionalPosition !== null ? COMPONENT_WEIGHTS.regionalPosition : 0) +
    (args.components.momentum !== null ? COMPONENT_WEIGHTS.momentum : 0) +
    (args.components.stability !== null ? COMPONENT_WEIGHTS.stability : 0);

  const componentCoverage = availableComponentWeight * 100;
  const historyCoverage = clamp((Math.min(args.history.length, 10) / 10) * 100);

  const lag =
    args.latestYear === null ? 10 : Math.max(0, args.currentYear - args.latestYear);
  const recency =
    lag <= 1 ? 100 : lag === 2 ? 90 : lag === 3 ? 75 : lag === 4 ? 60 : 40;

  return Math.round(
    componentCoverage * 0.5 + historyCoverage * 0.3 + recency * 0.2,
  );
}

export function indicatorScore(components: {
  globalPosition: number | null;
  regionalPosition: number | null;
  momentum: number | null;
  stability: number | null;
}) {
  return weightedScore([
    { value: components.globalPosition, weight: COMPONENT_WEIGHTS.globalPosition },
    { value: components.regionalPosition, weight: COMPONENT_WEIGHTS.regionalPosition },
    { value: components.momentum, weight: COMPONENT_WEIGHTS.momentum },
    { value: components.stability, weight: COMPONENT_WEIGHTS.stability },
  ]);
}

export function scoreLabel(score: number | null) {
  if (score === null) return "Insufficient Data";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Positive";
  if (score >= 60) return "Moderately Positive";
  if (score >= 45) return "Mixed";
  if (score >= 35) return "Fragile";
  return "High Risk";
}

export function combineTrend(scores: Array<number | null>): IntelligenceTrend {
  const valid = scores.filter((value): value is number => value !== null);
  const mean = average(valid);
  return trendFromMomentum(mean);
}

function directionPhrase(direction: IntelligenceDirection) {
  if (direction === "lower-better") return "lower values are generally more favourable";
  if (direction === "target-range") return "values nearer the configured stability range are more favourable";
  return "higher values are generally more favourable";
}

export function buildSignals(
  indicators: IntelligenceIndicatorResult[],
): IntelligenceSignal[] {
  const signals: IntelligenceSignal[] = [];

  for (const indicator of indicators) {
    const momentum = indicator.components.momentum;
    const globalPosition = indicator.components.globalPosition;

    if (momentum !== null && momentum >= 68) {
      signals.push({
        id: `${indicator.id}-momentum-positive`,
        severity: "positive",
        dimension: indicator.dimension,
        indicatorId: indicator.id,
        title: `${indicator.label} is improving`,
        detail: `Recent movement is favourable relative to the country's own history; ${directionPhrase(
          indicator.direction,
        )}.`,
        score: indicator.score,
        momentum,
      });
    } else if (momentum !== null && momentum <= 32) {
      signals.push({
        id: `${indicator.id}-momentum-risk`,
        severity: "risk",
        dimension: indicator.dimension,
        indicatorId: indicator.id,
        title: `${indicator.label} is deteriorating`,
        detail: `Recent movement is unfavourable relative to the country's own history; ${directionPhrase(
          indicator.direction,
        )}.`,
        score: indicator.score,
        momentum,
      });
    }

    if (globalPosition !== null && globalPosition <= 20) {
      signals.push({
        id: `${indicator.id}-global-watch`,
        severity: "watch",
        dimension: indicator.dimension,
        indicatorId: indicator.id,
        title: `${indicator.label} is weak versus global peers`,
        detail: "The current benchmark position is in the bottom fifth of countries with comparable data.",
        score: indicator.score,
        momentum,
      });
    } else if (globalPosition !== null && globalPosition >= 80) {
      signals.push({
        id: `${indicator.id}-global-strength`,
        severity: "positive",
        dimension: indicator.dimension,
        indicatorId: indicator.id,
        title: `${indicator.label} is strong versus global peers`,
        detail: "The current benchmark position is in the top fifth of countries with comparable data.",
        score: indicator.score,
        momentum,
      });
    }
  }

  const priority = { risk: 0, watch: 1, positive: 2 } as const;

  return signals
    .sort((a, b) => {
      const severityOrder = priority[a.severity] - priority[b.severity];
      if (severityOrder !== 0) return severityOrder;
      return Math.abs((b.momentum ?? 50) - 50) - Math.abs((a.momentum ?? 50) - 50);
    })
    .slice(0, 10);
}
