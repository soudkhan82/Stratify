"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Landmark,
  Loader2,
  MapPin,
  Shield,
  Swords,
  Users,
  X,
} from "lucide-react";

type WikiSection = {
  title: string;
  paragraphs: string[];
};

type DetailPayload = {
  ok?: boolean;
  qid?: string;
  title?: string;
  description?: string | null;
  extract?: string | null;
  sections?: WikiSection[];
  types?: string[];
  pointDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  displayDate?: string | null;
  locations?: string[];
  participants?: string[];
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  articleUrl?: string | null;
  wikidataUrl?: string | null;
  source?: string;
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
  const text = cleanText(value);
  if (!text) return false;
  if (text === "-") return false;
  if (text.toLowerCase() === "not specified") return false;
  return true;
}

function cleanList(values?: string[]) {
  return (values || []).map(cleanText).filter(hasText);
}

function joinList(values?: string[]) {
  return cleanList(values).join(", ");
}

function InfoBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  if (!hasText(value)) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-bold leading-6 text-slate-800">
        {value}
      </div>
    </div>
  );
}

function PillList({ values }: { values?: string[] }) {
  const clean = cleanList(values);

  if (!clean.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {clean.slice(0, 16).map((item) => (
        <span
          key={item}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm"
        >
          {item}
        </span>
      ))}

      {clean.length > 16 ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500">
          +{clean.length - 16} more
        </span>
      ) : null}
    </div>
  );
}

export default function EventDetailDialog({
  qid,
  onClose,
}: {
  qid: string | null;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!qid) return;

    const safeQid = qid;
    const controller = new AbortController();

    async function loadDetail() {
      try {
        setLoading(true);
        setPayload(null);

        const response = await fetch(
          `/api/history/event-detail?qid=${encodeURIComponent(safeQid)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const json = (await response.json()) as DetailPayload;

        if (!controller.signal.aborted) {
          setPayload(json);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPayload({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load event detail",
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
  }, [qid]);

  if (!qid) return null;

  const overview = cleanText(payload?.extract || payload?.description);
  const participants = cleanList(payload?.participants);
  const locations = cleanList(payload?.locations);
  const types = cleanList(payload?.types);
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
              {loading ? "Loading event..." : payload?.title || qid}
            </h2>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {payload?.qid || qid}
              {payload?.displayDate ? ` · ${payload.displayDate}` : ""}
              {payload?.source ? ` · ${payload.source}` : ""}
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
                  Fetching useful event details...
                </div>
              </div>
            </div>
          ) : !payload?.ok ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {payload?.error || "Unable to load event detail."}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
              <div className="space-y-4">
                {hasText(overview) ? (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                      Overview
                    </h3>

                    {hasText(payload.description) ? (
                      <div className="mt-1 text-xs font-black uppercase tracking-wide text-violet-700">
                        {payload.description}
                      </div>
                    ) : null}

                    <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                      {overview}
                    </p>
                  </section>
                ) : null}

                {participants.length ? (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                      Key participants
                    </h3>

                    <div className="mt-3">
                      <PillList values={participants} />
                    </div>
                  </section>
                ) : null}

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

                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Source links
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {payload.articleUrl ? (
                      <a
                        href={payload.articleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
                      >
                        Open Wikipedia
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : null}

                    {payload.wikidataUrl ? (
                      <a
                        href={payload.wikidataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"
                      >
                        Open Wikidata
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                {payload.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={payload.imageUrl}
                    alt={payload.title || "Historical event"}
                    className="h-[220px] w-full rounded-[24px] border border-slate-200 object-cover shadow-sm"
                  />
                ) : null}

                <div className="grid gap-3">
                  <InfoBox
                    label="Timeline"
                    value={payload.displayDate || ""}
                    icon={<CalendarDays className="h-3.5 w-3.5" />}
                  />

                  <InfoBox
                    label="Event type"
                    value={joinList(types)}
                    icon={<Swords className="h-3.5 w-3.5" />}
                  />

                  <InfoBox
                    label="Location"
                    value={joinList(locations)}
                    icon={<MapPin className="h-3.5 w-3.5" />}
                  />

                  <InfoBox
                    label="Coordinates"
                    value={
                      payload.lat !== null &&
                      payload.lng !== null &&
                      payload.lat !== undefined &&
                      payload.lng !== undefined
                        ? `${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)}`
                        : ""
                    }
                    icon={<Landmark className="h-3.5 w-3.5" />}
                  />

                  <InfoBox
                    label="Available fields"
                    value="Timeline, summary, participants, location and article sections where available"
                    icon={<Shield className="h-3.5 w-3.5" />}
                  />

                  {participants.length ? (
                    <InfoBox
                      label="Participant count"
                      value={String(participants.length)}
                      icon={<Users className="h-3.5 w-3.5" />}
                    />
                  ) : null}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

