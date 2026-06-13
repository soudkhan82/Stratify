"use client";

import type { CorporateProfile } from "../_lib/types";

type Props = {
  rows: CorporateProfile[];
  onSelect: (row: CorporateProfile) => void;
};

function clean(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function CorporateDirectoryTable({ rows, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Corporate Directory
          </h2>
          <p className="text-xs text-slate-500">
            Basic company profile data from the GitHub S&amp;P 500 dataset.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {rows.length} shown
        </div>
      </div>

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Ticker</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Sector</th>
              <th className="px-4 py-3 font-semibold">Industry</th>
              <th className="px-4 py-3 font-semibold">Country</th>
              <th className="px-4 py-3 font-semibold">Headquarters</th>
              <th className="px-4 py-3 font-semibold">Exchange</th>
              <th className="px-4 py-3 font-semibold">Source</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.symbol}
                onClick={() => onSelect(row)}
                className="cursor-pointer bg-white transition hover:bg-indigo-50/50"
              >
                <td className="px-4 py-3 font-semibold text-indigo-700">
                  {clean(row.symbol)}
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[240px] truncate font-medium text-slate-900">
                    {clean(row.company_name)}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {clean(row.sector)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="max-w-[260px] truncate">
                    {clean(row.industry)}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {clean(row.country)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="max-w-[280px] truncate">
                    {clean(row.headquarters)}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {clean(row.exchange)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {clean(row.source)}
                  </span>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No companies found for the selected search/filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}