"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Globe2,
  Leaf,
  RefreshCw,
  X,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type WikiCard = {
  label: string;
  title: string;
  description: string | null;
  extract: string;
  url: string | null;
  image: string | null;
  wikibase_item: string | null;
  source: "Wikipedia";
};

type LinkItem = {
  label: string;
  url: string;
};

type EnrichmentPayload = {
  ok: boolean;
  iso3: string;
  country: string;
  official_name?: string;
  facts?: {
    region?: string | null;
    subregion?: string | null;
    capital?: string | null;
    population?: number | null;
    area_km2?: number | null;
    continents?: string[];
    flag?: string | null;
    flag_alt?: string | null;
    map?: string | null;
  } | null;
  cards?: WikiCard[];
  links?: LinkItem[];
  error?: string;
};

function stripHtml(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function fmtNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";

  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function compactText(value: unknown, max = 180) {
  const s = stripHtml(value);
  if (!s) return "No summary available.";
  if (s.length <= max) return s;
  return `${s.slice(0, max).trim()}…`;
}

function factValue(value: unknown) {
  const s = stripHtml(value);
  return s || "—";
}

function isRealFactValue(value: unknown) {
  const s = stripHtml(value);
  if (!s) return false;
  if (s === "—" || s === "-") return false;
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return false;
  if (s === "0" || s === "0 km²") return false;
  return true;
}

function DetailModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: EnrichmentPayload | null;
}) {
  if (!open) return null;

  const cards = Array.isArray(data?.cards) ? data!.cards! : [];
  const links = Array.isArray(data?.links) ? data!.links! : [];
  const f = data?.facts;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              External Encyclopedia Context
            </div>
            <div className="mt-1 text-xl font-black text-slate-950">
              {stripHtml(data?.country) || data?.iso3}
              <span className="ml-2 text-sm font-bold text-slate-500">
                {data?.iso3}
              </span>
            </div>
            {data?.official_name && data.official_name !== data.country ? (
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Official name: {stripHtml(data.official_name)}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-86px)] overflow-y-auto p-5">
          {(() => {
            const modalFacts = [
              {
                label: "Region",
                value: [f?.region, f?.subregion].filter(Boolean).join(" / "),
              },
              {
                label: "Capital",
                value: factValue(f?.capital),
              },
              {
                label: "Population",
                value: fmtNumber(f?.population),
              },
              {
                label: "Area",
                value:
                  fmtNumber(f?.area_km2) === "—"
                    ? "—"
                    : `${fmtNumber(f?.area_km2)} km²`,
              },
            ].filter((fact) => isRealFactValue(fact.value));

            if (!modalFacts.length) return null;

            return (
              <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {modalFacts.map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {fact.label}
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">
                      {fact.value}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {cards.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {cards.map((card) => (
                <div
                  key={`${card.label}-${card.title}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                      {stripHtml(card.label)}
                    </div>

                    <div className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {card.source}
                    </div>
                  </div>

                  <div className="mt-3 text-base font-black leading-6 text-slate-950">
                    {stripHtml(card.title)}
                  </div>

                  {card.description ? (
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {stripHtml(card.description)}
                    </div>
                  ) : null}

                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {stripHtml(card.extract)}
                  </p>

                  {card.url ? (
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center text-xs font-black text-emerald-700 hover:text-emerald-900"
                    >
                      Open source
                      <ExternalLink className="ml-1.5 h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              No encyclopedia summaries were found for this country.
            </div>
          )}

          {links.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  {link.label}
                  <ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function FaostatExternalEnrichment({ iso3 }: { iso3: string }) {
  const cleanIso3 = String(iso3 || "").toUpperCase();

  const [data, setData] = useState<EnrichmentPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!cleanIso3) return;

      setLoading(true);

      try {
        const res = await fetch(
          `/api/faostat/enrichment?iso3=${encodeURIComponent(cleanIso3)}`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );

        const json = (await res.json()) as EnrichmentPayload;

        if (!alive) return;
        setData(json);
      } catch (e: any) {
        if (!alive) return;
        setData({
          ok: false,
          iso3: cleanIso3,
          country: cleanIso3,
          error: e?.message || "Failed to load enrichment.",
          cards: [],
          links: [],
        });
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [cleanIso3, reloadKey]);

  const cards = Array.isArray(data?.cards) ? data!.cards! : [];
  const countryCard = cards.find((x) =>
    stripHtml(x.label).toLowerCase().includes("country"),
  );
  const agricultureCard = cards.find((x) =>
    stripHtml(x.label).toLowerCase().includes("agriculture"),
  );
  const economyCard = cards.find((x) =>
    stripHtml(x.label).toLowerCase().includes("economy"),
  );

  const summary = agricultureCard || countryCard || economyCard || cards[0];

  const facts = useMemo(() => {
    const f = data?.facts;

    const rawFacts = [
      {
        label: "Region",
        value: [f?.region, f?.subregion].filter(Boolean).join(" / "),
      },
      {
        label: "Capital",
        value: factValue(f?.capital),
      },
      {
        label: "Population",
        value: fmtNumber(f?.population),
      },
      {
        label: "Area",
        value:
          fmtNumber(f?.area_km2) === "—"
            ? "—"
            : `${fmtNumber(f?.area_km2)} km²`,
      },
    ];

    return rawFacts.filter((fact) => isRealFactValue(fact.value));
  }, [data]);

  return (
    <>
      <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Leaf className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-black text-slate-950">
                  External Encyclopedia Context
                </div>
                <div className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                  Compact View
                </div>
              </div>

              <div className="mt-1 text-xs font-semibold text-slate-500">
                Wikipedia + country metadata enrichment for FAOSTAT country view
              </div>

              <div className="mt-2 text-sm leading-6 text-slate-700">
                {loading
                  ? "Loading external context..."
                  : data?.error
                    ? data.error
                    : compactText(summary?.extract, 260)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {fact.label}
                </div>
                <div className="mt-0.5 max-w-[160px] truncate text-xs font-extrabold text-slate-900">
                  {fact.value}
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setReloadKey((x) => x + 1)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload
            </Button>

            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={loading || Boolean(data?.error)}
              onClick={() => setModalOpen(true)}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Details
            </Button>
          </div>
        </div>
      </div>

      <DetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
      />
    </>
  );
}

