import type { PolicyProgram } from "../_types/policy";
import EmptyPolicyState from "./EmptyPolicyState";
import PolicyProgramCard from "./PolicyProgramCard";

type Props = {
  programs: PolicyProgram[];
  selectedProgramKey: string;
  onSelect: (programKey: string) => void;
};

export default function PolicyProgramsList({
  programs,
  selectedProgramKey,
  onSelect,
}: Props) {
  if (!programs.length) {
    return (
      <EmptyPolicyState
        title="No programs match current filters"
        message="Try resetting sector, kind, or search filters."
      />
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Programs
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            Filtered program universe
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Compact analytical view of visible policy programs.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {programs.length} visible
        </div>
      </div>

      <div className="space-y-3">
        {programs.map((program) => (
          <PolicyProgramCard
            key={program.program_key}
            program={program}
            active={selectedProgramKey === program.program_key}
            onSelect={() => onSelect(program.program_key)}
          />
        ))}
      </div>
    </div>
  );
}
