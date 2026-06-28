import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEED = [
  ["7203.T", "Toyota Motor Corporation", "Tokyo Stock Exchange", "Consumer Discretionary", "Automobiles", "Japan", "Toyota", "Asia Pacific", 35.0824, 137.1563, "https://global.toyota"],
  ["005930.KS", "Samsung Electronics", "Korea Exchange", "Information Technology", "Consumer Electronics and Semiconductors", "South Korea", "Suwon", "Asia Pacific", 37.2636, 127.0286, "https://www.samsung.com"],
  ["TSM.TW", "Taiwan Semiconductor Manufacturing Company", "Taiwan Stock Exchange", "Information Technology", "Semiconductors", "Taiwan", "Hsinchu", "Asia Pacific", 24.8138, 120.9675, "https://www.tsmc.com"],
  ["NESN.SW", "Nestlé", "SIX Swiss Exchange", "Consumer Staples", "Food Products", "Switzerland", "Vevey", "Europe", 46.4628, 6.843, "https://www.nestle.com"],
  ["SAP.DE", "SAP", "Frankfurt Stock Exchange", "Information Technology", "Enterprise Software", "Germany", "Walldorf", "Europe", 49.3064, 8.6428, "https://www.sap.com"],
  ["MC.PA", "LVMH", "Euronext Paris", "Consumer Discretionary", "Luxury Goods", "France", "Paris", "Europe", 48.8566, 2.3522, "https://www.lvmh.com"],
  ["ASML.AS", "ASML Holding", "Euronext Amsterdam", "Information Technology", "Semiconductor Equipment", "Netherlands", "Veldhoven", "Europe", 51.4181, 5.4027, "https://www.asml.com"],
  ["SHEL.L", "Shell", "London Stock Exchange", "Energy", "Integrated Oil and Gas", "United Kingdom", "London", "Europe", 51.5072, -0.1276, "https://www.shell.com"],
  ["RELIANCE.NS", "Reliance Industries", "National Stock Exchange of India", "Energy", "Conglomerate and Energy", "India", "Mumbai", "Asia Pacific", 19.076, 72.8777, "https://www.ril.com"],
  ["CBA.AX", "Commonwealth Bank of Australia", "Australian Securities Exchange", "Financials", "Banking", "Australia", "Sydney", "Asia Pacific", -33.8688, 151.2093, "https://www.commbank.com.au"],
  ["SHOP.TO", "Shopify", "Toronto Stock Exchange", "Information Technology", "E-Commerce Software", "Canada", "Ottawa", "North America", 45.4215, -75.6972, "https://www.shopify.com"],
  ["2222.SR", "Saudi Aramco", "Tadawul", "Energy", "Integrated Oil and Gas", "Saudi Arabia", "Dhahran", "Middle East", 26.2361, 50.0393, "https://www.aramco.com"]
] as const;

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "seed-global-import",
    availableRecords: SEED.length
  });
}

export async function POST() {
  const now = new Date().toISOString();

  const payload = SEED.map((r) => {
    const [symbol, company_name, exchange, sector, industry, country, city, region, hq_lat, hq_lng, website] = r;

    return {
      symbol,
      company_name,
      exchange,
      sector,
      industry,
      country,
      city,
      state: null,
      address: `${city}, ${country}`,
      website,
      employees: null,
      business_summary: null,
      source: "global_seed",
      raw_payload: { source_note: "Controlled Global Large Caps seed" },
      fetched_at: now,
      hq_lat,
      hq_lng,
      geocode_provider: "seed",
      geocode_status: "success",
      geocode_query: `${city}, ${country}`,
      geocoded_at: now,
      iso2: null,
      iso3: null,
      region,
      source_universe: "global_large_caps",
      source_index: "Global Large Caps Seed",
      wikidata_qid: null,
      wikipedia_title: company_name,
      commons_category: null,
      logo_url: null,
      image_url: null,
      market_cap: null,
      currency: null,
      data_quality_score: 80
    };
  });

  const { data, error } = await supabase.rpc("ci_upsert_corporate_profiles", {
    payload
  });

  if (error) {
    return NextResponse.json(
      { ok: false, step: "ci_upsert_corporate_profiles", error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    source: "global_seed",
    imported: payload.length,
    affected: Number(data ?? payload.length),
    message: "Global seed imported."
  });
}

