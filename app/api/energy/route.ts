import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normText(v: string | null, fallback: string) {
  const t = String(v ?? "").trim();
  return t ? t : fallback;
}
function normInt(v: string | null, fallback: number | null) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

const METRICS = [
  {
    key: "renewables_share_energy",
    label: "Renewables share of energy",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "fossil_share_energy",
    label: "Fossil share of energy",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "low_carbon_share_energy",
    label: "Low-carbon share of energy",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "electricity_generation",
    label: "Electricity generation",
    unit: "TWh",
    fmt: "num" as const,
  },
  {
    key: "electricity_demand",
    label: "Electricity demand",
    unit: "TWh",
    fmt: "num" as const,
  },
  {
    key: "primary_energy_consumption",
    label: "Primary energy consumption",
    unit: "TWh",
    fmt: "num" as const,
  },
  {
    key: "energy_per_capita",
    label: "Energy per capita",
    unit: "kWh",
    fmt: "num" as const,
  },
  {
    key: "energy_per_gdp",
    label: "Energy per GDP",
    unit: "kWh/$",
    fmt: "num" as const,
  },
  {
    key: "carbon_intensity_elec",
    label: "Carbon intensity of electricity",
    unit: "gCO₂/kWh",
    fmt: "num" as const,
  },
  {
    key: "solar_share_elec",
    label: "Solar share of electricity",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "wind_share_elec",
    label: "Wind share of electricity",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "hydro_share_elec",
    label: "Hydro share of electricity",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "nuclear_share_elec",
    label: "Nuclear share of electricity",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "coal_share_elec",
    label: "Coal share of electricity",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "gas_share_elec",
    label: "Gas share of electricity",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "oil_share_elec",
    label: "Oil share of electricity",
    unit: "%",
    fmt: "pct" as const,
  },
  {
    key: "greenhouse_gas_emissions",
    label: "Greenhouse gas emissions",
    unit: "MtCO₂e",
    fmt: "num" as const,
  },
  { key: "population", label: "Population", unit: null, fmt: "num" as const },
  { key: "gdp", label: "GDP", unit: "US$", fmt: "num" as const },
];

function normMetric(v: string | null) {
  const m = String(v ?? "").trim();
  return METRICS.find((x) => x.key === m)?.key ?? "renewables_share_energy";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const metric = normMetric(searchParams.get("metric"));
    const country = normText(searchParams.get("country"), "World");

    const from = normInt(searchParams.get("from"), null);
    const to = normInt(searchParams.get("to"), null);

    const rankYear = normInt(searchParams.get("rankYear"), null);
    const q = normText(searchParams.get("q"), "");

    // 1) Countries filtered by metric availability
    const { data: countries, error: cErr } = await supabase.rpc(
      "energy_country_list",
      {
        in_metric: metric,
        in_q: q,
        in_lim: 400,
      },
    );

    if (cErr) {
      return NextResponse.json(
        { ok: false, error: cErr.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const countryList: string[] = (countries || []).map((r: any) => r.country);

    // If chosen country is not valid for this metric, auto-fallback to World or first item
    const safeCountry = countryList.includes(country)
      ? country
      : countryList.includes("World")
        ? "World"
        : (countryList[0] ?? "World");

    // 2) Coverage (country+metric)
    const { data: cov, error: covErr } = await supabase.rpc("energy_coverage", {
      in_country: safeCountry,
      in_metric: metric,
    });

    if (covErr) {
      return NextResponse.json(
        { ok: false, error: covErr.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const coverage = cov?.[0] ?? { min_year: null, max_year: null, points: 0 };
    const min_year = coverage.min_year ?? null;
    const max_year = coverage.max_year ?? null;

    // default ranking year = latest available year for this country+metric
    const safeRankYear = (rankYear ?? max_year ?? 2022) as number;

    // 3) Latest non-null point
    const { data: latestRows, error: lErr } = await supabase.rpc(
      "energy_latest",
      {
        in_country: safeCountry,
        in_metric: metric,
      },
    );

    if (lErr) {
      return NextResponse.json(
        { ok: false, error: lErr.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const latest = latestRows?.[0] ?? null;

    // 4) Series non-null only (use coverage range if no explicit from/to)
    const { data: series, error: sErr } = await supabase.rpc("energy_series", {
      in_country: safeCountry,
      in_metric: metric,
      in_from: from ?? min_year,
      in_to: to ?? max_year,
    });

    if (sErr) {
      return NextResponse.json(
        { ok: false, error: sErr.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // 5) Top10 + country rank pack
    const { data: rankPack, error: rErr } = await supabase.rpc(
      "energy_rank_pack",
      {
        in_metric: metric,
        in_year: safeRankYear,
        in_country: safeCountry,
      },
    );

    if (rErr) {
      return NextResponse.json(
        { ok: false, error: rErr.message },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const pack = rankPack?.[0] ?? null;

    const metricMeta = METRICS.find((x) => x.key === metric)!;

    return NextResponse.json(
      {
        ok: true,
        meta: {
          countries: countryList,
          metrics: METRICS,
        },
        country: safeCountry,
        metric,
        metric_meta: metricMeta,

        coverage: {
          min_year,
          max_year,
          points: coverage.points ?? 0,
        },

        latest, // {year,value} or null
        series: Array.isArray(series) ? series : [], // [{year,value}]
        rankYear: safeRankYear,
        top10: pack?.top10 ?? [],
        country_rank: pack?.country_rank ?? null,
        total_countries: pack?.total_countries ?? null,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
