// ✅ DROP-IN FIX — app/world/country/[iso3]/page.tsx
// Fixes: `RovingFocusGroupItem` must be used within `RovingFocusGroup`
// Cause: your shadcn Tabs wrapper likely expects a Radix TabsRoot context,
// but your current "@/components/ui/tabs" is mismatched / broken.
// Solution: use Radix Tabs directly (stable), styled to look like shadcn.
//
// Paste this whole file (drop-in).

"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
  if (!res.ok)
    throw new Error(`Fetch failed: ${res.status} ${txt.slice(0, 200)}`);
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

/* ---------------- page ---------------- */

export default function CountryProfilePage() {
  const search = useSearchParams();
  const { iso3: rawIso3 } = useParams<{ iso3?: string }>();

  const iso3 = String(rawIso3 ?? "").toUpperCase();
  const indicator = (search.get("indicator") || "SP.POP.TOTL").trim();

  const [tab, setTab] = useState<"wdi" | "faostat" | "weo">("wdi");

  /* ---------------- WDI ---------------- */
  const [wdi, setWdi] = useState<WdiResponse | null>(null);
  const [wdiLoading, setWdiLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setWdiLoading(true);
      try {
        const raw = await fetchJsonOrThrow(
          `/api/wdi/country?iso3=${encodeURIComponent(
            iso3,
          )}&indicator=${encodeURIComponent(indicator)}`,
        );
        if (!alive) return;
        setWdi(parseWdiResponse(raw, iso3, indicator));
      } catch (e: any) {
        if (!alive) return;
        setWdi({
          iso3,
          country: iso3,
          region: null,
          indicator: { code: indicator, label: indicator, unit: null },
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
  }, [iso3, indicator]);

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
        // If your FaostatTab is the one doing /api/faostat/production-insights internally,
        // you can leave this empty. Keeping placeholder for future.
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

  /* ---------------- UI (Radix tabs, no roving focus crash) ---------------- */
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <RTabs.Root value={tab} onValueChange={(v) => setTab(v as any)}>
        {/* tabs header */}
        <RTabs.List className="mb-3 inline-flex flex-wrap gap-1 rounded-xl border bg-white p-1 shadow-sm">
          <RTabs.Trigger
            value="wdi"
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition",
              "data-[state=active]:bg-slate-900 data-[state=active]:text-white",
              "data-[state=inactive]:text-slate-700 hover:bg-slate-50",
            )}
          >
            WDI
          </RTabs.Trigger>

          <RTabs.Trigger
            value="faostat"
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition",
              "data-[state=active]:bg-slate-900 data-[state=active]:text-white",
              "data-[state=inactive]:text-slate-700 hover:bg-slate-50",
            )}
          >
            FAOSTAT
          </RTabs.Trigger>

          <RTabs.Trigger
            value="weo"
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition",
              "data-[state=active]:bg-slate-900 data-[state=active]:text-white",
              "data-[state=inactive]:text-slate-700 hover:bg-slate-50",
            )}
          >
            IMF (WEO)
          </RTabs.Trigger>
        </RTabs.List>

        {/* content */}
        <RTabs.Content value="wdi" className="space-y-2">
          <WdiTab
            iso3={iso3}
            indicator={indicator}
            wdi={wdi}
            loading={wdiLoading}
          />
        </RTabs.Content>

        <RTabs.Content value="faostat" className="space-y-2">
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
        </RTabs.Content>

        <RTabs.Content value="weo" className="space-y-2">
          <WeoTab iso3={iso3} />
        </RTabs.Content>
      </RTabs.Root>
    </div>
  );
}
