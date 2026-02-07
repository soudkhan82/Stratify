"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Database,
  CalendarDays,
  Layers,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

type MetaResp = {
  ok: boolean;
  dataset: "production" | "land_inputs" | "nutrients";
  rows: number;
  areas: number;
  items: number;
  elements: number;
  units: number;
  min_year: number;
  max_year: number;
  updated_at?: string;
  error?: string;
};

const DATASETS: Array<{
  key: MetaResp["dataset"];
  title: string;
  subtitle: string;
  pill: string;
}> = [
  {
    key: "production",
    title: "FAOSTAT Production",
    subtitle: "Crops & livestock production, yields, area harvested, etc.",
    pill: "Production",
  },
  {
    key: "land_inputs",
    title: "FAOSTAT Land & Inputs",
    subtitle: "Land use and inputs series (fertilizers/land related metrics).",
    pill: "Land/Inputs",
  },
  {
    key: "nutrients",
    title: "FAOSTAT Nutrients",
    subtitle: "Nutrient supply indicators (limited item set, high coverage).",
    pill: "Nutrients",
  },
];

function fmtInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
}

function glowClass(dataset: MetaResp["dataset"]) {
  // subtle differences only (keeps your neon theme)
  if (dataset === "production")
    return "from-emerald-500/10 via-sky-500/10 to-indigo-500/10";
  if (dataset === "land_inputs")
    return "from-cyan-500/10 via-blue-500/10 to-indigo-500/10";
  return "from-fuchsia-500/10 via-sky-500/10 to-indigo-500/10";
}

export default function FaostatOverviewPage() {
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<Record<string, MetaResp | null>>({});

  async function load() {
    setLoading(true);
    try {
      const results = await Promise.all(
        DATASETS.map(async (d) => {
          const r = await fetch(
            `/api/faostat/datasets/meta?dataset=${encodeURIComponent(d.key)}`,
            {
              cache: "no-store",
            },
          );
          const j = (await r.json()) as MetaResp;
          return [d.key, j] as const;
        }),
      );
      const next: Record<string, MetaResp> = {};
      for (const [k, v] of results) next[k] = v;
      setMeta(next);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => {
    return DATASETS.map((d) => {
      const m = meta[d.key] ?? null;
      const ok = Boolean(m?.ok);

      return (
        <Card
          key={d.key}
          className="relative overflow-hidden border-white/10 bg-[#070A12]/70 backdrop-blur-xl"
        >
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${glowClass(
              d.key,
            )}`}
          />
          <CardHeader className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-white/90">{d.title}</CardTitle>
                <p className="mt-1 text-sm text-white/60">{d.subtitle}</p>
              </div>

              <Badge className="border-white/10 bg-white/5 text-white/80">
                {d.pill}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="relative">
            {!m ? (
              <div className="text-sm text-white/60">Loading…</div>
            ) : !ok ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <div className="font-medium">Meta unavailable</div>
                <div className="mt-1 break-words opacity-90">
                  {m.error || "Unknown error"}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Database className="h-4 w-4" />
                      Rows
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white/90">
                      {fmtInt(m.rows)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Layers className="h-4 w-4" />
                      Coverage
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white/90">
                      {fmtInt(m.areas)}{" "}
                      <span className="text-sm font-medium text-white/60">
                        areas
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <CalendarDays className="h-4 w-4" />
                      Years
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white/90">
                      {m.min_year}–{m.max_year}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/60">Items</div>
                    <div className="mt-1 text-lg font-semibold text-white/90">
                      {fmtInt(m.items)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/60">Elements</div>
                    <div className="mt-1 text-lg font-semibold text-white/90">
                      {fmtInt(m.elements)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/60">Units</div>
                    <div className="mt-1 text-lg font-semibold text-white/90">
                      {fmtInt(m.units)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-white/50">
                    Updated:{" "}
                    <span className="text-white/70">
                      {m.updated_at
                        ? new Date(m.updated_at).toLocaleString()
                        : "—"}
                    </span>
                  </div>

                  <Link
                    href={`/faostat/explore?dataset=${encodeURIComponent(d.key)}`}
                  >
                    <Button className="bg-white/10 text-white hover:bg-white/15">
                      Explore <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      );
    });
  }, [meta]);

  return (
    <div className="min-h-screen bg-[#070A12]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white/90">FAOSTAT</h1>
            <p className="mt-1 text-sm text-white/60">
              Dataset coverage and quick entry points. (Fast cached meta.)
            </p>
          </div>

          <Button
            onClick={load}
            disabled={loading}
            className="bg-white/10 text-white hover:bg-white/15"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          Tip: For country charts we’ll use **ISO3 → FAO area code → valid
          item+element pairs** to guarantee charts always show data.
        </div>
      </div>
    </div>
  );
}
