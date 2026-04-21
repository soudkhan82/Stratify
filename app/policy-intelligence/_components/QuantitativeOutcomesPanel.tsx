type Props = {
  expectedOutcomes: string | null;
};

export default function QuantitativeOutcomesPanel({ expectedOutcomes }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
        Quantitative outcomes
      </p>
      <div className="mt-3 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm leading-6 text-slate-700">
          {expectedOutcomes ||
            "No structured quantitative outcomes are being returned by the API yet."}
        </p>
      </div>
    </div>
  );
}
