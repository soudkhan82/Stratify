// app/page.tsx (Landing Page)  OR wherever your landing page.tsx is
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

  /* ---- Fetch map rows ---- */
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

        // reset selection after filter changes
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
    [rows]
  );

  // ✅ NEW: click handler that routes to /world/country/[iso3]
  function handleSelectIso3(iso3: string) {
    const up = String(iso3 ?? "").toUpperCase();
    if (!up) return;

    // keep highlight
    setSelectedIso3(up);

    // navigate to country profile
    router.push(
      `/world/country/${encodeURIComponent(up)}?indicator=${encodeURIComponent(
        indicator
      )}`
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
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-widest text-slate-400">STRATIFY</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            World Map
          </h1>
          <div className="mt-1 text-sm text-slate-600">
            Use the filters, then click a country to open its profile.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Region dropdown */}
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-[240px] rounded-xl">
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

          {/* Indicator dropdown */}
          <Select value={indicator} onValueChange={setIndicator}>
            <SelectTrigger className="w-[320px] rounded-xl">
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
            className="rounded-xl"
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

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          {loading ? (
            <div className="h-[560px] rounded-xl bg-black/5" />
          ) : (
            <StratifyMap
              rows={mapRows}
              topoJsonUrl={TOPO_URL}
              selectedIso3={selectedIso3}
              onSelectIso3={handleSelectIso3} // ✅ routes now
              indicatorLabel={indicatorLabel}
              indicatorUnit={indicatorUnit}
            />
          )}
        </div>

        <div className="col-span-12 lg:col-span-4">
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
  );
}
