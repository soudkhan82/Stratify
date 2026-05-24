// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import StratifyMap, { StratifyMapRow } from "@/app/components/StratifyMap";
import VitalStatsList, { StatSection } from "@/app/components/VitalStatsList";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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

const NAV_ITEMS = [
  { label: "Home", href: "/" },

  { label: "Debt", href: "/debt" },
  { label: "Energy", href: "/energy" },
  { label: "FAO", href: "/fao" },
  { label: "Fiscal", href: "/fiscal" },
  { label: "IMF", href: "/imf" },
  { label: "WDI", href: "/wdi" },
];

/* =======================
   Helpers
======================= */

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return v.toLocaleString();
}

function toRegionParam(r: string): string | null {
  return r === "World" ? null : r;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* =======================
   Top Navbar
======================= */

function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-black text-white shadow-md">
            S
          </div>

          <div>
            <div className="stratify-logo-title">Stratify</div>
            <div className="stratify-logo-subtitle">Analytics</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-full px-4 py-2 text-sm font-extrabold transition",
                  active
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-950",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/world"
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-200"
          >
            Explore
          </Link>

          <Link
            href="/imf"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700"
          >
            IMF Data
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-white/95 px-4 py-2 lg:hidden">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold",
                  active
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
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
      )}`,
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
          { label: "Region", value: row?.region ?? "—" },
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
    <main className="min-h-screen bg-slate-100">
      <TopNav />

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

      <div className="relative z-10 min-h-screen overflow-hidden">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-7">
          <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-xl backdrop-blur-xl">
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

              <div className="flex flex-wrap items-center gap-2">
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="w-[240px] rounded-xl border border-slate-200 bg-white shadow-sm">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={indicator} onValueChange={setIndicator}>
                  <SelectTrigger className="w-[320px] rounded-xl border border-slate-200 bg-white shadow-sm">
                    <SelectValue placeholder="Indicator" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[340px]">
                    {INDICATORS.map((x) => (
                      <SelectItem key={x.code} value={x.code}>
                        {x.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="secondary"
                  className="rounded-xl border border-slate-200 bg-white shadow-sm"
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
          </div>

          {err ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-3 text-sm font-semibold text-red-700 backdrop-blur">
              {err}
            </div>
          ) : null}

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-8">
              {loading ? (
                <div className="h-[560px] rounded-3xl border border-white/70 bg-white/70 shadow-xl backdrop-blur-xl" />
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
          </div>

          <div className="h-2" />
        </div>
      </div>
    </main>
  );
}
