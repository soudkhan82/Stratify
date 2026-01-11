// app/api/faostat/module/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

type FaoKind = "top-production" | "top-import" | "top-export";

type TopItem = { item: string; value: number; unit: string | null };

type TopPayload = {
  iso3: string;
  country: string;
  latest_year: number | null;
  kind: FaoKind;
  items: TopItem[];
  error?: string;
};

function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asInt(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : fallback;
}

function isKind(k: string): k is FaoKind {
  return k === "top-production" || k === "top-import" || k === "top-export";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const iso3 = asText(searchParams.get("iso3")).trim().toUpperCase();
  const kindRaw = asText(searchParams.get("kind")).trim();
  const top = asInt(searchParams.get("top"), 10);

  if (!iso3) {
    return NextResponse.json(
      { error: "Missing query param: iso3" },
      { status: 400 }
    );
  }
  if (!isKind(kindRaw)) {
    return NextResponse.json(
      {
        error:
          'Invalid kind. Expected: "top-production" | "top-import" | "top-export"',
      },
      { status: 400 }
    );
  }

  // RPC: fetch_faostat_module(p_iso3 text, p_kind text, p_top int)
  const { data, error } = await supabase.rpc("fetch_faostat_module", {
    p_iso3: iso3,
    p_kind: kindRaw,
    p_top: top,
  });

  if (error) {
    return NextResponse.json(
      {
        error: `fetch_faostat_module RPC failed: ${error.message}`,
      },
      { status: 500 }
    );
  }

  const payload: TopPayload =
    (data as unknown as TopPayload) ??
    ({
      iso3,
      country: iso3,
      latest_year: null,
      kind: kindRaw,
      items: [],
      error: "No data returned from RPC.",
    } satisfies TopPayload);

  return NextResponse.json(payload);
}
