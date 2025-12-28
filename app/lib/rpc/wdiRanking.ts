// app/lib/rpc/wdiRanking.ts
import supabase from "@/app/config/supabase-config";

export type WdiRankingRow = {
  country_code: string;
  country_name: string;
  region: string | null;
  year: number;
  value: number;
};

export async function fetchWdiMetricRanking(
  indicatorCode: string,
  limit = 250,
  region?: string | null
): Promise<WdiRankingRow[]> {
  const { data, error } = await supabase.rpc("fetch_wdi_metric_ranking", {
    p_indicator_code: indicatorCode,
    p_limit: limit,
    p_region: region ?? null,
  });

  if (error) throw error;
  return (data ?? []) as WdiRankingRow[];
}
