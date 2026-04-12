"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const VALID_WEO_CODES = [
  "NGDP_RPCH",
  "NGDPD",
  "PCPIPCH",
  "LUR",
  "BCA_NGDPD",
  "GGXONLB_NGDP",
  "LP",
  "NGDPDPC",
];

export default function DatasetTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dataset = String(searchParams.get("dataset") || "wdi").toLowerCase();

  function changeDataset(nextDataset: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dataset", nextDataset);

    const currentIndicator = String(
      params.get("indicator") || "",
    ).toUpperCase();

    if (nextDataset === "weo") {
      if (!VALID_WEO_CODES.includes(currentIndicator)) {
        params.set("indicator", "NGDPD");
      }
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-3 rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
      <button
        onClick={() => changeDataset("wdi")}
        className={`rounded-2xl px-6 py-3 font-semibold transition ${
          dataset === "wdi"
            ? "bg-slate-900 text-white"
            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        WDI
      </button>

      <button
        onClick={() => changeDataset("fao")}
        className={`rounded-2xl px-6 py-3 font-semibold transition ${
          dataset === "fao"
            ? "bg-slate-900 text-white"
            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        Food & Agriculture Org
      </button>

      <button
        onClick={() => changeDataset("weo")}
        className={`rounded-2xl px-6 py-3 font-semibold transition ${
          dataset === "weo"
            ? "bg-indigo-600 text-white"
            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        IMF (WEO)
      </button>
    </div>
  );
}
