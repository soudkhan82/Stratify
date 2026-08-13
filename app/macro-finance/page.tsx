"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Banknote,
  Building2,
  CircleDollarSign,
  Database,
  Download,
  Globe2,
  Landmark,
  RefreshCw,
  Scale,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ViewKey =
  | "overview"
  | "monetary"
  | "fiscal"
  | "debt"
  | "compare"
  | "explorer";

type CountryOption = {
  code: string;
  name: string;
  iso2?: string;
  region?: string;
  regionCode?: string;
  incomeLevel?: string;
  capitalCity?: string;
  type: "country" | "region";
};

type CountriesResp = {
  ok: boolean;
  regions: CountryOption[];
  countries: CountryOption[];
};

type IndicatorRow = {
  code: string;
  label: string;
  category: string;
  unit: string | null;
  latestYear: number | null;
  latestValue: number | null;
  countryIso3: string;
  countryName: string;
  source: string;
  sourceUrl?: string | null;
  availablePoints: number;
  firstAvailableYear: number | null;
  lastAvailableYear: number | null;
  series?: Array<{ year: number; value: number | null }>;
};

type MonetaryResp = {
  ok: boolean;
  error?: string;
  module: string;
  title: string;
  source_mode: string;
  primary_source: string;
  country: string;
  compact: boolean;
  coverage: {
    requested_indicators: number;
    available_latest_values: number;
    missing_latest_values: number;
  };
  kpis: Record<string, IndicatorRow | null>;
  groups: Record<string, IndicatorRow[]>;
  indicators: IndicatorRow[];
  generated_at: string;
};

type FiscalPoint = { year: number; value: number };
type FiscalRankRow = {
  country_code: string;
  country_name: string;
  region: string | null;
  year: number;
  value: number;
};

type FiscalResp = {
  ok: boolean;
  error?: string;
  meta: {
    slug: string;
    title: string;
    subtitle: string;
    unit: string;
    fmt: "pct" | "num";
  };
  vintage: string;
  rank_year: number;
  ranking: FiscalRankRow[];
  series: FiscalPoint[];
};

type DebtRankRow = {
  country_code: string;
  country_name: string;
  region: string | null;
  year: number;
  debt_gross_pct_gdp: number;
  risk_band: "Low" | "Moderate" | "High" | "Extreme";
  risk_score: number;
};

type DebtResp = {
  ok: boolean;
  error?: string;
  vintage: string;
  rank_year: number | null;
  totals: { countries: number };
  ranking: DebtRankRow[];
  series: {
    country: {
      country_code: string;
      country_name: string;
      region: string | null;
    } | null;
    min_year: number;
    max_year: number;
    points: Array<{ year: number; value: number }>;
  };
};

type MacroBundle = {
  monetary: MonetaryResp | null;
  primary: FiscalResp | null;
  overall: FiscalResp | null;
  revenue: FiscalResp | null;
  expenditure: FiscalResp | null;
  debt: DebtResp | null;
};

type SeriesPoint = { year: number; value: number | null };

type ExplorerMetric = {
  key: string;
  label: string;
  unit: string;
  domain: "Monetary" | "Fiscal" | "Debt";
  description: string;
  series: SeriesPoint[];
};

const FALLBACK_REGIONS: CountryOption[] = [
  { code: "WLD", name: "World", type: "region" },
  { code: "SSF", name: "Sub-Saharan Africa", type: "region" },
  { code: "ECS", name: "Europe & Central Asia", type: "region" },
  { code: "MEA", name: "Middle East & North Africa", type: "region" },
  { code: "SAS", name: "South Asia", type: "region" },
  { code: "EAS", name: "East Asia & Pacific", type: "region" },
  { code: "LCN", name: "Latin America & Caribbean", type: "region" },
  { code: "NAC", name: "North America", type: "region" },
];

const FALLBACK_COUNTRIES: CountryOption[] = [
  { code: "PAK", name: "Pakistan", regionCode: "SAS", region: "South Asia", type: "country" },
  { code: "IND", name: "India", regionCode: "SAS", region: "South Asia", type: "country" },
  { code: "BGD", name: "Bangladesh", regionCode: "SAS", region: "South Asia", type: "country" },
  { code: "LKA", name: "Sri Lanka", regionCode: "SAS", region: "South Asia", type: "country" },
  { code: "CHN", name: "China", regionCode: "EAS", region: "East Asia & Pacific", type: "country" },
  { code: "USA", name: "United States", regionCode: "NAC", region: "North America", type: "country" },
  { code: "GBR", name: "United Kingdom", regionCode: "ECS", region: "Europe & Central Asia", type: "country" },
];

const EMPTY_BUNDLE: MacroBundle = {
  monetary: null,
  primary: null,
  overall: null,
  revenue: null,
  expenditure: null,
  debt: null,
};

const YEARS = Array.from({ length: 51 }, (_, index) => 2030 - index);

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "monetary", label: "Monetary" },
  { key: "fiscal", label: "Fiscal" },
  { key: "debt", label: "Public Debt" },
  { key: "compare", label: "Compare" },
  { key: "explorer", label: "Data Explorer" },
];

const MONETARY_CODES = {
  moneySupply: "FM.LBL.BMNY.GD.ZS",
  moneyGrowth: "FM.LBL.BMNY.ZG",
  lendingRate: "FR.INR.LEND",
  depositRate: "FR.INR.DPST",
  realRate: "FR.INR.RINR",
  exchangeRate: "PA.NUS.FCRF",
  reserves: "FI.RES.TOTL.CD",
  npl: "FB.AST.NPER.ZS",
  marketCap: "CM.MKT.LCAP.GD.ZS",
} as const;

const MONETARY_DESCRIPTIONS: Record<string, string> = {
  "FM.LBL.BMNY.GD.ZS": "Money circulating in the economy, including cash and bank deposits, shown relative to the size of the economy.",
  "FM.LBL.BMNY.ZG": "Year-on-year change in broad money. Faster growth means more liquidity and can also add inflation pressure.",
  "FS.AST.PRVT.GD.ZS": "Credit provided by banks to the private sector, measured relative to GDP. It shows how strongly banking finance supports businesses and households.",
  "FR.INR.LEND": "Average rate banks charge borrowers. Higher lending rates usually mean more expensive business and consumer financing.",
  "FR.INR.DPST": "Average rate paid by banks on deposits. It reflects what savers earn by keeping money in banks.",
  "FR.INR.RINR": "Interest rate after adjusting for inflation. Positive real rates generally mean savings keep purchasing power better than inflation erodes it.",
  "PA.NUS.FCRF": "Local-currency units needed to buy one US dollar. A higher value generally indicates a weaker local currency.",
  "FI.RES.TOTL.CD": "Foreign reserve assets held by the central bank, including gold, used to support imports, debt payments and currency stability.",
  "FI.RES.XGLD.CD": "Foreign reserve assets excluding gold. Useful when you want to focus on liquid external buffers apart from gold holdings.",
  "FB.AST.NPER.ZS": "Share of bank loans that are not being repaid on time. Higher values suggest rising stress in the banking system.",
  "CM.MKT.LCAP.GD.ZS": "Market value of listed domestic companies as a share of GDP. It indicates the relative size of the stock market in the economy.",
  "CM.MKT.TRAD.GD.ZS": "Total value of shares traded during the year relative to GDP. It signals how active the equity market is.",
  "CM.MKT.TRNR": "Trading activity compared with average market capitalization. Higher turnover usually means stronger liquidity in the stock market.",
};

function monetaryDefinition(code?: string, label?: string) {
  if (code && MONETARY_DESCRIPTIONS[code]) return MONETARY_DESCRIPTIONS[code];
  return label
    ? `${label} is one of the monetary or financial indicators used to understand liquidity, banking conditions, market depth or external stability.`
    : "This indicator helps explain monetary conditions, banking health, or external sector strength for the selected country.";
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compactNumber(value: number | null, digits = 1) {
  if (value === null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(digits)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(digits)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function metricValue(value: number | null, unit: string) {
  if (value === null) return "—";
  if (unit === "US$") return `$${compactNumber(value, 2)}`;
  if (unit.includes("%")) return `${value.toFixed(1)}%`;
  if (unit === "LCU per US$") return compactNumber(value, 2);
  return compactNumber(value, 2);
}

function normalizedSeries(series?: Array<{ year: number; value: number | null }>): SeriesPoint[] {
  return (series ?? [])
    .map((point) => ({ year: Number(point.year), value: asNumber(point.value) }))
    .filter((point) => Number.isFinite(point.year))
    .sort((a, b) => a.year - b.year);
}

function exactOrPriorPoint(series: SeriesPoint[], requestedYear: number) {
  const valid = series.filter((point) => point.value !== null);
  if (!valid.length) return { year: null as number | null, value: null as number | null };

  const exact = valid.find((point) => point.year === requestedYear);
  if (exact) return exact;

  const prior = [...valid].reverse().find((point) => point.year <= requestedYear);
  return prior ?? valid[valid.length - 1];
}

function indicator(bundle: MacroBundle, code: string) {
  return bundle.monetary?.indicators?.find((row) => row.code === code) ?? null;
}

function monetaryMetric(bundle: MacroBundle, code: string, year: number) {
  const row = indicator(bundle, code);
  if (!row) return { value: null as number | null, year: null as number | null, unit: "", label: code };
  const point = exactOrPriorPoint(normalizedSeries(row.series), year);
  if (point.value !== null) return { ...point, unit: row.unit ?? "", label: row.label };
  return {
    value: asNumber(row.latestValue),
    year: row.latestYear,
    unit: row.unit ?? "",
    label: row.label,
  };
}

function fiscalMetric(response: FiscalResp | null, year: number) {
  const series = (response?.series ?? [])
    .map((point) => ({ year: Number(point.year), value: asNumber(point.value) }))
    .sort((a, b) => a.year - b.year);
  return exactOrPriorPoint(series, year);
}

function debtMetric(response: DebtResp | null, year: number) {
  const series = (response?.series?.points ?? [])
    .map((point) => ({ year: Number(point.year), value: asNumber(point.value) }))
    .sort((a, b) => a.year - b.year);
  return exactOrPriorPoint(series, year);
}

function seriesMap(series: SeriesPoint[]) {
  return new Map(series.filter((p) => p.value !== null).map((p) => [p.year, p.value as number]));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON returned by ${url}`);
  }
}

async function loadBundle(iso3: string): Promise<MacroBundle> {
  const encoded = encodeURIComponent(iso3);
  const fiscalParams = `country=${encoded}&top=10&from=1980&to=2030`;

  const results = await Promise.allSettled([
    fetchJson<MonetaryResp>(`/api/monetary/overview?country=${encoded}&series=1`),
    fetchJson<FiscalResp>(`/api/fiscal/primary-balance?${fiscalParams}`),
    fetchJson<FiscalResp>(`/api/fiscal/overall-balance?${fiscalParams}`),
    fetchJson<FiscalResp>(`/api/fiscal/revenue?${fiscalParams}`),
    fetchJson<FiscalResp>(`/api/fiscal/expenditure?${fiscalParams}`),
    fetchJson<DebtResp>(`/api/debt?iso3=${encoded}&top=250&from=1980&to=2030`),
  ]);

  const pick = <T,>(index: number): T | null => {
    const result = results[index];
    if (result.status !== "fulfilled") return null;
    const payload = result.value as { ok?: boolean };
    return payload?.ok === false ? null : (result.value as T);
  };

  return {
    monetary: pick<MonetaryResp>(0),
    primary: pick<FiscalResp>(1),
    overall: pick<FiscalResp>(2),
    revenue: pick<FiscalResp>(3),
    expenditure: pick<FiscalResp>(4),
    debt: pick<DebtResp>(5),
  };
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  label,
  value,
  meta,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: string;
  meta: string;
  icon: React.ReactNode;
  tone?: "indigo" | "emerald" | "amber" | "sky" | "rose" | "slate";
}) {
  const toneClasses = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  }[tone];

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
          <div className="mt-2 truncate text-[26px] font-black tracking-tight text-slate-950">{value}</div>
          <div className="mt-1 text-xs font-medium text-slate-500">{meta}</div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneClasses}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black tracking-tight text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function DomainButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function DataRow({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-700">{label}</div>
        {meta ? <div className="mt-0.5 text-[11px] text-slate-400">{meta}</div> : null}
      </div>
      <div className="shrink-0 text-sm font-black tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-2 text-xs font-black text-slate-950">Year {label}</div>
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-slate-500">{item.name}</span>
            <span className="font-black tabular-nums text-slate-900">
              {Number.isFinite(Number(item.value)) ? Number(item.value).toFixed(1) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </div>
  );
}

function riskClasses(risk?: DebtRankRow["risk_band"]) {
  if (risk === "Low") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (risk === "Moderate") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (risk === "High") return "bg-orange-50 text-orange-700 ring-orange-200";
  if (risk === "Extreme") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

export default function MacroFinancePage() {
  const [view, setView] = useState<ViewKey>("overview");
  const [region, setRegion] = useState("WLD");
  const [country, setCountry] = useState("PAK");
  const [compareCountry, setCompareCountry] = useState("IND");
  const [year, setYear] = useState(2024);
  const [regions, setRegions] = useState<CountryOption[]>(FALLBACK_REGIONS);
  const [countries, setCountries] = useState<CountryOption[]>(FALLBACK_COUNTRIES);
  const [bundle, setBundle] = useState<MacroBundle>(EMPTY_BUNDLE);
  const [compareBundle, setCompareBundle] = useState<MacroBundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedMonetaryCode, setSelectedMonetaryCode] = useState<string>(MONETARY_CODES.moneySupply);
  const [explorerKey, setExplorerKey] = useState("money-supply");

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("view") as ViewKey | null;
    if (raw && VIEWS.some((item) => item.key === raw)) setView(raw);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchJson<CountriesResp>("/api/monetary/countries")
      .then((response) => {
        if (!alive || !response.ok) return;
        if (Array.isArray(response.regions) && response.regions.length) setRegions(response.regions);
        if (Array.isArray(response.countries) && response.countries.length) setCountries(response.countries);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadBundle(country)
      .then((next) => {
        if (!alive) return;
        setBundle(next);
        const loadedCount = Object.values(next).filter(Boolean).length;
        if (loadedCount === 0) setError("Macro & Finance data could not be loaded from the existing APIs.");
      })
      .catch((err) => {
        if (!alive) return;
        setBundle(EMPTY_BUNDLE);
        setError(err instanceof Error ? err.message : "Unable to load Macro & Finance data.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [country, refreshTick]);

  useEffect(() => {
    if (view !== "compare" || !compareCountry || compareCountry === country) return;
    let alive = true;
    setCompareLoading(true);
    loadBundle(compareCountry)
      .then((next) => {
        if (alive) setCompareBundle(next);
      })
      .catch(() => {
        if (alive) setCompareBundle(EMPTY_BUNDLE);
      })
      .finally(() => {
        if (alive) setCompareLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [view, compareCountry, country, refreshTick]);

  const filteredCountries = useMemo(() => {
    if (region === "WLD") return countries;
    return countries.filter((item) => item.regionCode === region);
  }, [countries, region]);

  useEffect(() => {
    if (!filteredCountries.some((item) => item.code === country) && filteredCountries[0]?.code) {
      setCountry(filteredCountries[0].code);
    }
  }, [filteredCountries, country]);

  useEffect(() => {
    if (compareCountry === country) {
      const alternative = countries.find((item) => item.code !== country);
      if (alternative) setCompareCountry(alternative.code);
    }
  }, [country, compareCountry, countries]);

  const countryMeta = countries.find((item) => item.code === country);
  const compareMeta = countries.find((item) => item.code === compareCountry);
  const countryName = countryMeta?.name || bundle.monetary?.indicators?.[0]?.countryName || country;
  const compareName = compareMeta?.name || compareCountry;

  const moneySupply = monetaryMetric(bundle, MONETARY_CODES.moneySupply, year);
  const moneyGrowth = monetaryMetric(bundle, MONETARY_CODES.moneyGrowth, year);
  const lendingRate = monetaryMetric(bundle, MONETARY_CODES.lendingRate, year);
  const exchangeRate = monetaryMetric(bundle, MONETARY_CODES.exchangeRate, year);
  const reserves = monetaryMetric(bundle, MONETARY_CODES.reserves, year);
  const npl = monetaryMetric(bundle, MONETARY_CODES.npl, year);
  const marketCap = monetaryMetric(bundle, MONETARY_CODES.marketCap, year);
  const revenue = fiscalMetric(bundle.revenue, year);
  const expenditure = fiscalMetric(bundle.expenditure, year);
  const primary = fiscalMetric(bundle.primary, year);
  const overall = fiscalMetric(bundle.overall, year);
  const debt = debtMetric(bundle.debt, year);

  const debtRank = bundle.debt?.ranking?.find((row) => row.country_code === country) ?? null;
  const debtRankIndex = debtRank
    ? (bundle.debt?.ranking ?? []).findIndex((row) => row.country_code === country) + 1
    : null;

  const pulseData = useMemo(() => {
    const money = seriesMap(normalizedSeries(indicator(bundle, MONETARY_CODES.moneySupply)?.series));
    const rev = seriesMap((bundle.revenue?.series ?? []).map((p) => ({ year: p.year, value: asNumber(p.value) })));
    const exp = seriesMap((bundle.expenditure?.series ?? []).map((p) => ({ year: p.year, value: asNumber(p.value) })));
    const dbt = seriesMap((bundle.debt?.series?.points ?? []).map((p) => ({ year: p.year, value: asNumber(p.value) })));
    const years = Array.from(new Set([...money.keys(), ...rev.keys(), ...exp.keys(), ...dbt.keys()]))
      .filter((item) => item >= 2000 && item <= 2030)
      .sort((a, b) => a - b);
    return years.map((item) => ({
      year: item,
      money: money.get(item) ?? null,
      revenue: rev.get(item) ?? null,
      expenditure: exp.get(item) ?? null,
      debt: dbt.get(item) ?? null,
    }));
  }, [bundle]);

  const fiscalTrend = useMemo(() => {
    const rev = seriesMap((bundle.revenue?.series ?? []).map((p) => ({ year: p.year, value: asNumber(p.value) })));
    const exp = seriesMap((bundle.expenditure?.series ?? []).map((p) => ({ year: p.year, value: asNumber(p.value) })));
    const overallMap = seriesMap((bundle.overall?.series ?? []).map((p) => ({ year: p.year, value: asNumber(p.value) })));
    const primaryMap = seriesMap((bundle.primary?.series ?? []).map((p) => ({ year: p.year, value: asNumber(p.value) })));
    const years = Array.from(new Set([...rev.keys(), ...exp.keys(), ...overallMap.keys(), ...primaryMap.keys()]))
      .filter((item) => item >= 2000 && item <= 2030)
      .sort((a, b) => a - b);
    return years.map((item) => ({
      year: item,
      revenue: rev.get(item) ?? null,
      expenditure: exp.get(item) ?? null,
      overall: overallMap.get(item) ?? null,
      primary: primaryMap.get(item) ?? null,
    }));
  }, [bundle]);

  const explorerMetrics = useMemo<ExplorerMetric[]>(() => {
    const monetarySeries = (code: string) => normalizedSeries(indicator(bundle, code)?.series);
    const fiscalSeries = (response: FiscalResp | null): SeriesPoint[] =>
      (response?.series ?? []).map((point) => ({ year: point.year, value: asNumber(point.value) })).sort((a, b) => a.year - b.year);
    const debtSeries: SeriesPoint[] = (bundle.debt?.series?.points ?? [])
      .map((point) => ({ year: point.year, value: asNumber(point.value) }))
      .sort((a, b) => a.year - b.year);

    return [
      {
        key: "money-supply",
        label: "Broad money",
        unit: "% of GDP",
        domain: "Monetary",
        description: "Money circulating in the economy, including cash and bank deposits, shown relative to the size of the economy.",
        series: monetarySeries(MONETARY_CODES.moneySupply),
      },
      {
        key: "money-growth",
        label: "Broad money growth",
        unit: "annual %",
        domain: "Monetary",
        description: "Year-on-year change in broad money. Faster growth means more liquidity and can also add inflation pressure.",
        series: monetarySeries(MONETARY_CODES.moneyGrowth),
      },
      {
        key: "lending-rate",
        label: "Lending interest rate",
        unit: "%",
        domain: "Monetary",
        description: "The interest rate banks charge borrowers, giving a practical view of financing and credit costs in the economy.",
        series: monetarySeries(MONETARY_CODES.lendingRate),
      },
      {
        key: "exchange-rate",
        label: "Official exchange rate",
        unit: "LCU per US$",
        domain: "Monetary",
        description: "Local-currency units needed to buy one US dollar. A higher value normally indicates a weaker local currency.",
        series: monetarySeries(MONETARY_CODES.exchangeRate),
      },
      {
        key: "reserves",
        label: "Total reserves",
        unit: "US$",
        domain: "Monetary",
        description: "Foreign-currency reserve assets held by the central bank and monetary authorities to support external payments and stability.",
        series: monetarySeries(MONETARY_CODES.reserves),
      },
      {
        key: "revenue",
        label: "Government revenue",
        unit: "% of GDP",
        domain: "Fiscal",
        description: "Government income from taxes and other receipts before borrowing, expressed as a share of GDP.",
        series: fiscalSeries(bundle.revenue),
      },
      {
        key: "expenditure",
        label: "Government expenditure",
        unit: "% of GDP",
        domain: "Fiscal",
        description: "Total government spending on services, transfers, investment and other outlays, expressed as a share of GDP.",
        series: fiscalSeries(bundle.expenditure),
      },
      {
        key: "primary",
        label: "Primary balance",
        unit: "% of GDP",
        domain: "Fiscal",
        description: "Government revenue minus non-interest spending. It shows the fiscal position before the cost of servicing existing debt.",
        series: fiscalSeries(bundle.primary),
      },
      {
        key: "overall",
        label: "Overall balance (proxy)",
        unit: "% of GDP",
        domain: "Fiscal",
        description: "Government revenue minus total expenditure, including interest costs. Negative values indicate a fiscal deficit.",
        series: fiscalSeries(bundle.overall),
      },
      {
        key: "debt",
        label: "General government gross debt",
        unit: "% of GDP",
        domain: "Debt",
        description: "Outstanding general-government liabilities before deducting financial assets, measured relative to GDP.",
        series: debtSeries,
      },
    ];
  }, [bundle]);

  const selectedExplorer = explorerMetrics.find((item) => item.key === explorerKey) ?? explorerMetrics[0];
  const selectedMonetary = indicator(bundle, selectedMonetaryCode) ?? bundle.monetary?.indicators?.[0] ?? null;
  const selectedMonetarySeries = normalizedSeries(selectedMonetary?.series);

  const setActiveView = (next: ViewKey) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const compareRows = useMemo(() => {
    if (compareCountry === country) return [];
    const build = (source: MacroBundle) => [
      monetaryMetric(source, MONETARY_CODES.moneySupply, year).value,
      fiscalMetric(source.revenue, year).value,
      fiscalMetric(source.expenditure, year).value,
      fiscalMetric(source.primary, year).value,
      debtMetric(source.debt, year).value,
    ];
    const left = build(bundle);
    const right = build(compareBundle);
    const labels = ["Broad money", "Revenue", "Expenditure", "Primary balance", "Debt"];
    return labels.map((label, index) => ({
      metric: label,
      left: left[index],
      right: right[index],
    }));
  }, [bundle, compareBundle, compareCountry, country, countryName, compareName, year]);

  const dataAvailability = Object.values(bundle).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      {loading ? (
        <div className="fixed inset-x-0 top-[72px] z-40 h-0.5 overflow-hidden bg-slate-100">
          <div className="h-full w-1/2 animate-pulse bg-indigo-600" />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 lg:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <span>Economic Intelligence</span>
                <span className="text-slate-300">/</span>
                <span className="text-indigo-600">Macro & Finance</span>
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-[34px]">
                Macro & Finance
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                Monetary conditions, government finances and sovereign debt in one connected country view.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[690px]">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Region</span>
                <select
                  value={region}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setRegion(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                >
                  {regions.map((item) => (
                    <option key={item.code} value={item.code}>{item.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Country</span>
                <select
                  value={country}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setCountry(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                >
                  {filteredCountries.map((item) => (
                    <option key={item.code} value={item.code}>{item.name}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-[1fr_44px] gap-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Reference year</span>
                  <select
                    value={year}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setYear(Number(event.target.value))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  >
                    {YEARS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setRefreshTick((value) => value + 1)}
                  className="mt-[22px] flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                  title="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto border-t border-slate-100 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {VIEWS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveView(item.key)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition sm:text-[13px] ${
                  view === item.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        ) : null}

        {view === "overview" ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Broad money"
                value={metricValue(moneySupply.value, "% of GDP")}
                meta={`${moneySupply.year ?? "No year"} · Monetary`}
                icon={<WalletCards className="h-5 w-5" />}
                tone="indigo"
              />
              <MetricCard
                label="Lending rate"
                value={metricValue(lendingRate.value, "%")}
                meta={`${lendingRate.year ?? "No year"} · Monetary`}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="sky"
              />
              <MetricCard
                label="Government revenue"
                value={metricValue(revenue.value, "% of GDP")}
                meta={`${revenue.year ?? "No year"} · Fiscal`}
                icon={<CircleDollarSign className="h-5 w-5" />}
                tone="emerald"
              />
              <MetricCard
                label="Government expenditure"
                value={metricValue(expenditure.value, "% of GDP")}
                meta={`${expenditure.year ?? "No year"} · Fiscal`}
                icon={<Banknote className="h-5 w-5" />}
                tone="amber"
              />
              <MetricCard
                label="Primary balance"
                value={metricValue(primary.value, "% of GDP")}
                meta={`${primary.year ?? "No year"} · Fiscal`}
                icon={<Scale className="h-5 w-5" />}
                tone={primary.value !== null && primary.value < 0 ? "rose" : "emerald"}
              />
              <MetricCard
                label="Public debt"
                value={metricValue(debt.value, "% of GDP")}
                meta={`${debt.year ?? "No year"} · Sovereign`}
                icon={<Landmark className="h-5 w-5" />}
                tone="rose"
              />
              <MetricCard
                label="FX rate"
                value={metricValue(exchangeRate.value, "LCU per US$")}
                meta={`${exchangeRate.year ?? "No year"} · LCU per US$`}
                icon={<Globe2 className="h-5 w-5" />}
                tone="slate"
              />
              <MetricCard
                label="Foreign reserves"
                value={metricValue(reserves.value, "US$")}
                meta={`${reserves.year ?? "No year"} · Monetary buffer`}
                icon={<Database className="h-5 w-5" />}
                tone="sky"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.8fr)]">
              <Panel
                title="Economic Pulse"
                subtitle="Broad money, revenue, expenditure and public debt · % of GDP"
                action={<span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">2000–2030</span>}
              >
                <div className="h-[350px] px-2 pb-3 pt-4 sm:px-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pulseData} margin={{ top: 8, right: 18, bottom: 4, left: 2 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Line connectNulls type="monotone" dataKey="money" name="Broad money" stroke="#4f46e5" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line connectNulls type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line connectNulls type="monotone" dataKey="expenditure" name="Expenditure" stroke="#d97706" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line connectNulls type="monotone" dataKey="debt" name="Debt" stroke="#e11d48" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title="Fiscal → Debt relationship" subtitle={`Simplified transmission view · ${countryName}`}>
                <div className="p-5">
                  <div className="space-y-3">
                    {[
                      { label: "Government revenue", value: metricValue(revenue.value, "%"), tone: "border-emerald-200 bg-emerald-50", text: "text-emerald-800" },
                      { label: "Government expenditure", value: metricValue(expenditure.value, "%"), tone: "border-amber-200 bg-amber-50", text: "text-amber-800" },
                      { label: "Primary balance", value: metricValue(primary.value, "%"), tone: "border-slate-200 bg-slate-50", text: "text-slate-800" },
                      { label: "Public debt", value: metricValue(debt.value, "%"), tone: "border-rose-200 bg-rose-50", text: "text-rose-800" },
                    ].map((item, index, array) => (
                      <React.Fragment key={item.label}>
                        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${item.tone}`}>
                          <span className={`text-xs font-bold ${item.text}`}>{item.label}</span>
                          <span className={`text-base font-black tabular-nums ${item.text}`}>{item.value}</span>
                        </div>
                        {index < array.length - 1 ? (
                          <div className="flex justify-center text-slate-300"><ArrowDownRight className="h-4 w-4" /></div>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] font-medium leading-5 text-slate-400">
                    Values are shown as % of GDP where available. The flow is an analytical relationship, not an accounting identity.
                  </p>
                </div>
              </Panel>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <Panel
                title="Monetary conditions"
                subtitle="Liquidity, rates, currency and reserves"
                action={<DomainButton label="Open monetary" onClick={() => setActiveView("monetary")} />}
              >
                <div className="px-5 py-2">
                  <DataRow label="Money growth" value={metricValue(moneyGrowth.value, "%")} meta={`Year ${moneyGrowth.year ?? "—"}`} />
                  <DataRow label="Lending rate" value={metricValue(lendingRate.value, "%")} meta={`Year ${lendingRate.year ?? "—"}`} />
                  <DataRow label="Official FX rate" value={metricValue(exchangeRate.value, "LCU per US$")} meta="LCU per US$" />
                  <DataRow label="Total reserves" value={metricValue(reserves.value, "US$")} meta={`Year ${reserves.year ?? "—"}`} />
                </div>
              </Panel>

              <Panel
                title="Government finances"
                subtitle="Revenue, spending and fiscal balances"
                action={<DomainButton label="Open fiscal" onClick={() => setActiveView("fiscal")} />}
              >
                <div className="px-5 py-2">
                  <DataRow label="Revenue" value={metricValue(revenue.value, "%")} meta="% of GDP" />
                  <DataRow label="Expenditure" value={metricValue(expenditure.value, "%")} meta="% of GDP" />
                  <DataRow label="Primary balance" value={metricValue(primary.value, "%")} meta="% of GDP" />
                  <DataRow label="Overall balance (proxy)" value={metricValue(overall.value, "%")} meta="% of GDP" />
                </div>
              </Panel>

              <Panel
                title="Sovereign debt"
                subtitle="Debt trajectory and relative risk"
                action={<DomainButton label="Open debt" onClick={() => setActiveView("debt")} />}
              >
                <div className="px-5 py-2">
                  <DataRow label="Gross public debt" value={metricValue(debt.value, "%")} meta="% of GDP" />
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3">
                    <span className="text-sm font-semibold text-slate-700">Risk band</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${riskClasses(debtRank?.risk_band)}`}>
                      {debtRank?.risk_band ?? "Not ranked"}
                    </span>
                  </div>
                  <DataRow label="Global ranking" value={debtRankIndex ? `#${debtRankIndex}` : "—"} meta={bundle.debt?.rank_year ? `Ranking year ${bundle.debt.rank_year}` : undefined} />
                  <DataRow label="Countries ranked" value={String(bundle.debt?.totals?.countries ?? "—")} />
                </div>
              </Panel>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <MiniStatus label="Monetary / World Bank" ok={Boolean(bundle.monetary)} />
                <MiniStatus label="Fiscal / IMF WEO" ok={Boolean(bundle.revenue && bundle.expenditure)} />
                <MiniStatus label="Debt / IMF WEO" ok={Boolean(bundle.debt)} />
              </div>
              <div className="text-[11px] font-semibold text-slate-400">{dataAvailability}/6 data feeds loaded</div>
            </div>
          </div>
        ) : null}

        {view === "monetary" ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Broad money" value={metricValue(moneySupply.value, "% of GDP")} meta={`${moneySupply.year ?? "—"} · % of GDP`} icon={<WalletCards className="h-5 w-5" />} tone="indigo" />
              <MetricCard label="Money growth" value={metricValue(moneyGrowth.value, "%")} meta={`${moneyGrowth.year ?? "—"} · annual`} icon={<TrendingUp className="h-5 w-5" />} tone="sky" />
              <MetricCard label="Lending rate" value={metricValue(lendingRate.value, "%")} meta={`${lendingRate.year ?? "—"} · annual`} icon={<Landmark className="h-5 w-5" />} tone="amber" />
              <MetricCard label="Exchange rate" value={metricValue(exchangeRate.value, "LCU per US$")} meta={`${exchangeRate.year ?? "—"} · LCU per US$`} icon={<Globe2 className="h-5 w-5" />} tone="slate" />
              <MetricCard label="Total reserves" value={metricValue(reserves.value, "US$")} meta={`${reserves.year ?? "—"} · current US$`} icon={<Database className="h-5 w-5" />} tone="emerald" />
              <MetricCard label="NPL ratio" value={metricValue(npl.value, "%")} meta={`${npl.year ?? "—"} · loans`} icon={<Activity className="h-5 w-5" />} tone="rose" />
              <MetricCard label="Market cap / GDP" value={metricValue(marketCap.value, "%")} meta={`${marketCap.year ?? "—"} · equity market`} icon={<Building2 className="h-5 w-5" />} tone="sky" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.38fr)_minmax(360px,0.95fr)]">
              <Panel
                title={selectedMonetary?.label ?? "Monetary trend"}
                subtitle={`${selectedMonetary?.unit ?? ""} · ${countryName}`}
                action={
                  <select
                    value={selectedMonetaryCode}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonetaryCode(event.target.value)}
                    className="h-9 max-w-[280px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-300"
                  >
                    {(bundle.monetary?.indicators ?? []).map((item) => (
                      <option key={item.code} value={item.code}>{item.label}</option>
                    ))}
                  </select>
                }
              >
                <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[11px] font-black text-indigo-700 ring-1 ring-indigo-100">i</div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">What it means</div>
                      <p className="mt-0.5 text-xs font-medium leading-5 text-slate-600">
                        {monetaryDefinition(selectedMonetary?.code, selectedMonetary?.label)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-[390px] px-2 pb-3 pt-4 sm:px-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedMonetarySeries} margin={{ top: 8, right: 18, bottom: 4, left: 8 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={58} tickFormatter={(value: any) => compactNumber(Number(value), 1)} />
                      <Tooltip formatter={(value: any) => [compactNumber(Number(value), 2), selectedMonetary?.unit ?? ""]} labelFormatter={(label: any) => `Year ${label}`} />
                      <Line connectNulls type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.75} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title="Historical records"
                subtitle={`${selectedMonetary?.label ?? "Monetary indicator"} · ${selectedMonetary?.unit ?? ""}`}
              >
                <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Latest value</div>
                      <div className="mt-1 text-lg font-black text-slate-950">{metricValue(asNumber(selectedMonetary?.latestValue), selectedMonetary?.unit ?? "")}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Latest year</div>
                      <div className="mt-1 text-lg font-black text-slate-950">{selectedMonetary?.latestYear ?? "—"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Data points</div>
                      <div className="mt-1 text-lg font-black text-slate-950">{selectedMonetary?.availablePoints ?? selectedMonetarySeries.length}</div>
                    </div>
                  </div>
                </div>
                <div className="max-h-[450px] overflow-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">Year</th>
                        <th className="px-4 py-3 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedMonetarySeries.length ? (
                        [...selectedMonetarySeries].reverse().map((point) => (
                          <tr key={point.year} className="transition hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-xs font-bold text-slate-600">{point.year}</td>
                            <td className="px-4 py-2.5 text-right text-sm font-black tabular-nums text-slate-950">
                              {metricValue(point.value, selectedMonetary?.unit ?? "")}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
                            No historical records available for this indicator.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <Panel title="Monetary indicator glossary" subtitle="Plain-English guide for the indicators available in this country view">
              <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
                {(bundle.monetary?.indicators ?? []).map((row) => (
                  <button
                    key={row.code}
                    type="button"
                    onClick={() => setSelectedMonetaryCode(row.code)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedMonetaryCode === row.code
                        ? "border-indigo-200 bg-indigo-50/70 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-black leading-5 text-slate-950">{row.label}</div>
                        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                          {row.category} · {row.unit ?? "No unit"}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                        {row.latestYear ?? "—"}
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                      {monetaryDefinition(row.code, row.label)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-400">Latest value</span>
                      <span className="font-black text-slate-900">{metricValue(asNumber(row.latestValue), row.unit ?? "")}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}

        {view === "fiscal" ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Revenue" value={metricValue(revenue.value, "%")} meta={`${revenue.year ?? "—"} · % of GDP`} icon={<CircleDollarSign className="h-5 w-5" />} tone="emerald" />
              <MetricCard label="Expenditure" value={metricValue(expenditure.value, "%")} meta={`${expenditure.year ?? "—"} · % of GDP`} icon={<Banknote className="h-5 w-5" />} tone="amber" />
              <MetricCard label="Primary balance" value={metricValue(primary.value, "%")} meta={`${primary.year ?? "—"} · % of GDP`} icon={<Scale className="h-5 w-5" />} tone={primary.value !== null && primary.value < 0 ? "rose" : "emerald"} />
              <MetricCard label="Overall balance (proxy)" value={metricValue(overall.value, "%")} meta={`${overall.year ?? "—"} · % of GDP`} icon={<Activity className="h-5 w-5" />} tone={overall.value !== null && overall.value < 0 ? "rose" : "emerald"} />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title="Revenue vs expenditure" subtitle="General government · % of GDP">
                <div className="h-[380px] px-2 pb-3 pt-4 sm:px-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fiscalTrend} margin={{ top: 8, right: 18, bottom: 4, left: 2 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={25} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Line connectNulls type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2.75} dot={false} />
                      <Line connectNulls type="monotone" dataKey="expenditure" name="Expenditure" stroke="#d97706" strokeWidth={2.75} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title="Fiscal balances" subtitle="Primary and overall / structural proxy · % of GDP">
                <div className="h-[380px] px-2 pb-3 pt-4 sm:px-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fiscalTrend} margin={{ top: 8, right: 18, bottom: 4, left: 2 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={25} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Line connectNulls type="monotone" dataKey="primary" name="Primary balance" stroke="#4f46e5" strokeWidth={2.75} dot={false} />
                      <Line connectNulls type="monotone" dataKey="overall" name="Overall balance" stroke="#e11d48" strokeWidth={2.75} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <Panel title="Fiscal snapshot" subtitle={`${countryName} · selected reference year with nearest prior observation when necessary`}>
              <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Revenue", point: revenue, unit: "% of GDP" },
                  { label: "Expenditure", point: expenditure, unit: "% of GDP" },
                  { label: "Primary balance", point: primary, unit: "% of GDP" },
                  { label: "Overall balance (proxy)", point: overall, unit: "% of GDP" },
                ].map((item) => (
                  <div key={item.label} className="border-b border-slate-100 p-5 md:border-r xl:border-b-0 last:border-r-0">
                    <div className="text-xs font-bold text-slate-500">{item.label}</div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{metricValue(item.point.value, "%")}</div>
                    <div className="mt-1 text-[11px] font-medium text-slate-400">{item.point.year ?? "No observation"} · {item.unit}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}

        {view === "debt" ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Gross public debt" value={metricValue(debt.value, "%")} meta={`${debt.year ?? "—"} · % of GDP`} icon={<Landmark className="h-5 w-5" />} tone="rose" />
              <MetricCard label="Risk band" value={debtRank?.risk_band ?? "—"} meta={debtRank ? `Risk score ${debtRank.risk_score}` : "Not available in current ranking"} icon={<Activity className="h-5 w-5" />} tone={debtRank?.risk_band === "Extreme" || debtRank?.risk_band === "High" ? "rose" : "amber"} />
              <MetricCard label="Global rank" value={debtRankIndex ? `#${debtRankIndex}` : "—"} meta={bundle.debt?.rank_year ? `Ranking year ${bundle.debt.rank_year}` : "No ranking year"} icon={<TrendingUp className="h-5 w-5" />} tone="slate" />
              <MetricCard label="Coverage" value={String(bundle.debt?.totals?.countries ?? "—")} meta="Countries in debt ranking" icon={<Globe2 className="h-5 w-5" />} tone="sky" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
              <Panel title="Debt trajectory" subtitle="General government gross debt · % of GDP">
                <div className="h-[410px] px-2 pb-3 pt-4 sm:px-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bundle.debt?.series?.points ?? []} margin={{ top: 8, right: 18, bottom: 4, left: 6 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "% of GDP"]} labelFormatter={(label: any) => `Year ${label}`} />
                      <Line connectNulls type="monotone" dataKey="value" stroke="#e11d48" strokeWidth={2.8} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title="Debt position" subtitle="Selected country in the current global debt distribution">
                <div className="p-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{countryName}</div>
                        <div className="mt-1 text-3xl font-black tracking-tight text-slate-950">{metricValue(debt.value, "%")}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">Gross debt / GDP</div>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${riskClasses(debtRank?.risk_band)}`}>
                        {debtRank?.risk_band ?? "Unranked"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 px-1">
                    <DataRow label="Ranking year" value={String(bundle.debt?.rank_year ?? "—")} />
                    <DataRow label="Global rank" value={debtRankIndex ? `#${debtRankIndex}` : "—"} />
                    <DataRow label="Countries ranked" value={String(bundle.debt?.totals?.countries ?? "—")} />
                    <DataRow label="IMF vintage" value={bundle.debt?.vintage ?? "—"} />
                  </div>
                </div>
              </Panel>
            </div>

            <Panel title="Global sovereign debt ranking" subtitle={`IMF WEO · ${bundle.debt?.rank_year ?? "latest available"}`}>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Rank</th>
                      <th className="px-4 py-3">Country</th>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3 text-right">Debt / GDP</th>
                      <th className="px-5 py-3 text-right">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(bundle.debt?.ranking ?? []).map((row, index) => (
                      <tr key={row.country_code} className={`${row.country_code === country ? "bg-indigo-50/70" : "hover:bg-slate-50"}`}>
                        <td className="px-5 py-3 text-xs font-black text-slate-500">#{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-bold text-slate-900">{row.country_name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{row.country_code}</div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-500">{row.region ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-sm font-black tabular-nums text-slate-950">{row.debt_gross_pct_gdp.toFixed(1)}%</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${riskClasses(row.risk_band)}`}>{row.risk_band}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        ) : null}

        {view === "compare" ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">Country comparison</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{countryName} vs {compareName}</div>
                  <p className="mt-1 text-xs font-medium text-slate-500">Comparable % of GDP metrics are used so the chart remains analytically meaningful.</p>
                </div>
                <label className="block min-w-[260px]">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Compare with</span>
                  <select
                    value={compareCountry}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setCompareCountry(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  >
                    {countries.filter((item) => item.code !== country).map((item) => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(380px,0.9fr)]">
              <Panel title="Macro comparison" subtitle={`${year} reference year · nearest prior observation where needed`}>
                <div className="h-[430px] px-2 pb-3 pt-4 sm:px-4">
                  {compareLoading ? (
                    <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">Loading comparison country…</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareRows} margin={{ top: 8, right: 18, bottom: 30, left: 2 }}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="metric" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="left" name={countryName} fill="#4f46e5" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="right" name={compareName} fill="#0f766e" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Panel>

              <Panel title="Side-by-side" subtitle="Key sovereign and fiscal ratios">
                <div className="overflow-x-auto p-4">
                  <table className="w-full min-w-[360px]">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">
                        <th className="px-2 py-2 text-left">Metric</th>
                        <th className="px-2 py-2 text-right">{country}</th>
                        <th className="px-2 py-2 text-right">{compareCountry}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {compareRows.map((row) => (
                        <tr key={row.metric}>
                          <td className="px-2 py-3 text-xs font-semibold text-slate-600">{row.metric}</td>
                          <td className="px-2 py-3 text-right text-sm font-black tabular-nums text-slate-950">{metricValue(asNumber(row.left), "%")}</td>
                          <td className="px-2 py-3 text-right text-sm font-black tabular-nums text-slate-950">{metricValue(asNumber(row.right), "%")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          </div>
        ) : null}

        {view === "explorer" ? (
          <div className="mt-5">
            <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
              <Panel title="Indicator guide" subtitle="Choose a metric · plain-English definitions included">
                <div className="max-h-[650px] overflow-y-auto p-3">
                  <div className="space-y-1.5">
                    {explorerMetrics.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setExplorerKey(item.key)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                          explorerKey === item.key
                            ? "bg-slate-950 text-white shadow-sm"
                            : "border border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-black leading-5">{item.label}</div>
                            <div
                              className={`mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                                explorerKey === item.key ? "text-slate-400" : "text-slate-400"
                              }`}
                            >
                              {item.domain} · {item.unit}
                            </div>
                          </div>
                          <ArrowRight className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${explorerKey === item.key ? "text-white" : "text-slate-300"}`} />
                        </div>
                        <p
                          className={`mt-1.5 line-clamp-2 text-[10.5px] font-medium leading-[15px] ${
                            explorerKey === item.key ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {item.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </Panel>

              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(410px,0.88fr)]">
                <Panel
                  title={selectedExplorer?.label ?? "Data explorer"}
                  subtitle={`${countryName} · ${selectedExplorer?.unit ?? ""}`}
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          `macro_finance_${country}_${selectedExplorer?.key ?? "metric"}.csv`,
                          (selectedExplorer?.series ?? []).map((point) => ({
                            country: countryName,
                            iso3: country,
                            domain: selectedExplorer?.domain,
                            metric: selectedExplorer?.label,
                            unit: selectedExplorer?.unit,
                            year: point.year,
                            value: point.value,
                          })),
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </button>
                  }
                >
                  <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[11px] font-black text-indigo-700 ring-1 ring-indigo-100">i</div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">What it means</div>
                        <p className="mt-0.5 text-xs font-medium leading-5 text-slate-600">
                          {selectedExplorer?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="h-[430px] px-2 pb-3 pt-4 sm:px-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedExplorer?.series ?? []} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={54} tickFormatter={(value: any) => compactNumber(Number(value), 1)} />
                        <Tooltip formatter={(value: any) => [compactNumber(Number(value), 2), selectedExplorer?.unit ?? ""]} labelFormatter={(label: any) => `Year ${label}`} />
                        <Line connectNulls type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.6} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel
                  title="Historical records"
                  subtitle={`${selectedExplorer?.label ?? "Metric"} · ${selectedExplorer?.unit ?? ""}`}
                >
                  <div className="max-h-[536px] overflow-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-4 py-3 text-left">Year</th>
                          <th className="px-4 py-3 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {[...(selectedExplorer?.series ?? [])].reverse().map((point) => (
                          <tr key={point.year} className="transition hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-xs font-bold text-slate-600">{point.year}</td>
                            <td className="px-4 py-2.5 text-right text-sm font-black tabular-nums text-slate-950">
                              {metricValue(point.value, selectedExplorer?.unit ?? "")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
