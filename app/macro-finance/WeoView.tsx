"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  country: string;
  countryName: string;
  referenceYear: number;
  refreshTick: number;
};

type WeoPoint = {
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

type WeoMetaResponse = {
  ok?: boolean;
  indicators?: unknown[];
  vintages?: unknown[];
  error?: string;
};

const FALLBACK_INDICATORS: IndicatorItem[] = [
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
  { code: "GGR", label: "General government revenue" },
  { code: "GGR_NGDP", label: "General government revenue, percent of GDP" },
  { code: "GGX", label: "General government total expenditure" },
  { code: "GGX_NGDP", label: "General government expenditure, percent of GDP" },
  { code: "GGXCNL", label: "General government net lending / borrowing" },
  { code: "GGXCNL_NGDP", label: "Net lending / borrowing, percent of GDP" },
  { code: "GGXONLB", label: "General government overall balance" },
  { code: "GGXONLB_NGDP", label: "Overall balance, percent of GDP" },
  { code: "GGXWDN", label: "General government gross debt" },
  { code: "GGXWDN_NGDP", label: "General government gross debt, percent of GDP" },
];

const QUICK_PICKS = [
  "NGDP_RPCH",
  "PCPIPCH",
  "LUR",
  "NGDPDPC",
  "BCA_NGDPD",
  "GGXONLB_NGDP",
  "GGXWDN_NGDP",
  "NGSD_NGDP",
];

const GUIDES: Record<string, IndicatorGuide> = {
  NGDP_RPCH: {
    label: "Real GDP growth",
    unit: "Annual percent change",
    description:
      "Annual growth rate of real GDP. It shows how fast the economy is expanding or contracting after adjusting for inflation.",
  },
  NGDPD: {
    label: "GDP, current prices",
    unit: "US dollars, billions",
    description:
      "Nominal GDP measured at current prices. It gives a broad view of the current size of the economy.",
  },
  NGDPDPC: {
    label: "GDP per capita, current prices",
    unit: "US dollars per person",
    description:
      "Nominal GDP divided by population. It is a broad indicator of economic output per person.",
  },
  PCPIPCH: {
    label: "Inflation, average consumer prices",
    unit: "Annual percent change",
    description:
      "Average annual change in consumer prices. It is a standard measure of inflation pressure.",
  },
  LUR: {
    label: "Unemployment rate",
    unit: "% of labor force",
    description:
      "Share of the labor force that is unemployed. Higher values generally indicate greater labor-market stress.",
  },
  LP: {
    label: "Population",
    unit: "Persons, millions",
    description:
      "Total population reported by IMF WEO. It provides demographic scale for economic analysis.",
  },
  BCA: {
    label: "Current account balance",
    unit: "US dollars, billions",
    description:
      "Balance of trade in goods, services, income and transfers with the rest of the world.",
  },
  BCA_NGDPD: {
    label: "Current account balance, percent of GDP",
    unit: "% of GDP",
    description:
      "Current account balance relative to GDP. Positive values indicate an external surplus and negative values indicate an external deficit.",
  },
  TX_RPCH: {
    label: "Exports of goods and services, volume growth",
    unit: "Annual percent change",
    description:
      "Annual growth in export volumes. It indicates real export-sector momentum.",
  },
  TM_RPCH: {
    label: "Imports of goods and services, volume growth",
    unit: "Annual percent change",
    description:
      "Annual growth in import volumes. It can reflect domestic demand, investment needs and import dependency.",
  },
  NGSD_NGDP: {
    label: "National savings, percent of GDP",
    unit: "% of GDP",
    description:
      "National savings expressed as a share of GDP. It helps assess domestic savings capacity.",
  },
  NID_NGDP: {
    label: "Investment, percent of GDP",
    unit: "% of GDP",
    description:
      "Total investment expressed as a share of GDP. It helps assess capital formation and investment intensity.",
  },
  GGR: {
    label: "General government revenue",
    unit: "National currency, current prices",
    description:
      "Total revenue received by general government, including taxes, social contributions, grants and other revenue.",
  },
  GGR_NGDP: {
    label: "General government revenue, percent of GDP",
    unit: "% of GDP",
    description:
      "Government revenue as a share of GDP. This is more suitable for cross-country comparison than revenue in local currency.",
  },
  GGX: {
    label: "General government total expenditure",
    unit: "National currency, current prices",
    description:
      "Total spending by general government, including current and capital expenditure.",
  },
  GGX_NGDP: {
    label: "General government expenditure, percent of GDP",
    unit: "% of GDP",
    description:
      "Government expenditure expressed as a share of GDP. It shows the relative size of public spending.",
  },
  GGXCNL: {
    label: "General government net lending / borrowing",
    unit: "National currency, current prices",
    description:
      "Fiscal balance in absolute terms. Positive values generally indicate net lending or surplus; negative values indicate net borrowing or deficit.",
  },
  GGXCNL_NGDP: {
    label: "General government net lending / borrowing, percent of GDP",
    unit: "% of GDP",
    description:
      "Fiscal balance as a share of GDP. Positive values generally indicate surplus and negative values indicate deficit.",
  },
  GGXONLB: {
    label: "General government overall balance",
    unit: "National currency, current prices",
    description:
      "Overall government balance in absolute terms, used to analyze fiscal surplus or deficit.",
  },
  GGXONLB_NGDP: {
    label: "General government overall balance, percent of GDP",
    unit: "% of GDP",
    description:
      "Overall government balance as a share of GDP. It is a compact measure of fiscal surplus or deficit relative to the economy.",
  },
  GGXWDN: {
    label: "General government gross debt",
    unit: "National currency, current prices",
    description:
      "Total gross debt liabilities of the general government sector.",
  },
  GGXWDN_NGDP: {
    label: "General government gross debt, percent of GDP",
    unit: "% of GDP",
    description:
      "Gross government debt relative to GDP. It is a widely used indicator of sovereign debt burden.",
  },
};

function genericGuide(code: string, label: string): IndicatorGuide {
  if (code.endsWith("_NGDP") || code.endsWith("_NGDPD")) {
    return {
      label,
      unit: "% of GDP",
      description:
        "This IMF WEO indicator is expressed as a share of GDP, making it useful for comparing values across economies of different sizes.",
    };
  }

  if (code.endsWith("RPCH") || code.endsWith("PCH")) {
    return {
      label,
      unit: "Annual percent change",
      description:
        "This IMF WEO indicator measures annual growth or change and is useful for tracking economic momentum over time.",
    };
  }

  if (code.endsWith("DPC") || code.includes("PC")) {
    return {
      label,
      unit: "Per-capita value",
      description:
        "This IMF WEO indicator is reported on a per-person basis and helps compare economic intensity or living-standard proxies.",
    };
  }

  return {
    label,
    unit: "IMF WEO reported unit",
    description:
      "This indicator comes from the IMF World Economic Outlook dataset and is shown here for the selected country across the available WEO time series.",
  };
}

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeIndicators(rows: unknown): IndicatorItem[] {
  const unique = new Map<string, IndicatorItem>();

  for (const item of FALLBACK_INDICATORS) {
    unique.set(item.code, item);
  }

  if (Array.isArray(rows)) {
    for (const row of rows) {
      const item = (row ?? {}) as Record<string, unknown>;

      const code = cleanText(
        item.code ??
          item.indicator_code ??
          item.indicator ??
          item.weo_code ??
          item.subject_code ??
          item.weo_subject_code,
      ).toUpperCase();

      if (!code) continue;

      const label =
        cleanText(
          item.label ??
            item.indicator_label ??
            item.description ??
            item.subject_descriptor ??
            item.name,
        ) ||
        GUIDES[code]?.label ||
        unique.get(code)?.label ||
        code;

      unique.set(code, { code, label });
    }
  }

  return Array.from(unique.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

function normalizePoints(payload: WeoResponse | null): WeoPoint[] {
  return (payload?.points ?? [])
    .map((point) => ({
      year: Number(point.year),
      value: Number(point.value),
    }))
    .filter(
      (point) => Number.isFinite(point.year) && Number.isFinite(point.value),
    )
    .sort((a, b) => a.year - b.year);
}

function exactOrPrior(points: WeoPoint[], year: number) {
  if (!points.length) return null;
  const exact = points.find((point) => point.year === year);
  if (exact) return exact;
  return [...points].reverse().find((point) => point.year <= year) ?? points[points.length - 1];
}

function resolvedUnit(payload: WeoResponse | null, fallback: string) {
  const apiUnit = [
    payload?.unit_label,
    payload?.unit,
    payload?.uom,
    payload?.scale,
  ]
    .map(cleanText)
    .find(Boolean);

  return apiUnit || fallback;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  const abs = Math.abs(value);
  const digits = abs >= 100 ? 1 : abs >= 10 ? 2 : 3;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatValue(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  const formatted = formatNumber(value);
  const normalized = unit.toLowerCase();

  if (normalized.includes("percent") || normalized.includes("%")) {
    return `${formatted}%`;
  }

  if (normalized.includes("us dollars, billions")) {
    return `$${formatted} bn`;
  }

  if (normalized.includes("persons, millions")) {
    return `${formatted}m`;
  }

  if (normalized === "us$" || normalized.includes("us dollars per person")) {
    return `$${formatted}`;
  }

  return formatted;
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{meta}</div>
    </div>
  );
}

export default function WeoView({
  country,
  countryName,
  referenceYear,
  refreshTick,
}: Props) {
  const [indicators, setIndicators] =
    useState<IndicatorItem[]>(FALLBACK_INDICATORS);
  const [selectedCode, setSelectedCode] = useState("NGDP_RPCH");
  const [payload, setPayload] = useState<WeoResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setMetaLoading(true);

    fetch("/api/imf/weo/meta", { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json()) as WeoMetaResponse;
        if (!response.ok || json.ok === false) {
          throw new Error(json.error || "Unable to load WEO indicator metadata.");
        }
        if (alive) {
          setIndicators(normalizeIndicators(json.indicators));
        }
      })
      .catch(() => {
        if (alive) setIndicators(FALLBACK_INDICATORS);
      })
      .finally(() => {
        if (alive) setMetaLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    setLoading(true);
    setError(null);

    fetch(
      `/api/imf/weo/country?iso3=${encodeURIComponent(
        country,
      )}&indicator=${encodeURIComponent(selectedCode)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const json = (await response.json()) as WeoResponse;
        if (!response.ok || json.ok === false) {
          throw new Error(json.error || "Unable to load IMF WEO data.");
        }
        if (alive) setPayload(json);
      })
      .catch((err) => {
        if (!alive || err?.name === "AbortError") return;
        setPayload(null);
        setError(err instanceof Error ? err.message : "Unable to load IMF WEO data.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [country, selectedCode, refreshTick]);

  const points = useMemo(() => normalizePoints(payload), [payload]);
  const selectedMeta =
    indicators.find((item) => item.code === selectedCode) ??
    FALLBACK_INDICATORS.find((item) => item.code === selectedCode);

  const rawLabel =
    payload?.indicator_label || selectedMeta?.label || selectedCode;

  const guide = GUIDES[selectedCode] ?? genericGuide(selectedCode, rawLabel);
  const unit = resolvedUnit(payload, guide.unit);
  const referencePoint = exactOrPrior(points, referenceYear);
  const latestPoint = points.length ? points[points.length - 1] : null;
  const average = points.length
    ? points.reduce((sum, point) => sum + point.value, 0) / points.length
    : null;

  const quickItems = QUICK_PICKS.map((code) => {
    const item =
      indicators.find((indicator) => indicator.code === code) ??
      FALLBACK_INDICATORS.find((indicator) => indicator.code === code);
    return item ? { code, label: GUIDES[code]?.label || item.label } : null;
  }).filter(Boolean) as IndicatorItem[];

  const downloadCsv = () => {
    if (!points.length) return;

    const rows = [
      ["country", "iso3", "indicator", "indicator_code", "unit", "vintage", "year", "value"],
      ...points.map((point) => [
        countryName,
        country,
        guide.label,
        selectedCode,
        unit,
        payload?.vintage ?? "",
        String(point.year),
        String(point.value),
      ]),
    ];

    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `imf_weo_${country}_${selectedCode}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600">
              IMF World Economic Outlook
            </div>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
              WEO indicators
            </h2>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
              IMF WEO macroeconomic, fiscal, external-sector and labor indicators are now part of Macro &amp; Finance.
            </p>
          </div>

          <label className="block w-full xl:w-[390px]">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              IMF WEO indicator
            </span>
            <select
              value={selectedCode}
              onChange={(event) => setSelectedCode(event.target.value)}
              disabled={metaLoading}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:cursor-wait"
            >
              {indicators.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.code})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickItems.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setSelectedCode(item.code)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                selectedCode === item.code
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
              <div>
                <div className="text-sm font-black text-slate-800">
                  Loading IMF WEO data
                </div>
                <div className="mt-0.5 text-xs font-medium text-slate-500">
                  {countryName} - {guide.label}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="text-sm font-black text-rose-800">WEO data could not be loaded</div>
          <div className="mt-1 text-xs font-medium text-rose-700">{error}</div>
        </section>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={`Reference year ${referenceYear}`}
              value={formatValue(referencePoint?.value, unit)}
              meta={
                referencePoint
                  ? referencePoint.year === referenceYear
                    ? "Exact WEO observation"
                    : `Nearest prior: ${referencePoint.year}`
                  : "No observation"
              }
            />
            <StatCard
              label="Latest WEO point"
              value={formatValue(latestPoint?.value, unit)}
              meta={latestPoint ? `Year ${latestPoint.year}` : "No observation"}
            />
            <StatCard
              label="Series average"
              value={formatValue(average, unit)}
              meta={points.length ? `${points.length} observations` : "No observations"}
            />
            <StatCard
              label="WEO vintage"
              value={payload?.vintage || "Latest"}
              meta="IMF World Economic Outlook"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-black tracking-tight text-slate-950">
                      {guide.label}
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {countryName} - {unit}
                    </p>
                  </div>
                  <span className="w-fit rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700 ring-1 ring-indigo-100">
                    {selectedCode}
                  </span>
                </div>
              </div>

              <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                  What it means
                </div>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-600">
                  {guide.description}
                </p>
              </div>

              <div className="h-[390px] px-2 pb-3 pt-4 sm:px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 18, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                      tickFormatter={(value: any) => formatNumber(Number(value))}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        formatValue(Number(value), unit),
                        guide.label,
                      ]}
                      labelFormatter={(label: any) => `Year ${label}`}
                    />
                    <Line
                      connectNulls
                      type="monotone"
                      dataKey="value"
                      stroke="#4f46e5"
                      strokeWidth={2.75}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-950">
                    Historical records
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    {guide.label} - {unit}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCsv}
                  disabled={!points.length}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  CSV
                </button>
              </div>

              <div className="max-h-[500px] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Year</th>
                      <th className="px-4 py-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {[...points].reverse().map((point) => (
                      <tr
                        key={point.year}
                        className={`transition hover:bg-slate-50 ${
                          point.year === referencePoint?.year ? "bg-indigo-50/60" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-600">
                          {point.year}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-black tabular-nums text-slate-950">
                          {formatValue(point.value, unit)}
                        </td>
                      </tr>
                    ))}

                    {!points.length ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                        >
                          No WEO records are available for this indicator.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
                  Source
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  IMF World Economic Outlook (WEO)
                </div>
              </div>
              <div className="text-right text-xs font-semibold text-slate-500">
                {indicators.length} indicators available
                {payload?.vintage ? ` - vintage ${payload.vintage}` : ""}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}