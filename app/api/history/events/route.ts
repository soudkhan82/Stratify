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

type ModernCountry = {
  iso3: string;
  country: string;
};

type HistoryEvent = {
  qid: string;
  title: string;
  description: string | null;
  type: string;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  modernCountry: string | null;
  modernIso3: string | null;
  modernCountries: ModernCountry[];
  participants: string[];
  outcomes: string[];
  lat: number | null;
  lng: number | null;
  articleUrl: string | null;
  confidence: "high" | "medium" | "low";
};

const TAB_CONFIG: Record<
  HistoryTab,
  {
    label: string;
    classes: string[];
    defaultFrom: number;
    defaultTo: number;
    note: string;
  }
> = {
  conflicts: {
    label: "Wars & Conflicts",
    classes: ["Q198", "Q8465", "Q180684"],
    defaultFrom: 401,
    defaultTo: 2026,
    note: "Wars, civil wars and wider military conflicts.",
  },
  battles: {
    label: "Battles & Sieges",
    classes: ["Q178561", "Q188055"],
    defaultFrom: -500,
    defaultTo: 2026,
    note: "Battle and siege-level events.",
  },
  revolutions: {
    label: "Independence & Revolutions",
    classes: ["Q10931", "Q45382", "Q124734"],
    defaultFrom: 1701,
    defaultTo: 2026,
    note: "Revolutions, coups, uprisings and independence-related events.",
  },
  empires: {
    label: "Empires & Kingdoms",
    classes: ["Q48349", "Q3024240", "Q1790360"],
    defaultFrom: -500,
    defaultTo: 2026,
    note: "Empires, kingdoms and historical states where dates exist.",
  },
  civilizations: {
    label: "Civilizations",
    classes: ["Q8432", "Q3024240"],
    defaultFrom: -4000,
    defaultTo: 1600,
    note: "Civilizations and ancient historical entities where Wikidata has dates.",
  },
};

const TERRITORY_BLOCKLIST = new Set([
  "ATA",
  "ATF",
  "BVT",
  "CCK",
  "CXR",
  "HMD",
  "IOT",
  "SGS",
]);

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
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

function parsePoint(value: string): { lat: number; lng: number } | null {
  const s = cleanText(value);
  const match = s.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (!match) return null;

  const lng = Number(match[1]);
  const lat = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function addUniqueString(list: string[], value: string) {
  const clean = cleanText(value);
  if (!clean) return list;

  if (list.some((item) => item.toLowerCase() === clean.toLowerCase())) {
    return list;
  }

  return [...list, clean];
}

function addUniqueCountry(list: ModernCountry[], iso3: string, country: string) {
  const cleanIso3 = cleanText(iso3).toUpperCase();
  const cleanCountry = cleanText(country) || cleanIso3;

  if (!cleanIso3 || cleanIso3.length !== 3) return list;
  if (TERRITORY_BLOCKLIST.has(cleanIso3)) return list;

  if (list.some((item) => item.iso3 === cleanIso3)) {
    return list;
  }

  return [...list, { iso3: cleanIso3, country: cleanCountry }];
}

function buildSeedQuery(args: {
  tab: HistoryTab;
  from: number;
  to: number;
  limit: number;
}) {
  const config = TAB_CONFIG[args.tab];
  const classes = config.classes.map((qid) => `wd:${qid}`).join(" ");

  return `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX wikibase: <http://wikiba.se/ontology#>

SELECT DISTINCT
  ?item
  ?itemLabel
  ?itemDescription
  ?classLabel
  ?eventDate
  ?endDate
  ?year
WHERE {
  VALUES ?class { ${classes} }

  ?item wdt:P31 ?class .

  OPTIONAL { ?item wdt:P585 ?pointDate. }
  OPTIONAL { ?item wdt:P580 ?startDate. }
  OPTIONAL { ?item wdt:P571 ?inceptionDate. }

  BIND(COALESCE(?pointDate, ?startDate, ?inceptionDate) AS ?eventDate)
  FILTER(BOUND(?eventDate))

  BIND(YEAR(?eventDate) AS ?year)
  FILTER(?year >= ${args.from} && ?year <= ${args.to})

  OPTIONAL { ?item wdt:P582 ?endDateRaw. }
  OPTIONAL { ?item wdt:P576 ?dissolvedDate. }
  BIND(COALESCE(?endDateRaw, ?dissolvedDate) AS ?endDate)

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
}
ORDER BY ASC(?year) ?itemLabel
LIMIT ${args.limit}
`;
}

function buildDetailQuery(qids: string[]) {
  const values = qids.map((qid) => `wd:${qid}`).join(" ");

  return `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>

SELECT DISTINCT
  ?item
  ?locationLabel
  ?coord
  ?countryLabel
  ?iso3
  ?participantLabel
  ?participantCountryLabel
  ?participantIso3
  ?winnerLabel
  ?winnerCountryLabel
  ?winnerIso3
  ?article
WHERE {
  VALUES ?item { ${values} }

  OPTIONAL { ?item wdt:P276 ?location. }
  OPTIONAL { ?location wdt:P625 ?locationCoord. }
  OPTIONAL { ?location wdt:P17 ?locationCountry. }

  OPTIONAL { ?item wdt:P625 ?itemCoord. }
  OPTIONAL { ?item wdt:P17 ?itemCountry. }

  OPTIONAL {
    ?item wdt:P36 ?capital.
    OPTIONAL { ?capital wdt:P625 ?capitalCoord. }
    OPTIONAL { ?capital wdt:P17 ?capitalCountry. }
  }

  BIND(COALESCE(?itemCoord, ?locationCoord, ?capitalCoord) AS ?coord)
  BIND(COALESCE(?locationCountry, ?itemCountry, ?capitalCountry) AS ?country)

  OPTIONAL { ?country wdt:P298 ?iso3. }

  OPTIONAL {
    ?item wdt:P710 ?participant.
    OPTIONAL { ?participant wdt:P17 ?participantCountry. }
    OPTIONAL { ?participantCountry wdt:P298 ?participantIso3. }
  }

  OPTIONAL {
    ?item wdt:P1346 ?winner.
    OPTIONAL { ?winner wdt:P17 ?winnerCountry. }
    OPTIONAL { ?winnerCountry wdt:P298 ?winnerIso3. }
  }

  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
}
`;
}

async function queryWikidata(sparql: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
          "StratifyAnalytics/1.0 (https://worldstats360.com; history-intelligence)",
      },
      body,
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Wikidata query failed: ${response.status} ${response.statusText}`,
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function normalizeSeedRows(rows: SparqlRow[]): HistoryEvent[] {
  const map = new Map<string, HistoryEvent>();

  for (const row of rows) {
    const qid = qidFromUri(binding(row, "item"));
    const title = binding(row, "itemLabel");

    if (!qid || !title) continue;

    if (map.has(qid)) continue;

    map.set(qid, {
      qid,
      title,
      description: binding(row, "itemDescription") || null,
      type: binding(row, "classLabel") || "Historical event",
      year: parseYear(binding(row, "year")),
      startDate: binding(row, "eventDate") || null,
      endDate: binding(row, "endDate") || null,
      location: null,
      modernCountry: null,
      modernIso3: null,
      modernCountries: [],
      participants: [],
      outcomes: [],
      lat: null,
      lng: null,
      articleUrl: `https://www.wikidata.org/wiki/${qid}`,
      confidence: "low",
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const ay = a.year ?? 999999;
    const by = b.year ?? 999999;
    if (ay !== by) return ay - by;
    return a.title.localeCompare(b.title);
  });
}

function mergeDetailRows(events: HistoryEvent[], rows: SparqlRow[]) {
  const map = new Map(events.map((event) => [event.qid, event]));

  for (const row of rows) {
    const qid = qidFromUri(binding(row, "item"));
    const event = map.get(qid);
    if (!event) continue;

    const coord = parsePoint(binding(row, "coord"));
    if (coord && event.lat === null && event.lng === null) {
      event.lat = coord.lat;
      event.lng = coord.lng;
    }

    const location = binding(row, "locationLabel");
    if (location) {
      const currentLocations = event.location
        ? event.location.split(",").map((x) => x.trim())
        : [];

      const merged = addUniqueString(currentLocations, location);
      event.location = merged.join(", ");
    }

    event.modernCountries = addUniqueCountry(
      event.modernCountries,
      binding(row, "iso3"),
      binding(row, "countryLabel"),
    );

    event.modernCountries = addUniqueCountry(
      event.modernCountries,
      binding(row, "participantIso3"),
      binding(row, "participantCountryLabel"),
    );

    event.modernCountries = addUniqueCountry(
      event.modernCountries,
      binding(row, "winnerIso3"),
      binding(row, "winnerCountryLabel"),
    );

    event.participants = addUniqueString(
      event.participants,
      binding(row, "participantLabel"),
    );

    const winner = binding(row, "winnerLabel");
    if (winner) {
      event.outcomes = addUniqueString(event.outcomes, `Winner: ${winner}`);
    }

    const article = binding(row, "article");
    if (article) event.articleUrl = article;

    event.modernIso3 = event.modernCountries[0]?.iso3 || null;
    event.modernCountry = event.modernCountries[0]?.country || null;

    event.confidence =
      event.lat !== null && event.lng !== null && event.modernCountries.length
        ? "high"
        : event.modernCountries.length
          ? "medium"
          : "low";
  }

  return Array.from(map.values()).sort((a, b) => {
    const ay = a.year ?? 999999;
    const by = b.year ?? 999999;
    if (ay !== by) return ay - by;
    return a.title.localeCompare(b.title);
  });
}

function aggregateByCountry(events: HistoryEvent[]) {
  const map = new Map<string, { iso3: string; country: string; value: number }>();

  for (const event of events) {
    const countedForThisEvent = new Set<string>();

    for (const country of event.modernCountries || []) {
      const iso3 = country.iso3.toUpperCase();
      if (!iso3 || countedForThisEvent.has(iso3)) continue;

      countedForThisEvent.add(iso3);

      const current =
        map.get(iso3) ||
        ({
          iso3,
          country: country.country || iso3,
          value: 0,
        } satisfies { iso3: string; country: string; value: number });

      current.value += 1;
      map.set(iso3, current);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const tabRaw = cleanText(searchParams.get("tab") || "conflicts");
    const tab = Object.prototype.hasOwnProperty.call(TAB_CONFIG, tabRaw)
      ? (tabRaw as HistoryTab)
      : "conflicts";

    const config = TAB_CONFIG[tab];

    const from = asInt(searchParams.get("from"), config.defaultFrom);
    const to = asInt(searchParams.get("to"), config.defaultTo);
    const limit = clamp(asInt(searchParams.get("limit"), 50), 10, 80);

    const normalizedFrom = Math.min(from, to);
    const normalizedTo = Math.max(from, to);

    const seedRows = await queryWikidata(
      buildSeedQuery({
        tab,
        from: normalizedFrom,
        to: normalizedTo,
        limit,
      }),
      12000,
    );

    let events = normalizeSeedRows(seedRows);
    let detailWarning: string | null = null;

    const qids = events.map((event) => event.qid).filter(Boolean);

    try {
      const detailRows: SparqlRow[] = [];

      for (const chunk of chunkArray(qids, 20)) {
        if (!chunk.length) continue;

        const rows = await queryWikidata(buildDetailQuery(chunk), 12000);
        detailRows.push(...rows);
      }

      events = mergeDetailRows(events, detailRows);
    } catch (detailError) {
      detailWarning =
        detailError instanceof Error
          ? detailError.message
          : "Detail enrichment failed";
    }

    const countryRows = aggregateByCountry(events);

    return NextResponse.json(
      {
        ok: true,
        tab,
        label: config.label,
        note: config.note,
        from: normalizedFrom,
        to: normalizedTo,
        events,
        countryRows,
        total: events.length,
        mappedCountries: countryRows.length,
        source: "Wikidata Query Service",
        queryMode: "two-step-seed-plus-detail",
        detailWarning,
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
        ok: false,
        error:
          error instanceof Error ? error.message : "History events API failed",
        hint: "Try a smaller century/range or reduce limit.",
        events: [],
        countryRows: [],
      },
      { status: 500 },
    );
  }
}
