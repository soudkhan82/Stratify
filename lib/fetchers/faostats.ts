// lib/fetchers/faostat.ts
import type { SeriesPoint } from "@/lib/format";

/**
 * Generic FAOSTAT fetcher.
 * Example dataset (domain/subdomain): "FAOSTAT/Production_Crops"
 * Docs: https://fenixservices.fao.org/faostat/api/v1/en
 *
 * Typical params:
 *  - area_code: string | number (e.g., 165 for Pakistan)
 *  - item_code, element_code: strings/numbers (dataset-specific)
 */
export async function fetchFAOSeries(
  datasetPath: string, // e.g. "FAOSTAT/Production_Crops"
  params: Record<string, string | number>
): Promise<SeriesPoint[]> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  // order=desc makes latest easy; we'll sort anyway
  q.set("page", "1");
  q.set("pagesize", "5000");
  const url = `https://fenixservices.fao.org/faostat/api/v1/en/${datasetPath}?${q.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`FAOSTAT ${datasetPath} ${res.status}`);
  const json = await res.json();

  const rows = (json?.data ?? []) as Array<{
    year?: number | string;
    value?: number | string;
  }>;
  const pts: SeriesPoint[] = rows
    .map((r) => {
      const y = typeof r.year === "string" ? parseInt(r.year) : r.year;
      const v = typeof r.value === "string" ? Number(r.value) : r.value;
      return y && Number.isFinite(v as number)
        ? { year: y as number, value: v as number }
        : null;
    })
    .filter((x): x is SeriesPoint => !!x)
    .sort((a, b) => a.year - b.year);

  return pts;
}
