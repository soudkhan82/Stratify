// app/api/landing/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type WdiRow = {
  indicator_code: string;
  label: string; // MUST match UI expected labels
  year: string | null;
  value: number | null;
};

type LandingResp = {
  scope: "world" | "country";
  iso3: string | null;
  region: string | null;
  countryName: string | null;
  wdi: WdiRow[];

  // keep stable keys for other modules
  suaYear: number | null;
  sua: {
    label: string;
    unit: string | null;
    value: number | null;
    year: number;
  }[];
  prodYear: number | null;
  topCommodities: { item: string; value: number }[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * World Bank returns: [ {meta...}, [ {country, indicator, date, value, ...}, ... ] ]
 * We return the latest non-null value (or null if none).
 */
async function fetchWorldBankLatestValue(
  countryOrAgg: string,
  indicator: string
): Promise<{ year: string | null; value: number | null }> {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(
    countryOrAgg
  )}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=80`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { year: null, value: null };

  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length < 2)
    return { year: null, value: null };

  const rows = json[1];
  if (!Array.isArray(rows)) return { year: null, value: null };

  for (const r of rows) {
    if (!isRecord(r)) continue;
    const value = toNumber(r.value);
    const year = safeStr(r.date);
    if (value !== null) return { year: year ?? null, value };
  }

  // nothing found
  const first = rows[0];
  if (isRecord(first))
    return { year: safeStr(first.date) ?? null, value: null };

  return { year: null, value: null };
}

async function fetchCountryMeta(
  iso3: string
): Promise<{ name: string | null; region: string | null }> {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(
    iso3
  )}?format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { name: null, region: null };

  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length < 2)
    return { name: null, region: null };

  const arr = json[1];
  if (!Array.isArray(arr) || arr.length === 0)
    return { name: null, region: null };

  const c = arr[0];
  if (!isRecord(c)) return { name: null, region: null };

  const name = safeStr(c.name);
  const regObj = isRecord(c.region) ? c.region : null;
  const region = regObj ? safeStr(regObj.value) : null;

  return { name, region };
}

// IMPORTANT: these labels MUST match what app/page.tsx expects in wdiMap.get("...")
const LANDING_METRICS: { indicator: string; label: string }[] = [
  { indicator: "SP.POP.TOTL", label: "Total Population" },
  { indicator: "SP.POP.GROW", label: "Population Growth (%)" },
  { indicator: "SP.DYN.CBRT.IN", label: "Birth Rate (per 1,000)" },
  { indicator: "SP.DYN.CDRT.IN", label: "Death Rate (per 1,000)" },
  { indicator: "SP.DYN.LE00.IN", label: "Life Expectancy (years)" },
  { indicator: "SP.URB.TOTL.IN.ZS", label: "Urban Population (%)" },

  { indicator: "NY.GDP.MKTP.CD", label: "GDP (Current US$)" },
  { indicator: "NY.GDP.PCAP.CD", label: "GDP per Capita (US$)" },
  { indicator: "NY.GDP.MKTP.KD.ZG", label: "GDP Growth (%)" },
  { indicator: "FP.CPI.TOTL.ZG", label: "Inflation (CPI %)" },

  { indicator: "SH.H2O.SMDW.ZS", label: "Access to Drinking Water (%)" },
  { indicator: "SH.STA.SMSS.ZS", label: "Access to Sanitation (%)" },
  { indicator: "EN.ATM.CO2E.PC", label: "CO₂ Emissions per Capita" }, // matches your page.tsx key
  { indicator: "EG.ELC.ACCS.ZS", label: "Access to Electricity (%)" },
  { indicator: "AG.LND.FRST.ZS", label: "Forest Area (%)" },
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const iso3Param = (searchParams.get("iso3") || "").trim().toUpperCase();

    const scope: "world" | "country" = iso3Param ? "country" : "world";
    const countryOrAgg = iso3Param ? iso3Param : "WLD"; // World aggregate

    const meta = iso3Param
      ? await fetchCountryMeta(iso3Param)
      : { name: null, region: null };

    const wdi: WdiRow[] = await Promise.all(
      LANDING_METRICS.map(async (m) => {
        const { year, value } = await fetchWorldBankLatestValue(
          countryOrAgg,
          m.indicator
        );
        return {
          indicator_code: m.indicator,
          label: m.label, // ✅ force UI-matching label
          year,
          value,
        };
      })
    );

    const payload: LandingResp = {
      scope,
      iso3: iso3Param || null,
      region: meta.region,
      countryName: meta.name,
      wdi,
      suaYear: null,
      sua: [],
      prodYear: null,
      topCommodities: [],
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
