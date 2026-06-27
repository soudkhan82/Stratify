import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RestCountry = {
  cca3?: string;
  name?: {
    common?: string;
    official?: string;
  };
  region?: string;
  subregion?: string;
  capital?: string[];
  population?: number;
  area?: number;
  flags?: {
    png?: string;
    svg?: string;
    alt?: string;
  };
  maps?: {
    googleMaps?: string;
    openStreetMaps?: string;
  };
  continents?: string[];
};

type WikiSummary = {
  type?: string;
  title?: string;
  displaytitle?: string;
  description?: string;
  extract?: string;
  thumbnail?: {
    source?: string;
  };
  originalimage?: {
    source?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
  wikibase_item?: string;
};

type WikiCard = {
  label: string;
  title: string;
  description: string | null;
  extract: string;
  url: string | null;
  image: string | null;
  wikibase_item: string | null;
  source: "Wikipedia";
};

const USER_AGENT =
  "WorldStats360/1.0 FAOSTAT-country-enrichment https://worldstats360.com";

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function safeIso3(value: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "Api-User-Agent": USER_AGENT,
      },
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return null;

    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getRestCountry(iso3: string) {
  const fields = [
    "cca3",
    "name",
    "region",
    "subregion",
    "capital",
    "population",
    "area",
    "flags",
    "maps",
    "continents",
  ].join(",");

  const url = `https://restcountries.com/v3.1/alpha/${encodeURIComponent(
    iso3,
  )}?fields=${encodeURIComponent(fields)}`;

  const data = await fetchJson<RestCountry | RestCountry[]>(url);

  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

type SearchHit = {
  title: string;
  description: string | null;
  url: string | null;
  score: number;
};

function scoreTitle(title: string, label: string, countryName: string) {
  const t = title.toLowerCase();
  const c = countryName.toLowerCase();
  const l = label.toLowerCase();

  let score = 0;

  if (t === c) score += 120;
  if (t.includes(c)) score += 40;

  if (l.includes("agriculture")) {
    if (t === `agriculture in ${c}`) score += 140;
    if (t.includes("agriculture")) score += 90;
    if (t.includes("food")) score += 25;
  }

  if (l.includes("economy")) {
    if (t === `economy of ${c}`) score += 130;
    if (t.includes("economy")) score += 85;
    if (t.includes("agriculture")) score += 30;
  }

  if (t.includes("list of")) score -= 80;
  if (t.includes("category:")) score -= 100;
  if (t.includes("template:")) score -= 100;
  if (t.includes("disambiguation")) score -= 100;

  return score;
}

async function wikiOpenSearch(
  query: string,
  label: string,
  countryName: string,
  limit = 6,
): Promise<SearchHit[]> {
  const qs = new URLSearchParams({
    action: "opensearch",
    namespace: "0",
    limit: String(limit),
    format: "json",
    origin: "*",
    search: query,
  });

  const data = await fetchJson<any[]>(
    `https://en.wikipedia.org/w/api.php?${qs.toString()}`,
  );

  const titles = Array.isArray(data?.[1]) ? data![1] : [];
  const descriptions = Array.isArray(data?.[2]) ? data![2] : [];
  const urls = Array.isArray(data?.[3]) ? data![3] : [];

  return titles
    .map((title: unknown, idx: number) => {
      const cleanTitle = cleanText(title);
      return {
        title: cleanTitle,
        description: cleanText(descriptions[idx]) || null,
        url: cleanText(urls[idx]) || null,
        score: scoreTitle(cleanTitle, label, countryName),
      };
    })
    .filter((x) => x.title)
    .sort((a, b) => b.score - a.score);
}

async function wikiSummary(title: string): Promise<WikiSummary | null> {
  const safeTitle = encodeURIComponent(title.replace(/\s+/g, "_"));
  return fetchJson<WikiSummary>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${safeTitle}`,
  );
}

async function resolveWikiCard(args: {
  label: string;
  queries: string[];
  countryName: string;
}): Promise<WikiCard | null> {
  const allHits: SearchHit[] = [];

  for (const query of args.queries) {
    const hits = await wikiOpenSearch(query, args.label, args.countryName);
    allHits.push(...hits);
  }

  const seen = new Set<string>();
  const candidates = allHits
    .filter((hit) => {
      const key = hit.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const hit of candidates) {
    const summary = await wikiSummary(hit.title);

    if (!summary?.extract) continue;
    if (String(summary.type || "").toLowerCase() === "disambiguation") {
      continue;
    }

    return {
      label: args.label,
      title: cleanText(summary.displaytitle || summary.title || hit.title),
      description: cleanText(summary.description || hit.description) || null,
      extract: cleanText(summary.extract),
      url: summary.content_urls?.desktop?.page || hit.url || null,
      image: summary.thumbnail?.source || summary.originalimage?.source || null,
      wikibase_item: summary.wikibase_item || null,
      source: "Wikipedia",
    };
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const iso3 = safeIso3(searchParams.get("iso3"));

    if (!iso3 || iso3.length !== 3) {
      return NextResponse.json(
        {
          ok: false,
          iso3,
          error: "Valid ISO3 query param is required.",
          facts: null,
          cards: [],
          links: [],
        },
        { status: 400 },
      );
    }

    const country = await getRestCountry(iso3);

    const commonName = cleanText(country?.name?.common) || iso3;
    const officialName = cleanText(country?.name?.official) || commonName;

    const queryNames = Array.from(
      new Set([commonName, officialName, iso3].filter(Boolean)),
    );

    const countryQueries = queryNames;
    const agricultureQueries = queryNames.flatMap((name) => [
      `Agriculture in ${name}`,
      `${name} agriculture food crops livestock`,
    ]);
    const economyQueries = queryNames.flatMap((name) => [
      `Economy of ${name}`,
      `${name} economy agriculture`,
    ]);

    const cards = (
      await Promise.all([
        resolveWikiCard({
          label: "Country context",
          queries: countryQueries,
          countryName: commonName,
        }),
        resolveWikiCard({
          label: "Agriculture context",
          queries: agricultureQueries,
          countryName: commonName,
        }),
        resolveWikiCard({
          label: "Economy context",
          queries: economyQueries,
          countryName: commonName,
        }),
      ])
    ).filter(Boolean) as WikiCard[];

    return NextResponse.json(
      {
        ok: true,
        iso3,
        country: commonName,
        official_name: officialName,
        facts: {
          region: country?.region ?? null,
          subregion: country?.subregion ?? null,
          capital: Array.isArray(country?.capital)
            ? country?.capital.join(", ")
            : null,
          population: country?.population ?? null,
          area_km2: country?.area ?? null,
          continents: Array.isArray(country?.continents)
            ? country?.continents
            : [],
          flag: country?.flags?.svg || country?.flags?.png || null,
          flag_alt: country?.flags?.alt || null,
          map: country?.maps?.googleMaps || country?.maps?.openStreetMaps || null,
        },
        cards,
        links: [
          {
            label: "FAO country profile",
            url: `https://www.fao.org/countryprofiles/index/en/?iso3=${iso3}`,
          },
          {
            label: "Wikipedia agriculture search",
            url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(
              `${commonName} agriculture`,
            )}`,
          },
          {
            label: "REST Countries source",
            url: `https://restcountries.com/v3.1/alpha/${iso3}`,
          },
        ],
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Unknown enrichment error",
        cards: [],
        links: [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
