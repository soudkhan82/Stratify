// lib/metrics.ts
import type { SeriesSpec } from "@/lib/datasources";

export type MetricSource = "WB"; // extend later
export type MetricTopic =
  | "demographics"
  | "economy"
  | "health"
  | "energy"
  | "environment"
  | "agriculture";

export interface Metric {
  code: string;
  label: string;
  unit: string;
  source: MetricSource;
  topic: MetricTopic;
  toSpec: (geo: string) => SeriesSpec;
}

// Curated WB-only set (fast + stable). Add more later.
export const METRICS = {
  // Demographics
  POPULATION: {
    code: "SP.POP.TOTL",
    label: "Population",
    unit: "people",
    source: "WB",
    topic: "demographics",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SP.POP.TOTL",
      geo,
    }),
  },
  FERTILITY_RATE: {
    code: "SP.DYN.TFRT.IN",
    label: "Fertility rate (births per woman)",
    unit: "births/woman",
    source: "WB",
    topic: "demographics",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SP.DYN.TFRT.IN",
      geo,
    }),
  },
  LIFE_EXPECTANCY: {
    code: "SP.DYN.LE00.IN",
    label: "Life expectancy at birth",
    unit: "years",
    source: "WB",
    topic: "demographics",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SP.DYN.LE00.IN",
      geo,
    }),
  },

  // Economy
  GDP_CURRENT_USD: {
    code: "NY.GDP.MKTP.CD",
    label: "GDP (current US$)",
    unit: "US$",
    source: "WB",
    topic: "economy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "NY.GDP.MKTP.CD",
      geo,
    }),
  },
  INFLATION_CPI: {
    code: "FP.CPI.TOTL.ZG",
    label: "Inflation (CPI, annual %)",
    unit: "%",
    source: "WB",
    topic: "economy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "FP.CPI.TOTL.ZG",
      geo,
    }),
  },
  UNEMPLOYMENT_RATE: {
    code: "SL.UEM.TOTL.ZS",
    label: "Unemployment rate",
    unit: "% of labor force",
    source: "WB",
    topic: "economy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SL.UEM.TOTL.ZS",
      geo,
    }),
  },

  // Health
  INFANT_MORTALITY: {
    code: "SP.DYN.IMRT.IN",
    label: "Infant mortality rate",
    unit: "per 1,000 births",
    source: "WB",
    topic: "health",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SP.DYN.IMRT.IN",
      geo,
    }),
  },
  HEALTH_EXP_PCT_GDP: {
    code: "SH.XPD.CHEX.GD.ZS",
    label: "Current health expenditure",
    unit: "% of GDP",
    source: "WB",
    topic: "health",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SH.XPD.CHEX.GD.ZS",
      geo,
    }),
  },

  // Energy
  ELECTRICITY_CONS_PC: {
    code: "EG.USE.ELEC.KH.PC",
    label: "Electric power consumption",
    unit: "kWh per capita",
    source: "WB",
    topic: "energy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "EG.USE.ELEC.KH.PC",
      geo,
    }),
  },
  RENEWABLE_ENERGY_PCT: {
    code: "EG.FEC.RNEW.ZS",
    label: "Renewable energy consumption",
    unit: "% of final energy use",
    source: "WB",
    topic: "energy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "EG.FEC.RNEW.ZS",
      geo,
    }),
  },

  // Environment
  CO2_TOTAL_KT: {
    code: "EN.ATM.CO2E.KT",
    label: "CO₂ emissions",
    unit: "kt",
    source: "WB",
    topic: "environment",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "EN.ATM.CO2E.KT",
      geo,
    }),
  },
  CO2_PER_CAPITA: {
    code: "EN.ATM.CO2E.PC",
    label: "CO₂ emissions per capita",
    unit: "metric tons",
    source: "WB",
    topic: "environment",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "EN.ATM.CO2E.PC",
      geo,
    }),
  },

  // Agriculture
  CEREAL_YIELD: {
    code: "AG.YLD.CREL.KG",
    label: "Cereal yield",
    unit: "kg per hectare",
    source: "WB",
    topic: "agriculture",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "AG.YLD.CREL.KG",
      geo,
    }),
  },
  FERTILIZER_USE: {
    code: "AG.CON.FERT.ZS",
    label: "Fertilizer consumption",
    unit: "kg/ha of arable land",
    source: "WB",
    topic: "agriculture",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "AG.CON.FERT.ZS",
      geo,
    }),
  },
} as const;

export type MetricKey = keyof typeof METRICS;
export const METRIC_KEYS: MetricKey[] = Object.keys(METRICS) as MetricKey[];
