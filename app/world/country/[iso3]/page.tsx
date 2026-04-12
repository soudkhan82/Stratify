"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as RTabs from "@radix-ui/react-tabs";

import { faostatApi } from "@/app/lib/rpc/faostat";
import type {
  OverviewPayload,
  TopPayload,
  TradeInsights,
} from "@/app/lib/rpc/faostat";

import WdiTab, {
  type WdiResponse,
  parseWdiResponse,
} from "@/app/world/components/WdiTab";

import FaostatTab, {
  type FaoModule,
  isTopKind,
} from "@/app/world/components/FaostatTab";

import type { ProductionInsights } from "@/app/world/components/FaostatTab";
import WeoTab from "@/app/world/components/WeoTab";

/* ---------------- helper ---------------- */

async function fetchJsonOrThrow(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${txt.slice(0, 200)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error(
      `Expected JSON got ${ct || "unknown"} — ${txt.slice(0, 200)}`,
    );
  }

  return JSON.parse(txt);
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function LoaderCard({ label }: { label: string }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="flex min-w-[240px] flex-col items-center rounded-3xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-900" />
        <div className="text-base font-semibold text-slate-900">
          Loading {label}...
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Please wait while data is being fetched
        </div>
      </div>
    </div>
  );
}

/* ---------------- quick picks ---------------- */

type QuickPick = {
  label: string;
  indicator: string;
};

const WDI_QUICK_PICKS: QuickPick[] = [
  { label: "Population, total", indicator: "SP.POP.TOTL" },
  { label: "GDP current US$", indicator: "NY.GDP.MKTP.CD" },
  { label: "GDP growth annual %", indicator: "NY.GDP.MKTP.KD.ZG" },
  { label: "Inflation, consumer prices", indicator: "FP.CPI.TOTL.ZG" },
  { label: "Unemployment, total %", indicator: "SL.UEM.TOTL.ZS" },
  { label: "Exports of goods and services % GDP", indicator: "NE.EXP.GNFS.ZS" },
  { label: "Imports of goods and services % GDP", indicator: "NE.IMP.GNFS.ZS" },
  { label: "Life expectancy at birth", indicator: "SP.DYN.LE00.IN" },
];

const WEO_QUICK_PICKS: QuickPick[] = [
  { label: "GDP, current prices", indicator: "NGDPD" },
  { label: "GDP growth", indicator: "NGDP_RPCH" },
  { label: "Inflation, average consumer prices", indicator: "PCPIPCH" },
  { label: "Unemployment rate", indicator: "LUR" },
  { label: "Current account balance", indicator: "BCA" },
  {
    label: "General government net lending/borrowing",
    indicator: "GGXONLB_NGDP",
  },
  { label: "Gross national savings", indicator: "NGSD_NGDP" },
  { label: "Investment", indicator: "NID_NGDP" },
];

const WEO_ALL_INDICATORS: QuickPick[] = [
  { label: "GDP growth", indicator: "NGDP_RPCH" },
  { label: "GDP, current prices", indicator: "NGDPD" },
  { label: "GDP, constant prices", indicator: "NGDP_R" },
  { label: "GDP per capita, current prices", indicator: "NGDPDPC" },
  { label: "GDP, PPP", indicator: "PPPGDP" },
  { label: "GDP per capita, PPP", indicator: "PPPPC" },
  { label: "Population", indicator: "LP" },
  { label: "Unemployment rate", indicator: "LUR" },
  { label: "Employment", indicator: "LE" },
  { label: "Inflation, average consumer prices", indicator: "PCPIPCH" },
  { label: "Inflation, end of period consumer prices", indicator: "PCPIEPCH" },
  {
    label: "Imports of goods and services, volume growth",
    indicator: "TM_RPCH",
  },
  {
    label: "Exports of goods and services, volume growth",
    indicator: "TX_RPCH",
  },
  { label: "Imports of goods, volume growth", indicator: "TMG_RPCH" },
  { label: "Exports of goods, volume growth", indicator: "TXG_RPCH" },
  { label: "Current account balance", indicator: "BCA" },
  { label: "Current account balance, percent of GDP", indicator: "BCA_NGDPD" },
  { label: "General government total expenditure", indicator: "GGX" },
  { label: "General government revenue", indicator: "GGR" },
  { label: "Net lending/borrowing", indicator: "GGXCNL" },
  { label: "Overall net lending/borrowing", indicator: "GGXONLB" },
  {
    label: "Overall net lending/borrowing, percent of GDP",
    indicator: "GGXONLB_NGDP",
  },
  { label: "Gross debt", indicator: "GGXWDN" },
  { label: "Gross debt, percent of GDP", indicator: "GGXWDN_NGDP" },
  { label: "Net debt", indicator: "GGXWDG" },
  { label: "Net debt, percent of GDP", indicator: "GGXWDG_NGDP" },
  { label: "National savings, percent of GDP", indicator: "NGSD_NGDP" },
  { label: "Investment, percent of GDP", indicator: "NID_NGDP" },
  { label: "Unemployment rate, percent", indicator: "LUR_PT" },
  { label: "PPP exchange rate", indicator: "PPPEX" },
  { label: "Fiscal year GDP", indicator: "NGDP_FY" },
  {
    label: "Inflation excl. food and energy",
    indicator: "PCPIFBT",
  },
  { label: "Consumer prices index", indicator: "PCPI" },
  { label: "Revenue, percent of GDP", indicator: "GGR_NGDP" },
  { label: "Expenditure, percent of GDP", indicator: "GGX_NGDP" },
  { label: "Net lending/borrowing, percent of GDP", indicator: "GGXCNL_NGDP" },
  { label: "Exports of goods, USD", indicator: "TXG_FOB_USD" },
  { label: "Imports of goods, USD", indicator: "TMG_CIF_USD" },
  { label: "Exports of goods and services, BOP", indicator: "TXGSBOP" },
  { label: "Imports of goods and services, BOP", indicator: "TMGSBOP" },
  { label: "Exports of goods", indicator: "TXG" },
  { label: "Imports of goods", indicator: "TMG" },
  { label: "Government cash balance", indicator: "GGCB" },
  { label: "Government structural balance", indicator: "GGSB" },
  { label: "Real GDP per capita, PPP", indicator: "NGDPRPPPPC" },
  { label: "Share of world GDP at PPP", indicator: "PPPSH" },
  { label: "GDP, current prices, USD", indicator: "NGDPDUS" },
  { label: "Nominal GDP level", indicator: "LNNGDP" },
];

const WEO_VALID_CODES = new Set(
  [...WEO_QUICK_PICKS, ...WEO_ALL_INDICATORS].map((x) =>
    x.indicator.toUpperCase(),
  ),
);

const DEFAULT_WDI_INDICATOR = "SP.POP.TOTL";
const DEFAULT_WEO_INDICATOR = "NGDPD";

/* ---------------- page ---------------- */

export default function CountryProfilePage() {
  const router = useRouter();
  const search = useSearchParams();
  const { iso3: rawIso3 } = useParams<{ iso3?: string }>();

  const iso3 = String(rawIso3 ?? "").toUpperCase();

  const initialTab = (search.get("dataset") || "wdi").toLowerCase();
  const safeInitialTab =
    initialTab === "faostat" || initialTab === "weo" ? initialTab : "wdi";

  const rawIndicator = (search.get("indicator") || "").trim();

  const normalizedIndicator = useMemo(() => {
    if (safeInitialTab === "weo") {
      const candidate = rawIndicator.toUpperCase();
      return WEO_VALID_CODES.has(candidate) ? candidate : DEFAULT_WEO_INDICATOR;
    }

    return rawIndicator || DEFAULT_WDI_INDICATOR;
  }, [rawIndicator, safeInitialTab]);

  const [tab, setTab] = useState<"wdi" | "faostat" | "weo">(
    safeInitialTab as "wdi" | "faostat" | "weo",
  );

  const [sidebarSearch, setSidebarSearch] = useState("");
  const [tabSwitchLoading, setTabSwitchLoading] = useState(false);

  /* ---------------- WDI ---------------- */

  const [wdi, setWdi] = useState<WdiResponse | null>(null);
  const [wdiLoading, setWdiLoading] = useState(false);

  useEffect(() => {
    if (tab !== "wdi") return;

    let alive = true;

    (async () => {
      setWdiLoading(true);
      try {
        const raw = await fetchJsonOrThrow(
          `/api/wdi/country?iso3=${encodeURIComponent(
            iso3,
          )}&indicator=${encodeURIComponent(normalizedIndicator)}`,
        );

        if (!alive) return;
        setWdi(parseWdiResponse(raw, iso3, normalizedIndicator));
      } catch (e: any) {
        if (!alive) return;
        setWdi({
          iso3,
          country: iso3,
          region: null,
          indicator: {
            code: normalizedIndicator,
            label: normalizedIndicator,
            unit: null,
          },
          latest: null,
          series: [],
          error: e?.message ?? "Failed to load WDI",
        });
      } finally {
        if (alive) setWdiLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [iso3, normalizedIndicator, tab]);

  /* ---------------- FAOSTAT ---------------- */

  const [faoModule, setFaoModule] = useState<FaoModule>("");
  const [faoLoading, setFaoLoading] = useState(false);

  const [tradeTopN, setTradeTopN] = useState(10);
  const [tradeYears, setTradeYears] = useState(10);

  const [faoOverview, setFaoOverview] = useState<OverviewPayload | null>(null);
  const [faoTop, setFaoTop] = useState<TopPayload | null>(null);
  const [trade, setTrade] = useState<TradeInsights | null>(null);
  const [prod, setProd] = useState<ProductionInsights | null>(null);

  async function loadFao(next: FaoModule) {
    setFaoModule(next);
    setFaoLoading(true);

    setFaoOverview(null);
    setFaoTop(null);
    setTrade(null);
    setProd(null);

    try {
      if (next === "overview") {
        setFaoOverview(await faostatApi.overview(iso3));
        return;
      }

      if (next === "trade-import" || next === "trade-export") {
        const kind = next === "trade-import" ? "import" : "export";
        setTrade(
          await faostatApi.tradeInsights(iso3, kind, tradeTopN, tradeYears),
        );
        return;
      }

      if (next === "prod-insights") {
        return;
      }

      if (isTopKind(next)) {
        setFaoTop(await faostatApi.module(iso3, next, 10));
        return;
      }
    } finally {
      setFaoLoading(false);
    }
  }

  /* ---------------- url sync ---------------- */

  useEffect(() => {
    const params = new URLSearchParams(search.toString());

    let changed = false;

    if (params.get("dataset") !== tab) {
      params.set("dataset", tab);
      changed = true;
    }

    if (tab === "weo") {
      const current = String(params.get("indicator") || "").toUpperCase();
      const next = WEO_VALID_CODES.has(current)
        ? current
        : DEFAULT_WEO_INDICATOR;

      if (params.get("indicator") !== next) {
        params.set("indicator", next);
        changed = true;
      }
    }

    if (tab === "wdi") {
      const current = String(params.get("indicator") || "").trim();
      const next = current || DEFAULT_WDI_INDICATOR;

      if (params.get("indicator") !== next) {
        params.set("indicator", next);
        changed = true;
      }
    }

    if (!changed) return;

    router.replace(`/world/country/${iso3}?${params.toString()}`, {
      scroll: false,
    });
  }, [tab, router, search, iso3]);

  function updateIndicator(nextIndicator: string) {
    const params = new URLSearchParams(search.toString());
    params.set("indicator", nextIndicator);
    params.set("dataset", tab);
    router.replace(`/world/country/${iso3}?${params.toString()}`, {
      scroll: false,
    });
  }

  function handleTabChange(nextTab: string) {
    const next = nextTab as "wdi" | "faostat" | "weo";

    setTabSwitchLoading(true);
    setTab(next);
    setSidebarSearch("");

    const params = new URLSearchParams(search.toString());
    params.set("dataset", next);

    if (next === "weo") {
      const current = String(params.get("indicator") || "").toUpperCase();
      if (!WEO_VALID_CODES.has(current)) {
        params.set("indicator", DEFAULT_WEO_INDICATOR);
      }
    }

    if (next === "wdi") {
      const current = String(params.get("indicator") || "").trim();
      if (!current || WEO_VALID_CODES.has(current.toUpperCase())) {
        params.set("indicator", DEFAULT_WDI_INDICATOR);
      }
    }

    router.replace(`/world/country/${iso3}?${params.toString()}`, {
      scroll: false,
    });

    window.clearTimeout((handleTabChange as any)._timer);
    (handleTabChange as any)._timer = window.setTimeout(() => {
      setTabSwitchLoading(false);
    }, 350);
  }

  /* ---------------- sidebar data ---------------- */

  const filteredQuickPicks = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();

    if (tab === "weo") {
      if (!q) return WEO_QUICK_PICKS;
      return WEO_QUICK_PICKS.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.indicator.toLowerCase().includes(q),
      );
    }

    if (tab === "faostat") return [];

    if (!q) return WDI_QUICK_PICKS;
    return WDI_QUICK_PICKS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.indicator.toLowerCase().includes(q),
    );
  }, [sidebarSearch, tab]);

  const filteredWeoAllIndicators = useMemo(() => {
    if (tab !== "weo") return [];

    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return WEO_ALL_INDICATORS;

    return WEO_ALL_INDICATORS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.indicator.toLowerCase().includes(q),
    );
  }, [sidebarSearch, tab]);

  const activeIndicatorLabel = useMemo(() => {
    const found =
      WDI_QUICK_PICKS.find((x) => x.indicator === normalizedIndicator)?.label ||
      WEO_QUICK_PICKS.find((x) => x.indicator === normalizedIndicator)?.label ||
      WEO_ALL_INDICATORS.find((x) => x.indicator === normalizedIndicator)
        ?.label;

    return found || normalizedIndicator;
  }, [normalizedIndicator]);

  /* ---------------- ui ---------------- */

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#eef2ff_40%,_#f8fafc_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-5">
        {/* subnav */}
        <div className="mb-5 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 p-2 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur">
          <RTabs.Root value={tab} onValueChange={handleTabChange}>
            <RTabs.List className="flex w-full flex-wrap gap-2">
              <RTabs.Trigger
                value="wdi"
                className={cx(
                  "rounded-2xl px-5 py-3 text-sm font-semibold outline-none transition-all duration-200",
                  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-950 data-[state=active]:to-slate-800 data-[state=active]:text-white data-[state=active]:shadow-lg",
                  "data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600",
                  "border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                WDI
              </RTabs.Trigger>

              <RTabs.Trigger
                value="faostat"
                className={cx(
                  "rounded-2xl px-5 py-3 text-sm font-semibold outline-none transition-all duration-200",
                  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-700 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg",
                  "data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600",
                  "border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                Food &amp; Agriculture Org
              </RTabs.Trigger>

              <RTabs.Trigger
                value="weo"
                className={cx(
                  "rounded-2xl px-5 py-3 text-sm font-semibold outline-none transition-all duration-200",
                  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-700 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg",
                  "data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600",
                  "border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                IMF (WEO)
              </RTabs.Trigger>
            </RTabs.List>
          </RTabs.Root>
        </div>

        {/* body */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* left sidebar */}
          <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-48px)]">
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="border-b border-slate-200 px-5 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Control Panel
                </div>
                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  Indicators
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {tab === "weo"
                    ? "Search, select and jump between IMF WEO quick picks and full indicator list."
                    : "Search, select and jump between quick picks."}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {tab === "faostat" ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <div className="text-sm font-semibold text-emerald-900">
                      Food &amp; Agriculture Org
                    </div>
                    <p className="mt-2 text-sm leading-6 text-emerald-800/90">
                      FAO modules are loaded from the main content area. Use the
                      FAO cards and module selectors on the right to explore
                      overview, trade, and production insights.
                    </p>
                  </div>
                ) : (
                  <>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Indicator search
                    </label>

                    <div className="relative mb-4">
                      <input
                        value={sidebarSearch}
                        onChange={(e) => setSidebarSearch(e.target.value)}
                        placeholder="Search code / name..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </div>

                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Active indicator
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {activeIndicatorLabel}
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-500">
                        {normalizedIndicator}
                      </div>
                    </div>

                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">
                        Quick picks
                      </div>
                      <div className="text-xs text-slate-500">
                        {filteredQuickPicks.length} items
                      </div>
                    </div>

                    <div className="space-y-2">
                      {filteredQuickPicks.map((item) => {
                        const active = item.indicator === normalizedIndicator;
                        return (
                          <button
                            key={`${tab}-quick-${item.indicator}`}
                            onClick={() => updateIndicator(item.indicator)}
                            className={cx(
                              "group w-full rounded-2xl border px-4 py-3 text-left transition-all",
                              active
                                ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                                : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm",
                            )}
                          >
                            <div className="line-clamp-2 text-sm font-semibold">
                              {item.label}
                            </div>
                            <div
                              className={cx(
                                "mt-1 text-xs",
                                active
                                  ? "text-slate-300"
                                  : "text-slate-500 group-hover:text-slate-600",
                              )}
                            >
                              {item.indicator}
                            </div>
                          </button>
                        );
                      })}

                      {filteredQuickPicks.length === 0 && tab !== "weo" && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                          No indicators matched your search.
                        </div>
                      )}
                    </div>

                    {tab === "weo" && (
                      <>
                        <div className="mb-3 mt-6 flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800">
                            All IMF indicators
                          </div>
                          <div className="text-xs text-slate-500">
                            {filteredWeoAllIndicators.length} items
                          </div>
                        </div>

                        <div className="space-y-2">
                          {filteredWeoAllIndicators.map((item) => {
                            const active =
                              item.indicator === normalizedIndicator;
                            return (
                              <button
                                key={`weo-all-${item.indicator}`}
                                onClick={() => updateIndicator(item.indicator)}
                                className={cx(
                                  "group w-full rounded-2xl border px-4 py-3 text-left transition-all",
                                  active
                                    ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
                                    : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm",
                                )}
                              >
                                <div className="line-clamp-2 text-sm font-semibold">
                                  {item.label}
                                </div>
                                <div
                                  className={cx(
                                    "mt-1 text-xs",
                                    active
                                      ? "text-indigo-100"
                                      : "text-slate-500 group-hover:text-slate-600",
                                  )}
                                >
                                  {item.indicator}
                                </div>
                              </button>
                            );
                          })}

                          {filteredWeoAllIndicators.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                              No IMF indicators matched your search.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* right content */}
          <section className="min-w-0">
            <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
              {tabSwitchLoading && <LoaderCard label="dataset" />}

              {!tabSwitchLoading && tab === "wdi" && (
                <WdiTab
                  iso3={iso3}
                  indicator={normalizedIndicator}
                  wdi={wdi}
                  loading={wdiLoading}
                />
              )}

              {!tabSwitchLoading && tab === "faostat" && (
                <>
                  {faoLoading ? (
                    <LoaderCard label="Food & Agriculture Org data" />
                  ) : (
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
                      prod={prod}
                    />
                  )}
                </>
              )}

              {!tabSwitchLoading && tab === "weo" && (
                <WeoTab iso3={iso3} initialIndicator={normalizedIndicator} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
