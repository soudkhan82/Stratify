// app/wdi-map/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import supabase from "@/app/config/supabase-config";

import StratifyMap, { type StratifyMapRow } from "@/app/components/StratifyMap";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  fetchWdiCoverage,
  asPct,
  type WdiCoverageRow,
} from "@/app/lib/rpc/wdi-coverage";

type MapRowApi = {
  iso3: string;
  country: string;
  region: string | null;
  year: number;
  value: number;
};

type LandingRow = {
  indicator_code: string;
  label: string;
  year: number | null;
  value: number | null;
};

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

const INDICATORS: Array<{ code: string; label: string }> = [
  { code: "SP.POP.TOTL", label: "Population" },
  { code: "NY.GDP.MKTP.CD", label: "GDP current US$" },
  { code: "SP.POP.GROW", label: "Population Growth (%)" },
  { code: "SP.DYN.CBRT.IN", label: "Birth Rate (per 1,000)" },
  { code: "SP.DYN.CDRT.IN", label: "Death Rate (per 1,000)" },
  { code: "SP.DYN.LE00.IN", label: "Life Expectancy (years)" },
  { code: "SP.URB.TOTL.IN.ZS", label: "Urban Population (%)" },
  { code: "SH.H2O.SMDW.ZS", label: "Access to Drinking Water (%)" },
  { code: "SH.STA.SMSS.ZS", label: "Access to Sanitation (%)" },
  { code: "EG.ELC.ACCS.ZS", label: "Access to Electricity (%)" },
  { code: "AG.LND.FRST.ZS", label: "Forest Area (%)" },
];

const TOPO_JSON_URL = "/maps/countries-110m.json";
const THRESH_WARN = 25;

function fmtCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toLocaleString();
}

async function fetchWdiMapLatest(args: {
  indicator: string;
  region: string | null;
}): Promise<MapRowApi[]> {
  const { data, error } = await supabase.rpc("fetch_wdi_map_latest", {
    p_indicator: args.indicator,
    p_region: args.region,
  });
  if (error) throw error;
  return (data ?? []) as MapRowApi[];
}

async function fetchLandingSnapshot(args: {
  region: string | null;
  iso3: string | null;
}): Promise<LandingRow[]> {
  const { data, error } = await supabase.rpc("fetch_landing_wdi", {
    p_region: args.region,
    p_iso3: args.iso3,
  });
  if (error) throw error;
  return (data ?? []) as LandingRow[];
}

function Skeleton({ h }: { h: number }) {
  return (
    <div className="w-full rounded-2xl bg-black/5" style={{ height: h }} />
  );
}

/** ------- TopoJSON Health Check (no DevTools needed) ------- */
type TopoHealth = {
  ok: boolean;
  url: string;
  error?: string;
  objectKeys?: string[];
  firstPropsKeys?: string[];
  sampleProps?: Record<string, unknown>;
  geoCount?: number;
};

async function topoHealthCheck(url: string): Promise<TopoHealth> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, url, error: `HTTP ${res.status} ${res.statusText}` };
    }

    const json = (await res.json()) as any;
    const objects = json?.objects;
    const objectKeys = objects ? Object.keys(objects) : [];
    const firstKey = objectKeys[0];

    const geoms = firstKey ? objects[firstKey]?.geometries : null;
    const geoCount = Array.isArray(geoms) ? geoms.length : 0;

    const firstProps = geoCount ? geoms[0]?.properties : null;
    const firstPropsKeys = firstProps ? Object.keys(firstProps) : [];

    return {
      ok: true,
      url,
      objectKeys,
      firstPropsKeys,
      sampleProps: (firstProps ?? undefined) as
        | Record<string, unknown>
        | undefined,
      geoCount,
    };
  } catch (e: any) {
    return { ok: false, url, error: String(e?.message ?? e) };
  }
}

export default function Page() {
  const [topoHealth, setTopoHealth] = useState<TopoHealth | null>(null);

  const [region, setRegion] = useState<string>("World");
  const [indicator, setIndicator] = useState<string>("SP.POP.TOTL");

  const regionParam = useMemo(
    () => (region === "World" ? null : region),
    [region]
  );

  const [cov, setCov] = useState<WdiCoverageRow | null>(null);
  const [mapApiRows, setMapApiRows] = useState<MapRowApi[]>([]);
  const [snapshotScope, setSnapshotScope] = useState<LandingRow[]>([]);
  const [snapshotSelected, setSnapshotSelected] = useState<LandingRow[]>([]);

  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);

  const [loadingMap, setLoadingMap] = useState(false);
  const [loadingSnap, setLoadingSnap] = useState(false);
  const [err, setErr] = useState<string>("");

  const coveragePct = useMemo(() => (cov ? asPct(cov.coverage_pct) : 0), [cov]);

  const indicatorLabel = useMemo(() => {
    return INDICATORS.find((x) => x.code === indicator)?.label ?? indicator;
  }, [indicator]);

  const mapRows: StratifyMapRow[] = useMemo(() => {
    return (mapApiRows ?? [])
      .filter((r) => typeof r.value === "number" && Number.isFinite(r.value))
      .map((r) => ({
        iso3: String(r.iso3 ?? "").toUpperCase(),
        country: String(r.country ?? ""),
        region: r.region ?? null,
        value: r.value,
      }));
  }, [mapApiRows]);

  const mapStats = useMemo(() => {
    const withValue = mapRows.length;
    const uniqueIso = new Set(mapRows.map((r) => r.iso3)).size;
    return { withValue, uniqueIso };
  }, [mapRows]);

  /** Topo health check on first load + whenever URL changes */
  useEffect(() => {
    let cancelled = false;

    async function runTopo() {
      const h = await topoHealthCheck(TOPO_JSON_URL);
      if (!cancelled) setTopoHealth(h);
    }

    runTopo();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Load (coverage + map + scope snapshot) */
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setLoadingMap(true);
      setLoadingSnap(true);

      try {
        // reset selection when scope/indicator changes
        setSelectedIso3(null);
        setSnapshotSelected([]);

        const [snap, c, rows] = await Promise.all([
          fetchLandingSnapshot({ region: regionParam, iso3: null }),
          fetchWdiCoverage({ indicatorCode: indicator, region: regionParam }),
          fetchWdiMapLatest({ indicator, region: regionParam }),
        ]);

        if (cancelled) return;

        setSnapshotScope(snap);
        setCov(c);
        setMapApiRows(rows);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) {
          setLoadingMap(false);
          setLoadingSnap(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [regionParam, indicator]);

  /** Load selected-country snapshot */
  useEffect(() => {
    let cancelled = false;

    async function runSelected() {
      if (!selectedIso3) return;

      setLoadingSnap(true);
      setErr("");

      try {
        const snap = await fetchLandingSnapshot({
          region: regionParam,
          iso3: selectedIso3,
        });

        if (cancelled) return;
        setSnapshotSelected(snap);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoadingSnap(false);
      }
    }

    runSelected();
    return () => {
      cancelled = true;
    };
  }, [selectedIso3, regionParam]);

  const snapToRender = selectedIso3 ? snapshotSelected : snapshotScope;

  return (
    <div className="p-4 space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold text-slate-900">
            World • Vital Statistics
          </div>

          {cov ? (
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-black text-white">
                Coverage: {coveragePct.toFixed(0)}% ({cov.countries_with_data}/
                {cov.countries_in_scope})
              </Badge>
              <div className="text-xs text-slate-600">
                No data: {cov.missing_countries}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <Select value={indicator} onValueChange={setIndicator}>
            <SelectTrigger className="w-[340px] rounded-xl">
              <SelectValue placeholder="Indicator" />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              {INDICATORS.map((x) => (
                <SelectItem key={x.code} value={x.code}>
                  {x.label} ({x.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            className="rounded-xl"
            variant="secondary"
            onClick={() => {
              setRegion("World");
              setIndicator("SP.POP.TOTL");
              setSelectedIso3(null);
            }}
          >
            Reset to World
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* Topo health panel (no DevTools needed) */}
      {topoHealth ? (
        <div className="rounded-xl border border-black/10 bg-white p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Map Health Check</div>
            <div className={topoHealth.ok ? "text-green-700" : "text-red-700"}>
              {topoHealth.ok ? "OK" : "FAILED"}
            </div>
          </div>

          <div className="mt-2 text-slate-700 space-y-1">
            <div>
              <span className="font-semibold">Topo URL:</span> {topoHealth.url}
            </div>

            {topoHealth.ok ? (
              <>
                <div>
                  <span className="font-semibold">objects keys:</span>{" "}
                  {topoHealth.objectKeys?.join(", ") || "—"}
                </div>
                <div>
                  <span className="font-semibold">geometries:</span>{" "}
                  {topoHealth.geoCount ?? 0}
                </div>
                <div>
                  <span className="font-semibold">first properties keys:</span>{" "}
                  {topoHealth.firstPropsKeys?.join(", ") || "—"}
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold">
                    sample properties (first feature)
                  </summary>
                  <pre className="mt-2 overflow-auto rounded-lg bg-black/5 p-2">
                    {JSON.stringify(topoHealth.sampleProps ?? {}, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <div className="mt-2 text-red-700">
                <span className="font-semibold">error:</span> {topoHealth.error}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-4">
        {/* Map */}
        <Card className="col-span-12 lg:col-span-8 rounded-2xl border border-black/10 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm text-slate-700">
                  Map — {region} • {indicatorLabel}
                </CardTitle>

                <div className="mt-1 text-xs text-slate-600">
                  {selectedIso3 ? (
                    <>
                      Selected:{" "}
                      <span className="font-semibold">{selectedIso3}</span>{" "}
                      <span className="text-slate-400">•</span>{" "}
                      <button
                        className="underline underline-offset-2"
                        onClick={() => setSelectedIso3(null)}
                      >
                        clear
                      </button>
                    </>
                  ) : (
                    "Click a country to drill into snapshot."
                  )}
                </div>

                {cov && coveragePct < THRESH_WARN ? (
                  <div className="mt-1 text-xs text-slate-600">
                    Sparse coverage in this scope — gray countries can be
                    expected.
                  </div>
                ) : null}
              </div>

              {/* Quick data-side health */}
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest text-slate-400">
                  Data health
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Values:{" "}
                  <span className="font-semibold text-slate-900">
                    {mapStats.withValue}
                  </span>{" "}
                  • Unique ISO3:{" "}
                  <span className="font-semibold text-slate-900">
                    {mapStats.uniqueIso}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {loadingMap ? (
              <Skeleton h={520} />
            ) : (
              <div className="rounded-2xl border border-black/10 bg-white p-2">
                <StratifyMap
                  rows={mapRows}
                  topoJsonUrl={TOPO_JSON_URL}
                  selectedIso3={selectedIso3}
                  onSelectIso3={(iso3) => setSelectedIso3(iso3)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Snapshot */}
        <Card className="col-span-12 lg:col-span-4 rounded-2xl border border-black/10 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">SNAPSHOT</CardTitle>
            <div className="text-xs text-slate-600">
              Scope:{" "}
              <span className="font-semibold">
                {selectedIso3 ? `${selectedIso3} (${region})` : region}
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {loadingSnap && snapToRender.length === 0 ? (
              <Skeleton h={520} />
            ) : (
              <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
                {snapToRender.map((s) => {
                  const v = typeof s.value === "number" ? s.value : null;
                  const isPct = (s.label ?? "").includes("%");
                  const display =
                    v === null ? "—" : isPct ? v.toFixed(2) : fmtCompact(v);

                  return (
                    <div
                      key={s.indicator_code}
                      className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-black/5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {s.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.year ?? ""}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-slate-900 tabular-nums">
                        {display}
                      </div>
                    </div>
                  );
                })}

                {snapToRender.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-600">
                    No snapshot rows returned for this scope.
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
