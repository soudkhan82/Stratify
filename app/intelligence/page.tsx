"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Database,
  Gauge,
  Globe2,
  Lightbulb,
  Loader2,
  Minus,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  CountryIntelligencePayload,
  IntelligenceDimensionResult,
  IntelligenceIndicatorResult,
  IntelligenceSignal,
  IntelligenceTrend,
  WeoOutlookSeries,
} from "@/app/lib/intelligence/types";

type CountryOption = {
  iso3: string;
  name: string;
  region: string;
  incomeLevel: string | null;
};

type CountriesPayload = {
  ok?: boolean;
  countries?: CountryOption[];
  error?: string;
};

const DEFAULT_COUNTRY = "PAK";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreText(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}
function indicatorScoreMeaning(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return {
      label: "Not scored",
      text: "There is not enough comparable information to produce a reliable indicator score.",
    };
  }

  if (value >= 80) {
    return {
      label: "Very strong",
      text: "A very strong favourable signal relative to peers and recent history.",
    };
  }

  if (value >= 70) {
    return {
      label: "Strong",
      text: "A strong favourable signal with good comparative positioning.",
    };
  }

  if (value >= 60) {
    return {
      label: "Moderately favourable",
      text: "The indicator is performing moderately well across the scoring criteria.",
    };
  }

  if (value >= 45) {
    return {
      label: "Mixed",
      text: "The indicator shows a mixed position: some scoring components are supportive while others are weaker.",
    };
  }

  if (value >= 35) {
    return {
      label: "Weak",
      text: "The indicator is relatively weak versus peers and/or its own recent trajectory.",
    };
  }

  return {
    label: "Very weak",
    text: "The indicator is a notable constraint relative to comparable countries and/or recent history.",
  };
}

function confidenceMeaning(value: number) {
  if (value >= 85) return "High confidence";
  if (value >= 70) return "Good confidence";
  if (value >= 50) return "Moderate confidence";
  if (value >= 25) return "Low confidence";
  return "Very limited confidence";
}

function compact(value: number) {
  if (!Number.isFinite(value)) return "n/a";

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatValue(value: number | null, unit?: string | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";

  if (unit === "US$") return `$${compact(value)}`;
  if (unit === "%") {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value)}%`;
  }
  if (unit?.startsWith("% of")) {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
  }
  if (unit === "years") {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)} years`;
  }
  if (unit === "months") {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value)} months`;
  }

  const formatted =
    Math.abs(value) >= 100_000
      ? compact(value)
      : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

  return unit ? `${formatted} ${unit}` : formatted;
}

function trendMeta(trend: IntelligenceTrend) {
  if (trend === "improving") {
    return {
      label: "Improving",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: TrendingUp,
    };
  }

  if (trend === "deteriorating") {
    return {
      label: "Deteriorating",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      icon: TrendingDown,
    };
  }

  return {
    label: "Stable",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: Minus,
  };
}

function signalMeta(signal: IntelligenceSignal) {
  if (signal.severity === "positive") {
    return {
      label: "Positive",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
      iconClassName: "text-emerald-600",
    };
  }

  if (signal.severity === "risk") {
    return {
      label: "Risk",
      icon: TriangleAlert,
      className: "border-rose-200 bg-rose-50/70 text-rose-800",
      iconClassName: "text-rose-600",
    };
  }

  return {
    label: "Watch",
    icon: Activity,
    className: "border-amber-200 bg-amber-50/70 text-amber-800",
    iconClassName: "text-amber-600",
  };
}

function ScoreRing({ value }: { value: number | null }) {
  const safe = value === null ? 0 : clamp(value);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative h-[150px] w-[150px] shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-slate-100"
        />
        <circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-indigo-600 transition-all duration-500"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[34px] font-black tracking-[-0.05em] text-slate-950">
          {scoreText(value)}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
          / 100
        </div>
      </div>
    </div>
  );
}

function MiniScoreBar({ value }: { value: number | null }) {
  const width = value === null ? 0 : clamp(value);

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-indigo-600 transition-all"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function TrendBadge({ trend }: { trend: IntelligenceTrend }) {
  const meta = trendMeta(trend);
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function DimensionCard({ dimension }: { dimension: IntelligenceDimensionResult }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
            Intelligence dimension
          </div>
          <h3 className="mt-1 text-[16px] font-black tracking-[-0.02em] text-slate-900">
            {dimension.label}
          </h3>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-2xl font-black tracking-[-0.04em] text-slate-950">
            {scoreText(dimension.score)}
          </div>
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
            score
          </div>
        </div>
      </div>

      <div className="mt-3">
        <MiniScoreBar value={dimension.score} />
      </div>

      <p className="mt-3 min-h-[54px] text-[11px] font-medium leading-[1.55] text-slate-500">
        {dimension.description}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <TrendBadge trend={dimension.trend} />
        <div className="text-[10px] font-bold text-slate-400">
          Confidence {dimension.confidence}%
        </div>
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: IntelligenceSignal }) {
  const meta = signalMeta(signal);
  const Icon = meta.icon;

  return (
    <div className={`rounded-2xl border p-3.5 ${meta.className}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.iconClassName}`} />
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] opacity-70">
            {meta.label}
          </div>
          <div className="mt-0.5 text-sm font-black leading-5">
            {signal.title}
          </div>
          <p className="mt-1 text-[11px] font-semibold leading-[1.5] opacity-80">
            {signal.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function DriverRow({
  label,
  score,
  contribution,
  positive,
}: {
  label: string;
  score: number;
  contribution: number;
  positive: boolean;
}) {
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-black text-slate-800">{label}</div>
        <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
          Indicator score {score.toFixed(1)}
        </div>
      </div>

      <div
        className={`shrink-0 text-sm font-black tabular-nums ${
          positive ? "text-emerald-700" : "text-rose-700"
        }`}
      >
        {positive ? "+" : ""}
        {contribution.toFixed(1)}
      </div>
    </div>
  );
}

function IndicatorRow({ indicator }: { indicator: IntelligenceIndicatorResult }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
        onClick={() => setOpen((value) => !value)}
      >
        <td className="px-4 py-3">
          <div className="text-xs font-black text-slate-800">{indicator.label}</div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {indicator.source} Â· {indicator.latest.year ?? "n/a"}
          </div>
        </td>

        <td className="px-4 py-3 text-right text-xs font-black tabular-nums text-slate-900">
          {formatValue(indicator.latest.value, indicator.unit)}
        </td>

        <td className="px-4 py-3 text-center text-xs font-black text-slate-700">
          {indicator.benchmark.globalRank
            ? `#${indicator.benchmark.globalRank} / ${indicator.benchmark.globalTotal}`
            : "n/a"}
        </td>

        <td className="px-4 py-3 text-center text-xs font-black text-slate-700">
          {indicator.benchmark.regionalRank
            ? `#${indicator.benchmark.regionalRank} / ${indicator.benchmark.regionalTotal}`
            : "n/a"}
        </td>

        <td className="px-4 py-3">
          <div className="mx-auto max-w-[150px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-900">
                {scoreText(indicator.score, 1)}
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-400">
                  {indicator.confidence}% conf.
                </span>

                <div className="group relative">
                  <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    aria-label={`Explain ${indicator.label} score`}
                    title="Explain score"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                  </button>

                  <div
                    className="pointer-events-none invisible absolute right-0 top-[calc(100%+8px)] z-[1200] w-[390px] max-w-[calc(100vw-32px)] translate-y-1 rounded-2xl border border-slate-200 bg-white p-4.5 text-left opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="absolute -top-1.5 right-2.5 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.09em] text-amber-700">
                            Score explanation
                          </div>

                          <div className="mt-1 text-[15px] font-black leading-5 text-slate-950">
                            {indicator.label}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[24px] font-black leading-none tabular-nums text-indigo-700">
                            {scoreText(indicator.score, 1)}
                          </div>

                          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                            / 100
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                        <div className="text-[12px] font-black text-slate-900">
                          {indicatorScoreMeaning(indicator.score).label}
                        </div>

                        <div className="mt-1 text-[11px] font-semibold leading-[1.55] text-slate-600">
                          {indicatorScoreMeaning(indicator.score).text}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          ["Global", indicator.components.globalPosition, "40%"],
                          ["Regional", indicator.components.regionalPosition, "20%"],
                          ["Momentum", indicator.components.momentum, "25%"],
                          ["Stability", indicator.components.stability, "15%"],
                        ].map(([label, value, weight]) => (
                          <div
                            key={String(label)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.06em] text-slate-500">
                                {label}
                              </span>
                              <span className="text-[10px] font-black text-indigo-600">
                                {weight}
                              </span>
                            </div>

                            <div className="mt-1 text-[15px] font-black tabular-nums text-slate-900">
                              {scoreText(value as number | null, 1)}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3.5 border-t border-slate-200 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black text-slate-800">
                            {confidenceMeaning(indicator.confidence)}
                          </span>

                          <span className="text-[12px] font-black tabular-nums text-indigo-700">
                            {indicator.confidence}%
                          </span>
                        </div>

                        <div className="mt-1 text-[10px] font-semibold leading-[1.55] text-slate-500">
                          Confidence reflects usable benchmark, history and recency coverage. Click the table row for the full breakdown.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-1.5">
              <MiniScoreBar value={indicator.score} />
            </div>
          </div>
        </td>

        <td className="px-4 py-3 text-center">
          <TrendBadge trend={indicator.trend} />
        </td>
      </tr>

      {open ? (
        <tr className="border-b border-slate-100 bg-slate-50/70">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ["Global position", indicator.components.globalPosition],
                ["Regional position", indicator.components.regionalPosition],
                ["Momentum", indicator.components.momentum],
                ["Stability", indicator.components.stability],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                    {label}
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-900">
                    {scoreText(value as number | null, 1)}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-medium leading-[1.55] text-slate-500">
              {indicator.description}
            </p>

            {indicator.warning ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold leading-5 text-amber-800">
                {indicator.warning}
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function OutlookCard({ series }: { series: WeoOutlookSeries }) {
  const latest = series.points.at(-1) ?? null;
  const first = series.points[0] ?? null;
  const delta = latest && first ? latest.value - first.value : null;

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-900">{series.label}</div>
          <div className="mt-0.5 text-[10px] font-bold text-slate-400">IMF WEO forward series</div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-base font-black text-indigo-700">
            {latest ? formatValue(latest.value, series.unit) : "n/a"}
          </div>
          <div className="text-[9px] font-bold text-slate-400">
            {latest?.year ?? ""}
          </div>
        </div>
      </div>

      <div className="mt-3 h-[140px]">
        {series.points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series.points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9, fill: "#64748b", fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                minTickGap={18}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => compact(Number(value))}
                width={42}
              />
              <Tooltip
                formatter={(value) => [formatValue(Number(value), series.unit), series.label]}
                labelFormatter={(label) => `Year ${label}`}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4f46e5"
                strokeWidth={2.2}
                dot={{ r: 2.5, fill: "#4f46e5" }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-xs font-semibold text-slate-400">
            Forecast unavailable
          </div>
        )}
      </div>

      <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-semibold text-slate-400">
        {delta === null ? "Insufficient points" : `Change across outlook: ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} ${series.unit}`}
      </div>
    </div>
  );
}

function ScoringGuideModal({
  payload,
  onClose,
}: {
  payload: CountryIntelligencePayload;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const weights = payload.methodology.componentWeights;
  const overall = payload.score.overall;
  const roundedOverall = overall === null ? "n/a" : overall.toFixed(1);

  const scoreBands = [
    ["80-100", "Strong"],
    ["70-79.9", "Positive"],
    ["60-69.9", "Moderately Positive"],
    ["45-59.9", "Mixed"],
    ["35-44.9", "Fragile"],
    ["Below 35", "High Risk"],
  ];

  const dimensions = [
    [
      "Economic Momentum",
      "GDP growth 40% | Inflation 35% | Unemployment 25%",
    ],
    [
      "External Resilience",
      "Reserves 40% | Current account 35% | Exports 25%",
    ],
    [
      "Fiscal Health",
      "Government debt 45% | Fiscal balance 35% | Tax revenue 20%",
    ],
    [
      "Development & Capacity",
      "GDP per capita 35% | Life expectancy 35% | Electricity access 30%",
    ],
  ];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Stratify scoring guide"
    >
      <div className="max-h-[88vh] w-full max-w-[820px] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
              <Lightbulb className="h-4 w-4" />
              Scoring guide
            </div>

            <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">
              How Stratify Country Intelligence is scored
            </h2>

            <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
              A concise, transparent explanation of what the score means and how each indicator contributes.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close scoring guide"
          >
            X
          </button>
        </div>

        <div className="max-h-[calc(88vh-92px)] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3.5">
            <div className="text-[10px] font-black uppercase tracking-[0.11em] text-indigo-600">
              Reading the current result
            </div>

            <p className="mt-1.5 text-xs font-medium leading-5 text-slate-700">
              <span className="font-black text-slate-950">
                {payload.country.name}
              </span>{" "}
              currently scores{" "}
              <span className="font-black text-indigo-700">
                {roundedOverall} / 100
              </span>
              , classified as{" "}
              <span className="font-black text-slate-950">
                {payload.score.label}
              </span>
              . The score is a relative decision-support signal built from
              observed socioeconomic conditions. IMF forward projections are
              displayed separately and do not raise or lower the current score.
            </p>
          </div>

          <div className="mt-5">
            <div className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
              Step 1 - Indicator score
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {[
                [
                  "Global position",
                  weights.globalPosition,
                  "Worldwide favourable percentile",
                ],
                [
                  "Regional position",
                  weights.regionalPosition,
                  "Position among regional peers",
                ],
                [
                  "Momentum",
                  weights.momentum,
                  "Direction over recent observations",
                ],
                [
                  "Stability",
                  weights.stability,
                  "Consistency over recent history",
                ],
              ].map(([label, weight, note]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <div className="text-[9px] font-black uppercase tracking-[0.09em] text-slate-400">
                    {label}
                  </div>

                  <div className="mt-1 text-xl font-black text-slate-950">
                    {Math.round(Number(weight) * 100)}%
                  </div>

                  <div className="mt-1 text-[9px] font-semibold leading-4 text-slate-500">
                    {note}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-2 text-[10px] font-semibold leading-5 text-slate-500">
              Missing components are not treated as zero; the available
              component weights are re-normalized. Momentum uses the latest four
              observations where sufficient history exists, while stability
              considers recent year-to-year volatility over up to six
              observations.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
                Step 2 - Four equally weighted dimensions
              </div>

              <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200">
                {dimensions.map(([label, detail], index) => (
                  <div
                    key={label}
                    className={`px-3.5 py-3 ${
                      index ? "border-t border-slate-100" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-black text-slate-800">
                        {label}
                      </div>

                      <div className="text-[10px] font-black text-indigo-600">
                        25% overall
                      </div>
                    </div>

                    <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                      {detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
                Score interpretation
              </div>

              <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {scoreBands.map(([range, label], index) => (
                  <div
                    key={range}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                      index ? "border-t border-slate-200/70" : ""
                    }`}
                  >
                    <span className="text-[10px] font-black tabular-nums text-slate-500">
                      {range}
                    </span>

                    <span className="text-[12px] font-black text-slate-900">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="text-[10px] font-black text-slate-900">
                Higher is favourable
              </div>

              <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                Used for GDP growth, reserves, exports, tax revenue, income,
                life expectancy and electricity access.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="text-[10px] font-black text-slate-900">
                Lower is favourable
              </div>

              <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                Used where lower values generally indicate less pressure, such
                as unemployment and government debt.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="text-[10px] font-black text-slate-900">
                Target range is favourable
              </div>

              <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                Inflation is assessed against a 2-6% range and the current
                account against -3% to +3%. Distance from the configured range
                reduces favourability.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <div className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
              Confidence & safeguards
            </div>

            <p className="mt-1.5 text-[10px] font-semibold leading-5 text-slate-600">
              Confidence reflects component availability (50%), historical
              coverage (30%) and data recency (20%). A country is therefore not
              rewarded for missing data. "Improving" and "deteriorating"
              describe recent favourable direction, not political judgement or
              a sovereign credit rating. Rankings are calculated only against
              countries with comparable observations for the benchmark year.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-[9px] font-bold text-slate-400">
              Methodology: {payload.methodology.version}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black text-white shadow-sm transition hover:bg-indigo-700"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function CountryIntelligencePage() {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [iso3, setIso3] = useState(DEFAULT_COUNTRY);
  const [payload, setPayload] = useState<CountryIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [error, setError] = useState("");
  const [scoringGuideOpen, setScoringGuideOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requested = String(params.get("country") ?? params.get("iso3") ?? "")
      .trim()
      .toUpperCase();

    if (/^[A-Z]{3}$/.test(requested)) {
      setIso3(requested);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    setCountriesLoading(true);

    fetch("/api/intelligence/countries", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const raw = (await response.json()) as CountriesPayload;
        if (!response.ok || !raw.ok) {
          throw new Error(raw.error || "Unable to load countries.");
        }
        return raw;
      })
      .then((raw) => {
        if (!alive) return;
        setCountries(Array.isArray(raw.countries) ? raw.countries : []);
      })
      .catch((fetchError) => {
        if (!alive || fetchError?.name === "AbortError") return;
        console.warn("Country list unavailable:", fetchError);
      })
      .finally(() => {
        if (alive) setCountriesLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!/^[A-Z]{3}$/.test(iso3)) return;

    let alive = true;
    const controller = new AbortController();

    setLoading(true);
    setError("");

    fetch(`/api/intelligence/country?iso3=${encodeURIComponent(iso3)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const raw = (await response.json()) as CountryIntelligencePayload;
        if (!response.ok || !raw.ok) {
          throw new Error(raw.error || "Unable to load country intelligence.");
        }
        return raw;
      })
      .then((raw) => {
        if (!alive) return;
        setPayload(raw);

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("country", iso3);
          url.searchParams.delete("iso3");
          window.history.replaceState({}, "", url.toString());
        }
      })
      .catch((fetchError) => {
        if (!alive || fetchError?.name === "AbortError") return;
        setPayload(null);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load country intelligence.",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [iso3]);

  const filteredCountries = useMemo(() => {
    const query = countryQuery.trim().toLowerCase();
    if (!query) return countries.slice(0, 12);

    return countries
      .filter(
        (country) =>
          country.name.toLowerCase().includes(query) ||
          country.iso3.toLowerCase().includes(query) ||
          country.region.toLowerCase().includes(query),
      )
      .slice(0, 12);
  }, [countries, countryQuery]);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.iso3 === iso3) ?? null,
    [countries, iso3],
  );

  const signalGroups = useMemo(() => {
    const signals = payload?.signals ?? [];
    return {
      positive: signals.filter((signal) => signal.severity === "positive"),
      watch: signals.filter((signal) => signal.severity === "watch"),
      risk: signals.filter((signal) => signal.severity === "risk"),
    };
  }, [payload?.signals]);

  function chooseCountry(country: CountryOption) {
    setIso3(country.iso3);
    setCountryQuery("");
    setCountryMenuOpen(false);
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-slate-900">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-visible rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">
                <Gauge className="h-4 w-4" />
                Stratify Intelligence Â· Decision Support
              </div>

              <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em] text-slate-950 sm:text-[38px]">
                Country Socio-Economic Outlook
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                A transparent country assessment that converts WDI and IMF data into comparative position,
                historical momentum, stability, risks, strengths and forward-looking signals.
              </p>
            </div>

            <div className="relative w-full max-w-[430px]">
              <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                Analyse country
              </label>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={countryQuery}
                  onChange={(event) => {
                    setCountryQuery(event.target.value);
                    setCountryMenuOpen(true);
                  }}
                  onFocus={() => setCountryMenuOpen(true)}
                  placeholder={
                    selectedCountry
                      ? `${selectedCountry.name} (${selectedCountry.iso3})`
                      : payload
                        ? `${payload.country.name} (${payload.country.iso3})`
                        : "Search country or ISO3"
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />

                {countriesLoading ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                ) : null}
              </div>

              {countryMenuOpen && filteredCountries.length ? (
                <div className="absolute left-0 right-0 top-[67px] z-[1000] max-h-[360px] overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                  {filteredCountries.map((country) => (
                    <button
                      key={country.iso3}
                      type="button"
                      onClick={() => chooseCountry(country)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">
                        {country.iso3}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-black text-slate-800">{country.name}</div>
                        <div className="mt-0.5 truncate text-[9px] font-bold text-slate-400">
                          {country.region}{country.incomeLevel ? ` Â· ${country.incomeLevel}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {error ? (
          <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">
            <div className="font-black">Country Intelligence could not load.</div>
            <div className="mt-1">{error}</div>
          </section>
        ) : null}

        {loading ? (
          <section className="mt-4 flex min-h-[540px] items-center justify-center rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex max-w-md flex-col items-center px-6 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <div className="mt-4 text-lg font-black text-slate-900">Building country outlook</div>
              <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Comparing global position, regional position, historical momentum and stability across the intelligence basket.
              </div>
            </div>
          </section>
        ) : payload ? (
          <>
            <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,0.75fr)]">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                  <ScoreRing value={payload.score.overall} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600">
                        Stratify Country Score
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                        {payload.country.iso3}
                      </span>
                      <button
                        type="button"
                        onClick={() => setScoringGuideOpen(true)}
                        className="group inline-flex items-center gap-2 rounded-xl border border-indigo-600 bg-indigo-600 px-3.5 py-2 text-[11px] font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        title="Open the Stratify scoring methodology"
                      >
                        <Lightbulb className="h-4 w-4 transition-transform group-hover:rotate-6" />
                        How scoring works
                      </button>
                    </div>

                    <h2 className="mt-1 text-[30px] font-black tracking-[-0.04em] text-slate-950 sm:text-[34px]">
                      {payload.country.name}
                    </h2>

                    <div className="mt-1 text-xs font-bold text-slate-400">
                      {payload.country.region ?? "Region unavailable"}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
                        {payload.score.label}
                      </span>
                      <TrendBadge trend={payload.score.trend} />
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500">
                        Confidence {payload.score.confidence}%
                      </span>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                      <div className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
                        Decision brief
                      </div>
                      <div className="mt-1 text-sm font-black leading-6 text-slate-900">
                        {payload.narrative.headline}
                      </div>
                      <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">
                        {payload.narrative.summary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.11em] text-slate-400">
                    <ShieldCheck className="h-4 w-4 text-indigo-500" />
                    Data confidence
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-950">{payload.score.confidence}%</div>
                  <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                    Coverage and usability of the V1 intelligence basket.
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.11em] text-slate-400">
                    <Database className="h-4 w-4 text-indigo-500" />
                    Indicators scored
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-950">
                    {payload.indicators.filter((indicator) => indicator.score !== null).length}
                    <span className="text-sm text-slate-400"> / {payload.indicators.length}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                    Compact high-signal basket to avoid correlated double counting.
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.11em] text-slate-400">
                    <Globe2 className="h-4 w-4 text-indigo-500" />
                    Forward outlook
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-950">
                    {payload.outlook.series.length}
                    <span className="text-sm text-slate-400"> WEO series</span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                    Kept separate from the current-condition score.
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {payload.dimensions.map((dimension) => (
                <DimensionCard key={dimension.id} dimension={dimension} />
              ))}
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">
                      What changed?
                    </div>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-900">
                      Signals requiring attention
                    </h2>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black text-slate-500">
                    {payload.signals.length} signals
                  </div>
                </div>

                {payload.signals.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[...signalGroups.positive, ...signalGroups.watch, ...signalGroups.risk].map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    No material V1 signals were detected from the available historical series.
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <div className="text-sm font-black text-slate-900">Strongest drivers</div>
                  </div>
                  <div className="mt-2">
                    {payload.strengths.length ? (
                      payload.strengths.map((driver) => (
                        <DriverRow
                          key={driver.indicatorId}
                          label={driver.label}
                          score={driver.score}
                          contribution={driver.contribution}
                          positive
                        />
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs font-semibold text-slate-400">No strong positive driver identified.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-rose-600" />
                    <div className="text-sm font-black text-slate-900">Risk drivers</div>
                  </div>
                  <div className="mt-2">
                    {payload.risks.length ? (
                      payload.risks.map((driver) => (
                        <DriverRow
                          key={driver.indicatorId}
                          label={driver.label}
                          score={driver.score}
                          contribution={driver.contribution}
                          positive={false}
                        />
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs font-semibold text-slate-400">No major V1 risk driver identified.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">
                    <BarChart3 className="h-4 w-4" />
                    Explainable scoring
                  </div>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-900">
                    Indicator intelligence table
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    Use the bulb beside each score for a quick explanation, or click the row for the full component breakdown.
                  </p>
                </div>

                <div className="w-full max-w-[500px] rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3.5 text-left shadow-sm">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 shrink-0 text-indigo-600" />
                    <div className="text-[11px] font-black uppercase tracking-[0.09em] text-indigo-700">
                      Benchmark Policy
                    </div>
                  </div>

                  <div className="mt-1.5 text-[12px] font-semibold leading-5 text-slate-700 sm:text-[13px]">
                    {payload.methodology.benchmarkPolicy}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                      <th className="px-4 py-3">Indicator</th>
                      <th className="px-4 py-3 text-right">Latest</th>
                      <th className="px-4 py-3 text-center">Global rank</th>
                      <th className="px-4 py-3 text-center">Regional rank</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.indicators.map((indicator) => (
                      <IndicatorRow key={indicator.id} indicator={indicator} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">
                    <Target className="h-4 w-4" />
                    Institutional forward outlook
                  </div>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-900">
                    IMF WEO trajectory
                  </h2>
                  <p className="mt-1 max-w-3xl text-[11px] font-semibold leading-5 text-slate-500">
                    These projections are shown as forward-looking institutional estimates and are deliberately excluded from the current-condition Stratify score.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">WEO vintage</div>
                  <div className="mt-0.5 text-xs font-black text-slate-700">{payload.outlook.vintage ?? "n/a"}</div>
                  <div className="mt-0.5 text-[9px] font-semibold text-slate-400">From {payload.outlook.fromYear}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {payload.outlook.series.map((series) => (
                  <OutlookCard key={series.code} series={series} />
                ))}
              </div>
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.55fr)]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-indigo-600" />
                  <div className="text-sm font-black text-slate-900">How the score is built</div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Global position", payload.methodology.componentWeights.globalPosition],
                    ["Regional position", payload.methodology.componentWeights.regionalPosition],
                    ["Momentum", payload.methodology.componentWeights.momentum],
                    ["Stability", payload.methodology.componentWeights.stability],
                  ].map(([label, weight]) => (
                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">{label}</div>
                      <div className="mt-1 text-xl font-black text-slate-900">{Math.round(Number(weight) * 100)}%</div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-[11px] font-medium leading-5 text-slate-500">
                  {payload.methodology.note}
                </p>
              </div>

              <div className="rounded-[24px] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">Methodology</div>
                <div className="mt-1 text-base font-black text-indigo-950">{payload.methodology.version}</div>
                <div className="mt-4 space-y-2 text-[11px] font-medium leading-5 text-slate-600">
                  <p>Observed conditions and forward projections are separated.</p>
                  <p>Higher, lower and target-range indicators use different favourable-direction logic.</p>
                  <p>Scores are relative decision-support signals, not a sovereign credit rating.</p>
                </div>
              </div>
            </section>

            {scoringGuideOpen ? (
              <ScoringGuideModal
                payload={payload}
                onClose={() => setScoringGuideOpen(false)}
              />
            ) : null}
            {payload.warnings.length ? (
              <section className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4">
                <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                  <TriangleAlert className="h-4 w-4" />
                  Data / methodology warnings
                </div>
                <div className="mt-2 grid gap-1.5 text-[11px] font-semibold leading-5 text-amber-800">
                  {payload.warnings.map((warning, index) => (
                    <div key={`${warning}-${index}`}>Â· {warning}</div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
