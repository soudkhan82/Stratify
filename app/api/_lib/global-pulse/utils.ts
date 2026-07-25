import {
  PulseItem,
  PulseSourceId,
  PulseSourceStatus,
  PulseTopic,
  PulseTrendingItem,
} from "./types";

export const TOPIC_LABELS: Record<Exclude<PulseTopic, "all">, string> = {
  "geo-economy": "Geo-economy",
  geopolitics: "Geopolitics",
  energy: "Energy",
  trade: "Trade",
  food: "Food & Agriculture",
  climate: "Climate",
  society: "Society",
  health: "Health",
  crises: "Crises",
  pakistan: "Pakistan",
  history: "Today in History",
};

export const TOPIC_QUERIES: Record<PulseTopic, string> = {
  all:
    '("global economy" OR inflation OR interest rates OR debt OR trade OR tariff OR sanctions OR oil OR gas OR electricity OR food security OR agriculture OR climate OR migration OR public health OR conflict)',
  "geo-economy":
    '("global economy" OR GDP OR inflation OR "interest rates" OR central bank OR debt OR recession OR growth)',
  geopolitics:
    '(geopolitics OR sanctions OR diplomacy OR conflict OR war OR election OR "foreign policy")',
  energy:
    '(oil OR gas OR electricity OR energy OR renewables OR solar OR wind OR nuclear OR OPEC)',
  trade:
    '(trade OR tariff OR exports OR imports OR shipping OR supply chain OR WTO OR sanctions)',
  food:
    '(food security OR agriculture OR crops OR wheat OR fertilizer OR livestock OR hunger OR FAO)',
  climate:
    '(climate OR emissions OR drought OR flood OR heatwave OR wildfire OR environment)',
  society:
    '(migration OR population OR inequality OR poverty OR education OR employment OR society)',
  health:
    '(public health OR outbreak OR disease OR pandemic OR hospital OR WHO OR healthcare)',
  crises:
    '(humanitarian OR disaster OR conflict OR displacement OR refugees OR earthquake OR flood OR drought)',
  pakistan:
    '(Pakistan OR Pakistani OR Islamabad OR Karachi OR Lahore OR "State Bank of Pakistan")',
  history: '(history OR anniversary OR "on this day")',
};

const TOPIC_RULES: Array<{
  topic: Exclude<PulseTopic, "all">;
  words: string[];
}> = [
  {
    topic: "pakistan",
    words: [
      "pakistan",
      "pakistani",
      "islamabad",
      "karachi",
      "lahore",
      "state bank of pakistan",
      "sbp",
    ],
  },
  {
    topic: "energy",
    words: [
      "oil",
      "gas",
      "energy",
      "electricity",
      "power grid",
      "renewable",
      "solar",
      "wind",
      "nuclear",
      "opec",
      "petroleum",
      "fuel",
    ],
  },
  {
    topic: "trade",
    words: [
      "trade",
      "tariff",
      "exports",
      "imports",
      "shipping",
      "supply chain",
      "customs",
      "wto",
      "sanctions",
      "port",
    ],
  },
  {
    topic: "food",
    words: [
      "food",
      "agriculture",
      "crop",
      "wheat",
      "fertilizer",
      "livestock",
      "hunger",
      "fao",
      "farm",
      "grain",
    ],
  },
  {
    topic: "climate",
    words: [
      "climate",
      "emission",
      "drought",
      "flood",
      "heatwave",
      "wildfire",
      "environment",
      "carbon",
      "weather",
    ],
  },
  {
    topic: "health",
    words: [
      "health",
      "disease",
      "outbreak",
      "pandemic",
      "hospital",
      "who ",
      "medical",
      "virus",
      "vaccine",
    ],
  },
  {
    topic: "crises",
    words: [
      "humanitarian",
      "disaster",
      "conflict",
      "displacement",
      "refugee",
      "earthquake",
      "emergency",
      "relief",
      "war",
    ],
  },
  {
    topic: "geopolitics",
    words: [
      "geopolit",
      "diplomacy",
      "foreign policy",
      "military",
      "sanctions",
      "ceasefire",
      "election",
      "government",
      "security council",
    ],
  },
  {
    topic: "society",
    words: [
      "migration",
      "population",
      "inequality",
      "poverty",
      "education",
      "employment",
      "jobs",
      "social",
      "demographic",
    ],
  },
  {
    topic: "geo-economy",
    words: [
      "economy",
      "economic",
      "gdp",
      "inflation",
      "interest rate",
      "central bank",
      "debt",
      "recession",
      "growth",
      "fiscal",
      "monetary",
      "imf",
      "world bank",
    ],
  },
];

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
};

export function decodeEntities(value: unknown) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&([a-z]+);/gi, (_, name) => ENTITY_MAP[name.toLowerCase()] ?? " ")
    .replace(/\u00a0/g, " ");
}

export function cleanText(value: unknown, maxLength = 0) {
  const text = decodeEntities(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export function safeUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function toIsoDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const raw = String(value).trim();
  const gdelt = raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/);

  if (gdelt) {
    const [, y, m, d, hh = "00", mm = "00", ss = "00"] = gdelt;
    const date = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }

  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function normalizeTopic(
  title: string,
  summary: string | null,
  fallback: Exclude<PulseTopic, "all"> = "geo-economy",
) {
  const text = `${title} ${summary ?? ""}`.toLowerCase();
  const matches = TOPIC_RULES.map((rule) => ({
    topic: rule.topic,
    count: rule.words.reduce(
      (sum, word) => sum + (text.includes(word) ? 1 : 0),
      0,
    ),
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const primary = matches[0]?.topic ?? fallback;
  const topics = Array.from(
    new Set([primary, ...matches.slice(1, 4).map((row) => row.topic)]),
  );

  return { topic: primary, topics };
}

export function moduleForTopic(topic: Exclude<PulseTopic, "all">) {
  switch (topic) {
    case "energy":
      return { moduleHref: "/energy", moduleLabel: "Explore Energy Data" };
    case "food":
      return { moduleHref: "/faostat", moduleLabel: "Explore FAOSTAT" };
    case "trade":
      return {
        moduleHref: "/corporate-intelligence",
        moduleLabel: "Explore Corporate Intelligence",
      };
    case "geopolitics":
    case "crises":
    case "history":
      return { moduleHref: "/history", moduleLabel: "Explore History" };
    case "pakistan":
      return { moduleHref: "/world", moduleLabel: "Explore Country Data" };
    case "health":
    case "society":
    case "climate":
      return { moduleHref: "/world", moduleLabel: "Explore World Data" };
    case "geo-economy":
    default:
      return { moduleHref: "/monetary", moduleLabel: "Explore Monetary Data" };
  }
}

export function stableId(sourceId: PulseSourceId, url: string, title: string) {
  const input = `${sourceId}|${url}|${title}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${sourceId}-${(hash >>> 0).toString(36)}`;
}

export function freshnessScore(publishedAt: string | null) {
  if (!publishedAt) return 0;
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours)) return 0;
  if (ageHours <= 6) return 28;
  if (ageHours <= 24) return 20;
  if (ageHours <= 72) return 12;
  if (ageHours <= 168) return 6;
  return 0;
}

function titleKey(title: string) {
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "as",
    "at",
    "by",
    "from",
    "is",
    "are",
    "was",
    "were",
  ]);

  return cleanText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stop.has(word))
    .slice(0, 16);
}

function overlapScore(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const aa = new Set(a);
  const bb = new Set(b);
  let intersection = 0;
  aa.forEach((word) => {
    if (bb.has(word)) intersection += 1;
  });
  return intersection / Math.max(aa.size, bb.size);
}

export function dedupeItems(items: PulseItem[]) {
  const output: PulseItem[] = [];
  const seenUrls = new Set<string>();

  for (const item of items) {
    const normalizedUrl = item.url.replace(/\/$/, "").toLowerCase();
    if (seenUrls.has(normalizedUrl)) continue;

    const key = titleKey(item.title);
    const duplicate = output.some((existing) => {
      const other = titleKey(existing.title);
      return overlapScore(key, other) >= 0.78;
    });

    if (duplicate) continue;
    seenUrls.add(normalizedUrl);
    output.push(item);
  }

  return output;
}

export function buildTrending(items: PulseItem[]): PulseTrendingItem[] {
  const map = new Map<
    Exclude<PulseTopic, "all">,
    { count: number; score: number }
  >();

  items.forEach((item) => {
    item.topics.forEach((topic) => {
      const current = map.get(topic) ?? { count: 0, score: 0 };
      current.count += 1;
      current.score += item.score;
      map.set(topic, current);
    });
  });

  return Array.from(map.entries())
    .map(([topic, value]) => ({
      topic,
      label: TOPIC_LABELS[topic],
      count: value.count,
      score: Math.round(value.score),
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 8);
}

export function sourceStatus(
  id: PulseSourceId,
  label: string,
  configured: boolean,
  items: PulseItem[],
  error: unknown,
): PulseSourceStatus {
  return {
    id,
    label,
    ok: !error && (configured ? true : id !== "reliefweb"),
    count: items.length,
    configured,
    error:
      error instanceof Error
        ? error.message
        : error
          ? String(error)
          : configured
            ? null
            : "Setup required",
  };
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  timeoutMs = 12_000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json, application/rss+xml, application/xml, text/xml, */*",
        "User-Agent":
          "Stratify-Global-Pulse/1.0 (+https://worldstats360.com)",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function xmlTag(block: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"),
  );
  return match?.[1] ?? "";
}

export function xmlAttribute(block: string, tag: string, attr: string) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttr = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(
      `<${escapedTag}[^>]*\\s${escapedAttr}=["']([^"']+)["'][^>]*>`,
      "i",
    ),
  );
  return match?.[1] ?? "";
}
