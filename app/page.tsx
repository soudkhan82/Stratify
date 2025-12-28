// app/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import StratifyMap, { type StratifyMapRow } from "@/app/components/StratifyMap";
import VitalStatsList, {
  type StatSection,
} from "@/app/components/VitalStatsList";

type LandingWdiRow = {
  indicator_code: string;
  label: string;
  year: string | null;
  value: number | null;
};

type LandingSuaRow = {
  label: string;
  unit: string | null;
  value: number | null;
  year: number;
};

type LandingResp = {
  scope?: "world" | "country";
  iso3?: string | null;
  region?: string | null;
  countryName?: string | null;
  wdi?: LandingWdiRow[];
  suaYear?: number | null;
  sua?: LandingSuaRow[];
  prodYear?: number | null;
  topCommodities?: { item: string; value: number }[];
  error?: string; // if your API sends error
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export default function HomePage() {
  const [iso3, setIso3] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [mapMetric, setMapMetric] = useState(MAP_METRICS[0].code);

  const [loadingLanding, setLoadingLanding] = useState(true);
  const [landing, setLanding] = useState<LandingResp | null>(null);
  const [landingError, setLandingError] = useState<string | null>(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [mapRows, setMapRows] = useState<StratifyMapRow[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  // -------------------------
  // Fetch Landing
  // -------------------------
  useEffect(() => {
    const run = async () => {
      setLoadingLanding(true);
      setLandingError(null);

      const params = new URLSearchParams();
      if (iso3) params.set("iso3", iso3);
      if (region) params.set("region", region);

      const res = await fetch(`/api/landing?${params.toString()}`, {
        cache: "no-store",
      });
      const json: unknown = await res.json();

      if (!res.ok) {
        setLanding(null);
        setLandingError(`Landing API failed (${res.status}).`);
        setLoadingLanding(false);
        return;
      }

      if (isRecord(json) && typeof json.error === "string" && json.error) {
        setLanding(null);
        setLandingError(json.error);
        setLoadingLanding(false);
        return;
      }

      // keep whatever server sends, but ensure arrays exist
      const normalized: LandingResp = isRecord(json)
        ? {
            ...json,
            wdi: Array.isArray(json.wdi) ? (json.wdi as LandingWdiRow[]) : [],
            sua: Array.isArray(json.sua) ? (json.sua as LandingSuaRow[]) : [],
            topCommodities: Array.isArray(json.topCommodities)
              ? (json.topCommodities as { item: string; value: number }[])
              : [],
          }
        : { wdi: [], sua: [], topCommodities: [] };

      setLanding(normalized);
      setLoadingLanding(false);
    };

    run().catch((e: unknown) => {
      setLanding(null);
      setLandingError(e instanceof Error ? e.message : "Landing API error.");
      setLoadingLanding(false);
    });
  }, [iso3, region]);

  // -------------------------
  // Fetch Map
  // -------------------------
  useEffect(() => {
    const run = async () => {
      setLoadingMap(true);
      setMapError(null);

      const params = new URLSearchParams();
      params.set("indicator", mapMetric);
      if (region) params.set("region", region);

      const res = await fetch(`/api/map?${params.toString()}`, {
        cache: "no-store",
      });
      const json: unknown = await res.json();

      if (!res.ok) {
        setMapRows([]);
        setMapError(`Map API failed (${res.status}).`);
        setLoadingMap(false);
        return;
      }

      if (isRecord(json) && typeof json.error === "string" && json.error) {
        setMapRows([]);
        setMapError(json.error);
        setLoadingMap(false);
        return;
      }

      // Accept MANY shapes: {points}, {rows}, {data}, or direct array
      const raw: unknown =
        isRecord(json) && Array.isArray(json.points)
          ? json.points
          : isRecord(json) && Array.isArray(json.rows)
          ? json.rows
          : isRecord(json) && Array.isArray(json.data)
          ? json.data
          : json;

      const rows: StratifyMapRow[] = Array.isArray(raw)
        ? raw
            .map((p): StratifyMapRow | null => {
              if (!isRecord(p)) return null;

              const iso =
                safeStr(p.iso3) ||
                safeStr(p.iso) ||
                safeStr(p.country_code) ||
                safeStr(p.iso_code);

              const country =
                safeStr(p.country) || safeStr(p.country_name) || iso;

              const reg =
                typeof p.region === "string"
                  ? p.region
                  : p.region === null
                  ? null
                  : null;

              const value = safeNum(p.value);
              if (!iso) return null;

              // if value missing/null → keep row but mark value as 0? better: skip so map stays grey
              if (value === null) return null;

              return { iso3: iso.toUpperCase(), country, region: reg, value };
            })
            .filter((x): x is StratifyMapRow => x !== null)
        : [];

      setMapRows(rows);
      setLoadingMap(false);
    };

    run().catch((e: unknown) => {
      setMapRows([]);
      setMapError(e instanceof Error ? e.message : "Map API error.");
      setLoadingMap(false);
    });
  }, [mapMetric, region]);

  // -------------------------
  // Sections (FULL)
  // -------------------------
  const sections: StatSection[] = useMemo(() => {
    if (!landing) return [];

    const wdiRows = Array.isArray(landing.wdi) ? landing.wdi : [];
    const wdiMap = new Map(wdiRows.map((x) => [x.label, x]));

    const scope = landing.scope ?? "world";
    const countryTitle = (
      landing.countryName ??
      landing.iso3 ??
      "COUNTRY"
    ).toUpperCase();

    const population: StatSection = {
      title:
        scope === "world" ? "WORLD POPULATION" : `${countryTitle} — POPULATION`,
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

    const suaRows = Array.isArray(landing.sua) ? landing.sua : [];
    const suaSection: StatSection = {
      title: `STRATIFY EDGE — FOOD SECURITY (SUA) ${
        landing.suaYear ? `(${landing.suaYear})` : ""
      }`,
      rows: suaRows.map((r) => ({
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

    const topComms = Array.isArray(landing.topCommodities)
      ? landing.topCommodities
      : [];
    const prodSection: StatSection = {
      title: `STRATIFY EDGE — TOP COMMODITIES BY PRODUCTION ${
        landing.prodYear ? `(${landing.prodYear})` : ""
      }`,
      rows: topComms.map((r) => ({
        label: r.item,
        value: formatNumber(r.value),
        meta: "",
        indicatorCode: null,
      })),
    };

    return [population, economy, healthEnv, suaSection, prodSection];
  }, [landing]);

  const wdiCount = landing?.wdi?.length ?? 0;

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
              onChange={(e) => setRegion(e.target.value || null)}
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
        {/* Debug row (keep for now) */}
        <div className="mb-4 text-xs text-slate-500 flex flex-wrap gap-4">
          <div>
            <span className="font-semibold">Map rows:</span> {mapRows.length}
          </div>
          <div>
            <span className="font-semibold">WDI rows:</span> {wdiCount}
          </div>
          <div>
            <span className="font-semibold">Selected:</span> {iso3 ?? "WORLD"}
          </div>
          {mapError ? (
            <div className="text-red-600">Map error: {mapError}</div>
          ) : null}
          {landingError ? (
            <div className="text-red-600">Landing error: {landingError}</div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Map */}
          <div className="lg:col-span-7">
            <div className="text-xs tracking-widest text-slate-400 mb-3">
              GEOMAP
            </div>

            {loadingMap ? (
              <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">
                Loading map…
              </div>
            ) : (
              <StratifyMap
                rows={mapRows}
                topoJsonUrl="/maps/countries-110m.json"
                selectedIso3={iso3}
                onSelectIso3={(v) => setIso3(v)}
              />
            )}

            <div className="mt-3 text-sm text-slate-500">
              Click a country to load country profile. Default: World.
            </div>
          </div>

          {/* Stats */}
          <div className="lg:col-span-5 lg:sticky lg:top-[72px]">
            <div className="max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
              {loadingLanding ? (
                <div className="text-sm text-slate-500">Loading…</div>
              ) : landingError ? (
                <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
                  {landingError}
                </div>
              ) : (
                <VitalStatsList
                  sections={sections}
                  region={region}
                  subtitle={
                    (landing?.scope ?? "world") === "world"
                      ? "Current World Snapshot (latest available year per metric)"
                      : `Selected: ${
                          landing?.countryName ?? landing?.iso3 ?? "Country"
                        }`
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
