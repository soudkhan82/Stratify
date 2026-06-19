import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  symbol: string;
  company_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  hq_lat?: number | null;
  hq_lng?: number | null;
  geocode_status?: string | null;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildQuery(row: ProfileRow) {
  const address = clean(row.address);
  const city = clean(row.city);
  const state = clean(row.state);
  const country = clean(row.country || "United States");

  if (address) {
    const addressLower = address.toLowerCase();

    const extraParts = [city, state, country].filter((part) => {
      if (!part) return false;
      return !addressLower.includes(part.toLowerCase());
    });

    return [address, ...extraParts].filter(Boolean).join(", ");
  }

  return [city, state, country].filter(Boolean).join(", ");
}

async function geocodeOpenCage(query: string, apiKey: string) {
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
    query,
  )}&key=${encodeURIComponent(apiKey)}&limit=1&no_annotations=1`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Stratify Corporate Intelligence Geocoder",
    },
  });

  if (!res.ok) {
    throw new Error(`OpenCage failed with status ${res.status}`);
  }

  const json = await res.json();
  const first = json?.results?.[0];

  if (!first?.geometry) {
    return {
      status: "not_found",
      lat: null as number | null,
      lng: null as number | null,
    };
  }

  return {
    status: "success",
    lat: toNumber(first.geometry.lat),
    lng: toNumber(first.geometry.lng),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveGeocode({
  symbol,
  lat,
  lng,
  status,
  query,
}: {
  symbol: string;
  lat: number | null;
  lng: number | null;
  status: string;
  query: string | null;
}) {
  const { data: affected, error } = await supabase.rpc(
    "ci_update_profile_geocode",
    {
      p_symbol: symbol,
      p_hq_lat: lat,
      p_hq_lng: lng,
      p_geocode_provider: "opencage",
      p_geocode_status: status,
      p_geocode_query: query,
    },
  );

  if (error) throw error;

  return Number(affected ?? 0);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENCAGE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing OPENCAGE_API_KEY in .env.local / Vercel env.",
        },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);

    const requestedLimit = Number(body?.limit ?? DEFAULT_LIMIT);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const symbols = Array.isArray(body?.symbols)
      ? body.symbols.map((x: unknown) => clean(x).toUpperCase()).filter(Boolean)
      : [];

    const { data, error } = await supabase
      .from("ci_corporate_profiles")
      .select(
        `
        symbol,
        company_name,
        address,
        city,
        state,
        country,
        hq_lat,
        hq_lng,
        geocode_status
      `,
      )
      .order("symbol", { ascending: true })
      .limit(1000);

    if (error) throw error;

    const allRows = (data ?? []) as ProfileRow[];

    const targetRows = allRows
      .filter((row) => {
        const symbol = clean(row.symbol).toUpperCase();

        if (symbols.length) {
          return symbols.includes(symbol);
        }

        const missingCoords = row.hq_lat == null || row.hq_lng == null;
        const finalFailedStatus = ["not_found", "skipped_empty_query"].includes(
          clean(row.geocode_status),
        );

        return missingCoords && !finalFailedStatus;
      })
      .slice(0, limit);

    if (!targetRows.length) {
      return NextResponse.json({
        ok: true,
        provider: "opencage",
        requested: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        dbUpdatedCount: 0,
        message: "No missing geocodes found.",
        details: [],
      });
    }

    const details: any[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let dbUpdatedCount = 0;

    for (const row of targetRows) {
      const geocodeQuery = buildQuery(row);

      if (!geocodeQuery) {
        skippedCount += 1;

        const dbUpdated = await saveGeocode({
          symbol: row.symbol,
          lat: null,
          lng: null,
          status: "skipped_empty_query",
          query: null,
        });

        dbUpdatedCount += dbUpdated;

        details.push({
          symbol: row.symbol,
          status: "skipped_empty_query",
          dbUpdated,
        });

        await sleep(1100);
        continue;
      }

      try {
        const result = await geocodeOpenCage(geocodeQuery, apiKey);

        const dbUpdated = await saveGeocode({
          symbol: row.symbol,
          lat: result.lat,
          lng: result.lng,
          status: result.status,
          query: geocodeQuery,
        });

        dbUpdatedCount += dbUpdated;

        if (result.status === "success") {
          successCount += 1;
        } else {
          failedCount += 1;
        }

        details.push({
          symbol: row.symbol,
          status: result.status,
          lat: result.lat,
          lng: result.lng,
          query: geocodeQuery,
          dbUpdated,
        });
      } catch (err) {
        failedCount += 1;

        const message =
          err instanceof Error ? err.message : "Unknown geocode error";

        const dbUpdated = await saveGeocode({
          symbol: row.symbol,
          lat: null,
          lng: null,
          status: "failed",
          query: geocodeQuery,
        });

        dbUpdatedCount += dbUpdated;

        details.push({
          symbol: row.symbol,
          status: "failed",
          error: message,
          query: geocodeQuery,
          dbUpdated,
        });
      }

      await sleep(1100);
    }

    return NextResponse.json({
      ok: true,
      provider: "opencage",
      requested: targetRows.length,
      successCount,
      failedCount,
      skippedCount,
      dbUpdatedCount,
      details,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to refresh geocodes.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
