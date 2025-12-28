// app/lib/rpc/wdiCountryRanking.ts
import supabase from "@/app/config/supabase-config";

export type WdiSelectedRank = {
  rank: number;
  total_in_scope: number;
  year: number | null;
  value: number | null;
};

export async function fetchWdiSelectedRank(
  indicatorCode: string,
  iso3: string,
  region: string | null
): Promise<WdiSelectedRank | null> {
  const { data, error } = await supabase.rpc("fetch_wdi_selected_rank", {
    p_indicator_code: indicatorCode,
    p_iso3: iso3,
    p_region: region ?? null,
  });

  if (error) throw new Error(error.message);

  // supabase rpc usually returns array for returns table(...)
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    rank: Number(row.rank),
    total_in_scope: Number(row.total_in_scope),
    year: row.year == null ? null : Number(row.year),
    value: row.value == null ? null : Number(row.value),
  };
}
