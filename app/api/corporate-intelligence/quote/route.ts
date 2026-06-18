import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FinnhubQuote = {
  c?: number; // current price
  d?: number; // price change
  dp?: number; // change percent
  h?: number; // day high
  l?: number; // day low
  o?: number; // open
  pc?: number; // previous close
  t?: number; // unix timestamp
};

type FinnhubMetricResponse = {
  metric?: Record<string, unknown>;
  metricType?: string;
  series?: Record<string, unknown>;
  symbol?: string;
};

function normalizeSymbol(value: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^0-9.-]/g, ""));

  return Number.isFinite(n) ? n : null;
}

function pickNumber(
  source: Record<string, unknown> | undefined,
  keys: string[],
) {
  if (!source) return null;

  for (const key of keys) {
    const value = toNumber(source[key]);
    if (value !== null) return value;
  }

  return null;
}

function normalizeMarketCap(value: unknown) {
  const n = toNumber(value);
  if (n === null) return null;

  // Finnhub marketCapitalization commonly comes in USD millions.
  return n * 1_000_000;
}

function normalizeVolumeMillions(value: unknown) {
  const n = toNumber(value);
  if (n === null) return null;

  // Finnhub average trading volume metrics commonly come in millions of shares.
  return n * 1_000_000;
}

function quoteTime(timestamp?: number) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return new Date().toISOString();
  }

  return new Date(timestamp * 1000).toISOString();
}

async function fetchFinnhubJson(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Finnhub request failed with status ${response.status}${
        text ? `: ${text.slice(0, 180)}` : ""
      }`,
    );
  }

  return response.json();
}

export async function GET(req: Request) {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing FINNHUB_API_KEY. Add it in .env.local and Vercel Environment Variables.",
        },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);
    const symbol = normalizeSymbol(
      searchParams.get("ticker") || searchParams.get("symbol"),
    );

    if (!symbol) {
      return NextResponse.json(
        { ok: false, error: "Ticker/symbol is required." },
        { status: 400 },
      );
    }

    const token = encodeURIComponent(apiKey);
    const encodedSymbol = encodeURIComponent(symbol);

    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodedSymbol}&token=${token}`;
    const metricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${encodedSymbol}&metric=all&token=${token}`;

    const [quoteRaw, metricRaw] = await Promise.all([
      fetchFinnhubJson(quoteUrl),
      fetchFinnhubJson(metricUrl),
    ]);

    const quote = quoteRaw as FinnhubQuote;
    const metricPayload = metricRaw as FinnhubMetricResponse;
    const metric = metricPayload?.metric || {};

    const price = toNumber(quote.c);

    if (price === null || price <= 0) {
      return NextResponse.json(
        {
          ok: false,
          symbol,
          error:
            "Finnhub returned no valid quote for this symbol. Check symbol support or market status.",
        },
        { status: 404 },
      );
    }

    const avgVolumeRaw = pickNumber(metric, [
      "3MonthAverageTradingVolume",
      "10DayAverageTradingVolume",
    ]);

    const tenDayVolumeRaw = pickNumber(metric, [
      "10DayAverageTradingVolume",
      "3MonthAverageTradingVolume",
    ]);

    const data = {
      symbol,
      price,
      change: toNumber(quote.d),
      change_percent: toNumber(quote.dp),

      // Quote endpoint does not return volume, so we use Finnhub average volume metrics.
      volume: normalizeVolumeMillions(tenDayVolumeRaw),
      avg_volume: normalizeVolumeMillions(avgVolumeRaw),

      live_market_cap: normalizeMarketCap(
        pickNumber(metric, ["marketCapitalization"]),
      ),

      day_low: toNumber(quote.l),
      day_high: toNumber(quote.h),
      open: toNumber(quote.o),
      previous_close: toNumber(quote.pc),

      year_low: pickNumber(metric, ["52WeekLow"]),
      year_high: pickNumber(metric, ["52WeekHigh"]),

      pe: pickNumber(metric, [
        "peBasicExclExtraTTM",
        "peNormalizedAnnual",
        "peTTM",
      ]),

      eps: pickNumber(metric, [
        "epsBasicExclExtraItemsTTM",
        "epsNormalizedAnnual",
        "epsInclExtraItemsTTM",
      ]),

      quote_time: quoteTime(quote.t),
      quote_source: "Finnhub",
      quote_updated_at: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        ok: true,
        source: "Finnhub",
        ticker: symbol,
        quote: data,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch Finnhub quote.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
