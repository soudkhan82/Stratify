export type SeriesPoint = { year: number; value: number };

/**
 * World Bank series fetcher (minimal)
 * @param indicator e.g. "AG.LND.FRST.ZS" or "NY.GDP.MKTP.CD"
 * @param country   ISO-3 codes, e.g. "PAK" or semicolon list "PAK;IND"
 * @param date      "YYYY" or "YYYY:YYYY" (optional)
 */
export async function fetchWorldBankSeries(
  indicator: string,
  country: string,
  { date }: { date?: string } = {}
): Promise<SeriesPoint[]> {
  // WB expects ISO-3 and semicolon-separated lists
  const countryParam = country.toUpperCase().replace(/,/g, ";").trim();

  const params = new URLSearchParams({
    format: "json",
    per_page: "20000",
    ...(date ? { date } : {}),
  });

  const url = `https://api.worldbank.org/v2/country/${countryParam}/indicator/${indicator}?${params.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(
        `WorldBank HTTP ${res.status}: ${res.statusText}\nURL: ${url}`
      );
      return [];
    }

    const raw: unknown = await res.json();

    // Success shape: [meta, rows[]]
    if (Array.isArray(raw) && raw.length >= 2 && Array.isArray(raw[1])) {
      const series: SeriesPoint[] = raw[1]
        .map((r: unknown) => {
          if (r && typeof r === "object" && "date" in r && "value" in r) {
            const year = Number((r as { date: unknown }).date);
            const val = (r as { value: unknown }).value;
            if (typeof val === "number" && Number.isFinite(year)) {
              return { year, value: val };
            }
          }
          return null;
        })
        .filter((x): x is SeriesPoint => x !== null)
        .sort((a, b) => a.year - b.year);

      return series;
    }

    // Error shape: [{ message: [{ value: "..." }, ...] }]
    if (
      Array.isArray(raw) &&
      raw[0] &&
      typeof raw[0] === "object" &&
      "message" in (raw[0] as Record<string, unknown>) &&
      Array.isArray((raw[0] as { message: unknown }).message)
    ) {
      const msg = (raw[0] as { message: Array<{ value?: unknown }> }).message
        .map((m) => (typeof m.value === "string" ? m.value : ""))
        .filter(Boolean)
        .join(" | ");

      return [];
    }

    return [];
  } catch (e) {
    console.error("fetchWorldBankSeries failed:", e);
    return [];
  }
}
