// app/fiscal/_lib/fiscalMeta.ts
export type FiscalSlug =
  | "primary-balance"
  | "overall-balance"
  | "revenue"
  | "expenditure"
  | "interest-revenue"
  | "public-investment";

export type FiscalMetric = {
  slug: FiscalSlug;
  title: string;
  subtitle: string;
  unit: string;
  indicator_code: string | null; // null = not available yet
  fmt: "pct" | "num";
};

export const FISCAL_METRICS: FiscalMetric[] = [
  {
    slug: "primary-balance",
    title: "Primary Balance",
    subtitle: "Primary net lending/borrowing • % of GDP",
    unit: "% of GDP",
    fmt: "pct",
    indicator_code: "GGXONLB_NGDP",
  },
  {
    slug: "overall-balance",
    title: "Overall Balance (Proxy)",
    subtitle: "Structural balance • % (proxy until overall balance ingested)",
    unit: "% of GDP",
    fmt: "pct",
    indicator_code: "GGSB_NPGDP",
  },
  {
    slug: "revenue",
    title: "Government Revenue",
    subtitle: "General government revenue • % of GDP",
    unit: "% of GDP",
    fmt: "pct",
    indicator_code: "GGR_NGDP",
  },
  {
    slug: "expenditure",
    title: "Government Expenditure",
    subtitle: "General government expenditure • % of GDP",
    unit: "% of GDP",
    fmt: "pct",
    indicator_code: "GGX_NGDP",
  },
  {
    slug: "interest-revenue",
    title: "Interest Payments",
    subtitle: "Interest payments • % of revenue (not yet available)",
    unit: "% of revenue",
    fmt: "pct",
    indicator_code: null,
  },
  {
    slug: "public-investment",
    title: "Public Investment",
    subtitle: "Public investment • % of GDP (not yet available)",
    unit: "% of GDP",
    fmt: "pct",
    indicator_code: null,
  },
];

export function getMetric(slug: FiscalSlug) {
  const m = FISCAL_METRICS.find((x) => x.slug === slug);
  if (!m) throw new Error(`Unknown fiscal slug: ${slug}`);
  return m;
}
