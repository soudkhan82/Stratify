// app/faoproducts/page.tsx
"use client";
import Link from "next/link";
import { Home } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, TrendingUp, Download, FilterX } from "lucide-react";

/* =========================
   Types
========================= */

type Dataset = "production" | "sua";

type ElementsMeta = {
  dataset: Dataset;
  min_year: number;
  max_year: number;
  elements: string[];
};

const DEBUG = false;
const TREND_YEARS = 5;

type ProductRow = {
  dataset: Dataset;
  item_code: string;
  item: string;
  unit: string | null;
  value: number | string | null;
};

type TrendPoint = { year: number; value: number | string };

type AreaOpt = {
  area: string;
  area_code: string;
};

/* =========================
   Helpers
========================= */

function toNum(v: any) {
  const x =
    typeof v === "number"
      ? v
      : Number(
          String(v ?? "")
            .replace(/,/g, "")
            .trim(),
        );
  return Number.isFinite(x) ? x : 0;
}

function fmt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function toCsv(rows: any[], cols: string[]) {
  const esc = (x: any) => {
    const s = String(x ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    cols.map(esc).join(","),
    ...rows.map((r) => cols.map((c) => esc(r?.[c])).join(",")),
  ].join("\n");
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

/* =========================
   Page
========================= */

export default function FaostatProductsPage() {
  const [dataset, setDataset] = useState<Dataset>("production");

  // meta
  const [meta, setMeta] = useState<ElementsMeta | null>(null);

  const [element, setElement] = useState<string>("");
  const [year, setYear] = useState<number>(0);

  // Area dropdown (search + pick)
  const [areaQ, setAreaQ] = useState<string>("");
  const [areaOptions, setAreaOptions] = useState<AreaOpt[]>([]);
  const [areaName, setAreaName] = useState<string>("");
  const [areaCode, setAreaCode] = useState<string>("");
  const [areaOpen, setAreaOpen] = useState(false);

  // products
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [productQ, setProductQ] = useState<string>("");

  // paging
  const [limit, setLimit] = useState<number>(100);
  const [offset, setOffset] = useState<number>(0);

  // chart
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [view, setView] = useState<"line" | "bar">("line");

  // errors
  const [productsError, setProductsError] = useState<string>("");
  const [trendError, setTrendError] = useState<string>("");

  const areaBoxRef = useRef<HTMLDivElement | null>(null);

  const unitLabel = selected?.unit || "Value";

  // ✅ stable key for selection + fetch dependency
  const selectedKey = useMemo(() => {
    return selected ? `${selected.dataset}:${selected.item_code}` : "";
  }, [selected]);

  const datasetLabel =
    dataset === "production"
      ? "FAOSTAT • Production"
      : "FAOSTAT • SUA (Supply Utilization Accounts)";

  const title = useMemo(() => {
    const el = element || "—";
    const y = year ? String(year) : "—";
    return `Products • ${el} • ${y}`;
  }, [element, year]);

  // close area dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!areaBoxRef.current) return;
      if (!areaBoxRef.current.contains(e.target as any)) setAreaOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /* ---- Load Elements meta ---- */
  useEffect(() => {
    let dead = false;

    (async () => {
      setMeta(null);
      setElement("");
      setYear(0);

      // reset on dataset change
      setProducts([]);
      setSelected(null);
      setTrend([]);
      setOffset(0);
      setProductsError("");
      setTrendError("");

      setAreaQ("");
      setAreaOptions([]);
      setAreaName("");
      setAreaCode("");
      setAreaOpen(false);

      const res = await fetch(
        `/api/faostat/items/elements?dataset=${dataset}`,
        {
          cache: "no-store",
        },
      );
      const j = await res.json().catch(() => null);
      if (dead) return;

      if (!j?.ok || !j?.meta) return;

      const m: ElementsMeta = j.meta;
      setMeta(m);

      const firstEl = String(m.elements?.[0] ?? "");
      setElement(firstEl);

      // ✅ default latest year
      setYear(Number(m.max_year ?? 0));
    })();

    return () => {
      dead = true;
    };
  }, [dataset]);

  /* ---- Load initial areas list (so dropdown works without typing) ---- */
  useEffect(() => {
    let dead = false;
    const ctrl = new AbortController();

    (async () => {
      const url = `/api/faostat/areas/search?dataset=${encodeURIComponent(
        dataset,
      )}&q=&lim=200`;

      if (DEBUG) console.log("[AREAS:init] url:", url);

      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      const j = await res.json().catch(() => null);
      if (dead) return;

      const rows: AreaOpt[] = Array.isArray(j?.rows)
        ? j.rows
        : Array.isArray(j)
          ? j
          : [];

      setAreaOptions(rows);
    })().catch((e) => {
      if (e?.name === "AbortError") return;
      if (DEBUG) console.log("[AREAS:init] error:", e);
    });

    return () => {
      dead = true;
      ctrl.abort();
    };
  }, [dataset]);

  /* ---- Area suggestions (when typing) ---- */
  useEffect(() => {
    const q = areaQ.trim();

    // If blank, do NOT clear options (keep initial list)
    if (!q) return;

    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/faostat/areas/search?q=${encodeURIComponent(q)}&dataset=${dataset}&lim=50`,
        { cache: "no-store" },
      );
      const j = await res.json().catch(() => null);

      const rows: AreaOpt[] = Array.isArray(j?.rows)
        ? j.rows
        : Array.isArray(j)
          ? j
          : [];

      setAreaOptions(rows);
      setAreaOpen(true);
    }, 200);

    return () => clearTimeout(t);
  }, [areaQ, dataset]);

  const isSliceReady = useMemo(() => {
    const ac = areaCode.trim();
    return (
      !!element &&
      !!year &&
      !!ac &&
      (dataset === "production" || dataset === "sua") &&
      /^[0-9]+$/.test(ac)
    );
  }, [dataset, element, year, areaCode]);

  /* ---- Load Products ---- */
  useEffect(() => {
    if (!isSliceReady) {
      setProducts([]);
      setSelected(null);
      setTrend([]);
      setProductsError("");
      return;
    }

    let dead = false;
    const ctrl = new AbortController();

    (async () => {
      setProductsError("");
      setProducts([]);
      setSelected(null);
      setTrend([]);
      setTrendError("");

      const url =
        `/api/faostat/items/products?dataset=${dataset}` +
        `&element=${encodeURIComponent(element)}` +
        `&year=${year}` +
        `&area_code=${encodeURIComponent(areaCode.trim())}` +
        `&limit=${limit}&offset=${offset}`;

      if (DEBUG) console.log("[PRODUCTS] url:", url);

      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      const j = await res.json().catch(() => null);
      if (dead) return;

      const rows: ProductRow[] =
        j?.ok && Array.isArray(j?.rows) ? j.rows : Array.isArray(j) ? j : [];

      if (!rows.length) {
        const errMsg =
          (j && typeof j === "object" && "error" in j && (j as any).error) ||
          "";
        setProductsError(errMsg || "No products returned for this slice.");
        setProducts([]);
        return;
      }

      setProducts(rows);
      setSelected(rows[0]);
    })().catch((e: any) => {
      if (e?.name === "AbortError") return;
      setProductsError(e?.message || "Products request failed.");
    });

    return () => {
      dead = true;
      ctrl.abort();
    };
  }, [isSliceReady, dataset, element, year, areaCode, limit, offset]);

  /* ---- Load Trend (last 5 years ending at selected year) ---- */
  useEffect(() => {
    if (!selected || !element || !areaCode.trim() || !year) {
      setTrend([]);
      setTrendError("");
      setTrendLoading(false);
      return;
    }

    let dead = false;
    const ctrl = new AbortController();

    (async () => {
      setTrendLoading(true);
      setTrendError("");

      const urlEndYear =
        `/api/faostat/items/trend?dataset=${selected.dataset}` +
        `&item_code=${encodeURIComponent(selected.item_code)}` +
        `&element=${encodeURIComponent(element)}` +
        `&end_year=${year}` +
        `&area_code=${encodeURIComponent(areaCode.trim())}`;

      if (DEBUG) console.log("[TREND] url:", urlEndYear);

      const res = await fetch(urlEndYear, {
        cache: "no-store",
        signal: ctrl.signal,
      });

      let j: any = await res.json().catch(() => null);

      // ✅ fallback if backend not updated yet (old param years=5)
      if (!j?.ok) {
        const urlFallback =
          `/api/faostat/items/trend?dataset=${selected.dataset}` +
          `&item_code=${encodeURIComponent(selected.item_code)}` +
          `&element=${encodeURIComponent(element)}` +
          `&years=${TREND_YEARS}` +
          `&area_code=${encodeURIComponent(areaCode.trim())}`;

        if (DEBUG) console.log("[TREND] fallback url:", urlFallback);

        const res2 = await fetch(urlFallback, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        j = await res2.json().catch(() => null);
      }

      if (dead) return;

      const rows: any[] =
        j?.ok && Array.isArray(j?.rows) ? j.rows : Array.isArray(j) ? j : [];

      if (!rows.length) {
        const errMsg =
          (j && typeof j === "object" && "error" in j && (j as any).error) ||
          "";
        setTrendError(errMsg || "No trend data returned.");
        setTrend([]);
        return;
      }

      setTrend(rows as TrendPoint[]);
    })()
      .catch((e: any) => {
        if (e?.name === "AbortError") return;
        setTrendError(e?.message || "Trend request failed.");
        setTrend([]);
      })
      .finally(() => {
        if (!dead) setTrendLoading(false);
      });

    return () => {
      dead = true;
      ctrl.abort();
    };
  }, [selectedKey, element, year, areaCode]);

  /* ---- Client-side product search ---- */
  const filteredProducts = useMemo(() => {
    const q = productQ.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.item.toLowerCase().includes(q));
  }, [products, productQ]);

  // keep selection valid when filtering/paging changes
  useEffect(() => {
    if (!filteredProducts.length) return;
    if (!selected) {
      setSelected(filteredProducts[0]);
      return;
    }
    const stillThere = filteredProducts.some(
      (p) =>
        p.dataset === selected.dataset && p.item_code === selected.item_code,
    );
    if (!stillThere) setSelected(filteredProducts[0]);
  }, [filteredProducts, selected]);

  // Year dropdown: latest..latest-5
  const yearOptions = useMemo(() => {
    if (!meta?.max_year) return [];
    const maxY = meta.max_year;
    const minY = meta.min_year ?? 0;
    return Array.from({ length: 6 }, (_, i) => maxY - i).filter(
      (y) => y >= minY,
    );
  }, [meta]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
      {/* ✅ Strong pointer enforcement + nicer hover/selected */}
      <style jsx global>{`
        .products-scroll {
          scrollbar-gutter: stable;
          overscroll-behavior: contain;
          scrollbar-width: thin !important;
        }
        .products-scroll::-webkit-scrollbar {
          width: 10px !important;
        }
        .products-scroll::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.55) !important;
          border-radius: 9999px !important;
          border: 2px solid rgba(255, 255, 255, 0.85) !important;
        }
        .products-scroll::-webkit-scrollbar-track {
          background: rgba(148, 163, 184, 0.15) !important;
        }

        /* ✅ FORCE pointer even if table CSS overrides it */
        .row-click,
        .row-click * {
          cursor: pointer !important;
        }
      `}</style>

      {/* Header + Filters */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs tracking-widest text-slate-400">
                STRATIFY
              </div>
              <CardTitle className="mt-1 flex items-center gap-2 text-xl">
                <Globe className="h-5 w-5" />
                {title}
              </CardTitle>
              <div className="mt-1 text-sm text-slate-600">
                Select Area + Year (latest..latest-5), then explore products &{" "}
                5-year trend.
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge className="bg-indigo-600 text-white">
                  {datasetLabel}
                </Badge>
                {areaName && areaCode ? (
                  <Badge className="bg-emerald-600 text-white">
                    {areaName} • {areaCode}
                  </Badge>
                ) : null}
                {productsError ? (
                  <Badge className="bg-rose-600 text-white">
                    Products error
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Dataset */}
              <select
                className="rounded-xl border bg-white px-3 py-2 text-sm"
                value={dataset}
                onChange={(e) => {
                  setDataset(e.target.value as Dataset);
                  setAreaQ("");
                  setAreaOptions([]);
                  setAreaName("");
                  setAreaCode("");
                  setOffset(0);
                }}
              >
                <option value="production">
                  Production (FAOSTAT Production)
                </option>
                <option value="sua">SUA (Supply Utilization Accounts)</option>
              </select>

              {/* Element */}
              <select
                className="rounded-xl border bg-white px-3 py-2 text-sm min-w-[220px]"
                value={element}
                onChange={(e) => {
                  setOffset(0);
                  setElement(e.target.value);
                }}
                disabled={!meta?.elements?.length}
              >
                {(meta?.elements || []).map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>

              {/* Year (latest..latest-5) */}
              <select
                className="rounded-xl border bg-white px-3 py-2 text-sm"
                value={year || ""}
                onChange={(e) => {
                  setOffset(0);
                  setYear(Number(e.target.value));
                }}
                disabled={!yearOptions.length}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {/* Area search + pick (dropdown values) */}
              <div className="relative" ref={areaBoxRef}>
                <Input
                  value={areaQ}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAreaQ(v);
                    setAreaOpen(true);
                    setAreaName("");
                    setAreaCode("");
                    setOffset(0);
                  }}
                  onFocus={() => setAreaOpen(true)}
                  onClick={() => setAreaOpen(true)}
                  placeholder="Search area (e.g., Pakistan / Eastern Asia)…"
                  className="rounded-xl w-[260px]"
                />

                {areaOpen ? (
                  <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border bg-white shadow">
                    <div className="max-h-[280px] overflow-auto">
                      {areaOptions.length ? (
                        areaOptions.map((a) => (
                          <button
                            key={`${a.area_code}-${a.area}`}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setAreaName(a.area);
                              setAreaCode(String(a.area_code));
                              setAreaQ(a.area);
                              setAreaOpen(false);
                              setOffset(0);
                            }}
                          >
                            <div className="font-medium text-slate-900">
                              {a.area}
                            </div>
                            <div className="text-xs text-slate-500">
                              Area Code {a.area_code}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm text-slate-600">
                          No areas found.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Top N */}
              <select
                className="rounded-xl border bg-white px-3 py-2 text-sm"
                value={limit}
                onChange={(e) => {
                  setOffset(0);
                  setLimit(Number(e.target.value));
                }}
              >
                {[50, 100, 200, 300, 500].map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                className="rounded-xl"
                disabled={offset === 0 || !isSliceReady}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={!isSliceReady || products.length < limit}
                onClick={() => setOffset((o) => o + limit)}
              >
                Next
              </Button>
              <Link href="/" prefetch>
                <Button variant="outline" className="rounded-xl">
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Button>
              </Link>

              <Button
                variant="secondary"
                className="rounded-xl"
                onClick={() => {
                  setAreaQ("");
                  setAreaOptions([]);
                  setAreaName("");
                  setAreaCode("");
                  setProductQ("");
                  setOffset(0);
                  setProducts([]);
                  setSelected(null);
                  setTrend([]);
                  setProductsError("");
                  setTrendError("");
                }}
              >
                <FilterX className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Products */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">Products</CardTitle>
                <div className="w-[220px]">
                  <Input
                    value={productQ}
                    onChange={(e) => setProductQ(e.target.value)}
                    placeholder="Filter products…"
                    className="rounded-xl h-9"
                    disabled={!products.length}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {!isSliceReady ? (
                <div className="p-4 text-sm text-slate-600">
                  Select <b>Element</b>, <b>Year</b>, then <b>pick an Area</b>{" "}
                  to load products.
                </div>
              ) : productsError ? (
                <div className="p-4 text-sm text-rose-700">
                  <div className="font-semibold">Products API error</div>
                  <div className="mt-1">{productsError}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Tip: choose a valid FAOSTAT area from dropdown (with real{" "}
                    <b>Area Code</b>).
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-4 text-sm text-slate-600">
                  No products returned for this slice.
                </div>
              ) : (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead className="bg-white">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Product
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-700">
                          Value ({year})
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Unit
                        </th>
                      </tr>
                    </thead>
                  </table>

                  <div
                    className="products-scroll overflow-y-auto"
                    style={{ height: 12 * 64 }}
                  >
                    <table className="w-full text-sm">
                      <tbody>
                        {filteredProducts.map((p) => {
                          const active =
                            selected?.dataset === p.dataset &&
                            selected?.item_code === p.item_code;

                          return (
                            <tr
                              key={`${p.dataset}-${p.item_code}`}
                              role="button"
                              tabIndex={0}
                              className={[
                                "row-click select-none", // ✅ force pointer
                                "border-b transition-colors",
                                "hover:bg-indigo-50/70",
                                "active:bg-indigo-100",
                                active
                                  ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200"
                                  : "",
                              ].join(" ")}
                              style={{ cursor: "pointer" }} // ✅ inline hard-force
                              onClick={() => {
                                setSelected({ ...p });
                                setTrend([]);
                                setTrendError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelected({ ...p });
                                  setTrend([]);
                                  setTrendError("");
                                }
                              }}
                            >
                              <td className="px-3 py-2 align-top">
                                <div className="font-medium text-slate-900">
                                  {p.item}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Item Code {p.item_code}
                                </div>
                              </td>

                              <td className="px-3 py-2 text-right tabular-nums align-top">
                                {fmt(toNum(p.value))}
                              </td>

                              <td className="px-3 py-2 align-top">
                                {p.unit || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-3 border-t flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  size="sm"
                  disabled={!filteredProducts.length}
                  onClick={() => {
                    const csv = toCsv(filteredProducts, [
                      "dataset",
                      "item_code",
                      "item",
                      "unit",
                      "value",
                    ]);
                    downloadText(
                      `faostat-${dataset}-${element}-${year}-area_${areaCode}-products.csv`,
                      csv,
                      "text/csv",
                    );
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download table
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trend (last {TREND_YEARS} yrs): {selected?.item || "—"}{" "}
                  {selected?.unit ? `(${selected.unit})` : ""}
                </CardTitle>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="rounded-xl"
                    disabled={!trend.length}
                    onClick={() =>
                      setView((v) => (v === "line" ? "bar" : "line"))
                    }
                  >
                    {view === "line" ? "Bar view" : "Line view"}
                  </Button>
                  <Badge className="bg-slate-900 text-white">{unitLabel}</Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4" style={{ height: 520 }}>
              {!selected ? (
                <div className="h-full rounded-xl border bg-white flex items-center justify-center text-sm text-slate-600">
                  Select a product row to view trend.
                </div>
              ) : trendError ? (
                <div className="h-full rounded-xl border bg-white flex items-center justify-center text-sm text-rose-700">
                  {trendError}
                </div>
              ) : trendLoading ? (
                <div className="h-full rounded-xl border bg-white flex items-center justify-center text-sm text-slate-600">
                  Loading trend…
                </div>
              ) : !trend.length ? (
                <div className="h-full rounded-xl border bg-white flex items-center justify-center text-sm text-slate-600">
                  No trend data.
                </div>
              ) : (
                <div className="h-full rounded-xl border bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    {view === "line" ? (
                      <LineChart
                        data={trend.map((d) => ({
                          year: d.year,
                          value: toNum(d.value),
                        }))}
                        margin={{ top: 10, right: 14, bottom: 6, left: 34 }} // ✅ increase left
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis
                          tickFormatter={(v) => fmt(Number(v))}
                          width={72}
                        />
                        <Tooltip
                          formatter={(v: any) => [fmt(Number(v)), unitLabel]}
                          labelFormatter={(l) => `Year: ${l}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#6366f1"
                          strokeWidth={3}
                          dot={{ r: 2 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    ) : (
                      <BarChart
                        data={trend.map((d) => ({
                          year: d.year,
                          value: toNum(d.value),
                        }))}
                        margin={{ top: 10, right: 14, bottom: 6, left: 34 }} // ✅ increase left
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis
                          tickFormatter={(v) => fmt(Number(v))}
                          width={72}
                        />
                        <Tooltip
                          formatter={(v: any) => [fmt(Number(v)), unitLabel]}
                          labelFormatter={(l) => `Year: ${l}`}
                        />
                        <Bar
                          dataKey="value"
                          fill="#22c55e"
                          radius={[10, 10, 0, 0]}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
