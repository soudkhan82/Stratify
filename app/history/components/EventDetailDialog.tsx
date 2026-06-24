"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";

type DetailSection = {
  title?: string;
  heading?: string;
  content?: string;
  body?: string;
  text?: string;
};

type DetailPayload = {
  ok?: boolean;
  title?: string;
  displayTitle?: string;
  source?: string;
  description?: string;
  overviewTitle?: string;
  summary?: string;
  extract?: string;
  overview?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  articleUrl?: string | null;
  wikiUrl?: string | null;
  url?: string | null;
  sections?: DetailSection[];
  details?: DetailSection[];
  articleDetails?: DetailSection[];
  error?: string;
};

type Props = {
  qid?: string | null;
  articleUrl?: string | null;
  fallbackTitle?: string | null;
  onClose: () => void;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getSectionTitle(section: DetailSection) {
  return cleanText(section.title || section.heading || "Article detail");
}

function getSectionBody(section: DetailSection) {
  return cleanText(section.content || section.body || section.text || "");
}

export default function EventDetailDialog({
  qid,
  articleUrl,
  fallbackTitle,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [error, setError] = useState("");

  const open = Boolean(qid || articleUrl || fallbackTitle);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    async function loadDetail() {
      setLoading(true);
      setError("");
      setDetail(null);

      try {
        const qs = new URLSearchParams();

        if (qid) qs.set("qid", qid);
        if (articleUrl) qs.set("articleUrl", articleUrl);
        if (fallbackTitle) qs.set("fallbackTitle", fallbackTitle);

        const response = await fetch(`/api/history/event-detail?${qs.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json = (await response.json()) as DetailPayload;

        if (!response.ok || json?.ok === false) {
          throw new Error(json?.error || "Unable to load event detail.");
        }

        if (!controller.signal.aborted) {
          setDetail(json);
        }
      } catch (err: any) {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load event detail.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadDetail();

    return () => controller.abort();
  }, [open, qid, articleUrl, fallbackTitle]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const title = cleanText(detail?.displayTitle || detail?.title || fallbackTitle || "Historical event");
  const source = cleanText(detail?.source || "Wikipedia");
  const overview = cleanText(detail?.summary || detail?.extract || detail?.overview || "");
  const overviewTitle = cleanText(detail?.overviewTitle || detail?.description || "");
  const article = detail?.articleUrl || detail?.wikiUrl || detail?.url || articleUrl || "";
  const image = detail?.imageUrl || detail?.thumbnailUrl || "";

  const sections = useMemo(() => {
    const raw = detail?.sections || detail?.details || detail?.articleDetails || [];
    return raw
      .map((section) => ({
        title: getSectionTitle(section),
        body: getSectionBody(section),
      }))
      .filter((section) => section.title && section.body)
      .slice(0, 5);
  }, [detail]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <section className="relative max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/20 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.35em] text-violet-700">
              Historical Event Detail
            </div>

            <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">
              {title}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              {source}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-rose-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-92px)] overflow-y-auto p-4">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin text-violet-700" />
                Loading event details...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <h3 className="text-xl font-black uppercase text-slate-800">
                    Overview
                  </h3>

                  {overviewTitle ? (
                    <div className="mt-2 text-xs font-black uppercase tracking-wide text-violet-700">
                      {overviewTitle}
                    </div>
                  ) : null}

                  <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
                    {overview || "No readable summary was returned for this event."}
                  </p>
                </section>

                {sections.length ? (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <h3 className="text-xl font-black uppercase text-slate-800">
                      Article Details
                    </h3>

                    <div className="mt-4 space-y-4">
                      {sections.map((section, index) => (
                        <article
                          key={`${section.title}-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="text-xs font-black uppercase tracking-wide text-violet-700">
                            {section.title}
                          </div>

                          <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-7 text-slate-600">
                            {section.body}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="space-y-5">
                {image ? (
                  <img
                    src={image}
                    alt={title}
                    className="h-64 w-full rounded-[24px] border border-slate-200 object-cover shadow-sm"
                  />
                ) : null}

                <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-xl font-black uppercase text-slate-800">
                    Source Links
                  </h3>

                  {article ? (
                    <a
                      href={article}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-violet-700"
                    >
                      Open Wikipedia
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <div className="mt-4 text-sm font-semibold text-slate-500">
                      No article link available.
                    </div>
                  )}
                </section>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
