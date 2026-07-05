import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 1000;
const DEFAULT_OFFSET = 0;
const UPSERT_BATCH_SIZE = 250;

type WikidataBindingValue = {
  type?: string;
  value?: string;
};

type WikidataBindingRow = Record<string, WikidataBindingValue | undefined>;

type ProfilePayload = {
  symbol: string;
  company_name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  employees: number | null;
  business_summary: string | null;
  source: string;
  raw_payload: Record<string, unknown>;
  fetched_at: string;

  hq_lat: number | null;
  hq_lng: number | null;
  geocode_provider: string | null;
  geocode_status: string | null;
  geocode_query: string | null;
  geocoded_at: string | null;

  iso2: string | null;
  iso3: string | null;
  region: string | null;
  source_universe: string;
  source_index: string;
  wikidata_qid: string | null;
  wikipedia_title: string | null;
  commons_category: string | null;
  logo_url: string | null;
  image_url: string | null;
  market_cap: number | null;
  currency: string | null;
  data_quality_score: number;
};

type CompanyPayload = {
  symbol: string;
  name: string;
  sector: string | null;
  sub_industry: string | null;
  headquarters: string | null;
  date_added: string | null;
  cik: string | null;
  founded: string | null;
  source: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;

    const parts = [
      err.step ? `Step: ${err.step}` : null,
      err.message,
      err.details,
      err.hint,
      err.code ? `Code: ${err.code}` : null,
    ]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

    if (parts.length) return parts.join(" | ");

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown object error";
    }
  }

  return String(error || "Unknown error");
}

function bindingValue(row: WikidataBindingRow, key: string) {
  return clean(row[key]?.value);
}

function parseQid(entityUrl: string) {
  const value = clean(entityUrl);
  const match = value.match(/\/entity\/(Q\d+)$/i);
  return match?.[1] ?? null;
}

function parseWikidataPoint(value: string) {
  const match = clean(value).match(/Point\(([-0-9.]+)\s+([-0-9.]+)\)/i);

  if (!match) {
    return {
      lat: null as number | null,
      lng: null as number | null,
    };
  }

  const lng = Number(match[1]);
  const lat = Number(match[2]);

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  "United States": [39.8283, -98.5795],
  Canada: [56.1304, -106.3468],
  Mexico: [23.6345, -102.5528],
  "United Kingdom": [55.3781, -3.436],
  Germany: [51.1657, 10.4515],
  France: [46.2276, 2.2137],
  Netherlands: [52.1326, 5.2913],
  Switzerland: [46.8182, 8.2275],
  Spain: [40.4637, -3.7492],
  Italy: [41.8719, 12.5674],
  Sweden: [60.1282, 18.6435],
  Denmark: [56.2639, 9.5018],
  Norway: [60.472, 8.4689],
  Finland: [61.9241, 25.7482],
  Ireland: [53.1424, -7.6921],
  Belgium: [50.5039, 4.4699],
  Austria: [47.5162, 14.5501],
  Luxembourg: [49.8153, 6.1296],
  Japan: [36.2048, 138.2529],
  China: [35.8617, 104.1954],
  "Hong Kong": [22.3193, 114.1694],
  "South Korea": [35.9078, 127.7669],
  Taiwan: [23.6978, 120.9605],
  India: [20.5937, 78.9629],
  Singapore: [1.3521, 103.8198],
  Australia: [-25.2744, 133.7751],
  "New Zealand": [-40.9006, 174.886],
  "Saudi Arabia": [23.8859, 45.0792],
  "United Arab Emirates": [23.4241, 53.8478],
  Qatar: [25.3548, 51.1839],
  Kuwait: [29.3117, 47.4818],
  Israel: [31.0461, 34.8516],
  Turkey: [38.9637, 35.2433],
  Türkiye: [38.9637, 35.2433],
  Brazil: [-14.235, -51.9253],
  Argentina: [-38.4161, -63.6167],
  Chile: [-35.6751, -71.543],
  Colombia: [4.5709, -74.2973],
  Peru: [-9.19, -75.0152],
  Pakistan: [30.3753, 69.3451],
  Malaysia: [4.2105, 101.9758],
  Thailand: [15.87, 100.9925],
  Indonesia: [-0.7893, 113.9213],
  Philippines: [12.8797, 121.774],
  "South Africa": [-30.5595, 22.9375],
};

function fallbackCentroid(country: string | null) {
  if (!country) {
    return {
      lat: null as number | null,
      lng: null as number | null,
    };
  }

  const coords = COUNTRY_CENTROIDS[country];

  return {
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
  };
}

function regionFromCountry(country: string | null) {
  if (!country) return null;

  const c = country.toLowerCase();

  if (
    ["united states", "canada", "mexico", "bermuda", "cayman islands"].includes(
      c,
    )
  ) {
    return "North America";
  }

  if (
    [
      "united kingdom",
      "germany",
      "france",
      "netherlands",
      "switzerland",
      "spain",
      "italy",
      "sweden",
      "denmark",
      "norway",
      "finland",
      "ireland",
      "belgium",
      "austria",
      "luxembourg",
    ].includes(c)
  ) {
    return "Europe";
  }

  if (
    [
      "japan",
      "china",
      "hong kong",
      "south korea",
      "taiwan",
      "india",
      "singapore",
      "australia",
      "new zealand",
      "pakistan",
      "malaysia",
      "thailand",
      "indonesia",
      "philippines",
    ].includes(c)
  ) {
    return "Asia Pacific";
  }

  if (
    [
      "saudi arabia",
      "united arab emirates",
      "qatar",
      "kuwait",
      "israel",
      "turkey",
      "türkiye",
    ].includes(c)
  ) {
    return "Middle East";
  }

  if (["brazil", "argentina", "chile", "colombia", "peru"].includes(c)) {
    return "Latin America";
  }

  if (["south africa"].includes(c)) {
    return "Africa";
  }

  return "Global";
}

function normalizeSymbol(value: string) {
  return clean(value)
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeCompanyName(value: string, fallback: string) {
  const name = clean(value);
  return name || fallback;
}

type Classification = {
  sector: string | null;
  industry: string | null;
};

const SECTOR_RULES: Array<{ sector: string; patterns: RegExp[] }> = [
  {
    sector: "Information Technology",
    patterns: [
      /software/i,
      /semiconductor/i,
      /computer/i,
      /internet/i,
      /information technology/i,
      /electronics/i,
      /cloud/i,
      /data processing/i,
      /cyber/i,
    ],
  },
  {
    sector: "Financials",
    patterns: [
      /bank/i,
      /insurance/i,
      /financial/i,
      /asset management/i,
      /investment/i,
      /brokerage/i,
      /exchange/i,
      /fintech/i,
    ],
  },
  {
    sector: "Energy",
    patterns: [
      /oil/i,
      /gas/i,
      /energy/i,
      /petroleum/i,
      /coal/i,
      /renewable/i,
      /solar/i,
    ],
  },
  {
    sector: "Health Care",
    patterns: [
      /pharma/i,
      /biotech/i,
      /health/i,
      /medical/i,
      /hospital/i,
      /drug/i,
      /life sciences/i,
    ],
  },
  {
    sector: "Communication Services",
    patterns: [
      /telecom/i,
      /media/i,
      /broadcast/i,
      /video game/i,
      /entertainment/i,
      /publishing/i,
      /advertising/i,
    ],
  },
  {
    sector: "Consumer Discretionary",
    patterns: [
      /automobile/i,
      /auto/i,
      /retail/i,
      /hotel/i,
      /restaurant/i,
      /travel/i,
      /luxury/i,
      /casino/i,
      /gambling/i,
      /apparel/i,
      /e-commerce/i,
    ],
  },
  {
    sector: "Consumer Staples",
    patterns: [
      /food/i,
      /beverage/i,
      /tobacco/i,
      /grocery/i,
      /household/i,
      /personal care/i,
      /consumer goods/i,
    ],
  },
  {
    sector: "Industrials",
    patterns: [
      /industrial/i,
      /machinery/i,
      /aerospace/i,
      /defense/i,
      /construction/i,
      /engineering/i,
      /transport/i,
      /logistics/i,
      /manufacturing/i,
      /building products/i,
    ],
  },
  {
    sector: "Materials",
    patterns: [
      /chemical/i,
      /metal/i,
      /mining/i,
      /steel/i,
      /paper/i,
      /packaging/i,
      /paint/i,
      /cement/i,
      /materials/i,
    ],
  },
  {
    sector: "Utilities",
    patterns: [
      /utility/i,
      /electric/i,
      /water/i,
      /power generation/i,
      /natural gas distribution/i,
    ],
  },
  {
    sector: "Real Estate",
    patterns: [/real estate/i, /reit/i, /property/i],
  },
];

function titleCaseIndustry(value: string | null) {
  const raw = clean(value);
  if (!raw) return null;

  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function classifyCompany(params: {
  industry: string | null;
  companyName: string;
  exchange: string | null;
}): Classification {
  const industry = titleCaseIndustry(params.industry);
  const searchText = [industry, params.companyName, params.exchange]
    .filter(Boolean)
    .join(" ");

  for (const rule of SECTOR_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(searchText))) {
      return {
        sector: rule.sector,
        industry,
      };
    }
  }

  return {
    sector: null,
    industry,
  };
}

function dataQualityScore(row: {
  symbol: string;
  company_name: string;
  exchange: string | null;
  country: string | null;
  industry: string | null;
  website: string | null;
  hq_lat: number | null;
  hq_lng: number | null;
}) {
  let score = 45;

  if (row.symbol) score += 10;
  if (row.company_name) score += 10;
  if (row.exchange) score += 10;
  if (row.country) score += 10;
  if (row.industry) score += 5;
  if (row.website) score += 5;
  if (row.hq_lat !== null && row.hq_lng !== null) score += 5;

  return Math.min(score, 100);
}

function buildSparqlQuery(limit: number, offset: number) {
  return `
SELECT
  ?company
  ?companyLabel
  (SAMPLE(?symbolRaw) AS ?symbol)
  (SAMPLE(?exchangeLabel) AS ?exchange)
  (SAMPLE(?countryLabel) AS ?country)
  (SAMPLE(?industryLabel) AS ?industry)
  (SAMPLE(?hqLabel) AS ?hq)
  (SAMPLE(?websiteRaw) AS ?website)
  (SAMPLE(?logoRaw) AS ?logo)
  (SAMPLE(?imageRaw) AS ?image)
  (SAMPLE(?coordRaw) AS ?coord)
WHERE {
  ?company p:P414 ?exchangeStatement .
  ?exchangeStatement ps:P414 ?exchange .

  OPTIONAL { ?exchangeStatement pq:P249 ?symbolQualifier . }
  OPTIONAL { ?company wdt:P249 ?symbolDirect . }

  BIND(COALESCE(?symbolQualifier, ?symbolDirect) AS ?symbolRaw)

  FILTER(BOUND(?symbolRaw))
  FILTER(STRLEN(STR(?symbolRaw)) > 0)

  OPTIONAL { ?company wdt:P17 ?country . }
  OPTIONAL { ?company wdt:P452 ?industry . }
  OPTIONAL {
    ?company wdt:P159 ?hq .
    OPTIONAL { ?hq wdt:P625 ?coordRaw . }
  }
  OPTIONAL { ?company wdt:P856 ?websiteRaw . }
  OPTIONAL { ?company wdt:P154 ?logoRaw . }
  OPTIONAL { ?company wdt:P18 ?imageRaw . }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?company rdfs:label ?companyLabel .
    ?exchange rdfs:label ?exchangeLabel .
    ?country rdfs:label ?countryLabel .
    ?industry rdfs:label ?industryLabel .
    ?hq rdfs:label ?hqLabel .
  }
}
GROUP BY ?company ?companyLabel
ORDER BY ?companyLabel
LIMIT ${limit}
OFFSET ${offset}
`;
}

async function fetchWikidataRows(limit: number, offset: number) {
  const query = buildSparqlQuery(limit, offset);

  const body = new URLSearchParams({
    query,
    format: "json",
  });

  const response = await fetch(WIKIDATA_SPARQL_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Stratify Analytics Corporate Intelligence Bot/1.0 (https://worldstats360.com)",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Wikidata SPARQL failed with status ${response.status}${
        text ? `: ${text.slice(0, 250)}` : ""
      }`,
    );
  }

  const json = await response.json();

  return Array.isArray(json?.results?.bindings)
    ? (json.results.bindings as WikidataBindingRow[])
    : [];
}

function toProfilePayload(row: WikidataBindingRow): ProfilePayload | null {
  const companyUrl = bindingValue(row, "company");
  const wikidataQid = parseQid(companyUrl);

  const symbol = normalizeSymbol(bindingValue(row, "symbol"));
  if (!symbol || symbol.length > 32) return null;

  const companyName = normalizeCompanyName(
    bindingValue(row, "companyLabel"),
    symbol,
  );

  const exchange = bindingValue(row, "exchange") || null;
  const country = bindingValue(row, "country") || null;
  const rawIndustry = bindingValue(row, "industry") || null;
  const classification = classifyCompany({
    industry: rawIndustry,
    companyName,
    exchange,
  });
  const hq = bindingValue(row, "hq") || null;
  const website = bindingValue(row, "website") || null;
  const logo = bindingValue(row, "logo") || null;
  const image = bindingValue(row, "image") || null;

  const parsedCoord = parseWikidataPoint(bindingValue(row, "coord"));
  const fallback = fallbackCentroid(country);

  const hqLat = parsedCoord.lat ?? fallback.lat;
  const hqLng = parsedCoord.lng ?? fallback.lng;

  const geocodeStatus =
    parsedCoord.lat !== null && parsedCoord.lng !== null
      ? "wikidata_hq_coordinate"
      : hqLat !== null && hqLng !== null
        ? "country_centroid_fallback"
        : null;

  const geocodeProvider =
    parsedCoord.lat !== null && parsedCoord.lng !== null
      ? "wikidata"
      : hqLat !== null && hqLng !== null
        ? "country_centroid"
        : null;

  const profile: ProfilePayload = {
    symbol,
    company_name: companyName,
    exchange,
    sector: classification.sector,
    industry: classification.industry,
    country,
    city: hq,
    state: null,
    address: [hq, country].filter(Boolean).join(", ") || country,
    website,
    employees: null,
    business_summary: null,

    source: "wikidata_global",
    raw_payload: {
      companyUrl,
      wikidataQid,
      symbol,
      exchange,
      country,
      industry: classification.industry,
      hq,
      website,
      logo,
      image,
    },
    fetched_at: new Date().toISOString(),

    hq_lat: hqLat,
    hq_lng: hqLng,
    geocode_provider: geocodeProvider,
    geocode_status: geocodeStatus,
    geocode_query: [hq, country].filter(Boolean).join(", ") || country,
    geocoded_at: geocodeStatus ? new Date().toISOString() : null,

    iso2: null,
    iso3: null,
    region: regionFromCountry(country),

    // This is the broad public company universe.
    // Later Finnhub enrichment can update market_cap and promote selected rows to global_large_caps.
    source_universe: "global_index",
    source_index: "Wikidata Listed Companies",
    wikidata_qid: wikidataQid,
    wikipedia_title: companyName,
    commons_category: null,
    logo_url: logo,
    image_url: image,
    market_cap: null,
    currency: null,
    data_quality_score: 0,
  };

  return {
    ...profile,
    data_quality_score: dataQualityScore(profile),
  };
}

function toCompanyPayload(row: ProfilePayload): CompanyPayload {
  return {
    symbol: row.symbol,
    name: row.company_name || row.symbol,
    sector: row.sector,
    sub_industry: row.industry,
    headquarters:
      row.address || [row.city, row.country].filter(Boolean).join(", ") || null,
    date_added: null,
    cik: null,
    founded: null,
    source: "wikidata_global",
  };
}

function chunk<T>(rows: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }

  return chunks;
}

async function safeInsertRefreshLog(payload: {
  p_refresh_type: string;
  p_status: string;
  p_total_records: number;
  p_success_count: number;
  p_failed_count: number;
  p_message: string;
  p_finished_at: string | null;
}) {
  const { error } = await supabase.rpc("ci_insert_refresh_log", payload);

  if (error) {
    console.error("ci_insert_refresh_log failed:", error);
  }
}

async function upsertCompanies(companyPayload: CompanyPayload[]) {
  let affected = 0;

  for (const batch of chunk(companyPayload, UPSERT_BATCH_SIZE)) {
    const { data, error } = await supabase.rpc("ci_upsert_companies", {
      payload: batch,
    });

    if (error) {
      throw {
        step: "ci_upsert_companies",
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      };
    }

    affected += Number(data ?? batch.length);
  }

  return affected;
}

async function upsertProfiles(profilePayload: ProfilePayload[]) {
  let affected = 0;

  for (const batch of chunk(profilePayload, UPSERT_BATCH_SIZE)) {
    /*
      FK-safe order:
      1) ci_upsert_companies is already completed for these symbols.
      2) Now ci_corporate_profiles can safely reference ci_companies.symbol.
    */
    const { data, error } = await supabase.rpc("ci_upsert_corporate_profiles", {
      payload: batch,
    });

    if (error) {
      throw {
        step: "ci_upsert_corporate_profiles",
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      };
    }

    affected += Number(data ?? batch.length);
  }

  return affected;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "wikidata-global-company-universe-import-fk-safe-classified",
    source: "Wikidata SPARQL",
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
    usage: {
      method: "POST",
      body: {
        limit: DEFAULT_LIMIT,
        offset: DEFAULT_OFFSET,
      },
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const requestedLimit = Number(body?.limit ?? DEFAULT_LIMIT);
    const requestedOffset = Number(body?.offset ?? DEFAULT_OFFSET);

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const offset =
      Number.isFinite(requestedOffset) && requestedOffset >= 0
        ? Math.floor(requestedOffset)
        : DEFAULT_OFFSET;

    await safeInsertRefreshLog({
      p_refresh_type: "wikidata_global_import",
      p_status: "running",
      p_total_records: 0,
      p_success_count: 0,
      p_failed_count: 0,
      p_message: `Started Wikidata global company import. limit=${limit}, offset=${offset}.`,
      p_finished_at: null,
    });

    const wikidataRows = await fetchWikidataRows(limit, offset);

    const profilePayload = wikidataRows
      .map(toProfilePayload)
      .filter((row): row is ProfilePayload => Boolean(row));

    const dedupedProfiles = Array.from(
      new Map(profilePayload.map((row) => [row.symbol, row])).values(),
    );

    const companyPayload = dedupedProfiles.map(toCompanyPayload);

    /*
      CRITICAL:
      ci_corporate_profiles.symbol has FK to ci_companies.symbol.
      Therefore we always upsert ci_companies first.
    */
    const companiesAffected = await upsertCompanies(companyPayload);
    const profilesAffected = await upsertProfiles(dedupedProfiles);

    await safeInsertRefreshLog({
      p_refresh_type: "wikidata_global_import",
      p_status: "success",
      p_total_records: wikidataRows.length,
      p_success_count: dedupedProfiles.length,
      p_failed_count: Math.max(0, wikidataRows.length - dedupedProfiles.length),
      p_message: `Fetched ${wikidataRows.length}; companies=${companyPayload.length}; profiles=${dedupedProfiles.length}; offset=${offset}.`,
      p_finished_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      source: "wikidata_global",
      sourceUniverse: "global_index",
      fetched: wikidataRows.length,
      importedCompanies: companyPayload.length,
      importedProfiles: dedupedProfiles.length,
      companiesAffected,
      profilesAffected,
      limit,
      offset,
      nextOffset: offset + limit,
      route: "wikidata-global-company-universe-import-fk-safe-classified",
      message:
        "Wikidata global company universe imported into ci_companies first, then ci_corporate_profiles.",
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await safeInsertRefreshLog({
      p_refresh_type: "wikidata_global_import",
      p_status: "failed",
      p_total_records: 0,
      p_success_count: 0,
      p_failed_count: 1,
      p_message: message,
      p_finished_at: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
