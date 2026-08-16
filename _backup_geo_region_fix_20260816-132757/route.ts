import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";
import {
  getEconomicIndicator,
  type EconomicIndicator,
} from "@/app/lib/economic-indicators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

type EconomicMapPayload = {
  ok: boolean;
  rows: MapRow[];
  indicator: {
    id: string;
    code: string;
    label: string;
    unit: string | null;
    source: string;
    scale: "sequential" | "diverging";
  };
  year: number | null;
  observationType: "actual" | "weo-outlook";
  vintage?: string | null;
  error?: string;
};

type CacheEntry = { ts: number; payload: EconomicMapPayload };
const CACHE_TTL_MS = 10 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __ECONOMIC_MAP_CACHE__: Map<string, CacheEntry> | undefined;
}

const CACHE = global.__ECONOMIC_MAP_CACHE__ ?? new Map<string, CacheEntry>();
global.__ECONOMIC_MAP_CACHE__ = CACHE;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeRegion(value: string | null) {
  const region = clean(value);
  if (!region || region === "World" || region === "ALL" || region === "null") return null;
  return region;
}

function canonicalWorldBankRegion(value: unknown) {
  const region = clean(value);
  const lower = region.toLowerCase();

  if (lower.includes("sub-saharan africa")) return "Sub-Saharan Africa";
  if (lower.includes("europe") && lower.includes("central asia")) return "Europe & Central Asia";
  if (lower.includes("middle east") && lower.includes("north africa")) return "Middle East & North Africa";
  if (lower.includes("south asia")) return "South Asia";
  if (lower.includes("east asia") && lower.includes("pacific")) return "East Asia & Pacific";
  if (lower.includes("latin america") && lower.includes("caribbean")) return "Latin America & Caribbean";
  if (lower.includes("north america")) return "North America";

  return region || null;
}

function normalizeYear(value: string | null): number | null {
  const raw = clean(value).toLowerCase();
  if (!raw || raw === "latest") return null;
  const year = Number(raw.replace(/f$/i, ""));
  return Number.isFinite(year) && year >= 1960 && year <= 2100 ? Math.trunc(year) : null;
}

function payloadBase(indicator: EconomicIndicator) {
  return {
    id: indicator.id,
    code: indicator.code,
    label: indicator.label,
    unit: indicator.unit ?? null,
    source: indicator.sourceLabel,
    scale: indicator.scale,
  };
}

async function fetchWorldBankCountryMeta() {
  const response = await fetch(
    "https://api.worldbank.org/v2/country?format=json&per_page=400",
    {
      next: { revalidate: 604800 },
      headers: {
        Accept: "application/json",
        "User-Agent": "Stratify Economic Map https://worldstats360.com",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`World Bank country metadata failed: ${response.status}`);
  }

  const json = await response.json();
  const rows = Array.isArray(json?.[1]) ? json[1] : [];
  const map = new Map<string, { country: string; region: string | null }>();

  for (const row of rows) {
    const iso3 = clean(row?.id).toUpperCase();
    const country = clean(row?.name);
    const region = canonicalWorldBankRegion(row?.region?.value);
    const regionId = clean(row?.region?.id).toUpperCase();

    if (iso3.length !== 3 || !country || regionId === "NA" || !region) continue;
    map.set(iso3, { country, region });
  }

  return map;
}

function chooseLatestCoverageYear(
  points: Array<{ year: number; iso3: string; value: number }>,
  requestedYear: number | null,
) {
  if (requestedYear !== null) return requestedYear;

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

async function fetchWorldBankMap(
  indicator: EconomicIndicator,
  region: string | null,
  requestedYear: number | null,
): Promise<EconomicMapPayload> {
  const currentYear = new Date().getUTCFullYear();
  const fromYear = requestedYear ?? currentYear - 9;
  const toYear = requestedYear ?? currentYear;

  const [countryMeta, response] = await Promise.all([
    fetchWorldBankCountryMeta(),
    fetch(
      `https://api.worldbank.org/v2/country/all/indicator/${encodeURIComponent(
        indicator.code,
      )}?format=json&per_page=20000&date=${fromYear}:${toYear}`,
      {
        next: { revalidate: 21600 },
        headers: {
          Accept: "application/json",
          "User-Agent": "Stratify Economic Map https://worldstats360.com",
        },
      },
    ),
  ]);

  if (!response.ok) {
    throw new Error(`World Bank failed for ${indicator.code}: ${response.status}`);
  }

  const json = await response.json();
  const rawRows = Array.isArray(json?.[1]) ? json[1] : [];
  const points: Array<{ year: number; iso3: string; value: number }> = [];

  for (const raw of rawRows) {
    const iso3 = clean(raw?.countryiso3code).toUpperCase();
    const year = Number(raw?.date);
    const value = toNumber(raw?.value);
    const meta = countryMeta.get(iso3);

    if (!meta || !Number.isFinite(year) || value === null) continue;
    if (region && meta.region !== region) continue;

    points.push({ year, iso3, value });
  }

  const year = chooseLatestCoverageYear(points, requestedYear);
  const rows = year === null
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
        })
        .sort((a, b) => b.value - a.value);

  return {
    ok: true,
    rows,
    indicator: payloadBase(indicator),
    year,
    observationType: "actual",
  };
}

async function latestWeoVintage(): Promise<string | null> {
  const { data, error } = await supabase.rpc("weo_latest_vintage");
  if (error) throw error;

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

function normalizeWeoRanking(value: unknown): MapRow[] {
  const rows = Array.isArray(value) ? value : [];

  return rows
    .map((row: any) => ({
      iso3: clean(row?.country_code ?? row?.iso3).toUpperCase(),
      country: clean(row?.country_name ?? row?.country ?? row?.country_code),
      region: clean(row?.region) || null,
      value: toNumber(row?.value ?? row?.debt_gross_pct_gdp),
    }))
    .filter(
      (row): row is MapRow =>
        row.iso3.length === 3 && Boolean(row.country) && row.value !== null,
    );
}

async function fetchWeoMap(
  indicator: EconomicIndicator,
  region: string | null,
  requestedYear: number | null,
): Promise<EconomicMapPayload> {
  const { data, error } = await supabase.rpc("weo_metric_rank_series", {
    in_indicator_code: indicator.code,
    in_region: region,
    in_year: requestedYear,
    in_top: 500,
    in_country: null,
    in_from: 1980,
    in_to: new Date().getUTCFullYear() + 6,
    in_vintage: null,
  });

  if (error) throw error;

  const raw = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, any>)
    : { ranking: data };

  const rows = normalizeWeoRanking(raw.ranking ?? raw.rankings ?? []);
  const year =
    toNumber(raw.rank_year ?? raw.year) ??
    toNumber((raw.ranking ?? [])[0]?.year) ??
    requestedYear;

  return {
    ok: true,
    rows,
    indicator: payloadBase(indicator),
    year,
    observationType: "weo-outlook",
    vintage: clean(raw.vintage) || (await latestWeoVintage()),
  };
}

async function fetchDebtMap(
  indicator: EconomicIndicator,
  region: string | null,
  requestedYear: number | null,
): Promise<EconomicMapPayload> {
  const vintage = await latestWeoVintage();
  const { data, error } = await supabase.rpc("weo_debt_rank", {
    in_region: region,
    in_year: requestedYear,
    in_top: 500,
    in_vintage: vintage,
  });

  if (error) throw error;

  const rawRows = Array.isArray(data) ? data : [];
  const rows = normalizeWeoRanking(rawRows);
  const year = toNumber(rawRows[0]?.year) ?? requestedYear;

  return {
    ok: true,
    rows,
    indicator: payloadBase(indicator),
    year,
    observationType: "weo-outlook",
    vintage,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const indicator = getEconomicIndicator(searchParams.get("indicator"));
    const region = normalizeRegion(searchParams.get("region"));
    const requestedYear = normalizeYear(searchParams.get("year"));
    const key = `${indicator.id}__${region ?? "WORLD"}__${requestedYear ?? "LATEST"}`;

    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload, {
        headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1800" },
      });
    }

    const payload =
      indicator.source === "world-bank"
        ? await fetchWorldBankMap(indicator, region, requestedYear)
        : indicator.source === "imf-debt"
          ? await fetchDebtMap(indicator, region, requestedYear)
          : await fetchWeoMap(indicator, region, requestedYear);

    CACHE.set(key, { ts: Date.now(), payload });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1800" },
    });
  } catch (error) {
    const fallback = getEconomicIndicator(null);
    return NextResponse.json(
      {
        ok: false,
        rows: [],
        indicator: payloadBase(fallback),
        year: null,
        observationType: "actual",
        error: error instanceof Error ? error.message : "Unable to load economic map data.",
      } satisfies EconomicMapPayload,
      { status: 500 },
    );
  }
}