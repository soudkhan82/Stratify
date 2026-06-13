import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

type TradeItem = {
  item: string;
  value: number;
  unit: string | null;
  share_pct: number | null;
};
type TradeTrendPoint = { year: number; value: number };
type TradeInsights = {
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function normalizeRpc(data: unknown): {
  obj: Record<string, unknown> | null;
  arr: unknown[] | null;
} {
  if (Array.isArray(data)) {
    const first = data.find(isRecord) as Record<string, unknown> | undefined;
    return { obj: first ?? null, arr: data };
  }
  if (isRecord(data)) return { obj: data, arr: null };
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (Array.isArray(parsed)) {
        const first = parsed.find(isRecord) as
          | Record<string, unknown>
          | undefined;
        return { obj: first ?? null, arr: parsed };
      }
      if (isRecord(parsed)) return { obj: parsed, arr: null };
    } catch {}
  }
  return { obj: null, arr: null };
}

function asInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function asKind(v: string | null): "import" | "export" {
  const s = String(v || "")
    .toLowerCase()
    .trim();
  return s === "export" ? "export" : "import";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const iso3 = String(searchParams.get("iso3") || "")
      .toUpperCase()
      .trim();
    const kind = asKind(searchParams.get("kind"));
    const top = Math.max(1, Math.min(50, asInt(searchParams.get("top"), 10)));
    const years = Math.max(
      3,
      Math.min(30, asInt(searchParams.get("years"), 10)),
    );

    if (!iso3)
      return NextResponse.json({ error: "iso3 is required" }, { status: 400 });

    const { data, error } = await supabase.rpc("fetch_faostat_trade_insights", {
      p_iso3: iso3,
      p_kind: kind,
      p_top: top,
      p_years: years,
    });

    if (error) {
      const fail: TradeInsights = {
        ok: false,
        iso3,
        country: iso3,
        kind,
        element: "",
        latest_year: 0,
        total_latest: null,
        total_prev_year: null,
        yoy_pct: null,
        top1_share_pct: null,
        top5_share_pct: null,
        items: [],
        trend: [],
        error: error.message,
      };
      return NextResponse.json(fail, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const { obj } = normalizeRpc(data);

    // If RPC already returns perfect shape, pass through.
    // Otherwise, normalize minimally so UI never breaks.
    const payload: TradeInsights = {
      ok: Boolean(obj?.ok ?? true),
      iso3: String(obj?.iso3 ?? iso3),
      country: String(obj?.country ?? iso3),
      kind,
      element: String(obj?.element ?? ""),
      latest_year: Number(obj?.latest_year ?? 0),
      total_latest:
        obj?.total_latest === null ? null : Number(obj?.total_latest ?? null),
      total_prev_year:
        obj?.total_prev_year === null
          ? null
          : Number(obj?.total_prev_year ?? null),
      yoy_pct: obj?.yoy_pct === null ? null : Number(obj?.yoy_pct ?? null),
      top1_share_pct:
        obj?.top1_share_pct === null
          ? null
          : Number(obj?.top1_share_pct ?? null),
      top5_share_pct:
        obj?.top5_share_pct === null
          ? null
          : Number(obj?.top5_share_pct ?? null),
      items: Array.isArray(obj?.items)
        ? (obj!.items as any[])
            .filter(isRecord)
            .map((r) => ({
              item: String(r.item ?? r.name ?? "—"),
              value: Number(r.value ?? 0),
              unit: (r.unit as string | null) ?? null,
              share_pct:
                r.share_pct === null ? null : Number(r.share_pct ?? null),
            }))
            .filter((x) => Number.isFinite(x.value))
        : [],
      trend: Array.isArray(obj?.trend)
        ? (obj!.trend as any[])
            .filter(isRecord)
            .map((r) => ({
              year: Number(r.year ?? 0),
              value: Number(r.value ?? 0),
            }))
            .filter((x) => Number.isFinite(x.year) && Number.isFinite(x.value))
        : [],
      error: typeof obj?.error === "string" ? String(obj.error) : undefined,
    };

    if (!payload.items.length && !payload.trend.length) {
      payload.ok = false;
      payload.error =
        payload.error || "No trade insights data found for this ISO3.";
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    const msg = e?.message || "Unknown error";
    const fail: TradeInsights = {
      ok: false,
      iso3: "—",
      country: "—",
      kind: "import",
      element: "",
      latest_year: 0,
      total_latest: null,
      total_prev_year: null,
      yoy_pct: null,
      top1_share_pct: null,
      top5_share_pct: null,
      items: [],
      trend: [],
      error: msg,
    };
    return NextResponse.json(fail, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
