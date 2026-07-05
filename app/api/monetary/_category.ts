import { NextResponse } from "next/server";

export type MonetaryIndicator = {
  code: string;
  label: string;
  unit: string | null;
  category: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeIso3(value: string | null | undefined) {
  const iso3 = clean(value || "PAK")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);

  return iso3 || "PAK";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").trim());

  return Number.isFinite(n) ? n : null;
}

async function fetchWorldBankIndicator(
  country: string,
  indicator: MonetaryIndicator,
  includeSeries: boolean,
) {
  const currentYear = new Date().getUTCFullYear();
  const fromYear = currentYear - 45;

  const url =
    `https://api.worldbank.org/v2/country/${encodeURIComponent(country)}` +
    `/indicator/${encodeURIComponent(indicator.code)}` +
    `?format=json&per_page=20000&date=${fromYear}:${currentYear}`;

  const res = await fetch(url, {
    next: { revalidate: 43200 },
    headers: {
      Accept: "application/json",
      "User-Agent": "Stratify Monetary API https://worldstats360.com",
    },
  });

  if (!res.ok) {
    throw new Error(`World Bank failed for ${indicator.code}: ${res.status}`);
  }

  const json = await res.json();
  const rows = Array.isArray(json?.[1]) ? json[1] : [];

  const allPoints = rows
    .map((r: any) => ({
      year: Number(r?.date),
      value: toNumber(r?.value),
      indicator: indicator.code,
      indicatorName: clean(r?.indicator?.value) || indicator.label,
      countryIso3: clean(r?.countryiso3code) || country,
      countryName: clean(r?.country?.value) || country,
      source: "World Bank",
    }))
    .filter((r: any) => Number.isFinite(r.year))
    .sort((a: any, b: any) => b.year - a.year);

  const validPoints = allPoints.filter((p: any) => p.value !== null);
  const latest = validPoints[0] || null;

  return {
    code: indicator.code,
    label: indicator.label,
    category: indicator.category,
    unit: indicator.unit,
    latestYear: latest?.year ?? null,
    latestValue: latest?.value ?? null,
    countryIso3: latest?.countryIso3 ?? country,
    countryName: latest?.countryName ?? country,
    source: "World Bank",
    sourceUrl: url,
    availablePoints: validPoints.length,
    firstAvailableYear: validPoints.length
      ? validPoints[validPoints.length - 1].year
      : null,
    lastAvailableYear: latest?.year ?? null,
    series: includeSeries ? validPoints : undefined,
  };
}

export async function buildMonetaryCategoryResponse(
  req: Request,
  categoryTitle: string,
  indicators: MonetaryIndicator[],
) {
  try {
    const { searchParams } = new URL(req.url);

    const country = normalizeIso3(
      searchParams.get("country") || searchParams.get("iso3"),
    );

    const includeSeries =
      searchParams.get("series") === "1" ||
      searchParams.get("includeSeries") === "true";

    const settled = await Promise.allSettled(
      indicators.map((indicator) =>
        fetchWorldBankIndicator(country, indicator, includeSeries),
      ),
    );

    const rows = settled.map((result, index) => {
      const meta = indicators[index];

      if (result.status === "fulfilled") return result.value;

      return {
        code: meta.code,
        label: meta.label,
        category: meta.category,
        unit: meta.unit,
        latestYear: null,
        latestValue: null,
        countryIso3: country,
        countryName: country,
        source: "World Bank",
        sourceUrl: null,
        availablePoints: 0,
        firstAvailableYear: null,
        lastAvailableYear: null,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : "Fetch failed",
        series: includeSeries ? [] : undefined,
      };
    });

    const available = rows.filter((x) => x.latestValue !== null);

    return NextResponse.json(
      {
        ok: true,
        module: "Monetary & Financial Economics",
        title: categoryTitle,
        source_mode: "REST-first",
        primary_source: "World Bank Indicators API",
        country,
        compact: !includeSeries,
        coverage: {
          requested_indicators: indicators.length,
          available_latest_values: available.length,
          missing_latest_values: indicators.length - available.length,
        },
        indicators: rows,
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=43200, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        module: "Monetary & Financial Economics",
        title: categoryTitle,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load monetary category.",
        indicators: [],
      },
      { status: 500 },
    );
  }
}
