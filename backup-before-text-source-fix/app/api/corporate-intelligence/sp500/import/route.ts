import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SP500_CSV_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);

      if (row.some((x) => x.trim() !== "")) rows.push(row);

      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }

  const headers = rows[0]?.map((h) => h.trim()) ?? [];

  return rows.slice(1).map((line) => {
    const item: CsvRow = {};
    headers.forEach((header, index) => {
      item[header] = (line[index] ?? "").trim();
    });
    return item;
  });
}

function cleanDate(value?: string) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return trimmed;
}

function cleanCik(value?: string) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  return digits ? digits.padStart(10, "0") : null;
}

export async function POST() {
  const startedAt = new Date().toISOString();

  await supabase.rpc("ci_insert_refresh_log", {
    p_refresh_type: "sp500_import",
    p_status: "running",
    p_total_records: 0,
    p_success_count: 0,
    p_failed_count: 0,
    p_message: "Started S&P 500 import from GitHub dataset.",
    p_finished_at: null,
  });

  try {
    const response = await fetch(SP500_CSV_URL, {
      cache: "no-store",
      headers: {
        "User-Agent": "Stratify Corporate Intelligence",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub CSV fetch failed with status ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);

    const payload = rows
      .map((row) => ({
        symbol: row.Symbol,
        name: row.Security,
        sector: row["GICS Sector"] || null,
        sub_industry: row["GICS Sub-Industry"] || null,
        headquarters: row["Headquarters Location"] || null,
        date_added: cleanDate(row["Date added"]),
        cik: cleanCik(row.CIK),
        founded: row.Founded || null,
        source: "github_sp500",
      }))
      .filter((row) => row.symbol && row.name);

    const { data: affected, error } = await supabase.rpc("ci_upsert_companies", {
      payload,
    });

    if (error) throw error;

    await supabase.rpc("ci_insert_refresh_log", {
      p_refresh_type: "sp500_import",
      p_status: "success",
      p_total_records: payload.length,
      p_success_count: Number(affected ?? payload.length),
      p_failed_count: 0,
      p_message: `Imported / updated ${payload.length} S&P 500 companies. Started at ${startedAt}.`,
      p_finished_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      imported: payload.length,
      affected: Number(affected ?? 0),
      message: "S&P 500 companies imported successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown S&P 500 import error.";

    await supabase.rpc("ci_insert_refresh_log", {
      p_refresh_type: "sp500_import",
      p_status: "failed",
      p_total_records: 0,
      p_success_count: 0,
      p_failed_count: 1,
      p_message: message,
      p_finished_at: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
