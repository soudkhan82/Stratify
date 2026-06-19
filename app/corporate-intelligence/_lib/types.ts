export type CorporateProfile = {
  id?: number;
  symbol: string;
  company_name: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  city?: string | null;
  state?: string | null;
  headquarters: string | null;
  exchange: string | null;
  source: string | null;
  fetched_at?: string | null;

  date_added?: string | null;
  cik?: string | null;
  founded?: string | null;
  website?: string | null;
  employees?: number | string | null;
  business_summary?: string | null;

  hq_lat?: number | string | null;
  hq_lng?: number | string | null;
  geocode_provider?: string | null;
  geocode_status?: string | null;
  geocode_query?: string | null;
  geocoded_at?: string | null;

  price?: number | string | null;
  change?: number | string | null;
  change_percent?: number | string | null;
  volume?: number | string | null;
  avg_volume?: number | string | null;
  live_market_cap?: number | string | null;
  day_low?: number | string | null;
  day_high?: number | string | null;
  year_low?: number | string | null;
  year_high?: number | string | null;
  pe?: number | string | null;
  eps?: number | string | null;
  quote_time?: string | null;
  quote_source?: string | null;
  quote_updated_at?: string | null;

  market_cap?: number | string | null;
  market_value?: number | string | null;
  market_value_usd?: number | string | null;
};

export type CorporateDirectorySummary = {
  total_companies: number;
  sectors: number;
  industries: number;
  countries: number;
  enriched_profiles: number;
};

export type ChartDatum = {
  name: string;
  value: number;
};
