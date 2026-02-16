"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* =======================
   Types
======================= */

type WeoVintage = {
  vintage: string;
  release_month: string | null;
  release_year: number | null;
  release_date: string | null;
};

type WeoIndicator = {
  indicator_code: string;
  indicator_name: string;
  unit: string | null;
  category: string | null;
  source: string | null;
};

type CountryResp = {
  ok: boolean;
  iso3: string;
  vintage: string;
  indicator: {
    indicator_code: string;
    indicator_name: string;
    unit: string | null;
    category: string | null;
  };
  unit: string | null;
  latest: { year: number; value: number | null } | null;
  series: { year: number; value: number | null }[];
  error?: string;
};

/* =======================
   Helpers
======================= */

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText}${txt ? ` — ${txt.slice(0, 220)}` : ""}`,
    );
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error(
      `Expected JSON but got "${ct || "unknown"}"${txt ? ` — ${txt.slice(0, 220)}` : ""}`,
    );
  }
  return JSON.parse(txt);
}

const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const x = Number(String(v).replaceAll(",", "").trim());
  return Number.isFinite(x) ? x : null;
};

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = n as number;
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${(n as number).toFixed(1)}%`;
}

function stableColorFromKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 72% 45%)`;
}

function yoyTable(series: { year: number; value: number | null }[]) {
  const s = (series || [])
    .map((p) => ({ year: Number(p.year), value: toNum(p.value) }))
    .filter((p) => Number.isFinite(p.year) && p.value !== null)
    .sort((a, b) => a.year - b.year) as { year: number; value: number }[];

  return s.map((cur, idx) => {
    const prev = idx > 0 ? s[idx - 1] : null;
    const yoy =
      prev && prev.value !== 0 && Number.isFinite(prev.value)
        ? ((cur.value - prev.value) / Math.abs(prev.value)) * 100
        : null;
    return { year: cur.year, value: cur.value, yoy };
  });
}

function safeText(s: string, max = 52) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/* =======================
   Component
======================= */

export default function WeoTab({ iso3 }: { iso3: string }) {
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [vintages, setVintages] = useState<WeoVintage[]>([]);
  const [indicators, setIndicators] = useState<WeoIndicator[]>([]);

  const [vintage, setVintage] = useState<string>("");
  const [cat, setCat] = useState<string>("ALL");
  const [q, setQ] = useState<string>("");
  const [indicator, setIndicator] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<CountryResp | null>(null);

  /* ---------- META ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const m = await fetchJson("/api/imf/weo/meta");
        if (!alive) return;

        if (!m?.ok) throw new Error(m?.error || "Meta API returned ok=false");

        const vs: WeoVintage[] = Array.isArray(m.vintages) ? m.vintages : [];
        const ins: WeoIndicator[] = Array.isArray(m.indicators)
          ? m.indicators
          : [];

        setVintages(vs);
        setIndicators(ins);

        setVintage((cur) => cur || (vs[0]?.vintage ?? ""));

        setIndicator((cur) => {
          if (cur) return cur;
          const preferred = [
            "NGDP_RPCH",
            "PCPIPCH",
            "NGDPD",
            "BCA_NGDPD",
            "LUR",
          ];
          const hit = preferred.find((p) =>
            ins.some((x) => x.indicator_code === p),
          );
          return hit || (ins[0]?.indicator_code ?? "");
        });
      } catch (e: any) {
        if (!alive) return;
        setMetaError(e?.message || "Failed to load WEO meta");
      } finally {
        if (alive) setMetaLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- Categories ---------- */
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const i of indicators) {
      const c = String(i.category || "").trim();
      if (c) set.add(c);
    }
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [indicators]);

  const filteredIndicators = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return indicators.filter((i) => {
      const c = String(i.category || "").trim();
      if (cat !== "ALL" && c !== cat) return false;
      if (!qq) return true;
      return (
        i.indicator_code.toLowerCase().includes(qq) ||
        i.indicator_name.toLowerCase().includes(qq)
      );
    });
  }, [indicators, cat, q]);

  // keep indicator valid when category/search changes
  useEffect(() => {
    if (!indicators.length) return;
    if (!indicator) return;

    const exists = filteredIndicators.some(
      (x) => x.indicator_code === indicator,
    );
    if (!exists) {
      const next =
        filteredIndicators[0]?.indicator_code ||
        indicators[0]?.indicator_code ||
        "";
      if (next && next !== indicator) setIndicator(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, q, indicators.length]);

  const indicatorRow = useMemo(() => {
    return indicators.find((x) => x.indicator_code === indicator) ?? null;
  }, [indicators, indicator]);

  const unit = resp?.unit || indicatorRow?.unit || null;
  const category = resp?.indicator?.category || indicatorRow?.category || null;
  const indicatorLabel =
    indicatorRow?.indicator_name ||
    resp?.indicator?.indicator_name ||
    indicator ||
    "—";

  /* ---------- DATA ---------- */
  useEffect(() => {
    if (!iso3 || iso3.length !== 3) return;
    if (!vintage || !indicator) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url =
          `/api/imf/weo/country?iso3=${encodeURIComponent(iso3)}` +
          `&indicator=${encodeURIComponent(indicator)}` +
          `&vintage=${encodeURIComponent(vintage)}`;

        const r = (await fetchJson(url)) as CountryResp;
        if (!alive) return;

        setResp(r);

        if (!r.ok) setError(r.error || "Country API returned ok=false");
        else if (!Array.isArray(r.series) || r.series.length === 0)
          setError("No WEO series for this iso3/indicator/vintage.");
        else setError(null);
      } catch (e: any) {
        if (!alive) return;
        setResp(null);
        setError(e?.message || "Failed to load WEO series");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [iso3, vintage, indicator]);

  /* ---------- Derived ---------- */
  const table = useMemo(() => yoyTable(resp?.series || []), [resp]);

  const lineData = useMemo(() => {
    if (!table.length) return [];
    const take = 24;
    return table.slice(Math.max(0, table.length - take));
  }, [table]);

  const latest = useMemo(() => {
    const lv = toNum(resp?.latest?.value);
    const ly = resp?.latest?.year ? Number(resp.latest.year) : null;
    if (ly && lv !== null) return { year: ly, value: lv };
    if (!table.length) return null;
    const last = table[table.length - 1];
    return { year: last.year, value: last.value };
  }, [resp, table]);

  const rangeMin = useMemo(() => {
    if (!table.length) return null;
    return Math.min(...table.map((x) => x.value));
  }, [table]);

  const rangeMax = useMemo(() => {
    if (!table.length) return null;
    return Math.max(...table.map((x) => x.value));
  }, [table]);

  const latestYoY = useMemo(() => {
    if (table.length < 2) return null;
    return table[table.length - 1].yoy ?? null;
  }, [table]);

  /* ---------- Quick Picks ---------- */
  const quickTabs = useMemo(() => {
    const list = filteredIndicators.length ? filteredIndicators : indicators;

    if (q.trim()) return list.slice(0, 7);
    if (cat !== "ALL") return list.slice(0, 7);

    const preferred = [
      "NGDP_RPCH",
      "NGDPD",
      "PCPIPCH",
      "BCA_NGDPD",
      "LUR",
      "GGXWDN_NGDPD",
      "GGSB_NPGDP",
      "GGXCNL_NGDPD",
    ];

    const byCode = new Map(indicators.map((x) => [x.indicator_code, x]));
    const top = preferred
      .map((c) => byCode.get(c))
      .filter(Boolean) as WeoIndicator[];

    const fill = list
      .filter((x) => !preferred.includes(x.indicator_code))
      .slice(0, Math.max(0, 7 - top.length));

    return [...top, ...fill].slice(0, 7);
  }, [indicators, filteredIndicators, cat, q]);

  /* ---------- Download JSON ---------- */
  function downloadJSON() {
    const payload = resp ?? { ok: false };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weo_${iso3}_${indicator}_${vintage || "vintage"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ✅ table sizing: ~10 rows visible
  const ROW_PX = 32; // body row height
  const HEAD_PX = 36; // sticky header height
  const MAX_ROWS = 10;
  const TABLE_MAX_H = HEAD_PX + ROW_PX * MAX_ROWS;

  return (
    <div className="space-y-3">
      {/* =========================
          Header + Summary cards
      ========================== */}
      <Card className="shadow-sm">
        <CardHeader className="py-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800">
              IMF — World Economic Outlook (WEO)
            </CardTitle>
            <div className="text-xs text-slate-500">
              {metaLoading
                ? "Loading meta…"
                : `Vintages: ${vintages.length} • Indicators: ${indicators.length}`}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {metaError ? (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Meta error: {metaError}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border bg-white p-3">
              <div className="text-[11px] text-slate-500">Latest</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {latest ? latest.year : "—"}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {latest ? fmt(latest.value) : "—"}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {unit ?? ""}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-3">
              <div className="text-[11px] text-slate-500">YoY change</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {latestYoY === null ? "—" : fmtPct(latestYoY)}
              </div>
              <div className="mt-1">
                {latestYoY === null ? (
                  <Badge variant="secondary">Not enough data</Badge>
                ) : latestYoY >= 0 ? (
                  <Badge className="bg-emerald-600 text-white">Up</Badge>
                ) : (
                  <Badge className="bg-rose-600 text-white">Down</Badge>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-3">
              <div className="text-[11px] text-slate-500">Range (min)</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {fmt(rangeMin)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {unit ?? ""}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-3">
              <div className="text-[11px] text-slate-500">Range (max)</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {fmt(rangeMax)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {unit ?? ""}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================
          Main grid
      ========================== */}
      <div className="grid grid-cols-12 gap-3">
        {/* LEFT: Trend + Table (compact card container) */}
        <Card className="col-span-12 xl:col-span-8 shadow-sm">
          <CardHeader className="py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold text-slate-800">
                  Trend (Line) + YoY%
                </CardTitle>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {safeText(indicatorLabel, 110)}
                  {unit ? ` • ${unit}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {unit ? <Badge variant="secondary">{unit}</Badge> : null}
                {category ? (
                  <Badge variant="secondary">{category}</Badge>
                ) : null}
                <Badge variant="secondary">{iso3}</Badge>
                {vintage ? <Badge variant="secondary">{vintage}</Badge> : null}
                {loading ? (
                  <Badge className="bg-slate-900 text-white">Loading…</Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {loading ? (
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Loading WEO…
              </div>
            ) : error ? (
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {error}
              </div>
            ) : table.length === 0 ? (
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                No WEO series for this indicator / country.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {/* ✅ Reasonable chart height */}
                <div className="h-[260px] rounded-lg border bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={lineData}
                      margin={{ left: 8, right: 10, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(v) => fmtCompact(Number(v))} />
                      <Tooltip
                        labelFormatter={(l) => `Year: ${l}`}
                        formatter={(v: any) => fmt(Number(v))}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={stableColorFromKey(indicator || "weo")}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* ✅ Table: vertical scroll, ~10 rows visible */}
                <div className="rounded-lg border bg-white">
                  <div
                    className="overflow-y-auto overflow-x-hidden"
                    style={{ maxHeight: TABLE_MAX_H }}
                  >
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">
                            Year
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700">
                            Value
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700">
                            YoY%
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {table
                          .slice()
                          .sort((a, b) => b.year - a.year)
                          .map((r) => (
                            <tr key={r.year} className="border-t">
                              <td
                                className="px-3 py-2 text-slate-700"
                                style={{ height: ROW_PX }}
                              >
                                {r.year}
                              </td>
                              <td
                                className="px-3 py-2 text-right font-semibold text-slate-900"
                                style={{ height: ROW_PX }}
                              >
                                {fmt(r.value)}
                              </td>
                              <td
                                className="px-3 py-2 text-right"
                                style={{ height: ROW_PX }}
                              >
                                <span
                                  className={[
                                    "inline-flex rounded-full border px-2 py-0.5 font-semibold",
                                    r.yoy === null
                                      ? "border-slate-200 text-slate-500"
                                      : r.yoy >= 0
                                        ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                        : "border-rose-200 text-rose-700 bg-rose-50",
                                  ].join(" ")}
                                >
                                  {r.yoy === null ? "—" : fmtPct(r.yoy)}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t px-3 py-2 text-[11px] text-slate-500">
                    Showing 10 rows per view (scroll for more)
                  </div>
                </div>
              </div>
            )}

            <div className="mt-2 text-[11px] text-slate-500">
              Showing last {Math.min(24, lineData.length)} points • {iso3} •{" "}
              {vintage}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Controls */}
        <Card className="col-span-12 xl:col-span-4 shadow-sm">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Controls
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-slate-600">Indicator search</div>
                <input
                  className="mt-1 h-9 w-full rounded-xl border bg-white px-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search code/name…"
                  disabled={metaLoading || indicators.length === 0}
                />
              </div>

              <div>
                <div className="text-xs text-slate-600">Category</div>
                <select
                  className="mt-1 h-9 w-full rounded-xl border bg-white px-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                  disabled={metaLoading || indicators.length === 0}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === "ALL" ? "All categories" : c}
                    </option>
                  ))}
                </select>
              </div>

              {vintages.length > 1 ? (
                <div>
                  <div className="text-xs text-slate-600">Vintage</div>
                  <select
                    className="mt-1 h-9 w-full rounded-xl border bg-white px-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
                    value={vintage}
                    onChange={(e) => setVintage(e.target.value)}
                    disabled={metaLoading || vintages.length === 0}
                  >
                    {vintages.map((v) => (
                      <option key={v.vintage} value={v.vintage}>
                        {v.vintage}
                        {v.release_date ? ` — ${v.release_date}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <div className="text-xs text-slate-600">Indicator</div>
                <select
                  className="mt-1 h-9 w-full rounded-xl border bg-white px-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
                  value={indicator}
                  onChange={(e) => setIndicator(e.target.value)}
                  disabled={metaLoading || indicators.length === 0}
                  title={indicatorLabel}
                >
                  {filteredIndicators.length === 0 ? (
                    <option value={indicator}>{indicatorLabel}</option>
                  ) : (
                    filteredIndicators.map((i) => (
                      <option key={i.indicator_code} value={i.indicator_code}>
                        {safeText(i.indicator_name, 68)} ({i.indicator_code})
                      </option>
                    ))
                  )}
                </select>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{iso3}</Badge>
                  {unit ? <Badge variant="secondary">{unit}</Badge> : null}
                  {category ? (
                    <Badge variant="secondary">{category}</Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={downloadJSON}
                  disabled={!resp}
                >
                  Download JSON
                </Button>
              </div>

              <div>
                <div className="text-xs text-slate-600">Quick picks</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {quickTabs.map((p) => {
                    const active = indicator === p.indicator_code;
                    return (
                      <button
                        key={p.indicator_code}
                        onClick={() => setIndicator(p.indicator_code)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          "max-w-[240px] truncate",
                          active
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                        title={`${p.indicator_name} (${p.indicator_code})`}
                      >
                        {p.indicator_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
