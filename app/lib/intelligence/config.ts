import type {
  IntelligenceDimensionConfig,
  IntelligenceIndicatorConfig,
} from "./types";

export const INTELLIGENCE_METHODOLOGY_VERSION = "country-intelligence-v1.0";

export const COMPONENT_WEIGHTS = {
  globalPosition: 0.4,
  regionalPosition: 0.2,
  momentum: 0.25,
  stability: 0.15,
} as const;

export const INTELLIGENCE_DIMENSIONS: IntelligenceDimensionConfig[] = [
  {
    id: "economic-momentum",
    label: "Economic Momentum",
    description:
      "Growth, price pressure and labour-market conditions that describe the current direction of the economy.",
    weight: 0.25,
  },
  {
    id: "external-resilience",
    label: "External Resilience",
    description:
      "Capacity to absorb external shocks through trade performance, foreign-exchange buffers and capital inflows.",
    weight: 0.25,
  },
  {
    id: "fiscal-health",
    label: "Fiscal Health",
    description:
      "Government debt, fiscal balance and revenue capacity relative to the size of the economy.",
    weight: 0.25,
  },
  {
    id: "development",
    label: "Development & Capacity",
    description:
      "Income, health and infrastructure outcomes that support long-term economic and social capacity.",
    weight: 0.25,
  },
];

/*
 * V1 intentionally uses a compact set of high-signal indicators.
 * This keeps the first score explainable and avoids double-counting dozens
 * of correlated variables. We can widen the basket after validation.
 */
export const INTELLIGENCE_INDICATORS: IntelligenceIndicatorConfig[] = [
  // Economic Momentum
  {
    indicatorId: "gdp-growth",
    dimension: "economic-momentum",
    weight: 0.4,
    direction: "higher-better",
  },
  {
    indicatorId: "inflation",
    dimension: "economic-momentum",
    weight: 0.35,
    direction: "target-range",
    targetMin: 2,
    targetMax: 6,
  },
  {
    indicatorId: "unemployment",
    dimension: "economic-momentum",
    weight: 0.25,
    direction: "lower-better",
  },

  // External Resilience
  {
    indicatorId: "current-account-gdp",
    dimension: "external-resilience",
    weight: 0.35,
    direction: "target-range",
    targetMin: -3,
    targetMax: 3,
  },
  {
    indicatorId: "reserves-months-imports",
    dimension: "external-resilience",
    weight: 0.4,
    direction: "higher-better",
  },
  {
    indicatorId: "exports-gdp",
    dimension: "external-resilience",
    weight: 0.25,
    direction: "higher-better",
  },

  // Fiscal Health
  {
    indicatorId: "government-debt-gdp",
    dimension: "fiscal-health",
    weight: 0.45,
    direction: "lower-better",
  },
  {
    indicatorId: "fiscal-balance-gdp",
    dimension: "fiscal-health",
    weight: 0.35,
    direction: "higher-better",
  },
  {
    indicatorId: "tax-revenue-gdp",
    dimension: "fiscal-health",
    weight: 0.2,
    direction: "higher-better",
  },

  // Development & Capacity
  {
    indicatorId: "gdp-per-capita",
    dimension: "development",
    weight: 0.35,
    direction: "higher-better",
  },
  {
    indicatorId: "life-expectancy",
    dimension: "development",
    weight: 0.35,
    direction: "higher-better",
  },
  {
    indicatorId: "electricity-access",
    dimension: "development",
    weight: 0.3,
    direction: "higher-better",
  },
];

export const WEO_OUTLOOK_INDICATORS = [
  {
    code: "NGDP_RPCH",
    label: "Real GDP growth",
    unit: "%",
  },
  {
    code: "PCPIPCH",
    label: "Inflation",
    unit: "%",
  },
  {
    code: "LUR",
    label: "Unemployment",
    unit: "%",
  },
  {
    code: "BCA_NGDPD",
    label: "Current account balance",
    unit: "% of GDP",
  },
  {
    code: "GGXONLB_NGDP",
    label: "General government overall balance",
    unit: "% of GDP",
  },
  {
    code: "GGXWDN_NGDP",
    label: "General government gross debt",
    unit: "% of GDP",
  },
] as const;

export const GEO_REGION_OVERRIDES: Record<string, string> = {
  AFG: "South Asia",
  BGD: "South Asia",
  BTN: "South Asia",
  IND: "South Asia",
  MDV: "South Asia",
  NPL: "South Asia",
  PAK: "South Asia",
  LKA: "South Asia",
};
