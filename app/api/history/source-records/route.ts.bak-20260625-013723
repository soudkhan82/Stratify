import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SegmentKey =
  | "wars"
  | "leaders"
  | "revolutions"
  | "disasters"
  | "civilizations";

type SourceDef = {
  key: string;
  label: string;
  titles: string[];
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
  articleUrl: string | null;
  source: string;
};

const cache = new Map<string, HistoryRecord[]>();

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return String(n) + "th";

  const mod10 = n % 10;
  if (mod10 === 1) return String(n) + "st";
  if (mod10 === 2) return String(n) + "nd";
  if (mod10 === 3) return String(n) + "rd";

  return String(n) + "th";
}

function bcCenturyPages(fromCentury: number, toCentury: number) {
  const out: string[] = [];

  for (let n = fromCentury; n >= toCentury; n--) {
    out.push("List of state leaders in the " + ordinal(n) + " century BC");
  }

  return out;
}

function adCenturyPages(fromCentury: number, toCentury: number) {
  const out: string[] = [];

  for (let n = fromCentury; n <= toCentury; n++) {
    out.push("List of state leaders in the " + ordinal(n) + " century");
  }

  return out;
}

function pre1000BcLeaderPages() {
  return bcCenturyPages(35, 11);
}

function leaders1000To501BcPages() {
  return bcCenturyPages(10, 6);
}

function leaders500To1BcPages() {
  return bcCenturyPages(5, 1);
}

function leaders1stTo5thCenturyPages() {
  return adCenturyPages(1, 5);
}

function singleCenturyLeaderPage(century: number) {
  return ["List of state leaders in the " + ordinal(century) + " century"];
}

const SOURCES: Record<SegmentKey, SourceDef[]> = {
  wars: [
    { key: "wars-before-1000", label: "Before 1000", titles: ["List of wars: before 1000"], type: "WAR / CONFLICT" },
    { key: "wars-1000-1499", label: "1000-1499", titles: ["List of wars: 1000–1499"], type: "WAR / CONFLICT" },
    { key: "wars-1500-1799", label: "1500-1799", titles: ["List of wars: 1500–1799"], type: "WAR / CONFLICT" },
    { key: "wars-1800-1899", label: "1800-1899", titles: ["List of wars: 1800–1899"], type: "WAR / CONFLICT" },
    { key: "wars-1900-1944", label: "1900-1944", titles: ["List of wars: 1900–1944"], type: "WAR / CONFLICT" },
    { key: "wars-1945-1989", label: "1945-1989", titles: ["List of wars: 1945–1989"], type: "WAR / CONFLICT" },
    { key: "wars-1990-2002", label: "1990-2002", titles: ["List of wars: 1990–2002"], type: "WAR / CONFLICT" },
    { key: "wars-2003-2019", label: "2003-2019", titles: ["List of wars: 2003–present"], type: "WAR / CONFLICT" },
    { key: "wars-2020-present", label: "2020-present", titles: ["List of wars: 2003–present"], type: "WAR / CONFLICT" }
  ],

  leaders: [
    { key: "leaders-before-1000-bc", label: "Before 1000 BC", titles: pre1000BcLeaderPages(), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-1000-501-bc", label: "1000–501 BC leaders", titles: leaders1000To501BcPages(), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-500-1-bc", label: "500–1 BC leaders", titles: leaders500To1BcPages(), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-1st-5th-century", label: "1st–5th century leaders", titles: leaders1stTo5thCenturyPages(), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-6th-century", label: "6th century leaders", titles: singleCenturyLeaderPage(6), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-7th-century", label: "7th century leaders", titles: singleCenturyLeaderPage(7), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-8th-century", label: "8th century leaders", titles: singleCenturyLeaderPage(8), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-9th-century", label: "9th century leaders", titles: singleCenturyLeaderPage(9), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-10th-century", label: "10th century leaders", titles: singleCenturyLeaderPage(10), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-15th-century", label: "15th century leaders", titles: singleCenturyLeaderPage(15), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-18th-century", label: "18th century leaders", titles: singleCenturyLeaderPage(18), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-19th-century", label: "19th century leaders", titles: singleCenturyLeaderPage(19), type: "LEADER / HEAD OF STATE" },
    { key: "leaders-20th-century", label: "20th century leaders", titles: ["List of state leaders in the 20th century"], type: "LEADER / HEAD OF STATE" },
    { key: "leaders-21st-century", label: "21st century leaders", titles: ["List of state leaders in the 21st century"], type: "LEADER / HEAD OF STATE" },
  ],

  revolutions: [
    { key: "revolutions-rebellions", label: "Revolutions & rebellions", titles: ["List of revolutions and rebellions"], type: "INDEPENDENCE / REVOLUTION" },
    { key: "coups", label: "Coups", titles: ["List of coups and coup attempts"], type: "INDEPENDENCE / REVOLUTION" },
    { key: "independence", label: "Independence movements", titles: ["List of national independence movements"], type: "INDEPENDENCE / REVOLUTION" }
  ],

  disasters: [
    { key: "natural-disasters", label: "Natural disasters", titles: ["List of natural disasters by death toll"], type: "DISASTER" },
    { key: "pandemics", label: "Pandemics & epidemics", titles: ["List of epidemics and pandemics"], type: "PANDEMIC / EPIDEMIC" },
    { key: "famines", label: "Famines", titles: ["List of famines"], type: "FAMINE" },
    { key: "earthquakes", label: "Earthquakes", titles: ["List of earthquakes"], type: "EARTHQUAKE" },
    { key: "floods", label: "Floods", titles: ["List of floods"], type: "FLOOD" },
    { key: "volcanic-eruptions", label: "Volcanic eruptions", titles: ["List of volcanic eruptions by death toll"], type: "VOLCANIC ERUPTION" }
  ],

  civilizations: [
    { key: "ancient-civilizations", label: "Ancient civilizations", titles: ["List of ancient civilizations"], type: "EMPIRE / CIVILIZATION" },
    { key: "bronze-age-states", label: "Bronze Age states", titles: ["List of Bronze Age states"], type: "EMPIRE / CIVILIZATION" },
    { key: "iron-age-states", label: "Iron Age states", titles: ["List of Iron Age states"], type: "EMPIRE / CIVILIZATION" },
    { key: "classical-age-states", label: "Classical Age states", titles: ["List of Classical Age states"], type: "EMPIRE / CIVILIZATION" }
  ]
};

const SOURCE_ALIASES: Record<string, string> = {
  "battles-before-301": "leaders-before-1000-bc",
  "battles-301-1300": "leaders-10th-century",
  "battles-1301-1600": "leaders-15th-century",
  "battles-1601-1800": "leaders-18th-century",
  "battles-1801-1900": "leaders-19th-century",
  "battles-1901-2000": "leaders-20th-century",
  "battles-since-2001": "leaders-21st-century",
  "leaders-ancient": "leaders-1000-501-bc",
  "empires-list": "natural-disasters",
  "largest-empires": "pandemics"
};

function normalizeSegment(value: string | null): SegmentKey {
  if (value === "battles") return "leaders";
  if (value === "empires") return "disasters";

  if (
    value === "wars" ||
    value === "leaders" ||
    value === "revolutions" ||
    value === "disasters" ||
    value === "civilizations"
  ) {
    return value;
  }

  return "wars";
}

function resolveSource(segment: SegmentKey, sourceKey: string | null) {
  const normalizedKey = SOURCE_ALIASES[sourceKey || ""] || sourceKey || "";
  const list = SOURCES[segment] || SOURCES.wars;
  return list.find((item) => item.key === normalizedKey) || list[0];
}

function wikiUrl(title: string) {
  return "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_"));
}

function stripWiki(value: string) {
  return value
    .replace(/<ref[\s\S]*?<\/ref>/gi, " ")
    .replace(/<ref[^>]*\/>/gi, " ")
    .replace(/\{\{[\s\S]*?\}\}/g, " ")
    .replace(/\[\[File:[^\]]+\]\]/gi, " ")
    .replace(/\[\[Image:[^\]]+\]\]/gi, " ")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\|\|/g, " ")
    .replace(/\|/g, " ")
    .replace(/!!/g, " ")
    .replace(/!/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(line: string) {
  const links: Array<{ title: string; label: string }> = [];
  const re = /\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|([^\]]+))?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line))) {
    const title = String(match[1] || "").trim();
    const label = String(match[2] || match[1] || "").trim();

    if (!title) continue;
    if (/^(file|image|category|template|help|portal):/i.test(title)) continue;
    if (/^list of/i.test(title)) continue;

    links.push({ title, label });
  }

  return links;
}

function parseYear(raw: string, isBc: boolean) {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return isBc ? -Math.trunc(n) : Math.trunc(n);
}

function extractYears(line: string) {
  const text = stripWiki(line);

  let m = text.match(/(\d{1,5})\s*(?:BC|BCE)\s*[–—-]\s*(\d{1,5})\s*(?:BC|BCE)/i);
  if (m) {
    const start = parseYear(m[1], true);
    const end = parseYear(m[2], true);
    return { year: start, startYear: start, endYear: end };
  }

  m = text.match(/(\d{1,5})\s*[–—-]\s*(\d{1,5})\s*(?:BC|BCE)/i);
  if (m) {
    const start = parseYear(m[1], true);
    const end = parseYear(m[2], true);
    return { year: start, startYear: start, endYear: end };
  }

  m = text.match(/(\d{3,4})\s*[–—-]\s*(\d{2,4}|present|ongoing)/i);
  if (m) {
    const start = parseYear(m[1], false);
    const end =
      /present|ongoing/i.test(m[2])
        ? new Date().getFullYear()
        : parseYear(m[2].length === 2 ? m[1].slice(0, 2) + m[2] : m[2], false);

    return { year: start, startYear: start, endYear: end };
  }

  m = text.match(/c\.\s*(\d{1,5})\s*(?:BC|BCE)/i);
  if (m) {
    const year = parseYear(m[1], true);
    return { year, startYear: year, endYear: year };
  }

  m = text.match(/(\d{1,5})\s*(?:BC|BCE)/i);
  if (m) {
    const year = parseYear(m[1], true);
    return { year, startYear: year, endYear: year };
  }

  m = text.match(/c\.\s*([1-2]\d{3}|[3-9]\d{2}|[1-9]\d{1,2})/i);
  if (m) {
    const year = parseYear(m[1], false);
    return { year, startYear: year, endYear: year };
  }

  m = text.match(/(?:^|[^\d])([1-2]\d{3}|[3-9]\d{2}|[1-9]\d{1,2})(?!\d)/);
  if (m) {
    const year = parseYear(m[1], false);
    return { year, startYear: year, endYear: year };
  }

  return { year: null, startYear: null, endYear: null };
}

function chooseTitle(links: Array<{ title: string; label: string }>, segment: SegmentKey) {
  if (!links.length) return null;

  if (segment === "leaders") {
    return (
      links.find((item) =>
        !/state leaders|list of|century|country|kingdom|dynasty|empire|caliphate|papal states|america|asia|europe|africa|oceania|middle east|north america|south america/i.test(item.title) &&
        !/state leaders|list of|century|country|kingdom|dynasty|empire|caliphate|papal states|america|asia|europe|africa|oceania|middle east|north america|south america/i.test(item.label)
      ) || links[0]
    );
  }

  return (
    links.find((item) =>
      !/^:?list of/i.test(item.title) &&
      !/^:?list of/i.test(item.label)
    ) || links[0]
  );
}

async function fetchWikitext(pageTitle: string) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&origin=*&redirects=1&page=" +
    encodeURIComponent(pageTitle);

  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "StratifyHistory/1.0" }
  });

  if (!response.ok) return "";

  const json = await response.json();
  return String(json?.parse?.wikitext || "");
}

async function loadRecords(segment: SegmentKey, source: SourceDef) {
  const cacheKey = segment + "::" + source.key;

  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const records: HistoryRecord[] = [];
  const seen = new Set<string>();

  for (const pageTitle of source.titles) {
    const wikitext = await fetchWikitext(pageTitle);
    if (!wikitext) continue;

    const lines = wikitext.split(/\r?\n/);

    for (const line of lines) {
      if (!line.includes("[[")) continue;
      if (/category:|file:|image:/i.test(line)) continue;

      const cleanLine = stripWiki(line);

      // skip redirect/list index rows so Wikipedia redirects do not become fake events
      if (/^#?\s*redirect/i.test(cleanLine) || /^:?\s*list of /i.test(cleanLine)) {
        continue;
      }

      if (segment === "leaders") {
        // State-leader Wikipedia rows often contain only name + reign years.
        // Do not require words like king/emperor, otherwise valid rows are skipped.
        if (/^(africa|asia|europe|americas|oceania|middle east|north america|south america)$/i.test(cleanLine)) {
          continue;
        }
      }

      const links = extractLinks(line);
      const picked = chooseTitle(links, segment);
      if (!picked) continue;

      const years = extractYears(line);

      if (
        years.year === null &&
        years.startYear === null &&
        years.endYear === null
      ) {
        continue;
      }

      const title = stripWiki(picked.label || picked.title)
        .replace(/\s*\([^)]*\)\s*$/g, "")
        .trim();

      if (!title || title.length < 2 || /^\d+$/.test(title)) continue;

      const uniqueKey = title + "|" + String(years.startYear) + "|" + String(years.endYear) + "|" + pageTitle;

      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      records.push({
        qid: null,
        title,
        description: cleanLine.slice(0, 260),
        type: source.type,
        year: years.year,
        startYear: years.startYear,
        endYear: years.endYear,
        articleUrl: wikiUrl(picked.title),
        source: "Wikipedia · " + pageTitle
      });
    }
  }

  records.sort((a, b) => {
    const ay = a.startYear ?? a.year ?? 999999;
    const by = b.startYear ?? b.year ?? 999999;
    return ay - by || a.title.localeCompare(b.title);
  });

  cache.set(cacheKey, records);
  return records;
}

function overlapsRange(record: HistoryRecord, from: number, to: number) {
  const start = record.startYear ?? record.year ?? record.endYear;
  const end = record.endYear ?? record.year ?? record.startYear;

  if (start === null || start === undefined || end === null || end === undefined) {
    return false;
  }

  return end >= from && start <= to;
}

function mainYear(record: HistoryRecord) {
  return record.year ?? record.startYear ?? record.endYear;
}

function formatYear(year: number) {
  return year < 0 ? String(Math.abs(year)) + " BC" : String(year);
}

function buildBuckets(records: HistoryRecord[], from: number | null, to: number | null) {
  const years = records
    .map(mainYear)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));

  if (!years.length) return [];

  const start = Math.trunc(from ?? Math.min(...years));
  const end = Math.trunc(to ?? Math.max(...years));
  const span = Math.max(1, end - start + 1);
  const bucketCount = Math.min(10, span);

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketFrom = start + Math.floor((index * span) / bucketCount);
    const bucketTo = start + Math.floor(((index + 1) * span) / bucketCount) - 1;

    return {
      bucket: bucketFrom,
      from: bucketFrom,
      to: Math.max(bucketFrom, bucketTo),
      label:
        bucketFrom === bucketTo
          ? formatYear(bucketFrom)
          : formatYear(bucketFrom) + "-" + formatYear(Math.max(bucketFrom, bucketTo)),
      count: 0,
      pct: 0
    };
  });

  for (const record of records) {
    const year = mainYear(record);

    if (year === null || year === undefined) continue;
    if (year < start || year > end) continue;

    const index = Math.min(
      bucketCount - 1,
      Math.floor(((year - start) * bucketCount) / span)
    );

    buckets[index].count += 1;
  }

  const max = Math.max(...buckets.map((bucket) => bucket.count), 0);

  return buckets.map((bucket) => ({
    ...bucket,
    pct: max
      ? Math.max(bucket.count > 0 ? 7 : 0, Math.round((bucket.count / max) * 100))
      : 0
  }));
}

function fallbackLeaderRecords(source: SourceDef): HistoryRecord[] {
  const common: Record<string, Array<{
    title: string;
    year: number;
    startYear: number;
    endYear: number;
    description: string;
  }>> = {
    "leaders-before-1000-bc": [
      { title: "Narmer", year: -3100, startYear: -3100, endYear: -3050, description: "Early Egyptian ruler associated with the unification of Upper and Lower Egypt." },
      { title: "Sargon of Akkad", year: -2334, startYear: -2334, endYear: -2279, description: "Founder of the Akkadian Empire in Mesopotamia." },
      { title: "Hammurabi", year: -1792, startYear: -1792, endYear: -1750, description: "King of Babylon known for the Code of Hammurabi." },
      { title: "Ramesses II", year: -1279, startYear: -1279, endYear: -1213, description: "Powerful pharaoh of Egypt's Nineteenth Dynasty." }
    ],
    "leaders-1000-501-bc": [
      { title: "David", year: -1000, startYear: -1000, endYear: -970, description: "King of Israel and Judah in biblical tradition." },
      { title: "Ashur-rabi II", year: -1013, startYear: -1013, endYear: -972, description: "King of Assyria." },
      { title: "Tiglath-Pileser III", year: -745, startYear: -745, endYear: -727, description: "King of the Neo-Assyrian Empire." },
      { title: "Nebuchadnezzar II", year: -605, startYear: -605, endYear: -562, description: "King of the Neo-Babylonian Empire." }
    ],
    "leaders-500-1-bc": [
      { title: "Darius the Great", year: -522, startYear: -522, endYear: -486, description: "Achaemenid Persian ruler who expanded and organized the empire." },
      { title: "Pericles", year: -461, startYear: -461, endYear: -429, description: "Influential Athenian statesman during the classical period." },
      { title: "Alexander the Great", year: -336, startYear: -336, endYear: -323, description: "King of Macedon whose campaigns created one of the largest empires of the ancient world." },
      { title: "Ashoka", year: -268, startYear: -268, endYear: -232, description: "Mauryan emperor who ruled much of the Indian subcontinent." },
      { title: "Qin Shi Huang", year: -221, startYear: -221, endYear: -210, description: "First emperor of a unified China." },
      { title: "Cleopatra", year: -51, startYear: -51, endYear: -30, description: "Last active ruler of the Ptolemaic Kingdom of Egypt." }
    ],
    "leaders-1st-5th-century": [
      { title: "Augustus", year: -27, startYear: -27, endYear: 14, description: "Founder of the Roman Empire and its first emperor." },
      { title: "Tiberius", year: 14, startYear: 14, endYear: 37, description: "Second Roman emperor." },
      { title: "Trajan", year: 98, startYear: 98, endYear: 117, description: "Roman emperor under whom the empire reached great territorial extent." },
      { title: "Hadrian", year: 117, startYear: 117, endYear: 138, description: "Roman emperor known for administrative reforms and Hadrian's Wall." },
      { title: "Diocletian", year: 284, startYear: 284, endYear: 305, description: "Roman emperor who introduced major reforms and the Tetrarchy." },
      { title: "Constantine the Great", year: 306, startYear: 306, endYear: 337, description: "Roman emperor associated with major imperial and religious reforms." },
      { title: "Theodosius I", year: 379, startYear: 379, endYear: 395, description: "Roman emperor who ruled before the final division of the empire." }
    ],
    "leaders-6th-century": [
      { title: "Justinian I", year: 527, startYear: 527, endYear: 565, description: "Byzantine emperor known for legal codification and imperial reconquest." },
      { title: "Khosrow I", year: 531, startYear: 531, endYear: 579, description: "Sasanian king known for administrative and military reforms." },
      { title: "Emperor Wu of Liang", year: 502, startYear: 502, endYear: 549, description: "Chinese emperor of the Liang dynasty." },
      { title: "Clovis I", year: 481, startYear: 481, endYear: 511, description: "King of the Franks and founder of Merovingian power." }
    ],
    "leaders-7th-century": [
      { title: "Heraclius", year: 610, startYear: 610, endYear: 641, description: "Byzantine emperor during the Byzantine-Sasanian War and early Islamic expansion." },
      { title: "Abu Bakr", year: 632, startYear: 632, endYear: 634, description: "First caliph of the Rashidun Caliphate." },
      { title: "Umar", year: 634, startYear: 634, endYear: 644, description: "Second Rashidun caliph." },
      { title: "Uthman", year: 644, startYear: 644, endYear: 656, description: "Third Rashidun caliph." },
      { title: "Ali", year: 656, startYear: 656, endYear: 661, description: "Fourth Rashidun caliph." },
      { title: "Mu'awiya I", year: 661, startYear: 661, endYear: 680, description: "Founder of the Umayyad Caliphate." },
      { title: "Emperor Taizong of Tang", year: 626, startYear: 626, endYear: 649, description: "Tang emperor regarded as one of China's major rulers." }
    ],
    "leaders-8th-century": [
      { title: "Abd al-Malik ibn Marwan", year: 685, startYear: 685, endYear: 705, description: "Umayyad caliph associated with major administrative reforms." },
      { title: "Al-Walid I", year: 705, startYear: 705, endYear: 715, description: "Umayyad caliph during a period of expansion." },
      { title: "Charles Martel", year: 718, startYear: 718, endYear: 741, description: "Frankish statesman and military leader." },
      { title: "Pepin the Short", year: 751, startYear: 751, endYear: 768, description: "King of the Franks and father of Charlemagne." },
      { title: "Charlemagne", year: 768, startYear: 768, endYear: 814, description: "King of the Franks and later emperor in Western Europe." },
      { title: "Al-Mansur", year: 754, startYear: 754, endYear: 775, description: "Abbasid caliph and founder of Baghdad." }
    ],
    "leaders-9th-century": [
      { title: "Charlemagne", year: 800, startYear: 768, endYear: 814, description: "Crowned emperor in 800 and central figure of early medieval Europe." },
      { title: "Louis the Pious", year: 814, startYear: 814, endYear: 840, description: "Carolingian emperor and son of Charlemagne." },
      { title: "Al-Ma'mun", year: 813, startYear: 813, endYear: 833, description: "Abbasid caliph associated with the flourishing of learning in Baghdad." },
      { title: "Alfred the Great", year: 871, startYear: 871, endYear: 899, description: "King of Wessex known for defending against Viking invasions and reforms." },
      { title: "Basil I", year: 867, startYear: 867, endYear: 886, description: "Byzantine emperor and founder of the Macedonian dynasty." }
    ]
  };

  const rows = common[source.key] || [];

  return rows.map((item) => ({
    qid: null,
    title: item.title,
    description: item.description,
    type: source.type,
    year: item.year,
    startYear: item.startYear,
    endYear: item.endYear,
    articleUrl: wikiUrl(item.title),
    source: "Wikipedia · leader fallback index"
  }));
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    const segment = normalizeSegment(url.searchParams.get("segment"));
    const source = resolveSource(segment, url.searchParams.get("sourceKey"));

    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(1000, Math.max(1, Number(url.searchParams.get("pageSize") || 25)));

    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();

    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");

    const from = fromRaw !== null && Number.isFinite(Number(fromRaw)) ? Number(fromRaw) : null;
    const to = toRaw !== null && Number.isFinite(Number(toRaw)) ? Number(toRaw) : null;

    let events = await loadRecords(segment, source);

    if (segment === "leaders" && events.length === 0) {
      events = fallbackLeaderRecords(source);
    }

    if (q) {
      events = events.filter((record) => {
        const haystack = (record.title + " " + (record.description || "") + " " + record.type + " " + record.source).toLowerCase();
        return haystack.includes(q);
      });
    }

    if (from !== null && to !== null) {
      const rangeFrom = Math.min(from, to);
      const rangeTo = Math.max(from, to);
      events = events.filter((record) => overlapsRange(record, rangeFrom, rangeTo));
    }

    const total = events.length;
    const offset = (page - 1) * pageSize;
    const paged = events.slice(offset, offset + pageSize);

    return NextResponse.json({
      ok: true,
      segment,
      label: source.label,
      sourceKey: source.key,
      sourceLabel: source.label,
      sourceTitle: source.titles.join(" | "),
      page,
      pageSize,
      events: paged,
      total,
      hasMore: offset + pageSize < total,
      buckets: buildBuckets(events, from, to),
      activeRange:
        from !== null && to !== null
          ? { from: Math.min(from, to), to: Math.max(from, to) }
          : null,
      warning: null
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        events: [],
        total: 0,
        hasMore: false,
        buckets: [],
        warning: error?.message || "Unable to load history source records."
      },
      { status: 200 }
    );
  }
}



