// app/geodashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import worldCountries from "world-countries";
import PoiMap, { type Poi } from "@/components/PoiMap";
import {
  METRICS,
  METRICS_BY_TOPIC,
  METRIC_KEYS,
  type MetricKey,
} from "@/lib/metrics";
import { fetchLatestMetrics } from "@/lib/stats/client";
import {
  fetchWorldBankSeries,
  type SeriesPoint,
} from "@/lib/fetchers/worldbank";

// Recharts (area trend)
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// ---------- Continents ----------
type Continent = "Africa" | "Americas" | "Asia" | "Europe" | "Oceania";
const CONTINENTS: Continent[] = [
  "Asia",
  "Africa",
  "Americas",
  "Europe",
  "Oceania",
];
const toContinent = (r?: string): Continent | null =>
  CONTINENTS.includes(r as Continent) ? (r as Continent) : null;

// ---------- Countries ----------
type Country = {
  name: string;
  cca3: string;
  continent: Continent;
  lat: number;
  lon: number;
};

const ALL_COUNTRIES: Country[] = worldCountries
  .map((c) => {
    const cont = toContinent(c.region);
    if (!cont || !Array.isArray(c.latlng) || c.latlng.length < 2) return null;
    return {
      name: c.name.common,
      cca3: c.cca3,
      continent: cont,
      lat: c.latlng[0],
      lon: c.latlng[1],
    } as Country;
  })
  .filter(Boolean) as Country[];

// ---------- Types ----------
type MetricValues = Record<MetricKey, number | null>;

// Topics we will consider for “top indicator” (skip environment)
const TOPIC_ORDER: Array<keyof typeof METRICS_BY_TOPIC> = [
  "demographics",
  "economy",
  "health",
  "energy",
  "agriculture",
];

// ---------- Formatting helpers ----------
const fmtCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatCompact = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n)
    ? fmtCompact.format(n)
    : String(n ?? "");

// Pull a World Bank code from the metric definition
function getWorldBankCode(metricKey: MetricKey): string | null {
  const m = METRICS[metricKey] as Record<string, unknown>;
  const candidates = ["wb", "code", "id", "indicator"];
  for (const k of candidates) {
    const v = m?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

// ---------- Tiny BarChart (no lib) ----------
type BarDatum = { name: string; value: number; cca3: string };

// pleasant, high-contrast palette for dark mode
const PALETTE = [
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#f59e0b", // amber-500
  "#a78bfa", // violet-400
  "#22d3ee", // cyan-400
  "#fb7185", // rose-400
  "#f472b6", // pink-400
  "#d946ef", // fuchsia-500
  "#f97316", // orange-500
  "#84cc16", // lime-500
];

function BarChart({
  title,
  unit,
  data,
  highlightCca3,
}: {
  title: string;
  unit: string;
  data: BarDatum[];
  highlightCca3?: string;
}) {
  const max = useMemo(
    () => (data.length ? Math.max(...data.map((d) => d.value)) || 1 : 1),
    [data]
  );
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 text-sm font-semibold text-slate-100">
        {title} <span className="text-slate-400">({unit})</span>
      </div>
      <div className="space-y-3">
        {data.map((d, i) => {
          const w = `${(d.value / max) * 100}%`;
          const isSel = d.cca3 === highlightCca3;
          const color = PALETTE[i % PALETTE.length];
          return (
            <div key={d.cca3}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span
                  className={`truncate ${
                    isSel ? "font-semibold text-slate-50" : "text-slate-300"
                  }`}
                >
                  {d.name}
                </span>
                <span
                  className={`ml-2 tabular-nums ${
                    isSel ? "font-semibold text-slate-50" : "text-slate-400"
                  }`}
                >
                  {formatCompact(d.value)}
                </span>
              </div>
              <div className="h-2 w-full rounded bg-slate-800">
                <div
                  className="h-2 rounded transition-all"
                  style={{
                    width: w,
                    background: isSel
                      ? `linear-gradient(90deg, ${color}, ${color})`
                      : color,
                    boxShadow: isSel ? `0 0 0 1px ${color}` : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Helpers ----------
const toNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

type RankRow = { rank: number; cca3: string; name: string; value: number };
function buildRankingForMetric(
  metricKey: MetricKey,
  countries: Country[],
  continentValues: Record<string, MetricValues>
): RankRow[] {
  const rows = countries
    .map((c) => {
      const v = toNumber(continentValues[c.cca3]?.[metricKey]);
      return v != null ? { cca3: c.cca3, name: c.name, value: v } : null;
    })
    .filter(
      (x): x is { cca3: string; name: string; value: number } => x !== null
    )
    .sort((a, b) => b.value - a.value);
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

// ---------- Component ----------
export default function GeoDashboard() {
  const [continent, setContinent] = useState<Continent>("Asia");

  const countries = useMemo(
    () =>
      ALL_COUNTRIES.filter((c) => c.continent === continent).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [continent]
  );

  // keep a valid selected country per continent for map center
  const [countryCca3, setCountryCca3] = useState<string>(
    countries[0]?.cca3 ?? ""
  );
  useEffect(() => {
    if (!countries.find((c) => c.cca3 === countryCca3)) {
      setCountryCca3(countries[0]?.cca3 ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries]);

  const selected = countries.find((c) => c.cca3 === countryCca3) ?? null;

  // ------ Time series state ------
  const [indicator, setIndicator] = useState<MetricKey>(METRIC_KEYS[0]);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  // Fetch WB series for selected country + indicator
  useEffect(() => {
    let cancel = false;
    const wbCode = getWorldBankCode(indicator);
    if (!countryCca3 || !wbCode) {
      setSeries([]);
      return;
    }

    (async () => {
      setSeriesLoading(true);
      try {
        const data = await fetchWorldBankSeries(wbCode, countryCca3);
        if (!cancel) setSeries(data ?? []);
      } catch {
        if (!cancel) setSeries([]);
      } finally {
        if (!cancel) setSeriesLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [countryCca3, indicator]);

  // --- Fetch continent-wide values (for picking top indicators & charts) ---
  const [continentValues, setContinentValues] = useState<
    Record<string, MetricValues>
  >({});
  const [loadingContinent, setLoadingContinent] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingContinent(true);
      try {
        const entries = await Promise.all(
          countries.map(async (c) => {
            const res = await fetchLatestMetrics(c.cca3, METRIC_KEYS);
            return [c.cca3, res] as const;
          })
        );
        if (!cancel) setContinentValues(Object.fromEntries(entries));
      } catch {
        if (!cancel) setContinentValues({});
      } finally {
        if (!cancel) setLoadingContinent(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [countries]);

  // --- Compute one “best” indicator per topic for the selected country ---
  type Picked = {
    topic: string;
    key: MetricKey;
    rank: number;
    total: number;
    value: number | null;
  };
  const pickedIndicators: Picked[] = useMemo(() => {
    if (!selected) return [];
    const out: Picked[] = [];

    for (const topic of TOPIC_ORDER) {
      const keys = METRICS_BY_TOPIC[topic];
      let best: Picked | null = null;

      for (const k of keys) {
        const selValNum = toNumber(continentValues[selected.cca3]?.[k]);
        if (selValNum == null) continue;

        const vals = countries
          .map((c) => toNumber(continentValues[c.cca3]?.[k]))
          .filter((v): v is number => v != null);

        if (!vals.length) continue;

        // Descending: larger value = better rank
        const sortedDesc = [...vals].sort((a, b) => b - a);
        const rank =
          sortedDesc.findIndex((v) => Math.abs(v - selValNum) < 1e-9) + 1;
        const total = sortedDesc.length;

        const row: Picked = { topic, key: k, rank, total, value: selValNum };
        if (!best || rank < best.rank) best = row;
      }

      if (best) out.push(best);
    }

    return out;
  }, [countries, continentValues, selected]);

  // --- Build top-10 bar data for each picked indicator ---
  type BarBlock = {
    topic: string;
    key: MetricKey;
    title: string;
    unit: string;
    data: BarDatum[];
  };
  const barBlocks: BarBlock[] = useMemo(() => {
    return pickedIndicators.map((p) => {
      const m = METRICS[p.key];
      const rows = countries
        .map((c) => ({
          name: c.name,
          cca3: c.cca3,
          value: toNumber(continentValues[c.cca3]?.[p.key]),
        }))
        .filter(
          (r): r is { name: string; cca3: string; value: number } =>
            r.value != null
        )
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      return {
        topic: p.topic,
        key: p.key,
        title: m.label,
        unit: m.unit,
        data: rows,
      };
    });
  }, [pickedIndicators, countries, continentValues]);

  // --- Rankings per metric (for modal) ---
  const allIndicators = useMemo(() => {
    return METRIC_KEYS.map((k) => ({
      key: k,
      topic: METRICS[k].topic,
      label: METRICS[k].label,
    }));
  }, []);
  const rankingsByMetric = useMemo(() => {
    const out = new Map<MetricKey, RankRow[]>();
    for (const m of allIndicators) {
      out.set(m.key, buildRankingForMetric(m.key, countries, continentValues));
    }
    return out;
  }, [allIndicators, countries, continentValues]);

  // --- Map points (no color coding) ---
  const points: Poi[] = countries.map((c) => ({
    id: c.cca3,
    name: c.name,
    lat: c.lat,
    lon: c.lon,
    value: 1,
  }));

  // --- Ranking modal state & handlers ---
  const [rankModalOpen, setRankModalOpen] = useState(false);
  const [rankCountry, setRankCountry] = useState<Country | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);

  const canShowModal = allIndicators.length > 0 && !loadingContinent;

  const handlePointClick = (p: Poi) => {
    const c = countries.find((x) => x.cca3 === p.id);
    if (!c) return;
    setRankCountry(c);
    setCountryCca3(c.cca3);
    if (!canShowModal) return; // avoid opening empty modal while loading
    setRankModalOpen(true);
    setActiveMetric(allIndicators[0]?.key ?? null);
  };

  useEffect(() => {
    if (rankModalOpen && allIndicators.length) {
      setActiveMetric((prev) => prev ?? allIndicators[0].key);
    } else if (!rankModalOpen) {
      setActiveMetric(null);
    }
  }, [rankModalOpen, allIndicators]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top-left logo bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60">
        <div className="mx-auto flex max-w-7xl items-center justify-start gap-4 px-4 py-2">
          <Link
            href="/"
            aria-label="Stratify home"
            className="inline-flex items-center shrink-0"
          >
            <Image
              src="/stratify.png"
              alt="Stratify"
              width={200}
              height={400}
              priority
              className="h-12 w-auto md:h-16"
            />
          </Link>

          <div className="min-w-0">
            <p className="text-sm md:text-base lg:text-lg font-medium text-slate-100/90 leading-snug">
              <span className="font-semibold text-slate-50">Stratify</span> —
              Visualize. Compare. Understand the World.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Map column */}
          <div className="w-full lg:w-1/2 space-y-3">
            {/* Compact ribbon with picked indicators */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
              <div className="flex flex-wrap gap-2 text-xs leading-tight">
                {loadingContinent || !selected ? (
                  <span className="text-slate-400">Loading summary…</span>
                ) : pickedIndicators.length ? (
                  pickedIndicators.map((p) => {
                    const m = METRICS[p.key];
                    const val =
                      p.value == null
                        ? "—"
                        : `${formatCompact(p.value)} ${m.unit}`;
                    return (
                      <span
                        key={`${p.topic}-${p.key}`}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-slate-200"
                      >
                        <span className="capitalize text-slate-300">
                          {p.topic}:
                        </span>
                        <span className="font-medium text-slate-100">
                          {m.label}
                        </span>
                        <span className="text-slate-400">• {val}</span>
                        <span className="text-slate-400">
                          • Rank {Number.isFinite(p.rank) ? p.rank : "—"}/
                          {p.total || "—"}
                        </span>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-400">No summary available.</span>
                )}
              </div>
            </div>

            {/* Selectors */}
            <div className="flex flex-wrap gap-3">
              <select
                value={continent}
                onChange={(e) => setContinent(e.target.value as Continent)}
                className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
              >
                {CONTINENTS.map((c) => (
                  <option key={c} className="bg-slate-900">
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={countryCca3}
                onChange={(e) => setCountryCca3(e.target.value)}
                className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
              >
                {countries.map((c) => (
                  <option key={c.cca3} value={c.cca3} className="bg-slate-900">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Map */}
            <PoiMap
              points={points}
              center={
                selected
                  ? { lon: selected.lon, lat: selected.lat, zoom: 3 }
                  : undefined
              }
              selected={
                selected ? { lon: selected.lon, lat: selected.lat } : undefined
              }
              selectedId={selected?.cca3}
              onPointClick={handlePointClick}
            />

            {/* Indicator dropdown + Area trend chart */}
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-slate-300">Indicator:</label>
              <select
                value={indicator}
                onChange={(e) => setIndicator(e.target.value as MetricKey)}
                className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
              >
                {METRIC_KEYS.map((k) => (
                  <option key={k} value={k} className="bg-slate-900">
                    {METRICS[k].label} ({METRICS[k].unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="h-[360px] w-full rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-100">
                {METRICS[indicator].label} — {selected?.name ?? "—"}{" "}
                <span className="text-slate-400">
                  ({METRICS[indicator].unit})
                </span>
              </div>
              {seriesLoading ? (
                <div className="text-center text-slate-400 py-10">
                  Loading trend…
                </div>
              ) : series.length ? (
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#60a5fa"
                          stopOpacity={0.65}
                        />
                        <stop
                          offset="100%"
                          stopColor="#60a5fa"
                          stopOpacity={0.06}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      tickMargin={6}
                      stroke="#94a3b8"
                      tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: "#cbd5e1", fontSize: 12 }}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #1f2937",
                        color: "#e2e8f0",
                      }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v) => formatCompact(v as number)}
                    />
                    <Legend wrapperStyle={{ color: "#cbd5e1" }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#93c5fd"
                      fill="url(#areaFill)"
                      name={selected?.name ?? "Selected country"}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-slate-400 py-10">
                  No time-series data available.
                </div>
              )}
            </div>
          </div>

          {/* Right: Two-per-row bar charts */}
          <div className="w-full lg:w-1/2">
            {loadingContinent ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
                Loading charts…
              </div>
            ) : barBlocks.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {barBlocks.map((blk) => (
                  <BarChart
                    key={`${blk.topic}-${blk.key}`}
                    title={blk.title}
                    unit={blk.unit}
                    data={blk.data}
                    highlightCca3={selected?.cca3}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
                No charts available.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Rankings modal */}
      {rankModalOpen && rankCountry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setRankModalOpen(false)}
        >
          <div
            className="w-[90vw] max-w-3xl max-h-[80vh] overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-100">
                  {rankCountry.name}
                </h3>
                <p className="text-sm text-slate-400">
                  Full rankings within{" "}
                  <span className="font-medium text-slate-200">
                    {continent}
                  </span>
                </p>
                {activeMetric &&
                  (() => {
                    const rows = rankingsByMetric.get(activeMetric) ?? [];
                    const idx = rows.findIndex(
                      (r) => r.cca3 === rankCountry.cca3
                    );
                    const rank = idx >= 0 ? rows[idx].rank : null;
                    const total = rows.length;
                    const m = METRICS[activeMetric];
                    const val = idx >= 0 ? rows[idx].value : null;
                    return (
                      <p className="text-sm text-slate-300 mt-1">
                        {m.label}:{" "}
                        {val != null ? `${formatCompact(val)} ${m.unit}` : "—"}{" "}
                        • Rank {rank ?? "—"}/{total || "—"}
                      </p>
                    );
                  })()}
              </div>
              <button
                className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-100 hover:bg-slate-800"
                onClick={() => setRankModalOpen(false)}
              >
                Close
              </button>
            </div>

            {/* Tabs for All indicators */}
            <div className="mb-4 flex flex-wrap gap-2">
              {allIndicators.map((mdef) => {
                const m = METRICS[mdef.key];
                const isActive = activeMetric === mdef.key;
                return (
                  <button
                    key={`${mdef.topic}-${mdef.key}`}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-700 text-slate-200 hover:bg-slate-800"
                    }`}
                    onClick={() => setActiveMetric(mdef.key)}
                  >
                    <span className="font-medium">{m.label}</span>
                    <span className="ml-1 text-xs opacity-80">({m.unit})</span>
                  </button>
                );
              })}
            </div>

            {/* Ranking table */}
            {activeMetric ? (
              (() => {
                const rows = rankingsByMetric.get(activeMetric) ?? [];
                const m = METRICS[activeMetric];
                const selectedCca3 = rankCountry?.cca3;

                return rows.length ? (
                  <div className="overflow-auto rounded-lg border border-slate-800">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-800/60 text-slate-300">
                        <tr className="text-left">
                          <th className="px-3 py-2 w-14">#</th>
                          <th className="px-3 py-2">Country</th>
                          <th className="px-3 py-2 text-right">
                            Value{" "}
                            <span className="text-slate-500 font-normal">
                              ({m.unit})
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const isSel = r.cca3 === selectedCca3;
                          return (
                            <tr
                              key={r.cca3}
                              className={
                                isSel
                                  ? "bg-blue-950/40 text-slate-100"
                                  : "odd:bg-slate-900 even:bg-slate-900/60 text-slate-200"
                              }
                            >
                              <td className="px-3 py-2 font-medium tabular-nums">
                                {r.rank}
                              </td>
                              <td
                                className={`px-3 py-2 ${
                                  isSel ? "font-semibold" : ""
                                }`}
                              >
                                {r.name}
                              </td>
                              <td
                                className={`px-3 py-2 text-right tabular-nums ${
                                  isSel ? "font-semibold" : ""
                                }`}
                              >
                                {formatCompact(r.value)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border border-slate-800 p-4 text-slate-300">
                    No data for this indicator.
                  </div>
                );
              })()
            ) : (
              <div className="rounded-md border border-slate-800 p-4 text-slate-300">
                Select an indicator above.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
