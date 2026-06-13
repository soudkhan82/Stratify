import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

type ProdItem = {
  item: string;
  value: number;
  unit: string | null;
  share_pct: number | null;
};
type ProdTrendPoint = { year: number; value: number };

type ProductionInsights = {
  ok: boolean;
  iso3: string;
  country: string;
  element: string;
  latest_year: number;
  total_latest: number | null;
  total_prev_year: number | null;
  yoy_pct: number | null;
  top1_share_pct: number | null;
  top5_share_pct: number | null;
  items: ProdItem[];
  trend: ProdTrendPoint[];
  error?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeRpc(data: unknown): { obj: Record<string, unknown> | null } {
  if (Array.isArray(data)) {
    const first = data.find(isRecord) as Record<string, unknown> | undefined;
    return { obj: first ?? null };
  }
  if (isRecord(data)) return { obj: data };
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (Array.isArray(parsed)) {
        const first = parsed.find(isRecord) as
          | Record<string, unknown>
          | undefined;
        return { obj: first ?? null };
      }
      if (isRecord(parsed)) return { obj: parsed };
    } catch {}
  }
  return { obj: null };
}

function asInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const iso3 = String(searchParams.get("iso3") || "")
      .toUpperCase()
      .trim();
    const top = Math.max(1, Math.min(50, asInt(searchParams.get("top"), 10)));
    const years = Math.max(
      3,
      Math.min(60, asInt(searchParams.get("years"), 10)),
    );
    const element = String(searchParams.get("element") || "Production").trim();

    if (!iso3) {
      return NextResponse.json({ error: "iso3 is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc(
      "fetch_faostat_production_insights",
      {
        p_iso3: iso3,
        p_top: top,
        p_years: years,
        p_element: element,
      },
    );

    if (error) {
      const fail: ProductionInsights = {
        ok: false,
        iso3,
        country: iso3,
        element,
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

    const payload: ProductionInsights = {
      ok: Boolean(obj?.ok ?? true),
      iso3: String(obj?.iso3 ?? iso3),
      country: String(obj?.country ?? iso3),
      element: String(obj?.element ?? element),
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
        payload.error || "No production insights found for this ISO3.";
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    const msg = e?.message || "Unknown error";
    const fail: ProductionInsights = {
      ok: false,
      iso3: "—",
      country: "—",
      element: "Production",
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
