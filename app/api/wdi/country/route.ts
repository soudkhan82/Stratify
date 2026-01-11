import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

type RpcRow = {
  year: number | string | null;
  value: number | string | null;
  unit: string | null;

  country: string | null;
  region: string | null;
  indicator_label: string | null;
};

type SeriesPoint = {
  year: number;
  value: number;
  unit: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function coerceRpcRow(r: unknown): RpcRow | null {
  if (!isRecord(r)) return null;

  const year = (r.year ?? null) as unknown;
  const value = (r.value ?? null) as unknown;

  return {
    year: typeof year === "number" || typeof year === "string" ? year : null,
    value:
      typeof value === "number" || typeof value === "string" ? value : null,
    unit: asNullableString(r.unit),

    country: asNullableString(r.country),
    region: asNullableString(r.region),
    indicator_label: asNullableString(r.indicator_label),
  };
}

function normalizeRows(data: unknown): RpcRow[] {
  // Most common: setof -> array
  if (Array.isArray(data)) {
    return data.map(coerceRpcRow).filter((x): x is RpcRow => x !== null);
  }

  // Sometimes RPC might return one row object
  if (isRecord(data)) {
    const one = coerceRpcRow(data);
    return one ? [one] : [];
  }

  return [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const iso3 = (searchParams.get("iso3") || "").toUpperCase().trim();
    const indicator = (searchParams.get("indicator") || "").trim();

    if (!iso3 || !indicator) {
      return NextResponse.json(
        { error: "iso3 and indicator are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("fetch_wdi_country_series", {
      p_iso3: iso3,
      p_indicator: indicator,
      p_window: 25,
    });

    if (error) {
      return NextResponse.json(
        { error: `fetch_wdi_country_series: ${error.message}` },
        { status: 500 }
      );
    }

    const rows = normalizeRows(data);

    const series: SeriesPoint[] = rows
      .map((r): SeriesPoint | null => {
        const y = toFiniteNumber(r.year);
        const v = toFiniteNumber(r.value);
        if (y === null || v === null) return null;
        return { year: y, value: v, unit: r.unit ?? null };
      })
      .filter((x): x is SeriesPoint => x !== null)
      .sort((a, b) => a.year - b.year);

    const latest = series.length ? series[series.length - 1] : null;
    const first = rows[0];

    return NextResponse.json({
      iso3,
      country: first?.country ?? iso3,
      region: first?.region ?? null,
      indicator: {
        code: indicator,
        label: first?.indicator_label ?? indicator,
        unit: first?.unit ?? null,
      },
      latest,
      series,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
