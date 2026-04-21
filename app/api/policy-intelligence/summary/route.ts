import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProgramRow = {
  id: string;
  program_key: string;
  program_name: string;
  sector_key: string | null;
  policy_kind: string | null;
  short_intro: string | null;
  description: string | null;
  global_relevance_rank: number | null;
  success_score: string | number | null;
  replicability_score: string | number | null;
  typical_duration_years: number | null;
  tags: string[] | null;
  is_featured: boolean | null;
  is_active: boolean | null;
  impact_type: string | null;
  gdp_impact_estimate: string | number | null;
  jobs_created_estimate: number | null;
  export_growth_pct: string | number | null;
  time_to_impact_years: number | null;
  implementation_complexity: string | null;
  success_case_country: string | null;
  failure_case_country: string | null;
};

type IndicatorRow = {
  id: string;
  program_id: string;
  indicator_code: string | null;
  indicator_name: string | null;
  rationale: string | null;
  impact_direction: string | null;
  impact_kind: string | null;
  is_primary: boolean | null;
  display_order: number | null;
};

type ExampleRow = {
  id: string;
  program_id: string;
  country_code: string | null;
  country_name: string | null;
  start_year: number | null;
  end_year: number | null;
  success_level: string | null;
  summary: string | null;
  source: string | null;
  source_url: string | null;
  is_featured: boolean | null;
  display_order: number | null;
  jobs_created: number | null;
  gdp_growth_contribution: string | number | null;
  export_growth: string | number | null;
  before_after_summary: string | null;
  key_success_factor: string | null;
  why_it_worked: string | null;
};

type EvidenceRow = {
  id: string;
  program_id: string;
  title: string | null;
  summary: string | null;
  evidence_kind: string | null;
  organization: string | null;
  source_url: string | null;
  publication_year: number | null;
  strength: string | null;
  notes: string | null;
  display_order: number | null;
};

type CountryDimRow = {
  iso3: string | null;
  country_code: string | null;
  region: string | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function summarizeRange(values: Array<number | null>) {
  const nums = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (!nums.length) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;

  return {
    min: round1(min),
    max: round1(max),
    avg: round1(avg),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const region = (searchParams.get("region") || "All").trim();
    const country = (searchParams.get("country") || "All").trim().toUpperCase();
    const sector = (searchParams.get("sector") || "All").trim();
    const kind = (searchParams.get("kind") || "All").trim();
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    let programQuery = supabase
      .from("global_policy_programs")
      .select(
        `
          id,
          program_key,
          program_name,
          sector_key,
          policy_kind,
          short_intro,
          description,
          global_relevance_rank,
          success_score,
          replicability_score,
          typical_duration_years,
          tags,
          is_featured,
          is_active,
          impact_type,
          gdp_impact_estimate,
          jobs_created_estimate,
          export_growth_pct,
          time_to_impact_years,
          implementation_complexity,
          success_case_country,
          failure_case_country
        `,
      )
      .eq("is_active", true)
      .order("global_relevance_rank", { ascending: true })
      .order("program_name", { ascending: true });

    if (sector !== "All") {
      programQuery = programQuery.eq("sector_key", sector);
    }

    if (kind !== "All") {
      programQuery = programQuery.eq("policy_kind", kind);
    }

    const { data: programsData, error: programsError } = await programQuery;

    if (programsError) {
      return NextResponse.json(
        { ok: false, error: programsError.message, programs: [], stats: null },
        { status: 500 },
      );
    }

    const programs = (programsData || []) as ProgramRow[];

    if (!programs.length) {
      return NextResponse.json({
        ok: true,
        source: "global_policy_programs",
        programs: [],
        stats: {
          programs: 0,
          evidence_rows: 0,
          indicator_links: 0,
          country_examples: 0,
        },
      });
    }

    const programIds = programs.map((p) => p.id);

    const [
      { data: indicatorsData, error: indicatorsError },
      { data: examplesData, error: examplesError },
      { data: evidenceData, error: evidenceError },
      { data: countryDimData, error: countryDimError },
    ] = await Promise.all([
      supabase
        .from("program_indicator_links")
        .select(
          `
            id,
            program_id,
            indicator_code,
            indicator_name,
            rationale,
            impact_direction,
            impact_kind,
            is_primary,
            display_order
          `,
        )
        .in("program_id", programIds)
        .order("display_order", { ascending: true }),

      supabase
        .from("program_country_examples")
        .select(
          `
            id,
            program_id,
            country_code,
            country_name,
            start_year,
            end_year,
            success_level,
            summary,
            source,
            source_url,
            is_featured,
            display_order,
            jobs_created,
            gdp_growth_contribution,
            export_growth,
            before_after_summary,
            key_success_factor,
            why_it_worked
          `,
        )
        .in("program_id", programIds)
        .order("display_order", { ascending: true }),

      supabase
        .from("program_global_evidence")
        .select(
          `
            id,
            program_id,
            title,
            summary,
            evidence_kind,
            organization,
            source_url,
            publication_year,
            strength,
            notes,
            display_order
          `,
        )
        .in("program_id", programIds)
        .order("display_order", { ascending: true }),

      supabase.from("v_country_dim_final").select("country_code, region"),
    ]);

    if (indicatorsError || examplesError || evidenceError || countryDimError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            indicatorsError?.message ||
            examplesError?.message ||
            evidenceError?.message ||
            countryDimError?.message ||
            "Failed to load related policy data",
          programs: [],
          stats: null,
        },
        { status: 500 },
      );
    }

    const indicators = (indicatorsData || []) as IndicatorRow[];
    const examples = (examplesData || []) as ExampleRow[];
    const evidence = (evidenceData || []) as EvidenceRow[];
    const countryDim = (countryDimData || []) as CountryDimRow[];

    const regionByIso3 = new Map<string, string>();
    for (const row of countryDim) {
      const key = String(row.country_code || "")
        .trim()
        .toUpperCase();
      const value = String(row.region || "").trim();
      if (key && value) regionByIso3.set(key, value);
    }

    const indicatorsByProgram = new Map<string, IndicatorRow[]>();
    const examplesByProgram = new Map<string, ExampleRow[]>();
    const evidenceByProgram = new Map<string, EvidenceRow[]>();

    for (const row of indicators) {
      const arr = indicatorsByProgram.get(row.program_id) || [];
      arr.push(row);
      indicatorsByProgram.set(row.program_id, arr);
    }

    for (const row of examples) {
      const arr = examplesByProgram.get(row.program_id) || [];
      arr.push(row);
      examplesByProgram.set(row.program_id, arr);
    }

    for (const row of evidence) {
      const arr = evidenceByProgram.get(row.program_id) || [];
      arr.push(row);
      evidenceByProgram.set(row.program_id, arr);
    }

    let enrichedPrograms = programs.map((program) => {
      const pIndicators = indicatorsByProgram.get(program.id) || [];
      const pExamplesAll = examplesByProgram.get(program.id) || [];
      const pEvidence = evidenceByProgram.get(program.id) || [];

      const pExamplesByRegion =
        region === "All"
          ? pExamplesAll
          : pExamplesAll.filter((row) => {
              const rowRegion = regionByIso3.get(
                String(row.country_code || "").toUpperCase(),
              );
              return rowRegion === region;
            });

      const pExamplesFiltered =
        country === "All"
          ? pExamplesByRegion
          : pExamplesByRegion.filter(
              (row) => String(row.country_code || "").toUpperCase() === country,
            );

      const rangeSource = pExamplesFiltered.length
        ? pExamplesFiltered
        : pExamplesAll;

      const jobsRange = summarizeRange(
        rangeSource.map((x) => toNumber(x.jobs_created)),
      );
      const exportRange = summarizeRange(
        rangeSource.map((x) => toNumber(x.export_growth)),
      );
      const gdpRange = summarizeRange(
        rangeSource.map((x) => toNumber(x.gdp_growth_contribution)),
      );

      const evidenceSummary = pEvidence[0]?.summary ?? null;

      return {
        id: program.id,
        program_key: program.program_key,
        program_name: program.program_name,
        sector_key: program.sector_key,
        kind: program.policy_kind,
        short_intro: program.short_intro ?? null,
        program_description: program.description ?? null,
        success_score: toNumber(program.success_score),
        replicability_score: toNumber(program.replicability_score),
        global_relevance_rank: program.global_relevance_rank,
        typical_duration_years: program.typical_duration_years,
        tags: program.tags ?? [],
        is_featured: Boolean(program.is_featured),
        impact_type: program.impact_type ?? null,
        gdp_impact_estimate: toNumber(program.gdp_impact_estimate),
        jobs_created_estimate: toNumber(program.jobs_created_estimate),
        export_growth_pct: toNumber(program.export_growth_pct),
        time_to_impact_years: program.time_to_impact_years,
        implementation_complexity: program.implementation_complexity ?? null,
        success_case_country: program.success_case_country ?? null,
        failure_case_country: program.failure_case_country ?? null,

        evidence_rows: pEvidence.length,
        indicator_links: pIndicators.length,
        country_examples: pExamplesFiltered.length,

        indicators: pIndicators,
        country_examples_rows: pExamplesAll,
        country_examples_filtered: pExamplesFiltered,
        evidence_rows_detail: pEvidence,

        implementation_model: program.short_intro ?? null,
        expected_outcomes: program.impact_type
          ? `Expected impact areas: ${program.impact_type}`
          : null,
        risks: program.failure_case_country
          ? `Implementation risk is implied by weaker outcomes in cases such as ${program.failure_case_country}.`
          : null,
        evidenceSummary,

        quantitative_outcomes: {
          jobs_created_estimate: toNumber(program.jobs_created_estimate),
          export_growth_pct: toNumber(program.export_growth_pct),
          gdp_impact_estimate: toNumber(program.gdp_impact_estimate),
          jobs_created_range: jobsRange,
          export_growth_range: exportRange,
          gdp_growth_contribution_range: gdpRange,
        },

        has_country_match: pExamplesFiltered.length > 0,
        has_region_match: pExamplesByRegion.length > 0,
      };
    });

    // Region should be a soft filter only if it has matches, but
    // for dashboard usefulness we keep programs visible even with zero examples.
    // So we do NOT remove programs by region/country.

    if (search) {
      enrichedPrograms = enrichedPrograms.filter((program) => {
        const haystack = [
          program.program_name,
          program.program_key,
          program.sector_key,
          program.kind,
          program.short_intro,
          program.program_description,
          program.evidenceSummary,
          ...(program.tags || []),
          ...program.indicators.map(
            (x: IndicatorRow) => x.indicator_name || "",
          ),
          ...program.country_examples_rows.map(
            (x: ExampleRow) => x.country_name || "",
          ),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      });
    }

    const stats = enrichedPrograms.reduce(
      (acc, program) => {
        acc.programs += 1;
        acc.evidence_rows += program.evidence_rows;
        acc.indicator_links += program.indicator_links;
        acc.country_examples += program.country_examples;
        return acc;
      },
      {
        programs: 0,
        evidence_rows: 0,
        indicator_links: 0,
        country_examples: 0,
      },
    );

    return NextResponse.json({
      ok: true,
      source: "global_policy_programs+related_tables",
      filters_applied: {
        region,
        country,
        sector,
        kind,
        search,
      },
      programs: enrichedPrograms,
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown server error",
        programs: [],
        stats: null,
      },
      { status: 500 },
    );
  }
}
