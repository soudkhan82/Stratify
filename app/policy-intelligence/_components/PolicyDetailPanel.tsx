import type { CifResponse, CountryOption } from "../_types/policy";
import EmptyPolicyState from "./EmptyPolicyState";
import PolicyEvidenceTable from "./PolicyEvidenceTable";

type PolicyProgram = any;

type Props = {
  program: PolicyProgram | null;
  selectedCountryMeta: CountryOption | null;
  cif: CifResponse | null;
  loadingCif?: boolean;
  cifError?: string;
};

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function RangeRow({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value?: { min: number; max: number; avg: number } | null;
  suffix?: string;
}) {
  if (!value) return null;
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-2 text-sm text-slate-700">
        Avg:{" "}
        <span className="font-semibold">
          {value.avg}
          {suffix}
        </span>{" "}
        <span className="text-slate-500">
          (range {value.min}
          {suffix} to {value.max}
          {suffix})
        </span>
      </div>
    </div>
  );
}

export default function PolicyDetailPanel({
  program,
  selectedCountryMeta,
  cif,
  loadingCif,
  cifError,
}: Props) {
  if (!program) {
    return (
      <EmptyPolicyState
        title="No program selected"
        message="Select a policy program from the list to inspect its analytical detail."
      />
    );
  }

  const q = program.quantitative_outcomes || {};
  const examples = program.country_examples_filtered?.length
    ? program.country_examples_filtered
    : program.country_examples_rows || [];
  const evidence = program.evidence_rows_detail || [];
  const indicators = program.indicators || [];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-4">
        <div className="rounded-3xl bg-slate-950 p-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
            Selected program
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {program.program_name}
          </h2>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-slate-300">
            {program.program_key}
          </p>

          <p className="mt-4 text-sm leading-6 text-slate-200">
            {program.program_description ||
              "No detailed description available."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatChip label="Sector" value={program.sector_key || "—"} />
            <StatChip label="Kind" value={program.kind || "—"} />
            <StatChip
              label="Success score"
              value={program.success_score ?? "—"}
            />
            <StatChip
              label="Replicability"
              value={program.replicability_score ?? "—"}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Implementation model
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {program.implementation_model ||
              program.short_intro ||
              "Not available."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatChip
              label="Time to impact"
              value={
                program.time_to_impact_years
                  ? `${program.time_to_impact_years} yrs`
                  : "—"
              }
            />
            <StatChip
              label="Complexity"
              value={program.implementation_complexity || "—"}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Quantitative outcomes
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="grid grid-cols-3 gap-3">
              <StatChip
                label="Jobs estimate"
                value={q.jobs_created_estimate?.toLocaleString?.() || "—"}
              />
              <StatChip
                label="Export growth"
                value={
                  q.export_growth_pct != null ? `${q.export_growth_pct}%` : "—"
                }
              />
              <StatChip
                label="GDP impact"
                value={
                  q.gdp_impact_estimate != null
                    ? `${q.gdp_impact_estimate}%`
                    : "—"
                }
              />
            </div>

            <RangeRow
              label="Country example jobs created"
              value={q.jobs_created_range}
            />
            <RangeRow
              label="Country example export growth"
              value={q.export_growth_range}
              suffix="%"
            />
            <RangeRow
              label="Country example GDP contribution"
              value={q.gdp_growth_contribution_range}
              suffix="%"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Linked indicators
          </p>
          <div className="mt-3 space-y-3">
            {indicators.length ? (
              indicators.map((item: any) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {item.indicator_name || item.indicator_code}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {item.indicator_code} · {item.impact_direction}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {item.rationale || "No rationale available."}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No linked indicators available.
              </p>
            )}
          </div>
        </div>

        <PolicyEvidenceTable
          evidenceSummary={program.evidence_summary}
          risks={program.risks}
        />

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Country examples
          </p>

          <div className="mt-3 space-y-3">
            {examples.length ? (
              examples.map((row: any) => (
                <div key={row.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {row.country_name} ({row.country_code})
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {row.success_level} · {row.start_year ?? "—"}
                      </div>
                    </div>

                    <div className="text-right text-sm text-slate-700">
                      <div>
                        Jobs: {row.jobs_created?.toLocaleString?.() || "—"}
                      </div>
                      <div>
                        Exports:{" "}
                        {row.export_growth ? `${row.export_growth}%` : "—"}
                      </div>
                      <div>
                        GDP:{" "}
                        {row.gdp_growth_contribution
                          ? `${row.gdp_growth_contribution}%`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {row.summary}
                  </p>

                  {(row.before_after_summary ||
                    row.key_success_factor ||
                    row.why_it_worked) && (
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {row.before_after_summary ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            Before/after:{" "}
                          </span>
                          {row.before_after_summary}
                        </div>
                      ) : null}
                      {row.key_success_factor ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            Key success factor:{" "}
                          </span>
                          {row.key_success_factor}
                        </div>
                      ) : null}
                      {row.why_it_worked ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            Why it worked:{" "}
                          </span>
                          {row.why_it_worked}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No country examples available.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Country intelligence feed
          </p>

          <div className="mt-3 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {selectedCountryMeta
                ? `${selectedCountryMeta.country} (${selectedCountryMeta.iso3})`
                : "No country selected"}
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              {selectedCountryMeta
                ? `Region: ${selectedCountryMeta.region}`
                : "Choose a country to call the CIF endpoint."}
            </p>

            {loadingCif ? (
              <p className="mt-3 text-sm text-slate-600">
                Loading country intelligence...
              </p>
            ) : cifError ? (
              <p className="mt-3 text-sm text-rose-600">{cifError}</p>
            ) : selectedCountryMeta ? (
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <div>
                  <span className="font-semibold text-slate-900">
                    Message:{" "}
                  </span>
                  {cif?.message || "No message returned"}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Rows: </span>
                  {Array.isArray(cif?.rows) ? cif?.rows.length : 0}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">
                    Summary:{" "}
                  </span>
                  {cif?.summary ? "Available" : "Not available"}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
