export type PulseTopic =
  | "all"
  | "geo-economy"
  | "geopolitics"
  | "energy"
  | "trade"
  | "food"
  | "climate"
  | "society"
  | "health"
  | "crises"
  | "pakistan"
  | "history";

export type PulseSourceId =
  | "gdelt"
  | "reliefweb"
  | "world-bank"
  | "imf"
  | "wto"
  | "fao"
  | "wikipedia";

export type PulseSourceType =
  | "publisher"
  | "official"
  | "institution"
  | "knowledge";

export type PulseItem = {
  id: string;
  sourceId: PulseSourceId;
  source: string;
  sourceType: PulseSourceType;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  topic: Exclude<PulseTopic, "all">;
  topics: Array<Exclude<PulseTopic, "all">>;
  countries: string[];
  language: string | null;
  sourceCountry: string | null;
  tone: number | null;
  isOfficial: boolean;
  score: number;
  moduleHref: string;
  moduleLabel: string;
  year?: number | null;
};

export type PulseSourceStatus = {
  id: PulseSourceId;
  label: string;
  ok: boolean;
  count: number;
  configured: boolean;
  error: string | null;
};

export type PulseTrendingItem = {
  topic: Exclude<PulseTopic, "all">;
  label: string;
  count: number;
  score: number;
};

export type PulseResponse = {
  ok: boolean;
  generatedAt: string;
  filters: {
    topic: PulseTopic;
    q: string;
    country: string;
    hours: number;
  };
  counts: {
    total: number;
    sourcesOk: number;
    sourcesTotal: number;
    official: number;
    publishers: number;
  };
  hero: PulseItem | null;
  items: PulseItem[];
  officialUpdates: PulseItem[];
  todayInHistory: PulseItem[];
  trending: PulseTrendingItem[];
  sourceStatus: PulseSourceStatus[];
  warnings: string[];
  error?: string;
};
