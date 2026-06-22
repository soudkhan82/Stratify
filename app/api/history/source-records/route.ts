import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SegmentKey =
  | "wars"
  | "battles"
  | "revolutions"
  | "empires"
  | "civilizations";

type SourcePage = {
  key: string;
  label: string;
  title: string;
  type: string;
};

type HistoryRecord = {
  qid: string | null;
  title: string;
  description: string | null;
  type: string;
  year: number | null;
  startYear: number | null;
  endYear: number | null;
  startDate: string | null;
  endDate: string | null;
  articleUrl: string | null;
  source: string;
};

const SOURCE_CONFIG: Record<
  SegmentKey,
  {
    label: string;
    sources: SourcePage[];
  }
> = {
  wars: {
    label: "Wars & Conflicts",
    sources: [
      { key: "wars-before-1000", label: "Before 1000", title: "List of wars: before 1000", type: "war / conflict" },
      { key: "wars-1000-1499", label: "1000–1499", title: "List of wars: 1000–1499", type: "war / conflict" },
      { key: "wars-1500-1799", label: "1500–1799", title: "List of wars: 1500–1799", type: "war / conflict" },
      { key: "wars-1800-1899", label: "1800–1899", title: "List of wars: 1800–1899", type: "war / conflict" },
      { key: "wars-1900-1944", label: "1900–1944", title: "List of wars: 1900–1944", type: "war / conflict" },
      { key: "wars-1945-1989", label: "1945–1989", title: "List of wars: 1945–1989", type: "war / conflict" },
      { key: "wars-1990-2002", label: "1990–2002", title: "List of wars: 1990–2002", type: "war / conflict" },
      { key: "wars-2003-2019", label: "2003–2019", title: "List of wars: 2003–2019", type: "war / conflict" },
      { key: "wars-2020-present", label: "2020–present", title: "List of wars: 2020–present", type: "war / conflict" },
    ],
  },
  battles: {
    label: "Battles & Sieges",
    sources: [
      { key: "battles-before-301", label: "Before 301", title: "List of battles before 301", type: "battle / siege" },
      { key: "battles-301-1300", label: "301–1300", title: "List of battles 301–1300", type: "battle / siege" },
      { key: "battles-1301-1600", label: "1301–1600", title: "List of battles 1301–1600", type: "battle / siege" },
      { key: "battles-1601-1800", label: "1601–1800", title: "List of battles 1601–1800", type: "battle / siege" },
      { key: "battles-1801-1900", label: "1801–1900", title: "List of battles 1801–1900", type: "battle / siege" },
      { key: "battles-1901-2000", label: "1901–2000", title: "List of battles 1901–2000", type: "battle / siege" },
      { key: "battles-since-2001", label: "Since 2001", title: "List of battles since 2001", type: "battle / siege" },
    ],
  },
  revolutions: {
    label: "Independence & Revolutions",
    sources: [
      { key: "revolutions-rebellions", label: "Revolutions & rebellions", title: "List of revolutions and rebellions", type: "revolution / uprising" },
      { key: "coups", label: "Coups", title: "List of coups and coup attempts", type: "coup / political change" },
      { key: "independence", label: "Independence movements", title: "List of national independence movements", type: "independence movement" },
    ],
  },
  empires: {
    label: "Empires & Kingdoms",
    sources: [
      { key: "empires-list", label: "Empires", title: "List of empires", type: "empire / kingdom" },
      { key: "largest-empires", label: "Largest empires", title: "List of largest empires", type: "empire / kingdom" },
    ],
  },
  civilizations: {
    label: "Empires & Civilizations",
    sources: [
      { key: "ancient-civilizations", label: "Ancient civilizations", title: "List of ancient civilizations", type: "civilization / historical entity" },
      { key: "bronze-age-states", label: "Bronze Age states", title: "List of Bronze Age states", type: "civilization / historical entity" },
      { key: "iron-age-states", label: "Iron Age states", title: "List of Iron Age states", type: "civilization / historical entity" },
      { key: "classical-age-states", label: "Classical Age states", title: "List of Classical Age states", type: "civilization / historical entity" },
    ],
  },
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&minus;/g, "-")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    });
}

function htmlToText(html: string) {
  return cleanText(
    decodeHtml(
      String(html || "")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<sup\b[\s\S]*?<\/sup>/gi, " ")
        .replace(/<span\b[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi, " ")
        .replace(/<br\s*\/?>/gi, " | ")
        .replace(/<\/li>/gi, " | ")
        .replace(/<\/p>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function getWikiLinks(html: string) {
  const links: Array<{ url: string; label: string }> = [];

  for (const match of String(html || "").matchAll(/<a\b[^>]*href="(\/wiki\/[^"#:]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1] || "";
    const label = htmlToText(match[2] || "");

    if (!href || !label) continue;
    if (href.includes(":")) continue;
    if (href.includes("redlink=1")) continue;
    if (/^list of /i.test(label)) continue;
    if (/^(edit|history|citation needed|ISBN|ISSN)$/i.test(label)) continue;

    links.push({
      url: `https://en.wikipedia.org${href}`,
      label,
    });
  }

  return links;
}

function parseYears(text: string) {
  const years: number[] = [];

  for (const match of cleanText(text).matchAll(/(\d{1,5})\s*BC/gi)) {
    const n = Number(match[1]);
    if (Number.isFinite(n)) years.push(-n);
  }

  const withoutBc = cleanText(text).replace(/\d{1,5}\s*BC/gi, " ");

  for (const match of withoutBc.matchAll(/(^|\D)(\d{3,4})(?=\D|$)/g)) {
    const n = Number(match[2]);
    if (Number.isFinite(n)) years.push(n);
  }

  return years;
}

function trimText(value: string | null, max = 320) {
  const text = cleanText(value);
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function eventKey(event: HistoryRecord) {
  return cleanText(event.articleUrl || event.title).toLowerCase();
}

function parseBlock(html: string, source: SourcePage): HistoryRecord | null {
  const text = htmlToText(html);
  if (!text || text.length < 5) return null;

  const links = getWikiLinks(html);
  const firstLink = links[0];

  if (!firstLink) return null;

  const title = cleanText(firstLink.label);

  if (!title || title.length < 3) return null;
  if (/^(date|year|name|start|finish|combatant|result|type|location)$/i.test(title)) return null;

  const years = parseYears(text);
  const startYear = years.length ? years[0] : null;
  const endYear = years.length > 1 ? years[1] : startYear;

  const description = trimText(
    text
      .replace(title, "")
      .replace(/\|\s*\|/g, "|")
      .replace(/^\s*[|:;,-]+/, "")
      .trim() || source.label,
  );

  return {
    qid: null,
    title,
    description,
    type: source.type,
    year: startYear,
    startYear,
    endYear,
    startDate: startYear !== null ? String(startYear) : null,
    endDate: endYear !== null ? String(endYear) : null,
    articleUrl: firstLink.url,
    source: `Wikipedia · ${source.title}`,
  };
}

function parsePage(html: string, source: SourcePage) {
  const records: HistoryRecord[] = [];

  const rows = Array.from(String(html || "").matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((m) => m[0]);
  const items = Array.from(String(html || "").matchAll(/<li[\s\S]*?<\/li>/gi)).map((m) => m[0]);

  for (const block of [...rows, ...items]) {
    const parsed = parseBlock(block, source);
    if (parsed) records.push(parsed);
  }

  const map = new Map<string, HistoryRecord>();

  for (const record of records) {
    const key = eventKey(record);
    if (!key) continue;
    if (!map.has(key)) map.set(key, record);
  }

  return Array.from(map.values()).sort((a, b) => {
    const ay = a.startYear ?? a.year ?? 999999;
    const by = b.startYear ?? b.year ?? 999999;
    if (ay !== by) return ay - by;
    return a.title.localeCompare(b.title);
  });
}

async function fetchWikipediaPageHtml(title: string) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "text");
  url.searchParams.set("format", "json");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("origin", "*");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "StratifyAnalytics/1.0 (https://worldstats360.com; segment-source-records)",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return "";

    const json = await response.json();
    return String(json?.parse?.text?.["*"] || "");
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function buildBuckets(records: HistoryRecord[]) {
  const map = new Map<number, number>();

  for (const record of records) {
    const y = record.startYear ?? record.year;
    if (y === null || y === undefined || !Number.isFinite(y)) continue;

    const bucket = y > 0 ? Math.floor((y - 1) / 100) * 100 + 1 : Math.floor(y / 100) * 100;
    map.set(bucket, (map.get(bucket) || 0) + 1);
  }

  const rows = Array.from(map.entries())
    .map(([bucket, count]) => ({
      bucket,
      label:
        bucket < 0
          ? `${Math.abs(bucket)}–${Math.abs(bucket + 99)} BC`
          : `${bucket}–${bucket + 99}`,
      count,
    }))
    .sort((a, b) => a.bucket - b.bucket);

  const max = Math.max(...rows.map((r) => r.count), 1);

  return rows.map((row) => ({
    ...row,
    pct: Math.max(7, Math.round((row.count / max) * 100)),
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const segmentRaw = cleanText(searchParams.get("segment") || "wars") as SegmentKey;
  const segment = SOURCE_CONFIG[segmentRaw] ? segmentRaw : "wars";

  const sourceKey = cleanText(searchParams.get("sourceKey") || "");
  const page = clamp(asInt(searchParams.get("page"), 1), 1, 5000);
  const pageSize = clamp(asInt(searchParams.get("pageSize"), 25), 10, 50);
  const q = cleanText(searchParams.get("q") || "").toLowerCase();

  const config = SOURCE_CONFIG[segment];
  const source = config.sources.find((s) => s.key === sourceKey) || config.sources[0];

  try {
    const html = await fetchWikipediaPageHtml(source.title);
    let records = parsePage(html, source);

    if (q) {
      records = records.filter((record) => {
        const haystack = [
          record.title,
          record.description,
          record.type,
          record.source,
          record.startYear,
          record.endYear,
        ]
          .map((x) => cleanText(x).toLowerCase())
          .join(" ");

        return haystack.includes(q);
      });
    }

    const total = records.length;
    const offset = (page - 1) * pageSize;
    const events = records.slice(offset, offset + pageSize);
    const hasMore = offset + pageSize < total;

    return NextResponse.json(
      {
        ok: true,
        segment,
        label: config.label,
        sourceKey: source.key,
        sourceLabel: source.label,
        sourceTitle: source.title,
        page,
        pageSize,
        events,
        total,
        hasMore,
        buckets: buildBuckets(records),
        source: "Wikipedia source page",
        queryMode: "single-source-lazy-tab",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: true,
        segment,
        label: config.label,
        sourceKey: source.key,
        sourceLabel: source.label,
        events: [],
        total: 0,
        hasMore: false,
        buckets: [],
        warning:
          error instanceof Error ? error.message : "Source page returned no records.",
      },
      { status: 200 },
    );
  }
}
