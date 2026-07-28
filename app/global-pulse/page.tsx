"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  Globe2,
  History,
  Landmark,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wheat,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import type {
  PulseItem,
  PulseResponse,
  PulseSourceStatus,
  PulseTopic,
} from "@/app/api/_lib/global-pulse/types";

const TOPICS: Array<{ key: PulseTopic; label: string }> = [
  { key: "all", label: "Top Stories" },
  { key: "geo-economy", label: "Geo-Economy" },
  { key: "geopolitics", label: "Geopolitics" },
  { key: "energy", label: "Energy" },
  { key: "trade", label: "Trade" },
  { key: "food", label: "Food" },
  { key: "climate", label: "Climate" },
  { key: "society", label: "Society" },
  { key: "health", label: "Health" },
  { key: "crises", label: "Crises" },
  { key: "pakistan", label: "Pakistan" },
  { key: "history", label: "Today in History" },
];

const EMPTY_RESPONSE: PulseResponse = {
  ok: false,
  generatedAt: "",
  filters: { topic: "all", q: "", country: "", hours: 168 },
  counts: {
    total: 0,
    sourcesOk: 0,
    sourcesTotal: 7,
    official: 0,
    publishers: 0,
  },
  hero: null,
  items: [],
  officialUpdates: [],
  todayInHistory: [],
  trending: [],
  sourceStatus: [],
  warnings: [],
};

function formatRelative(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 8) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function readableText(value: unknown) {
  if (typeof value !== "string") return "";

  const text = value.replace(/\s+/g, " ").trim();
  if (
    !text ||
    /^(?:\[object\s+[^\]]+\]|undefined|null|nan|n\/a|none)$/i.test(text) ||
    /\[object\s+Object\]/i.test(text)
  ) {
    return "";
  }

  return text;
}


function readableArticleText(value: unknown) {
  if (typeof value !== "string") return "";

  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (
    !text ||
    /^(?:\[object\s+[^\]]+\]|undefined|null|nan|n\/a|none)$/i.test(text) ||
    /\[object\s+Object\]/i.test(text)
  ) {
    return "";
  }

  return text;
}

function validHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isDisplayableItem(item: PulseItem | null | undefined): item is PulseItem {
  return Boolean(
    item &&
      readableText(item.title).length >= 8 &&
      readableText(item.source) &&
      validHttpUrl(item.url),
  );
}

function formatYear(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Historic event";
  }
  return value < 0 ? `${Math.abs(value)} BC` : String(value);
}

function topicLabel(topic: PulseItem["topic"]) {
  return (
    TOPICS.find((item) => item.key === topic)?.label ??
    topic.replace(/-/g, " ")
  );
}

function topicClasses(topic: PulseItem["topic"]) {
  switch (topic) {
    case "energy":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "trade":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "food":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "climate":
      return "border-teal-200 bg-teal-50 text-teal-800";
    case "crises":
    case "geopolitics":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "pakistan":
      return "border-green-200 bg-green-50 text-green-800";
    case "history":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
  }
}

function SourceBadge({ item }: { item: PulseItem }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em]",
        item.isOfficial
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white/90 text-slate-700",
      ].join(" ")}
    >
      {item.isOfficial ? <ShieldCheck className="h-3 w-3" /> : null}
      {item.source}
    </span>
  );
}

function TopicBadge({ topic }: { topic: PulseItem["topic"] }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${topicClasses(topic)}`}
    >
      {topicLabel(topic)}
    </span>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: typeof Globe2;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
          {eyebrow}
        </div>
        <h2 className="mt-0.5 text-xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs font-medium text-slate-500">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

type OpenStory = (item: PulseItem) => void;

function HeroStory({ item, onOpen }: { item: PulseItem; onOpen: OpenStory }) {
  const relativeTime = formatRelative(item.publishedAt);

  return (
    <article className="stratify-dark-surface group relative min-h-[430px] overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 shadow-xl shadow-slate-300/40">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-950" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/10" />
      <div className="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SourceBadge item={item} />
          <TopicBadge topic={item.topic} />
        </div>

        <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-[-0.035em] text-white sm:text-4xl">
          {item.title}
        </h1>

        {item.summary ? (
          <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-slate-200 sm:text-[15px]">
            {item.summary}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="stratify-light-link inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-slate-950 shadow-lg transition hover:bg-slate-100"
          >
            View details
            <Newspaper className="h-4 w-4" />
          </button>

          <Link
            href={item.moduleHref}
            className="stratify-dark-link inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
          >
            {item.moduleLabel}
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          {relativeTime ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Clock3 className="h-3.5 w-3.5" />
              {relativeTime}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StoryCard({
  item,
  compact = false,
  onOpen,
}: {
  item: PulseItem;
  compact?: boolean;
  onOpen: OpenStory;
}) {
  const relativeTime = formatRelative(item.publishedAt);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`View details for ${item.title}`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
    >
      {item.imageUrl && validHttpUrl(item.imageUrl) ? (
        <div className={compact ? "h-24 w-full overflow-hidden" : "h-36 w-full overflow-hidden"}>
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              const media = event.currentTarget.parentElement;
              if (media) media.style.display = "none";
            }}
          />
        </div>
      ) : null}

      <div className="flex w-full flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TopicBadge topic={item.topic} />
          {item.isOfficial ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">
              <ShieldCheck className="h-3 w-3" /> Official
            </span>
          ) : null}
        </div>

        <h3
          className={[
            "mt-3 font-black leading-[1.25] tracking-tight text-slate-950",
            compact ? "line-clamp-2 text-[15px]" : "line-clamp-3 text-[16px]",
          ].join(" ")}
        >
          {item.title}
        </h3>

        {!compact && item.summary ? (
          <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-slate-600">
            {item.summary}
          </p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-black text-slate-700">
              {item.source}
            </div>
            {relativeTime ? (
              <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {relativeTime}
              </div>
            ) : null}
          </div>

          <span className="stratify-dark-link flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-white transition group-hover:bg-indigo-800">
            <Newspaper className="h-4 w-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

function HistoryCard({ item, onOpen }: { item: PulseItem; onOpen: OpenStory }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full rounded-[22px] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-400"
    >
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
        <History className="h-4 w-4" />
        {formatYear(item.year)}
      </div>
      <h3 className="mt-2 line-clamp-3 text-[15px] font-black leading-5 text-slate-950">
        {item.title}
      </h3>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-500">Wikipedia</span>
        <span className="inline-flex items-center gap-1 text-xs font-black text-violet-700">
          Details
          <Newspaper className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

type ArticleReaderResponse = {
  ok: boolean;
  content: string;
  contentKind: "reader" | "source-extract" | "summary";
  wordCount: number;
  cached?: boolean;
  error?: string;
};


type ArticleBlock = {
  kind: "heading" | "paragraph" | "bullet";
  text: string;
};

function buildArticleBlocks(value: string): ArticleBlock[] {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return paragraphs.map((paragraph, index) => {
    if (/^[•*-]\s+/.test(paragraph)) {
      return {
        kind: "bullet" as const,
        text: paragraph.replace(/^[•*-]\s+/, "").trim(),
      };
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    const nextParagraph = paragraphs[index + 1] ?? "";
    const nextLooksLikeBody = nextParagraph.length >= 120;
    const noSentenceEnding = !/[.!?]$/.test(paragraph);
    const likelyHeading =
      paragraph.length <= 120 &&
      words.length <= 16 &&
      noSentenceEnding &&
      nextLooksLikeBody;

    return {
      kind: likelyHeading ? ("heading" as const) : ("paragraph" as const),
      text: paragraph,
    };
  });
}

function NewsDetailModal({
  item,
  onClose,
}: {
  item: PulseItem | null;
  onClose: () => void;
}) {
  const [articleText, setArticleText] = useState("");
  const [articleKind, setArticleKind] = useState<
    ArticleReaderResponse["contentKind"]
  >("summary");
  const [articleWordCount, setArticleWordCount] = useState(0);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [item, onClose]);

  useEffect(() => {
    if (!item) {
      setArticleText("");
      setArticleKind("summary");
      setArticleWordCount(0);
      setArticleLoading(false);
      setArticleError(null);
      return;
    }

    const currentItem = item;
    const controller = new AbortController();
    const inlineContent =
      readableArticleText(currentItem.content) ||
      readableArticleText(currentItem.summary);
    const inlineWordCount = inlineContent
      ? inlineContent.split(/\s+/).filter(Boolean).length
      : 0;

    setArticleText(inlineContent);
    setArticleKind(
      currentItem.contentKind === "full" ||
      currentItem.contentKind === "source-extract"
        ? "source-extract"
        : "summary",
    );
    setArticleWordCount(inlineWordCount);
    setArticleError(null);

    const feedAlreadyHasFullBody =
      currentItem.contentKind === "full" && inlineContent.length >= 1_200;

    if (feedAlreadyHasFullBody || !validHttpUrl(currentItem.url)) {
      setArticleLoading(false);
      return () => controller.abort();
    }

    setArticleLoading(true);

    async function loadArticle() {
      try {
        const response = await fetch("/api/global-pulse/article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: currentItem.url,
            title: currentItem.title,
            sourceId: currentItem.sourceId,
            fallbackText: inlineContent,
          }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as ArticleReaderResponse;
        if (controller.signal.aborted) return;

        const fetchedText = readableArticleText(payload.content);
        const useFetchedText =
          fetchedText.length >= Math.max(360, inlineContent.length + 80) ||
          (inlineContent.length < 600 && fetchedText.length > inlineContent.length);
        const finalText = useFetchedText ? fetchedText : inlineContent || fetchedText;

        setArticleText(finalText);
        setArticleKind(useFetchedText ? payload.contentKind : "summary");
        setArticleWordCount(
          useFetchedText
            ? payload.wordCount
            : finalText.split(/\s+/).filter(Boolean).length,
        );
        setArticleError(
          payload.ok || finalText.length >= 700
            ? null
            : payload.error ?? "A longer article body was not available.",
        );
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setArticleError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the article inside Stratify.",
        );
      } finally {
        if (!controller.signal.aborted) setArticleLoading(false);
      }
    }

    void loadArticle();
    return () => controller.abort();
  }, [item]);

  if (!item) return null;

  const relativeTime = formatRelative(item.publishedAt);
  const countries = item.countries.map(readableText).filter(Boolean).slice(0, 6);
  const articleBlocks = buildArticleBlocks(articleText);
  const contentHeading =
    articleKind === "reader"
      ? "Complete article"
      : articleKind === "source-extract"
        ? "Source report"
        : "Article details";
  const waitingForFullArticle = articleLoading && articleText.length < 700;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-pulse-detail-title"
        className="relative max-h-[92vh] w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close news details"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg transition hover:bg-slate-100 hover:text-slate-950"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="max-h-[92vh] overflow-y-auto">
          {item.imageUrl && validHttpUrl(item.imageUrl) ? (
            <div className="relative h-[230px] overflow-hidden bg-slate-100 sm:h-[320px]">
              <img
                src={item.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  const media = event.currentTarget.parentElement;
                  if (media) media.style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
            </div>
          ) : null}

          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <TopicBadge topic={item.topic} />
              <SourceBadge item={item} />
              {item.topic === "history" && item.year !== null && item.year !== undefined ? (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-violet-800">
                  {formatYear(item.year)}
                </span>
              ) : null}
            </div>

            <h2
              id="global-pulse-detail-title"
              className="mt-4 text-2xl font-black leading-tight tracking-[-0.025em] text-slate-950 sm:text-3xl"
            >
              {item.title}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-indigo-600" />
                {item.source}
              </span>
              {relativeTime ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-indigo-600" />
                  {relativeTime}
                </span>
              ) : null}
              {item.sourceCountry ? (
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="h-4 w-4 text-indigo-600" />
                  {item.sourceCountry}
                </span>
              ) : null}
              {articleWordCount > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  {articleWordCount.toLocaleString()} words
                </span>
              ) : null}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                <div className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
                  <BookOpen className="h-4 w-4 text-indigo-700" />
                  {contentHeading}
                </div>
                {articleLoading ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-black text-indigo-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading complete article
                  </span>
                ) : null}
              </div>

              <div className="px-4 py-5 sm:px-7 sm:py-7">
                {waitingForFullArticle ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-700" />
                    <div className="mt-4 text-base font-black text-slate-900">
                      Retrieving the full public article
                    </div>
                    <p className="mt-1 max-w-md text-sm font-medium leading-6 text-slate-500">
                      The reader is loading the article body inside Stratify rather than sending you to another website.
                    </p>
                  </div>
                ) : articleBlocks.length ? (
                  <article className="space-y-5 text-[15px] font-medium leading-7 text-slate-700">
                    {articleBlocks.map((block, index) => {
                      const key = `${index}-${block.text.slice(0, 32)}`;

                      if (block.kind === "heading") {
                        return (
                          <h3
                            key={key}
                            className="pt-2 text-lg font-black leading-7 tracking-tight text-slate-950 first:pt-0"
                          >
                            {block.text}
                          </h3>
                        );
                      }

                      if (block.kind === "bullet") {
                        return (
                          <div key={key} className="flex gap-3 pl-1">
                            <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
                            <p className="min-w-0">{block.text}</p>
                          </div>
                        );
                      }

                      return <p key={key}>{block.text}</p>;
                    })}
                  </article>
                ) : (
                  <p className="text-sm font-medium leading-7 text-slate-600 sm:text-[15px]">
                    No readable article body was returned by this source.
                  </p>
                )}

                {articleError && !articleLoading ? (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
                    {articleError}
                  </div>
                ) : null}
              </div>
            </div>

            {countries.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-slate-500">Countries:</span>
                {countries.map((country) => (
                  <span
                    key={country}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700"
                  >
                    {country}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-5 text-xs font-semibold leading-5 text-slate-400">
              Source attribution is retained. Articles are loaded and displayed inside Stratify; no external news button is shown.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>

              <Link
                href={item.moduleHref}
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-black text-indigo-800 transition hover:bg-indigo-100"
              >
                {item.moduleLabel}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SourceHealth({ status }: { status: PulseSourceStatus }) {
  const healthy = status.ok;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {healthy ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : status.configured ? (
          <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-slate-800">
            {status.label}
          </div>
          <div className="truncate text-[10px] font-semibold text-slate-400">
            {healthy
              ? `${status.count} items received`
              : status.configured
                ? status.error ?? "Unavailable"
                : "Optional setup required"}
          </div>
        </div>
      </div>
      <span
        className={[
          "rounded-full px-2 py-1 text-[10px] font-black",
          healthy
            ? "bg-emerald-50 text-emerald-700"
            : status.configured
              ? "bg-rose-50 text-rose-700"
              : "bg-amber-50 text-amber-700",
        ].join(" ")}
      >
        {healthy ? "LIVE" : status.configured ? "DOWN" : "SETUP"}
      </span>
    </div>
  );
}

export default function GlobalPulsePage() {
  const [topic, setTopic] = useState<PulseTopic>("all");
  const [hours, setHours] = useState(168);
  const [searchDraft, setSearchDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [country, setCountry] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [feedPayload, setFeedPayload] =
    useState<PulseResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<PulseItem | null>(null);

  function isValidPulseItem(
    item: PulseItem | null | undefined,
  ): item is PulseItem {
    if (!item) return false;

    const title = String(item.title ?? "").trim();
    const url = String(item.url ?? "").trim();
    const source = String(item.source ?? "").trim();

    if (!title || !url) return false;
    if (title === "[object Object]" || url === "[object Object]") return false;
    if (source === "[object Object]") return false;

    return true;
  }

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          // One reusable source pool powers every topic tab.
          topic: "all",
          hours: String(hours),
          limit: "120",
        });

        if (searchQuery) params.set("q", searchQuery);
        if (country) params.set("country", country);

        // Only an explicit Refresh/Retry action bypasses the warm response.
        if (refreshToken) {
          params.set("refresh", String(refreshToken));
        }

        const response = await fetch(
          `/api/global-pulse?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        const json = (await response.json()) as PulseResponse;

        if (!response.ok) {
          throw new Error(json.error || "Unable to load Global Pulse.");
        }

        setFeedPayload(json);
      } catch (loadError) {
        if (controller.signal.aborted) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load Global Pulse.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [
    // Topic is intentionally excluded. Tabs filter the loaded pool locally.
    hours,
    searchQuery,
    country,
    refreshToken,
  ]);

  const payload = useMemo<PulseResponse>(() => {
    const newsItems = feedPayload.items.filter(isValidPulseItem);
    const historyItems =
      feedPayload.todayInHistory.filter(isValidPulseItem);

    const selectedItems =
      topic === "history"
        ? historyItems
        : topic === "all"
          ? newsItems
          : newsItems.filter(
              (item) =>
                item.topic === topic ||
                item.topics.includes(
                  topic as Exclude<PulseTopic, "all">,
                ),
            );

    const selectedHero =
      selectedItems.find((item) => item.imageUrl) ??
      selectedItems.find((item) => item.isOfficial) ??
      selectedItems[0] ??
      null;

    const selectedOfficialUpdates =
      selectedItems.filter((item) => item.isOfficial);

    return {
      ...feedPayload,
      filters: {
        ...feedPayload.filters,
        topic,
      },
      counts: {
        ...feedPayload.counts,
        total: selectedItems.length,
        official: selectedOfficialUpdates.length,
        publishers:
          selectedItems.length - selectedOfficialUpdates.length,
      },
      hero: selectedHero,
      items: selectedItems,
      officialUpdates: selectedOfficialUpdates,
      todayInHistory: historyItems,
    };
  }, [feedPayload, topic]);

  // These aliases are intentionally retained because the current JSX uses them
  // to suppress malformed [object Object] cards.
  const validHistoryItems = useMemo(
    () => payload.todayInHistory.filter(isValidPulseItem),
    [payload.todayInHistory],
  );

  const validOfficialUpdates = useMemo(
    () => payload.officialUpdates.filter(isValidPulseItem),
    [payload.officialUpdates],
  );

  const hero = payload.hero;
  const secondaryStories = useMemo(
    () =>
      payload.items
        .filter(
          (item) =>
            item.id !== hero?.id &&
            isValidPulseItem(item),
        )
        .slice(0, 3),
    [payload.items, hero?.id],
  );

  const remainingStories = useMemo(
    () =>
      payload.items
        .filter(
          (item) =>
            item.id !== hero?.id &&
            isValidPulseItem(item),
        )
        .slice(3),
    [payload.items, hero?.id],
  );

  function openStory(item: PulseItem) {
    if (!isValidPulseItem(item)) return;
    setSelectedStory(item);
  }

  function closeStory() {
    setSelectedStory(null);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchQuery(searchDraft.trim());
    setCountry(countryDraft.trim());
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      <section className="stratify-dark-surface border-b border-indigo-950/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 text-white">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-9 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200 backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Stratify Intelligence Feed
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
                Global Pulse
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] font-medium leading-7 text-slate-200">
                News, official updates and historical context shaping the global
                geo-social economy — connected directly to Stratify data modules.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: Database, label: "Stories", value: payload.counts.total },
                {
                  icon: Activity,
                  label: "Sources Live",
                  value: `${payload.counts.sourcesOk}/${payload.counts.sourcesTotal}`,
                },
                {
                  icon: ShieldCheck,
                  label: "Official",
                  value: payload.counts.official,
                },
                { icon: Clock3, label: "Window", value: hours === 24 ? "24h" : "7d" },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="min-w-[118px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-300">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <div className="mt-1 text-xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-[72px] z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {TOPICS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTopic(item.key)}
                className={[
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition",
                  topic === item.key
                    ? "bg-gradient-to-r from-indigo-700 to-blue-700 text-white shadow-md shadow-indigo-200"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:text-indigo-700",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={applySearch}
            className="mt-3 grid gap-2 lg:grid-cols-[minmax(260px,1fr)_220px_auto_auto]"
          >
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSearchDraft(event.target.value)
                }
                placeholder="Search inflation, trade, energy, migration..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="relative block">
              <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={countryDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCountryDraft(event.target.value)
                }
                placeholder="Country e.g. Pakistan"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[24, 168].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHours(value)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-black",
                    hours === value
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500",
                  ].join(" ")}
                >
                  {value === 24 ? "24 hours" : "7 days"}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-indigo-700"
              >
                <Search className="h-4 w-4" />
                Apply
              </button>
              <button
                type="button"
                onClick={() => setRefreshToken(Date.now())}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-black text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </form>
        </div>
      </div>


      <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        {loading && !feedPayload.items.length && !feedPayload.todayInHistory.length ? (
          <div className="flex min-h-[480px] flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white text-center shadow-sm">
            <Loader2 className="h-11 w-11 animate-spin text-indigo-700" />
            <div className="mt-4 text-xl font-black text-slate-950">
              Building your Global Pulse
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Fetching and ranking global news and official updates...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
            <h2 className="mt-3 text-xl font-black text-rose-950">Global Pulse could not load</h2>
            <p className="mt-2 text-sm font-semibold text-rose-800">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshToken(Date.now())}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-rose-700 px-4 py-2 text-sm font-black text-white"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)_330px]">
              <aside className="space-y-5">
                <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <SectionHeader
                    icon={TrendingUp}
                    eyebrow="Signals"
                    title="Trending"
                    description="Ranked by volume, authority and freshness."
                  />

                  <div className="space-y-2">
                    {payload.trending.length ? (
                      payload.trending.map((item) => (
                        <button
                          key={item.topic}
                          type="button"
                          onClick={() => setTopic(item.topic)}
                          className="group relative flex w-full items-center rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                        >
                          <span className="absolute inset-y-2.5 left-0 w-1 rounded-full bg-indigo-500 transition group-hover:bg-indigo-700" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-850">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
                              {item.count} related reports
                            </span>
                          </span>
                          <ArrowUpRight className="ml-3 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-indigo-700" />
                        </button>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
                        No trending signals matched the current filters.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <SectionHeader
                    icon={Database}
                    eyebrow="Diagnostics"
                    title="Source Health"
                  />
                  <div className="space-y-2">
                    {payload.sourceStatus.map((status) => (
                      <SourceHealth key={status.id} status={status} />
                    ))}
                  </div>
                </section>
              </aside>

              <div className="min-w-0 space-y-5">
                <section className="min-w-0">
                  {hero ? (
                    <HeroStory item={hero} onOpen={openStory} />
                  ) : (
                    <div className="flex min-h-[430px] items-center justify-center rounded-[30px] border border-dashed border-slate-300 bg-white text-center">
                      <div className="max-w-sm p-8">
                        <Newspaper className="mx-auto h-10 w-10 text-slate-400" />
                        <h2 className="mt-3 text-xl font-black text-slate-950">
                          No matching stories
                        </h2>
                        <p className="mt-2 text-sm font-medium text-slate-500">
                          Clear the search or choose a broader category.
                        </p>
                      </div>
                    </div>
                  )}

                  {secondaryStories.length ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                      {secondaryStories.map((item) => (
                        <StoryCard key={item.id} item={item} compact onOpen={openStory} />
                      ))}
                    </div>
                  ) : null}
                </section>

                {remainingStories.length ? (
                  <section className="rounded-[26px] border border-slate-200 bg-white/45 p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                        <Newspaper className="h-5 w-5" />
                      </div>
                      <h2 className="text-xl font-black tracking-tight text-slate-950">
                        Latest Updates
                      </h2>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(225px,1fr))] gap-4">
                      {remainingStories.map((item) => (
                        <StoryCard key={item.id} item={item} onOpen={openStory} />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="space-y-5 xl:sticky xl:top-[164px]">
                <section className="rounded-[24px] border border-violet-200 bg-white p-4 shadow-sm">
                  <SectionHeader
                    icon={BookOpen}
                    eyebrow="Wikipedia"
                    title="Today in History"
                    description="Daily context from Wikipedia's On This Day feed."
                  />
                  <div className="space-y-3">
                    {validHistoryItems.length ? (
                      validHistoryItems.map((item) => (
                        <HistoryCard key={item.id} item={item} onOpen={openStory} />
                      ))
                    ) : (
                      <p className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
                        No valid history updates are available.
                      </p>
                    )}
                  </div>
                  <Link
                    href="/history"
                    className="stratify-dark-link mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-800"
                  >
                    Open History Module
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <SectionHeader
                    icon={Landmark}
                    eyebrow="Primary Sources"
                    title="Official Updates"
                  />
                  <div className="divide-y divide-slate-100">
                    {validOfficialUpdates.length ? (
                      validOfficialUpdates.map((item) => {
                        const relativeTime = formatRelative(item.publishedAt);

                        return (
                          <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex gap-3">
                              {item.imageUrl && validHttpUrl(item.imageUrl) ? (
                                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    onError={(event) => {
                                      const media = event.currentTarget.parentElement;
                                      if (media) media.style.display = "none";
                                    }}
                                  />
                                </div>
                              ) : null}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  {item.source}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openStory(item)}
                                  className="mt-1.5 line-clamp-3 block w-full text-left text-sm font-black leading-5 text-slate-900 transition hover:text-indigo-700 focus:outline-none focus:text-indigo-700"
                                >
                                  {item.title}
                                </button>
                                {relativeTime ? (
                                  <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                    {relativeTime}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <p className="py-3 text-xs font-semibold text-slate-500">
                        No valid official updates are available.
                      </p>
                    )}
                  </div>
                </section>
              </aside>
            </div>

            <section className="stratify-dark-surface mt-8 overflow-hidden rounded-[30px] border border-indigo-900/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-6 text-white shadow-xl sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">
                    <Zap className="h-4 w-4" />
                    News connected to data
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                    Move from headlines to evidence.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-300">
                    Every story is classified and linked to the relevant Stratify module,
                    helping users examine the underlying monetary, energy, food,
                    historical, country and corporate data.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Energy", "/energy", Zap],
                    ["Monetary", "/monetary", Building2],
                    ["FAOSTAT", "/faostat", Wheat],
                    ["History", "/history", History],
                    ["World Data", "/world", Globe2],
                  ].map(([label, href, Icon]) => {
                    const ModuleIcon = Icon as typeof Globe2;
                    return (
                      <Link
                        key={String(label)}
                        href={String(href)}
                        className="stratify-dark-link inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-black text-white transition hover:bg-white/20"
                      >
                        <ModuleIcon className="h-4 w-4" />
                        {String(label)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            {payload.warnings.length ? (
              <details className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <summary className="cursor-pointer text-sm font-black text-amber-900">
                  {payload.warnings.length} source warning
                  {payload.warnings.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-3 space-y-1 text-xs font-semibold text-amber-800">
                  {payload.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </div>

      <NewsDetailModal item={selectedStory} onClose={closeStory} />
    </main>
  );
}
