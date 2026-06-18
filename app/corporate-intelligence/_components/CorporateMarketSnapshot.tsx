"use client";

import type { CorporateProfile } from "../_lib/types";

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function money(value: unknown) {
  const n = toNum(value);
  if (n === null) return "N/A";
  return `$${n.toFixed(2)}`;
}

function compact(value: unknown) {
  const n = toNum(value);
  if (n === null) return "N/A";

  if (Math.abs(n) >= 1_000_000_000_000) {
    return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (Math.abs(n) >= 1_000_000_000) {
    return `$${(n / 1_000_000_000).toFixed(2)}B`;
  }

  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }

  return n.toLocaleString();
}

function numberText(value: unknown, digits = 2) {
  const n = toNum(value);
  if (n === null) return "N/A";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function pct(value: unknown) {
  const n = toNum(value);
  if (n === null) return "N/A";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function dateText(value: unknown) {
  if (!value) return "N/A";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
}

function SnapshotBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "indigo";
}) {
  const valueClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-red-700"
        : tone === "indigo"
          ? "text-indigo-700"
          : "text-slate-950";

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-sm font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function CorporateMarketSnapshot({
  company,
}: {
  company: CorporateProfile;
}) {
  const price = toNum(company.price);
  const change = toNum(company.change);
  const changePercent = toNum(company.change_percent);
  const isUp = (change ?? changePercent ?? 0) >= 0;

  const hasQuote =
    price !== null ||
    change !== null ||
    changePercent !== null ||
    toNum(company.live_market_cap) !== null ||
    toNum(company.volume) !== null;

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-950">Market Snapshot</h3>
          <p className="text-xs font-medium text-slate-500">
            Stock quote data from enriched corporate directory
          </p>
        </div>

        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700">
          {company.quote_source || "Quote"}
        </span>
      </div>

      {!hasQuote ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          Stock quote is not available for {company.symbol}. Check quote
          refresh/source data.
        </div>
      ) : (
        <>
          <div className="mb-3 rounded-2xl bg-slate-950 p-4 text-white shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  {company.symbol}
                </p>
                <p className="mt-1 text-3xl font-black leading-none">
                  {money(company.price)}
                </p>
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  Updated:{" "}
                  {dateText(company.quote_updated_at || company.quote_time)}
                </p>
              </div>

              <div
                className={`rounded-2xl px-4 py-3 text-right text-sm font-black ${
                  isUp
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                <p>
                  {change === null
                    ? "N/A"
                    : `${change >= 0 ? "+" : ""}${change.toFixed(2)}`}
                </p>
                <p>{pct(company.change_percent)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SnapshotBox
              label="Market Cap"
              value={compact(company.live_market_cap)}
            />
            <SnapshotBox label="Volume" value={numberText(company.volume, 0)} />

            <SnapshotBox
              label="Day Range"
              value={`${money(company.day_low)} - ${money(company.day_high)}`}
            />

            <SnapshotBox
              label="52W Range"
              value={`${money(company.year_low)} - ${money(company.year_high)}`}
            />

            <SnapshotBox
              label="Average Volume"
              value={numberText(company.avg_volume, 0)}
            />
            <SnapshotBox label="P/E" value={numberText(company.pe, 2)} />
            <SnapshotBox label="EPS" value={numberText(company.eps, 2)} />
            <SnapshotBox
              label="Quote Source"
              value={company.quote_source || "N/A"}
              tone="indigo"
            />
          </div>
        </>
      )}
    </div>
  );
}
