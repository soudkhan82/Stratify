// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import StratifyMap from "@/app/components/StratifyMap";
import VitalStatsList, { StatSection } from "@/app/components/VitalStatsList";

type LandingResp = {
  scope: "world" | "country";
  iso3: string | null;
  region: string | null;
  countryName: string | null;
  wdi: {
    indicator_code: string;
    label: string;
    year: string | null;
    value: number | null;
  }[];
  suaYear: number | null;
  sua: {
    label: string;
    unit: string | null;
    value: number | null;
    year: number;
  }[];
  prodYear: number | null;
  topCommodities: { item: string; value: number }[];
};

const MAP_METRICS = [
  { code: "SP.POP.TOTL", label: "Population" },
  { code: "NY.GDP.MKTP.CD", label: "GDP (US$)" },
  { code: "NY.GDP.PCAP.CD", label: "GDP per Capita" },
  { code: "EG.ELC.ACCS.ZS", label: "Electricity Access (%)" },
  { code: "EN.ATM.CO2E.PC", label: "CO₂ per Capita" },
];

const REGIONS = [
  "East Asia & Pacific",
  "Europe & Central Asia",
  "Latin America & Caribbean",
  "Middle East & North Africa",
  "North America",
  "South Asia",
  "Sub-Saharan Africa",
] as const;

function formatNumber(v: number | null) {
  if (v === null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v);
}

export default function HomePage() {
  const [iso3, setIso3] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [mapMetric, setMapMetric] = useState(MAP_METRICS[0].code);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LandingResp | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      const params = new URLSearchParams();
      if (iso3) params.set("iso3", iso3);
      if (region) params.set("region", region);

      // ✅ helpful debug (remove later)
      console.log("[LANDING] params:", { iso3, region });

      const res = await fetch(`/api/landing?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();
      setData(json);
      setLoading(false);
    };

    run();
  }, [iso3, region]);

  const sections: StatSection[] = useMemo(() => {
    if (!data) return [];

    // Map by label so we can attach indicator_code for expandable rows
    const wdiMap = new Map(data.wdi.map((x) => [x.label, x]));

    const population: StatSection = {
      title:
        data.scope === "world"
          ? "WORLD POPULATION"
          : `${(data.countryName ?? data.iso3)?.toUpperCase()} — POPULATION`,
      rows: [
        {
          label: "Total Population",
          value: formatNumber(wdiMap.get("Total Population")?.value ?? null),
          meta: wdiMap.get("Total Population")?.year ?? "",
          indicatorCode: wdiMap.get("Total Population")?.indicator_code ?? null,
        },
        {
          label: "Population Growth (%)",
          value: wdiMap.get("Population Growth (%)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Population Growth (%)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Population Growth (%)")?.indicator_code ?? null,
        },
        {
          label: "Birth Rate (per 1,000)",
          value: wdiMap.get("Birth Rate (per 1,000)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Birth Rate (per 1,000)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Birth Rate (per 1,000)")?.indicator_code ?? null,
        },
        {
          label: "Death Rate (per 1,000)",
          value: wdiMap.get("Death Rate (per 1,000)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Death Rate (per 1,000)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Death Rate (per 1,000)")?.indicator_code ?? null,
        },
        {
          label: "Life Expectancy (years)",
          value:
            wdiMap.get("Life Expectancy (years)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Life Expectancy (years)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Life Expectancy (years)")?.indicator_code ?? null,
        },
        {
          label: "Urban Population (%)",
          value: wdiMap.get("Urban Population (%)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Urban Population (%)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Urban Population (%)")?.indicator_code ?? null,
        },
      ],
    };

    const economy: StatSection = {
      title: "GOVERNMENT & ECONOMICS",
      rows: [
        {
          label: "GDP (Current US$)",
          value: formatNumber(wdiMap.get("GDP (Current US$)")?.value ?? null),
          meta: wdiMap.get("GDP (Current US$)")?.year ?? "",
          indicatorCode:
            wdiMap.get("GDP (Current US$)")?.indicator_code ?? null,
        },
        {
          label: "GDP per Capita (US$)",
          value: formatNumber(
            wdiMap.get("GDP per Capita (US$)")?.value ?? null
          ),
          meta: wdiMap.get("GDP per Capita (US$)")?.year ?? "",
          indicatorCode:
            wdiMap.get("GDP per Capita (US$)")?.indicator_code ?? null,
        },
        {
          label: "GDP Growth (%)",
          value: wdiMap.get("GDP Growth (%)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("GDP Growth (%)")?.year ?? "",
          indicatorCode: wdiMap.get("GDP Growth (%)")?.indicator_code ?? null,
        },
        {
          label: "Inflation (CPI %)",
          value: wdiMap.get("Inflation (CPI %)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Inflation (CPI %)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Inflation (CPI %)")?.indicator_code ?? null,
        },
      ],
    };

    const healthEnv: StatSection = {
      title: "HEALTH, ENERGY & ENVIRONMENT",
      rows: [
        {
          label: "Under-5 Mortality",
          value: formatNumber(wdiMap.get("Under-5 Mortality")?.value ?? null),
          meta: wdiMap.get("Under-5 Mortality")?.year ?? "",
          indicatorCode:
            wdiMap.get("Under-5 Mortality")?.indicator_code ?? null,
        },
        {
          label: "Maternal Mortality",
          value: formatNumber(wdiMap.get("Maternal Mortality")?.value ?? null),
          meta: wdiMap.get("Maternal Mortality")?.year ?? "",
          indicatorCode:
            wdiMap.get("Maternal Mortality")?.indicator_code ?? null,
        },
        {
          label: "Access to Drinking Water (%)",
          value:
            wdiMap.get("Access to Drinking Water (%)")?.value?.toFixed(2) ??
            "—",
          meta: wdiMap.get("Access to Drinking Water (%)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Access to Drinking Water (%)")?.indicator_code ?? null,
        },
        {
          label: "Access to Sanitation (%)",
          value:
            wdiMap.get("Access to Sanitation (%)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Access to Sanitation (%)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Access to Sanitation (%)")?.indicator_code ?? null,
        },
        {
          label: "CO₂ per Capita",
          value:
            wdiMap.get("CO₂ Emissions per Capita")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("CO₂ Emissions per Capita")?.year ?? "",
          indicatorCode:
            wdiMap.get("CO₂ Emissions per Capita")?.indicator_code ?? null,
        },
        {
          label: "Access to Electricity (%)",
          value:
            wdiMap.get("Access to Electricity (%)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Access to Electricity (%)")?.year ?? "",
          indicatorCode:
            wdiMap.get("Access to Electricity (%)")?.indicator_code ?? null,
        },
        {
          label: "Forest Area (%)",
          value: wdiMap.get("Forest Area (%)")?.value?.toFixed(2) ?? "—",
          meta: wdiMap.get("Forest Area (%)")?.year ?? "",
          indicatorCode: wdiMap.get("Forest Area (%)")?.indicator_code ?? null,
        },
      ],
    };

    const suaSection: StatSection = {
      title: `STRATIFY EDGE — FOOD SECURITY (SUA) ${
        data.suaYear ? `(${data.suaYear})` : ""
      }`,
      rows: (data.sua ?? []).map((r) => ({
        label: r.label,
        value:
          r.value == null
            ? "—"
            : new Intl.NumberFormat(undefined, {
                maximumFractionDigits: 2,
              }).format(r.value),
        meta: r.unit ?? "",
        indicatorCode: null,
      })),
    };

    const prodSection: StatSection = {
      title: `STRATIFY EDGE — TOP COMMODITIES BY PRODUCTION ${
        data.prodYear ? `(${data.prodYear})` : ""
      }`,
      rows: (data.topCommodities ?? []).map((r) => ({
        label: r.item,
        value: formatNumber(r.value),
        meta: "",
        indicatorCode: null,
      })),
    };

    return [population, economy, healthEnv, suaSection, prodSection];
  }, [data]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top bar */}
      <div className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-semibold tracking-tight">Stratify</div>
            <div className="text-sm text-slate-500">
              World • Vital Statistics
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={region ?? ""}
              onChange={(e) => {
                const next = e.target.value || null;
                setRegion(next);

                // optional: clear selection when region changes
                // setIso3(null);
              }}
            >
              <option value="">All Regions (World)</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={mapMetric}
              onChange={(e) => setMapMetric(e.target.value)}
            >
              {MAP_METRICS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>

            <button
              className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50"
              onClick={() => setIso3(null)}
            >
              Reset to World
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ✅ Left: Map (slightly narrower) */}
          <div className="lg:col-span-7">
            <div className="text-xs tracking-widest text-slate-400 mb-3">
              GEOMAP
            </div>
            <StratifyMap
              indicator={mapMetric}
              region={region}
              selectedIso3={iso3}
              onSelectIso3={(v) => setIso3(v)}
            />
            <div className="mt-3 text-sm text-slate-500">
              Click a country to load country profile. Default: World.
            </div>
          </div>

          {/* ✅ Right: Stats (wider to avoid wrapping / unused space) */}
          <div className="lg:col-span-5 lg:sticky lg:top-[72px]">
            <div className="max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
              {loading && (
                <div className="text-sm text-slate-500">Loading…</div>
              )}
              {!loading && data && (
                <VitalStatsList
                  sections={sections}
                  region={region} // ✅ IMPORTANT: makes expandable ranking respect region
                  subtitle={
                    data.scope === "world"
                      ? "Current World Snapshot (latest available year per metric)"
                      : `Selected: ${data.countryName ?? data.iso3}`
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
