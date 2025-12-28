// app/api/map/route.ts
import { NextResponse } from "next/server";

type MapPoint = {
  iso3: string; // e.g. "PAK"
  country: string;
  region: string | null;
  value: number;
};

type MapResponse = {
  indicator: string;
  year: number;
  unit?: string;
  points: MapPoint[];
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

function parseQueryNumber(url: URL, key: string, fallback: number): number {
  const raw = url.searchParams.get(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const indicator = asString(
      url.searchParams.get("indicator"),
      "SP.POP.TOTL"
    );
    const year = parseQueryNumber(url, "year", new Date().getUTCFullYear());

    // Replace this with your real fetch (Supabase RPC, etc.)
    const points: MapPoint[] = [
      {
        iso3: "PAK",
        country: "Pakistan",
        region: "South Asia",
        value: 250000000,
      },
      {
        iso3: "IND",
        country: "India",
        region: "South Asia",
        value: 1400000000,
      },
    ];

    const payload: MapResponse = { indicator, year, points };
    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Optional POST to accept a custom payload for debugging
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const indicator = asString(body.indicator, "SP.POP.TOTL");
    const year = asNumber(body.year, new Date().getUTCFullYear());
    const rawPoints = body.points;

    const points: MapPoint[] = Array.isArray(rawPoints)
      ? rawPoints
          .map((p): MapPoint | null => {
            if (!isRecord(p)) return null;
            const iso3 = asString(p.iso3);
            const country = asString(p.country);
            const region =
              typeof p.region === "string"
                ? p.region
                : p.region === null
                ? null
                : null;
            const value = asNumber(p.value, 0);
            if (!iso3 || !country) return null;
            return { iso3, country, region, value };
          })
          .filter((x): x is MapPoint => x !== null)
      : [];

    const payload: MapResponse = { indicator, year, points };
    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
