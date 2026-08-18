export type IntelligenceDirection =
  | "higher-better"
  | "lower-better"
  | "target-range";

export type IntelligenceDimensionId =
  | "economic-momentum"
  | "external-resilience"
  | "fiscal-health"
  | "development";

export type IntelligenceTrend =
  | "improving"
  | "stable"
  | "deteriorating";

export type IntelligenceSignalSeverity =
  | "positive"
  | "watch"
  | "risk";

export type IntelligenceIndicatorConfig = {
  indicatorId: string;
  dimension: IntelligenceDimensionId;
  weight: number;
  direction: IntelligenceDirection;
  targetMin?: number;
  targetMax?: number;
};

export type IntelligenceDimensionConfig = {
  id: IntelligenceDimensionId;
  label: string;
  description: string;
  weight: number;
};

export type IntelligenceSeriesPoint = {
  year: number;
  value: number;
  unit?: string | null;
};

export type IntelligenceRankingRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

export type IndicatorScoreBreakdown = {
  globalPosition: number | null;
  regionalPosition: number | null;
  momentum: number | null;
  stability: number | null;
};

export type IntelligenceIndicatorResult = {
  id: string;
  code: string;
  label: string;
  description: string;
  source: string;
  unit: string | null;
  dimension: IntelligenceDimensionId;
  direction: IntelligenceDirection;
  weight: number;
  latest: {
    year: number | null;
    value: number | null;
  };
  benchmark: {
    year: number | null;
    value: number | null;
    globalRank: number | null;
    globalTotal: number;
    regionalRank: number | null;
    regionalTotal: number;
  };
  score: number | null;
  confidence: number;
  trend: IntelligenceTrend;
  components: IndicatorScoreBreakdown;
  contribution: number;
  history: IntelligenceSeriesPoint[];
  warning?: string | null;
};

export type IntelligenceDimensionResult = {
  id: IntelligenceDimensionId;
  label: string;
  description: string;
  score: number | null;
  confidence: number;
  trend: IntelligenceTrend;
  indicators: IntelligenceIndicatorResult[];
};

export type IntelligenceSignal = {
  id: string;
  severity: IntelligenceSignalSeverity;
  dimension: IntelligenceDimensionId;
  indicatorId: string;
  title: string;
  detail: string;
  score: number | null;
  momentum: number | null;
};

export type IntelligenceDriver = {
  indicatorId: string;
  label: string;
  dimension: IntelligenceDimensionId;
  score: number;
  contribution: number;
};

export type WeoOutlookSeries = {
  code: string;
  label: string;
  unit: string;
  points: IntelligenceSeriesPoint[];
};

export type CountryIntelligencePayload = {
  ok: boolean;
  generatedAt: string;
  methodology: {
    version: string;
    benchmarkPolicy: string;
    componentWeights: {
      globalPosition: number;
      regionalPosition: number;
      momentum: number;
      stability: number;
    };
    note: string;
  };
  country: {
    iso3: string;
    name: string;
    region: string | null;
  };
  score: {
    overall: number | null;
    label: string;
    trend: IntelligenceTrend;
    confidence: number;
  };
  dimensions: IntelligenceDimensionResult[];
  indicators: IntelligenceIndicatorResult[];
  strengths: IntelligenceDriver[];
  risks: IntelligenceDriver[];
  signals: IntelligenceSignal[];
  outlook: {
    vintage: string | null;
    fromYear: number;
    series: WeoOutlookSeries[];
  };
  narrative: {
    headline: string;
    summary: string;
  };
  warnings: string[];
  error?: string;
};
