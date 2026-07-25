import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetricFormat = "pct" | "num";

type MetricMeta = {
  key: string;
  label: string;
  unit: string | null;
  fmt: MetricFormat;
};

const METRICS: MetricMeta[] = [
  { key: "renewables_share_energy", label: "Renewables share of energy", unit: "%", fmt: "pct" },
  { key: "fossil_share_energy", label: "Fossil share of energy", unit: "%", fmt: "pct" },
  { key: "low_carbon_share_energy", label: "Low-carbon share of energy", unit: "%", fmt: "pct" },
  { key: "electricity_generation", label: "Electricity generation", unit: "TWh", fmt: "num" },
  { key: "electricity_demand", label: "Electricity demand", unit: "TWh", fmt: "num" },
  { key: "primary_energy_consumption", label: "Primary energy consumption", unit: "TWh", fmt: "num" },
  { key: "energy_per_capita", label: "Energy per capita", unit: "kWh", fmt: "num" },
  { key: "energy_per_gdp", label: "Energy per GDP", unit: "kWh/$", fmt: "num" },
  { key: "carbon_intensity_elec", label: "Carbon intensity of electricity", unit: "gCO₂/kWh", fmt: "num" },
  { key: "solar_share_elec", label: "Solar share of electricity", unit: "%", fmt: "pct" },
  { key: "wind_share_elec", label: "Wind share of electricity", unit: "%", fmt: "pct" },
  { key: "hydro_share_elec", label: "Hydro share of electricity", unit: "%", fmt: "pct" },
  { key: "nuclear_share_elec", label: "Nuclear share of electricity", unit: "%", fmt: "pct" },
  { key: "coal_share_elec", label: "Coal share of electricity", unit: "%", fmt: "pct" },
  { key: "gas_share_elec", label: "Gas share of electricity", unit: "%", fmt: "pct" },
  { key: "oil_share_elec", label: "Oil share of electricity", unit: "%", fmt: "pct" },
  { key: "greenhouse_gas_emissions", label: "Greenhouse gas emissions", unit: "MtCO₂e", fmt: "num" },
  { key: "population", label: "Population", unit: null, fmt: "num" },
  { key: "gdp", label: "GDP", unit: "US$", fmt: "num" },
];

const LIVE_METRIC_KEYS = [
  "primary_energy_consumption",
  "fossil_share_energy",
  "renewables_share_energy",
  "low_carbon_share_energy",
  "electricity_generation",
  "electricity_demand",
] as const;

function normText(v: string | null, fallback: string) {
  const value = String(v ?? "").trim();
  return value || fallback;
}

function normInt(v: string | null, fallback: number | null) {
  if (v == null || v === "") return fallback;
  const value = Number(v);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function normMetric(v: string | null) {
  const metric = String(v ?? "").trim();
  return METRICS.find((item) => item.key === metric)?.key ?? "renewables_share_energy";
}

function jsonError(message: string) {
  return NextResponse.json(
    { ok: false, error: message },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const metric = normMetric(searchParams.get("metric"));
    const requestedCountry = normText(searchParams.get("country"), "World");
    const from = normInt(searchParams.get("from"), null);
    const to = normInt(searchParams.get("to"), null);
    const rankYear = normInt(searchParams.get("rankYear"), null);
    const q = normText(searchParams.get("q"), "");

    const { data: countries, error: countryError } = await supabase.rpc(
      "energy_country_list",
      { in_metric: metric, in_q: q, in_lim: 400 },
    );

    if (countryError) return jsonError(countryError.message);

    const countryList: string[] = (countries ?? [])
      .map((row: any) => String(row?.country ?? "").trim())
      .filter(Boolean);

    const safeCountry = countryList.includes(requestedCountry)
      ? requestedCountry
      : countryList.includes("World")
        ? "World"
        : (countryList[0] ?? "World");

    const [coverageResult, latestResult] = await Promise.all([
      supabase.rpc("energy_coverage", { in_country: safeCountry, in_metric: metric }),
      supabase.rpc("energy_latest", { in_country: safeCountry, in_metric: metric }),
    ]);

    if (coverageResult.error) return jsonError(coverageResult.error.message);
    if (latestResult.error) return jsonError(latestResult.error.message);

    const coverage = coverageResult.data?.[0] ?? { min_year: null, max_year: null, points: 0 };
    const minYear = coverage.min_year ?? null;
    const maxYear = coverage.max_year ?? null;
    const safeRankYear = (rankYear ?? maxYear ?? 2022) as number;

    const [seriesResult, rankResult, livePack] = await Promise.all([
      supabase.rpc("energy_series", {
        in_country: safeCountry,
        in_metric: metric,
        in_from: from ?? minYear,
        in_to: to ?? maxYear,
      }),
      supabase.rpc("energy_rank_pack", {
        in_metric: metric,
        in_year: safeRankYear,
        in_country: safeCountry,
      }),
      Promise.all(
        LIVE_METRIC_KEYS.map(async (key) => {
          const meta = METRICS.find((item) => item.key === key)!;
          const { data, error } = await supabase.rpc("energy_latest", {
            in_country: safeCountry,
            in_metric: key,
          });

          if (error) console.error(`[energy] live metric failed: ${key}`, error.message);
          const row = !error ? data?.[0] ?? null : null;

          return {
            ...meta,
            year: row?.year ?? null,
            value: row?.value ?? null,
          };
        }),
      ),
    ]);

    if (seriesResult.error) return jsonError(seriesResult.error.message);
    if (rankResult.error) return jsonError(rankResult.error.message);

    const pack = rankResult.data?.[0] ?? null;
    const metricMeta = METRICS.find((item) => item.key === metric)!;

    return NextResponse.json(
      {
        ok: true,
        meta: { countries: countryList, metrics: METRICS },
        country: safeCountry,
        metric,
        metric_meta: metricMeta,
        coverage: {
          min_year: minYear,
          max_year: maxYear,
          points: coverage.points ?? 0,
        },
        latest: latestResult.data?.[0] ?? null,
        series: Array.isArray(seriesResult.data) ? seriesResult.data : [],
        rankYear: safeRankYear,
        top10: pack?.top10 ?? [],
        country_rank: pack?.country_rank ?? null,
        total_countries: pack?.total_countries ?? null,
        live_pack: livePack,
        live_method: {
          type: "estimated_from_latest_annual_value",
          clock: "browser_local_time",
          reset: "local_midnight",
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return jsonError(error?.message || "Unknown energy API error");
  }
}
