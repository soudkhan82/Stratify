import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        .replace(/<span\b[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/p>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function articleTitleFromUrl(url: string | null) {
  if (!url) return "";

  try {
    const marker = "/wiki/";
    const raw = url.includes(marker) ? url.split(marker)[1] || "" : url;

    return decodeURIComponent(raw.split(/[?#]/)[0] || "")
      .replace(/_/g, " ")
      .trim();
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
    .filter((text) => text.length >= 60)
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
    title: sectionTitleFromHeading(match[0]),
  }));

  const sections: WikiSection[] = [];

  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    const next = headings[i + 1];

    if (!current.title || blocked.has(current.title)) continue;

    const chunk = html.slice(current.index, next ? next.index : html.length);
    const paragraphs = extractParagraphs(chunk, 2);

    if (!paragraphs.length) continue;

    sections.push({
      title: current.title,
      paragraphs,
    });

    if (sections.length >= 5) break;
  }

  return sections;
}

async function fetchJson(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "StratifyAnalytics/1.0 (https://worldstats360.com; history-detail)",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getWikipediaSummary(title: string) {
  if (!title) return null;

  const normalized = title.trim().replace(/\s+/g, "_");
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    normalized,
  )}`;

  const json = await fetchJson(url);

  if (!json) return null;

  return {
    title: cleanText(json?.title || title),
    description: cleanText(json?.description || ""),
    extract: cleanText(json?.extract || ""),
    thumbnailUrl: json?.thumbnail?.source || null,
    pageUrl: json?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(normalized)}`,
  };
}

async function getWikipediaSections(title: string) {
  if (!title) return [];

  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "text");
  url.searchParams.set("format", "json");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("origin", "*");

  const json = await fetchJson(url.toString());

  const html = String(json?.parse?.text?.["*"] || "");
  if (!html) return [];

  return extractUsefulSections(html);
}

async function getArticleFromQid(qid: string) {
  if (!/^Q\d+$/i.test(qid)) return null;

  const sparql = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX schema: <http://schema.org/>
SELECT ?article WHERE {
  ?article schema:about wd:${qid} ;
           schema:isPartOf <https://en.wikipedia.org/> .
}
LIMIT 1
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

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
          "StratifyAnalytics/1.0 (https://worldstats360.com; history-detail-qid)",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) return null;

    const json = await response.json();
    return cleanText(json?.results?.bindings?.[0]?.article?.value || "") || null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const qid = cleanText(searchParams.get("qid")).toUpperCase();
    const inputUrl = cleanText(searchParams.get("url"));
    const fallbackTitle = cleanText(searchParams.get("title"));

    let articleUrl = inputUrl || null;

    if (!articleUrl && qid) {
      articleUrl = await getArticleFromQid(qid);
    }

    const title =
      articleTitleFromUrl(articleUrl) ||
      fallbackTitle ||
      (qid ? qid : "Historical event");

    const [summary, sections] = await Promise.all([
      getWikipediaSummary(title),
      getWikipediaSections(title),
    ]);

    return NextResponse.json(
      {
        ok: true,
        qid: qid || null,
        title: summary?.title || title,
        description: summary?.description || null,
        extract:
          summary?.extract ||
          "No detailed Wikipedia summary was returned for this event, but the source link is available below.",
        sections,
        types: [],
        displayDate: null,
        locations: [],
        participants: [],
        lat: null,
        lng: null,
        imageUrl: summary?.thumbnailUrl || null,
        articleUrl: summary?.pageUrl || articleUrl || null,
        wikidataUrl: qid ? `https://www.wikidata.org/wiki/${qid}` : null,
        source: qid ? "Wikidata / Wikipedia" : "Wikipedia",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: true,
        title: "Historical event",
        extract:
          "Details could not be fetched from Wikipedia right now. Try opening the source link again later.",
        sections: [],
        articleUrl: null,
        source: "Wikipedia",
        warning:
          error instanceof Error ? error.message : "Detail source unavailable",
      },
      { status: 200 },
    );
  }
}

