"use client";

type Row = {
  program: string;
  country: string;
  status: string;
  evidence: number;
  indicators: number;
};

type Props = {
  sector: string;
  country: string;
  rows: Row[];
};

export default function PolicyProgramsTable({ sector, country, rows }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">
          Programs registry
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Tracked programs for {country} under the {sector.toLowerCase()}{" "}
          sector.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Program</th>
              <th className="px-4 py-3 font-semibold">Country</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Evidence</th>
              <th className="px-4 py-3 font-semibold">Indicators</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.program}-${i}`}
                className="border-t border-slate-200"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {row.program}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.country}</td>
                <td className="px-4 py-3 text-slate-600">{row.status}</td>
                <td className="px-4 py-3 text-slate-600">{row.evidence}</td>
                <td className="px-4 py-3 text-slate-600">{row.indicators}</td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  No programs found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
