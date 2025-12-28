"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import {
  fetchWdiMetricRanking,
  type WdiRankingRow,
} from "@/app/lib/rpc/wdiRanking";

/** ✅ IMPORTANT: StatRow now supports indicatorCode */
export type StatRow = {
  label: string;
  value: string;
  meta?: string;
  indicatorCode?: string | null;
};

export type StatSection = {
  title: string;
  rows: StatRow[];
};

type Props = {
  sections: StatSection[];
  subtitle?: string;
};

function formatSmart(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  if (abs >= 100) return v.toFixed(2);
  if (abs >= 10) return v.toFixed(2);
  return v.toFixed(4);
}

export default function VitalStatsList({ sections, subtitle }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, WdiRankingRow[]>>({});
  const [loadingIndicator, setLoadingIndicator] = useState<string | null>(null);

  async function toggleRow(
    sectionIdx: number,
    rowIdx: number,
    indicatorCode: string
  ) {
    const key = `${sectionIdx}:${rowIdx}`;
    const next = openKey === key ? null : key;
    setOpenKey(next);

    if (next && !cache[indicatorCode]) {
      setLoadingIndicator(indicatorCode);
      try {
        const rows = await fetchWdiMetricRanking(indicatorCode, 200);
        setCache((p) => ({ ...p, [indicatorCode]: rows }));
      } finally {
        setLoadingIndicator(null);
      }
    }
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden w-full">
      <div className="px-4 py-3 border-b bg-white">
        <div className="text-base font-semibold text-slate-900">Stratify</div>
        {subtitle ? (
          <div className="text-sm text-slate-500">{subtitle}</div>
        ) : null}
      </div>

      <div className="p-4 space-y-4">
        {sections.map((sec, si) => (
          <div
            key={`${sec.title}-${si}`}
            className="rounded-xl border bg-white overflow-hidden"
          >
            {/* Section Title */}
            <div className="px-4 py-3 border-b bg-slate-900">
              <div className="text-xs tracking-widest font-semibold text-white text-center">
                {sec.title}
              </div>
            </div>

            <div className="divide-y">
              {sec.rows.map((row, ri) => {
                const indicatorCode = row.indicatorCode ?? null;
                const canExpand = !!indicatorCode;
                const key = `${si}:${ri}`;
                const isOpen = openKey === key;
                const isLoading =
                  canExpand && loadingIndicator === indicatorCode;
                const ranked = canExpand ? cache[indicatorCode!] ?? [] : [];

                // ✅ Unique key fix (no duplicates even if labels repeat)
                const rowKey = `${si}:${ri}:${indicatorCode ?? "x"}:${
                  row.label
                }`;

                return (
                  <div key={rowKey}>
                    {/* Row */}
                    <div className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {row.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.meta ?? ""}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {row.value}
                      </div>

                      {/* "+" icon only for WDI rows */}
                      {canExpand ? (
                        <button
                          onClick={() => toggleRow(si, ri, indicatorCode!)}
                          className={[
                            "ml-2 h-8 w-8 rounded-full border grid place-items-center flex-shrink-0",
                            isOpen
                              ? "bg-red-100 border-red-300 text-red-700 hover:bg-red-200"
                              : "bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200",
                          ].join(" ")}
                          title={isOpen ? "Collapse" : "Expand"}
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                        </button>
                      ) : null}
                    </div>

                    {/* Expanded: country list */}
                    {canExpand && isOpen ? (
                      <div className="px-4 pb-4">
                        <div className="rounded-xl border border-slate-300 overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-900 to-blue-600 text-white px-4 py-3">
                            <div className="text-sm font-semibold">
                              Countries (Descending)
                            </div>
                            <div className="text-xs opacity-90">
                              Latest available year per country
                            </div>
                          </div>

                          <div className="max-h-[280px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-blue-100 border-b border-blue-200">
                                <tr className="text-slate-800">
                                  <th className="px-4 py-2 text-left w-16">
                                    Rank
                                  </th>
                                  <th className="px-4 py-2 text-left">
                                    Country
                                  </th>
                                  <th className="px-4 py-2 text-right w-32">
                                    Value
                                  </th>
                                  <th className="px-4 py-2 text-right w-20">
                                    Year
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {isLoading ? (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      className="px-4 py-10 text-center text-slate-600"
                                    >
                                      Loading…
                                    </td>
                                  </tr>
                                ) : ranked.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      className="px-4 py-10 text-center text-slate-600"
                                    >
                                      No data found.
                                    </td>
                                  </tr>
                                ) : (
                                  ranked.map((r, i) => (
                                    <tr
                                      key={`${r.country_code}-${r.year}-${i}`}
                                      className={[
                                        "border-b border-slate-200 last:border-b-0",
                                        i % 2 === 0
                                          ? "bg-slate-50"
                                          : "bg-indigo-50",
                                        "hover:bg-blue-200/60 transition",
                                      ].join(" ")}
                                    >
                                      <td className="px-4 py-2 text-slate-700">
                                        {i + 1}
                                      </td>
                                      <td className="px-4 py-2 font-medium text-slate-900">
                                        {r.country_name}
                                        {r.region ? (
                                          <span className="ml-2 text-xs text-slate-600">
                                            ({r.region})
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="px-4 py-2 text-right font-bold text-blue-700 tabular-nums">
                                        {formatSmart(r.value)}
                                      </td>
                                      <td className="px-4 py-2 text-right text-slate-700 tabular-nums">
                                        {r.year}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
