// /lib/metrics.ts
import type { SeriesSpec } from "@/lib/fetchers/series";

export type MetricSource = "WB" | "FAO" | "EIA" | "IMF" | "OECD";

export type MetricTopic =
  | "demographics"
  | "economy"
  | "health"
  | "energy"
  | "environment"
  | "agriculture";

export interface Metric {
  code: string; // provider indicator code
  label: string; // human-readable name
  unit: string; // display unit
  source: MetricSource;
  topic: MetricTopic;
  toSpec: (geo: string) => SeriesSpec;
}

// ------------------- All metrics -------------------
export const METRICS = {
  // --- Demographics ---
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
  AGE_DEPENDENCY: {
    code: "SP.POP.DPND",
    label: "Age dependency ratio",
    unit: "% of working-age pop",
    source: "WB",
    topic: "demographics",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SP.POP.DPND",
      geo,
    }),
  },
  URBAN_POP_PCT: {
    code: "SP.URB.TOTL.IN.ZS",
    label: "Urban population",
    unit: "% of total",
    source: "WB",
    topic: "demographics",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SP.URB.TOTL.IN.ZS",
      geo,
    }),
  },

  // --- Economy ---
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
  EXTERNAL_DEBT_PCT_GNI: {
    code: "DT.DOD.DECT.GN.ZS",
    label: "External debt",
    unit: "% of GNI",
    source: "WB",
    topic: "economy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "DT.DOD.DECT.GN.ZS",
      geo,
    }),
  },
  CURRENT_ACCOUNT_PCT_GDP: {
    code: "BN.CAB.XOKA.GD.ZS",
    label: "Current account balance",
    unit: "% of GDP",
    source: "WB",
    topic: "economy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "BN.CAB.XOKA.GD.ZS",
      geo,
    }),
  },

  // --- Health ---
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
  MATERNAL_MORTALITY: {
    code: "SH.STA.MMRT",
    label: "Maternal mortality ratio",
    unit: "per 100,000 births",
    source: "WB",
    topic: "health",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SH.STA.MMRT",
      geo,
    }),
  },
  HOSPITAL_BEDS: {
    code: "SH.MED.BEDS.ZS",
    label: "Hospital beds",
    unit: "per 1,000 people",
    source: "WB",
    topic: "health",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "SH.MED.BEDS.ZS",
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

  // --- Energy ---
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
  FOSSIL_ENERGY_PCT: {
    code: "EG.USE.COMM.FO.ZS",
    label: "Fossil fuel energy consumption",
    unit: "% of total",
    source: "WB",
    topic: "energy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "EG.USE.COMM.FO.ZS",
      geo,
    }),
  },

  // --- Environment ---
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
  FOREST_AREA_PCT: {
    code: "AG.LND.FRST.ZS",
    label: "Forest area",
    unit: "% of land area",
    source: "WB",
    topic: "environment",
    toSpec: (geo: string): SeriesSpec => ({
      source: "WB",
      code: "AG.LND.FRST.ZS",
      geo,
    }),
  },

  // --- Agriculture ---
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

  // --- Non-WB examples ---
  IMF_CPI_PCT_CHANGE: {
    code: "PCPIPCH",
    label: "Inflation, CPI (y/y %)",
    unit: "%",
    source: "IMF",
    topic: "economy",
    toSpec: (geo: string): SeriesSpec => ({
      source: "IMF",
      database: "IFS",
      indicator: "PCPIPCH",
      country: geo,
      freq: "A",
    }),
  },
  EIA_TOTAL_PRIMARY_ENERGY: {
    code: "INTL.1-PAK.A",
    label: "Total Primary Energy",
    unit: "quad BTU",
    source: "EIA",
    topic: "energy",
    toSpec: (_geo: string): SeriesSpec => ({
      source: "EIA",
      seriesId: "INTL.1-PAK.A",
    }),
  },
  OECD_CLI: {
    code: "PAK.CLI.AMPLSA",
    label: "OECD Composite Leading Indicator",
    unit: "index",
    source: "OECD",
    topic: "economy",
    toSpec: (_geo: string): SeriesSpec => ({
      source: "OECD",
      dataset: "MEI_CLI",
      filterPath: "PAK.CLI.AMPLSA",
    }),
  },
  FAO_WHEAT_PROD_TONNES: {
    code: "FAOSTAT/Production_Crops:WHEAT",
    label: "Wheat production",
    unit: "tonnes",
    source: "FAO",
    topic: "agriculture",
    toSpec: (iso3: string): SeriesSpec => ({
      source: "FAO",
      datasetPath: "FAOSTAT/Production_Crops",
      params: { area_code: iso3, item_code: 15, element_code: 5510 },
    }),
  },
} as const;

// ------------------- Types & helpers -------------------
export type MetricKey = keyof typeof METRICS;

export const METRIC_LIST: (Metric & { key: MetricKey })[] = Object.entries(
  METRICS
).map(([key, value]) => ({ key: key as MetricKey, ...value }));

export const METRIC_KEYS: MetricKey[] = METRIC_LIST.map((m) => m.key);

export const METRICS_BY_TOPIC: Record<MetricTopic, MetricKey[]> = {
  demographics: [
    "POPULATION",
    "FERTILITY_RATE",
    "LIFE_EXPECTANCY",
    "AGE_DEPENDENCY",
    "URBAN_POP_PCT",
  ],
  economy: [
    "GDP_CURRENT_USD",
    "INFLATION_CPI",
    "UNEMPLOYMENT_RATE",
    "EXTERNAL_DEBT_PCT_GNI",
    "CURRENT_ACCOUNT_PCT_GDP",
    "IMF_CPI_PCT_CHANGE",
    "OECD_CLI",
  ],
  health: [
    "INFANT_MORTALITY",
    "MATERNAL_MORTALITY",
    "HOSPITAL_BEDS",
    "HEALTH_EXP_PCT_GDP",
  ],
  energy: [
    "ELECTRICITY_CONS_PC",
    "RENEWABLE_ENERGY_PCT",
    "FOSSIL_ENERGY_PCT",
    "EIA_TOTAL_PRIMARY_ENERGY",
  ],
  environment: ["CO2_TOTAL_KT", "CO2_PER_CAPITA", "FOREST_AREA_PCT"],
  agriculture: ["CEREAL_YIELD", "FERTILIZER_USE", "FAO_WHEAT_PROD_TONNES"],
};
