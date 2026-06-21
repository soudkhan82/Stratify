import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BindingValue = {
  type?: string;
  value?: string;
};

type SparqlRow = Record<string, BindingValue>;

type WikiSection = {
  title: string;
  paragraphs: string[];
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\[citation needed\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToText(html: string) {
  return cleanText(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<sup\b[^>]*class="[^"]*reference[^"]*"[\s\S]*?<\/sup>/gi, " ")
      .replace(/<span\b[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

function binding(row: SparqlRow, key: string) {
  return cleanText(row[key]?.value || "");
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const clean = cleanText(value);
    if (!clean) continue;

    const key = clean.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(clean);
  }

  return out;
}

function parsePoint(value: string): { lat: number; lng: number } | null {
  const s = cleanText(value);
  const match = s.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (!match) return null;

  const lng = Number(match[1]);
  const lat = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function yearFromDate(value: string) {
  const clean = cleanText(value);
  const match = clean.match(/^(-?\d{1,6})/);
  if (!match) return null;

  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function dateLabel(value: string | null) {
  if (!value) return null;

  const year = yearFromDate(value);
  if (year === null) return value;

  if (year < 0) return `${Math.abs(year)} BC`;
  return String(year);
}

function articleTitleFromUrl(url: string | null) {
  if (!url) return "";

  try {
    const last = decodeURIComponent(url.split("/wiki/")[1] || "");
    return last.replace(/_/g, " ");
  } catch {
    return "";
  }
}

function sectionTitleFromHeading(html: string) {
  return htmlToText(html)
    .replace(/\[edit\]/gi, "")
    .replace(/Contents/gi, "")
    .trim();
}

function extractParagraphs(html: string, limit = 2) {
  return Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => htmlToText(match[1]))
    .filter((text) => text.length >= 80)
    .slice(0, limit);
}

function extractUsefulSections(html: string): WikiSection[] {
  const blocked = new Set([
    "See also",
    "Notes",
    "References",
    "Sources",
    "Further reading",
    "External links",
    "Bibliography",
    "Citations",
  ]);

  const h2Regex = /<h2[\s\S]*?<\/h2>/gi;
  const headings = Array.from(html.matchAll(h2Regex)).map((match) => ({
    index: match.index ?? 0,
    html: match[0],
    title: sectionTitleFromHeading(match[0]),
  }));

  const sections: WikiSection[] = [];

  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    const next = headings[i + 1];
    const title = current.title;

    if (!title || blocked.has(title)) continue;

    const chunk = html.slice(current.index, next ? next.index : html.length);
    const paragraphs = extractParagraphs(chunk, 2);

    if (!paragraphs.length) continue;

    sections.push({
      title,
      paragraphs,
    });

    if (sections.length >= 5) break;
  }

  return sections;
}

async function queryWikidata(qid: string) {
  const sparql = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>

SELECT DISTINCT
  ?item
  ?itemLabel
  ?itemDescription
  ?typeLabel
  ?pointDate
  ?startDate
  ?endDate
  ?locationLabel
  ?participantLabel
  ?coord
  ?image
  ?article
WHERE {
  BIND(wd:${qid} AS ?item)

  OPTIONAL { ?item wdt:P31 ?type. }

  OPTIONAL { ?item wdt:P585 ?pointDate. }
  OPTIONAL { ?item wdt:P580 ?startDate. }
  OPTIONAL { ?item wdt:P582 ?endDate. }

  OPTIONAL { ?item wdt:P276 ?location. }
  OPTIONAL { ?item wdt:P710 ?participant. }

  OPTIONAL { ?item wdt:P625 ?itemCoord. }
  OPTIONAL { ?location wdt:P625 ?locationCoord. }
  BIND(COALESCE(?itemCoord, ?locationCoord) AS ?coord)

  OPTIONAL { ?item wdt:P18 ?image. }

  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
}
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

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
          "StratifyAnalytics/1.0 (https://worldstats360.com; history-event-detail)",
      },
      body,
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Wikidata detail query failed: ${response.status} ${response.statusText}`,
      );
    }

    const json = JSON.parse(text) as {
      results?: {
        bindings?: SparqlRow[];
      };
    };

    return json.results?.bindings || [];
  } finally {
    clearTimeout(timeout);
  }
}

async function loadWikipediaSummary(articleUrl: string | null) {
  const title = articleTitleFromUrl(articleUrl);
  if (!title) return null;

  const normalized = title.trim().replace(/\s+/g, "_");

  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      normalized,
    )}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "StratifyAnalytics/1.0 (https://worldstats360.com; history-event-detail)",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) return null;

  const json = await response.json();

  return {
    title: cleanText(json?.title || title),
    description: cleanText(json?.description || ""),
    extract: cleanText(json?.extract || ""),
    thumbnailUrl: json?.thumbnail?.source || null,
    pageUrl: json?.content_urls?.desktop?.page || articleUrl,
  };
}

async function loadWikipediaSections(articleUrl: string | null) {
  const title = articleTitleFromUrl(articleUrl);
  if (!title) return [];

  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "text");
  url.searchParams.set("format", "json");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("origin", "*");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "StratifyAnalytics/1.0 (https://worldstats360.com; history-event-detail)",
    },
    cache: "no-store",
  });

  if (!response.ok) return [];

  const json = await response.json();
  const html = String(json?.parse?.text?.["*"] || "");

  if (!html) return [];

  return extractUsefulSections(html);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qid = cleanText(searchParams.get("qid")).toUpperCase();

    if (!/^Q\d+$/.test(qid)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing qid" },
        { status: 400 },
      );
    }

    const rows = await queryWikidata(qid);

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "No event details found" },
        { status: 404 },
      );
    }

    const first = rows[0];

    const articleUrl =
      unique(rows.map((row) => binding(row, "article")))[0] || null;

    const [summary, sections] = await Promise.all([
      loadWikipediaSummary(articleUrl),
      loadWikipediaSections(articleUrl),
    ]);

    const coord =
      rows.map((row) => parsePoint(binding(row, "coord"))).find(Boolean) ||
      null;

    const startDate = binding(first, "startDate") || null;
    const endDate = binding(first, "endDate") || null;
    const pointDate = binding(first, "pointDate") || null;

    const payload = {
      ok: true,
      qid,
      title: summary?.title || binding(first, "itemLabel"),
      description:
        summary?.description || binding(first, "itemDescription") || null,
      extract: summary?.extract || binding(first, "itemDescription") || null,
      sections,
      types: unique(rows.map((row) => binding(row, "typeLabel"))),
      pointDate,
      startDate,
      endDate,
      displayDate:
        dateLabel(pointDate) ||
        [dateLabel(startDate), dateLabel(endDate)].filter(Boolean).join("–") ||
        null,
      locations: unique(rows.map((row) => binding(row, "locationLabel"))),
      participants: unique(rows.map((row) => binding(row, "participantLabel"))),
      lat: coord?.lat ?? null,
      lng: coord?.lng ?? null,
      imageUrl:
        summary?.thumbnailUrl ||
        unique(rows.map((row) => binding(row, "image")))[0] ||
        null,
      articleUrl: summary?.pageUrl || articleUrl,
      wikidataUrl: `https://www.wikidata.org/wiki/${qid}`,
      source: "Wikidata / Wikipedia",
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "History event detail API failed",
      },
      { status: 500 },
    );
  }
}
