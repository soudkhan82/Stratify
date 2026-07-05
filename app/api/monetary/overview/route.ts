import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDICATORS = [
  { code: "FM.LBL.BMNY.GD.ZS", label: "Broad money", unit: "% of GDP", category: "Money Supply" },
  { code: "FM.LBL.BMNY.ZG", label: "Broad money growth", unit: "annual %", category: "Money Supply" },
  { code: "FS.AST.PRVT.GD.ZS", label: "Domestic credit to private sector by banks", unit: "% of GDP", category: "Banking / Credit" },
  { code: "FR.INR.LEND", label: "Lending interest rate", unit: "%", category: "Interest Rates" },
  { code: "FR.INR.DPST", label: "Deposit interest rate", unit: "%", category: "Interest Rates" },
  { code: "FR.INR.RINR", label: "Real interest rate", unit: "%", category: "Interest Rates" },
  { code: "PA.NUS.FCRF", label: "Official exchange rate", unit: "LCU per US$", category: "Exchange Rates" },
  { code: "FI.RES.TOTL.CD", label: "Total reserves including gold", unit: "current US$", category: "FX Reserves" },
  { code: "FI.RES.XGLD.CD", label: "Total reserves excluding gold", unit: "current US$", category: "FX Reserves" },
  { code: "FB.AST.NPER.ZS", label: "Bank nonperforming loans", unit: "% of total gross loans", category: "Banking Health" },
  { code: "FB.BNK.CAPA.ZS", label: "Bank capital to assets ratio", unit: "%", category: "Banking Health" },
  { code: "CM.MKT.LCAP.GD.ZS", label: "Listed companies market capitalization", unit: "% of GDP", category: "Capital Markets" },
  { code: "CM.MKT.LDOM.NO", label: "Listed domestic companies", unit: "count", category: "Capital Markets" },
  { code: "CM.MKT.TRAD.GD.ZS", label: "Stocks traded total value", unit: "% of GDP", category: "Capital Markets" }
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeIso3(value: string | null) {
  const iso3 = clean(value || "PAK")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);

  return iso3 || "PAK";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchWorldBankIndicator(
  country: string,
  indicator: typeof INDICATORS[number],
  includeSeries: boolean
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
      "User-Agent": "Stratify Monetary API https://worldstats360.com"
    }
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
      source: "World Bank"
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
    firstAvailableYear: validPoints.length ? validPoints[validPoints.length - 1].year : null,
    lastAvailableYear: latest?.year ?? null,
    series: includeSeries ? validPoints : undefined
  };
}

function groupByCategory(rows: any[]) {
  return rows.reduce((acc: Record<string, any[]>, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {});
}

function compactGroups(groups: Record<string, any[]>) {
  const output: Record<string, any[]> = {};

  for (const [category, rows] of Object.entries(groups)) {
    output[category] = rows.map((row) => ({
      code: row.code,
      label: row.label,
      unit: row.unit,
      latestYear: row.latestYear,
      latestValue: row.latestValue,
      availablePoints: row.availablePoints,
      firstAvailableYear: row.firstAvailableYear,
      lastAvailableYear: row.lastAvailableYear
    }));
  }

  return output;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const country = normalizeIso3(
      searchParams.get("country") || searchParams.get("iso3")
    );

    const includeSeries =
      searchParams.get("series") === "1" ||
      searchParams.get("includeSeries") === "true";

    const settled = await Promise.allSettled(
      INDICATORS.map((indicator) =>
        fetchWorldBankIndicator(country, indicator, includeSeries)
      )
    );

    const indicators = settled.map((result, index) => {
      const meta = INDICATORS[index];

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
        error: result.reason instanceof Error ? result.reason.message : "Fetch failed",
        series: includeSeries ? [] : undefined
      };
    });

    const available = indicators.filter((x) => x.latestValue !== null);
    const groups = groupByCategory(indicators);

    return NextResponse.json(
      {
        ok: true,
        module: "Monetary & Financial Economics",
        title: "Monetary & Financial Stability Intelligence",
        source_mode: "REST-first",
        primary_source: "World Bank Indicators API",
        country,
        compact: !includeSeries,
        coverage: {
          requested_indicators: INDICATORS.length,
          available_latest_values: available.length,
          missing_latest_values: INDICATORS.length - available.length
        },
        kpis: {
          money_supply: indicators.find((x) => x.code === "FM.LBL.BMNY.GD.ZS") ?? null,
          money_growth: indicators.find((x) => x.code === "FM.LBL.BMNY.ZG") ?? null,
          lending_rate: indicators.find((x) => x.code === "FR.INR.LEND") ?? null,
          exchange_rate: indicators.find((x) => x.code === "PA.NUS.FCRF") ?? null,
          total_reserves: indicators.find((x) => x.code === "FI.RES.TOTL.CD") ?? null,
          npl_ratio: indicators.find((x) => x.code === "FB.AST.NPER.ZS") ?? null,
          market_cap_gdp: indicators.find((x) => x.code === "CM.MKT.LCAP.GD.ZS") ?? null
        },
        groups: includeSeries ? groups : compactGroups(groups),
        indicators,
        notes: [
          "Default response is compact and excludes full time series.",
          "Add ?series=1 to include historical non-null series.",
          "Null-only years are removed from series output."
        ],
        generated_at: new Date().toISOString()
      },
      {
        headers: {
          "Cache-Control": "s-maxage=43200, stale-while-revalidate=86400"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        module: "Monetary & Financial Economics",
        error: error instanceof Error ? error.message : "Unable to load monetary overview"
      },
      { status: 500 }
    );
  }
}
