import type { SeriesPoint } from "./format";
import { fetchWorldBankSeries } from "./fetchers/worldbank";

/** Latest value for a metric+country (null if missing) */
export async function latestFor(
  iso3: string,
  indicator: string
): Promise<number | null> {
  const s: SeriesPoint[] = await fetchWorldBankSeries(iso3, indicator);
  return s.at(-1)?.value ?? null;
}

/** Latest values for multiple countries (fails soft) */
export async function latestForMany(isos: string[], indicator: string) {
  const list = await Promise.all(
    isos.map(async (iso3) => {
      const s: SeriesPoint[] = await fetchWorldBankSeries(iso3, indicator);
      const v = s.at(-1)?.value ?? null;
      return { iso3, value: v };
    })
  );
  return list;
}
