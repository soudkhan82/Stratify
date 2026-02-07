// ✅ DROP-IN (FIXED) — FaostatTab.tsx
// File: app/world/country/[iso3]/components/FaostatTab.tsx
//
// Fixes: "yearly trend not showing" after modification
// ✅ Normalizes API trend rows to numeric {year,value} (handles Year/Value keys + comma strings)
// ✅ Uses explicit chart heights to avoid 0-height ResponsiveContainer edge cases
// ✅ Keeps: no bottom 7 menu, no Area Code column, Main Menu button top-left

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

import {
  Download,
  Table2,
  PieChart as PieIcon,
  TrendingUp,
  Home,
} from "lucide-react";

/* =======================
   Types
======================= */

export type FaoModule =
  | ""
  | "overview"
  | "prod-insights"
  | "top-production"
  | "top-import"
  | "top-export"
  | "trade-import"
  | "trade-export";

export function isTopKind(
  m: FaoModule,
): m is "top-production" | "top-import" | "top-export" {
  return m === "top-production" || m === "top-import" || m === "top-export";
}

type AnyObj = Record<string, any>;

export type ProductionItem = {
  item: string;
  value: number;
  unit: string | null;
  share_pct: number | null;
};

export type ProductionTrendPoint = { year: number; value: number };

export type ProductionInsights = {
  ok: boolean;
  iso3: string;
  country: string;
  element: string;
  latest_year: number;
  total_latest: number | null;
  total_prev_year: number | null;
  yoy_pct: number | null;
  top1_share_pct: number | null;
  top5_share_pct: number | null;
  items: ProductionItem[];
  trend: ProductionTrendPoint[];
  error?: string;
};

type Props = {
  iso3: string;

  faoModule: FaoModule;
  onPickModule: (m: FaoModule) => void | Promise<void>;

  loading: boolean;

  overview: any | null;
  top: any | null;
  trade: any | null;

  tradeTopN: number;
  tradeYears: number;
  setTradeTopN: (n: number) => void;
  setTradeYears: (n: number) => void;

  prod?: ProductionInsights | null;

  prodTopN?: number;
  prodYears?: number;
  prodElement?: string;
  setProdTopN?: (n: number) => void;
  setProdYears?: (n: number) => void;
  setProdElement?: (s: string) => void;
};

/* =======================
   Helpers
======================= */

const MAIN_MENU_HREF = "/";

// ✅ Safe fetch helper: prevents "Unexpected token '<'" crash and shows actual response preview
async function fetchTrendJSON(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();

  let j: any = null;
  try {
    j = JSON.parse(txt);
  } catch {
    throw new Error(
      `Trend API did not return JSON.\nURL: ${url}\nHTTP: ${res.status} ${res.statusText}\nBody: ${txt.slice(
        0,
        220,
      )}`,
    );
  }

  if (!res.ok || !j?.ok) {
    throw new Error(
      j?.error ||
        `Trend API failed.\nURL: ${url}\nHTTP: ${res.status} ${res.statusText}\nBody: ${txt.slice(
          0,
          220,
        )}`,
    );
  }

  return j;
}

function safeStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

function numFromAny(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const s = String(v).trim();
  if (!s) return null;

  // remove commas and non-numeric (except . and -)
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fmt(v: any, digits = 2) {
  const n = numFromAny(v);
  if (n === null) return safeStr(v);
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function fmtCompact(v: any) {
  const n = numFromAny(v);
  if (n === null) return safeStr(v);

  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;

  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function toCsv(rows: AnyObj[], columns: string[]) {
  const esc = (x: any) => {
    const s = String(x ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = columns.map(esc).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(r?.[c])).join(","))
    .join("\n");
  return `${head}\n${body}\n`;
}

function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pickRows(payload: any): AnyObj[] {
  if (!payload) return [];
  const candidates = [
    payload.rows,
    payload.data,
    payload.items,
    payload.result,
    payload.series,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c as AnyObj[];
  for (const k of Object.keys(payload))
    if (Array.isArray((payload as any)[k]))
      return (payload as any)[k] as AnyObj[];
  return [];
}

function inferColumns(rows: AnyObj[], omit?: string[]) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0] || {});
  const valueish = new Set([
    "value",
    "Value",
    "amount",
    "Amount",
    "qty",
    "Qty",
    "quantity",
    "Quantity",
    "share_pct",
    "share",
  ]);

  const omitSet = new Set((omit || []).map((s) => s.toLowerCase()));
  const filtered = keys.filter((k) => !omitSet.has(k.toLowerCase()));

  return [
    ...filtered.filter((k) => !valueish.has(k)),
    ...filtered.filter((k) => valueish.has(k)),
  ];
}

/* ---- Row helpers ---- */
function getItemCodeFromRow(r: AnyObj): number | null {
  const candidates = [
    "Item Code",
    "item_code",
    "itemCode",
    "itemcode",
    "item_code_fao",
  ];
  for (const k of candidates) {
    const n = numFromAny(r?.[k]);
    if (n !== null && n > 0) return n;
  }
  return null;
}

function getAreaCodeFromRow(r: AnyObj): number | null {
  const candidates = ["Area Code", "area_code", "AreaCode", "areacode"];
  for (const k of candidates) {
    const n = numFromAny(r?.[k]);
    if (n !== null && n > 0) return n;
  }
  return null;
}

function getItemNameFromRow(r: AnyObj): string {
  return safeStr(r?.item ?? r?.Item ?? r?.product ?? r?.Product ?? r?.name);
}

function getUnitFromRow(r: AnyObj): string {
  return safeStr(r?.unit ?? r?.Unit ?? "");
}

/* ✅ Normalize trend rows for Recharts (prevents blank chart) */
function normalizeTrendRows(rows: AnyObj[]): ProductionTrendPoint[] {
  const out: ProductionTrendPoint[] = [];

  for (const r of rows || []) {
    const y =
      numFromAny(r?.year) ??
      numFromAny(r?.Year) ??
      numFromAny(r?.report_year) ??
      numFromAny(r?.REPORT_YEAR);

    const v =
      numFromAny(r?.value) ??
      numFromAny(r?.Value) ??
      numFromAny(r?.amount) ??
      numFromAny(r?.Amount);

    if (y === null || v === null) continue;
    out.push({ year: y, value: v });
  }

  // sort ascending by year
  out.sort((a, b) => a.year - b.year);
  return out;
}

function inferProdUnit(prod: ProductionInsights | null | undefined) {
  const units = (prod?.items || [])
    .map((x) => String(x.unit ?? "").trim())
    .filter(Boolean);

  if (!units.length) return "—";

  const unique = Array.from(new Set(units));
  return unique.length === 1 ? unique[0] : "Mixed";
}

/* ---- Table ---- */
function SimpleTable({
  rows,
  maxRows = 30,
  onRowClick,
  activeKey,
  rowKeyFn,
  omitColumns,
}: {
  rows: AnyObj[];
  maxRows?: number;
  onRowClick?: (row: AnyObj) => void;
  activeKey?: string | number | null;
  rowKeyFn?: (row: AnyObj, idx: number) => string | number;
  omitColumns?: string[];
}) {
  const cols = useMemo(
    () => inferColumns(rows, omitColumns),
    [rows, omitColumns],
  );
  const view = rows.slice(0, maxRows);

  if (!rows.length) {
    return (
      <div className="rounded-md border bg-white p-4 text-sm text-slate-600">
        No rows returned for this module.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {view.map((r, idx) => {
              const key = rowKeyFn ? rowKeyFn(r, idx) : idx;
              const isActive = activeKey != null && key === activeKey;

              return (
                <tr
                  key={String(key)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={[
                    "border-t",
                    onRowClick ? "cursor-pointer hover:bg-slate-50" : "",
                    isActive ? "bg-indigo-50" : "",
                  ].join(" ")}
                  title={onRowClick ? "Click to view yearly trend" : undefined}
                >
                  {cols.map((c) => (
                    <td
                      key={c}
                      className="whitespace-nowrap px-3 py-2 text-slate-800"
                    >
                      {typeof r?.[c] === "number"
                        ? fmt(r?.[c], 2)
                        : safeStr(r?.[c])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > maxRows ? (
        <div className="border-t bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Showing {maxRows} of {rows.length} rows.
        </div>
      ) : null}
    </div>
  );
}

/* =======================
   Overview renderer (unchanged)
======================= */

function OverviewGrid({ data }: { data: AnyObj }) {
  const d = data || {};

  const unitFor = (k: string) => {
    const direct = d?.[k.replace(/_qty$/i, "_unit")] ?? null;
    if (direct != null) return safeStr(direct);

    if (/production_qty/i.test(k)) return safeStr(d?.production_unit);
    if (/import_qty/i.test(k)) return safeStr(d?.import_unit);
    if (/export_qty/i.test(k)) return safeStr(d?.export_unit);

    return "";
  };

  const leftCards: { k: string; v: any; unit?: string }[] = [
    { k: "COUNTRY", v: d.country ?? d.COUNTRY },
    {
      k: "PRODUCTION_QTY",
      v: d.production_qty ?? d.PRODUCTION_QTY,
      unit: unitFor("production_qty"),
    },
    {
      k: "IMPORT_QTY",
      v: d.import_qty ?? d.IMPORT_QTY,
      unit: unitFor("import_qty"),
    },
    {
      k: "EXPORT_QTY",
      v: d.export_qty ?? d.EXPORT_QTY,
      unit: unitFor("export_qty"),
    },
    {
      k: "KCAL_PER_CAPITA_DAY",
      v: d.kcal_per_capita_day ?? d.KCAL_PER_CAPITA_DAY,
    },
    {
      k: "FAT_G_PER_CAPITA_DAY",
      v: d.fat_g_per_capita_day ?? d.FAT_G_PER_CAPITA_DAY,
    },
  ];

  const rightCards: { k: string; v: any; unit?: string }[] = [
    { k: "ISO3", v: d.iso3 ?? d.ISO3 },
    { k: "LATEST_YEAR", v: d.latest_year ?? d.LATEST_YEAR },
    {
      k: "PROTEIN_G_PER_CAPITA_DAY",
      v: d.protein_g_per_capita_day ?? d.PROTEIN_G_PER_CAPITA_DAY,
    },
  ];

  const hasAny =
    leftCards.some((x) => x.v != null && String(x.v).trim() !== "") ||
    rightCards.some((x) => x.v != null && String(x.v).trim() !== "");

  if (!hasAny) {
    return (
      <div className="rounded-md border bg-white p-4 text-sm text-slate-600">
        Overview returned no fields.
      </div>
    );
  }

  const CardItem = ({
    label,
    value,
    unit,
  }: {
    label: string;
    value: any;
    unit?: string;
  }) => (
    <div className="rounded-2xl border bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </div>
        {unit ? (
          <div className="inline-flex h-6 min-w-[44px] items-center justify-center rounded-full border bg-slate-50 px-2 text-[11px] font-semibold text-slate-700">
            {unit}
          </div>
        ) : null}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-900">
        {typeof value === "number" ? fmt(value, 2) : safeStr(value)}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        {leftCards.map((x) => (
          <CardItem key={x.k} label={x.k} value={x.v} unit={x.unit} />
        ))}
      </div>
      <div className="space-y-4">
        {rightCards.map((x) => (
          <CardItem key={x.k} label={x.k} value={x.v} unit={x.unit} />
        ))}
      </div>
    </div>
  );
}

/* =======================
   Production Insights renderer (unchanged)
======================= */

function ProductionInsightsView({ prod }: { prod: ProductionInsights | null }) {
  if (!prod) {
    return (
      <div className="rounded-md border bg-white p-4 text-sm text-slate-600">
        No production insights loaded.
      </div>
    );
  }

  if (prod.ok === false) {
    return (
      <div className="rounded-md border bg-rose-50 p-4 text-sm text-rose-700">
        {prod.error || "No production insights found."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-slate-500">Latest Year</div>
          <div className="text-lg font-semibold">{prod.latest_year}</div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-slate-500">Total Latest</div>
          <div className="text-lg font-semibold">
            {prod.total_latest === null ? "—" : fmtCompact(prod.total_latest)}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-slate-500">YoY %</div>
          <div
            className={[
              "text-lg font-semibold",
              (prod.yoy_pct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600",
            ].join(" ")}
          >
            {prod.yoy_pct === null ? "—" : `${fmt(prod.yoy_pct, 2)}%`}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-slate-500">Top-5 Share</div>
          <div className="text-lg font-semibold">
            {prod.top5_share_pct === null
              ? "—"
              : `${fmt(prod.top5_share_pct, 2)}%`}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-800">
          Trend (yearly total)
        </div>

        {prod.trend?.length ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={prod.trend}
                margin={{ top: 6, right: 10, left: 18, bottom: 2 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  width={74}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => fmtCompact(v)}
                />
                <Tooltip formatter={(v: any) => fmt(Number(v), 2)} />
                <Line
                  type="monotone"
                  dataKey="value"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
            No trend rows returned.
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-800">
          Top Items (latest year)
        </div>
        <SimpleTable rows={prod.items as any[]} maxRows={15} />
      </div>
    </div>
  );
}

/* =======================
   Component
======================= */

export default function FaostatTab(p: Props) {
  const {
    iso3,
    faoModule,
    onPickModule,
    loading,
    overview,
    top,
    trade,
    tradeTopN,
    tradeYears,
    setTradeTopN,
    setTradeYears,

    prod = null,
    prodTopN = 10,
    prodYears = 10,
    prodElement = "Production",
    setProdTopN,
    setProdYears,
    setProdElement,
  } = p;

  const hasProdWiring = Boolean(setProdTopN && setProdYears && setProdElement);

  const didAuto = useRef(false);
  useEffect(() => {
    if (didAuto.current) return;
    if (faoModule !== "") return;
    didAuto.current = true;
    void Promise.resolve(onPickModule("overview"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faoModule]);

  const moduleLabel: Record<FaoModule, string> = {
    "": "Choose a module",
    overview: "Overview",
    "prod-insights": "Production Insights (Year-wise)",
    "top-production": "Top Production",
    "top-import": "Top Import",
    "top-export": "Top Export",
    "trade-import": "Trade Insights (Import)",
    "trade-export": "Trade Insights (Export)",
  };

  const prodUnit = useMemo(() => inferProdUnit(prod), [prod]);

  const activePayload = useMemo(() => {
    if (faoModule === "overview") return overview;
    if (faoModule === "prod-insights") return prod;
    if (faoModule === "trade-import" || faoModule === "trade-export")
      return trade;
    if (isTopKind(faoModule)) return top;
    return null;
  }, [faoModule, overview, prod, trade, top]);

  const rows = useMemo(() => pickRows(activePayload), [activePayload]);
  const cols = useMemo(() => inferColumns(rows), [rows]);

  const canDownload =
    (faoModule === "overview" && overview && typeof overview === "object") ||
    (faoModule === "prod-insights" && prod && typeof prod === "object") ||
    (rows.length > 0 && cols.length > 0);

  // ✅ Trend (Top modules)
  const [selectedTopRow, setSelectedTopRow] = useState<AnyObj | null>(null);
  const [selectedTopKey, setSelectedTopKey] = useState<string | number | null>(
    null,
  );
  const [topTrend, setTopTrend] = useState<ProductionTrendPoint[]>([]);
  const [topTrendLoading, setTopTrendLoading] = useState(false);
  const [topTrendErr, setTopTrendErr] = useState<string | null>(null);

  const topMetaAreaCode = useMemo(() => {
    const v = (top as any)?.meta?.area_code;
    const n = numFromAny(v);
    return n !== null && n > 0 ? n : null;
  }, [top]);

  function datasetAndElementForTop(mod: FaoModule) {
    if (mod === "top-production") {
      return {
        dataset: "production" as const,
        element: prodElement || "Production",
      };
    }
    if (mod === "top-import") {
      return { dataset: "sua" as const, element: "Import quantity" };
    }
    if (mod === "top-export") {
      return { dataset: "sua" as const, element: "Export quantity" };
    }
    return {
      dataset: "production" as const,
      element: prodElement || "Production",
    };
  }

  async function loadTrendForTopRow(row: AnyObj) {
    const itemCode = getItemCodeFromRow(row);
    const areaCode = getAreaCodeFromRow(row) ?? topMetaAreaCode;

    setSelectedTopRow(row);
    setTopTrend([]);
    setTopTrendErr(null);

    if (!itemCode) {
      setTopTrendErr("Item Code not found in this row (required for trend).");
      return;
    }
    if (!areaCode) {
      setTopTrendErr(
        "Area Code not found (required for trend). Add 'Area Code' in top rows or return meta.area_code.",
      );
      return;
    }

    const { dataset, element } = datasetAndElementForTop(faoModule);

    setTopTrendLoading(true);
    try {
      const years = String(Math.min(Math.max(prodYears || 10, 1), 60));
      const qs = new URLSearchParams({
        dataset,
        element,
        area_code: String(areaCode),
        item_code: String(itemCode),
        years,
      });

      const url = `/api/faostat/trend?${qs.toString()}`;
      const j = await fetchTrendJSON(url);

      const rawRows = Array.isArray(j?.rows) ? (j.rows as AnyObj[]) : [];
      const normalized = normalizeTrendRows(rawRows);

      if (!normalized.length) {
        setTopTrendErr(
          "Trend returned rows but could not normalize year/value (check API keys Year/Value or numeric formatting).",
        );
        return;
      }

      setTopTrend(normalized);
    } catch (e: any) {
      console.error("Trend fetch error:", e);
      setTopTrendErr(e?.message || "Trend fetch failed");
    } finally {
      setTopTrendLoading(false);
    }
  }

  useEffect(() => {
    setSelectedTopRow(null);
    setSelectedTopKey(null);
    setTopTrend([]);
    setTopTrendErr(null);
    setTopTrendLoading(false);
  }, [faoModule]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={MAIN_MENU_HREF} aria-label="Main menu">
                    <Home className="mr-2 h-4 w-4" />
                    Main Menu
                  </Link>
                </Button>

                <div className="space-y-0.5">
                  <CardTitle className="text-base">
                    FAOSTAT • {moduleLabel[faoModule || "overview"]}{" "}
                    <span className="text-slate-500">({iso3})</span>
                  </CardTitle>

                  <div className="flex flex-wrap items-center gap-2">
                    {loading ? (
                      <Badge className="bg-slate-900 text-white">
                        Loading…
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Ready</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                <Button
                  variant="default"
                  size="sm"
                  disabled={!canDownload}
                  onClick={() => {
                    if (faoModule === "overview") {
                      downloadText(
                        `faostat-${iso3}-overview.json`,
                        JSON.stringify(overview ?? {}, null, 2),
                        "application/json",
                      );
                      return;
                    }
                    if (faoModule === "prod-insights") {
                      downloadText(
                        `faostat-${iso3}-production-insights.json`,
                        JSON.stringify(prod ?? {}, null, 2),
                        "application/json",
                      );
                      return;
                    }
                    const csv = toCsv(rows, cols);
                    downloadText(
                      `faostat-${iso3}-${faoModule || "module"}.csv`,
                      csv,
                      "text/csv",
                    );
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPickModule("overview")}
                disabled={loading}
              >
                <PieIcon className="mr-2 h-4 w-4" />
                Overview
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPickModule("prod-insights")}
                disabled={loading || !hasProdWiring}
                title={
                  !hasProdWiring
                    ? "Wire prod props in page.tsx to enable"
                    : undefined
                }
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Prod Insights
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPickModule("top-production")}
                disabled={loading}
              >
                <Table2 className="mr-2 h-4 w-4" />
                Top Prod
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPickModule("top-import")}
                disabled={loading}
              >
                <Table2 className="mr-2 h-4 w-4" />
                Top Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPickModule("top-export")}
                disabled={loading}
              >
                <Table2 className="mr-2 h-4 w-4" />
                Top Export
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPickModule("trade-import")}
                disabled={loading}
              >
                <Table2 className="mr-2 h-4 w-4" />
                Trade Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPickModule("trade-export")}
                disabled={loading}
              >
                <Table2 className="mr-2 h-4 w-4" />
                Trade Export
              </Button>
            </div>
          </div>
        </CardHeader>

        {faoModule === "prod-insights" && hasProdWiring ? (
          <CardContent className="pt-0">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                Year-wise totals + YoY + concentration + top items.
                {prodUnit !== "—" ? (
                  <span className="ml-2 text-xs text-slate-500">
                    Unit: {prodUnit}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <span className="text-slate-600">Element</span>
                  <select
                    className="bg-transparent text-slate-900 outline-none"
                    value={prodElement}
                    onChange={(e) => setProdElement!(e.target.value)}
                  >
                    {["Production", "Area harvested", "Yield"].map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <span className="text-slate-600">Top N</span>
                  <select
                    className="bg-transparent text-slate-900 outline-none"
                    value={prodTopN}
                    onChange={(e) => setProdTopN!(Number(e.target.value))}
                  >
                    {[5, 10, 15, 20, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <span className="text-slate-600">Years</span>
                  <select
                    className="bg-transparent text-slate-900 outline-none"
                    value={prodYears}
                    onChange={(e) => setProdYears!(Number(e.target.value))}
                  >
                    {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => onPickModule("prod-insights")}
                >
                  Reload
                </Button>
              </div>
            </div>
          </CardContent>
        ) : null}

        {(faoModule === "trade-import" || faoModule === "trade-export") && (
          <CardContent className="pt-0">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                Adjust trade insight parameters (auto-reloads via your page.tsx
                effect).
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <span className="text-slate-600">Top N</span>
                  <select
                    className="bg-transparent text-slate-900 outline-none"
                    value={tradeTopN}
                    onChange={(e) => setTradeTopN(Number(e.target.value))}
                  >
                    {[5, 10, 15, 20, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <span className="text-slate-600">Years</span>
                  <select
                    className="bg-transparent text-slate-900 outline-none"
                    value={tradeYears}
                    onChange={(e) => setTradeYears(Number(e.target.value))}
                  >
                    {[5, 10, 15, 20, 25, 30].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => onPickModule(faoModule)}
                >
                  Reload
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {faoModule === "" || faoModule === "overview" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-800">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview && typeof overview === "object" ? (
              <OverviewGrid data={overview as AnyObj} />
            ) : (
              <div className="rounded-md border bg-white p-4 text-sm text-slate-600">
                No overview data returned.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {faoModule === "prod-insights" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-800">
              Production Insights{" "}
              {prodUnit !== "—" ? (
                <span className="ml-2 text-xs text-slate-500">
                  Unit: {prodUnit}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProductionInsightsView prod={prod ?? null} />
          </CardContent>
        </Card>
      ) : null}

      {faoModule !== "" &&
      faoModule !== "overview" &&
      faoModule !== "prod-insights" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-800">
              Data Preview{" "}
              <span className="text-slate-500">({moduleLabel[faoModule]})</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {isTopKind(faoModule) ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs text-slate-600">
                    Click a row to view yearly trend.
                  </div>

                  <SimpleTable
                    rows={rows}
                    maxRows={30}
                    omitColumns={[
                      "Area Code",
                      "area_code",
                      "AreaCode",
                      "areacode",
                    ]}
                    onRowClick={(r) => {
                      const ic = getItemCodeFromRow(r);
                      const ac =
                        getAreaCodeFromRow(r) ?? topMetaAreaCode ?? "na";
                      const key = `${ic ?? "noitem"}-${ac}`;
                      setSelectedTopKey(key);
                      loadTrendForTopRow(r);
                    }}
                    rowKeyFn={(r) => {
                      const ic = getItemCodeFromRow(r);
                      const ac =
                        getAreaCodeFromRow(r) ?? topMetaAreaCode ?? "na";
                      return `${ic ?? "noitem"}-${ac}`;
                    }}
                    activeKey={selectedTopKey}
                  />
                </div>

                <div className="rounded-lg border bg-white p-3">
                  <div className="mb-2 text-sm font-semibold text-slate-800">
                    Trend (yearly)
                  </div>

                  {!selectedTopRow ? (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                      Select a row from the table.
                    </div>
                  ) : topTrendLoading ? (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                      Loading trend…
                    </div>
                  ) : topTrendErr ? (
                    <div className="rounded-md border bg-rose-50 p-3 text-sm text-rose-700">
                      {topTrendErr}
                    </div>
                  ) : topTrend.length === 0 ? (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                      No trend rows returned.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs text-slate-600">
                          {getItemNameFromRow(selectedTopRow)}
                        </div>
                        <div className="rounded-md border bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                          {getUnitFromRow(selectedTopRow)}
                        </div>
                      </div>

                      {/* ✅ Explicit heights (avoid blank chart) */}
                      <div style={{ height: 190, width: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={topTrend}
                            margin={{ top: 6, right: 10, left: 18, bottom: 2 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                            <YAxis
                              width={74}
                              tick={{ fontSize: 12 }}
                              tickFormatter={(v) => fmtCompact(v)}
                            />
                            <Tooltip formatter={(v: any) => fmt(v, 2)} />
                            <Line
                              type="monotone"
                              dataKey="value"
                              dot={false}
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div style={{ height: 190, width: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={topTrend}
                            margin={{ top: 6, right: 10, left: 18, bottom: 2 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                            <YAxis
                              width={74}
                              tick={{ fontSize: 12 }}
                              tickFormatter={(v) => fmtCompact(v)}
                            />
                            <Tooltip formatter={(v: any) => fmt(v, 2)} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-md border bg-white p-4 text-sm text-slate-600">
                This view supports trend only for top modules.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
