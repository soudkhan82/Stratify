// app/api/map/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

/* =======================
   Types
======================= */

type MapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function coerceMapRows(payload: unknown): MapRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((r): MapRow => {
    if (!isRecord(r)) return { iso3: "", country: "", region: null, value: 0 };
    return {
      iso3: asString(r.iso3),
      country: asString(r.country),
      region: typeof r.region === "string" ? r.region : null,
      value: asNumber(r.value),
    };
  });
}

/* =======================
   Micro-cache + in-flight dedupe
======================= */

type CacheEntry = { ts: number; rows: MapRow[] };
const TTL_MS = 60_000;

declare global {
  // eslint-disable-next-line no-var
  var __MAP_CACHE__: Map<string, CacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var __MAP_INFLIGHT__: Map<string, Promise<MapRow[]>> | undefined;
}

const CACHE = global.__MAP_CACHE__ ?? new Map<string, CacheEntry>();
global.__MAP_CACHE__ = CACHE;

const INFLIGHT =
  global.__MAP_INFLIGHT__ ?? new Map<string, Promise<MapRow[]>>();
global.__MAP_INFLIGHT__ = INFLIGHT;

function normalizeRegion(regionRaw: string | null) {
  const r = (regionRaw ?? "").trim();
  if (!r || r === "ALL" || r === "null" || r === "undefined") return null;
  return r;
}
function cacheKey(indicator: string, region: string | null) {
  return `${indicator}__${region ?? "WORLD"}`;
}

async function withTimeout<T>(
  p: PromiseLike<T>,
  ms: number,
  label = "Timeout",
) {
  let t: any;
  const realPromise = Promise.resolve(p);
  const timeout = new Promise<T>((_, rej) => {
    t = setTimeout(() => rej(new Error(label)), ms);
  });
  try {
    return await Promise.race([realPromise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

/* =======================
   Handler
======================= */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const indicator = (searchParams.get("indicator") ?? "SP.POP.TOTL").trim();
  const region = normalizeRegion(searchParams.get("region"));

  // ✅ If you created the optimized RPC: public.fetch_map_wdi_fast(...)
  // Set this to the latest available year column in wdi_dataset (e.g. 2023 or 2022).
  // Keeping it fixed avoids extra metadata work and prevents slow "latest year" scans.
  const FIXED_YEAR = 2023; // <-- change to 2022 if your dataset ends at 2022

  const key = cacheKey(indicator, region);

  // ✅ Serve cache
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ rows: cached.rows }, { status: 200 });
  }

  // ✅ Deduplicate in-flight requests
  const inflight = INFLIGHT.get(key);
  if (inflight) {
    const rows = await inflight.catch(() => []);
    return NextResponse.json({ rows }, { status: 200 });
  }

  const job = (async (): Promise<MapRow[]> => {
    // ✅ Use FAST RPC (avoids jsonb_each_text per row)
    const rpcThenable = supabase
      .rpc("fetch_map_wdi_fast", {
        p_indicator: indicator,
        p_region: region,
        p_year: FIXED_YEAR,
      })
      .throwOnError()
      .then(({ data }) => data);

    const data = await withTimeout(
      rpcThenable,
      20_000,
      "RPC timeout (fetch_map_wdi_fast)",
    );

    const rows = coerceMapRows(data as unknown)
      .filter((r) => r.iso3 && r.country)
      .map((r) => ({ ...r, iso3: r.iso3.toUpperCase() }));

    return rows;
  })();

  INFLIGHT.set(key, job);

  try {
    const rows = await job;
    CACHE.set(key, { ts: Date.now(), rows });
    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load map data", rows: [] },
      { status: 500 },
    );
  } finally {
    INFLIGHT.delete(key);
  }
}
