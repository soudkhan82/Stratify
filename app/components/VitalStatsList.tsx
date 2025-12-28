"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Minus } from "lucide-react";
import {
  fetchWdiMetricRanking,
  type WdiRankingRow,
} from "@/app/lib/rpc/wdiRanking";

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
  region?: string | null;
};

function formatSmart(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  if (abs >= 10) return v.toFixed(2);
  return v.toFixed(4);
}

export default function VitalStatsList({ sections, subtitle, region }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  // cache by (indicatorCode + region) to avoid showing wrong region values
  const [cache, setCache] = useState<Record<string, WdiRankingRow[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const regionKey = region?.trim() ? region.trim() : "ALL";

  // collapse expanded row when region changes (or when sections rebuild)
  useEffect(() => {
    setOpenKey(null);
  }, [regionKey, sections]);

  async function toggleRow(
    sectionIdx: number,
    rowIdx: number,
    indicatorCode: string
  ) {
    const uiKey = `${sectionIdx}:${rowIdx}`;
    const next = openKey === uiKey ? null : uiKey;
    setOpenKey(next);

    const cacheKey = `${indicatorCode}__${regionKey}`;
    if (next && !cache[cacheKey]) {
      setLoadingKey(cacheKey);
      try {
        const rows = await fetchWdiMetricRanking(
          indicatorCode,
          200,
          region?.trim() || null
        );
        setCache((p) => ({ ...p, [cacheKey]: rows }));
      } finally {
        setLoadingKey(null);
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
            <div className="px-4 py-3 border-b bg-slate-900">
              <div className="text-xs tracking-widest font-semibold text-white text-center">
                {sec.title}
              </div>
            </div>

            <div className="divide-y">
              {sec.rows.map((row, ri) => {
                const indicatorCode = row.indicatorCode ?? null;
                const canExpand = !!indicatorCode;
                const uiKey = `${si}:${ri}`;
                const isOpen = openKey === uiKey;

                const cacheKey = indicatorCode
                  ? `${indicatorCode}__${regionKey}`
                  : "";
                const ranked = canExpand ? cache[cacheKey] ?? [] : [];
                const isLoading = canExpand && loadingKey === cacheKey;

                // ✅ unique row key (prevents duplicate keys even if labels repeat)
                const rowKey = `${si}:${ri}:${indicatorCode ?? "x"}:${
                  row.label
                }`;

                return (
                  <div key={rowKey}>
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

                      {canExpand ? (
                        <button
                          onClick={() => toggleRow(si, ri, indicatorCode!)}
                          className={[
                            "ml-2 p-1 flex-shrink-0",
                            "text-slate-500 hover:text-slate-900",
                          ].join(" ")}
                          title={isOpen ? "Collapse" : "Expand"}
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                        </button>
                      ) : null}
                    </div>

                    {canExpand && isOpen ? (
                      <div className="px-4 pb-4">
                        <div className="rounded-xl border border-slate-300 overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-900 to-blue-600 text-white px-4 py-3">
                            <div className="text-sm font-semibold">
                              Countries (Descending)
                              {regionKey !== "ALL" ? `) • ${regionKey}` : ")"}
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
