import { PulseItem, PulseSourceId, PulseTopic } from "./types";
import {
  cleanText,
  decodeEntities,
  fetchWithTimeout,
  freshnessScore,
  moduleForTopic,
  normalizeTopic,
  safeUrl,
  stableId,
  toIsoDate,
  TOPIC_QUERIES,
  xmlAttribute,
  xmlTag,
} from "./utils";

type SourceFetchResult = {
  id: PulseSourceId;
  label: string;
  configured: boolean;
  items: PulseItem[];
  error: Error | null;
};

function errorMessage(response: Response, body: string) {
  const snippet = cleanText(body, 180);
  return `${response.status} ${response.statusText}${snippet ? `: ${snippet}` : ""}`;
}

const INVALID_TEXT_PATTERN =
  /^(?:\[object\s+[^\]]+\]|undefined|null|nan|n\/a|none)$/i;

const TEXT_KEYS = [
  "cdata!",
  "#text",
  "text",
  "value",
  "name",
  "title",
  "display_title",
  "label",
  "description",
  "abstract",
  "content",
] as const;

/**
 * Converts inconsistent third-party API values into genuine readable text.
 * Plain object stringification is intentionally forbidden because it creates
 * visible "[object Object]" cards.
 */
function extractPlainText(value: unknown, maxLength = 520): string {
  const visited = new Set<object>();

  function visit(input: unknown, depth: number): string {
    if (input === null || input === undefined || depth > 5) return "";

    if (typeof input === "string") return input;
    if (typeof input === "number" || typeof input === "bigint") {
      return String(input);
    }
    if (typeof input === "boolean") return "";

    if (Array.isArray(input)) {
      for (const entry of input) {
        const resolved = visit(entry, depth + 1);
        if (resolved) return resolved;
      }
      return "";
    }

    if (typeof input === "object") {
      if (visited.has(input)) return "";
      visited.add(input);

      const record = input as Record<string, unknown>;
      for (const key of TEXT_KEYS) {
        if (!(key in record)) continue;
        const resolved = visit(record[key], depth + 1);
        if (resolved) return resolved;
      }

      return "";
    }

    return "";
  }

  const text = cleanText(visit(value, 0), maxLength);
  if (!text || INVALID_TEXT_PATTERN.test(text) || /\[object\s+Object\]/i.test(text)) {
    return "";
  }

  return text;
}


function extractArticleText(value: unknown, maxLength = 40_000): string {
  const visited = new Set<object>();

  function visit(input: unknown, depth: number): string {
    if (input === null || input === undefined || depth > 5) return "";

    if (typeof input === "string") return input;
    if (typeof input === "number" || typeof input === "bigint") {
      return String(input);
    }
    if (typeof input === "boolean") return "";

    if (Array.isArray(input)) {
      return input
        .map((entry) => visit(entry, depth + 1))
        .filter(Boolean)
        .join("\n\n");
    }

    if (typeof input === "object") {
      if (visited.has(input)) return "";
      visited.add(input);

      const record = input as Record<string, unknown>;
      for (const key of TEXT_KEYS) {
        if (!(key in record)) continue;
        const resolved = visit(record[key], depth + 1);
        if (resolved) return resolved;
      }
    }

    return "";
  }

  const raw = visit(value, 0);
  if (!raw) return "";

  const text = decodeEntities(raw)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(?:p|div|section|article|h[1-6]|blockquote|ul|ol|table|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text || INVALID_TEXT_PATTERN.test(text) || /\[object\s+Object\]/i.test(text)) {
    return "";
  }

  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function imageFromMarkup(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const match = value.match(
    /<img\b[^>]*?(?:src|data-src)\s*=\s*["']([^"']+)["'][^>]*>/i,
  );

  return match?.[1] ? match[1].trim() : null;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function resolveHttpUrl(value: unknown, baseUrl?: string | null) {
  const raw = extractPlainText(value, 2_048);
  if (!raw) return null;

  try {
    const parsed = baseUrl ? new URL(decodeHtmlAttribute(raw), baseUrl) : new URL(decodeHtmlAttribute(raw));
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function metaImageFromHtml(html: string, articleUrl: string) {
  const candidates: string[] = [];
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of metaTags) {
    const keyMatch = tag.match(
      /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i,
    );
    const contentMatch = tag.match(/content\s*=\s*["']([^"']+)["']/i);
    const key = keyMatch?.[1]?.trim().toLowerCase();

    if (
      key &&
      contentMatch?.[1] &&
      [
        "og:image",
        "og:image:url",
        "og:image:secure_url",
        "twitter:image",
        "twitter:image:src",
        "image",
      ].includes(key)
    ) {
      candidates.push(contentMatch[1]);
    }
  }

  const imageLink = html.match(
    /<link\b[^>]*rel\s*=\s*["'][^"']*image_src[^"']*["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i,
  );
  if (imageLink?.[1]) candidates.push(imageLink[1]);

  const jsonLdImage = html.match(
    /["']image["']\s*:\s*(?:["']([^"']+)["']|\[\s*["']([^"']+)["'])/i,
  );
  if (jsonLdImage?.[1] || jsonLdImage?.[2]) {
    candidates.push(jsonLdImage[1] ?? jsonLdImage[2]);
  }

  for (const candidate of candidates) {
    const resolved = resolveHttpUrl(candidate, articleUrl);
    if (resolved) return resolved;
  }

  return null;
}

async function fetchArticleImage(articleUrl: string) {
  try {
    const response = await fetchWithTimeout(
      articleUrl,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "StratifyGlobalPulse/1.0 (+https://worldstats360.com)",
        },
        next: { revalidate: 21_600 },
      },
      6_000,
    );

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return null;

    const html = (await response.text()).slice(0, 450_000);
    return metaImageFromHtml(html, articleUrl);
  } catch {
    return null;
  }
}

/**
 * Adds article Open Graph images only where a source feed did not provide one.
 * Work is deliberately bounded and chunked so a slow publisher cannot block the feed.
 */
export async function enrichMissingImages(
  items: PulseItem[],
  maxLookups = 24,
): Promise<PulseItem[]> {
  const candidates = items
    .filter((item) => !item.imageUrl && resolveHttpUrl(item.url))
    .slice(0, Math.max(0, maxLookups));

  if (!candidates.length) return items;

  const imageById = new Map<string, string>();
  const concurrency = Math.max(1, candidates.length);

  for (let index = 0; index < candidates.length; index += concurrency) {
    const batch = candidates.slice(index, index + concurrency);
    const resolved = await Promise.all(
      batch.map(async (item) => ({
        id: item.id,
        imageUrl: await fetchArticleImage(item.url),
      })),
    );

    for (const result of resolved) {
      if (result.imageUrl) imageById.set(result.id, result.imageUrl);
    }
  }

  if (!imageById.size) return items;

  return items.map((item) => {
    const imageUrl = imageById.get(item.id);
    return imageUrl
      ? {
          ...item,
          imageUrl,
          score: item.score + 8,
        }
      : item;
  });
}

function baseItem(args: {
  sourceId: PulseSourceId;
  source: unknown;
  sourceType: PulseItem["sourceType"];
  title: unknown;
  summary?: unknown;
  content?: unknown;
  contentKind?: PulseItem["contentKind"];
  url: unknown;
  imageUrl?: unknown;
  publishedAt?: unknown;
  fallbackTopic?: Exclude<PulseTopic, "all">;
  countries?: unknown[];
  language?: unknown;
  sourceCountry?: unknown;
  tone?: number | null;
  isOfficial?: boolean;
  baseScore?: number;
  year?: number | null;
}): PulseItem | null {
  const title = extractPlainText(args.title, 240);
  const url = safeUrl(extractPlainText(args.url, 2_048));
  if (title.length < 8 || !url) return null;

  const content = extractArticleText(args.content, 40_000) || null;
  const summary =
    extractPlainText(args.summary, 520) ||
    extractPlainText(content, 520) ||
    null;
  const publishedAt = toIsoDate(extractPlainText(args.publishedAt, 120) || null);
  const classified = normalizeTopic(
    title,
    summary,
    args.fallbackTopic ?? "geo-economy",
  );
  const module = moduleForTopic(classified.topic);
  const imageUrl = resolveHttpUrl(args.imageUrl, url);
  const isOfficial = Boolean(args.isOfficial);
  const source = extractPlainText(args.source, 140) || args.sourceId;

  return {
    id: stableId(args.sourceId, url, title),
    sourceId: args.sourceId,
    source,
    sourceType: args.sourceType,
    title,
    summary,
    content,
    contentKind: content
      ? args.contentKind ?? "source-extract"
      : summary
        ? "summary"
        : undefined,
    url,
    imageUrl,
    publishedAt,
    topic: classified.topic,
    topics: classified.topics,
    countries: Array.from(
      new Set(
        (args.countries ?? [])
          .map((value) => extractPlainText(value, 100))
          .filter(Boolean),
      ),
    ),
    language: extractPlainText(args.language, 60) || null,
    sourceCountry: extractPlainText(args.sourceCountry, 100) || null,
    tone:
      args.tone !== null && args.tone !== undefined && Number.isFinite(args.tone)
        ? args.tone
        : null,
    isOfficial,
    score:
      (args.baseScore ?? 45) +
      freshnessScore(publishedAt) +
      (imageUrl ? 8 : 0) +
      (isOfficial ? 14 : 0),
    ...module,
    year: args.year ?? null,
  };
}

export async function fetchGdelt(args: {
  topic: PulseTopic;
  q: string;
  country: string;
  hours: number;
  limit: number;
}): Promise<SourceFetchResult> {
  const id: PulseSourceId = "gdelt";
  const label = "GDELT Global News";

  try {
    const queryParts = [TOPIC_QUERIES[args.topic]];
    if (args.q) queryParts.push(`"${args.q.replace(/["()]/g, " ")}"`);
    if (args.country) queryParts.push(`"${args.country.replace(/["()]/g, " ")}"`);

    const params = new URLSearchParams({
      query: queryParts.join(" "),
      mode: "artlist",
      maxrecords: String(Math.min(Math.max(args.limit, 20), 100)),
      timespan: args.hours <= 24 ? "24h" : args.hours <= 72 ? "3d" : "7d",
      sort: "datedesc",
      format: "json",
    });

    const response = await fetchWithTimeout(
      `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`,
      { next: { revalidate: 600 } },
      8_000,
    );

    const body = await response.text();
    if (!response.ok) throw new Error(errorMessage(response, body));

    const payload = JSON.parse(body) as {
      articles?: Array<Record<string, unknown>>;
    };

    const items = (Array.isArray(payload.articles) ? payload.articles : [])
      .map((row) =>
        baseItem({
          sourceId: id,
          source: cleanText(row.domain) || "GDELT indexed publisher",
          sourceType: "publisher",
          title: cleanText(row.title),
          summary: null,
          url: String(row.url ?? row.url_mobile ?? ""),
          imageUrl: String(row.socialimage ?? ""),
          publishedAt: String(row.seendate ?? ""),
          fallbackTopic: args.topic === "all" ? "geo-economy" : args.topic,
          language: String(row.language ?? ""),
          sourceCountry: String(row.sourcecountry ?? ""),
          countries: args.country ? [args.country] : [],
          baseScore: 48,
        }),
      )
      .filter((item): item is PulseItem => Boolean(item));

    return { id, label, configured: true, items, error: null };
  } catch (error) {
    return {
      id,
      label,
      configured: true,
      items: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export async function fetchReliefWeb(args: {
  topic: PulseTopic;
  q: string;
  country: string;
  hours: number;
  limit: number;
}): Promise<SourceFetchResult> {
  const id: PulseSourceId = "reliefweb";
  const label = "ReliefWeb / OCHA";
  const appname = String(process.env.RELIEFWEB_APPNAME ?? "").trim();

  if (!appname) {
    return {
      id,
      label,
      configured: false,
      items: [],
      error: new Error("Add an approved RELIEFWEB_APPNAME environment variable."),
    };
  }

  try {
    const conditions: Array<Record<string, unknown>> = [
      {
        field: "date.created",
        value: {
          from: new Date(Date.now() - args.hours * 3_600_000).toISOString(),
        },
      },
    ];

    const searchValue = [
      args.topic !== "all" && args.topic !== "history"
        ? TOPIC_QUERIES[args.topic].replace(/[()\"]/g, " ").replace(/\s+OR\s+/g, " ")
        : "humanitarian disaster conflict displacement food security climate health",
      args.q,
      args.country,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const requestBody: Record<string, unknown> = {
      limit: Math.min(Math.max(args.limit, 10), 50),
      profile: "list",
      sort: ["date.created:desc"],
      fields: {
        include: [
          "title",
          "body",
          "date.created",
          "date.original",
          "url",
          "url_alias",
          "source",
          "country",
          "theme",
          "format",
        ],
      },
      filter: {
        operator: "AND",
        conditions,
      },
    };

    if (searchValue) {
      requestBody.query = { value: searchValue };
    }

    const response = await fetchWithTimeout(
      `https://api.reliefweb.int/v2/reports?appname=${encodeURIComponent(appname)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        next: { revalidate: 900 },
      },
      8_000,
    );

    const body = await response.text();
    if (!response.ok) throw new Error(errorMessage(response, body));

    const payload = JSON.parse(body) as {
      data?: Array<{ id?: string | number; fields?: Record<string, any> }>;
    };

    const items = (Array.isArray(payload.data) ? payload.data : [])
      .map((row) => {
        const fields = row.fields ?? {};
        const sources = Array.isArray(fields.source) ? fields.source : [];
        const countries = Array.isArray(fields.country) ? fields.country : [];

        return baseItem({
          sourceId: id,
          source: cleanText(sources[0]?.name) || label,
          sourceType: "institution",
          title: cleanText(fields.title),
          summary: cleanText(fields.body, 520),
          content: fields.body,
          contentKind: "full",
          url: String(fields.url_alias ?? fields.url ?? ""),
          publishedAt: String(fields.date?.original ?? fields.date?.created ?? ""),
          fallbackTopic: "crises",
          countries: countries.map((country: any) => cleanText(country?.name)),
          isOfficial: true,
          baseScore: 62,
        });
      })
      .filter((item): item is PulseItem => Boolean(item));

    return { id, label, configured: true, items, error: null };
  } catch (error) {
    return {
      id,
      label,
      configured: true,
      items: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function worldBankDocuments(payload: any) {
  const candidate =
    payload?.documents ??
    payload?.data ??
    payload?.results ??
    payload?.result ??
    payload?.response?.docs ??
    [];

  if (Array.isArray(candidate)) return candidate;
  if (candidate && typeof candidate === "object") return Object.values(candidate);
  return [];
}

export async function fetchWorldBank(args: {
  q: string;
  country: string;
  limit: number;
}): Promise<SourceFetchResult> {
  const id: PulseSourceId = "world-bank";
  const label = "World Bank";

  try {
    const params = new URLSearchParams({
      format: "json",
      rows: String(Math.min(Math.max(args.limit, 10), 40)),
      os: "0",
      srt: "lnchdt",
      order: "desc",
    });

    const qterm = [args.q, args.country].filter(Boolean).join(" ").trim();
    if (qterm) params.set("qterm", qterm);

    const response = await fetchWithTimeout(
      `https://search.worldbank.org/api/v2/news?${params.toString()}`,
      { next: { revalidate: 1_800 } },
      8_000,
    );

    const body = await response.text();
    if (!response.ok) throw new Error(errorMessage(response, body));
    const payload = JSON.parse(body);

    const items = worldBankDocuments(payload)
      .map((row: any) =>
        baseItem({
          sourceId: id,
          source: label,
          sourceType: "official",
          title:
            row?.display_title ??
            row?.title ??
            row?.name ??
            row?.label ??
            "",
          summary:
            row?.content_1000?.["cdata!"] ??
            row?.content_1000 ??
            row?.content ??
            row?.abstract ??
            row?.description ??
            null,
          content:
            row?.content ??
            row?.content_1000?.["cdata!"] ??
            row?.content_1000 ??
            row?.abstract ??
            row?.description ??
            null,
          contentKind: "source-extract",
          url:
            row?.url ??
            row?.url_friendly ??
            row?.landingpage ??
            row?.link ??
            "",
          imageUrl: row?.image_url ?? row?.thumbnail ?? null,
          publishedAt:
            row?.contentdate ??
            row?.date ??
            row?.docdt ??
            row?.last_modified_date ??
            null,
          fallbackTopic: "geo-economy",
          countries: args.country ? [args.country] : [],
          isOfficial: true,
          baseScore: 66,
        }),
      )
      .filter((item: PulseItem | null): item is PulseItem => Boolean(item));

    return { id, label, configured: true, items, error: null };
  } catch (error) {
    return {
      id,
      label,
      configured: true,
      items: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

type RssConfig = {
  id: PulseSourceId;
  label: string;
  urls: string[];
  fallbackTopic: Exclude<PulseTopic, "all">;
};

function parseRss(xml: string, config: RssConfig, limit: number) {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const atomEntries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const blocks = [...rssItems, ...atomEntries].slice(0, limit);

  return blocks
    .map((block) => {
      const title = xmlTag(block, "title");
      const link =
        xmlTag(block, "link") ||
        xmlAttribute(block, "link", "href") ||
        xmlTag(block, "guid");
      const encodedContent =
        xmlTag(block, "content:encoded") ||
        xmlTag(block, "content");
      const summary =
        xmlTag(block, "description") ||
        xmlTag(block, "summary") ||
        encodedContent;
      const content =
        encodedContent ||
        xmlTag(block, "description") ||
        xmlTag(block, "summary");
      const publishedAt =
        xmlTag(block, "pubDate") ||
        xmlTag(block, "published") ||
        xmlTag(block, "updated") ||
        xmlTag(block, "dc:date");
      const imageUrl =
        xmlAttribute(block, "media:content", "url") ||
        xmlAttribute(block, "media:thumbnail", "url") ||
        xmlAttribute(block, "enclosure", "url") ||
        imageFromMarkup(summary);

      return baseItem({
        sourceId: config.id,
        source: config.label,
        sourceType: "official",
        title,
        summary,
        content,
        contentKind: "source-extract",
        url: link,
        imageUrl,
        publishedAt,
        fallbackTopic: config.fallbackTopic,
        isOfficial: true,
        baseScore: 68,
      });
    })
    .filter((item): item is PulseItem => Boolean(item));
}

async function fetchRss(
  config: RssConfig,
  limit: number,
): Promise<SourceFetchResult> {
  const attempts = await Promise.allSettled(
    config.urls.map(async (url) => {
      const response = await fetchWithTimeout(
        url,
        { next: { revalidate: 1_800 } },
        8_000,
      );

      const body = await response.text();

      if (!response.ok) {
        throw new Error(errorMessage(response, body));
      }

      const items = parseRss(body, config, limit);

      if (!items.length) {
        throw new Error("Feed returned no readable items.");
      }

      return items;
    }),
  );

  for (const attempt of attempts) {
    if (attempt.status === "fulfilled") {
      return {
        id: config.id,
        label: config.label,
        configured: true,
        items: attempt.value,
        error: null,
      };
    }
  }

  const rejected = attempts.find(
    (attempt) => attempt.status === "rejected",
  );

  const error =
    rejected && rejected.status === "rejected"
      ? rejected.reason
      : new Error("Feed unavailable.");

  return {
    id: config.id,
    label: config.label,
    configured: true,
    items: [],
    error:
      error instanceof Error
        ? error
        : new Error(String(error)),
  };
}

export function fetchImf(limit: number) {
  return fetchRss(
    {
      id: "imf",
      label: "IMF",
      urls: [
        "https://www.imf.org/en/news/rss?Language=ENG",
        "https://mediacenter.imf.org/Rss",
      ],
      fallbackTopic: "geo-economy",
    },
    limit,
  );
}

export function fetchWto(limit: number) {
  return fetchRss(
    {
      id: "wto",
      label: "WTO",
      urls: ["https://www.wto.org/library/rss/latest_news_e.xml"],
      fallbackTopic: "trade",
    },
    limit,
  );
}

export function fetchFao(limit: number) {
  return fetchRss(
    {
      id: "fao",
      label: "FAO",
      urls: ["https://www.fao.org/feeds/fao-newsroom-rss"],
      fallbackTopic: "food",
    },
    limit,
  );
}

function wikiPageUrl(page: any) {
  return (
    safeUrl(page?.content_urls?.desktop?.page) ??
    safeUrl(page?.content_urls?.mobile?.page) ??
    (page?.title
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title)).replace(/%20/g, "_")}`
      : null)
  );
}

export async function fetchWikipediaOnThisDay(limit: number): Promise<SourceFetchResult> {
  const id: PulseSourceId = "wikipedia";
  const label = "Wikipedia — On This Day";

  try {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const urls = [
      `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`,
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${month}/${day}`,
    ];

    const attempts = await Promise.allSettled(
      urls.map(async (url) => {
        const response = await fetchWithTimeout(
          url,
          { next: { revalidate: 21_600 } },
          8_000,
        );

        const body = await response.text();

        if (!response.ok) {
          throw new Error(errorMessage(response, body));
        }

        return JSON.parse(body);
      }),
    );

    const successfulAttempt = attempts.find(
      (attempt) => attempt.status === "fulfilled",
    );

    if (
      !successfulAttempt ||
      successfulAttempt.status !== "fulfilled"
    ) {
      const rejected = attempts.find(
        (attempt) => attempt.status === "rejected",
      );

      const error =
        rejected && rejected.status === "rejected"
          ? rejected.reason
          : new Error("Wikipedia feed unavailable.");

      throw error instanceof Error
        ? error
        : new Error(String(error));
    }

    const payload: any = successfulAttempt.value;
    const events = [
      ...(Array.isArray(payload.selected) ? payload.selected : []),
      ...(Array.isArray(payload.events) ? payload.events : []),
      ...(Array.isArray(payload.holidays) ? payload.holidays : []),
    ];

    const items = events
      .map((event: any) => {
        const page = Array.isArray(event?.pages) ? event.pages[0] : null;
        const url = wikiPageUrl(page);
        if (!url) return null;

        return baseItem({
          sourceId: id,
          source: label,
          sourceType: "knowledge",
          title: cleanText(event?.text) || cleanText(page?.normalizedtitle ?? page?.title),
          summary: page?.extract ?? page?.description ?? null,
          content: page?.extract ?? page?.description ?? null,
          contentKind: "source-extract",
          url,
          imageUrl:
            page?.thumbnail?.source ?? page?.originalimage?.source ?? null,
          publishedAt: new Date().toISOString(),
          fallbackTopic: "history",
          isOfficial: false,
          baseScore: 42,
          year:
            event?.year !== null && event?.year !== undefined
              ? Number(event.year)
              : null,
        });
      })
      .filter((item: PulseItem | null): item is PulseItem => Boolean(item))
      .map((item) => ({
        ...item,
        topic: "history" as const,
        topics: ["history" as const],
        moduleHref: "/history",
        moduleLabel: "Explore History",
      }))
      .slice(0, limit);

    return { id, label, configured: true, items, error: null };
  } catch (error) {
    return {
      id,
      label,
      configured: true,
      items: [],
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
