import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistoryTab =
  | "conflicts"
  | "battles"
  | "revolutions"
  | "empires"
  | "civilizations";

type BindingValue = {
  type?: string;
  value?: string;
  datatype?: string;
};

type SparqlRow = Record<string, BindingValue>;

type HistoryEvent = {
  qid?: string | null;
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

const TAB_CONFIG: Record<HistoryTab, { label: string; classes: string[] }> = {
  conflicts: {
    label: "Wars & Conflicts",
    classes: ["Q198", "Q8465", "Q180684", "Q350604"],
  },
  battles: {
    label: "Battles & Sieges",
    classes: ["Q178561", "Q188055", "Q645883"],
  },
  revolutions: {
    label: "Independence & Revolutions",
    classes: ["Q10931", "Q45382", "Q124734"],
  },
  empires: {
    label: "Empires & Kingdoms",
    classes: ["Q48349", "Q3024240", "Q1790360"],
  },
  civilizations: {
    label: "Empires & Civilizations",
    classes: ["Q8432", "Q3024240"],
  },
};

const WAR_SOURCE_PAGES = [
  { title: "List of wars: before 1000", from: -5000, to: 999 },
  { title: "List of wars: 1000–1499", from: 1000, to: 1499 },
  { title: "List of wars: 1500–1799", from: 1500, to: 1799 },
  { title: "List of wars: 1800–1899", from: 1800, to: 1899 },
  { title: "List of wars: 1900–1944", from: 1900, to: 1944 },
  { title: "List of wars: 1945–1989", from: 1945, to: 1989 },
  { title: "List of wars: 1990–2002", from: 1990, to: 2002 },
  { title: "List of wars: 2003–2019", from: 2003, to: 2019 },
  { title: "List of wars: 2020–present", from: 2020, to: 2026 },
];

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
        .replace(/<br\s*\/?>/gi, " | ")
        .replace(/<\/li>/gi, " | ")
        .replace(/<\/p>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function firstWikiUrl(html: string) {
  const match = String(html || "").match(/href="(\/wiki\/[^"#:]*)"/i);
  if (!match) return null;
  return `https://en.wikipedia.org${match[1]}`;
}

function parseYearCell(value: string): number | null {
  const text = htmlToText(value).toLowerCase();

  if (!text) return null;
  if (text.includes("present") || text.includes("ongoing")) return 2026;

  const bc = text.match(/(\d{1,5})\s*bc/i);
  if (bc) {
    const n = Number(bc[1]);
    return Number.isFinite(n) ? -n : null;
  }

  const year = text.match(/-?\d{1,5}/);
  if (!year) return null;

  const n = Number(year[0]);
  return Number.isFinite(n) ? n : null;
}

function trimText(value: string | null, max = 260) {
  const text = cleanText(value);
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function overlapsPeriod(
  startYear: number | null,
  endYear: number | null,
  from: number,
  to: number,
) {
  if (startYear === null) return false;
  const safeEnd = endYear ?? startYear;
  return startYear <= to && safeEnd >= from;
}

function eventKey(event: HistoryEvent) {
  return cleanText(event.articleUrl || event.title).toLowerCase();
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
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "StratifyAnalytics/1.0 (https://worldstats360.com; history-war-list)",
      },
      cache: "no-store",
    });

    if (!response.ok) return "";

    const json = await response.json();
    return String(json?.parse?.text?.["*"] || "");
  } finally {
    clearTimeout(timeout);
  }
}

function parseWarListRows(html: string, sourceTitle: string): HistoryEvent[] {
  const rows = Array.from(String(html || "").matchAll(/<tr[\s\S]*?<\/tr>/gi));
  const events: HistoryEvent[] = [];

  for (const rowMatch of rows) {
    const rowHtml = rowMatch[0];

    const cells = Array.from(
      rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ).map((match) => match[1]);

    if (cells.length < 3) continue;

    const startYear = parseYearCell(cells[0]);
    const endYear = parseYearCell(cells[1]) ?? startYear;
    const nameCell = cells[2];

    const rawTitle = htmlToText(nameCell);
    const title = rawTitle
      .split("|")[0]
      .replace(/\s*;\s*part of.*$/i, "")
      .replace(/^name of conflict$/i, "")
      .replace(/^conflict$/i, "")
      .trim();

    if (startYear === null || !title || title.length < 3) continue;
    if (/^start$/i.test(title) || /^finish$/i.test(title)) continue;

    const articleUrl = firstWikiUrl(nameCell);

    const sideA = cells[3] ? htmlToText(cells[3]) : "";
    const sideB = cells[4] ? htmlToText(cells[4]) : "";
    const description = trimText([sideA, sideB].filter(Boolean).join(" | "));

    events.push({
      qid: null,
      title,
      description,
      type: "war / conflict",
      year: startYear,
      startYear,
      endYear,
      startDate: String(startYear),
      endDate: endYear !== null ? String(endYear) : null,
      articleUrl,
      source: `Wikipedia · ${sourceTitle}`,
    });
  }

  return events;
}

async function fetchWarsFromWikipediaLists(from: number, to: number) {
  const sourcePages = WAR_SOURCE_PAGES.filter(
    (page) => page.from <= to && page.to >= from,
  );

  const pageResults = await Promise.all(
    sourcePages.map(async (source) => {
      try {
        const html = await fetchWikipediaPageHtml(source.title);
        return parseWarListRows(html, source.title).filter((event) =>
          overlapsPeriod(event.startYear, event.endYear, from, to),
        );
      } catch {
        return [];
      }
    }),
  );

  const map = new Map<string, HistoryEvent>();

  for (const event of pageResults.flat()) {
    const key = eventKey(event);
    if (!key) continue;
    if (!map.has(key)) map.set(key, event);
  }

  return Array.from(map.values());
}

function binding(row: SparqlRow, key: string) {
  return cleanText(row[key]?.value || "");
}

function qidFromUri(uri: string) {
  const clean = cleanText(uri);
  const parts = clean.split("/");
  return parts[parts.length - 1] || clean;
}

function parseYear(value: string): number | null {
  const s = cleanText(value);
  if (!s) return null;

  const direct = Number(s);
  if (Number.isFinite(direct)) return Math.trunc(direct);

  const match = s.match(/^(-?\d{1,6})/);
  if (!match) return null;

  const year = Number(match[1]);
  return Number.isFinite(year) ? Math.trunc(year) : null;
}

function buildWikidataQuery(args: {
  tab: HistoryTab;
  from: number;
  to: number;
  limit: number;
  offset: number;
}) {
  const config = TAB_CONFIG[args.tab];
  const classes = config.classes.map((qid) => `wd:${qid}`).join(" ");

  return `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>

SELECT DISTINCT
  ?item
  ?itemLabel
  ?itemDescription
  ?classLabel
  ?startDate
  ?endDate
  ?startYear
  ?endYear
  ?article
WHERE {
  VALUES ?class { ${classes} }

  ?item wdt:P31/wdt:P279* ?class .

  OPTIONAL { ?item wdt:P585 ?pointDate. }
  OPTIONAL { ?item wdt:P580 ?directStartDate. }
  OPTIONAL { ?item wdt:P571 ?inceptionDate. }

  BIND(COALESCE(?directStartDate, ?pointDate, ?inceptionDate) AS ?startDate)
  FILTER(BOUND(?startDate))

  OPTIONAL { ?item wdt:P582 ?directEndDate. }
  OPTIONAL { ?item wdt:P576 ?dissolvedDate. }

  BIND(COALESCE(?directEndDate, ?dissolvedDate, ?pointDate, ?startDate) AS ?endDate)

  BIND(YEAR(?startDate) AS ?startYear)
  BIND(YEAR(?endDate) AS ?endYear)

  FILTER(?startYear <= ${args.to} && ?endYear >= ${args.from})

  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
}
ORDER BY ASC(?startYear) ?itemLabel
LIMIT ${args.limit}
OFFSET ${args.offset}
`;
}

async function queryWikidata(sparql: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const body = new URLSearchParams();
    body.set("query", sparql);
    body.set("format", "json");

    const response = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "StratifyAnalytics/1.0 (https://worldstats360.com; history-wikidata)",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) return [];

    const json = (await response.json()) as {
      results?: {
        bindings?: SparqlRow[];
      };
    };

    return json.results?.bindings || [];
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWikidataRows(rows: SparqlRow[]): HistoryEvent[] {
  const map = new Map<string, HistoryEvent>();

  for (const row of rows) {
    const qid = qidFromUri(binding(row, "item"));
    const title = binding(row, "itemLabel");

    if (!qid || !title) continue;
    if (map.has(qid)) continue;

    const startYear = parseYear(binding(row, "startYear"));
    const endYear = parseYear(binding(row, "endYear"));

    map.set(qid, {
      qid,
      title,
      description: trimText(binding(row, "itemDescription") || null),
      type: binding(row, "classLabel") || "Historical event",
      year: startYear,
      startYear,
      endYear,
      startDate: binding(row, "startDate") || null,
      endDate: binding(row, "endDate") || null,
      articleUrl:
        binding(row, "article") || `https://www.wikidata.org/wiki/${qid}`,
      source: "Wikidata / Wikipedia",
    });
  }

  return Array.from(map.values());
}

async function fetchFromWikidata(
  tab: HistoryTab,
  from: number,
  to: number,
  pageSize: number,
  offset: number,
) {
  const rows = await queryWikidata(
    buildWikidataQuery({
      tab,
      from,
      to,
      limit: pageSize + 1,
      offset,
    }),
  );

  return normalizeWikidataRows(rows);
}

function sortEvents(events: HistoryEvent[]) {
  return events.sort((a, b) => {
    const ay = a.startYear ?? a.year ?? 999999;
    const by = b.startYear ?? b.year ?? 999999;
    if (ay !== by) return ay - by;
    return a.title.localeCompare(b.title);
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const tabRaw = cleanText(searchParams.get("tab") || "conflicts");
    const tab = Object.prototype.hasOwnProperty.call(TAB_CONFIG, tabRaw)
      ? (tabRaw as HistoryTab)
      : "conflicts";

    const from = asInt(searchParams.get("from"), -5000);
    const to = asInt(searchParams.get("to"), 2026);
    const page = clamp(asInt(searchParams.get("page"), 1), 1, 5000);
    const pageSize = clamp(asInt(searchParams.get("pageSize"), 25), 10, 50);
    const offset = (page - 1) * pageSize;

    const normalizedFrom = Math.min(from, to);
    const normalizedTo = Math.max(from, to);

    let events: HistoryEvent[] = [];
    let total: number | null = null;
    let hasMore = false;
    let warning: string | null = null;
    let queryMode = "wikidata-paged";

    if (tab === "conflicts") {
      try {
        const all = sortEvents(
          await fetchWarsFromWikipediaLists(normalizedFrom, normalizedTo),
        );

        total = all.length;
        events = all.slice(offset, offset + pageSize);
        hasMore = offset + pageSize < all.length;
        queryMode = "wikipedia-war-list-paged";
      } catch {
        warning = "Wikipedia list source failed. Trying Wikidata fallback.";
      }
    }

    if (!events.length && tab !== "conflicts") {
      const rows = await fetchFromWikidata(
        tab,
        normalizedFrom,
        normalizedTo,
        pageSize,
        offset,
      );

      hasMore = rows.length > pageSize;
      events = rows.slice(0, pageSize);
      total = null;
      queryMode = "wikidata-paged";
    }

    if (!events.length && tab === "conflicts" && warning) {
      const rows = await fetchFromWikidata(
        tab,
        normalizedFrom,
        normalizedTo,
        pageSize,
        offset,
      );

      hasMore = rows.length > pageSize;
      events = rows.slice(0, pageSize);
      total = null;
      queryMode = "wikidata-fallback-paged";
    }

    return NextResponse.json(
      {
        ok: true,
        tab,
        label: TAB_CONFIG[tab].label,
        from: normalizedFrom,
        to: normalizedTo,
        page,
        pageSize,
        events,
        total,
        hasMore,
        warning,
        source:
          tab === "conflicts"
            ? "Wikipedia list pages + Wikidata fallback"
            : "Wikidata Query Service",
        queryMode,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: true,
        events: [],
        total: 0,
        hasMore: false,
        warning: "No record returned for this filter.",
      },
      { status: 200 },
    );
  }
}
