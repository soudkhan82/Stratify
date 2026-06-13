const fs = require("fs");
const path = require("path");

const root = process.cwd();
const backupDir = path.join(root, "backup-before-text-source-fix");

const excludeDirs = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".vercel",
  "coverage",
  "backup-before-text-source-fix",
]);

const allowedExt = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function shouldSkip(fullPath) {
  const parts = fullPath.split(path.sep);
  return parts.some((p) => excludeDirs.has(p));
}

function walk(dir, out = []) {
  if (shouldSkip(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (shouldSkip(full)) continue;

    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && allowedExt.has(path.extname(entry.name))) {
      out.push(full);
    }
  }

  return out;
}

function backupFile(file) {
  const rel = path.relative(root, file);
  const dest = path.join(backupDir, rel);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(file, dest);
}

function cleanSourceText(content) {
  return content
    // mojibake bullets / separators
    .replace(/\u00e2\u20ac\u00a2/g, "|")
    .replace(/\u00c2\u00b7/g, "|")
    .replace(/\u2022/g, "|")
    .replace(/\u00b7/g, "|")

    // mojibake dashes
    .replace(/\u00e2\u20ac\u201c/g, "-")
    .replace(/\u00e2\u20ac\u201d/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")

    // mojibake ellipsis
    .replace(/\u00e2\u20ac\u00a6/g, "...")
    .replace(/\u2026/g, "...")

    // mojibake apostrophes / quotes
    .replace(/\u00e2\u20ac\u02dc/g, "'")
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, '"')
    .replace(/\u00e2\u20ac[\u009d]/g, '"')
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')

    // mojibake Delta / arrows / check marks
    .replace(/\u00ce\u201d/g, "Delta")
    .replace(/\u0394/g, "Delta")
    .replace(/\u00e2\u2020\u2019/g, "->")
    .replace(/\u2192/g, "->")
    .replace(/\u00e2\u0153\u201c/g, "✓")

    // accents / country mojibake
    .replace(/Cura\u00c3\u00a7ao/g, "Curacao")
    .replace(/Cura\u00e7ao/g, "Curacao")
    .replace(/\u00c3\u00a7/g, "c")
    .replace(/\u00c3\u00a9/g, "e")
    .replace(/\u00c3\u00a8/g, "e")
    .replace(/\u00c3\u00a1/g, "a")
    .replace(/\u00c3\u00ad/g, "i")
    .replace(/\u00c3\u00b3/g, "o")
    .replace(/\u00c3\u00ba/g, "u")
    .replace(/\u00c3\u00b1/g, "n")

    // leftover artifacts
    .replace(/\u00c2/g, "")
    .replace(/\ufffd/g, "");
}

ensureDir(backupDir);

const files = walk(root);

for (const file of files) {
  backupFile(file);

  const oldContent = fs.readFileSync(file, "utf8");
  const newContent = cleanSourceText(oldContent);

  if (newContent !== oldContent) {
    fs.writeFileSync(file, newContent, "utf8");
    console.log("cleaned:", path.relative(root, file));
  }
}

const appLibDir = path.join(root, "app", "lib");
ensureDir(appLibDir);

fs.writeFileSync(
  path.join(appLibDir, "cleanText.ts"),
`export function cleanText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;

  return String(value)
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")

    .replace(/\\u00e2\\u20ac\\u00a2/g, " | ")
    .replace(/\\u00e2\\u20ac\\u201c/g, "-")
    .replace(/\\u00e2\\u20ac\\u201d/g, "-")
    .replace(/\\u00e2\\u20ac\\u00a6/g, "...")
    .replace(/\\u00e2\\u20ac\\u02dc/g, "'")
    .replace(/\\u00e2\\u20ac\\u2122/g, "'")
    .replace(/\\u00e2\\u20ac\\u0153/g, '"')
    .replace(/\\u00c2\\u00b7/g, " | ")
    .replace(/\\u00c2/g, "")
    .replace(/\\u00ce\\u201d/g, "Delta")
    .replace(/\\u00e2\\u2020\\u2019/g, "->")
    .replace(/Cura\\u00c3\\u00a7ao/g, "Curacao")
    .replace(/\\u00c3\\u00a7/g, "c")
    .replace(/\\u00c3\\u00a9/g, "e")
    .replace(/\\u00c3\\u00a8/g, "e")
    .replace(/\\u00c3\\u00a1/g, "a")
    .replace(/\\u00c3\\u00ad/g, "i")
    .replace(/\\u00c3\\u00b3/g, "o")
    .replace(/\\u00c3\\u00ba/g, "u")
    .replace(/\\u00c3\\u00b1/g, "n")

    .replace(/[•·]/g, " | ")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/Δ/g, "Delta")

    .replace(/\\uFEFF/g, "")
    .replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, "")
    .replace(/[�]/g, "")
    .replace(/[€£¥¢©®™§¶]/g, "")

    .replace(/\\s*\\|\\s*/g, " | ")
    .replace(/\\s+-\\s+/g, " - ")
    .replace(/\\s+/g, " ")
    .trim();
}

export function displayText(value: unknown, fallback = "-"): string {
  const cleaned = cleanText(value);
  return cleaned || fallback;
}
`,
  "utf8"
);

const appComponentsDir = path.join(root, "app", "components");
ensureDir(appComponentsDir);

fs.writeFileSync(
  path.join(appComponentsDir, "DataSourceNote.tsx"),
`"use client";

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
`,
  "utf8"
);

fs.writeFileSync(
  path.join(root, "app", "layout.tsx"),
`import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import TopNav from "./components/TopNav";
import DataSourceNote from "./components/DataSourceNote";

export const metadata: Metadata = {
  title: "Stratify Analytics",
  description: "Global intelligence analytics portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        <DataSourceNote />
        <main>{children}</main>
      </body>
    </html>
  );
}
`,
  "utf8"
);

console.log("");
console.log("DONE.");
console.log("Backup created at:", backupDir);
console.log("Now run: npm run dev");
