import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BATCH_LIMIT = 100;
const MAX_BATCH_LIMIT = 503;

type CompanyRow = {
  symbol: string;
  name: string;
  sector: string | null;
  sub_industry: string | null;
  headquarters: string | null;
};

function parseHeadquarters(value?: string | null) {
  if (!value) {
    return {
      city: null,
      state: null,
      country: "United States",
      address: null,
    };
  }

  const cleaned = value.trim();
  const parts = cleaned.split(",").map((x) => x.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      city: parts[0] ?? null,
      state: parts[1] ?? null,
      country: parts[2] ?? "United States",
      address: cleaned,
    };
  }

  return {
    city: parts[0] ?? null,
    state: null,
    country: "United States",
    address: cleaned,
  };
}

export async function POST(request: Request) {
  let limit = DEFAULT_BATCH_LIMIT;

  try {
    const body = await request.json().catch(() => null);

    if (body?.limit) {
      const requested = Number(body.limit);
      if (Number.isFinite(requested) && requested > 0) {
        limit = Math.min(requested, MAX_BATCH_LIMIT);
      }
    }
  } catch {
    limit = DEFAULT_BATCH_LIMIT;
  }

  await supabase.rpc("ci_insert_refresh_log", {
    p_refresh_type: "github_profile_refresh",
    p_status: "running",
    p_total_records: 0,
    p_success_count: 0,
    p_failed_count: 0,
    p_message: `Started GitHub-based corporate profile refresh. Limit: ${limit}.`,
    p_finished_at: null,
  });

  try {
    const { data: companies, error: companiesError } = await supabase
      .from("ci_companies")
      .select("symbol, name, sector, sub_industry, headquarters")
      .order("symbol", { ascending: true });

    if (companiesError) throw companiesError;

    const allCompanies = (companies ?? []) as CompanyRow[];

    if (!allCompanies.length) {
      throw new Error("No companies found. Run S&P 500 import first.");
    }

    const { data: existing, error: existingError } = await supabase
      .from("ci_corporate_profiles")
      .select("symbol, fetched_at")
      .eq("source", "github_sp500");

    if (existingError) throw existingError;

    const existingMap = new Map<string, string | null>(
      (existing ?? []).map((x) => [x.symbol, x.fetched_at])
    );

    const batchCompanies = allCompanies
      .sort((a, b) => {
        const aTime = existingMap.get(a.symbol);
        const bTime = existingMap.get(b.symbol);

        if (!aTime && bTime) return -1;
        if (aTime && !bTime) return 1;
        if (!aTime && !bTime) return a.symbol.localeCompare(b.symbol);

        return new Date(aTime).getTime() - new Date(bTime).getTime();
      })
      .slice(0, limit);

    const payload = batchCompanies.map((company) => {
      const location = parseHeadquarters(company.headquarters);

      return {
        symbol: company.symbol,
        company_name: company.name,
        exchange: "NYSE/Nasdaq",
        sector: company.sector,
        industry: company.sub_industry,
        country: location.country,
        city: location.city,
        state: location.state,
        address: location.address,
        website: null,
        employees: null,
        business_summary: null,
        source: "github_sp500",
        raw_payload: company,
        fetched_at: new Date().toISOString(),
      };
    });

    let affected = 0;

    if (payload.length) {
      const { data: rpcAffected, error: rpcError } = await supabase.rpc(
        "ci_upsert_corporate_profiles",
        { payload }
      );

      if (rpcError) throw rpcError;

      affected = Number(rpcAffected ?? 0);
    }

    await supabase.rpc("ci_insert_refresh_log", {
      p_refresh_type: "github_profile_refresh",
      p_status: "success",
      p_total_records: batchCompanies.length,
      p_success_count: payload.length,
      p_failed_count: 0,
      p_message: `Processed ${batchCompanies.length}. Success: ${payload.length}. Affected: ${affected}.`,
      p_finished_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      source: "github_sp500",
      processed: batchCompanies.length,
      successCount: payload.length,
      failedCount: 0,
      affected,
      message: "Corporate profiles populated from S&P 500 GitHub dataset.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown corporate profile refresh error.";

    await supabase.rpc("ci_insert_refresh_log", {
      p_refresh_type: "github_profile_refresh",
      p_status: "failed",
      p_total_records: 0,
      p_success_count: 0,
      p_failed_count: 1,
      p_message: message,
      p_finished_at: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ok: false,
        source: "github_sp500",
        error: message,
      },
      { status: 500 }
    );
  }
}
