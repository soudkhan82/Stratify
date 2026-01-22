"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

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

/** ✅ Consolidated FAOSTAT types + API helper */
import { faostatApi } from "@/app/lib/rpc/faostat";
import type {
  OverviewPayload,
  TopPayload,
  TradeInsights,
} from "@/app/lib/rpc/faostat";

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

export default function CountryProfilePage() {
  const search = useSearchParams();
  const router = useRouter();

  const routeParams = useParams<{ iso3?: string }>();
  const iso3 = String(routeParams?.iso3 ?? "").toUpperCase();
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
        if (faoModule === "trade-import" || faoModule === "trade-export") {
          const kind = faoModule === "trade-import" ? "import" : "export";
          const data = await faostatApi.tradeInsights(
            iso3,
            kind,
            tradeTopN,
            tradeYears,
          );
          if (!alive) return;

          if (!data.ok) {
            setFaoError(data.error ?? "Trade insights not available.");
            return;
          }

          setTrade(data);
          return;
        }

        if (faoModule === "overview") {
          const data = await faostatApi.overview(iso3);
          if (!alive) return;

          if (data.error) {
            setFaoError(data.error);
            return;
          }

          setFaoOverview(data);
          return;
        }

        const data = await faostatApi.module(iso3, faoModule as any, 10);
        if (!alive) return;

        if (data.error) {
          setFaoError(data.error);
          return;
        }

        setFaoTop(data);
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

            {/* (rest of your WDI UI stays the same — unchanged) */}
            {/* KEEP YOUR EXISTING WDI grid/cards/table BELOW if you already have it */}
          </TabsContent>

          {/* FAOSTAT TAB */}
          <TabsContent value="faostat" className="space-y-3">
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

            {/* KEEP the rest of your FAOSTAT rendering below unchanged */}
            {/* (Your overview, trade insights, and top tables blocks remain exactly as you already have.) */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
