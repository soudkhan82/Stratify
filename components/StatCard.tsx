// components/StatCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { METRICS, METRIC_KEYS, type MetricKey } from "@/lib/metrics";
import {
  fetchLatestForGeo,
  type StatBundle,
  type StatSeries,
} from "@/lib/stats/client";

type StatCardProps = {
  iso3: string;
  countryLabel?: string;
  /** Defaults to all metrics in METRIC_KEYS */
  metrics?: readonly MetricKey[];
  className?: string;
};

const fmtCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatCompact = (n: number | null): string =>
  typeof n === "number" && Number.isFinite(n) ? fmtCompact.format(n) : "—";

export function StatCard({
  iso3,
  countryLabel,
  metrics = METRIC_KEYS,
  className,
}: StatCardProps) {
  const [bundle, setBundle] = useState<StatBundle<MetricKey> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchLatestForGeo(iso3, metrics);
        if (!cancel) setBundle(data);
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [iso3, metrics]);

  const cards = useMemo(() => {
    if (!bundle) return [];
    // keep the incoming order from metrics prop
    return metrics.map((key) => {
      const stat: StatSeries | undefined = bundle[key];
      const latestVal = stat?.latest?.value ?? null;
      return {
        key,
        label: METRICS[key].label,
        unit: METRICS[key].unit,
        source: METRICS[key].source,
        value: latestVal,
      };
    });
  }, [bundle, metrics]);

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900 p-3 ${
        className ?? ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-100">
          Latest indicators{countryLabel ? ` — ${countryLabel}` : ""}
        </div>
        {loading ? (
          <span className="text-xs text-slate-400">Loading…</span>
        ) : err ? (
          <span className="text-xs text-rose-400">Error: {err}</span>
        ) : null}
      </div>

      {/* Grid of small stat chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {cards.map((c) => (
          <div
            key={c.key}
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="text-xs text-slate-400">{c.label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-100">
              {formatCompact(c.value)}{" "}
              <span className="text-xs font-normal text-slate-400">
                {c.unit}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Source: {c.source}
            </div>
          </div>
        ))}
      </div>

      {!loading && !err && cards.length === 0 && (
        <div className="text-slate-400 text-sm">No indicators available.</div>
      )}
    </div>
  );
}
