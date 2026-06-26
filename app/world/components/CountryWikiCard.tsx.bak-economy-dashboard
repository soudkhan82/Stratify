"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  ExternalLink,
  Globe2,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type WikiFact = {
  group?: string | null;
  label?: string | null;
  value?: string | null;
};

type WikiSection = {
  title?: string;
  paragraphs?: string[];
};

type EconomyPayload = {
  ok?: boolean;
  title?: string;
  displayTitle?: string;
  description?: string;
  extract?: string;
  pageUrl?: string | null;
  thumbnailUrl?: string | null;
  facts?: WikiFact[];
  highlights?: WikiFact[];
  sections?: WikiSection[];
  error?: string;
};

type WikiPayload = {
  ok?: boolean;
  iso3?: string;
  country?: string;
  title?: string;
  displayTitle?: string;
  description?: string;
  extract?: string;
  pageUrl?: string | null;
  thumbnailUrl?: string | null;
  facts?: WikiFact[];
  highlights?: WikiFact[];
  demographics?: {
    title?: string;
    paragraphs?: string[];
  } | null;
  economics?: EconomyPayload | null;
  source?: string;
  license?: string;
  fetchedAt?: string;
  error?: string;
};

type Props = {
  iso3: string;
  countryName?: string | null;
  region?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(value: unknown, limit = 480) {
  const text = cleanText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

function normalizeFacts(facts: WikiFact[] | undefined | null): WikiFact[] {
  return (facts || [])
    .map((fact) => ({
      group: cleanText(fact.group || "General") || "General",
      label: cleanText(fact.label),
      value: cleanText(fact.value),
    }))
    .filter((fact) => fact.label && fact.value);
}

function groupFacts(facts: WikiFact[]) {
  const map = new Map<string, WikiFact[]>();

  for (const fact of facts) {
    const group = cleanText(fact.group || "General") || "General";
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(fact);
  }

  return Array.from(map.entries()).map(([group, rows]) => ({
    group,
    rows,
  }));
}

function formatFetchedAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function FactGrid({ facts, max = 6 }: { facts: WikiFact[]; max?: number }) {
  if (!facts.length) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {facts.slice(0, max).map((fact, index) => (
        <div
          key={`${fact.label}-${index}`}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            {fact.label}
          </div>
          <div className="mt-1 text-xs font-bold leading-5 text-slate-800">
            {shortText(fact.value, 110)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FactsTable({
  groups,
}: {
  groups: { group: string; rows: WikiFact[] }[];
}) {
  if (!groups.length) return null;

  return (
    <>
      {groups.map((group) => (
        <section
          key={group.group}
          className="rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4"
        >
          <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
            {group.group}
          </h4>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {group.rows.map((fact, index) => (
                  <tr
                    key={`${group.group}-${fact.label}-${index}`}
                    className="border-t first:border-t-0"
                  >
                    <td className="w-[34%] bg-slate-50 px-3 py-2.5 align-top text-xs font-black uppercase tracking-wide text-slate-500">
                      {fact.label}
                    </td>
                    <td className="px-3 py-2.5 align-top text-sm font-semibold leading-6 text-slate-800">
                      {fact.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}

export default function CountryWikiCard({ iso3, countryName, region }: Props) {
  const [payload, setPayload] = useState<WikiPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const normalizedIso3 = cleanText(iso3).toUpperCase();
    if (!normalizedIso3) return;

    const controller = new AbortController();

    async function loadWikiProfile() {
      try {
        setLoading(true);
        setPayload(null);

        const qs = new URLSearchParams();
        qs.set("iso3", normalizedIso3);

        const name = cleanText(countryName);
        if (name && name !== normalizedIso3) {
          qs.set("country", name);
        }

        const response = await fetch(`/api/wiki/country?${qs.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json = (await response.json()) as WikiPayload;

        if (!controller.signal.aborted) {
          setPayload(json);
        }
      } catch {
        if (!controller.signal.aborted) {
          setPayload({
            ok: false,
            error: "Wikipedia profile unavailable",
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadWikiProfile();

    return () => controller.abort();
  }, [iso3, countryName]);

  const countryFacts = useMemo(
    () => normalizeFacts(payload?.facts),
    [payload?.facts],
  );

  const countryHighlights = useMemo(
    () => normalizeFacts(payload?.highlights),
    [payload?.highlights],
  );

  const economyFacts = useMemo(
    () => normalizeFacts(payload?.economics?.facts),
    [payload?.economics?.facts],
  );

  const economyHighlights = useMemo(
    () => normalizeFacts(payload?.economics?.highlights),
    [payload?.economics?.highlights],
  );

  const countryFactGroups = useMemo(
    () => groupFacts(countryFacts),
    [countryFacts],
  );

  const economyFactGroups = useMemo(
    () => groupFacts(economyFacts),
    [economyFacts],
  );

  const demographicsParagraphs = useMemo(() => {
    return (payload?.demographics?.paragraphs || [])
      .map(cleanText)
      .filter(Boolean);
  }, [payload?.demographics?.paragraphs]);

  const economySections = useMemo(() => {
    return (payload?.economics?.sections || [])
      .map((section) => ({
        title: cleanText(section.title),
        paragraphs: (section.paragraphs || []).map(cleanText).filter(Boolean),
      }))
      .filter((section) => section.title && section.paragraphs.length);
  }, [payload?.economics?.sections]);

  const displayName = cleanText(
    payload?.displayTitle ||
      payload?.title ||
      payload?.country ||
      countryName ||
      "Country profile",
  );

  const economyTitle = cleanText(
    payload?.economics?.displayTitle ||
      payload?.economics?.title ||
      `Economy of ${displayName}`,
  );

  const fetchedAt = formatFetchedAt(payload?.fetchedAt);

  if (loading) {
    return (
      <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900">
                Loading country and economy profile...
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Fetching Wikipedia summary, demographics and dedicated economy
                page
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!payload?.ok || !payload.extract) {
    return null;
  }

  return (
    <>
      <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_190px]">
            <div className="p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                  Country profile
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  <Globe2 className="h-3.5 w-3.5" />
                  {cleanText(iso3).toUpperCase()}
                </span>

                {payload.economics?.ok ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    Economy page linked
                  </span>
                ) : null}

                {region ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                    {cleanText(region)}
                  </span>
                ) : null}
              </div>

              <h2 className="text-xl font-black tracking-tight text-slate-950">
                {displayName}
              </h2>

              {payload.description ? (
                <div className="mt-1 text-xs font-bold uppercase tracking-wide text-violet-700">
                  {cleanText(payload.description)}
                </div>
              ) : null}

              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                {shortText(payload.extract, 430)}
              </p>

              {economyHighlights.length ? (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                    Economy snapshot from dedicated economy page
                  </div>
                  <FactGrid facts={economyHighlights} max={6} />
                </div>
              ) : countryHighlights.length ? (
                <div className="mt-4">
                  <FactGrid facts={countryHighlights} max={6} />
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div className="text-[11px] font-medium text-slate-500">
                  Source: {payload.source || "Wikipedia"} contributors
                  {payload.license ? ` · License: ${payload.license}` : ""}
                  {fetchedAt ? ` · Updated: ${fetchedAt}` : ""}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Info className="h-3.5 w-3.5" />
                    View full profile
                  </button>

                  {payload.economics?.pageUrl ? (
                    <a
                      href={payload.economics.pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                    >
                      Economy page
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="hidden border-l border-slate-100 bg-slate-50 p-4 md:block">
              {payload.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={payload.thumbnailUrl}
                  alt={displayName}
                  className="h-full min-h-[190px] w-full rounded-[22px] object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-full min-h-[190px] items-center justify-center rounded-[22px] border border-slate-200 bg-white">
                  <Globe2 className="h-10 w-10 text-slate-300" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {open ? (
        <div
          className="fixed inset-0 z-[99999] flex items-stretch justify-center bg-slate-950/55 p-0 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                  Country intelligence profile
                </div>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                  {displayName}
                </h3>
                <div className="mt-1 text-sm font-semibold text-slate-500">
                  {cleanText(iso3).toUpperCase()}
                  {region ? ` · ${cleanText(region)}` : ""}
                  {payload.description
                    ? ` · ${cleanText(payload.description)}`
                    : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-100"
                aria-label="Close country profile"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="space-y-3 sm:space-y-4">
                <section className="rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4">
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Country overview
                  </h4>
                  <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                    {cleanText(payload.extract)}
                  </p>
                </section>

                {payload.economics?.ok ? (
                  <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/40 p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-wide text-emerald-800">
                          Economy overview
                        </h4>
                        <div className="mt-1 text-xs font-bold text-emerald-700">
                          {economyTitle}
                        </div>
                      </div>

                      {payload.economics.pageUrl ? (
                        <a
                          href={payload.economics.pageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Open economy page
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>

                    {payload.economics.extract ? (
                      <p className="mt-3 text-sm font-medium leading-7 text-slate-700">
                        {cleanText(payload.economics.extract)}
                      </p>
                    ) : null}

                    {economyHighlights.length ? (
                      <div className="mt-4">
                        <FactGrid facts={economyHighlights} max={10} />
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <div className="grid gap-3 lg:grid-cols-2">
                  {economyHighlights.length ? (
                    <section className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                      <h4 className="text-sm font-black uppercase tracking-wide text-emerald-800">
                        Economy facts
                      </h4>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {economyHighlights.map((fact, index) => (
                          <div
                            key={`${fact.label}-${index}`}
                            className="rounded-2xl border border-emerald-100 bg-white px-3 py-2"
                          >
                            <div className="text-[10px] font-black uppercase tracking-wide text-emerald-600">
                              {fact.label}
                            </div>
                            <div className="mt-1 text-sm font-bold leading-6 text-slate-800">
                              {fact.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {countryHighlights.length ? (
                    <section className="rounded-[20px] border border-slate-200 bg-slate-50 p-3 sm:p-4">
                      <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
                        Country facts
                      </h4>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {countryHighlights.map((fact, index) => (
                          <div
                            key={`${fact.label}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                              {fact.label}
                            </div>
                            <div className="mt-1 text-sm font-bold leading-6 text-slate-800">
                              {fact.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>

                {economyFactGroups.length ? (
                  <FactsTable groups={economyFactGroups} />
                ) : null}

                {economySections.map((section) => (
                  <section
                    key={section.title}
                    className="rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4"
                  >
                    <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
                      {section.title}
                    </h4>

                    <div className="mt-2 space-y-3">
                      {section.paragraphs.map((paragraph, index) => (
                        <p
                          key={index}
                          className="text-sm font-medium leading-7 text-slate-600"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}

                {demographicsParagraphs.length ? (
                  <section className="rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4">
                    <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
                      {cleanText(payload.demographics?.title || "Demographics")}
                    </h4>

                    <div className="mt-2 space-y-3">
                      {demographicsParagraphs.map((paragraph, index) => (
                        <p
                          key={index}
                          className="text-sm font-medium leading-7 text-slate-600"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}

                {countryFactGroups.length ? (
                  <FactsTable groups={countryFactGroups} />
                ) : null}

                <section className="rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4">
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Source note
                  </h4>

                  <p className="mt-3 text-xs font-medium leading-5 text-slate-500">
                    General country context comes from the country Wikipedia
                    page. Economic indicators are pulled from the dedicated
                    economy page where available. For analytical numbers, prefer
                    WDI, IMF, FAOSTAT and official datasets.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {payload.pageUrl ? (
                      <a
                        href={payload.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Country page
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}

                    {payload.economics?.pageUrl ? (
                      <a
                        href={payload.economics.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        Economy page
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}