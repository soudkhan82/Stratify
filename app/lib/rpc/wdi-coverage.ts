// app/lib/rpc/wdi-coverage.ts
import supabase from "@/app/config/supabase-config";

export type WdiCoverageRow = {
  indicator_code: string;
  region: string | null;
  countries_in_scope: number;
  countries_with_data: number;
  coverage_pct: string | number; // Supabase may return numeric as string
  missing_countries: number;
};

export type MapSafeIndicatorRow = {
  indicator_code: string;
  indicator_name: string;
  coverage_pct: string | number;
  countries_with_data: number;
};

function n(v: unknown, fallback = 0): number {
  const x =
    typeof v === "number"
      ? v
      : typeof v === "string"
      ? Number(v)
      : Number.NaN;
  return Number.isFinite(x) ? x : fallback;
}

export function asPct(v: unknown): number {
  return n(v, 0);
}

/**
 * Coverage for one indicator + one region
 * RPC: public.fetch_wdi_coverage(indicator, region)
 */
export async function fetchWdiCoverage(args: {
  indicatorCode: string;
  region: string | null; // e.g. "Sub-Saharan Africa" or null for world
}): Promise<WdiCoverageRow> {
  const { data, error } = await supabase.rpc("fetch_wdi_coverage", {
    p_indicator: args.indicatorCode,
    p_region: args.region,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? (data[0] as WdiCoverageRow | undefined) : undefined;
  if (!row) {
    // If RPC returns nothing, treat as 0 coverage
    return {
      indicator_code: args.indicatorCode,
      region: args.region,
      countries_in_scope: 0,
      countries_with_data: 0,
      coverage_pct: 0,
      missing_countries: 0,
    };
  }
  return row;
}

/**
 * Map-safe indicators list for a region (default min coverage 70)
 * You will create this RPC next (I included SQL below).
 */
export async function fetchMapSafeIndicators(args: {
  region: string;
  minCoveragePct?: number; // default 70
}): Promise<MapSafeIndicatorRow[]> {
  const { data, error } = await supabase.rpc("fetch_map_safe_indicators", {
    p_region: args.region,
    p_min_coverage_pct: args.minCoveragePct ?? 70,
  });

  if (error) throw error;
  return (data ?? []) as MapSafeIndicatorRow[];
}
