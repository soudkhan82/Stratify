import { NextResponse } from "next/server";

import {
  enrichMissingImages,
  fetchFao,
  fetchGdelt,
  fetchImf,
  fetchReliefWeb,
  fetchWikipediaOnThisDay,
  fetchWorldBank,
  fetchWto,
} from "@/app/api/_lib/global-pulse/sources";
import {
  dedupeItems,
  buildTrending,
  cleanText,
  sourceStatus,
} from "@/app/api/_lib/global-pulse/utils";
import {
  PulseItem,
  PulseResponse,
  PulseTopic,
} from "@/app/api/_lib/global-pulse/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_TOPICS = new Set<PulseTopic>([
  "all",
  "geo-economy",
  "geopolitics",
  "energy",
  "trade",
  "food",
  "climate",
  "society",
  "health",
  "crises",
  "pakistan",
  "history",
]);

const CACHE_TTL_MS = 8 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  payload: PulseResponse;
};

type GlobalPulseCache = typeof globalThis & {
  __stratifyGlobalPulseCache?: Map<string, CacheEntry>;
};

const globalForPulse = globalThis as GlobalPulseCache;
const responseCache =
  globalForPulse.__stratifyGlobalPulseCache ?? new Map<string, CacheEntry>();

if (!globalForPulse.__stratifyGlobalPulseCache) {
  globalForPulse.__stratifyGlobalPulseCache = responseCache;
}

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function topicParam(value: string | null): PulseTopic {
  const normalized = cleanText(value).toLowerCase() as PulseTopic;
  return VALID_TOPICS.has(normalized) ? normalized : "all";
}

function readableText(value: unknown, maxLength = 520) {
  if (typeof value !== "string") return "";

  const text = cleanText(value, maxLength);
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
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function sanitizeItem(item: PulseItem): PulseItem | null {
  const title = readableText(item.title, 240);
  const source = readableText(item.source, 140);
  const url = validHttpUrl(item.url);

  if (title.length < 8 || !source || !url) return null;

  return {
    ...item,
    title,
    source,
    url,
    summary: readableText(item.summary, 520) || null,
    imageUrl: validHttpUrl(item.imageUrl),
    publishedAt:
      item.publishedAt && Number.isFinite(new Date(item.publishedAt).getTime())
        ? item.publishedAt
        : null,
    countries: Array.isArray(item.countries)
      ? item.countries
          .map((value) => readableText(value, 100))
          .filter(Boolean)
      : [],
    language: readableText(item.language, 60) || null,
    sourceCountry: readableText(item.sourceCountry, 100) || null,
  };
}

function searchMatches(item: PulseItem, q: string, country: string) {
  const haystack = [
    item.title,
    item.summary,
    item.source,
    item.sourceCountry,
    item.countries.join(" "),
    item.topic,
    item.topics.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (q) {
    const tokens = q
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (!tokens.every((token) => haystack.includes(token))) return false;
  }

  if (country && !haystack.includes(country.toLowerCase())) return false;
  return true;
}

function topicMatches(item: PulseItem, topic: PulseTopic) {
  if (topic === "all") return item.topic !== "history";
  if (topic === "history") return item.topic === "history";
  return item.topic === topic || item.topics.includes(topic);
}

function withinWindow(item: PulseItem, hours: number) {
  if (!item.publishedAt || item.topic === "history") return true;
  const timestamp = new Date(item.publishedAt).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return timestamp >= Date.now() - hours * 3_600_000;
}

function sortNews(a: PulseItem, b: PulseItem) {
  if (b.score !== a.score) return b.score - a.score;
  const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
  const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
  return bt - at;
}

function pruneCache() {
  const now = Date.now();
  responseCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) responseCache.delete(key);
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const topic = topicParam(searchParams.get("topic"));
    const q = cleanText(searchParams.get("q"), 80);
    const country = cleanText(searchParams.get("country"), 80);
    const hours = intParam(searchParams.get("hours"), 168, 24, 168);
    const limit = intParam(searchParams.get("limit"), 72, 20, 120);
    const forceRefresh = searchParams.has("refresh");

    pruneCache();
    const cacheKey = JSON.stringify({ topic, q, country, hours, limit });
    const cached = responseCache.get(cacheKey);

    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        { ...cached.payload, cached: true },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            "X-Stratify-Cache": "HIT",
          },
        },
      );
    }

    const perSource = Math.max(12, Math.ceil(limit / 3));

    const [gdelt, reliefweb, worldBank, imf, wto, fao, wikipedia] =
      await Promise.all([
        fetchGdelt({ topic, q, country, hours, limit: Math.min(80, limit) }),
        fetchReliefWeb({ topic, q, country, hours, limit: perSource }),
        fetchWorldBank({ q, country, limit: perSource }),
        fetchImf(perSource),
        fetchWto(perSource),
        fetchFao(perSource),
        fetchWikipediaOnThisDay(12),
      ]);

    const rawResults = [gdelt, reliefweb, worldBank, imf, wto, fao, wikipedia];
    const results = rawResults.map((result) => ({
      ...result,
      items: result.items
        .map((item) => sanitizeItem(item))
        .filter((item): item is PulseItem => Boolean(item)),
    }));

    const wikipediaResult = results.find((result) => result.id === "wikipedia");
    const todayInHistory = (wikipediaResult?.items ?? []).slice(0, 8);

    const baseAllNews = dedupeItems(
      results
        .filter((result) => result.id !== "wikipedia")
        .flatMap((result) => result.items)
        .filter((item) => withinWindow(item, hours))
        .sort(sortNews),
    );

    const allNews = (
      await enrichMissingImages(
        baseAllNews,
        Math.min(18, Math.max(12, limit)),
      )
    ).sort(sortNews);

    const filteredItems = allNews
      .filter((item) => topicMatches(item, topic))
      .filter((item) => searchMatches(item, q, country))
      .sort(sortNews)
      .slice(0, limit);

    const historyFiltered = todayInHistory
      .filter((item) => searchMatches(item, q, country))
      .slice(0, limit);

    const items = topic === "history" ? historyFiltered : filteredItems;
    const hero =
      items.find((item) => item.imageUrl) ??
      items.find((item) => item.isOfficial) ??
      items[0] ??
      null;

    const officialUpdates = allNews
      .filter((item) => item.isOfficial)
      .filter((item) => searchMatches(item, q, country))
      .sort(sortNews)
      .slice(0, 8);

    const statuses = results.map((result) =>
      sourceStatus(
        result.id,
        result.label,
        result.configured,
        result.items,
        result.error,
      ),
    );

    const warnings = statuses
      .filter((status) => !status.ok)
      .map((status) => `${status.label}: ${status.error ?? "Unavailable"}`);

    const payload: PulseResponse = {
      ok: items.length > 0 || todayInHistory.length > 0,
      generatedAt: new Date().toISOString(),
      filters: { topic, q, country, hours },
      counts: {
        total: items.length,
        sourcesOk: statuses.filter((status) => status.ok).length,
        sourcesTotal: statuses.length,
        official: items.filter((item) => item.isOfficial).length,
        publishers: items.filter((item) => !item.isOfficial).length,
      },
      hero,
      items,
      officialUpdates,
      todayInHistory,
      trending: buildTrending(allNews),
      sourceStatus: statuses,
      warnings,
    };

    responseCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(
      {
        ...payload,
        cached: false,
        performance: { totalMs: Date.now() - startedAt },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Stratify-Cache": "MISS",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Global Pulse.";

    return NextResponse.json(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
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
        error: message,
      } satisfies PulseResponse,
      { status: 500 },
    );
  }
}
