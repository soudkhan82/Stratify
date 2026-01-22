/* app/lib/faostat.ts
   Single client helper for all FAOSTAT endpoints.
   Use this from pages/components instead of hardcoding fetch URLs.
*/

export type FaoModule =
  | "overview"
  | "top-production"
  | "top-import"
  | "top-export"
  | "trade-import"
  | "trade-export";

export type OverviewPayload = {
  iso3: string;
  country: string;
  latest_year: number | null;

  production_qty: number | null;
  production_unit: string | null;

  import_qty: number | null;
  import_unit: string | null;

  export_qty: number | null;
  export_unit: string | null;

  kcal_per_capita_day: number | null;
  protein_g_per_capita_day: number | null;
  fat_g_per_capita_day: number | null;

  error?: string;
};

export type TopItem = { item: string; value: number; unit: string | null };
export type TopPayload = {
  iso3: string;
  country: string;
  latest_year: number | null;
  kind?: string;
  items: TopItem[];
  error?: string;
};

export type TradeItem = {
  item: string;
  value: number;
  unit: string | null;
  share_pct: number | null;
};
export type TradeTrendPoint = { year: number; value: number };
export type TradeInsights = {
  ok: boolean;
  iso3: string;
  country: string;
  kind: "import" | "export";
  element: string;
  latest_year: number;
  total_latest: number | null;
  total_prev_year: number | null;
  yoy_pct: number | null;
  top1_share_pct: number | null;
  top5_share_pct: number | null;
  items: TradeItem[];
  trend: TradeTrendPoint[];
  error?: string;
};

export type SuaTradeTotalRow = {
  year: number;
  element: string;
  value: number;
  unit: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  // Try parse json always (even errors)
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // if non-json, wrap
    data = { error: `Non-JSON response from ${url}`, raw: text };
  }

  if (!res.ok) {
    // normalize
    if (isRecord(data) && typeof data.error === "string") {
      throw new Error(data.error);
    }
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  return data as T;
}

export const faostatApi = {
  overview: (iso3: string) =>
    fetchJson<OverviewPayload>(
      `/api/faostat/overview?iso3=${encodeURIComponent(iso3)}`,
    ),

  module: (
    iso3: string,
    kind: "top-production" | "top-import" | "top-export",
    top = 10,
  ) =>
    fetchJson<TopPayload>(
      `/api/faostat/module?iso3=${encodeURIComponent(iso3)}&kind=${encodeURIComponent(
        kind,
      )}&top=${encodeURIComponent(String(top))}`,
    ),

  tradeInsights: (
    iso3: string,
    kind: "import" | "export",
    top = 10,
    years = 10,
  ) =>
    fetchJson<TradeInsights>(
      `/api/faostat/trade-insights?iso3=${encodeURIComponent(iso3)}&kind=${encodeURIComponent(
        kind,
      )}&top=${encodeURIComponent(String(top))}&years=${encodeURIComponent(String(years))}`,
    ),

  suaTotals: (iso3: string, years = 15) =>
    fetchJson<SuaTradeTotalRow[]>(
      `/api/faostat/sua-trade-totals?iso3=${encodeURIComponent(
        iso3,
      )}&years=${encodeURIComponent(String(years))}`,
    ),
};
