export function formatCompactCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  const normalized = Math.abs(value) <= 1 ? value * 100 : value;

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(normalized)}%`;
}
