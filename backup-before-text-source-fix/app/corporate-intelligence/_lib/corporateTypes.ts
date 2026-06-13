export type CompanyFinancialSnapshot = {
  id: number;
  symbol: string;
  company_name: string | null;
  exchange: string | null;
  currency: string | null;
  country: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  ebitda: number | null;
  pe_ratio: number | null;
  peg_ratio: number | null;
  dividend_yield: number | null;
  eps: number | null;
  revenue_ttm: number | null;
  profit_margin: number | null;
  operating_margin_ttm: number | null;
  return_on_assets_ttm: number | null;
  return_on_equity_ttm: number | null;
  beta: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
  source: string | null;
  fetched_at: string | null;
};

export type CorporateSummary = {
  totalCompanies: number;
  sectors: number;
  totalMarketCap: number;
  totalRevenueTtm: number;
  avgPeRatio: number;
  topCompany: string | null;
  lastFetchedAt: string | null;
};
