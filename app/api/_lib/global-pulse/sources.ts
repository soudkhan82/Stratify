import { PulseItem, PulseSourceId, PulseTopic } from "./types";
import {
  cleanText,
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

function baseItem(args: {
  sourceId: PulseSourceId;
  source: string;
  sourceType: PulseItem["sourceType"];
  title: string;
  summary?: string | null;
  url: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
  fallbackTopic?: Exclude<PulseTopic, "all">;
  countries?: string[];
  language?: string | null;
  sourceCountry?: string | null;
  tone?: number | null;
  isOfficial?: boolean;
  baseScore?: number;
  year?: number | null;
}): PulseItem | null {
  const title = cleanText(args.title, 240);
  const url = safeUrl(args.url);
  if (!title || !url) return null;

  const summary = cleanText(args.summary, 520) || null;
  const publishedAt = toIsoDate(args.publishedAt);
  const classified = normalizeTopic(
    title,
    summary,
    args.fallbackTopic ?? "geo-economy",
  );
  const module = moduleForTopic(classified.topic);
  const imageUrl = safeUrl(args.imageUrl);
  const isOfficial = Boolean(args.isOfficial);

  return {
    id: stableId(args.sourceId, url, title),
    sourceId: args.sourceId,
    source: cleanText(args.source) || args.sourceId,
    sourceType: args.sourceType,
    title,
    summary,
    url,
    imageUrl,
    publishedAt,
    topic: classified.topic,
    topics: classified.topics,
    countries: Array.from(
      new Set((args.countries ?? []).map((value) => cleanText(value)).filter(Boolean)),
    ),
    language: cleanText(args.language) || null,
    sourceCountry: cleanText(args.sourceCountry) || null,
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
      15_000,
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
      15_000,
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
      15_000,
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
      const summary =
        xmlTag(block, "description") ||
        xmlTag(block, "summary") ||
        xmlTag(block, "content:encoded") ||
        xmlTag(block, "content");
      const publishedAt =
        xmlTag(block, "pubDate") ||
        xmlTag(block, "published") ||
        xmlTag(block, "updated") ||
        xmlTag(block, "dc:date");
      const imageUrl =
        xmlAttribute(block, "media:content", "url") ||
        xmlAttribute(block, "media:thumbnail", "url") ||
        xmlAttribute(block, "enclosure", "url");

      return baseItem({
        sourceId: config.id,
        source: config.label,
        sourceType: "official",
        title,
        summary,
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

async function fetchRss(config: RssConfig, limit: number): Promise<SourceFetchResult> {
  let lastError: Error | null = null;

  for (const url of config.urls) {
    try {
      const response = await fetchWithTimeout(
        url,
        { next: { revalidate: 1_800 } },
        15_000,
      );
      const body = await response.text();
      if (!response.ok) throw new Error(errorMessage(response, body));

      const items = parseRss(body, config, limit);
      if (!items.length) throw new Error("Feed returned no readable items.");

      return {
        id: config.id,
        label: config.label,
        configured: true,
        items,
        error: null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  return {
    id: config.id,
    label: config.label,
    configured: true,
    items: [],
    error: lastError ?? new Error("Feed unavailable."),
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

    let payload: any = null;
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(
          url,
          { next: { revalidate: 21_600 } },
          15_000,
        );
        const body = await response.text();
        if (!response.ok) throw new Error(errorMessage(response, body));
        payload = JSON.parse(body);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (!payload) throw lastError ?? new Error("Wikipedia feed unavailable.");

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
