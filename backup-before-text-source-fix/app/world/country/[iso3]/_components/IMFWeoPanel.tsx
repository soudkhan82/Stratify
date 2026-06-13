"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Point = {
  year: number;
  value: number;
};

type ApiResponse = {
  ok?: boolean;
  iso3?: string;
  country?: string;
  indicator?: string;
  indicator_code?: string;
  indicator_label?: string;
  label?: string;
  vintage?: string;
  points?: Point[];
  series?: Point[];
  data?: Point[];
  error?: string;
};

type Props = {
  iso3: string;
  initialIndicator?: string;
};

type IndicatorItem = {
  code: string;
  label: string;
};

const QUICK_PICKS: IndicatorItem[] = [
  { code: "NGDP_RPCH", label: "GDP growth" },
  { code: "NGDPD", label: "GDP, current prices" },
  { code: "PCPIPCH", label: "Inflation" },
  { code: "LUR", label: "Unemployment" },
  { code: "BCA_NGDPD", label: "Current account balance" },
  { code: "GGXONLB_NGDP", label: "Govt net lending/borrowing" },
  { code: "LP", label: "Population" },
  { code: "NGDPDPC", label: "GDP per capita" },
];

const IMF_INDICATORS: IndicatorItem[] = [
  { code: "NGDP_RPCH", label: "GDP growth" },
  { code: "NGDPD", label: "GDP, current prices" },
  { code: "NGDP_R", label: "GDP, constant prices" },
  { code: "NGDPDPC", label: "GDP per capita, current prices" },
  { code: "PPPGDP", label: "GDP, PPP" },
  { code: "PPPPC", label: "GDP per capita, PPP" },
  { code: "LP", label: "Population" },
  { code: "LUR", label: "Unemployment rate" },
  { code: "LE", label: "Employment" },
  { code: "PCPIPCH", label: "Inflation, average consumer prices" },
  { code: "PCPIEPCH", label: "Inflation, end of period consumer prices" },
  { code: "TM_RPCH", label: "Imports of goods and services, volume growth" },
  { code: "TX_RPCH", label: "Exports of goods and services, volume growth" },
  { code: "TMG_RPCH", label: "Imports of goods, volume growth" },
  { code: "TXG_RPCH", label: "Exports of goods, volume growth" },
  { code: "BCA", label: "Current account balance" },
  { code: "BCA_NGDPD", label: "Current account balance, percent of GDP" },
  { code: "GGX", label: "General government total expenditure" },
  { code: "GGR", label: "General government revenue" },
  { code: "GGXCNL", label: "Net lending/borrowing" },
  { code: "GGXONLB", label: "Overall net lending/borrowing" },
  {
    code: "GGXONLB_NGDP",
    label: "Overall net lending/borrowing, percent of GDP",
  },
  { code: "GGXWDN", label: "Gross debt" },
  { code: "GGXWDN_NGDP", label: "Gross debt, percent of GDP" },
  { code: "GGXWDG", label: "Net debt" },
  { code: "GGXWDG_NGDP", label: "Net debt, percent of GDP" },
  { code: "NGSD_NGDP", label: "National savings, percent of GDP" },
  { code: "NID_NGDP", label: "Investment, percent of GDP" },
  { code: "LUR_PT", label: "Unemployment rate, percent" },
  { code: "PPPEX", label: "PPP exchange rate" },
  { code: "NGDP_FY", label: "Fiscal year GDP" },
  {
    code: "PCPIFBT",
    label: "Inflation, average consumer prices excl. food and energy",
  },
  { code: "PCPI", label: "Consumer prices index" },
  { code: "GGR_NGDP", label: "Revenue, percent of GDP" },
  { code: "GGX_NGDP", label: "Expenditure, percent of GDP" },
  { code: "GGXCNL_NGDP", label: "Net lending/borrowing, percent of GDP" },
  { code: "TXG_FOB_USD", label: "Exports of goods, USD" },
  { code: "TMG_CIF_USD", label: "Imports of goods, USD" },
  { code: "TXGSBOP", label: "Exports of goods and services, BOP" },
  { code: "TMGSBOP", label: "Imports of goods and services, BOP" },
  { code: "TXG", label: "Exports of goods" },
  { code: "TMG", label: "Imports of goods" },
  { code: "GGCB", label: "Government cash balance" },
  { code: "GGSB", label: "Government structural balance" },
  { code: "NGDPRPPPPC", label: "Real GDP per capita, PPP" },
  { code: "PPPSH", label: "Share of world GDP at PPP" },
  { code: "NGDPDUS", label: "GDP, current prices, USD" },
  { code: "LNNGDP", label: "Nominal GDP level" },
];

function normalizePoints(payload: ApiResponse): Point[] {
  const raw = payload.points || payload.series || payload.data || [];
  return raw
    .map((d: any) => ({
      year: Number(d.year),
      value: Number(d.value),
    }))
    .filter((d) => Number.isFinite(d.year) && Number.isFinite(d.value))
    .sort((a, b) => a.year - b.year);
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getIndicatorLabel(code: string) {
  return IMF_INDICATORS.find((x) => x.code === code)?.label || code;
}

export default function IMFWeoPanel({ iso3, initialIndicator }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dataset = searchParams.get("dataset") || "weo";
  const rawIndicator = searchParams.get("indicator") || initialIndicator || "";
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ApiResponse | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState("");

  const selectedIndicator = useMemo(() => {
    const code = String(rawIndicator || "")
      .trim()
      .toUpperCase();
    return IMF_INDICATORS.some((x) => x.code === code) ? code : "NGDPD";
  }, [rawIndicator]);

  const filteredIndicators = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return IMF_INDICATORS;
    return IMF_INDICATORS.filter(
      (x) =>
        x.code.toLowerCase().includes(q) || x.label.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (dataset !== "weo") return;

    const current = String(rawIndicator || "")
      .trim()
      .toUpperCase();

    if (!current || !IMF_INDICATORS.some((x) => x.code === current)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("dataset", "weo");
      params.set("indicator", "NGDPD");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [dataset, rawIndicator, pathname, router, searchParams]);

  useEffect(() => {
    if (dataset !== "weo") return;
    if (!iso3 || !selectedIndicator) return;

    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          `/api/imf/weo/country?iso3=${encodeURIComponent(
            iso3,
          )}&indicator=${encodeURIComponent(selectedIndicator)}`,
          { cache: "no-store" },
        );

        const json: ApiResponse = await res.json();

        if (!active) return;

        const normalized = normalizePoints(json);

        setPayload(json);
        setPoints(normalized);

        if (!res.ok) {
          setError(json.error || "Failed to load WEO series.");
          return;
        }

        if (!normalized.length) {
          setError("No WEO data found for this country/indicator.");
        }
      } catch (err) {
        if (!active) return;
        setError("Failed to load WEO data.");
        setPayload(null);
        setPoints([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [dataset, iso3, selectedIndicator]);

  function updateIndicator(code: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dataset", "weo");
    params.set("indicator", code);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const latest = points.length ? points[points.length - 1].value : NaN;
  const minVal = points.length ? Math.min(...points.map((p) => p.value)) : NaN;
  const maxVal = points.length ? Math.max(...points.map((p) => p.value)) : NaN;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-7">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            Control Panel
          </div>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">Indicators</h2>
          <p className="mt-2 text-[15px] text-slate-500">
            Search, select and jump between IMF WEO indicators.
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Indicator search
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code / name..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active indicator
            </div>
            <div className="mt-3 text-[15px] font-semibold text-slate-900">
              {getIndicatorLabel(selectedIndicator)}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {selectedIndicator}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Quick picks
              </h3>
              <span className="text-sm text-slate-500">
                {QUICK_PICKS.length} items
              </span>
            </div>

            <div className="space-y-3">
              {QUICK_PICKS.map((item) => {
                const active = item.code === selectedIndicator;
                return (
                  <button
                    key={item.code}
                    onClick={() => updateIndicator(item.code)}
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-900 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                  >
                    <div className="font-semibold">{item.label}</div>
                    <div
                      className={`mt-1 text-sm ${
                        active ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {item.code}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                All IMF indicators
              </h3>
              <span className="text-sm text-slate-500">
                {filteredIndicators.length} items
              </span>
            </div>

            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-2">
              {filteredIndicators.map((item) => {
                const active = item.code === selectedIndicator;
                return (
                  <button
                    key={item.code}
                    onClick={() => updateIndicator(item.code)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-900 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                  >
                    <div className="font-medium">{item.label}</div>
                    <div
                      className={`mt-1 text-xs ${
                        active ? "text-indigo-100" : "text-slate-500"
                      }`}
                    >
                      {item.code}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <section className="space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            IMF — World Economic Outlook (WEO)
          </h1>
          <div className="mt-2 text-lg text-slate-500">{selectedIndicator}</div>

          <div className="mt-5 flex flex-wrap gap-3">
            {QUICK_PICKS.map((item) => {
              const active = item.code === selectedIndicator;
              return (
                <button
                  key={item.code}
                  onClick={() => updateIndicator(item.code)}
                  className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              <div className="text-lg font-semibold text-slate-700">
                Loading WEO data...
              </div>
            </div>
          </div>
        ) : error && !points.length ? (
          <div className="rounded-[32px] border border-amber-200 bg-amber-50 p-8 shadow-sm">
            <div className="text-lg font-semibold text-amber-900">{error}</div>
            <p className="mt-2 text-sm text-amber-700">
              Try another IMF indicator from Quick picks or the full list.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm text-slate-500">Latest</div>
                <div className="mt-3 text-5xl font-bold tracking-tight text-slate-950">
                  {formatNumber(latest)}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm text-slate-500">Range (min)</div>
                <div className="mt-3 text-5xl font-bold tracking-tight text-slate-950">
                  {formatNumber(minVal)}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm text-slate-500">Range (max)</div>
                <div className="mt-3 text-5xl font-bold tracking-tight text-slate-950">
                  {formatNumber(maxVal)}
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    {payload?.indicator_label ||
                      payload?.label ||
                      getIndicatorLabel(selectedIndicator)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {payload?.country || iso3} • {selectedIndicator} •{" "}
                    {payload?.vintage || "Latest WEO vintage"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
                  {points.length} returned points
                </div>
              </div>

              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={points}
                    margin={{ top: 10, right: 16, left: 6, bottom: 6 }}
                  >
                    <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#475569", fontSize: 12 }}
                      stroke="#CBD5E1"
                    />
                    <YAxis
                      tick={{ fill: "#475569", fontSize: 12 }}
                      stroke="#CBD5E1"
                      tickFormatter={(v) => formatNumber(Number(v))}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatNumber(Number(value)),
                        "Value",
                      ]}
                      labelFormatter={(label) => `Year: ${label}`}
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid #E2E8F0",
                        background: "#FFFFFF",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#4F46E5"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">
                Diagnostic summary
              </h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">ISO3</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {iso3}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Indicator code</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {selectedIndicator}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Country</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {payload?.country || iso3}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Vintage</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {payload?.vintage || "Latest"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-950">
                Returned points
              </h3>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <div className="grid grid-cols-2 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-600">
                  <div>Year</div>
                  <div>Value</div>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {points.map((p) => (
                    <div
                      key={p.year}
                      className="grid grid-cols-2 border-t border-slate-100 px-5 py-4 text-slate-800"
                    >
                      <div>{p.year}</div>
                      <div>{formatNumber(p.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
