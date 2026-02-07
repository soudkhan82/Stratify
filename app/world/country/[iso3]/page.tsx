// app/world/country/[iso3]/page.tsx
// ✅ Drop-in updated: colorful scheme + short WDI/FAOSTAT descriptions + nicer shell
// ✅ Keeps your existing logic intact (no API changes)

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { faostatApi } from "@/app/lib/rpc/faostat";
import type {
  OverviewPayload,
  TopPayload,
  TradeInsights,
} from "@/app/lib/rpc/faostat";

import CountryHeader from "@/app/world/components/CountryHeader";
import WdiTab, {
  type WdiResponse,
  parseWdiResponse,
} from "@/app/world/components/WdiTab";
import FaostatTab, {
  type FaoModule,
  isTopKind,
} from "@/app/world/components/FaostatTab";
import type { ProductionInsights } from "@/app/world/components/FaostatTab";

/* ------------------------ shared helper ------------------------ */

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

export default function CountryProfilePage() {
  const router = useRouter();
  const search = useSearchParams();
  const routeParams = useParams<{ iso3?: string }>();

  const iso3 = String(routeParams?.iso3 ?? "").toUpperCase();
  const indicator = (search.get("indicator") || "SP.POP.TOTL").trim();

  const [tab, setTab] = useState<"wdi" | "faostat">("wdi");

  // WDI state
  const [wdi, setWdi] = useState<WdiResponse | null>(null);
  const [wdiLoading, setWdiLoading] = useState(false);

  // FAOSTAT state
  const [faoModule, setFaoModule] = useState<FaoModule>("");
  const [faoLoading, setFaoLoading] = useState(false);
  const [faoError, setFaoError] = useState<string | null>(null);

  const [faoOverview, setFaoOverview] = useState<OverviewPayload | null>(null);
  const [faoTop, setFaoTop] = useState<TopPayload | null>(null);
  const [trade, setTrade] = useState<TradeInsights | null>(null);

  // Production Insights state
  const [prod, setProd] = useState<ProductionInsights | null>(null);
  const [prodTopN, setProdTopN] = useState(10);
  const [prodYears, setProdYears] = useState(10);
  const [prodElement, setProdElement] = useState("Production");

  // Trade controls
  const [tradeTopN, setTradeTopN] = useState(10);
  const [tradeYears, setTradeYears] = useState(10);

  const countryTitle = wdi?.country ? `${wdi.country} (${iso3})` : iso3;

  // ✅ Unit appended right after indicator label
  const indicatorCode = wdi?.indicator?.code ?? indicator;
  const indicatorUnit = wdi?.indicator?.unit ?? null;
  const indicatorLabelRaw = wdi?.indicator?.label ?? indicator;

  const indicatorLabelWithUnit = useMemo(() => {
    const u = String(indicatorUnit ?? "").trim();
    if (!u || u === "—") return indicatorLabelRaw;
    return `${indicatorLabelRaw} (${u})`;
  }, [indicatorLabelRaw, indicatorUnit]);

  /* ---------------- WDI fetch ---------------- */
  useEffect(() => {
    let alive = true;

    async function run() {
      setWdiLoading(true);
      try {
        const url = `/api/wdi/country?iso3=${encodeURIComponent(
          iso3,
        )}&indicator=${encodeURIComponent(indicator)}`;
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

  /* ---------------- FAOSTAT load (single source of truth) ---------------- */
  async function loadFao(next: FaoModule) {
    setFaoModule(next);
    setFaoLoading(true);
    setFaoError(null);

    // reset others so UI is never stale
    setFaoOverview(null);
    setFaoTop(null);
    setTrade(null);
    setProd(null);

    try {
      if (next === "prod-insights") {
        const url =
          `/api/faostat/production-insights?iso3=${encodeURIComponent(iso3)}` +
          `&top=${encodeURIComponent(String(prodTopN))}` +
          `&years=${encodeURIComponent(String(prodYears))}` +
          `&element=${encodeURIComponent(prodElement)}`;

        const raw = await fetchJsonOrThrow(url);
        const data = raw as any;

        if (data?.ok === false) {
          setFaoError(data?.error ?? "Production insights not available.");
          return;
        }

        setProd(data as ProductionInsights);
        return;
      }

      if (next === "trade-import" || next === "trade-export") {
        const kind = next === "trade-import" ? "import" : "export";
        const data = await faostatApi.tradeInsights(
          iso3,
          kind,
          tradeTopN,
          tradeYears,
        );

        if (!(data as any)?.ok) {
          setFaoError((data as any)?.error ?? "Trade insights not available.");
          return;
        }

        setTrade(data);
        return;
      }

      if (next === "overview") {
        const data = await faostatApi.overview(iso3);
        if ((data as any)?.error) {
          setFaoError((data as any).error);
          return;
        }
        setFaoOverview(data);
        return;
      }

      if (isTopKind(next)) {
        const data = await faostatApi.module(iso3, next, 10);

        const err =
          (data &&
            typeof (data as any).error === "string" &&
            (data as any).error) ||
          ((data as any)?.ok === false ? (data as any)?.error : null);

        if (err) {
          setFaoError(err);
          return;
        }

        setFaoTop(data as any);
        return;
      }

      setFaoError("Unknown module.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setFaoError(msg);
    } finally {
      setFaoLoading(false);
    }
  }

  // Auto-reload trade when params change
  useEffect(() => {
    if (tab !== "faostat") return;
    if (faoModule !== "trade-import" && faoModule !== "trade-export") return;
    loadFao(faoModule);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeTopN, tradeYears]);

  // Auto-reload production insights when params change
  useEffect(() => {
    if (tab !== "faostat") return;
    if (faoModule !== "prod-insights") return;
    loadFao("prod-insights");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prodTopN, prodYears, prodElement]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* ✅ Global UI polish for this page only */}
      <style jsx global>{`
        .country-shell {
          padding-top: 10px;
          padding-bottom: 16px;
        }
        /* ✅ pointer + hover hint for tables on this page */
        .country-shell table tbody tr {
          transition: background 120ms ease;
        }

        .country-shell table tbody tr:hover {
          cursor: pointer;
          background: rgba(99, 102, 241, 0.06);
        }
        /* Keep tabs compact, not full width */
        .tabs-tight > div[role="tablist"] {
          width: fit-content;
        }
      `}</style>

      <CountryHeader
        countryTitle={countryTitle}
        region={wdi?.region ?? "—"}
        indicatorLabel={indicatorLabelWithUnit}
        indicatorCode={indicatorCode}
        indicatorUnit={"—"} // avoid duplicate unit (we already append it)
        wdiError={wdi?.error ?? null}
        faoError={tab === "faostat" ? faoError : null}
        onBack={() => router.back()}
        onDebug={() =>
          downloadJson(`debug-${iso3}.json`, {
            iso3,
            indicator,
            wdi,
            faoModule,
            faoOverview,
            faoTop,
            trade,
            tradeTopN,
            tradeYears,
            prod,
            prodTopN,
            prodYears,
            prodElement,
          })
        }
      />

      <div className="country-shell mx-auto max-w-6xl px-3 sm:px-4">
        {/* ✅ “Nice colorful scheme” header strip + short descriptions */}
        <div className="mb-3 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-sky-500/10 to-emerald-500/10" />
            <div className="relative flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-widest text-slate-500">
                  COUNTRY DATA EXPLORER
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {countryTitle}
                  </div>
                  <span className="text-xs text-slate-500">•</span>
                  <div className="text-xs text-slate-600">
                    {indicatorLabelWithUnit}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-700">
                  WDI
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-700">
                  FAOSTAT
                </span>
              </div>
            </div>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "wdi" | "faostat")}
          className="tabs-tight"
        >
          {/* ✅ compact, nicer tabs */}
          <TabsList className="mb-2 w-fit rounded-xl border bg-white shadow-sm">
            <TabsTrigger value="wdi" className="rounded-lg">
              WDI
            </TabsTrigger>
            <TabsTrigger value="faostat" className="rounded-lg">
              FAOSTAT
            </TabsTrigger>
          </TabsList>

          {/* ✅ short descriptions per tab */}
          <TabsContent value="wdi" className="space-y-3">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  World Development Indicators (WDI)
                </div>
                <div className="text-xs text-slate-500">
                  Official World Bank time-series — great for population, GDP,
                  life expectancy, etc.
                </div>
              </div>
              <div className="mt-2 h-1 w-full rounded-full bg-gradient-to-r from-indigo-600/30 via-sky-500/30 to-emerald-500/30" />
            </div>

            <WdiTab
              iso3={iso3}
              indicator={indicator}
              wdi={wdi}
              loading={wdiLoading}
            />
          </TabsContent>

          <TabsContent value="faostat" className="space-y-3">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  FAOSTAT (Food & Agriculture)
                </div>
                <div className="text-xs text-slate-500">
                  Production, trade, and food-balance insights — compare
                  imports, exports, and top commodities.
                </div>
              </div>
              <div className="mt-2 h-1 w-full rounded-full bg-gradient-to-r from-emerald-600/30 via-lime-500/25 to-amber-500/25" />
            </div>

            <FaostatTab
              iso3={iso3}
              faoModule={faoModule}
              onPickModule={loadFao}
              loading={faoLoading}
              overview={faoOverview}
              top={faoTop}
              trade={trade}
              tradeTopN={tradeTopN}
              tradeYears={tradeYears}
              setTradeTopN={setTradeTopN}
              setTradeYears={setTradeYears}
              // Production Insights wiring
              prod={prod}
              prodTopN={prodTopN}
              prodYears={prodYears}
              prodElement={prodElement}
              setProdTopN={setProdTopN}
              setProdYears={setProdYears}
              setProdElement={setProdElement}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
