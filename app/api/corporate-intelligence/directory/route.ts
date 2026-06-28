import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scope = "sp500" | "global" | "all";

type CompanyRow = {
  symbol: string;
  name: string | null;
  sector: string | null;
  sub_industry: string | null;
  headquarters: string | null;
  date_added: string | null;
  cik: string | null;
  founded: string | null;
  source: string | null;
};

type ProfileRow = {
  symbol: string;
  company_name: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  employees: number | string | null;
  business_summary: string | null;
  source: string | null;
  fetched_at: string | null;
  hq_lat: number | null;
  hq_lng: number | null;
  geocode_provider: string | null;
  geocode_status: string | null;
  geocode_query: string | null;
  geocoded_at: string | null;

  iso2?: string | null;
  iso3?: string | null;
  region?: string | null;
  source_universe?: string | null;
  source_index?: string | null;
  wikidata_qid?: string | null;
  wikipedia_title?: string | null;
  commons_category?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  market_cap?: number | string | null;
  currency?: string | null;
  data_quality_score?: number | string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeScope(value: string | null): Scope {
  const scope = clean(value).toLowerCase();

  if (scope === "global") return "global";
  if (scope === "all") return "all";

  return "sp500";
}

function applyScope(query: any, scope: Scope) {
  if (scope === "sp500") {
    return query.or("source_universe.eq.sp500,source.eq.github_sp500");
  }

  if (scope === "global") {
    return query.or(
      "source_universe.eq.global_large_caps,source_universe.eq.global_index,source.eq.wikidata_global,source.eq.global_large_caps",
    );
  }

  return query;
}

function fallbackHeadquarters(row: ProfileRow) {
  const address = clean(row.address);
  if (address) return address;

  const city = clean(row.city);
  const state = clean(row.state);
  const country = clean(row.country || "United States");

  return [city, state, country].filter(Boolean).join(", ") || null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = normalizeScope(searchParams.get("scope"));

    const profileQuery = applyScope(
      supabase
        .from("ci_corporate_profiles")
        .select(
          `
          symbol,
          company_name,
          exchange,
          sector,
          industry,
          country,
          city,
          state,
          address,
          website,
          employees,
          business_summary,
          source,
          fetched_at,
          hq_lat,
          hq_lng,
          geocode_provider,
          geocode_status,
          geocode_query,
          geocoded_at,
          iso2,
          iso3,
          region,
          source_universe,
          source_index,
          wikidata_qid,
          wikipedia_title,
          commons_category,
          logo_url,
          image_url,
          market_cap,
          currency,
          data_quality_score
        `,
        )
        .order("symbol", { ascending: true }),
      scope,
    );

    const [profilesRes, companiesRes] = await Promise.all([
      profileQuery,
      supabase
        .from("ci_companies")
        .select(
          "symbol, name, sector, sub_industry, headquarters, date_added, cik, founded, source",
        ),
    ]);

    if (profilesRes.error) throw profilesRes.error;

    const profiles = (profilesRes.data ?? []) as ProfileRow[];
    const companies = companiesRes.error
      ? []
      : ((companiesRes.data ?? []) as CompanyRow[]);

    const companyMap = new Map(
      companies.map((company) => [
        clean(company.symbol).toUpperCase(),
        company,
      ]),
    );

    const rows = profiles
      .filter((profile) => clean(profile.symbol))
      .map((profile) => {
        const symbol = clean(profile.symbol).toUpperCase();
        const company = companyMap.get(symbol);

        return {
          symbol,
          company_name: profile.company_name || company?.name || symbol,
          sector: profile.sector || company?.sector || null,
          industry: profile.industry || company?.sub_industry || null,
          country: profile.country || (scope === "sp500" ? "United States" : null),
          city: profile.city || null,
          state: profile.state || null,
          headquarters:
            fallbackHeadquarters(profile) || company?.headquarters || null,
          exchange:
            profile.exchange || (scope === "sp500" ? "NYSE/Nasdaq" : null),
          source: profile.source || company?.source || null,
          fetched_at: profile.fetched_at || null,
          date_added: company?.date_added || null,
          cik: company?.cik || null,
          founded: company?.founded || null,
          website: profile.website || null,
          employees: profile.employees || null,
          business_summary: profile.business_summary || null,
          hq_lat: profile.hq_lat ?? null,
          hq_lng: profile.hq_lng ?? null,
          geocode_provider: profile.geocode_provider || null,
          geocode_status: profile.geocode_status || null,
          geocode_query: profile.geocode_query || null,
          geocoded_at: profile.geocoded_at || null,

          iso2: profile.iso2 || null,
          iso3: profile.iso3 || null,
          region: profile.region || null,
          source_universe:
            profile.source_universe || (profile.source === "github_sp500" ? "sp500" : null),
          source_index:
            profile.source_index || (profile.source === "github_sp500" ? "S&P 500" : null),
          wikidata_qid: profile.wikidata_qid || null,
          wikipedia_title: profile.wikipedia_title || null,
          commons_category: profile.commons_category || null,
          logo_url: profile.logo_url || null,
          image_url: profile.image_url || null,
          market_cap: profile.market_cap ?? null,
          currency: profile.currency || null,
          data_quality_score: profile.data_quality_score ?? null,
        };
      })
      .sort((a, b) =>
        String(a.company_name).localeCompare(String(b.company_name)),
      );

    return NextResponse.json({
      ok: true,
      scope,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load corporate directory.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        count: 0,
        data: [],
      },
      { status: 500 },
    );
  }
}
