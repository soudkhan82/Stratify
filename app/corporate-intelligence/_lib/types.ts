export type CorporateProfile = {
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
