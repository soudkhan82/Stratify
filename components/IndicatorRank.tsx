// components/IndicatorRank.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { METRICS, type MetricKey } from "@/lib/metrics";
import { fetchLatestBulk } from "@/lib/datasources";

export type RankCountry = { name: string; cca3: string };
export type RankRow = {
  rank: number;
  cca3: string;
  name: string;
  value: number;
};

const fmtCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatCompact = (n: number) => fmtCompact.format(n);

export function IndicatorRank({
  continentLabel,
  countries,
  selectedIso3,
  metric,
  className,
}: {
  continentLabel: string;
  countries: readonly RankCountry[];
  selectedIso3: string;
  metric: MetricKey;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [viewportPx, setViewportPx] = useState<number | null>(null); // height to show header + 10 rows

  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  const m = METRICS[metric];

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const iso3s = countries.map((c) => c.cca3);
        const vmap = await fetchLatestBulk(iso3s, m.toSpec);
        if (!cancel) setValues(vmap);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [countries, m]);

  const rows: RankRow[] = useMemo(() => {
    return countries
      .map((c) => {
        const v = values[c.cca3];
        return typeof v === "number"
          ? { cca3: c.cca3, name: c.name, value: v }
          : null;
      })
      .filter(
        (x): x is { cca3: string; name: string; value: number } => x !== null
      )
      .sort((a, b) => b.value - a.value)
      .map((r, i) => ({ rank: i + 1, ...r }));
  }, [countries, values]);

  const mine = useMemo(() => {
    const i = rows.findIndex((r) => r.cca3 === selectedIso3);
    return {
      rank: i >= 0 ? rows[i].rank : null,
      total: rows.length,
      value: i >= 0 ? rows[i].value : null,
    };
  }, [rows, selectedIso3]);

  // Measure header + row height to compute container height for 10 visible rows
  useLayoutEffect(() => {
    // defer until DOM has rows
    const headerH = Math.ceil(
      theadRef.current?.getBoundingClientRect().height ?? 40
    );
    const rowEl = tbodyRef.current?.querySelector("tr");
    const rowH = Math.ceil(rowEl?.getBoundingClientRect().height ?? 40);

    const visible = Math.min(rows.length, 8); // show at most 10
    const totalH = headerH + visible * rowH;

    // Add 1px fudge for borders to avoid scrollbar jitter
    setViewportPx(totalH + 1);
  }, [rows.length]);

  const selectedName =
    countries.find((c) => c.cca3 === selectedIso3)?.name ?? selectedIso3;

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900 p-4 ${
        className ?? ""
      }`}
    >
      <div className="text-sm text-slate-300">
        Rank within{" "}
        <span className="font-medium text-slate-100">{continentLabel}</span> for{" "}
        <span className="font-medium text-slate-100">{m.label}</span>
      </div>

      {loading ? (
        <div className="mt-2 text-slate-400">Computing ranks…</div>
      ) : mine.total > 0 ? (
        <div className="mt-1 text-2xl font-bold">
          {mine.rank ?? "—"}{" "}
          <span className="text-sm text-slate-400">/ {mine.total}</span>
          <span className="ml-3 text-base font-medium text-slate-300">
            {typeof mine.value === "number"
              ? `${formatCompact(mine.value)} ${m.unit}`
              : "—"}
          </span>
        </div>
      ) : (
        <div className="mt-2 text-slate-400">No comparable data.</div>
      )}

      <div
        className="mt-3 overflow-y-auto rounded-lg border border-slate-800"
        style={viewportPx ? { height: `${viewportPx}px` } : undefined}
      >
        <table className="min-w-full text-sm">
          <thead ref={theadRef} className="bg-slate-800/60 text-slate-300">
            <tr className="text-left">
              <th className="px-3 py-2 w-14">#</th>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2 text-right">
                Value{" "}
                <span className="text-slate-500 font-normal">({m.unit})</span>
              </th>
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {rows.map((r) => {
              const isSel = r.cca3 === selectedIso3;
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
                  <td className={`px-3 py-2 ${isSel ? "font-semibold" : ""}`}>
                    {r.name}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      isSel ? "font-semibold" : ""
                    }`}
                  >
                    {new Intl.NumberFormat().format(r.value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        Selected: <span className="text-slate-200">{selectedName}</span> •
        Source: {m.source} • Code: {m.code}
      </div>
    </div>
  );
}
