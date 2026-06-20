import { NextResponse } from "next/server";
import countries from "world-countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawCountry = {
  cca3?: string;
  name?: {
    common?: string;
    official?: string;
  };
};

type WikiSummary = {
  title?: string;
  displaytitle?: string;
  description?: string;
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
  thumbnail?: {
    source?: string;
  };
};

type WikiFact = {
  group: string;
  label: string;
  value: string;
};

type CacheEntry = {
  ts: number;
  payload: any;
};

declare global {
  // eslint-disable-next-line no-var
  var __WIKI_COUNTRY_PROFILE_CACHE__: Map<string, CacheEntry> | undefined;
}

const CACHE =
  global.__WIKI_COUNTRY_PROFILE_CACHE__ ?? new Map<string, CacheEntry>();
global.__WIKI_COUNTRY_PROFILE_CACHE__ = CACHE;

const TTL_MS = 1000 * 60 * 60 * 24;

const COUNTRY_TITLE_OVERRIDES: Record<string, string> = {
  USA: "United States",
  GBR: "United Kingdom",
  ARE: "United Arab Emirates",
  CZE: "Czech Republic",
  COD: "Democratic Republic of the Congo",
  COG: "Republic of the Congo",
  KOR: "South Korea",
  PRK: "North Korea",
  RUS: "Russia",
  IRN: "Iran",
  SYR: "Syria",
  LAO: "Laos",
  VNM: "Vietnam",
  BOL: "Bolivia",
  VEN: "Venezuela",
  TZA: "Tanzania",
  FSM: "Federated States of Micronesia",
  MDA: "Moldova",
  BRN: "Brunei",
  SWZ: "Eswatini",
  MKD: "North Macedonia",
  PSE: "State of Palestine",
  TUR: "Turkey",
  TLS: "East Timor",
  CPV: "Cape Verde",
  CIV: "Ivory Coast",
  VAT: "Vatican City",
  HKG: "Hong Kong",
  MAC: "Macau",
  TWN: "Taiwan",
};

const ECONOMY_TITLE_OVERRIDES: Record<string, string> = {
  USA: "Economy of the United States",
  GBR: "Economy of the United Kingdom",
  ARE: "Economy of the United Arab Emirates",
  COD: "Economy of the Democratic Republic of the Congo",
  COG: "Economy of the Republic of the Congo",
  CZE: "Economy of the Czech Republic",
  KOR: "Economy of South Korea",
  PRK: "Economy of North Korea",
  PSE: "Economy of the State of Palestine",
  GMB: "Economy of the Gambia",
  BHS: "Economy of the Bahamas",
  NLD: "Economy of the Netherlands",
  PHL: "Economy of the Philippines",
  VAT: "Economy of Vatican City",
};

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#160;/g, " ")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&#40;/g, "(")
    .replace(/&#41;/g, ")");
}

function cleanText(value: unknown) {
  return decodeEntities(String(value ?? ""))
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\[[a-z]\]/gi, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\[citation needed\]/gi, "")
    .replace(/[▲▼△▽]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToText(html: string) {
  return cleanText(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<sup\b[^>]*class="[^"]*reference[^"]*"[\s\S]*?<\/sup>/gi, " ")
      .replace(
        /<span\b[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi,
        " ",
      )
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/li>/gi, " • ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function getCountryNameFromIso3(iso3: string) {
  const override = COUNTRY_TITLE_OVERRIDES[iso3];
  if (override) return override;

  const row = (countries as RawCountry[]).find(
    (country) => String(country.cca3 || "").toUpperCase() === iso3,
  );

  return cleanText(row?.name?.common || row?.name?.official || iso3);
}

function wikiSummaryUrl(title: string) {
  const normalized = title.trim().replace(/\s+/g, "_");

  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    normalized,
  )}`;
}

async function fetchJsonWithTimeout(url: string, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "StratifyAnalytics/1.0 (https://worldstats360.com; country-profile)",
        "Api-User-Agent":
          "StratifyAnalytics/1.0 (https://worldstats360.com; country-profile)",
      },
      cache: "no-store",
    });

    const text = await response.text();

    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return { response, json };
  } finally {
    clearTimeout(timer);
  }
}

async function searchWikipediaTitle(query: string) {
  const url = new URL("https://en.wikipedia.org/w/api.php");

  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("srlimit", "1");
  url.searchParams.set("origin", "*");

  const { response, json } = await fetchJsonWithTimeout(url.toString());

  if (!response.ok) return null;

  const first = json?.query?.search?.[0]?.title;
  return typeof first === "string" && first.trim() ? first.trim() : null;
}

async function loadWikipediaSummary(title: string) {
  const first = await fetchJsonWithTimeout(wikiSummaryUrl(title));

  if (first.response.ok && first.json?.extract) {
    return first.json as WikiSummary;
  }

  const fallbackTitle = await searchWikipediaTitle(title);
  if (!fallbackTitle) return null;

  const fallback = await fetchJsonWithTimeout(wikiSummaryUrl(fallbackTitle));

  if (!fallback.response.ok || !fallback.json?.extract) return null;

  return fallback.json as WikiSummary;
}

async function loadWikipediaPageHtml(title: string) {
  const url = new URL("https://en.wikipedia.org/w/api.php");

  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "text");
  url.searchParams.set("format", "json");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("disabletoc", "1");
  url.searchParams.set("origin", "*");

  const { response, json } = await fetchJsonWithTimeout(url.toString(), 14000);

  if (!response.ok || !json?.parse?.text?.["*"]) return "";

  return String(json.parse.text["*"]);
}

function extractFirstInfobox(html: string) {
  const startMatch = /<table\b[^>]*class="[^"]*\binfobox\b[^"]*"[^>]*>/i.exec(
    html,
  );

  if (!startMatch || startMatch.index === undefined) return "";

  const start = startMatch.index;
  const tableTagRegex = /<\/?table\b[^>]*>/gi;

  tableTagRegex.lastIndex = start;

  let depth = 0;
  let match: RegExpExecArray | null;

  while ((match = tableTagRegex.exec(html))) {
    const tag = match[0].toLowerCase();

    if (tag.startsWith("<table")) depth += 1;
    if (tag.startsWith("</table")) depth -= 1;

    if (depth === 0) {
      return html.slice(start, tableTagRegex.lastIndex);
    }
  }

  return "";
}

function getCountryFactGroup(label: string, currentGroup: string) {
  const s = label.toLowerCase();

  if (/population|density/.test(s)) return "Population";
  if (/area|water/.test(s)) return "Area";
  if (/time zone|date format|calling code|iso|internet tld/.test(s)) {
    return "Codes & standards";
  }
  if (
    /capital|largest city|official|language|religion|demonym|government/.test(s)
  ) {
    return "General";
  }

  return currentGroup || "General";
}

function getEconomyFactGroup(label: string, currentGroup: string) {
  const s = label.toLowerCase();

  if (/currency|fiscal year|trade organisations|country group/.test(s)) {
    return "Economic profile";
  }
  if (/gdp|inflation|poverty|gini|hdi|labour|unemployment|industries/.test(s)) {
    return "Economic indicators";
  }
  if (/exports|imports|trade|debt|revenue|expenses|aid|remittances/.test(s)) {
    return "Trade & finance";
  }

  return currentGroup || "Economy";
}

function extractInfoboxFacts(html: string, kind: "country" | "economy") {
  const infobox = extractFirstInfobox(html);
  if (!infobox) return [];

  const rows = infobox.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const facts: WikiFact[] = [];

  let currentGroup = kind === "economy" ? "Economy" : "General";

  for (const row of rows) {
    const cells = Array.from(
      row.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi),
    ).map((m) => ({
      tag: m[1].toLowerCase(),
      text: htmlToText(m[2]),
    }));

    if (!cells.length) continue;

    if (cells.length === 1 && cells[0].tag === "th") {
      const heading = cells[0].text;
      if (heading && heading.length <= 90) currentGroup = heading;
      continue;
    }

    const firstTh = cells.find((cell) => cell.tag === "th");
    const firstTd = cells.find((cell) => cell.tag === "td");

    const label = firstTh?.text || cells[0]?.text || "";
    const value =
      firstTd?.text ||
      cells
        .slice(1)
        .map((cell) => cell.text)
        .filter(Boolean)
        .join(" ");

    if (!label || !value) continue;
    if (label.length > 100 || value.length > 700) continue;

    const group =
      kind === "economy"
        ? getEconomyFactGroup(label, currentGroup)
        : getCountryFactGroup(label, currentGroup);

    facts.push({
      group,
      label,
      value,
    });

    if (/statistics|gdp|population|area/i.test(label)) {
      currentGroup = label;
    }
  }

  const seen = new Set<string>();

  return facts.filter((fact) => {
    const key = `${fact.group}|${fact.label}|${fact.value}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isEconomicCountryFact(fact: WikiFact) {
  return /gdp|gini|hdi|currency|economy|nominal|ppp/i.test(
    `${fact.group} ${fact.label}`,
  );
}

function findFact(facts: WikiFact[], labelMatch: RegExp, groupMatch?: RegExp) {
  return (
    facts.find((fact) => {
      const labelOk = labelMatch.test(fact.label);
      const groupOk = groupMatch ? groupMatch.test(fact.group) : true;
      return labelOk && groupOk;
    }) || null
  );
}

function extractFromValue(value: string, keyword: RegExp) {
  const chunks = value
    .split(/•|;|\n/g)
    .map(cleanText)
    .filter(Boolean);

  return chunks.find((chunk) => keyword.test(chunk)) || "";
}

function buildCountryHighlights(facts: WikiFact[]) {
  const picks: Array<{ title: string; fact: WikiFact | null }> = [
    { title: "Capital", fact: findFact(facts, /capital/i) },
    { title: "Area", fact: findFact(facts, /total/i, /area/i) },
    {
      title: "Population",
      fact: findFact(facts, /census|estimate|population/i, /population/i),
    },
    { title: "Density", fact: findFact(facts, /density/i, /population/i) },
    { title: "Time zone", fact: findFact(facts, /time zone/i) },
    { title: "Calling code", fact: findFact(facts, /calling code/i) },
  ];

  const out: WikiFact[] = [];

  for (const item of picks) {
    if (!item.fact) continue;

    out.push({
      group: item.fact.group,
      label: item.title,
      value: item.fact.value,
    });
  }

  return dedupeFacts(out);
}

function buildEconomyHighlights(facts: WikiFact[]) {
  const out: WikiFact[] = [];

  const gdp = findFact(facts, /^gdp$/i);
  if (gdp) {
    const nominal = extractFromValue(gdp.value, /nominal/i);
    const ppp = extractFromValue(gdp.value, /\bppp\b/i);

    if (nominal) {
      out.push({
        group: "Economic indicators",
        label: "GDP nominal",
        value: nominal,
      });
    }

    if (ppp) {
      out.push({
        group: "Economic indicators",
        label: "GDP PPP",
        value: ppp,
      });
    }

    if (!nominal && !ppp) {
      out.push({
        group: "Economic indicators",
        label: "GDP",
        value: gdp.value,
      });
    }
  }

  const picks: Array<{ title: string; fact: WikiFact | null }> = [
    { title: "GDP growth", fact: findFact(facts, /gdp growth/i) },
    { title: "GDP per capita", fact: findFact(facts, /gdp per capita/i) },
    { title: "Inflation", fact: findFact(facts, /inflation/i) },
    { title: "Unemployment", fact: findFact(facts, /unemployment/i) },
    { title: "Currency", fact: findFact(facts, /currency/i) },
    { title: "Fiscal year", fact: findFact(facts, /fiscal year/i) },
  ];

  for (const item of picks) {
    if (!item.fact) continue;

    out.push({
      group: item.fact.group,
      label: item.title,
      value: item.fact.value,
    });
  }

  return dedupeFacts(out).slice(0, 10);
}

function dedupeFacts(facts: WikiFact[]) {
  const seen = new Set<string>();

  return facts.filter((fact) => {
    const key = `${fact.label}|${fact.value}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractSectionHtml(html: string, sectionTitle: string) {
  const h2Regex = /<h2[\s\S]*?<\/h2>/gi;
  const headings = Array.from(html.matchAll(h2Regex)).map((m) => ({
    index: m.index ?? 0,
    html: m[0],
    title: htmlToText(m[0])
      .replace(/\[edit\]/gi, "")
      .trim(),
  }));

  const current = headings.find((h) =>
    h.title.toLowerCase().includes(sectionTitle.toLowerCase()),
  );

  if (!current) return "";

  const next = headings.find((h) => h.index > current.index);
  const end = next ? next.index : html.length;

  return html.slice(current.index, end);
}

function extractParagraphs(sectionHtml: string, limit = 6) {
  return Array.from(sectionHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => htmlToText(m[1]))
    .filter((text) => text.length >= 70)
    .slice(0, limit);
}

function extractDemographics(html: string) {
  const section = extractSectionHtml(html, "Demographics");
  const paragraphs = extractParagraphs(section, 6);

  return {
    title: "Demographics",
    paragraphs,
  };
}

function extractEconomySections(html: string) {
  const wanted = [
    "Data",
    "Gross domestic product",
    "Currency",
    "Major sectors",
    "Foreign trade",
  ];

  const sections = wanted
    .map((title) => {
      const sectionHtml = extractSectionHtml(html, title);
      const paragraphs = extractParagraphs(sectionHtml, 3);

      return {
        title,
        paragraphs,
      };
    })
    .filter((section) => section.paragraphs.length > 0);

  return sections;
}

function buildEconomyTitleCandidates(countryTitle: string, iso3: string) {
  const override = ECONOMY_TITLE_OVERRIDES[iso3];
  const cleaned = cleanText(countryTitle);

  const candidates = [
    override,
    `Economy of ${cleaned}`,
    `Economy of the ${cleaned}`,
  ].filter(Boolean) as string[];

  return Array.from(new Set(candidates));
}

async function loadBestSummaryFromCandidates(
  candidates: string[],
  fallbackSearch: string,
) {
  for (const candidate of candidates) {
    const summary = await loadWikipediaSummary(candidate);
    if (summary?.extract) return summary;
  }

  const searchedTitle = await searchWikipediaTitle(fallbackSearch);
  if (!searchedTitle) return null;

  return loadWikipediaSummary(searchedTitle);
}

async function loadEconomyProfile(countryTitle: string, iso3: string) {
  const candidates = buildEconomyTitleCandidates(countryTitle, iso3);

  const summary = await loadBestSummaryFromCandidates(
    candidates,
    `Economy of ${countryTitle}`,
  );

  if (!summary?.extract) {
    return {
      ok: false,
      error: "Economy page unavailable",
      facts: [],
      highlights: [],
      sections: [],
    };
  }

  const actualTitle = cleanText(summary.title || candidates[0]);
  const html = await loadWikipediaPageHtml(actualTitle);

  const facts = html ? extractInfoboxFacts(html, "economy") : [];
  const highlights = buildEconomyHighlights(facts);
  const sections = html ? extractEconomySections(html) : [];

  return {
    ok: true,
    title: actualTitle,
    displayTitle: cleanText(
      summary.displaytitle || summary.title || actualTitle,
    ),
    description: cleanText(summary.description),
    extract: cleanText(summary.extract),
    pageUrl: summary.content_urls?.desktop?.page || null,
    thumbnailUrl: summary.thumbnail?.source || null,
    facts,
    highlights,
    sections,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const iso3 = cleanText(searchParams.get("iso3")).toUpperCase().slice(0, 3);

    const countryParam = cleanText(searchParams.get("country"));

    if (!iso3) {
      return NextResponse.json(
        { ok: false, error: "Missing iso3" },
        { status: 400 },
      );
    }

    const countryTitle = countryParam || getCountryNameFromIso3(iso3);
    const key = `${iso3}:${countryTitle.toLowerCase()}:v2`;

    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return NextResponse.json(cached.payload, {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=86400, stale-while-revalidate=86400",
        },
      });
    }

    const [summary, countryHtml, economy] = await Promise.all([
      loadWikipediaSummary(countryTitle),
      loadWikipediaPageHtml(countryTitle),
      loadEconomyProfile(countryTitle, iso3),
    ]);

    if (!summary?.extract) {
      const payload = {
        ok: false,
        iso3,
        country: countryTitle,
        error: "Wikipedia profile unavailable",
      };

      CACHE.set(key, { ts: Date.now(), payload });
      return NextResponse.json(payload, { status: 404 });
    }

    const rawCountryFacts = countryHtml
      ? extractInfoboxFacts(countryHtml, "country")
      : [];

    const countryFacts = rawCountryFacts.filter(
      (fact) => !isEconomicCountryFact(fact),
    );
    const countryHighlights = buildCountryHighlights(countryFacts);
    const demographics = countryHtml ? extractDemographics(countryHtml) : null;

    const payload = {
      ok: true,
      iso3,
      country: countryTitle,
      title: cleanText(summary.title || countryTitle),
      displayTitle: cleanText(
        summary.displaytitle || summary.title || countryTitle,
      ),
      description: cleanText(summary.description),
      extract: cleanText(summary.extract),
      pageUrl: summary.content_urls?.desktop?.page || null,
      thumbnailUrl: summary.thumbnail?.source || null,

      facts: countryFacts,
      highlights: countryHighlights,
      demographics,

      economics: economy,

      source: "Wikipedia",
      license: "CC BY-SA",
      fetchedAt: new Date().toISOString(),
    };

    CACHE.set(key, { ts: Date.now(), payload });

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Wikipedia profile API failed",
      },
      { status: 500 },
    );
  }
}
