export type CountryOption = {
  iso3: string;
  country: string;
  region: string;
};

export type PolicyFiltersState = {
  region: string;
  country: string;
  sector: string;
  kind: string;
  search: string;
};

export type PolicyKpis = {
  programs: number;
  evidence_rows: number;
  indicator_links: number;
  country_examples: number;
};

export type PolicyProgram = {
  id: string;
  program_key: string;
  program_name: string;
  sector_key: string | null;
  kind: string | null;

  short_intro: string | null;
  program_description: string | null;

  success_score: number | null;
  replicability_score: number | null;
  global_relevance_rank: number | null;
  typical_duration_years: number | null;

  tags: string[];
  is_featured: boolean;
  impact_type: string | null;

  gdp_impact_estimate: number | null;
  jobs_created_estimate: number | null;
  export_growth_pct: number | null;
  time_to_impact_years: number | null;
  implementation_complexity: string | null;
  success_case_country: string | null;
  failure_case_country: string | null;

  evidence_rows: number;
  indicator_links: number;
  country_examples: number;

  indicators: Array<Record<string, unknown>>;
  country_examples_rows: Array<Record<string, unknown>>;
  evidence_rows_detail: Array<Record<string, unknown>>;

  implementation_model: string | null;
  expected_outcomes: string | null;
  risks: string | null;
  evidence_summary: string | null;

  quantitative_outcomes: {
    jobs_created_estimate: number | null;
    export_growth_pct: number | null;
    gdp_impact_estimate: number | null;
    jobs_created_range: { min: number; max: number; avg: number } | null;
    export_growth_range: { min: number; max: number; avg: number } | null;
    gdp_growth_contribution_range: {
      min: number;
      max: number;
      avg: number;
    } | null;
  } | null;
};

export type PolicyStats = {
  programs: number;
  evidence_rows: number;
  indicator_links: number;
  country_examples: number;
};

export type SummaryResponse = {
  ok?: boolean;
  source?: string;
  programs?: PolicyProgram[];
  stats?: PolicyStats;
  error?: string;
};

export type FiltersResponse = {
  ok?: boolean;
  regions?: string[];
  countries?: Array<
    | {
        iso3: string;
        country: string;
        region: string;
      }
    | {
        country_code: string | null;
        country_name: string | null;
        region: string | null;
      }
  >;
  error?: string;
};

export type CifRow = Record<string, unknown>;

export type CifResponse = {
  ok?: boolean;
  country?: string;
  rows?: CifRow[];
  summary?: Record<string, unknown> | null;
  message?: string;
  error?: string;
};
