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
];

// Below this, we can show a warning; but we still render the map if user wants.
const THRESH_WARN = 25;

// ✅ Put your topojson file here.
// If you already had a file before, use the same URL you used earlier.
// Common location in Next: /public/world-110m.json or /public/world.topo.json etc.
const TOPO_JSON_URL = "/maps/countries-iso3.json"; // <-- change if your file name differs

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
  region: string | null; // null = world
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

export default function Page() {
  const [region, setRegion] = useState<string>("Sub-Saharan Africa");
  const [indicator, setIndicator] = useState<string>("SP.POP.TOTL");

  const regionParam = useMemo(
    () => (region === "World" ? null : region),
    [region]
  );

  const [cov, setCov] = useState<WdiCoverageRow | null>(null);
  const [mapApiRows, setMapApiRows] = useState<MapRowApi[]>([]);
  const [snapshot, setSnapshot] = useState<LandingRow[]>([]);

  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const coveragePct = useMemo(() => (cov ? asPct(cov.coverage_pct) : 0), [cov]);

  const mapRows: StratifyMapRow[] = useMemo(() => {
    // StratifyMap expects: iso3,country,region,value (value must be number)
    return (mapApiRows ?? [])
      .filter((r) => typeof r.value === "number" && Number.isFinite(r.value))
      .map((r) => ({
        iso3: String(r.iso3 ?? "").toUpperCase(),
        country: String(r.country ?? ""),
        region: r.region ?? null,
        value: r.value,
      }));
  }, [mapApiRows]);

  const indicatorLabel = useMemo(() => {
    return INDICATORS.find((x) => x.code === indicator)?.label ?? indicator;
  }, [indicator]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");

      try {
        // Snapshot always
        const snap = await fetchLandingSnapshot({
          region: regionParam,
          iso3: null,
        });
        if (cancelled) return;
        setSnapshot(snap);

        // Coverage
        const c = await fetchWdiCoverage({
          indicatorCode: indicator,
          region: regionParam,
        });
        if (cancelled) return;
        setCov(c);

        // Map rows
        const rows = await fetchWdiMapLatest({
          indicator,
          region: regionParam,
        });
        if (cancelled) return;
        setMapApiRows(rows);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // reset selection when scope changes
    setSelectedIso3(null);
    run();

    return () => {
      cancelled = true;
    };
  }, [regionParam, indicator]);

  return (
    <div className="p-4">
      <div className="mb-2 text-xs font-mono text-red-600">
        PAGE VERSION: WDI-MAP NEW (StratifyMap)
      </div>

      {/* Header line */}
      <div className="mb-3 flex items-center justify-between gap-3">
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

        <div className="flex items-center gap-2">
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
            <SelectTrigger className="w-[320px] rounded-xl">
              <SelectValue placeholder="Indicator" />
            </SelectTrigger>
            <SelectContent>
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
            }}
          >
            Reset to World
          </Button>
        </div>
      </div>

      {err ? <div className="mb-3 text-sm text-red-600">{err}</div> : null}

      <div className="grid grid-cols-12 gap-4">
        {/* Map */}
        <Card className="col-span-12 lg:col-span-8 rounded-2xl border border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700">
              Map — {region} • {indicatorLabel}
            </CardTitle>

            {cov && coveragePct < THRESH_WARN ? (
              <div className="text-xs text-slate-600">
                Sparse indicator coverage in this scope — gray countries are
                expected.
              </div>
            ) : null}

            {/* optional selected country indicator */}
            {selectedIso3 ? (
              <div className="text-xs text-slate-600">
                Selected: <span className="font-semibold">{selectedIso3}</span>
              </div>
            ) : null}
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="h-[620px] w-full rounded-2xl bg-black/5" />
            ) : (
              <StratifyMap
                rows={mapRows}
                topoJsonUrl={TOPO_JSON_URL}
                selectedIso3={selectedIso3}
                onSelectIso3={(iso3) => setSelectedIso3(iso3)}
              />
            )}
          </CardContent>
        </Card>

        {/* Snapshot */}
        <Card className="col-span-12 lg:col-span-4 rounded-2xl border border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700">SNAPSHOT</CardTitle>
            <div className="text-xs text-slate-600">
              Current Snapshot (latest year per metric) • Scope:{" "}
              <span className="font-semibold">{region}</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {loading && snapshot.length === 0 ? (
              <div className="h-[520px] w-full rounded-2xl bg-black/5" />
            ) : (
              <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
                {snapshot.map((s) => {
                  const v = typeof s.value === "number" ? s.value : null;
                  const isPct = (s.label ?? "").includes("%");
                  const display =
                    v === null ? "—" : isPct ? v.toFixed(2) : fmtCompact(v);

                  return (
                    <div
                      key={s.indicator_code}
                      className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 border-black/5"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {s.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.year ?? ""}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-slate-900">
                        {display}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
