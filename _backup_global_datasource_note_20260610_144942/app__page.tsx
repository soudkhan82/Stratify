// app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import StratifyMap, { StratifyMapRow } from "@/app/components/StratifyMap";
import VitalStatsList, { StatSection } from "@/app/components/VitalStatsList";

import { Button } from "@/components/ui/button";

/* =======================
   Types
======================= */

type MapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

type MapApiResponse = {
  rows: MapRow[];
  error?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

/* =======================
   Config
======================= */

const TOPO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const REGIONS = [
  "World",
  "Sub-Saharan Africa",
  "Europe & Central Asia",
  "Middle East & North Africa",
  "South Asia",
  "East Asia & Pacific",
  "Latin America & Caribbean",
  "North America",
] as const;

const INDICATORS: Array<{ code: string; label: string; unit?: string }> = [
  { code: "SP.POP.TOTL", label: "Population" },
  { code: "NY.GDP.MKTP.CD", label: "GDP (current US$)", unit: "US$" },
  { code: "SP.POP.GROW", label: "Population Growth", unit: "%" },
  { code: "SP.DYN.LE00.IN", label: "Life Expectancy", unit: "years" },
  { code: "SP.URB.TOTL.IN.ZS", label: "Urban Population", unit: "%" },
  { code: "EG.ELC.ACCS.ZS", label: "Access to Electricity", unit: "%" },
];

const DEFAULT_INDICATOR = "SP.POP.TOTL";

/* =======================
   Helpers
======================= */

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "â€”";
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return v.toLocaleString();
}

function toRegionParam(r: string): string | null {
  return r === "World" ? null : r;
}

/* =======================
   Opaque Dropdown
======================= */

function OpaqueDropdown({
  value,
  options,
  widthClass,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  widthClass: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((x) => x.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${widthClass}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      >
        <span className="truncate">{selected?.label ?? "Select"}</span>

        <svg
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-[42px] z-[99999] max-h-[340px] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl ring-1 ring-black/5">
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>{option.label}</span>

                {active ? (
                  <span className="text-xs font-bold text-indigo-600">âœ“</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* =======================
   Page
======================= */

export default function Page() {
  const router = useRouter();

  const [region, setRegion] = useState<string>("World");
  const [indicator, setIndicator] = useState<string>(DEFAULT_INDICATOR);

  const [rows, setRows] = useState<MapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);

  const regionParam = useMemo(() => toRegionParam(region), [region]);

  const regionOptions: SelectOption[] = useMemo(
    () => REGIONS.map((r) => ({ value: r, label: r })),
    [],
  );

  const indicatorOptions: SelectOption[] = useMemo(
    () => INDICATORS.map((x) => ({ value: x.code, label: x.label })),
    [],
  );

  const indicatorMeta = useMemo(() => {
    return (
      INDICATORS.find((x) => x.code === indicator) ?? {
        code: indicator,
        label: indicator,
      }
    );
  }, [indicator]);

  const indicatorLabel = indicatorMeta.label;
  const indicatorUnit = indicatorMeta.unit;

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const qp = new URLSearchParams();
        qp.set("indicator", indicator);
        if (regionParam) qp.set("region", regionParam);

        const res = await fetch(`/api/map?${qp.toString()}`, {
          cache: "no-store",
        });

        const json = (await res.json()) as MapApiResponse;
        if (!res.ok) throw new Error(json?.error ?? "Failed to load map data");

        if (!alive) return;

        const safeRows = Array.isArray(json.rows) ? json.rows : [];
        setRows(safeRows);
        setSelectedIso3(null);
      } catch (e: unknown) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Failed to load map");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [indicator, regionParam]);

  const mapRows: StratifyMapRow[] = useMemo(
    () =>
      (rows ?? []).map((r) => ({
        iso3: String(r.iso3 ?? "").toUpperCase(),
        country: String(r.country ?? ""),
        region: r.region ?? null,
        value: n(r.value),
      })),
    [rows],
  );

  function handleSelectIso3(iso3: string) {
    const up = String(iso3 ?? "").toUpperCase();
    if (!up) return;

    setSelectedIso3(up);

    router.push(
      `/world/country/${encodeURIComponent(up)}?indicator=${encodeURIComponent(
        indicator,
      )}&dataset=wdi`,
    );
  }

  const stats: StatSection[] = useMemo(() => {
    if (!selectedIso3) {
      return [
        {
          title: "World",
          rows: [
            { label: "Indicator", value: indicatorLabel },
            { label: "Region scope", value: region },
            { label: "Countries", value: String(mapRows.length) },
          ],
        },
      ];
    }

    const row = mapRows.find((r) => r.iso3 === selectedIso3) ?? null;

    return [
      {
        title: "Selection",
        rows: [
          { label: "Country", value: row?.country ?? selectedIso3 },
          { label: "ISO3", value: selectedIso3 },
          { label: "Region", value: row?.region ?? "â€”" },
          {
            label: indicatorLabel,
            value: `${fmt(n(row?.value))}${
              indicatorUnit ? ` ${indicatorUnit}` : ""
            }`,
          },
        ],
      },
    ];
  }, [mapRows, selectedIso3, indicatorLabel, indicatorUnit, region]);

  return (
    <main className="relative min-h-screen bg-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/people_bg.png')",
            transform: "scale(1.02)",
            filter: "saturate(1.15) contrast(1.08) brightness(0.92)",
            opacity: 0.48,
          }}
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/76 to-white/62" />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-7">
          <section className="relative z-[100] rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="stratify-eyebrow">Stratify Analytics</div>

                <h1 className="stratify-hero-title mt-2">
                  World Intelligence Dashboard
                </h1>

                <p className="stratify-hero-text mt-4">
                  Explore trusted global indicators, country profiles, and
                  development insights through a clean analytics portal built
                  for fast comparison and decision-making.
                </p>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
                  <span className="font-bold text-slate-950">Stratify</span>{" "}
                  turns World Bank, FAO, fiscal, debt, energy, and macro
                  datasets into structured country intelligence.
                </p>
              </div>

              <div className="relative z-[9999] flex flex-wrap items-center gap-2">
                <OpaqueDropdown
                  value={region}
                  options={regionOptions}
                  widthClass="w-[240px]"
                  onChange={setRegion}
                />

                <OpaqueDropdown
                  value={indicator}
                  options={indicatorOptions}
                  widthClass="w-[320px]"
                  onChange={setIndicator}
                />

                <Button
                  variant="secondary"
                  className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  disabled={loading}
                  onClick={() => {
                    setRegion("World");
                    setIndicator(DEFAULT_INDICATOR);
                    setSelectedIso3(null);
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </section>

          {err ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-3 text-sm font-semibold text-red-700 backdrop-blur">
              {err}
            </div>
          ) : null}

          <section className="relative z-10 grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-8">
              {loading ? (
                <div className="flex h-[560px] items-center justify-center rounded-3xl border border-white/70 bg-white/70 shadow-xl backdrop-blur-xl">
                  <div className="flex min-w-[260px] flex-col items-center rounded-3xl border border-slate-200 bg-slate-950/90 px-8 py-7 text-white shadow-xl">
                    <div className="mb-4 h-11 w-11 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
                    <div className="text-base font-bold">
                      Loading dashboard...
                    </div>
                    <div className="mt-1 text-xs font-medium text-white/60">
                      Fetching global indicator data
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/65 shadow-xl backdrop-blur-xl">
                  <StratifyMap
                    rows={mapRows}
                    topoJsonUrl={TOPO_URL}
                    selectedIso3={selectedIso3}
                    onSelectIso3={handleSelectIso3}
                    indicatorLabel={indicatorLabel}
                    indicatorUnit={indicatorUnit}
                  />
                </div>
              )}
            </div>

            <div className="col-span-12 lg:col-span-4">
              <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-xl backdrop-blur-xl">
                <VitalStatsList
                  sections={stats}
                  region={selectedIso3 ?? region}
                  subtitle={
                    selectedIso3
                      ? "Opening selected country..."
                      : "Click a country to open profile"
                  }
                />
              </div>
            </div>
          </section>

          <div className="h-2" />
        </div>
      </div>
    </main>
  );
}


