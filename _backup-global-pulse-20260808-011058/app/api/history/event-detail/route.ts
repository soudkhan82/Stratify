import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WIKI_ORIGIN = "https://en.wikipedia.org";

type WikiSection = {
  title: string;
  content: string;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
    .replace(/<table[\s\S]*?<\/table>/gi, " ")
    .replace(/<figure[\s\S]*?<\/figure>/gi, " ")
    .replace(/<ul[\s\S]*?<\/ul>/gi, " ")
    .replace(/<ol[\s\S]*?<\/ol>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\[\s*\d+\s*\]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeTitle(value: string) {
  return value
    .replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//i, "")
    .replace(/^\/wiki\//i, "")
    .replace(/_/g, " ")
    .replace(/#.*$/g, "")
    .trim();
}

function titleFromArticleUrl(articleUrl: string | null, fallbackTitle: string | null) {
  if (articleUrl) {
    try {
      const url = new URL(articleUrl);
      const match = url.pathname.match(/\/wiki\/(.+)$/i);

      if (match?.[1]) {
        return decodeURIComponent(match[1]).replace(/_/g, " ").trim();
      }
    } catch {
      const normalized = normalizeTitle(articleUrl);
      if (normalized) return normalized;
    }
  }

  return normalizeTitle(fallbackTitle || "");
}

function pageTitleForApi(title: string) {
  return encodeURIComponent(title.trim().replace(/\s+/g, "_"));
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Stratify-History-Module/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  return response.json();
}

async function resolveTitle(title: string) {
  const directTitle = normalizeTitle(title);
  if (!directTitle) return "";

  const direct = await fetchJson(
    `${WIKI_ORIGIN}/api/rest_v1/page/summary/${pageTitleForApi(directTitle)}`
  );

  if (direct?.title && direct?.extract) {
    return String(direct.title);
  }

  const searchUrl = new URL(`${WIKI_ORIGIN}/w/api.php`);
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srsearch", directTitle);
  searchUrl.searchParams.set("srlimit", "1");

  const search = await fetchJson(searchUrl.toString());
  const first = search?.query?.search?.[0]?.title;

  return first ? String(first) : directTitle;
}

async function fetchSummary(title: string) {
  return fetchJson(`${WIKI_ORIGIN}/api/rest_v1/page/summary/${pageTitleForApi(title)}`);
}

async function fetchSectionText(title: string, index: string) {
  const url = new URL(`${WIKI_ORIGIN}/w/api.php`);
  url.searchParams.set("action", "parse");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("prop", "text");
  url.searchParams.set("page", title);
  url.searchParams.set("section", index);

  const json = await fetchJson(url.toString());
  const html = json?.parse?.text?.["*"];

  return cleanText(html || "");
}

async function fetchSections(title: string): Promise<WikiSection[]> {
  const url = new URL(`${WIKI_ORIGIN}/w/api.php`);
  url.searchParams.set("action", "parse");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("prop", "sections");
  url.searchParams.set("page", title);

  const json = await fetchJson(url.toString());
  const rawSections = Array.isArray(json?.parse?.sections) ? json.parse.sections : [];

  const skip = new Set([
    "see also",
    "notes",
    "references",
    "bibliography",
    "further reading",
    "external links",
    "citations",
    "sources",
  ]);

  const useful = rawSections
    .filter((section: any) => Number(section?.toclevel || 0) <= 2)
    .filter((section: any) => !skip.has(String(section?.line || "").toLowerCase().trim()))
    .slice(0, 5);

  const sections: WikiSection[] = [];

  for (const section of useful) {
    const index = String(section.index || "");
    const heading = cleanText(section.line || "");

    if (!index || !heading) continue;

    const content = await fetchSectionText(title, index);

    if (content && content.length > 80) {
      sections.push({
        title: heading,
        content: content.length > 900 ? `${content.slice(0, 900).trim()}...` : content,
      });
    }

    if (sections.length >= 4) break;
  }

  return sections;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const articleUrl =
      searchParams.get("articleUrl") ||
      searchParams.get("url") ||
      searchParams.get("wikiUrl") ||
      "";

    const fallbackTitle =
      searchParams.get("fallbackTitle") ||
      searchParams.get("title") ||
      searchParams.get("q") ||
      "";

    const initialTitle = titleFromArticleUrl(articleUrl, fallbackTitle);

    if (!initialTitle) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing article title or article URL.",
        },
        { status: 400 }
      );
    }

    const resolvedTitle = await resolveTitle(initialTitle);
    const summary = await fetchSummary(resolvedTitle);

    const displayTitle = cleanText(summary?.title || resolvedTitle || initialTitle);
    const extract = cleanText(summary?.extract || "");
    const description = cleanText(summary?.description || "");

    const finalArticleUrl =
      summary?.content_urls?.desktop?.page ||
      articleUrl ||
      `${WIKI_ORIGIN}/wiki/${pageTitleForApi(displayTitle)}`;

    const imageUrl =
      summary?.originalimage?.source ||
      summary?.thumbnail?.source ||
      null;

    const sections = await fetchSections(displayTitle);

    return NextResponse.json(
      {
        ok: true,

        // Generic fields
        title: displayTitle,
        displayTitle,
        source: "Wikipedia",
        description,
        summary: extract,
        extract,
        overview: extract,
        overviewTitle: description,
        articleUrl: finalArticleUrl,
        wikiUrl: finalArticleUrl,
        url: finalArticleUrl,
        imageUrl,
        thumbnailUrl: imageUrl,

        // Detail fields for different component shapes
        sections,
        details: sections,
        articleDetails: sections,
        sourceLinks: [
          {
            label: "Open Wikipedia",
            url: finalArticleUrl,
          },
        ],

        meta: {
          route: "history/event-detail",
          source: "wikipedia-rest-summary-and-parse-sections",
          hardcodedEvents: false,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("History event-detail error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load event detail.",
      },
      { status: 500 }
    );
  }
}

