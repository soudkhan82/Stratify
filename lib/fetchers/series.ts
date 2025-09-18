// lib/fetchers/series.ts
import type { SeriesPoint } from "@/lib/format";
import { fetchWorldBankSeries } from "@/lib/fetchers/worldbank";
import { fetchFAOSeries } from "@/lib/fetchers/faostats";
import { fetchEIASeries } from "@/lib/fetchers/eia";
import { fetchIMFSeries } from "@/lib/fetchers/imf";
import { fetchOECDSeries } from "@/lib/fetchers/oecd";

export type DataSource = "WB" | "FAO" | "EIA" | "IMF" | "OECD";

export type SeriesSpec =
  | { source: "WB"; code: string; geo: string } // existing
  | {
      source: "FAO";
      datasetPath: string;
      params: Record<string, string | number>;
    }
  | { source: "EIA"; seriesId: string }
  | {
      source: "IMF";
      database: string;
      indicator: string;
      country: string;
      freq?: "A" | "Q" | "M";
    }
  | { source: "OECD"; dataset: string; filterPath: string };

export async function fetchSeries(spec: SeriesSpec): Promise<SeriesPoint[]> {
  switch (spec.source) {
    case "WB":
      return fetchWorldBankSeries(spec.code, spec.geo);
    case "FAO":
      return fetchFAOSeries(spec.datasetPath, spec.params);
    case "EIA":
      return fetchEIASeries(spec.seriesId);
    case "IMF":
      return fetchIMFSeries(
        spec.database,
        spec.indicator,
        spec.country,
        spec.freq ?? "A"
      );
    case "OECD":
      return fetchOECDSeries(spec.dataset, spec.filterPath);
    default:
      return [];
  }
}
