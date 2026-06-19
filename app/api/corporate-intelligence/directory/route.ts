import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function fallbackHeadquarters(row: ProfileRow) {
  const address = clean(row.address);
  if (address) return address;

  const city = clean(row.city);
  const state = clean(row.state);
  const country = clean(row.country || "United States");

  return [city, state, country].filter(Boolean).join(", ") || null;
}

export async function GET() {
  try {
    const [profilesRes, companiesRes] = await Promise.all([
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
          geocoded_at
        `,
        )
        .order("symbol", { ascending: true }),

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

          country: profile.country || "United States",

          city: profile.city || null,

          state: profile.state || null,

          headquarters:
            fallbackHeadquarters(profile) || company?.headquarters || null,

          exchange: profile.exchange || "NYSE/Nasdaq",

          source: profile.source || company?.source || "github_sp500",

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
        };
      })
      .sort((a, b) =>
        String(a.company_name).localeCompare(String(b.company_name)),
      );

    return NextResponse.json({
      ok: true,
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
