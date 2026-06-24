import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SourcePage = {
  label: string;
  page: string;
  category: string;
};

type HistoryRecord = {
  id: string;
  timeline: string;
  year: number;
  startYear: number;
  endYear: number;
  fromYear: number;
  toYear: number;
  title: string;
  record: string;
  type: string;
  category: string;
  source: string;
  description: string;
  summary: string;
  extract: string;
  url: string | null;
  wikiUrl: string | null;
  articleUrl: string | null;
};

const WIKI_ORIGIN = "https://en.wikipedia.org";

const REVOLUTION_SOURCES: SourcePage[] = [
  {
    label: "List of revolutions and rebellions",
    page: "List_of_revolutions_and_rebellions",
    category: "INDEPENDENCE / REVOLUTION",
  },
];

const WAR_SOURCES: SourcePage[] = [
  {
    label: "List of wars: 1500–1799",
    page: "List_of_wars:_1500%E2%80%931799",
    category: "WAR / CONFLICT",
  },
  {
    label: "List of wars: 1800–1899",
    page: "List_of_wars:_1800%E2%80%931899",
    category: "WAR / CONFLICT",
  },
  {
    label: "List of wars: 1900–1944",
    page: "List_of_wars:_1900%E2%80%931944",
    category: "WAR / CONFLICT",
  },
  {
    label: "List of wars: 1945–1989",
    page: "List_of_wars:_1945%E2%80%931989",
    category: "WAR / CONFLICT",
  },
  {
    label: "List of wars: 1990–2002",
    page: "List_of_wars:_1990%E2%80%932002",
    category: "WAR / CONFLICT",
  },
  {
    label: "List of wars: 2003–2019",
    page: "List_of_wars:_2003%E2%80%932019",
    category: "WAR / CONFLICT",
  },
  {
    label: "List of wars: 2020–present",
    page: "List_of_wars:_2020%E2%80%93present",
    category: "WAR / CONFLICT",
  },
];

function decodeEntities(value: string) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanHtml(value: string) {
  return decodeEntities(String(value ?? ""))
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
    .replace(/<span[^>]*class="mw-editsection"[\s\S]*?<\/span>/gi, " ")
    .replace(/<br\s*\/?>/gi, " | ")
    .replace(/<\/li>/gi, " | ")
    .replace(/<\/p>/gi, " | ")
    .replace(/<\/div>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\s*\d+\s*\]/g, " ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+/g, " ")
    .trim();
}

function keyOf(value: unknown) {
  return cleanHtml(String(value ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyEra(year: number, era?: string | null) {
  const e = String(era ?? "").toUpperCase();
  return e === "BC" || e === "BCE" ? -Math.abs(year) : year;
}

function expandShortEndYear(start: number, endRaw: string) {
  const end = Number(endRaw);
  if (!Number.isFinite(end)) return start;

  const startAbs = Math.abs(start);
  const endDigits = endRaw.length;
  const startDigits = String(startAbs).length;

  if (start > 0 && endDigits < startDigits) {
    const factor = Math.pow(10, endDigits);
    let expanded = Math.floor(start / factor) * factor + end;
    if (expanded < start) expanded += factor;
    return expanded;
  }

  return end;
}

function parseYearRange(textValue: string) {
  const text = cleanHtml(textValue)
    .replace(/,/g, "")
    .replace(/[−‐-‒–—]/g, "-");

  const range = text.match(
    /(?:c\.?\s*)?(\d{1,4})\s*(BC|BCE|AD|CE)?\s*(?:-|to|until|through)\s*(?:c\.?\s*)?(\d{1,4}|present|ongoing)\s*(BC|BCE|AD|CE)?/i
  );

  if (range) {
    const startRaw = range[1];
    const startEra = range[2];
    const endRaw = range[3];
    const endEra = range[4] || startEra;

    let startYear = Number(startRaw);
    if (!Number.isFinite(startYear)) return null;

    startYear = applyEra(startYear, startEra);

    let endYear: number;

    if (/present|ongoing/i.test(endRaw)) {
      endYear = new Date().getUTCFullYear();
    } else {
      endYear = expandShortEndYear(startYear, endRaw);
      endYear = applyEra(endYear, endEra);
    }

    return { startYear, endYear };
  }

  const single = text.match(/(?:^|[^\d])(?:c\.?\s*)?(\d{1,4})\s*(BC|BCE|AD|CE)?(?:$|[^\d])/i);
  if (!single) return null;

  const year = applyEra(Number(single[1]), single[2]);
  if (!Number.isFinite(year)) return null;

  return { startYear: year, endYear: year };
}

function startsWithYear(text: string) {
  return /^\s*(?:c\.?\s*)?\d{1,4}\s*(?:BC|BCE|AD|CE)?/i.test(cleanHtml(text));
}

function extractCells(rowHtml: string) {
  const cells: { raw: string; text: string }[] = [];
  const re = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(rowHtml))) {
    const raw = match[2] ?? "";
    const text = cleanHtml(raw);
    if (text) cells.push({ raw, text });
  }

  return cells;
}

function firstArticle(rawHtml: string) {
  const re = /<a\b[^>]*href="\/wiki\/([^"#?:]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(rawHtml))) {
    const href = decodeURIComponent(match[1] ?? "");
    const title = cleanHtml(match[2] ?? "");

    if (!href || !title) continue;

    if (
      href.startsWith("File:") ||
      href.startsWith("Help:") ||
      href.startsWith("Special:") ||
      href.startsWith("Category:") ||
      href.startsWith("Template:") ||
      href.startsWith("Wikipedia:") ||
      href.startsWith("Portal:")
    ) {
      continue;
    }

    return {
      title,
      url: `${WIKI_ORIGIN}/wiki/${encodeURIComponent(href).replace(/%2F/g, "/")}`,
    };
  }

  return null;
}

function timelineLabel(startYear: number, endYear: number) {
  if (startYear === endYear) {
    return startYear < 0 ? `${Math.abs(startYear)} BC` : String(startYear);
  }

  const s = startYear < 0 ? `${Math.abs(startYear)} BC` : String(startYear);
  const e = endYear < 0 ? `${Math.abs(endYear)} BC` : String(endYear);

  return `${s}-${e}`;
}

function makeRecord(args: {
  source: SourcePage;
  title: string;
  startYear: number;
  endYear: number;
  summary: string;
  url: string | null;
}) {
  const title = cleanHtml(args.title);
  const summary = cleanHtml(args.summary || title);

  const record: HistoryRecord = {
    id: `${args.source.page}-${args.startYear}-${args.endYear}-${keyOf(title)}`,
    timeline: timelineLabel(args.startYear, args.endYear),
    year: args.startYear,
    startYear: args.startYear,
    endYear: args.endYear,
    fromYear: args.startYear,
    toYear: args.endYear,
    title,
    record: title,
    type: args.source.category,
    category: args.source.category,
    source: args.source.label,
    description: summary,
    summary,
    extract: summary,
    url: args.url,
    wikiUrl: args.url,
    articleUrl: args.url,
  };

  return record;
}

function parseTableRows(html: string, source: SourcePage) {
  const records: HistoryRecord[] = [];
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];

  for (const rowHtml of rows) {
    const cells = extractCells(rowHtml);
    if (cells.length < 2) continue;

    let startYear: number | null = null;
    let endYear: number | null = null;
    let titleIndex = -1;

    const firstYears = parseYearRange(cells[0]?.text ?? "");
    const secondYears = parseYearRange(cells[1]?.text ?? "");

    if (
      cells.length >= 3 &&
      firstYears &&
      secondYears &&
      startsWithYear(cells[0].text) &&
      startsWithYear(cells[1].text)
    ) {
      startYear = firstYears.startYear;
      endYear = secondYears.startYear;
      titleIndex = 2;
    } else if (firstYears && startsWithYear(cells[0].text)) {
      startYear = firstYears.startYear;
      endYear = firstYears.endYear;
      titleIndex = 1;
    } else if (secondYears && startsWithYear(cells[1].text)) {
      startYear = secondYears.startYear;
      endYear = secondYears.endYear;
      titleIndex = 0;
    }

    if (startYear === null || endYear === null || titleIndex < 0) continue;

    const titleCell = cells[titleIndex];
    if (!titleCell) continue;

    const article = firstArticle(titleCell.raw);
    const title = article?.title || titleCell.text;
    const titleKey = keyOf(title);

    if (
      !titleKey ||
      titleKey === "event" ||
      titleKey === "conflict" ||
      titleKey === "name of conflict" ||
      titleKey === "date" ||
      titleKey === "result"
    ) {
      continue;
    }

    const summary = cells
      .filter((_, i) => i !== titleIndex)
      .map((c) => c.text)
      .filter(Boolean)
      .slice(0, 6)
      .join(" | ");

    records.push(
      makeRecord({
        source,
        title,
        startYear,
        endYear,
        summary,
        url: article?.url ?? null,
      })
    );
  }

  return records;
}

function fallbackTitleFromListText(text: string) {
  const cleaned = cleanHtml(text)
    .replace(/^\*?\s*(?:c\.?\s*)?\d{1,4}\s*(?:BC|BCE|AD|CE)?\s*(?:[-–—]\s*(?:c\.?\s*)?\d{1,4}\s*(?:BC|BCE|AD|CE)?)?\s*[:;,-]?\s*/i, "")
    .replace(/^the\s+/i, "")
    .trim();

  return cleaned.split(/[.;|]/)[0]?.trim() || cleaned.slice(0, 90);
}

function parseListItems(html: string, source: SourcePage) {
  const records: HistoryRecord[] = [];
  const items = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];

  for (const raw of items) {
    const text = cleanHtml(raw);
    if (!text || text.length < 8) continue;
    if (!startsWithYear(text)) continue;

    const years = parseYearRange(text);
    if (!years) continue;

    const article = firstArticle(raw);
    const title = article?.title || fallbackTitleFromListText(text);
    const titleKey = keyOf(title);

    if (
      !titleKey ||
      titleKey.includes("isbn") ||
      titleKey.includes("citation needed") ||
      titleKey === "edit" ||
      titleKey === "main article" ||
      titleKey === "see also" ||
      titleKey === "references" ||
      titleKey === "external links"
    ) {
      continue;
    }

    records.push(
      makeRecord({
        source,
        title,
        startYear: years.startYear,
        endYear: years.endYear,
        summary: text,
        url: article?.url ?? null,
      })
    );
  }

  return records;
}

function dedupe(records: HistoryRecord[]) {
  const seen = new Set<string>();
  const output: HistoryRecord[] = [];

  for (const r of records) {
    const key = `${r.startYear}|${r.endYear}|${keyOf(r.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(r);
  }

  return output;
}

async function fetchWikiHtml(page: string) {
  const url = new URL(`${WIKI_ORIGIN}/w/api.php`);
  url.searchParams.set("action", "parse");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("prop", "text");
  url.searchParams.set("page", decodeURIComponent(page));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "Stratify-History-Module/1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Wikipedia fetch failed for ${page}: ${res.status}`);
  }

  const json = await res.json();
  return String(json?.parse?.text?.["*"] ?? "");
}

function getSources(sourceValue: string) {
  const key = keyOf(sourceValue);

  if (
    key.includes("war") ||
    key.includes("conflict") ||
    key.includes("battle") ||
    key.includes("military")
  ) {
    return WAR_SOURCES;
  }

  return REVOLUTION_SOURCES;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const source =
      searchParams.get("source") ||
      searchParams.get("sourceIndex") ||
      searchParams.get("sourceTitle") ||
      "Revolutions & rebellions";

    const sources = getSources(source);

    const parsedGroups = await Promise.all(
      sources.map(async (src) => {
        const html = await fetchWikiHtml(src.page);
        return [...parseTableRows(html, src), ...parseListItems(html, src)];
      })
    );

    const records = dedupe(parsedGroups.flat()).sort((a, b) => {
      if (a.startYear !== b.startYear) return a.startYear - b.startYear;
      if (a.endYear !== b.endYear) return a.endYear - b.endYear;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json(
      {
        ok: true,
        source,
        totalRecords: records.length,
        records,
        events: records,
        items: records,
        data: records,
        meta: {
          parser: "generic-wikipedia-parser",
          hardcodedEvents: false,
          filtering: "frontend-single-source-of-truth",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("History API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown history API error",
        records: [],
        events: [],
        items: [],
        data: [],
      },
      { status: 500 }
    );
  }
}


