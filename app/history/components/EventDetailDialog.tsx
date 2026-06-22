"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Loader2,
  X,
} from "lucide-react";

type WikiSection = {
  title: string;
  paragraphs: string[];
};

type DetailPayload = {
  ok?: boolean;
  qid?: string | null;
  title?: string;
  description?: string | null;
  extract?: string | null;
  sections?: WikiSection[];
  imageUrl?: string | null;
  articleUrl?: string | null;
  wikidataUrl?: string | null;
  source?: string;
  warning?: string;
  error?: string;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasText(value: unknown) {
  return cleanText(value).length > 0;
}

export default function EventDetailDialog({
  qid,
  articleUrl,
  fallbackTitle,
  onClose,
}: {
  qid: string | null;
  articleUrl?: string | null;
  fallbackTitle?: string | null;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const canOpen = Boolean(qid || articleUrl || fallbackTitle);

  useEffect(() => {
    if (!canOpen) return;

    const controller = new AbortController();

    async function loadDetail() {
      try {
        setLoading(true);
        setPayload(null);

        const qs = new URLSearchParams();

        if (qid) qs.set("qid", qid);
        if (articleUrl) qs.set("url", articleUrl);
        if (fallbackTitle) qs.set("title", fallbackTitle);

        const response = await fetch(`/api/history/event-detail?${qs.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json = (await response.json()) as DetailPayload;

        if (!controller.signal.aborted) {
          setPayload(json);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPayload({
            ok: true,
            title: fallbackTitle || qid || "Historical event",
            extract:
              "Details could not be fetched right now. Please try again.",
            warning:
              error instanceof Error ? error.message : "Detail fetch failed",
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => controller.abort();
  }, [qid, articleUrl, fallbackTitle, canOpen]);

  if (!canOpen) return null;

  const sections = (payload?.sections || []).filter(
    (section) =>
      hasText(section.title) &&
      (section.paragraphs || []).some((paragraph) => hasText(paragraph)),
  );

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
              Historical event detail
            </div>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              {loading
                ? "Loading event..."
                : payload?.title || fallbackTitle || qid || "Historical event"}
            </h2>

            <div className="mt-1 text-sm font-semibold text-slate-500">
              {payload?.source || "Wikipedia"}
              {payload?.qid ? ` · ${payload.qid}` : ""}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-100"
            aria-label="Close event detail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex flex-col items-center">
                <Loader2 className="h-9 w-9 animate-spin text-slate-950" />
                <div className="mt-3 text-sm font-black text-slate-900">
                  Fetching event details...
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Overview
                  </h3>

                  {payload?.description ? (
                    <div className="mt-1 text-xs font-black uppercase tracking-wide text-violet-700">
                      {payload.description}
                    </div>
                  ) : null}

                  <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                    {payload?.extract ||
                      "No readable summary was returned for this event."}
                  </p>
                </section>

                {sections.length ? (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                      Article details
                    </h3>

                    <div className="mt-3 space-y-4">
                      {sections.map((section) => (
                        <div
                          key={section.title}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="text-xs font-black uppercase tracking-wide text-violet-700">
                            {section.title}
                          </div>

                          <div className="mt-2 space-y-2">
                            {section.paragraphs.map((paragraph, index) => (
                              <p
                                key={index}
                                className="text-sm font-medium leading-7 text-slate-600"
                              >
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {payload?.warning || payload?.error ? (
                  <section className="rounded-[20px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    {payload.warning || payload.error}
                  </section>
                ) : null}
              </div>

              <aside className="space-y-4">
                {payload?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={payload.imageUrl}
                    alt={payload.title || "Historical event"}
                    className="h-[220px] w-full rounded-[24px] border border-slate-200 object-cover shadow-sm"
                  />
                ) : null}

                <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Source links
                  </h3>

                  <div className="mt-3 flex flex-col gap-2">
                    {payload?.articleUrl || articleUrl ? (
                      <a
                        href={payload?.articleUrl || articleUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
                      >
                        Open Wikipedia
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : null}

                    {payload?.wikidataUrl ? (
                      <a
                        href={payload.wikidataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"
                      >
                        Open Wikidata
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </section>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
