import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WbCountryRow = {
  id?: unknown;
  iso2Code?: unknown;
  name?: unknown;
  region?: {
    id?: unknown;
    value?: unknown;
  };
  adminregion?: {
    id?: unknown;
    value?: unknown;
  };
  incomeLevel?: {
    id?: unknown;
    value?: unknown;
  };
  capitalCity?: unknown;
  longitude?: unknown;
  latitude?: unknown;
};

const FALLBACK_REGIONS = [
  { code: "WLD", name: "World", type: "region" },
  { code: "SSF", name: "Sub-Saharan Africa", type: "region" },
  { code: "ECS", name: "Europe & Central Asia", type: "region" },
  { code: "MEA", name: "Middle East & North Africa", type: "region" },
  { code: "SAS", name: "South Asia", type: "region" },
  { code: "EAS", name: "East Asia & Pacific", type: "region" },
  { code: "LCN", name: "Latin America & Caribbean", type: "region" },
  { code: "NAC", name: "North America", type: "region" },
];

const REGION_ORDER = ["WLD", "SSF", "ECS", "MEA", "SAS", "EAS", "LCN", "NAC"];

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function code3(v: unknown) {
  return clean(v).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

function numOrNull(v: unknown) {
  const n = Number(clean(v));
  return Number.isFinite(n) ? n : null;
}

function uniqueByCode<T extends { code: string }>(rows: T[]) {
  const map = new Map<string, T>();

  for (const row of rows) {
    if (!row.code) continue;
    if (!map.has(row.code)) map.set(row.code, row);
  }

  return Array.from(map.values());
}

export async function GET() {
  try {
    const url =
      "https://api.worldbank.org/v2/country/all?format=json&per_page=500";

    const res = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      headers: {
        Accept: "application/json",
        "User-Agent": "Stratify Monetary Countries API https://worldstats360.com",
      },
    });

    if (!res.ok) {
      throw new Error(`World Bank countries request failed: ${res.status}`);
    }

    const json = await res.json();
    const rows: WbCountryRow[] = Array.isArray(json?.[1]) ? json[1] : [];

    const countries = rows
      .map((row) => {
        const code = code3(row.id);
        const name = clean(row.name);
        const regionName = clean(row.region?.value);
        const regionCode = code3(row.region?.id);

        return {
          code,
          name,
          iso2: clean(row.iso2Code),
          region: regionName,
          regionCode,
          incomeLevel: clean(row.incomeLevel?.value),
          capitalCity: clean(row.capitalCity),
          longitude: numOrNull(row.longitude),
          latitude: numOrNull(row.latitude),
          type: "country" as const,
        };
      })
      .filter((row) => {
        if (!row.code || row.code.length !== 3) return false;
        if (!row.name) return false;
        if (!row.region || row.region === "Aggregates") return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const aggregateRows = rows
      .map((row) => {
        const code = code3(row.id);
        const name = clean(row.name);
        const regionName = clean(row.region?.value);

        return {
          code,
          name,
          type: "region" as const,
          region: "Aggregates",
          regionCode: code,
          source: "World Bank",
        };
      })
      .filter((row) => {
        if (!row.code || row.code.length !== 3) return false;
        if (!row.name) return false;
        return regionNameIsAggregate(row.region);
      });

    function regionNameIsAggregate(value: string) {
      return value === "Aggregates";
    }

    const regionMap = new Map<string, { code: string; name: string; type: "region" }>();

    for (const fallback of FALLBACK_REGIONS) {
      regionMap.set(fallback.code, fallback as { code: string; name: string; type: "region" });
    }

    for (const row of aggregateRows) {
      if (REGION_ORDER.includes(row.code)) {
        regionMap.set(row.code, {
          code: row.code,
          name: row.name,
          type: "region",
        });
      }
    }

    const regions = REGION_ORDER
      .map((code) => regionMap.get(code))
      .filter((row): row is { code: string; name: string; type: "region" } =>
        Boolean(row),
      );

    return NextResponse.json(
      {
        ok: true,
        source: "World Bank Countries API",
        regions,
        countries: uniqueByCode(countries),
        total_countries: countries.length,
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load countries.",
        regions: FALLBACK_REGIONS,
        countries: [],
      },
      { status: 500 },
    );
  }
}
