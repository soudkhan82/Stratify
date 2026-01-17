"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  Table2,
  Download,
} from "lucide-react";

/* =======================
   Types
======================= */

type FaoModule =
  | ""
  | "overview"
  | "top-production"
  | "top-import"
  | "top-export"
  | "trade-import"
  | "trade-export";

type WdiPoint = { year: number; value: number; unit?: string | null };

type WdiResponse = {
  iso3: string;
  country: string;
  region: string | null;
  indicator: { code: string; label: string; unit: string | null };
  latest: WdiPoint | null;
  series: WdiPoint[];
  error?: string;
};

type OverviewPayload = {
  iso3: string;
  country: string;
  latest_year: number | null;

  production_qty: number | null;
  production_unit: string | null;

  import_qty: number | null;
  import_unit: string | null;

  export_qty: number | null;
  export_unit: string | null;

  kcal_per_capita_day: number | null;
  protein_g_per_capita_day: number | null;
  fat_g_per_capita_day: number | null;

  error?: string;
};

type TopItem = { item: string; value: number; unit: string | null };
type TopPayload = {
  iso3: string;
  country: string;
  latest_year: number | null;
  kind?: string;
  items: TopItem[];
  error?: string;
};

type TradeItem = {
  item: string;
  value: number;
  unit: string | null;
  share_pct: number | null;
};
type TradeTrendPoint = { year: number; value: number };
type TradeInsights = {
  ok: boolean;
  iso3: string;
  country: string;
  kind: "import" | "export";
  element: string;
  latest_year: number;
  total_latest: number | null;
  total_prev_year: number | null;
  yoy_pct: number | null;
  top1_share_pct: number | null;
  top5_share_pct: number | null;
  items: TradeItem[];
  trend: TradeTrendPoint[];
  error?: string;
};

/* =======================
   Helpers
======================= */

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function qsSet(
  routerReplace: (url: string) => void,
  iso3: string,
  code: string,
) {
  routerReplace(`/world/country/${iso3}?indicator=${encodeURIComponent(code)}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function parseWdiResponse(
  raw: unknown,
  iso3: string,
  indicator: string,
): WdiResponse {
  if (!isRecord(raw)) {
    return {
      iso3,
      country: iso3,
      region: null,
      indicator: { code: indicator, label: indicator, unit: null },
      latest: null,
      series: [],
      error: "Invalid WDI API response (not an object).",
    };
  }

  const maybeErr = raw.error;
  if (typeof maybeErr === "string" && maybeErr.trim()) {
    return {
      iso3,
      country: iso3,
      region: null,
      indicator: { code: indicator, label: indicator, unit: null },
      latest: null,
      series: [],
      error: maybeErr,
    };
  }

  const country = asString(raw.country, iso3);
  const region = asNullableString(raw.region);

  const ind = isRecord(raw.indicator) ? raw.indicator : {};
  const code = asString(ind.code, indicator);
  const label = asString(ind.label, indicator);
  const unit = (typeof ind.unit === "string" ? ind.unit : null) as
    | string
    | null;

  const latestRaw = isRecord(raw.latest) ? raw.latest : null;
  const latest: WdiPoint | null =
    latestRaw &&
    asNumber(latestRaw.year) !== null &&
    asNumber(latestRaw.value) !== null
      ? {
          year: asNumber(latestRaw.year)!,
          value: asNumber(latestRaw.value)!,
          unit: typeof latestRaw.unit === "string" ? latestRaw.unit : null,
        }
      : null;

  const seriesRaw = Array.isArray(raw.series) ? raw.series : [];
  const series = seriesRaw
    .map((r): WdiPoint | null => {
      if (!isRecord(r)) return null;
      const y = asNumber(r.year);
      const v = asNumber(r.value);
      if (y === null || v === null) return null;
      return {
        year: y,
        value: v,
        unit: typeof r.unit === "string" ? r.unit : null,
      };
    })
    .filter((x): x is WdiPoint => x !== null);

  return {
    iso3,
    country,
    region,
    indicator: { code, label, unit },
    latest,
    series,
  };
}

async function fetchJsonOrThrow(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 300)}` : ""}`,
    );
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Expected JSON but got "${ct || "unknown"}"${text ? ` — ${text.slice(0, 200)}` : ""}`,
    );
  }

  return res.json();
}

function titleForFaoModule(m: FaoModule): string {
  switch (m) {
    case "overview":
      return "FAOSTAT Overview";
    case "top-production":
      return "Top Production Items";
    case "top-import":
      return "Top Import Items";
    case "top-export":
      return "Top Export Items";
    case "trade-import":
      return "Imports — Trends & Shares";
    case "trade-export":
      return "Exports — Trends & Shares";
    default:
      return "FAOSTAT";
  }
}

function downloadJson(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Tooltip helpers (no `any`) */
function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function tooltipNumber(v: unknown): string {
  const n = toFiniteNumber(v);
  if (n === null) return "—";
  return n.toLocaleString();
}

function tooltipPercent(v: unknown): string {
  const n = toFiniteNumber(v);
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

/* =======================
   Page
======================= */

export default function CountryProfilePage({
  params,
}: {
  params: { iso3: string };
}) {
  const router = useRouter();
  const search = useSearchParams();

  const iso3 = String(params.iso3 || "").toUpperCase();
  const indicator = (search.get("indicator") || "SP.POP.TOTL").trim();

  const [tab, setTab] = useState<"wdi" | "faostat">("wdi");

  const [wdi, setWdi] = useState<WdiResponse | null>(null);
  const [wdiLoading, setWdiLoading] = useState(false);

  // FAOSTAT state
  const [faoModule, setFaoModule] = useState<FaoModule>("");
  const [faoLoading, setFaoLoading] = useState(false);
  const [faoError, setFaoError] = useState<string | null>(null);
  const [faoOverview, setFaoOverview] = useState<OverviewPayload | null>(null);
  const [faoTop, setFaoTop] = useState<TopPayload | null>(null);

  // Trade insights state
  const [trade, setTrade] = useState<TradeInsights | null>(null);
  const [tradeTopN, setTradeTopN] = useState(10);
  const [tradeYears, setTradeYears] = useState(10);

  const quickPicks = useMemo(
    () => [
      { label: "Population", code: "SP.POP.TOTL" },
      { label: "GDP (current US$)", code: "NY.GDP.MKTP.CD" },
      { label: "Population density", code: "EN.POP.DNST" },
      { label: "Life expectancy", code: "SP.DYN.LE00.IN" },
      { label: "Unemployment (%)", code: "SL.UEM.TOTL.ZS" },
    ],
    [],
  );

  const tradeTheme = useMemo(() => {
    const isImport = faoModule === "trade-import";
    return {
      isImport,
      headerGrad: isImport
        ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600"
        : "bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600",
      chipClass: isImport
        ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
        : "border-indigo-600/30 bg-indigo-600/10 text-indigo-700",
      accentText: isImport ? "text-emerald-700" : "text-indigo-700",
      donutA: isImport ? "#10b981" : "#6366f1",
    };
  }, [faoModule]);

  /* ================
     WDI fetch
  ================ */
  useEffect(() => {
    let alive = true;

    async function run() {
      setWdiLoading(true);
      try {
        const url = `/api/wdi/country?iso3=${encodeURIComponent(iso3)}&indicator=${encodeURIComponent(indicator)}`;
        const raw = await fetchJsonOrThrow(url);
        if (!alive) return;

        const parsed = parseWdiResponse(raw, iso3, indicator);
        if (!parsed.error && parsed.series.length === 0) {
          setWdi({
            ...parsed,
            error:
              "No WDI rows returned. (API succeeded, but dataset is empty for this iso3/indicator.)",
          });
        } else {
          setWdi(parsed);
        }
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setWdi({
          iso3,
          country: iso3,
          region: null,
          indicator: { code: indicator, label: indicator, unit: null },
          latest: null,
          series: [],
          error: `Failed to load WDI: ${msg}`,
        });
      } finally {
        if (alive) setWdiLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [iso3, indicator]);

  /* ================
     FAOSTAT fetch (module-based)
  ================ */
  useEffect(() => {
    if (tab !== "faostat") return;
    if (!faoModule) return;

    let alive = true;

    async function run() {
      setFaoLoading(true);
      setFaoError(null);

      setFaoOverview(null);
      setFaoTop(null);
      setTrade(null);

      try {
        // trade insights
        if (faoModule === "trade-import" || faoModule === "trade-export") {
          const kind = faoModule === "trade-import" ? "import" : "export";

          const raw = await fetchJsonOrThrow(
            `/api/faostat/trade-insights?iso3=${encodeURIComponent(iso3)}&kind=${encodeURIComponent(kind)}&top=${encodeURIComponent(
              String(tradeTopN),
            )}&years=${encodeURIComponent(String(tradeYears))}`,
          );

          if (!alive) return;
          if (!isRecord(raw))
            throw new Error("Invalid Trade Insights response (not an object).");
          if (typeof raw.error === "string" && raw.error.trim()) {
            setFaoError(raw.error);
            return;
          }

          const ok = raw.ok === true;
          if (!ok) {
            setFaoError(asString(raw.error, "Trade insights not available."));
            return;
          }

          const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
          const items: TradeItem[] = itemsRaw
            .map((r): TradeItem | null => {
              if (!isRecord(r)) return null;
              const item = asString(r.item, "");
              const value = asNumber(r.value);
              if (!item || value === null) return null;
              return {
                item,
                value,
                unit: asNullableString(r.unit),
                share_pct: asNumber(r.share_pct),
              };
            })
            .filter((x): x is TradeItem => x !== null);

          const trendRaw = Array.isArray(raw.trend) ? raw.trend : [];
          const trend: TradeTrendPoint[] = trendRaw
            .map((r): TradeTrendPoint | null => {
              if (!isRecord(r)) return null;
              const year = asNumber(r.year);
              const value = asNumber(r.value);
              if (year === null || value === null) return null;
              return { year, value };
            })
            .filter((x): x is TradeTrendPoint => x !== null);

          setTrade({
            ok: true,
            iso3: asString(raw.iso3, iso3),
            country: asString(raw.country, iso3),
            kind: kind as "import" | "export",
            element: asString(raw.element, ""),
            latest_year: asNumber(raw.latest_year) ?? 0,
            total_latest: asNumber(raw.total_latest),
            total_prev_year: asNumber(raw.total_prev_year),
            yoy_pct: asNumber(raw.yoy_pct),
            top1_share_pct: asNumber(raw.top1_share_pct),
            top5_share_pct: asNumber(raw.top5_share_pct),
            items,
            trend,
          });

          return;
        }

        // overview
        if (faoModule === "overview") {
          const raw = await fetchJsonOrThrow(
            `/api/faostat/overview?iso3=${encodeURIComponent(iso3)}`,
          );
          if (!alive) return;

          if (!isRecord(raw))
            throw new Error(
              "Invalid FAOSTAT Overview response (not an object).",
            );
          if (typeof raw.error === "string" && raw.error.trim()) {
            setFaoError(raw.error);
            return;
          }

          setFaoOverview({
            iso3: asString(raw.iso3, iso3),
            country: asString(raw.country, iso3),
            latest_year: (asNumber(raw.latest_year) as number | null) ?? null,

            production_qty:
              (asNumber(raw.production_qty) as number | null) ?? null,
            production_unit: asNullableString(raw.production_unit),

            import_qty: (asNumber(raw.import_qty) as number | null) ?? null,
            import_unit: asNullableString(raw.import_unit),

            export_qty: (asNumber(raw.export_qty) as number | null) ?? null,
            export_unit: asNullableString(raw.export_unit),

            kcal_per_capita_day:
              (asNumber(raw.kcal_per_capita_day) as number | null) ?? null,
            protein_g_per_capita_day:
              (asNumber(raw.protein_g_per_capita_day) as number | null) ?? null,
            fat_g_per_capita_day:
              (asNumber(raw.fat_g_per_capita_day) as number | null) ?? null,
          });
          return;
        }

        // legacy top module
        const raw = await fetchJsonOrThrow(
          `/api/faostat/module?iso3=${encodeURIComponent(iso3)}&kind=${encodeURIComponent(faoModule)}&top=10`,
        );
        if (!alive) return;

        if (!isRecord(raw))
          throw new Error("Invalid FAOSTAT module response (not an object).");
        if (typeof raw.error === "string" && raw.error.trim()) {
          setFaoError(raw.error);
          return;
        }

        const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
        const items: TopItem[] = itemsRaw
          .map((r): TopItem | null => {
            if (!isRecord(r)) return null;
            const item = asString(r.item, "");
            const value = asNumber(r.value);
            if (!item || value === null) return null;
            return { item, value, unit: asNullableString(r.unit) };
          })
          .filter((x): x is TopItem => x !== null);

        setFaoTop({
          iso3: asString(raw.iso3, iso3),
          country: asString(raw.country, iso3),
          latest_year: (asNumber(raw.latest_year) as number | null) ?? null,
          kind: asNullableString(raw.kind) ?? undefined,
          items,
        });
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setFaoError(msg);
      } finally {
        if (alive) setFaoLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [tab, faoModule, iso3, tradeTopN, tradeYears]);

  const countryTitle = wdi?.country ? `${wdi.country} (${iso3})` : iso3;

  const tradeUnit = trade?.items?.[0]?.unit ?? "";
  const donutData = useMemo(() => {
    const top5 = trade?.top5_share_pct;
    if (top5 === null || top5 === undefined || !Number.isFinite(top5))
      return [];
    return [
      { name: "Top 5", value: top5 },
      { name: "Others", value: Math.max(0, 100 - top5) },
    ];
  }, [trade]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="h-9"
            >
              ← Back
            </Button>

            <div className="min-w-0">
              <div className="text-[12px] uppercase tracking-wider text-slate-500">
                Country Profile
              </div>
              <h1 className="truncate text-2xl font-bold text-slate-900">
                {countryTitle}
              </h1>

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border px-2 py-1 text-slate-600">
                  Region: {wdi?.region ?? "—"}
                </span>
                <span className="rounded-full border px-2 py-1 text-slate-600">
                  Indicator: {wdi?.indicator?.label ?? indicator}
                </span>
                <span className="rounded-full border px-2 py-1 text-slate-600">
                  Code: {wdi?.indicator?.code ?? indicator}
                </span>
                <span className="rounded-full border px-2 py-1 text-slate-600">
                  Unit: {wdi?.indicator?.unit ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "wdi" | "faostat")}>
          <TabsList className="mb-3">
            <TabsTrigger value="wdi">WDI</TabsTrigger>
            <TabsTrigger value="faostat">FAOSTAT</TabsTrigger>
          </TabsList>

          {/* WDI TAB */}
          <TabsContent value="wdi" className="space-y-3">
            <Card className="shadow-sm">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold text-slate-800">
                  Quick indicator picks
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {quickPicks.map((p) => {
                    const active =
                      (wdi?.indicator?.code ?? indicator) === p.code;
                    return (
                      <button
                        key={p.code}
                        onClick={() => qsSet(router.replace, iso3, p.code)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          active
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Card className="shadow-sm lg:col-span-1">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Latest value
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {wdiLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : wdi?.error ? (
                    <div className="text-sm text-rose-600">{wdi.error}</div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-slate-900 leading-tight">
                        {fmt(wdi?.latest?.value ?? null)}
                        <span className="ml-2 text-sm font-medium text-slate-500">
                          {wdi?.latest?.unit ?? wdi?.indicator?.unit ?? ""}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Year: {wdi?.latest?.year ?? "—"}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm lg:col-span-2">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Last 25 years
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="max-h-[280px] overflow-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                            Year
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(wdi?.series ?? []).slice(-25).map((r) => (
                          <tr key={r.year} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {r.year}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {fmt(r.value)}{" "}
                              <span className="text-xs text-slate-500">
                                {r.unit ?? wdi?.indicator?.unit ?? ""}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!wdiLoading && (wdi?.series?.length ?? 0) === 0 && (
                          <tr>
                            <td
                              className="px-3 py-6 text-sm text-slate-500"
                              colSpan={2}
                            >
                              No data.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* FAOSTAT TAB */}
          <TabsContent value="faostat" className="space-y-3">
            {/* Module buttons */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
              {(
                [
                  {
                    key: "overview",
                    label: "Overview (SUA)",
                    desc: "Latest year + headline + nutrition",
                  },
                  {
                    key: "top-production",
                    label: "Top Production",
                    desc: "Top produced items (Production)",
                  },
                  {
                    key: "trade-import",
                    label: "Imports (Insights)",
                    desc: "Trend + shares + top items",
                  },
                  {
                    key: "trade-export",
                    label: "Exports (Insights)",
                    desc: "Trend + shares + top items",
                  },
                  {
                    key: "top-import",
                    label: "Top Imports (Legacy)",
                    desc: "Top import items only",
                  },
                  {
                    key: "top-export",
                    label: "Top Exports (Legacy)",
                    desc: "Top export items only",
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setFaoModule(m.key)}
                  className={[
                    "text-left rounded-xl border p-4 transition",
                    faoModule === m.key
                      ? "bg-slate-900 text-white border-slate-900"
                      : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div
                    className={[
                      "mt-1 text-xs",
                      faoModule === m.key ? "text-white/70" : "text-slate-500",
                    ].join(" ")}
                  >
                    {m.desc}
                  </div>
                </button>
              ))}
            </div>

            {!faoModule ? (
              <div className="text-sm text-slate-500">
                Select a module above to load FAOSTAT insights (prevents
                timeouts).
              </div>
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    {titleForFaoModule(faoModule)}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-0">
                  {faoLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : faoError ? (
                    <div className="text-sm text-rose-600">{faoError}</div>
                  ) : faoModule === "overview" ? (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">
                          Latest year
                        </div>
                        <div className="mt-1 text-2xl font-bold text-slate-900">
                          {faoOverview?.latest_year ?? "—"}
                        </div>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">
                          Quantities (headline)
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Production</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(faoOverview?.production_qty ?? null)}{" "}
                              <span className="text-xs font-normal text-slate-500">
                                {faoOverview?.production_unit ?? ""}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Imports</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(faoOverview?.import_qty ?? null)}{" "}
                              <span className="text-xs font-normal text-slate-500">
                                {faoOverview?.import_unit ?? ""}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Exports</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(faoOverview?.export_qty ?? null)}{" "}
                              <span className="text-xs font-normal text-slate-500">
                                {faoOverview?.export_unit ?? ""}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">
                          Nutrition (per capita/day)
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Calories</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(faoOverview?.kcal_per_capita_day ?? null)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Protein (g)</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(
                                faoOverview?.protein_g_per_capita_day ?? null,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Fat (g)</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(faoOverview?.fat_g_per_capita_day ?? null)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : faoModule === "trade-import" ||
                    faoModule === "trade-export" ? (
                    <div className="space-y-4">
                      <div
                        className={`rounded-2xl ${tradeTheme.headerGrad} p-4 text-white`}
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-sm font-semibold">
                              {trade?.country ?? iso3} •{" "}
                              {trade?.latest_year
                                ? `Latest: ${trade.latest_year}`
                                : "—"}
                            </div>
                            <div className="text-xs text-white/85">
                              Element:{" "}
                              <span className="font-medium">
                                {trade?.element ?? "—"}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="secondary"
                              className="bg-white/15 hover:bg-white/20 text-white border border-white/20"
                              onClick={() => setTradeYears(10)}
                            >
                              10y
                            </Button>
                            <Button
                              variant="secondary"
                              className="bg-white/15 hover:bg-white/20 text-white border border-white/20"
                              onClick={() => setTradeYears(15)}
                            >
                              15y
                            </Button>
                            <Button
                              variant="secondary"
                              className="bg-white/15 hover:bg-white/20 text-white border border-white/20"
                              onClick={() => setTradeTopN(10)}
                            >
                              Top 10
                            </Button>
                            <Button
                              variant="secondary"
                              className="bg-white/15 hover:bg-white/20 text-white border border-white/20"
                              onClick={() => setTradeTopN(15)}
                            >
                              Top 15
                            </Button>

                            <Button
                              variant="secondary"
                              className="bg-white/15 hover:bg-white/20 text-white border border-white/20"
                              onClick={() =>
                                trade &&
                                downloadJson(
                                  `faostat_${iso3}_${trade.kind}_insights.json`,
                                  trade,
                                )
                              }
                              disabled={!trade?.ok}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              JSON
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Left insights */}
                        <div className="lg:col-span-2 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <Card className="rounded-2xl border shadow-sm">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <TrendingUp
                                    className={`h-4 w-4 ${tradeTheme.accentText}`}
                                  />
                                  Total (latest)
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-semibold">
                                  {fmt(trade?.total_latest ?? null)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Unit: {tradeUnit || "—"}
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="rounded-2xl border shadow-sm">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  {(trade?.yoy_pct ?? 0) >= 0 ? (
                                    <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <ArrowDownRight className="h-4 w-4 text-rose-600" />
                                  )}
                                  YoY change
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-semibold">
                                  {pct(trade?.yoy_pct ?? null)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Prev: {fmt(trade?.total_prev_year ?? null)}
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="rounded-2xl border shadow-sm">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <PieIcon
                                    className={`h-4 w-4 ${tradeTheme.accentText}`}
                                  />
                                  Top 1 share
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-semibold">
                                  {pct(trade?.top1_share_pct ?? null)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Concentration
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="rounded-2xl border shadow-sm">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <PieIcon
                                    className={`h-4 w-4 ${tradeTheme.accentText}`}
                                  />
                                  Top 5 share
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-semibold">
                                  {pct(trade?.top5_share_pct ?? null)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Top 5 vs Others
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          <Card className="rounded-2xl border shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp
                                  className={`h-4 w-4 ${tradeTheme.accentText}`}
                                />
                                Trend (last {tradeYears} years)
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[240px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trade?.trend ?? []}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis
                                    dataKey="year"
                                    tick={{ fontSize: 12 }}
                                  />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip
                                    formatter={(value: unknown) => [
                                      tooltipNumber(value),
                                      tradeUnit || "",
                                    ]}
                                    labelFormatter={(label: string | number) =>
                                      `Year: ${String(label)}`
                                    }
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="value"
                                    strokeWidth={3}
                                    dot={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>

                          <Card className="rounded-2xl border shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <PieIcon
                                  className={`h-4 w-4 ${tradeTheme.accentText}`}
                                />
                                Composition (Top 5 vs Others)
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[220px]">
                              {donutData.length === 0 ? (
                                <div className="text-sm text-slate-500">
                                  No data
                                </div>
                              ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Tooltip
                                      formatter={(
                                        value: unknown,
                                        name: unknown,
                                      ) => [
                                        tooltipPercent(value),
                                        String(name ?? ""),
                                      ]}
                                    />
                                    <Pie
                                      data={donutData}
                                      dataKey="value"
                                      nameKey="name"
                                      innerRadius={55}
                                      outerRadius={85}
                                      paddingAngle={2}
                                    >
                                      <Cell fill={tradeTheme.donutA} />
                                      <Cell fill="#e5e7eb" />
                                    </Pie>
                                  </PieChart>
                                </ResponsiveContainer>
                              )}
                              <div className="mt-2 flex justify-between text-xs text-slate-600">
                                <span>
                                  Top 5: {pct(trade?.top5_share_pct ?? null)}
                                </span>
                                <span>
                                  Others:{" "}
                                  {donutData[1]?.value !== undefined
                                    ? `${Number(donutData[1].value).toFixed(1)}%`
                                    : "—"}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Right table */}
                        <div className="lg:col-span-3">
                          <Card className="rounded-2xl border shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Table2
                                  className={`h-4 w-4 ${tradeTheme.accentText}`}
                                />
                                Top items ({tradeTopN}) •{" "}
                                {trade?.latest_year ?? "—"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="rounded-xl border overflow-hidden">
                                <div className="max-h-[520px] overflow-auto">
                                  <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 z-10">
                                      <tr className="text-left">
                                        <th className="px-3 py-2 font-medium">
                                          #
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Item
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Value
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Share
                                        </th>
                                        <th className="px-3 py-2 font-medium">
                                          Unit
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(trade?.items ?? []).map((r, i) => (
                                        <tr
                                          key={`${r.item}-${i}`}
                                          className="border-t hover:bg-slate-50/60"
                                        >
                                          <td className="px-3 py-2 text-slate-500">
                                            {i + 1}
                                          </td>
                                          <td className="px-3 py-2 font-medium">
                                            {r.item}
                                          </td>
                                          <td className="px-3 py-2 tabular-nums">
                                            {fmt(r.value)}
                                          </td>
                                          <td className="px-3 py-2 tabular-nums">
                                            <Badge
                                              className={`border ${tradeTheme.chipClass}`}
                                            >
                                              {pct(r.share_pct ?? null)}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">
                                            {r.unit ?? "—"}
                                          </td>
                                        </tr>
                                      ))}
                                      {(trade?.items?.length ?? 0) === 0 && (
                                        <tr>
                                          <td
                                            colSpan={5}
                                            className="px-3 py-8 text-center text-slate-500"
                                          >
                                            No rows found
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="mt-3 text-xs text-slate-500">
                                Element:{" "}
                                <span className="font-medium">
                                  {trade?.element ?? "—"}
                                </span>
                                {" • "}
                                Top {tradeTopN} share sum (approx):{" "}
                                <span className="font-medium">
                                  {(trade?.items ?? [])
                                    .reduce((a, b) => a + (b.share_pct ?? 0), 0)
                                    .toFixed(1)}
                                  %
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-[360px] overflow-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                              Item
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(faoTop?.items ?? []).map((r) => (
                            <tr
                              key={r.item}
                              className="border-b last:border-b-0"
                            >
                              <td className="px-3 py-2 text-slate-800">
                                {r.item}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                {fmt(r.value)}{" "}
                                <span className="text-xs font-normal text-slate-500">
                                  {r.unit ?? ""}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(faoTop?.items?.length ?? 0) === 0 && (
                            <tr>
                              <td
                                className="px-3 py-6 text-sm text-slate-500"
                                colSpan={2}
                              >
                                No rows found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
