"use client";

import countries from "world-countries";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  year: number;
  value: number;
};

type IndicatorItem = {
  code: string;
  label: string;
};

type IndicatorGuide = {
  label: string;
  unit: string;
  description: string;
  trendMeaning: string;
  peerMeaning: string;
};

type RawCountry = {
  cca3?: string;
  name?: {
    common?: string;
    official?: string;
  };
  region?: string;
  subregion?: string;
};

type CountryOption = {
  iso3: string;
  name: string;
  region: string;
  subregion: string;
};

type WeoResponse = {
  ok?: boolean;
  iso3?: string;
  country?: string;
  indicator_code?: string;
  indicator_label?: string;
  unit?: string | null;
  unit_label?: string | null;
  uom?: string | null;
  scale?: string | null;
  vintage?: string | null;
  points?: Array<{
    year: number | string;
    value: number | string;
  }>;
  error?: string;
};

type CountryLatestPoint = CountryOption & {
  latestYear: number;
  latestValue: number;
  average: number;
  pointCount: number;
};

type CountrySummary = {
  latest: number;
  min: number;
  max: number;
  average: number;
  points: number;
};

type RegionalRow = {
  iso3: string;
  country: string;
  latestValue: number;
  average: number;
  selected: boolean;
};

const DEFAULT_COUNTRY = "USA";
const DEFAULT_INDICATOR = "GGR";
const REGION_BATCH_SIZE = 18;
const MAX_PEER_BARS = 18;

const FALLBACK_INDICATORS: IndicatorItem[] = [
  { code: "GGR", label: "General government revenue" },
  { code: "GGR_NGDP", label: "Revenue, percent of GDP" },
  { code: "GGX", label: "General government total expenditure" },
  { code: "GGX_NGDP", label: "Expenditure, percent of GDP" },
  { code: "GGXCNL", label: "Net lending/borrowing" },
  { code: "GGXCNL_NGDP", label: "Net lending/borrowing, percent of GDP" },
  { code: "GGXONLB", label: "Overall net lending/borrowing" },
  {
    code: "GGXONLB_NGDP",
    label: "Overall net lending/borrowing, percent of GDP",
  },
  { code: "GGXWDN", label: "Gross debt" },
  { code: "GGXWDN_NGDP", label: "Gross debt, percent of GDP" },
  { code: "NGDP_RPCH", label: "Real GDP growth" },
  { code: "NGDPD", label: "GDP, current prices" },
  { code: "NGDPDPC", label: "GDP per capita, current prices" },
  { code: "PCPIPCH", label: "Inflation, average consumer prices" },
  { code: "LUR", label: "Unemployment rate" },
  { code: "LP", label: "Population" },
  { code: "BCA", label: "Current account balance" },
  { code: "BCA_NGDPD", label: "Current account balance, percent of GDP" },
  { code: "TX_RPCH", label: "Exports of goods and services, volume growth" },
  { code: "TM_RPCH", label: "Imports of goods and services, volume growth" },
  { code: "NGSD_NGDP", label: "National savings, percent of GDP" },
  { code: "NID_NGDP", label: "Investment, percent of GDP" },
];

const INDICATOR_GUIDES: Record<string, IndicatorGuide> = {
  GGR: {
    label: "General government revenue",
    unit: "National currency, current prices",
    description:
      "Total revenue received by general government, including taxes, social contributions, grants, and other revenue.",
    trendMeaning:
      "The line chart shows how the selected country's government revenue changes over time.",
    peerMeaning:
      "Peer comparison uses average values for countries in the selected country's peer region. For local-currency indicators, compare direction and country context carefully because currencies differ.",
  },
  GGR_NGDP: {
    label: "General government revenue, percent of GDP",
    unit: "% of GDP",
    description:
      "Government revenue expressed as a share of GDP. This is better for cross-country comparison than revenue in local currency.",
    trendMeaning:
      "The line chart shows whether the selected country's revenue effort is rising or falling relative to GDP.",
    peerMeaning:
      "The peer chart compares revenue effort across nearby regional economies using average values.",
  },
  GGX: {
    label: "General government total expenditure",
    unit: "National currency, current prices",
    description:
      "Total spending by general government, including current and capital expenditure.",
    trendMeaning:
      "The line chart shows the spending path of the selected country.",
    peerMeaning:
      "Peer comparison uses average expenditure values. Currency differences should be kept in mind.",
  },
  GGX_NGDP: {
    label: "General government expenditure, percent of GDP",
    unit: "% of GDP",
    description:
      "Government expenditure expressed as a share of GDP. It helps compare the size of public spending across economies.",
    trendMeaning:
      "The line chart shows how public spending as a share of GDP changes over time.",
    peerMeaning:
      "The peer chart compares government expenditure intensity across the region.",
  },
  GGXCNL: {
    label: "General government net lending / borrowing",
    unit: "National currency, current prices",
    description:
      "Fiscal balance in absolute terms. Positive values usually indicate net lending or surplus; negative values indicate net borrowing or deficit.",
    trendMeaning:
      "The line chart shows how the selected country's fiscal balance moves over time.",
    peerMeaning:
      "Peer comparison shows the average fiscal balance for nearby regional countries.",
  },
  GGXCNL_NGDP: {
    label: "General government net lending / borrowing, percent of GDP",
    unit: "% of GDP",
    description:
      "Fiscal balance as a share of GDP. Positive values usually indicate surplus; negative values indicate deficit.",
    trendMeaning:
      "The line chart shows whether the fiscal position is improving or deteriorating relative to GDP.",
    peerMeaning:
      "The peer chart compares fiscal-balance intensity across countries.",
  },
  GGXONLB: {
    label: "General government overall balance",
    unit: "National currency, current prices",
    description:
      "Overall government balance in absolute terms, commonly used to analyze fiscal surplus or deficit.",
    trendMeaning:
      "The line chart shows the selected country's overall fiscal balance over time.",
    peerMeaning:
      "Peer comparison shows how the selected country's average balance compares with nearby countries.",
  },
  GGXONLB_NGDP: {
    label: "General government overall balance, percent of GDP",
    unit: "% of GDP",
    description:
      "Overall government balance as a share of GDP. It is a compact measure of fiscal surplus or deficit relative to the economy.",
    trendMeaning:
      "The line chart shows the trend in overall fiscal balance relative to GDP.",
    peerMeaning:
      "The peer chart compares fiscal surplus/deficit as a share of GDP.",
  },
  GGXWDN: {
    label: "General government gross debt",
    unit: "National currency, current prices",
    description:
      "Total gross debt liabilities of the general government sector.",
    trendMeaning:
      "The line chart shows the debt stock trend for the selected country.",
    peerMeaning:
      "Peer comparison uses average debt-stock values. Currency differences should be kept in mind.",
  },
  GGXWDN_NGDP: {
    label: "General government gross debt, percent of GDP",
    unit: "% of GDP",
    description:
      "Gross government debt relative to GDP. This is a widely used debt-burden indicator.",
    trendMeaning:
      "The line chart shows whether the selected country's debt burden is increasing or decreasing.",
    peerMeaning:
      "The peer chart compares government debt burden across the selected regional peer group.",
  },
  NGDP_RPCH: {
    label: "Real GDP growth",
    unit: "Annual percent change",
    description:
      "Annual growth rate of real GDP. It shows how fast an economy is expanding or contracting after adjusting for inflation.",
    trendMeaning:
      "The line chart shows the selected country's economic growth cycle over time.",
    peerMeaning:
      "The peer chart compares average real GDP growth across nearby economies.",
  },
  NGDPD: {
    label: "GDP, current prices",
    unit: "US dollars, billions",
    description:
      "Nominal GDP measured in current US dollars. It represents the current-size of an economy.",
    trendMeaning:
      "The line chart shows how the selected country's dollar GDP changes over time.",
    peerMeaning:
      "The peer chart compares the average size of economies in US dollar terms.",
  },
  NGDPDPC: {
    label: "GDP per capita, current prices",
    unit: "US dollars per person",
    description:
      "Nominal GDP divided by population. It is a broad income-level proxy.",
    trendMeaning:
      "The line chart shows the selected country's income-level trend over time.",
    peerMeaning:
      "The peer chart compares average income-level proxies across regional peers.",
  },
  PCPIPCH: {
    label: "Inflation, average consumer prices",
    unit: "Annual percent change",
    description:
      "Average annual change in consumer prices. It is a standard measure of inflation pressure.",
    trendMeaning:
      "The line chart shows inflation pressure in the selected country over time.",
    peerMeaning:
      "The peer chart compares average inflation pressure across regional peers.",
  },
  LUR: {
    label: "Unemployment rate",
    unit: "% of labor force",
    description:
      "Share of the labor force that is unemployed. It helps assess labor-market stress.",
    trendMeaning:
      "The line chart shows how unemployment changes over time in the selected country.",
    peerMeaning:
      "The peer chart compares average unemployment levels across regional peers.",
  },
  LP: {
    label: "Population",
    unit: "Persons, millions",
    description:
      "Total population. It helps understand market size and demographic scale.",
    trendMeaning:
      "The line chart shows population growth or decline over time.",
    peerMeaning:
      "The peer chart compares population scale across the selected peer group.",
  },
  BCA: {
    label: "Current account balance",
    unit: "US dollars, billions",
    description:
      "Balance of trade in goods, services, income, and transfers with the rest of the world.",
    trendMeaning:
      "The line chart shows whether the selected country is moving toward external surplus or deficit.",
    peerMeaning:
      "The peer chart compares average current-account balances across regional peers.",
  },
  BCA_NGDPD: {
    label: "Current account balance, percent of GDP",
    unit: "% of GDP",
    description:
      "Current account balance relative to GDP. Positive values indicate external surplus; negative values indicate external deficit.",
    trendMeaning:
      "The line chart shows the external-balance trend relative to GDP.",
    peerMeaning:
      "The peer chart compares current-account positions relative to GDP.",
  },
  TX_RPCH: {
    label: "Exports of goods and services, volume growth",
    unit: "Annual percent change",
    description:
      "Annual growth in export volumes. It indicates real export-sector momentum.",
    trendMeaning:
      "The line chart shows export-volume growth over time for the selected country.",
    peerMeaning:
      "The peer chart compares average export-volume growth across regional peers.",
  },
  TM_RPCH: {
    label: "Imports of goods and services, volume growth",
    unit: "Annual percent change",
    description:
      "Annual growth in import volumes. It can reflect domestic demand, investment needs, and import dependency.",
    trendMeaning:
      "The line chart shows import-volume growth over time for the selected country.",
    peerMeaning:
      "The peer chart compares average import-volume growth across regional peers.",
  },
  NGSD_NGDP: {
    label: "National savings, percent of GDP",
    unit: "% of GDP",
    description:
      "National savings expressed as a share of GDP. It helps assess domestic savings capacity.",
    trendMeaning:
      "The line chart shows how savings capacity changes over time.",
    peerMeaning:
      "The peer chart compares savings capacity across regional peers.",
  },
  NID_NGDP: {
    label: "Investment, percent of GDP",
    unit: "% of GDP",
    description:
      "Total investment expressed as a share of GDP. It helps compare capital formation.",
    trendMeaning:
      "The line chart shows the investment-intensity trend for the selected country.",
    peerMeaning:
      "The peer chart compares investment intensity across regional peers.",
  },
};

const FALLBACK_LABEL_BY_CODE = new Map(
  FALLBACK_INDICATORS.map((indicator) => [indicator.code, indicator.label]),
);

const COUNTRY_OPTIONS: CountryOption[] = (countries as RawCountry[])
  .map((country) => ({
    iso3: String(country.cca3 || "").toUpperCase(),
    name: String(country.name?.common || country.name?.official || ""),
    region: String(country.region || "Other"),
    subregion: String(country.subregion || country.region || "Other"),
  }))
  .filter(
    (country) =>
      country.iso3.length === 3 &&
      country.name.length > 0 &&
      country.region.toLowerCase() !== "antarctic",
  )
  .sort((a, b) => a.name.localeCompare(b.name));

function isWeakIndicatorLabel(code: string, label: string) {
  const normalizedCode = code.trim().toUpperCase();
  const normalizedLabel = label.trim().toUpperCase();

  return (
    !normalizedLabel ||
    normalizedLabel === normalizedCode ||
    normalizedLabel === `${normalizedCode}(${normalizedCode})` ||
    normalizedLabel === `${normalizedCode} (${normalizedCode})`
  );
}

function cleanIndicatorLabel(code: string, label: string) {
  const normalizedCode = code.trim().toUpperCase();
  const cleaned = label.trim();
  const guide = INDICATOR_GUIDES[normalizedCode];
  const fallback = FALLBACK_LABEL_BY_CODE.get(normalizedCode);

  if (guide?.label) return guide.label;
  if (isWeakIndicatorLabel(normalizedCode, cleaned))
    return fallback || normalizedCode;
  return cleaned;
}

function buildIndicatorGuide(code: string, rawLabel?: string): IndicatorGuide {
  const normalizedCode = code.trim().toUpperCase();
  const explicit = INDICATOR_GUIDES[normalizedCode];
  if (explicit) return explicit;

  const label = cleanIndicatorLabel(normalizedCode, rawLabel || normalizedCode);

  if (normalizedCode.endsWith("_NGDP") || normalizedCode.endsWith("_NGDPD")) {
    return {
      label,
      unit: "% of GDP",
      description:
        "This IMF WEO indicator is expressed as a share of GDP, making it more suitable for comparing countries of different economic sizes.",
      trendMeaning: `The line chart shows the selected country's ${label.toLowerCase()} trend over time.`,
      peerMeaning: `The peer chart compares ${label.toLowerCase()} across the selected regional peer group.`,
    };
  }

  if (normalizedCode.endsWith("RPCH") || normalizedCode.endsWith("PCH")) {
    return {
      label,
      unit: "Annual percent change",
      description:
        "This IMF WEO indicator is an annual growth/change rate, useful for comparing momentum across countries and years.",
      trendMeaning: `The line chart shows the selected country's ${label.toLowerCase()} cycle over time.`,
      peerMeaning: `The peer chart compares average ${label.toLowerCase()} across nearby countries.`,
    };
  }

  if (normalizedCode.endsWith("DPC") || normalizedCode.includes("PC")) {
    return {
      label,
      unit: "Per-capita value",
      description:
        "This IMF WEO indicator is shown on a per-person basis, making it easier to compare living-standard or intensity differences across countries.",
      trendMeaning: `The line chart shows the selected country's ${label.toLowerCase()} trend over time.`,
      peerMeaning: `The peer chart compares average ${label.toLowerCase()} across countries.`,
    };
  }

  return {
    label,
    unit: "IMF WEO reported unit",
    description:
      "This indicator comes from the IMF World Economic Outlook dataset. Use the line chart for historical country trend analysis and the peer chart for regional context.",
    trendMeaning: `The line chart shows the selected country's ${label.toLowerCase()} trend over time.`,
    peerMeaning: `The peer chart compares average ${label.toLowerCase()} across regional peers.`,
  };
}

function normalizePoints(payload: WeoResponse | null): Point[] {
  return (payload?.points || [])
    .map((point) => ({
      year: Number(point.year),
      value: Number(point.value),
    }))
    .filter(
      (point) => Number.isFinite(point.year) && Number.isFinite(point.value),
    )
    .sort((a, b) => a.year - b.year);
}

function normalizeIndicators(rows: unknown): IndicatorItem[] {
  const sourceRows = Array.isArray(rows) ? rows : [];

  const items = sourceRows
    .map((row) => {
      const item = row as Record<string, unknown>;

      const code = String(
        item.code ??
          item.indicator_code ??
          item.indicator ??
          item.weo_code ??
          item.subject_code ??
          item.weo_subject_code ??
          "",
      )
        .trim()
        .toUpperCase();

      const rawLabel = String(
        item.label ??
          item.indicator_label ??
          item.description ??
          item.subject_descriptor ??
          item.name ??
          code,
      ).trim();

      return {
        code,
        label: cleanIndicatorLabel(code, rawLabel || code),
      };
    })
    .filter((item) => item.code.length > 0);

  const unique = new Map<string, IndicatorItem>();

  for (const item of FALLBACK_INDICATORS) {
    unique.set(item.code, {
      code: item.code,
      label: cleanIndicatorLabel(item.code, item.label),
    });
  }

  for (const item of items) {
    const current = unique.get(item.code);
    if (!current || !isWeakIndicatorLabel(item.code, item.label)) {
      unique.set(item.code, {
        code: item.code,
        label: cleanIndicatorLabel(item.code, item.label),
      });
    }
  }

  return Array.from(unique.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";

  const abs = Math.abs(value);
  const maximumFractionDigits = abs >= 100 ? 1 : abs >= 10 ? 2 : 3;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function cleanUnitText(value: unknown) {
  const text = String(value ?? "").trim();
  if (
    !text ||
    text.toLowerCase() === "null" ||
    text.toLowerCase() === "undefined"
  )
    return "";
  return text.replace(/\s+/g, " ");
}

function resolveIndicatorUnit(
  payload: WeoResponse | null,
  fallbackUnit: string,
) {
  const apiUnit = [
    payload?.unit_label,
    payload?.unit,
    payload?.uom,
    payload?.scale,
  ]
    .map(cleanUnitText)
    .find(Boolean);

  return apiUnit || fallbackUnit || "IMF WEO reported unit";
}

function formatValueWithUnit(value: number | null | undefined, unit: string) {
  const formatted = formatNumber(value);
  if (formatted === "—") return formatted;
  return unit ? `${formatted} ${unit}` : formatted;
}

function average(points: Point[]) {
  if (!points.length) return NaN;
  return points.reduce((sum, point) => sum + point.value, 0) / points.length;
}

function median(values: number[]) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return NaN;
  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2) return clean[mid];
  return (clean[mid - 1] + clean[mid]) / 2;
}

function summarize(points: Point[]): CountrySummary {
  if (!points.length)
    return { latest: NaN, min: NaN, max: NaN, average: NaN, points: 0 };

  return {
    latest: points[points.length - 1].value,
    min: Math.min(...points.map((point) => point.value)),
    max: Math.max(...points.map((point) => point.value)),
    average: average(points),
    points: points.length,
  };
}

function getCountryByIso3(iso3: string) {
  return COUNTRY_OPTIONS.find((country) => country.iso3 === iso3) || null;
}

function getIndicatorLabel(indicators: IndicatorItem[], code: string) {
  const rawLabel =
    indicators.find((indicator) => indicator.code === code)?.label || code;
  return cleanIndicatorLabel(code, rawLabel);
}

function getPeerCountries(country: CountryOption | null) {
  if (!country) return [];

  const subregionPeers = COUNTRY_OPTIONS.filter(
    (item) => item.subregion === country.subregion,
  );
  if (subregionPeers.length >= 3) return subregionPeers;

  return COUNTRY_OPTIONS.filter((item) => item.region === country.region);
}

async function fetchWeoSeries(
  iso3: string,
  indicator: string,
  signal?: AbortSignal,
): Promise<WeoResponse> {
  const response = await fetch(
    `/api/imf/weo/country?iso3=${encodeURIComponent(iso3)}&indicator=${encodeURIComponent(
      indicator,
    )}`,
    { cache: "no-store", signal },
  );

  const json = (await response.json()) as WeoResponse;

  if (!response.ok || json.ok === false) {
    throw new Error(json.error || "Failed to load IMF WEO data");
  }

  return json;
}

function percentileRank(points: CountryLatestPoint[], iso3: string) {
  const selected = points.find((point) => point.iso3 === iso3);
  if (!selected || !Number.isFinite(selected.average)) return null;

  const sorted = [...points]
    .filter((point) => Number.isFinite(point.average))
    .sort((a, b) => a.average - b.average);

  const index = sorted.findIndex((point) => point.iso3 === iso3);
  if (index < 0 || !sorted.length) return null;

  return {
    rankLowToHigh: index + 1,
    rankHighToLow: sorted.length - index,
    percentile: ((index + 1) / sorted.length) * 100,
    total: sorted.length,
  };
}

const TimeSeriesTrendChart = memo(function TimeSeriesTrendChart({
  data,
  unit,
}: {
  data: Point[];
  unit: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 12, right: 12, left: 4, bottom: 8 }}
      >
        <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
        <XAxis
          dataKey="year"
          minTickGap={18}
          stroke="#CBD5E1"
          tick={{ fill: "#475569", fontSize: 11 }}
        />
        <YAxis
          width={72}
          stroke="#CBD5E1"
          tick={{ fill: "#475569", fontSize: 11 }}
          tickFormatter={(value) => formatNumber(Number(value))}
        />
        <Tooltip
          formatter={(value: unknown) => [
            formatValueWithUnit(Number(value), unit),
            `Value (${unit})`,
          ]}
          labelFormatter={(label: unknown) => `Year: ${String(label)}`}
          contentStyle={{
            borderRadius: 16,
            border: "1px solid #E2E8F0",
            background: "#FFFFFF",
            boxShadow: "0 12px 32px rgba(15,23,42,0.12)",
            fontSize: "12px",
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#4F46E5"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

const RegionalAverageChart = memo(function RegionalAverageChart({
  data,
  unit,
}: {
  data: RegionalRow[];
  unit: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 12, right: 12, left: 4, bottom: 76 }}
      >
        <CartesianGrid
          stroke="#E2E8F0"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="iso3"
          interval={0}
          angle={-45}
          textAnchor="end"
          stroke="#CBD5E1"
          tick={{ fill: "#475569", fontSize: 11 }}
        />
        <YAxis
          width={72}
          stroke="#CBD5E1"
          tick={{ fill: "#475569", fontSize: 11 }}
          tickFormatter={(value) => formatNumber(Number(value))}
        />
        <Tooltip
          formatter={(value: unknown) => [
            formatValueWithUnit(Number(value), unit),
            `Average (${unit})`,
          ]}
          labelFormatter={(label: unknown) => {
            const row = data.find((item) => item.iso3 === String(label));
            return row ? `${row.country} (${row.iso3})` : String(label);
          }}
          contentStyle={{
            borderRadius: 16,
            border: "1px solid #E2E8F0",
            background: "#FFFFFF",
            boxShadow: "0 12px 32px rgba(15,23,42,0.12)",
            fontSize: "12px",
          }}
        />
        <Bar
          dataKey="average"
          radius={[10, 10, 0, 0]}
          isAnimationActive={false}
        >
          {data.map((row) => (
            <Cell
              key={row.iso3}
              fill={row.selected ? "#7C3AED" : "#3B82F6"}
              fillOpacity={row.selected ? 0.95 : 0.72}
              stroke={row.selected ? "#4C1D95" : "#2563EB"}
              strokeWidth={row.selected ? 2 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

function IndicatorPicker({
  indicators,
  selectedIndicator,
  indicatorQuery,
  onQueryChange,
  onChange,
}: {
  indicators: IndicatorItem[];
  selectedIndicator: string;
  indicatorQuery: string;
  onQueryChange: (value: string) => void;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedGuide = buildIndicatorGuide(
    selectedIndicator,
    indicators.find((item) => item.code === selectedIndicator)?.label ||
      selectedIndicator,
  );

  const filteredIndicators = useMemo(() => {
    const query = indicatorQuery.trim().toLowerCase();
    if (!query) return indicators;

    return indicators.filter((item) => {
      const guide = buildIndicatorGuide(item.code, item.label);
      return (
        item.code.toLowerCase().includes(query) ||
        guide.label.toLowerCase().includes(query) ||
        guide.unit.toLowerCase().includes(query) ||
        guide.description.toLowerCase().includes(query)
      );
    });
  }, [indicatorQuery, indicators]);

  return (
    <div className="relative rounded-[24px] border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
        IMF indicator
      </label>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-violet-300"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-slate-950">
              {selectedGuide.label}
            </div>
            <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">
              {selectedIndicator} · {selectedGuide.unit}
            </div>
          </div>
          <span className="text-xs font-black text-violet-700">Change</span>
        </div>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[min(560px,90vw)] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 bg-slate-50 p-3">
            <input
              value={indicatorQuery}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search code, indicator, unit or description..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
              autoFocus
            />
          </div>

          <div className="max-h-[440px] overflow-y-auto p-2">
            {filteredIndicators.map((item) => {
              const guide = buildIndicatorGuide(item.code, item.label);
              const active = item.code === selectedIndicator;

              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-violet-300 bg-violet-50"
                      : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-950">
                        {guide.label}
                      </div>
                      <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        {guide.description}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-violet-700 shadow-sm">
                      {item.code}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Unit: {guide.unit}
                  </div>
                </button>
              );
            })}

            {!filteredIndicators.length ? (
              <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                No indicator found. Try another keyword.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CountryPicker({
  countriesList,
  selectedCountry,
  countryQuery,
  onQueryChange,
  onChange,
}: {
  countriesList: CountryOption[];
  selectedCountry: string;
  countryQuery: string;
  onQueryChange: (value: string) => void;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = getCountryByIso3(selectedCountry);

  const filteredCountries = useMemo(() => {
    const query = countryQuery.trim().toLowerCase();
    if (!query) return countriesList;

    return countriesList.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.iso3.toLowerCase().includes(query) ||
        item.region.toLowerCase().includes(query) ||
        item.subregion.toLowerCase().includes(query),
    );
  }, [countriesList, countryQuery]);

  return (
    <div className="relative rounded-[24px] border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
        Country
      </label>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-violet-300"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-slate-950">
              {selected
                ? `${selected.name} (${selected.iso3})`
                : "United States (USA)"}
            </div>
            <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">
              {selected
                ? `${selected.region} · ${selected.subregion}`
                : "Default country"}
            </div>
          </div>
          <span className="text-xs font-black text-violet-700">Change</span>
        </div>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[90] w-[min(430px,90vw)] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 bg-slate-50 p-3">
            <input
              value={countryQuery}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search country, ISO3 or region..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
              autoFocus
            />
          </div>

          <div className="max-h-[390px] overflow-y-auto p-2">
            {filteredCountries.map((item) => (
              <button
                key={item.iso3}
                type="button"
                onClick={() => {
                  onChange(item.iso3);
                  setOpen(false);
                }}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                  item.iso3 === selectedCountry
                    ? "border-violet-300 bg-violet-50"
                    : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-950">
                      {item.name}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">
                      {item.iso3} · {item.region} · {item.subregion}
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-violet-700 shadow-sm">
                    {item.iso3}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function IMFWeoDashboardPage() {
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [selectedIndicator, setSelectedIndicator] = useState(DEFAULT_INDICATOR);
  const [countryQuery, setCountryQuery] = useState("");
  const [indicatorQuery, setIndicatorQuery] = useState("");
  const [indicators, setIndicators] =
    useState<IndicatorItem[]>(FALLBACK_INDICATORS);
  const [seriesPayload, setSeriesPayload] = useState<WeoResponse | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState("");
  const [regionalPoints, setRegionalPoints] = useState<CountryLatestPoint[]>(
    [],
  );
  const [regionalLoading, setRegionalLoading] = useState(false);
  const [regionalProgress, setRegionalProgress] = useState(0);
  const [regionalError, setRegionalError] = useState("");

  const country = useMemo(
    () => getCountryByIso3(selectedCountry),
    [selectedCountry],
  );
  const peerCountries = useMemo(() => getPeerCountries(country), [country]);

  const seriesPoints = useMemo(
    () => normalizePoints(seriesPayload),
    [seriesPayload],
  );
  const summary = useMemo(() => summarize(seriesPoints), [seriesPoints]);

  const selectedIndicatorLabel = useMemo(() => {
    return cleanIndicatorLabel(
      selectedIndicator,
      seriesPayload?.indicator_label ||
        getIndicatorLabel(indicators, selectedIndicator),
    );
  }, [indicators, selectedIndicator, seriesPayload]);

  const selectedIndicatorGuide = useMemo(() => {
    return buildIndicatorGuide(selectedIndicator, selectedIndicatorLabel);
  }, [selectedIndicator, selectedIndicatorLabel]);

  const indicatorUnit = useMemo(() => {
    return resolveIndicatorUnit(seriesPayload, selectedIndicatorGuide.unit);
  }, [seriesPayload, selectedIndicatorGuide.unit]);

  const displayIndicatorGuide = useMemo<IndicatorGuide>(() => {
    return { ...selectedIndicatorGuide, unit: indicatorUnit };
  }, [selectedIndicatorGuide, indicatorUnit]);

  const regionalValues = useMemo(
    () =>
      regionalPoints.map((point) => point.latestValue).filter(Number.isFinite),
    [regionalPoints],
  );

  const regionalStats = useMemo(() => {
    if (!regionalValues.length)
      return { count: 0, average: NaN, median: NaN, min: NaN, max: NaN };

    return {
      count: regionalValues.length,
      average:
        regionalValues.reduce((sum, value) => sum + value, 0) /
        regionalValues.length,
      median: median(regionalValues),
      min: Math.min(...regionalValues),
      max: Math.max(...regionalValues),
    };
  }, [regionalValues]);

  const selectedRegionalPoint = useMemo(() => {
    return (
      regionalPoints.find((point) => point.iso3 === selectedCountry) || null
    );
  }, [regionalPoints, selectedCountry]);

  const selectedRank = useMemo(
    () => percentileRank(regionalPoints, selectedCountry),
    [regionalPoints, selectedCountry],
  );

  const regionalRows = useMemo(() => {
    return regionalPoints
      .filter((point) => Number.isFinite(point.average))
      .map((point) => ({
        iso3: point.iso3,
        country: point.name,
        latestValue: point.latestValue,
        average: point.average,
        selected: point.iso3 === selectedCountry,
      }))
      .sort((a, b) => {
        if (a.iso3 === selectedCountry) return -1;
        if (b.iso3 === selectedCountry) return 1;
        return Math.abs(b.average) - Math.abs(a.average);
      })
      .slice(0, MAX_PEER_BARS);
  }, [regionalPoints, selectedCountry]);

  useEffect(() => {
    let alive = true;

    async function loadMeta() {
      try {
        const response = await fetch("/api/imf/weo/meta", {
          cache: "no-store",
        });
        const json = (await response.json()) as {
          ok?: boolean;
          indicators?: unknown[];
        };

        if (!alive) return;
        setIndicators(
          json.ok === false
            ? FALLBACK_INDICATORS
            : normalizeIndicators(json.indicators),
        );
      } catch {
        if (alive) setIndicators(FALLBACK_INDICATORS);
      }
    }

    loadMeta();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSelectedSeries() {
      try {
        setSeriesLoading(true);
        setSeriesError("");
        setSeriesPayload(null);

        const payload = await fetchWeoSeries(
          selectedCountry,
          selectedIndicator,
          controller.signal,
        );
        if (!controller.signal.aborted) setSeriesPayload(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSeriesError(
          error instanceof Error
            ? error.message
            : "Failed to load selected country series",
        );
        setSeriesPayload(null);
      } finally {
        if (!controller.signal.aborted) setSeriesLoading(false);
      }
    }

    loadSelectedSeries();
    return () => controller.abort();
  }, [selectedCountry, selectedIndicator]);

  useEffect(() => {
    if (!country || !peerCountries.length) return;

    const controller = new AbortController();

    async function loadRegionalPeerValues() {
      try {
        setRegionalLoading(true);
        setRegionalError("");
        setRegionalProgress(0);
        setRegionalPoints([]);

        const collected: CountryLatestPoint[] = [];

        for (let i = 0; i < peerCountries.length; i += REGION_BATCH_SIZE) {
          if (controller.signal.aborted) return;

          const batch = peerCountries.slice(i, i + REGION_BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (item) => {
              const payload = await fetchWeoSeries(
                item.iso3,
                selectedIndicator,
                controller.signal,
              );
              const points = normalizePoints(payload);
              if (!points.length) return null;

              const latest = points[points.length - 1];
              return {
                ...item,
                latestYear: latest.year,
                latestValue: latest.value,
                average: average(points),
                pointCount: points.length,
              } satisfies CountryLatestPoint;
            }),
          );

          for (const result of results) {
            if (result.status === "fulfilled" && result.value)
              collected.push(result.value);
          }

          if (!controller.signal.aborted) {
            setRegionalProgress(
              Math.min(
                100,
                Math.round(((i + batch.length) / peerCountries.length) * 100),
              ),
            );
          }
        }

        if (!controller.signal.aborted) {
          setRegionalPoints(collected.sort((a, b) => b.average - a.average));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setRegionalError(
          error instanceof Error
            ? error.message
            : "Failed to load regional peer values",
        );
      } finally {
        if (!controller.signal.aborted) setRegionalLoading(false);
      }
    }

    loadRegionalPeerValues();
    return () => controller.abort();
  }, [country, peerCountries, selectedIndicator]);

  const handleCountryChange = useCallback((nextIso3: string) => {
    const normalized = nextIso3.trim().toUpperCase();
    if (normalized) setSelectedCountry(normalized);
  }, []);

  const handleIndicatorChange = useCallback((nextIndicator: string) => {
    const normalized = nextIndicator.trim().toUpperCase();
    if (normalized) setSelectedIndicator(normalized);
  }, []);

  const selectedCountryLabel = country?.name || "United States";
  const selectedRegionLabel = country
    ? `${country.iso3} · ${country.subregion || country.region}`
    : "USA · Northern America";
  const peerGroupLabel = country?.subregion || country?.region || "Peer region";
  const latestYearLabel = seriesPoints.length
    ? seriesPoints[seriesPoints.length - 1].year
    : "Loading";

  return (
    <div className="min-h-screen bg-[#eef3fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(620px,0.9fr)]">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-violet-600">
                IMF World Economic Outlook
              </div>
              <h1 className="mt-2 text-[30px] font-black tracking-tight text-slate-950 md:text-[36px]">
                WEO country intelligence dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
                Optimized view without map or histogram. Select a country and
                IMF indicator, then review the country trend and regional peer
                comparison.
              </p>
              <div className="mt-3 inline-flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-2 text-sm font-semibold text-slate-700">
                <span className="text-violet-700">Current indicator:</span>
                <span className="font-black text-slate-950">
                  {displayIndicatorGuide.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-violet-700">
                  {selectedIndicator}
                </span>
                <span className="text-slate-500">
                  · {displayIndicatorGuide.unit}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <CountryPicker
                countriesList={COUNTRY_OPTIONS}
                selectedCountry={selectedCountry}
                countryQuery={countryQuery}
                onQueryChange={setCountryQuery}
                onChange={handleCountryChange}
              />

              <IndicatorPicker
                indicators={indicators}
                selectedIndicator={selectedIndicator}
                indicatorQuery={indicatorQuery}
                onQueryChange={setIndicatorQuery}
                onChange={handleIndicatorChange}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Selected country
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {selectedCountryLabel}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {selectedRegionLabel}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Latest selected value
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {seriesLoading ? "—" : formatNumber(summary.latest)}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {latestYearLabel}
            </div>
            <div className="mt-1 text-xs font-black uppercase tracking-wide text-violet-600">
              {indicatorUnit}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Country average
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {seriesLoading ? "—" : formatNumber(summary.average)}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {summary.points || "—"} data points
            </div>
            <div className="mt-1 text-xs font-black uppercase tracking-wide text-violet-600">
              {indicatorUnit}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Peer rank
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {selectedRank
                ? `${selectedRank.rankHighToLow}/${selectedRank.total}`
                : "—"}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {regionalLoading ? `${regionalProgress}% loaded` : peerGroupLabel}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
                Indicator explained
              </span>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700 shadow-sm">
                {selectedIndicator}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              {displayIndicatorGuide.label}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {displayIndicatorGuide.description}
            </p>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Unit of measurement
                </div>
                <div className="mt-1 font-black text-slate-900">
                  {displayIndicatorGuide.unit}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  How to read the trend
                </div>
                <div className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                  {displayIndicatorGuide.trendMeaning}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  How to read peer comparison
                </div>
                <div className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                  {displayIndicatorGuide.peerMeaning}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950">
                  Time-series trend
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {selectedCountryLabel} · {selectedIndicatorLabel}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Unit
                </div>
                <div className="max-w-[340px] truncate text-sm font-black text-violet-700">
                  {indicatorUnit}
                </div>
              </div>
            </div>

            {seriesLoading ? (
              <div className="flex h-[430px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3 text-sm font-black text-slate-600">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
                  Loading WEO series...
                </div>
              </div>
            ) : seriesError ? (
              <div className="flex h-[430px] items-center justify-center rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-center">
                <div>
                  <div className="text-lg font-black text-amber-900">
                    No series loaded
                  </div>
                  <p className="mt-2 text-sm font-semibold text-amber-700">
                    {seriesError}
                  </p>
                </div>
              </div>
            ) : seriesPoints.length ? (
              <div className="h-[430px] rounded-[28px] border border-slate-100 bg-slate-50/70 p-3">
                <TimeSeriesTrendChart
                  data={seriesPoints}
                  unit={indicatorUnit}
                />
              </div>
            ) : (
              <div className="flex h-[430px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center">
                <div>
                  <div className="text-lg font-black text-slate-900">
                    No time-series data
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Select another country or indicator.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Regional peer average comparison
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Average value of {selectedIndicator} for {selectedCountryLabel}{" "}
                compared with countries in {peerGroupLabel}. The selected
                country is placed first.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Peer coverage
              </div>
              <div className="text-sm font-black text-slate-900">
                {regionalLoading
                  ? `${regionalProgress}% loaded`
                  : `${regionalStats.count} of ${peerCountries.length} countries`}
              </div>
              <div className="max-w-[420px] truncate text-xs font-black text-violet-700">
                Unit: {indicatorUnit}
              </div>
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Peer average
              </div>
              <div className="mt-1 text-lg font-black text-slate-950">
                {formatNumber(regionalStats.average)}
              </div>
              <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-violet-600">
                {indicatorUnit}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Peer median
              </div>
              <div className="mt-1 text-lg font-black text-slate-950">
                {formatNumber(regionalStats.median)}
              </div>
              <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-violet-600">
                {indicatorUnit}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Min / max
              </div>
              <div className="mt-1 text-lg font-black text-slate-950">
                {formatNumber(regionalStats.min)} /{" "}
                {formatNumber(regionalStats.max)}
              </div>
              <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-violet-600">
                {indicatorUnit}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Selected latest
              </div>
              <div className="mt-1 text-lg font-black text-slate-950">
                {formatNumber(selectedRegionalPoint?.latestValue)}
              </div>
              <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-violet-600">
                {indicatorUnit}
              </div>
            </div>
          </div>

          {regionalLoading ? (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm font-black text-slate-700">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
                  Loading regional peer comparison...
                </div>
                <div className="text-sm font-black text-violet-700">
                  {regionalProgress}%
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all"
                  style={{ width: `${regionalProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {regionalRows.length ? (
            <div className="h-[420px] rounded-[28px] border border-slate-100 bg-slate-50/70 p-3">
              <RegionalAverageChart data={regionalRows} unit={indicatorUnit} />
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center">
              <div>
                <div className="text-base font-black text-slate-900">
                  Regional comparison pending
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Regional values are loading or unavailable for this indicator.
                </p>
              </div>
            </div>
          )}

          {selectedRegionalPoint ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              Latest regional value for {selectedRegionalPoint.name}:{" "}
              {formatValueWithUnit(
                selectedRegionalPoint.latestValue,
                indicatorUnit,
              )}{" "}
              ({selectedRegionalPoint.latestYear})
              {selectedRank
                ? ` · Percentile: ${formatNumber(selectedRank.percentile)}%`
                : ""}
            </div>
          ) : null}

          {regionalError ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {regionalError}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
