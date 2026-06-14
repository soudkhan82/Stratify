"use client";

import dynamic from "next/dynamic";
import countries from "world-countries";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer as any),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
        Loading map...
      </div>
    ),
  },
) as any;

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer as any),
  { ssr: false },
) as any;

const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker as any),
  { ssr: false },
) as any;

const LeafletTooltip = dynamic(
  () => import("react-leaflet").then((mod) => mod.Tooltip as any),
  { ssr: false },
) as any;

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
  mapMeaning: string;
  chartMeaning: string;
};

type RawCountry = {
  cca3?: string;
  name?: {
    common?: string;
    official?: string;
  };
  region?: string;
  subregion?: string;
  latlng?: number[];
};

type CountryOption = {
  iso3: string;
  name: string;
  region: string;
  subregion: string;
  lat: number;
  lng: number;
};

type WeoResponse = {
  ok?: boolean;
  iso3?: string;
  country?: string;
  indicator_code?: string;
  indicator_label?: string;
  vintage?: string | null;
  points?: Array<{
    year: number | string;
    value: number | string;
  }>;
  error?: string;
};

type MapPoint = CountryOption & {
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
  average: number;
  selected: boolean;
};

const DEFAULT_INDICATOR = "GGR";
const MAP_BATCH_SIZE = 14;

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
  { code: "NGDP_RPCH", label: "GDP growth" },
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
      "Total revenue received by general government, including taxes, social contributions, grants, and other revenue. It is useful for understanding the absolute size of public-sector receipts.",
    mapMeaning:
      "Larger circles indicate countries with higher latest government revenue in local currency terms. Use this mainly for within-country trend context, because currencies differ across countries.",
    chartMeaning:
      "The line chart shows how the selected country's government revenue changes over time.",
  },
  GGR_NGDP: {
    label: "General government revenue, percent of GDP",
    unit: "% of GDP",
    description:
      "Government revenue expressed as a share of GDP. This is better for cross-country comparison than revenue in local currency.",
    mapMeaning:
      "Larger circles indicate countries where government revenue is a higher share of GDP.",
    chartMeaning:
      "The line chart shows whether the selected country's revenue effort is rising or falling relative to GDP.",
  },
  GGX: {
    label: "General government total expenditure",
    unit: "National currency, current prices",
    description:
      "Total spending by general government, including current and capital expenditure.",
    mapMeaning:
      "Larger circles indicate countries with higher latest government spending in local currency terms. Cross-country comparison is limited because currencies differ.",
    chartMeaning:
      "The line chart shows the spending path of the selected country's general government.",
  },
  GGX_NGDP: {
    label: "General government expenditure, percent of GDP",
    unit: "% of GDP",
    description:
      "Government expenditure expressed as a share of GDP. This helps compare the size of government spending across economies.",
    mapMeaning:
      "Larger circles indicate countries where government spending represents a higher share of GDP.",
    chartMeaning:
      "The line chart shows how public spending as a share of GDP changes over time.",
  },
  GGXCNL: {
    label: "General government net lending / borrowing",
    unit: "National currency, current prices",
    description:
      "Fiscal balance in absolute terms. Positive values usually indicate net lending or surplus; negative values indicate net borrowing or deficit.",
    mapMeaning:
      "Circle size is based on the absolute latest balance. Check the tooltip for whether the value is positive or negative.",
    chartMeaning:
      "The line chart shows how the selected country's fiscal balance moves over time.",
  },
  GGXCNL_NGDP: {
    label: "General government net lending / borrowing, percent of GDP",
    unit: "% of GDP",
    description:
      "Fiscal balance as a share of GDP. Positive values usually indicate surplus; negative values indicate deficit.",
    mapMeaning:
      "Circle size reflects the absolute balance as a share of GDP. Tooltips show the sign and value.",
    chartMeaning:
      "The line chart shows whether the fiscal position is improving or deteriorating relative to GDP.",
  },
  GGXONLB: {
    label: "General government overall balance",
    unit: "National currency, current prices",
    description:
      "Overall government balance in absolute terms, commonly used to analyze fiscal surplus or deficit.",
    mapMeaning:
      "Circle size is based on the absolute latest balance. Use the tooltip to see the actual positive or negative value.",
    chartMeaning:
      "The line chart shows the selected country's overall fiscal balance over time.",
  },
  GGXONLB_NGDP: {
    label: "General government overall balance, percent of GDP",
    unit: "% of GDP",
    description:
      "Overall government balance as a share of GDP. It is a compact measure of fiscal surplus or deficit relative to the economy.",
    mapMeaning:
      "Circle size reflects the absolute fiscal balance ratio. Tooltip values show whether the balance is surplus or deficit.",
    chartMeaning:
      "The line chart shows the trend in overall fiscal balance relative to GDP.",
  },
  GGXWDN: {
    label: "General government gross debt",
    unit: "National currency, current prices",
    description:
      "Total gross debt liabilities of the general government sector.",
    mapMeaning:
      "Larger circles indicate countries with higher latest gross government debt in local currency terms. Cross-country comparison is limited by currency differences.",
    chartMeaning:
      "The line chart shows the debt stock trend for the selected country.",
  },
  GGXWDN_NGDP: {
    label: "General government gross debt, percent of GDP",
    unit: "% of GDP",
    description:
      "Gross government debt relative to GDP. This is a widely used debt-burden indicator for cross-country comparison.",
    mapMeaning:
      "Larger circles indicate countries with higher government debt burden relative to GDP.",
    chartMeaning:
      "The line chart shows whether the selected country's debt burden is increasing or decreasing.",
  },
  NGDP_RPCH: {
    label: "Real GDP growth",
    unit: "Annual percent change",
    description:
      "Annual growth rate of real GDP. It shows how fast an economy is expanding or contracting after adjusting for inflation.",
    mapMeaning:
      "Larger circles indicate countries with stronger latest real GDP growth rates.",
    chartMeaning:
      "The line chart shows the selected country's economic growth cycle over time.",
  },
  NGDPD: {
    label: "GDP, current prices",
    unit: "US dollars, billions",
    description:
      "Nominal GDP measured in current US dollars. It represents the current-size of an economy in dollar terms.",
    mapMeaning:
      "Larger circles indicate countries with larger latest nominal GDP in US dollars.",
    chartMeaning:
      "The line chart shows how the selected country's dollar GDP changes over time.",
  },
  NGDPDPC: {
    label: "GDP per capita, current prices",
    unit: "US dollars per person",
    description:
      "Nominal GDP divided by population. It is a broad income-level proxy in current US dollars.",
    mapMeaning:
      "Larger circles indicate countries with higher latest GDP per person.",
    chartMeaning:
      "The line chart shows the selected country's income-level trend over time.",
  },
  PCPIPCH: {
    label: "Inflation, average consumer prices",
    unit: "Annual percent change",
    description:
      "Average annual change in consumer prices. It is a standard measure of inflation pressure.",
    mapMeaning:
      "Larger circles indicate countries with higher latest average inflation rates.",
    chartMeaning:
      "The line chart shows inflation pressure in the selected country over time.",
  },
  LUR: {
    label: "Unemployment rate",
    unit: "% of labor force",
    description:
      "Share of the labor force that is unemployed. It helps assess labor-market stress.",
    mapMeaning:
      "Larger circles indicate countries with higher latest unemployment rates.",
    chartMeaning:
      "The line chart shows how unemployment changes over time in the selected country.",
  },
  LP: {
    label: "Population",
    unit: "Persons, millions",
    description:
      "Total population. It is useful for understanding market size, demographic scale, and per-capita context.",
    mapMeaning:
      "Larger circles indicate countries with larger latest population.",
    chartMeaning:
      "The line chart shows population growth or decline over time.",
  },
  BCA: {
    label: "Current account balance",
    unit: "US dollars, billions",
    description:
      "Balance of trade in goods, services, income, and transfers with the rest of the world.",
    mapMeaning:
      "Circle size is based on the absolute latest current-account balance. Tooltip values show surplus or deficit.",
    chartMeaning:
      "The line chart shows whether the selected country is moving toward external surplus or deficit.",
  },
  BCA_NGDPD: {
    label: "Current account balance, percent of GDP",
    unit: "% of GDP",
    description:
      "Current account balance relative to GDP. Positive values indicate external surplus; negative values indicate external deficit.",
    mapMeaning:
      "Circle size reflects the absolute current-account ratio. Tooltips show whether the position is surplus or deficit.",
    chartMeaning:
      "The line chart shows the external-balance trend relative to GDP.",
  },
  TX_RPCH: {
    label: "Exports of goods and services, volume growth",
    unit: "Annual percent change",
    description:
      "Annual growth in export volumes. It indicates real export-sector momentum.",
    mapMeaning:
      "Larger circles indicate countries with stronger latest export-volume growth.",
    chartMeaning:
      "The line chart shows export-volume growth over time for the selected country.",
  },
  TM_RPCH: {
    label: "Imports of goods and services, volume growth",
    unit: "Annual percent change",
    description:
      "Annual growth in import volumes. It can reflect domestic demand, investment needs, and import dependency.",
    mapMeaning:
      "Larger circles indicate countries with stronger latest import-volume growth.",
    chartMeaning:
      "The line chart shows import-volume growth over time for the selected country.",
  },
  NGSD_NGDP: {
    label: "National savings, percent of GDP",
    unit: "% of GDP",
    description:
      "National savings expressed as a share of GDP. It helps assess domestic savings capacity.",
    mapMeaning:
      "Larger circles indicate countries with higher savings relative to GDP.",
    chartMeaning:
      "The line chart shows how savings capacity changes over time.",
  },
  NID_NGDP: {
    label: "Investment, percent of GDP",
    unit: "% of GDP",
    description:
      "Total investment expressed as a share of GDP. It helps compare capital formation across countries.",
    mapMeaning:
      "Larger circles indicate countries with higher investment relative to GDP.",
    chartMeaning:
      "The line chart shows the investment-intensity trend for the selected country.",
  },
};

const FALLBACK_LABEL_BY_CODE = new Map(
  FALLBACK_INDICATORS.map((indicator) => [indicator.code, indicator.label]),
);

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
      mapMeaning: `Larger circles indicate countries with higher latest ${label.toLowerCase()} values.`,
      chartMeaning: `The line chart shows the selected country's ${label.toLowerCase()} trend over time.`,
    };
  }

  if (normalizedCode.endsWith("RPCH") || normalizedCode.endsWith("PCH")) {
    return {
      label,
      unit: "Annual percent change",
      description:
        "This IMF WEO indicator is an annual growth/change rate, useful for comparing momentum across countries and years.",
      mapMeaning: `Larger circles indicate countries with higher latest ${label.toLowerCase()} growth/change rates.`,
      chartMeaning: `The line chart shows the selected country's ${label.toLowerCase()} cycle over time.`,
    };
  }

  if (normalizedCode.endsWith("DPC") || normalizedCode.includes("PC")) {
    return {
      label,
      unit: "Per-capita value",
      description:
        "This IMF WEO indicator is shown on a per-person basis, making it easier to compare living-standard or intensity differences across countries.",
      mapMeaning: `Larger circles indicate countries with higher latest ${label.toLowerCase()} values.`,
      chartMeaning: `The line chart shows the selected country's ${label.toLowerCase()} trend over time.`,
    };
  }

  return {
    label,
    unit: "IMF WEO reported unit",
    description:
      "This indicator comes from the IMF World Economic Outlook dataset. Use the map for latest-value comparison and the line chart for historical country trend analysis.",
    mapMeaning: `Larger circles indicate countries with higher latest ${label.toLowerCase()} values.`,
    chartMeaning: `The line chart shows the selected country's ${label.toLowerCase()} trend over time.`,
  };
}

const COUNTRY_OPTIONS: CountryOption[] = (countries as RawCountry[])
  .map((country) => {
    const lat = Number(country.latlng?.[0]);
    const lng = Number(country.latlng?.[1]);

    return {
      iso3: String(country.cca3 || "").toUpperCase(),
      name: String(country.name?.common || country.name?.official || ""),
      region: String(country.region || "Other"),
      subregion: String(country.subregion || country.region || "Other"),
      lat,
      lng,
    };
  })
  .filter(
    (country) =>
      country.iso3.length === 3 &&
      country.name.length > 0 &&
      Number.isFinite(country.lat) &&
      Number.isFinite(country.lng) &&
      country.region.toLowerCase() !== "antarctic",
  )
  .sort((a, b) => a.name.localeCompare(b.name));

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

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function average(points: Point[]) {
  if (!points.length) return NaN;
  return points.reduce((sum, point) => sum + point.value, 0) / points.length;
}

function summarize(points: Point[]): CountrySummary {
  if (!points.length) {
    return {
      latest: NaN,
      min: NaN,
      max: NaN,
      average: NaN,
      points: 0,
    };
  }

  return {
    latest: points[points.length - 1].value,
    min: Math.min(...points.map((point) => point.value)),
    max: Math.max(...points.map((point) => point.value)),
    average: average(points),
    points: points.length,
  };
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

function getIndicatorLabel(indicators: IndicatorItem[], code: string) {
  const rawLabel =
    indicators.find((indicator) => indicator.code === code)?.label || code;
  return cleanIndicatorLabel(code, rawLabel);
}

function getCountryByIso3(iso3: string) {
  return COUNTRY_OPTIONS.find((country) => country.iso3 === iso3) || null;
}

async function fetchWeoSeries(
  iso3: string,
  indicator: string,
  signal?: AbortSignal,
): Promise<WeoResponse> {
  const response = await fetch(
    `/api/imf/weo/country?iso3=${encodeURIComponent(
      iso3,
    )}&indicator=${encodeURIComponent(indicator)}`,
    {
      cache: "no-store",
      signal,
    },
  );

  const json = (await response.json()) as WeoResponse;

  if (!response.ok || json.ok === false) {
    throw new Error(json.error || "Failed to load IMF WEO data");
  }

  return json;
}

function scaleRadius(point: MapPoint, maxAbs: number) {
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) return 6;

  const normalized = Math.sqrt(Math.abs(point.latestValue) / maxAbs);
  return Math.max(5, Math.min(30, 5 + normalized * 25));
}

const TimeSeriesTrendChart = memo(function TimeSeriesTrendChart({
  data,
}: {
  data: Point[];
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
          width={68}
          stroke="#CBD5E1"
          tick={{ fill: "#475569", fontSize: 11 }}
          tickFormatter={(value) => formatNumber(Number(value))}
        />
        <Tooltip
          formatter={(value) => [formatNumber(Number(value)), "Value"]}
          labelFormatter={(label) => `Year: ${label}`}
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
}: {
  data: RegionalRow[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 12, right: 12, left: 4, bottom: 76 }}
      >
        <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
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
          formatter={(value) => [formatNumber(Number(value)), "Average"]}
          labelFormatter={(label) => {
            const row = data.find((item) => item.iso3 === label);
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
        <Bar dataKey="average" fill="#4F46E5" radius={[10, 10, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

const LeafletPointMap = memo(function LeafletPointMap({
  mapPoints,
  selectedCountry,
  selectedIndicator,
  maxAbsMapValue,
  onCountrySelect,
}: {
  mapPoints: MapPoint[];
  selectedCountry: string;
  selectedIndicator: string;
  maxAbsMapValue: number;
  onCountrySelect: (iso3: string) => void;
}) {
  return (
    <MapContainer
      center={[20, 10]}
      zoom={2}
      minZoom={2}
      maxZoom={6}
      scrollWheelZoom
      className="h-full w-full"
      worldCopyJump
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {mapPoints.map((point) => {
        const active = point.iso3 === selectedCountry;

        return (
          <CircleMarker
            key={`${point.iso3}-${selectedIndicator}`}
            center={[point.lat, point.lng]}
            radius={scaleRadius(point, maxAbsMapValue)}
            pathOptions={{
              color: active ? "#4f46e5" : "#2563eb",
              fillColor: active ? "#7c3aed" : "#3b82f6",
              fillOpacity: active ? 0.76 : 0.42,
              opacity: 0.92,
              weight: active ? 3 : 1,
            }}
            eventHandlers={{
              click: () => onCountrySelect(point.iso3),
            }}
          >
            <LeafletTooltip direction="top" opacity={1} sticky>
              <div className="min-w-[170px]">
                <div className="text-sm font-black text-slate-950">
                  {point.name} ({point.iso3})
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-600">
                  {selectedIndicator}: {formatNumber(point.latestValue)}
                </div>
                <div className="text-xs text-slate-500">
                  Latest year: {point.latestYear}
                </div>
                <div className="text-xs text-slate-500">
                  Average: {formatNumber(point.average)}
                </div>
              </div>
            </LeafletTooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
});

export default function IMFWeoDashboardPage() {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedIndicator, setSelectedIndicator] = useState(DEFAULT_INDICATOR);
  const [countryQuery, setCountryQuery] = useState("");
  const [indicatorQuery, setIndicatorQuery] = useState("");
  const [indicators, setIndicators] =
    useState<IndicatorItem[]>(FALLBACK_INDICATORS);
  const [seriesPayload, setSeriesPayload] = useState<WeoResponse | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState("");
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapProgress, setMapProgress] = useState(0);
  const [mapError, setMapError] = useState("");
  const [mapReadyIndicator, setMapReadyIndicator] = useState("");

  const country = useMemo(
    () => (selectedCountry ? getCountryByIso3(selectedCountry) : null),
    [selectedCountry],
  );

  const filteredCountries = useMemo(() => {
    const query = countryQuery.trim().toLowerCase();
    if (!query) return COUNTRY_OPTIONS;

    return COUNTRY_OPTIONS.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.iso3.toLowerCase().includes(query) ||
        item.region.toLowerCase().includes(query) ||
        item.subregion.toLowerCase().includes(query),
    );
  }, [countryQuery]);

  const filteredIndicators = useMemo(() => {
    const query = indicatorQuery.trim().toLowerCase();
    if (!query) return indicators;

    return indicators.filter(
      (item) =>
        item.code.toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query),
    );
  }, [indicatorQuery, indicators]);

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

  const maxAbsMapValue = useMemo(() => {
    return Math.max(
      ...mapPoints
        .map((point) => Math.abs(point.latestValue))
        .filter(Number.isFinite),
      0,
    );
  }, [mapPoints]);

  const selectedMapPoint = useMemo(() => {
    if (!selectedCountry) return null;
    return mapPoints.find((point) => point.iso3 === selectedCountry) || null;
  }, [mapPoints, selectedCountry]);

  const regionalRows = useMemo(() => {
    if (!country) return [];

    const rows = mapPoints
      .filter(
        (point) =>
          point.region === country.region && Number.isFinite(point.average),
      )
      .map((point) => ({
        iso3: point.iso3,
        country: point.name,
        average: point.average,
        selected: point.iso3 === selectedCountry,
      }))
      .sort((a, b) => {
        if (a.iso3 === selectedCountry) return -1;
        if (b.iso3 === selectedCountry) return 1;
        return Math.abs(b.average) - Math.abs(a.average);
      });

    return rows.slice(0, 18);
  }, [country, mapPoints, selectedCountry]);

  const regionAverage = useMemo(() => {
    if (!country) return NaN;

    const peers = mapPoints.filter(
      (point) =>
        point.region === country.region &&
        point.iso3 !== selectedCountry &&
        Number.isFinite(point.average),
    );

    if (!peers.length) return NaN;
    return peers.reduce((sum, point) => sum + point.average, 0) / peers.length;
  }, [country, mapPoints, selectedCountry]);

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

        if (json.ok === false) {
          setIndicators(FALLBACK_INDICATORS);
          return;
        }

        setIndicators(normalizeIndicators(json.indicators));
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

    async function loadMapPoints() {
      try {
        setMapLoading(true);
        setMapError("");
        setMapPoints([]);
        setMapProgress(0);
        setMapReadyIndicator("");
        setSeriesPayload(null);
        setSeriesError("");

        const collected: MapPoint[] = [];

        for (let i = 0; i < COUNTRY_OPTIONS.length; i += MAP_BATCH_SIZE) {
          if (controller.signal.aborted) return;

          const batch = COUNTRY_OPTIONS.slice(i, i + MAP_BATCH_SIZE);

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
              } satisfies MapPoint;
            }),
          );

          for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
              collected.push(result.value);
            }
          }

          setMapProgress(
            Math.min(
              100,
              Math.round(((i + batch.length) / COUNTRY_OPTIONS.length) * 100),
            ),
          );
        }

        if (controller.signal.aborted) return;

        setMapPoints(collected);
        setMapReadyIndicator(selectedIndicator);
      } catch (error) {
        if (controller.signal.aborted) return;
        setMapError(
          error instanceof Error ? error.message : "Failed to load map points",
        );
      } finally {
        if (!controller.signal.aborted) setMapLoading(false);
      }
    }

    loadMapPoints();

    return () => controller.abort();
  }, [selectedIndicator]);

  useEffect(() => {
    if (!selectedCountry) {
      setSeriesPayload(null);
      setSeriesError("");
      setSeriesLoading(false);
      return;
    }

    if (mapReadyIndicator !== selectedIndicator) return;

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

        setSeriesPayload(payload);
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
  }, [mapReadyIndicator, selectedCountry, selectedIndicator]);

  const handleCountryChange = useCallback((nextIso3: string) => {
    const normalized = nextIso3.trim().toUpperCase();
    setSelectedCountry(normalized);
  }, []);

  function handleIndicatorChange(nextIndicator: string) {
    const normalized = nextIndicator.trim().toUpperCase();
    if (!normalized) return;
    setSelectedIndicator(normalized);
  }

  const canRenderSeries = Boolean(
    selectedCountry && seriesPoints.length && !seriesLoading,
  );
  const selectedCountryLabel = country?.name || "Select country";
  const selectedRegionLabel = country
    ? `${country.iso3} · ${country.region}`
    : "Click map point or use dropdown";

  return (
    <div className="min-h-screen bg-[#eef3fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">
                IMF World Economic Outlook
              </div>
              <h1 className="mt-2 text-[30px] font-black tracking-tight text-slate-950 md:text-[36px]">
                WEO country intelligence dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
                Countries are shown on the map with point size scaled by the
                latest available value of the selected IMF indicator. The
                time-series chart loads only after a country is selected.
              </p>
              <div className="mt-3 inline-flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-2 text-sm font-semibold text-slate-700">
                <span className="text-violet-700">Current indicator:</span>
                <span className="font-black text-slate-950">
                  {selectedIndicatorGuide.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-violet-700">
                  {selectedIndicator}
                </span>
                <span className="text-slate-500">
                  · {selectedIndicatorGuide.unit}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[680px]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                  Country
                </label>
                <input
                  value={countryQuery}
                  onChange={(event) => setCountryQuery(event.target.value)}
                  placeholder="Search country / ISO3 / region..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                />
                <select
                  value={selectedCountry}
                  onChange={(event) => handleCountryChange(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-violet-400"
                >
                  <option value="">Select a country...</option>
                  {filteredCountries.map((item) => (
                    <option key={item.iso3} value={item.iso3}>
                      {item.name} ({item.iso3})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                  IMF indicator
                </label>
                <input
                  value={indicatorQuery}
                  onChange={(event) => setIndicatorQuery(event.target.value)}
                  placeholder="Search code / indicator..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400"
                />
                <select
                  value={selectedIndicator}
                  onChange={(event) =>
                    handleIndicatorChange(event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-violet-400"
                >
                  {filteredIndicators.map((item) => (
                    <option key={item.code} value={item.code}>
                      {buildIndicatorGuide(item.code, item.label).label} (
                      {item.code})
                    </option>
                  ))}
                </select>
              </div>
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
              Latest
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {!selectedCountry || seriesLoading
                ? "—"
                : formatNumber(summary.latest)}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {seriesPoints.length
                ? seriesPoints[seriesPoints.length - 1].year
                : "Select country"}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Country average
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {!selectedCountry || seriesLoading
                ? "—"
                : formatNumber(summary.average)}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {selectedCountry
                ? `${summary.points} data points`
                : "Awaiting selection"}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Regional avg
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {selectedCountry ? formatNumber(regionAverage) : "—"}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {country ? `${country.region} peers` : "Select country"}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950">
                  Map
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Point size is scaled by the latest available value of{" "}
                  <span className="font-black text-slate-800">
                    {selectedIndicatorGuide.label}
                  </span>{" "}
                  ({selectedIndicator}). Click a point to select a country and
                  plot its time-series.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Map coverage
                </div>
                <div className="text-sm font-black text-slate-900">
                  {mapPoints.length} countries
                  {mapLoading ? ` · ${mapProgress}%` : ""}
                </div>
              </div>
            </div>

            <div className="mb-4 grid gap-3 rounded-[24px] border border-violet-100 bg-gradient-to-r from-violet-50 to-blue-50 p-4 md:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
                    Indicator explained
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-violet-700 shadow-sm">
                    {selectedIndicator}
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                  {selectedIndicatorGuide.label}
                </h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                  {selectedIndicatorGuide.description}
                </p>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="rounded-2xl bg-white/85 px-3 py-2 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Unit
                  </div>
                  <div className="mt-0.5 font-black text-slate-800">
                    {selectedIndicatorGuide.unit}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/85 px-3 py-2 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    How to read the map
                  </div>
                  <div className="mt-0.5 font-semibold leading-5 text-slate-700">
                    {selectedIndicatorGuide.mapMeaning}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative h-[520px] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
              <LeafletPointMap
                mapPoints={mapPoints}
                selectedCountry={selectedCountry}
                selectedIndicator={selectedIndicator}
                maxAbsMapValue={maxAbsMapValue}
                onCountrySelect={handleCountryChange}
              />

              {mapLoading ? (
                <div className="absolute inset-x-4 top-4 z-[500] rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm font-black text-slate-700">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
                      Loading map point values for {selectedIndicator}...
                    </div>
                    <div className="text-sm font-black text-violet-700">
                      {mapProgress}%
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-all"
                      style={{ width: `${mapProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {!mapLoading && !mapPoints.length ? (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center shadow-sm">
                    <div className="text-sm font-black text-amber-900">
                      No point-map data found
                    </div>
                    <div className="mt-1 text-xs font-semibold text-amber-700">
                      Try another IMF indicator from the dropdown.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {mapError ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {mapError}
              </div>
            ) : null}
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Time-series trend
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {country
                  ? `${country.name} · ${selectedIndicatorLabel}`
                  : "Select a country to plot the line chart"}
              </p>
            </div>

            {!selectedCountry ? (
              <div className="flex h-[520px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center">
                <div>
                  <div className="text-lg font-black text-slate-900">
                    Select a country first
                  </div>
                  <p className="mt-2 max-w-[360px] text-sm font-semibold text-slate-500">
                    Use the country dropdown or click any map point. The chart
                    will be fetched and plotted only after country selection.
                  </p>
                </div>
              </div>
            ) : mapReadyIndicator !== selectedIndicator || mapLoading ? (
              <div className="flex h-[520px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
                  <div className="mt-3 text-sm font-black text-slate-700">
                    Preparing map values first...
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    The line chart will load once the point map is ready.
                  </p>
                </div>
              </div>
            ) : seriesLoading ? (
              <div className="flex h-[520px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3 text-sm font-black text-slate-600">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
                  Loading WEO series...
                </div>
              </div>
            ) : seriesError ? (
              <div className="flex h-[520px] items-center justify-center rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-center">
                <div>
                  <div className="text-lg font-black text-amber-900">
                    No series loaded
                  </div>
                  <p className="mt-2 text-sm font-semibold text-amber-700">
                    {seriesError}
                  </p>
                </div>
              </div>
            ) : canRenderSeries ? (
              <div className="h-[520px] rounded-[28px] border border-slate-100 bg-slate-50/70 p-3">
                <TimeSeriesTrendChart data={seriesPoints} />
              </div>
            ) : (
              <div className="flex h-[520px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center">
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
                {country
                  ? `Average value of ${selectedIndicator} for ${country.name} compared with countries in ${country.region}. The selected country is placed first.`
                  : `Select a country to compare ${selectedIndicator} against its regional peers.`}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Indicator
              </div>
              <div className="max-w-[420px] truncate text-sm font-black text-slate-900">
                {selectedIndicatorLabel}
              </div>
            </div>
          </div>

          {country && regionalRows.length ? (
            <div className="h-[430px] rounded-[28px] border border-slate-100 bg-slate-50/70 p-3">
              <RegionalAverageChart data={regionalRows} />
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center">
              <div>
                <div className="text-base font-black text-slate-900">
                  Regional comparison pending
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Select a country after the point map loads.
                </p>
              </div>
            </div>
          )}

          {selectedMapPoint ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              Map latest value for {selectedMapPoint.name}:{" "}
              {formatNumber(selectedMapPoint.latestValue)} (
              {selectedMapPoint.latestYear})
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
