"use client";

import { usePathname } from "next/navigation";
import { cleanText } from "@/app/lib/cleanText";

const SOURCE_NOTES = {
  home:
    "Data sources: World Bank World Development Indicators (WDI), World Bank Open Data, UNData, FAOSTAT, IMF public datasets, and Natural Earth / world-atlas boundaries. Updated periodically for analytical use.",

  debt:
    "Data sources: IMF World Economic Outlook (WEO) - General Government Gross Debt, IMF Global Debt Database, World Bank International Debt Statistics (IDS), and World Bank WDI debt indicators. Updated periodically for analytical use.",

  energy:
    "Data sources: Our World in Data Energy Dataset, Energy Institute Statistical Review of World Energy, World Bank WDI energy indicators, and IEA public energy statistics. Updated periodically for analytical use.",

  faostat:
    "Data sources: FAOSTAT Crops and Livestock Products, FAOSTAT Production, FAOSTAT Food Balances / SUA, FAOSTAT Trade, FAOSTAT Land Use, and FAOSTAT Emissions datasets. Updated periodically for analytical use.",

  fiscal:
    "Data sources: IMF World Economic Outlook (WEO), IMF Government Finance Statistics (GFS), IMF Fiscal Monitor, World Bank WDI fiscal indicators, World Bank IDS, and UN National Accounts / UNData. Updated periodically for analytical use.",

  corporate:
    "Data sources: S&P 500 constituent universe, SEC EDGAR company submissions, company investor relations / public filings, and curated public market-profile datasets. Updated periodically for analytical use.",

  credits:
    "Product background: Stratify Analytics is built from public development, fiscal, energy, agriculture, debt, and corporate intelligence datasets curated for analytical use.",

  default:
    "Data sources: World Bank WDI, IMF WEO / GFS, FAOSTAT, UNData, SEC EDGAR, and curated public datasets. Updated periodically for analytical use.",
};

function getSourceNote(pathname: string) {
  const path = pathname.toLowerCase();

  if (path === "/" || path.startsWith("/world")) return SOURCE_NOTES.home;
  if (path.startsWith("/debt")) return SOURCE_NOTES.debt;
  if (path.startsWith("/energy")) return SOURCE_NOTES.energy;
  if (path.startsWith("/faostat") || path.startsWith("/fao")) return SOURCE_NOTES.faostat;
  if (path.startsWith("/fiscal")) return SOURCE_NOTES.fiscal;
  if (path.startsWith("/corporate-intelligence")) return SOURCE_NOTES.corporate;
  if (path.startsWith("/credits")) return SOURCE_NOTES.credits;

  return SOURCE_NOTES.default;
}

export default function DataSourceNote() {
  const pathname = usePathname() || "/";

  return (
    <div className="w-full border-b border-slate-200 bg-white px-4 py-2 text-center text-[12px] font-semibold leading-5 text-slate-600 shadow-sm sm:px-6">
      {cleanText(getSourceNote(pathname))}
    </div>
  );
}
