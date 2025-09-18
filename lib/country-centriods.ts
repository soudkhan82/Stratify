export type Region = 'WLD' | 'EAS' | 'ECS' | 'LCN' | 'MEA' | 'NAC' | 'SAS' | 'SSF';

export type C = { iso3: string; name: string; lat: number; lon: number; region: Region };

export const COUNTRIES: C[] = [
  { iso3: 'USA', name: 'United States',   lat: 39.8,  lon: -98.6, region: 'NAC' },
  { iso3: 'CAN', name: 'Canada',          lat: 61.1,  lon: -103.6, region: 'NAC' },
  { iso3: 'MEX', name: 'Mexico',          lat: 23.6,  lon: -102.5, region: 'LCN' },

  { iso3: 'BRA', name: 'Brazil',          lat: -10.8, lon: -52.9, region: 'LCN' },
  { iso3: 'ARG', name: 'Argentina',       lat: -38.4, lon: -63.6, region: 'LCN' },

  { iso3: 'GBR', name: 'United Kingdom',  lat: 54.1,  lon: -2.9,  region: 'ECS' },
  { iso3: 'FRA', name: 'France',          lat: 46.2,  lon: 2.2,   region: 'ECS' },
  { iso3: 'DEU', name: 'Germany',         lat: 51.2,  lon: 10.4,  region: 'ECS' },
  { iso3: 'TUR', name: 'Türkiye',         lat: 39.1,  lon: 35.2,  region: 'ECS' },

  { iso3: 'CHN', name: 'China',           lat: 35.9,  lon: 104.2, region: 'EAS' },
  { iso3: 'JPN', name: 'Japan',           lat: 36.2,  lon: 138.3, region: 'EAS' },
  { iso3: 'KOR', name: 'Korea, Rep.',     lat: 36.5,  lon: 127.8, region: 'EAS' },

  { iso3: 'IND', name: 'India',           lat: 22.7,  lon: 79.9,  region: 'SAS' },
  { iso3: 'PAK', name: 'Pakistan',        lat: 30.4,  lon: 69.4,  region: 'SAS' },
  { iso3: 'BGD', name: 'Bangladesh',      lat: 23.7,  lon: 90.4,  region: 'SAS' },

  { iso3: 'EGY', name: 'Egypt',           lat: 26.8,  lon: 30.8,  region: 'MEA' },
  { iso3: 'SAU', name: 'Saudi Arabia',    lat: 23.9,  lon: 44.6,  region: 'MEA' },
  { iso3: 'ARE', name: 'United Arab Emirates', lat: 24.3, lon: 54.3, region: 'MEA' },
  { iso3: 'IRN', name: 'Iran',            lat: 32.6,  lon: 54.0,  region: 'MEA' },

  { iso3: 'NGA', name: 'Nigeria',         lat: 9.1,   lon: 8.7,   region: 'SSF' },
  { iso3: 'ZAF', name: 'South Africa',    lat: -30.6, lon: 22.9,  region: 'SSF' },
  { iso3: 'KEN', name: 'Kenya',           lat: -0.0,  lon: 37.9,  region: 'SSF' },

  { iso3: 'AUS', name: 'Australia',       lat: -25.3, lon: 133.8, region: 'EAS' },
  { iso3: 'RUS', name: 'Russia',          lat: 61.5,  lon: 105.3, region: 'ECS' },
];

export const REGION_LABEL: Record<Region, string> = {
  WLD: 'World',
  EAS: 'East Asia & Pacific',
  ECS: 'Europe & Central Asia',
  LCN: 'Latin America & Caribbean',
  MEA: 'Middle East & North Africa',
  NAC: 'North America',
  SAS: 'South Asia',
  SSF: 'Sub-Saharan Africa',
};
