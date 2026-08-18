import { NextResponse } from "next/server";

import supabase from "@/app/config/supabase-config";
import { getEconomicIndicator } from "@/app/lib/economic-indicators";
import {
  COMPONENT_WEIGHTS,
  GEO_REGION_OVERRIDES,
  INTELLIGENCE_DIMENSIONS,
  INTELLIGENCE_INDICATORS,
  INTELLIGENCE_METHODOLOGY_VERSION,
  WEO_OUTLOOK_INDICATORS,
} from "@/app/lib/intelligence/config";
import {
  average,
  buildSignals,
  combineTrend,
  favorableRank,
  indicatorConfidence,
  indicatorScore,
  momentumScore,
  percentileScore,
  round,
  scoreLabel,
  stabilityScore,
  weightedScore,
} from "@/app/lib/intelligence/scoring";
import type {
  CountryIntelligencePayload,
  IntelligenceDimensionResult,
  IntelligenceDriver,
  IntelligenceIndicatorConfig,
  IntelligenceIndicatorResult,
  IntelligenceRankingRow,
  IntelligenceSeriesPoint,
  WeoOutlookSeries,
} from "@/app/lib/intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_SECONDS = 30 * 60;
const HISTORY_WINDOW = 25;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function canonicalWorldBankRegion(value: unknown) {
  const region = clean(value);
  const lower = region.toLowerCase();

  if (lower.includes("sub-saharan africa")) return "Sub-Saharan Africa";
  if (lower.includes("europe") && lower.includes("central asia")) {
    return "Europe & Central Asia";
  }
  if (lower.includes("middle east") && lower.includes("north africa")) {
    return "Middle East & North Africa";
  }
  if (lower.includes("south asia")) return "South Asia";
  if (lower.includes("east asia") && lower.includes("pacific")) {
    return "East Asia & Pacific";
  }
  if (lower.includes("latin america") && lower.includes("caribbean")) {
    return "Latin America & Caribbean";
  }
  if (lower.includes("north america")) return "North America";

  return region || null;
}

type CountryMeta = {
  iso3: string;
  country: string;
  region: string | null;
};

async function fetchWorldBankCountryMeta() {
  const response = await fetch(
    "https://api.worldbank.org/v2/country?format=json&per_page=400",
    {
      next: { revalidate: 604800 },
      headers: {
        Accept: "application/json",
        "User-Agent": "Stratify Country Intelligence https://worldstats360.com",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`World Bank country metadata failed: ${response.status}`);
  }

  const json = await response.json();
  const rows = Array.isArray(json?.[1]) ? json[1] : [];
  const map = new Map<string, CountryMeta>();

  for (const row of rows) {
    const iso3 = clean(row?.id).toUpperCase();
    const country = clean(row?.name);
    const regionId = clean(row?.region?.id).toUpperCase();
    const providerRegion = canonicalWorldBankRegion(row?.region?.value);
    const region = GEO_REGION_OVERRIDES[iso3] ?? providerRegion;

    if (iso3.length !== 3 || !country || regionId === "NA" || !region) continue;
    map.set(iso3, { iso3, country, region });
  }

  return map;
}

async function fallbackCountryMeta(iso3: string): Promise<CountryMeta> {
  const { data, error } = await supabase
    .from("v_country_dim_final")
    .select("country_code,country_name,region")
    .eq("country_code", iso3)
    .limit(1);

  if (!error && data?.[0]) {
    const row = data[0] as Record<string, unknown>;
    return {
      iso3,
      country: clean(row.country_name) || iso3,
      region:
        GEO_REGION_OVERRIDES[iso3] ?? canonicalWorldBankRegion(row.region),
    };
  }

  return {
    iso3,
    country: iso3,
    region: GEO_REGION_OVERRIDES[iso3] ?? null,
  };
}

function normalizeSeriesRows(value: unknown): IntelligenceSeriesPoint[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [];

  const points: IntelligenceSeriesPoint[] = [];

  for (const row of rows as any[]) {
    const year = toNumber(row?.year);
    const pointValue = toNumber(row?.value);
    if (year === null || pointValue === null) continue;

    points.push({
      year: Math.trunc(year),
      value: pointValue,
      unit: clean(row?.unit) || null,
    });
  }

  return points.sort((a, b) => a.year - b.year);
}

async function fetchWdiCountrySeries(iso3: string, code: string) {
  const { data, error } = await supabase.rpc("fetch_wdi_country_series", {
    p_iso3: iso3,
    p_indicator: code,
    p_window: HISTORY_WINDOW,
  });

  if (error) throw new Error(`fetch_wdi_country_series: ${error.message}`);
  return normalizeSeriesRows(data);
}

function chooseLatestCoverageYear(
  points: Array<{ year: number; iso3: string; value: number }>,
) {
  const counts = new Map<number, Set<string>>();

  for (const point of points) {
    const set = counts.get(point.year) ?? new Set<string>();
    set.add(point.iso3);
    counts.set(point.year, set);
  }

  const ranked = [...counts.entries()]
    .map(([year, countries]) => ({ year, count: countries.size }))
    .sort((a, b) => b.year - a.year);

  if (!ranked.length) return null;

  const maxCoverage = Math.max(...ranked.map((row) => row.count));
  const minimumCoverage = Math.max(3, Math.floor(maxCoverage * 0.65));

  return ranked.find((row) => row.count >= minimumCoverage)?.year ?? ranked[0].year;
}

async function fetchWdiRanking(
  code: string,
  countryMeta: Map<string, CountryMeta>,
) {
  const currentYear = new Date().getUTCFullYear();
  const response = await fetch(
    `https://api.worldbank.org/v2/country/all/indicator/${encodeURIComponent(
      code,
    )}?format=json&per_page=20000&date=${currentYear - 9}:${currentYear}`,
    {
      next: { revalidate: 21600 },
      headers: {
        Accept: "application/json",
        "User-Agent": "Stratify Country Intelligence https://worldstats360.com",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`World Bank failed for ${code}: ${response.status}`);
  }

  const json = await response.json();
  const rawRows = Array.isArray(json?.[1]) ? json[1] : [];
  const points: Array<{ year: number; iso3: string; value: number }> = [];

  for (const raw of rawRows) {
    const iso3 = clean(raw?.countryiso3code).toUpperCase();
    const year = toNumber(raw?.date);
    const pointValue = toNumber(raw?.value);
    const meta = countryMeta.get(iso3);

    if (!meta || year === null || pointValue === null) continue;
    points.push({ year: Math.trunc(year), iso3, value: pointValue });
  }

  const year = chooseLatestCoverageYear(points);
  const rows: IntelligenceRankingRow[] =
    year === null
      ? []
      : points
          .filter((point) => point.year === year)
          .map((point) => {
            const meta = countryMeta.get(point.iso3)!;
            return {
              iso3: point.iso3,
              country: meta.country,
              region: meta.region,
              value: point.value,
            };
          });

  return { year, rows };
}

async function latestWeoVintage(): Promise<string | null> {
  const { data, error } = await supabase.rpc("weo_latest_vintage");
  if (error) throw new Error(`weo_latest_vintage: ${error.message}`);

  if (typeof data === "string") return data;
  if (Array.isArray(data) && data.length) {
    if (typeof data[0] === "string") return clean(data[0]) || null;
    return clean(data[0]?.vintage ?? data[0]?.weo_latest_vintage) || null;
  }
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    return clean(row.vintage ?? row.weo_latest_vintage) || null;
  }
  return null;
}

async function fetchWeoCountrySeries(
  iso3: string,
  code: string,
  vintage: string,
) {
  const { data, error } = await supabase.rpc("weo_country_series", {
    p_iso3: iso3,
    p_indicator: code,
    p_vintage: vintage,
  });

  if (error) throw new Error(`weo_country_series(${code}): ${error.message}`);
  return normalizeSeriesRows(data);
}

async function fetchDebtCountrySeries(
  iso3: string,
  vintage: string,
  toYear: number,
) {
  const { data, error } = await supabase.rpc("weo_debt_series", {
    in_country: iso3,
    in_from: 1980,
    in_to: toYear,
    in_vintage: vintage,
  });

  if (error) throw new Error(`weo_debt_series: ${error.message}`);
  return normalizeSeriesRows(data);
}

function normalizeWeoRanking(value: unknown): IntelligenceRankingRow[] {
  const rows = Array.isArray(value) ? value : [];
  const output: IntelligenceRankingRow[] = [];

  for (const row of rows as any[]) {
    const iso3 = clean(row?.country_code ?? row?.iso3).toUpperCase();
    const pointValue = toNumber(row?.value ?? row?.debt_gross_pct_gdp);
    if (iso3.length !== 3 || pointValue === null) continue;

    output.push({
      iso3,
      country: clean(row?.country_name ?? row?.country ?? iso3) || iso3,
      region:
        GEO_REGION_OVERRIDES[iso3] ??
        canonicalWorldBankRegion(row?.region) ??
        (clean(row?.region) || null),
      value: pointValue,
    });
  }

  return output;
}

async function fetchWeoRanking(
  code: string,
  preferredYear: number,
  vintage: string,
) {
  for (const year of [preferredYear, preferredYear - 1, preferredYear - 2]) {
    const { data, error } = await supabase.rpc("weo_metric_rank_series", {
      in_indicator_code: code,
      in_region: null,
      in_year: year,
      in_top: 500,
      in_country: null,
      in_from: 1980,
      in_to: preferredYear,
      in_vintage: vintage,
    });

    if (error) {
      throw new Error(`weo_metric_rank_series(${code}): ${error.message}`);
    }

    const raw =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, any>)
        : { ranking: data };

    const rows = normalizeWeoRanking(raw.ranking ?? raw.rankings ?? []);
    const returnedYear =
      toNumber(raw.rank_year ?? raw.year) ??
      toNumber((raw.ranking ?? [])[0]?.year) ??
      year;

    if (rows.length) return { year: Math.trunc(returnedYear), rows };
  }

  return { year: null as number | null, rows: [] as IntelligenceRankingRow[] };
}

async function fetchDebtRanking(preferredYear: number, vintage: string) {
  for (const year of [preferredYear, preferredYear - 1, preferredYear - 2]) {
    const { data, error } = await supabase.rpc("weo_debt_rank", {
      in_region: null,
      in_year: year,
      in_top: 500,
      in_vintage: vintage,
    });

    if (error) throw new Error(`weo_debt_rank: ${error.message}`);

    const rows = normalizeWeoRanking(data);
    const returnedYear =
      toNumber(Array.isArray(data) ? data[0]?.year : null) ?? year;

    if (rows.length) return { year: Math.trunc(returnedYear), rows };
  }

  return { year: null as number | null, rows: [] as IntelligenceRankingRow[] };
}

async function loadIndicator(args: {
  config: IntelligenceIndicatorConfig;
  iso3: string;
  region: string | null;
  countryMeta: Map<string, CountryMeta>;
  vintage: string | null;
  conditionYear: number;
  currentYear: number;
}): Promise<IntelligenceIndicatorResult> {
  const indicator = getEconomicIndicator(args.config.indicatorId);

  try {
    let history: IntelligenceSeriesPoint[] = [];
    let ranking: IntelligenceRankingRow[] = [];
    let benchmarkYear: number | null = null;

    if (indicator.source === "world-bank") {
      const [series, rankPack] = await Promise.all([
        fetchWdiCountrySeries(args.iso3, indicator.code),
        fetchWdiRanking(indicator.code, args.countryMeta),
      ]);
      history = series;
      ranking = rankPack.rows;
      benchmarkYear = rankPack.year;
    } else {
      if (!args.vintage) throw new Error("IMF WEO vintage is unavailable.");

      if (indicator.source === "imf-debt") {
        const [series, rankPack] = await Promise.all([
          fetchDebtCountrySeries(args.iso3, args.vintage, args.conditionYear),
          fetchDebtRanking(args.conditionYear, args.vintage),
        ]);
        history = series.filter((point) => point.year <= args.conditionYear);
        ranking = rankPack.rows;
        benchmarkYear = rankPack.year;
      } else {
        const [series, rankPack] = await Promise.all([
          fetchWeoCountrySeries(args.iso3, indicator.code, args.vintage),
          fetchWeoRanking(indicator.code, args.conditionYear, args.vintage),
        ]);
        history = series.filter((point) => point.year <= args.conditionYear);
        ranking = rankPack.rows;
        benchmarkYear = rankPack.year;
      }
    }

    const latest = history.length ? history[history.length - 1] : null;
    const selectedBenchmark = ranking.find((row) => row.iso3 === args.iso3) ?? null;
    const regionalRows = args.region
      ? ranking.filter((row) => row.region === args.region)
      : [];

    const components = {
      globalPosition: percentileScore(ranking, args.iso3, args.config),
      regionalPosition: percentileScore(regionalRows, args.iso3, args.config),
      momentum: momentumScore(history, args.config),
      stability: stabilityScore(history),
    };

    const score = indicatorScore(components);
    const confidence = indicatorConfidence({
      components,
      history,
      latestYear: latest?.year ?? null,
      currentYear: args.currentYear,
    });

    return {
      id: indicator.id,
      code: indicator.code,
      label: indicator.label,
      description: indicator.description,
      source: indicator.sourceLabel,
      unit: indicator.unit ?? latest?.unit ?? null,
      dimension: args.config.dimension,
      direction: args.config.direction,
      weight: args.config.weight,
      latest: {
        year: latest?.year ?? null,
        value: latest?.value ?? null,
      },
      benchmark: {
        year: benchmarkYear,
        value: selectedBenchmark?.value ?? null,
        globalRank: favorableRank(ranking, args.iso3, args.config),
        globalTotal: ranking.length,
        regionalRank: favorableRank(regionalRows, args.iso3, args.config),
        regionalTotal: regionalRows.length,
      },
      score: score === null ? null : round(score),
      confidence,
      trend: combineTrend([components.momentum]),
      components: {
        globalPosition:
          components.globalPosition === null ? null : round(components.globalPosition),
        regionalPosition:
          components.regionalPosition === null ? null : round(components.regionalPosition),
        momentum: components.momentum === null ? null : round(components.momentum),
        stability: components.stability === null ? null : round(components.stability),
      },
      contribution: 0,
      history: history.slice(-10),
      warning: null,
    };
  } catch (error) {
    return {
      id: indicator.id,
      code: indicator.code,
      label: indicator.label,
      description: indicator.description,
      source: indicator.sourceLabel,
      unit: indicator.unit ?? null,
      dimension: args.config.dimension,
      direction: args.config.direction,
      weight: args.config.weight,
      latest: { year: null, value: null },
      benchmark: {
        year: null,
        value: null,
        globalRank: null,
        globalTotal: 0,
        regionalRank: null,
        regionalTotal: 0,
      },
      score: null,
      confidence: 0,
      trend: "stable",
      components: {
        globalPosition: null,
        regionalPosition: null,
        momentum: null,
        stability: null,
      },
      contribution: 0,
      history: [],
      warning: error instanceof Error ? error.message : "Indicator could not be scored.",
    };
  }
}

function buildDimensions(indicators: IntelligenceIndicatorResult[]) {
  const dimensions: IntelligenceDimensionResult[] = [];

  for (const dimension of INTELLIGENCE_DIMENSIONS) {
    const rows = indicators.filter((indicator) => indicator.dimension === dimension.id);
    const scored = rows.filter(
      (indicator): indicator is IntelligenceIndicatorResult & { score: number } =>
        indicator.score !== null,
    );
    const availableWeight = scored.reduce((sum, indicator) => sum + indicator.weight, 0);

    for (const indicator of rows) {
      if (indicator.score === null || availableWeight <= 0) {
        indicator.contribution = 0;
        continue;
      }

      const normalizedIndicatorWeight = indicator.weight / availableWeight;
      indicator.contribution = round(
        dimension.weight * normalizedIndicatorWeight * (indicator.score - 50),
        2,
      );
    }

    const score = weightedScore(
      rows.map((indicator) => ({ value: indicator.score, weight: indicator.weight })),
    );
    const confidence = weightedScore(
      rows.map((indicator) => ({
        value: indicator.score === null ? null : indicator.confidence,
        weight: indicator.weight,
      })),
    );
    const momentum = weightedScore(
      rows.map((indicator) => ({
        value: indicator.components.momentum,
        weight: indicator.weight,
      })),
    );

    dimensions.push({
      id: dimension.id,
      label: dimension.label,
      description: dimension.description,
      score: score === null ? null : round(score),
      confidence: confidence === null ? 0 : Math.round(confidence),
      trend: combineTrend([momentum]),
      indicators: rows,
    });
  }

  return dimensions;
}

function buildDrivers(indicators: IntelligenceIndicatorResult[]) {
  const scored = indicators.filter(
    (indicator): indicator is IntelligenceIndicatorResult & { score: number } =>
      indicator.score !== null,
  );

  const toDriver = (indicator: IntelligenceIndicatorResult & { score: number }) =>
    ({
      indicatorId: indicator.id,
      label: indicator.label,
      dimension: indicator.dimension,
      score: indicator.score,
      contribution: indicator.contribution,
    }) satisfies IntelligenceDriver;

  const strengths = scored
    .filter((indicator) => indicator.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5)
    .map(toDriver);

  const risks = scored
    .filter((indicator) => indicator.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 5)
    .map(toDriver);

  return { strengths, risks };
}

async function fetchOutlook(args: {
  iso3: string;
  vintage: string | null;
  currentYear: number;
}) {
  if (!args.vintage) {
    return {
      vintage: null,
      fromYear: args.currentYear,
      series: [] as WeoOutlookSeries[],
    };
  }

  const results = await Promise.all(
    WEO_OUTLOOK_INDICATORS.map(async (meta) => {
      try {
        const points = await fetchWeoCountrySeries(args.iso3, meta.code, args.vintage!);
        return {
          code: meta.code,
          label: meta.label,
          unit: meta.unit,
          points: points.filter(
            (point) =>
              point.year >= args.currentYear && point.year <= args.currentYear + 5,
          ),
        } satisfies WeoOutlookSeries;
      } catch {
        return {
          code: meta.code,
          label: meta.label,
          unit: meta.unit,
          points: [],
        } satisfies WeoOutlookSeries;
      }
    }),
  );

  return {
    vintage: args.vintage,
    fromYear: args.currentYear,
    series: results.filter((result) => result.points.length > 0),
  };
}

function trendWord(trend: "improving" | "stable" | "deteriorating") {
  if (trend === "improving") return "improving";
  if (trend === "deteriorating") return "deteriorating";
  return "broadly stable";
}

function buildNarrative(args: {
  country: string;
  overall: number | null;
  label: string;
  trend: "improving" | "stable" | "deteriorating";
  dimensions: IntelligenceDimensionResult[];
}) {
  const scored = args.dimensions
    .filter(
      (dimension): dimension is IntelligenceDimensionResult & { score: number } =>
        dimension.score !== null,
    )
    .sort((a, b) => b.score - a.score);

  const strongest = scored[0] ?? null;
  const weakest = scored[scored.length - 1] ?? null;

  const headline = `${args.country}: ${args.label} outlook`;

  if (args.overall === null || !strongest || !weakest) {
    return {
      headline,
      summary:
        "There is not yet enough comparable data to produce a complete country outlook. Available indicators are shown with confidence and coverage warnings.",
    };
  }

  const summary = `${args.country} scores ${round(args.overall)} / 100 in Stratify Country Intelligence and the recent direction is ${trendWord(
    args.trend,
  )}. ${strongest.label} is currently the strongest scored dimension (${round(
    strongest.score,
  )}), while ${weakest.label} is the main constraint (${round(
    weakest.score,
  )}). The score is computed from comparable statistics and historical movement; it is not an AI-generated rating.`;

  return { headline, summary };
}

export async function GET(req: Request) {
  const currentYear = new Date().getUTCFullYear();
  const conditionYear = currentYear - 1;

  try {
    const { searchParams } = new URL(req.url);
    const iso3 = clean(searchParams.get("iso3")).toUpperCase();

    if (!/^[A-Z]{3}$/.test(iso3)) {
      return NextResponse.json(
        { ok: false, error: "A valid 3-letter ISO country code is required." },
        { status: 400 },
      );
    }

    const warnings: string[] = [];

    let countryMetaMap = new Map<string, CountryMeta>();
    try {
      countryMetaMap = await fetchWorldBankCountryMeta();
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : "World Bank country metadata is temporarily unavailable.",
      );
    }

    const fallback = await fallbackCountryMeta(iso3);
    const countryMeta = countryMetaMap.get(iso3) ?? fallback;

    let vintage: string | null = null;
    try {
      vintage = await latestWeoVintage();
    } catch (error) {
      warnings.push(
        error instanceof Error ? error.message : "IMF WEO vintage could not be resolved.",
      );
    }

    const indicators = await Promise.all(
      INTELLIGENCE_INDICATORS.map((config) =>
        loadIndicator({
          config,
          iso3,
          region: countryMeta.region,
          countryMeta: countryMetaMap,
          vintage,
          conditionYear,
          currentYear,
        }),
      ),
    );

    for (const indicator of indicators) {
      if (indicator.warning) warnings.push(`${indicator.label}: ${indicator.warning}`);
    }

    const dimensions = buildDimensions(indicators);
    const overall = weightedScore(
      dimensions.map((dimension) => ({
        value: dimension.score,
        weight:
          INTELLIGENCE_DIMENSIONS.find((item) => item.id === dimension.id)?.weight ?? 0,
      })),
    );
    const confidence = weightedScore(
      dimensions.map((dimension) => ({
        value: dimension.score === null ? null : dimension.confidence,
        weight:
          INTELLIGENCE_DIMENSIONS.find((item) => item.id === dimension.id)?.weight ?? 0,
      })),
    );
    const overallTrend = combineTrend(
      indicators.map((indicator) => indicator.components.momentum),
    );
    const label = scoreLabel(overall);
    const { strengths, risks } = buildDrivers(indicators);
    const signals = buildSignals(indicators);
    const outlook = await fetchOutlook({ iso3, vintage, currentYear });
    const narrative = buildNarrative({
      country: countryMeta.country,
      overall,
      label,
      trend: overallTrend,
      dimensions,
    });

    const payload: CountryIntelligencePayload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      methodology: {
        version: INTELLIGENCE_METHODOLOGY_VERSION,
        benchmarkPolicy: `WDI uses the latest broadly covered actual year; IMF current-condition metrics prefer ${conditionYear} and fall back up to two years if required. IMF years from ${currentYear} onward are shown separately as forward outlook.`,
        componentWeights: {
          globalPosition: COMPONENT_WEIGHTS.globalPosition,
          regionalPosition: COMPONENT_WEIGHTS.regionalPosition,
          momentum: COMPONENT_WEIGHTS.momentum,
          stability: COMPONENT_WEIGHTS.stability,
        },
        note:
          "Ranks are favourable-position ranks after indicator direction is applied. Target-range indicators reward proximity to the configured stability range. Missing components are reweighted rather than treated as zero.",
      },
      country: {
        iso3,
        name: countryMeta.country,
        region: countryMeta.region,
      },
      score: {
        overall: overall === null ? null : round(overall),
        label,
        trend: overallTrend,
        confidence: confidence === null ? 0 : Math.round(confidence),
      },
      dimensions,
      indicators,
      strengths,
      risks,
      signals,
      outlook,
      narrative,
      warnings: [...new Set(warnings)],
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
      },
    });
  } catch (error) {
    const payload: Partial<CountryIntelligencePayload> = {
      ok: false,
      generatedAt: new Date().toISOString(),
      warnings: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to build country intelligence payload.",
    };

    return NextResponse.json(payload, { status: 500 });
  }
}
