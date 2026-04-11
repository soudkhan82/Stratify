"use client";

type Row = {
  source: string;
  program: string;
  evidence_type: string;
  summary: string;
};

type Props = {
  sector: string;
  rows: Row[];
};

export default function PolicyEvidenceTable({ sector, rows }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">
          Evidence registry
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Qualitative and quantitative evidence mapped to the{" "}
          {sector.toLowerCase()} sector.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Program</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.program}-${row.source}-${i}`}
                className="border-t border-slate-200"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {row.source}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.program}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.evidence_type}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.summary}</td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  No evidence found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
