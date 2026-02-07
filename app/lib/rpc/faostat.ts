/* app/lib/faostat.ts
   Drop-in FIX:
   - ONE fetch helper
   - DOES NOT throw on 200 responses that include { error } or { ok:false }
   - Only throws on non-JSON hard failures OR non-2xx
   - Adds optional debug logs with ?faodebug=1 or localStorage.faodebug="1"
*/

type AnyJson = any;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFaoDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("faodebug") === "1") return true;
    if (window.localStorage?.getItem("faodebug") === "1") return true;
  } catch {}
  return false;
}
function dbg(...args: any[]) {
  if (isFaoDebugEnabled()) console.log(...args);
}
function dberr(...args: any[]) {
  if (isFaoDebugEnabled()) console.error(...args);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  const text = await res.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    dberr("[FAOSTAT] Non-JSON response:", text.slice(0, 300));
    throw new Error("FAOSTAT API returned non-JSON");
  }

  const keys = isRecord(data)
    ? Object.keys(data)
    : Array.isArray(data)
      ? ["<array>"]
      : null;
  const lenGuess = Array.isArray(data)
    ? data.length
    : isRecord(data) && Array.isArray((data as any).rows)
      ? (data as any).rows.length
      : isRecord(data) && Array.isArray((data as any).data)
        ? (data as any).data.length
        : isRecord(data) && Array.isArray((data as any).items)
          ? (data as any).items.length
          : null;

  dbg("[FAOSTAT] GET", url);
  dbg("[FAOSTAT] status", res.status, res.statusText);
  dbg("[FAOSTAT] keys", keys);
  dbg("[FAOSTAT] lenGuess", lenGuess);

  // Hard error: non-2xx should still throw
  if (!res.ok) {
    if (isRecord(data) && typeof (data as any).error === "string") {
      throw new Error((data as any).error);
    }
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  // ✅ IMPORTANT: DO NOT throw on {error} or {ok:false} for 200
  // UI will display it.
  return data as T;
}

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

// ✅ DROP-IN #1 — make TOP modules include Area Code + Item Code (required for row-click trend)
// File: app/lib/rpc/faostat.ts
//
// NOTE: Replace ONLY the `module()` function below.
// If your file already has `faostatApi.module`, this is a safe drop-in override.
// It uses your existing `/api/faostat/module` endpoint (no DB logic changes here)
// but forces the API to return codes by requesting `include_codes=1`.
// You must also apply DROP-IN #2 (route.ts) so the API actually includes the codes.

export const faostatApi = {
  async overview(iso3: string) {
    const url = `/api/faostat/overview?iso3=${encodeURIComponent(iso3)}`;
    return fetchJson<OverviewPayload>(url);
  },

  async module(iso3: string, kind: string, topN = 10) {
    const qs = new URLSearchParams({
      iso3,
      kind,
      top: String(topN),
      include_codes: "1", // ✅ ask backend to include Item Code / Area Code
    });
    const url = `/api/faostat/module?${qs.toString()}`;
    return fetchJson<any>(url); // keep flexible (your module payload varies)
  },

  async tradeInsights(
    iso3: string,
    kind: "import" | "export",
    topN = 10,
    years = 10,
  ) {
    const qs = new URLSearchParams({
      iso3,
      kind,
      top: String(topN),
      years: String(years),
    });
    const url = `/api/faostat/trade-insights?${qs.toString()}`;
    return fetchJson<TradeInsights>(url);
  },
};
