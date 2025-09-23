// app/geodashboard.tsx
"use client";

import {
  ECONOMY_LEAN_KEYS,
  METRICS,
  METRIC_KEYS,
  type MetricKey,
} from "@/lib/metrics";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import worldCountries from "world-countries";

import PoiMap, { type Poi } from "@/components/PoiMap";
import { IndicatorLine } from "@/components/IndicatorLine";
import { IndicatorRank, type RankCountry } from "@/components/IndicatorRank";
import { StatCard } from "@/components/StatCard";

const DEBUG = true;
const dlog = (label: string, data?: unknown): void => {
  if (DEBUG) console.log(label, data);
};

type Continent = "Africa" | "Americas" | "Asia" | "Europe" | "Oceania";
const CONTINENTS: readonly Continent[] = [
  "Asia",
  "Africa",
  "Americas",
  "Europe",
  "Oceania",
];
const toContinent = (r?: string): Continent | null =>
  CONTINENTS.includes(r as Continent) ? (r as Continent) : null;

type Country = {
  name: string;
  cca3: string;
  continent: Continent;
  lat: number;
  lon: number;
};

const ALL_COUNTRIES: Country[] = worldCountries
  .map((c) => {
    const cont = toContinent(c.region);
    if (!cont || !Array.isArray(c.latlng) || c.latlng.length < 2) return null;
    return {
      name: c.name.common,
      cca3: c.cca3,
      continent: cont,
      lat: Number(c.latlng[0]),
      lon: Number(c.latlng[1]),
    } as Country;
  })
  .filter((x): x is Country => x !== null);

// Map view type (matches PoiMap structural typing)
type MapView =
  | {
      type: "bounds";
      bounds: [[number, number], [number, number]];
      padding?: number;
    }
  | { type: "center"; center: [number, number]; zoom: number };

// Compute bounds for a set of countries
function computeBounds(
  cs: ReadonlyArray<Country>
): [[number, number], [number, number]] {
  let minLat = 90,
    maxLat = -90,
    minLon = 180,
    maxLon = -180;
  for (const c of cs) {
    if (Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lon < minLon) minLon = c.lon;
      if (c.lon > maxLon) maxLon = c.lon;
    }
  }
  const pad = 0.5; // small expansion so points near edges aren't clipped
  return [
    [minLat - pad, minLon - pad],
    [maxLat + pad, maxLon + pad],
  ];
}

// Heuristic: pick a nicer zoom per continent when focusing a single country
function countryZoom(cont: Continent): number {
  switch (cont) {
    case "Europe":
      return 5.5;
    case "Oceania":
      return 5.2;
    case "Asia":
      return 5.0;
    case "Africa":
      return 4.8;
    case "Americas":
      return 4.7;
    default:
      return 5;
  }
}

export default function GeoDashboard() {
  const [continent, setContinent] = useState<Continent>("Asia");

  const countries = useMemo<Country[]>(
    () =>
      ALL_COUNTRIES.filter((c) => c.continent === continent).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [continent]
  );

  const [countryCca3, setCountryCca3] = useState<string>(
    countries[0]?.cca3 ?? ""
  );
  useEffect(() => {
    if (!countries.find((c) => c.cca3 === countryCca3)) {
      setCountryCca3(countries[0]?.cca3 ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries]);

  const selected = useMemo(
    () => countries.find((c) => c.cca3 === countryCca3) ?? null,
    [countries, countryCca3]
  );

  // --- Lean metric key set: all non-economy metrics + only ECONOMY_LEAN_KEYS for economy ---
  const ECONOMY_LEAN_SET = useMemo(
    () => new Set<MetricKey>(ECONOMY_LEAN_KEYS),
    []
  );
  const VISIBLE_KEYS = useMemo<MetricKey[]>(
    () =>
      (METRIC_KEYS as MetricKey[]).filter(
        (k) => METRICS[k].topic !== "economy" || ECONOMY_LEAN_SET.has(k)
      ),
    [ECONOMY_LEAN_SET]
  );

  // Prefer a lean economy default if available; else first visible key
  const defaultIndicator: MetricKey =
    (["TRADE_BAL_GDP", "FDI_IN_GDP", "REMIT_IN_GDP"].find((k) =>
      VISIBLE_KEYS.includes(k as MetricKey)
    ) as MetricKey) ?? VISIBLE_KEYS[0];

  const [indicator, setIndicator] = useState<MetricKey>(defaultIndicator);

  // Ensure the selected indicator is always visible under the lean policy
  useEffect(() => {
    if (!VISIBLE_KEYS.includes(indicator)) {
      setIndicator(defaultIndicator);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [VISIBLE_KEYS]);

  const points = useMemo<Poi[]>(
    () =>
      countries.map((c) => ({
        id: c.cca3,
        name: c.name,
        lat: c.lat,
        lon: c.lon,
        value: 1,
      })),
    [countries]
  );

  const rankCountries = useMemo<readonly RankCountry[]>(
    () => countries.map((c) => ({ name: c.name, cca3: c.cca3 })),
    [countries]
  );

  // Compute map view (auto-zoom to selected country; fit continent otherwise)
  const mapView: MapView = useMemo(() => {
    if (selected) {
      return {
        type: "center",
        center: [selected.lat, selected.lon],
        zoom: countryZoom(selected.continent),
      };
    }
    return { type: "bounds", bounds: computeBounds(countries), padding: 24 };
  }, [selected, countries]);

  // Key that changes when continent or selection changes — forces remount if needed
  const mapFitKey = useMemo(
    () => `${continent}:${selected?.cca3 ?? "ALL"}`,
    [continent, selected?.cca3]
  );

  // Debug
  useEffect(() => {
    dlog("[Geo] countries", {
      continent,
      count: countries.length,
      sample: countries.slice(0, 3).map(({ cca3, name }) => ({ cca3, name })),
    });
  }, [continent, countries]);

  useEffect(() => {
    dlog("[Geo] selection", {
      selectedCca3: countryCca3,
      selectedName: selected?.name ?? null,
      indicator,
      indicatorLabel: METRICS[indicator].label,
    });
  }, [countryCca3, selected?.name, indicator]);

  const handlePointClick = (p: Poi): void => {
    const c = countries.find((x) => x.cca3 === p.id);
    if (c) setCountryCca3(c.cca3);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60">
        <div className="mx-auto flex max-w-7xl items-center justify-start gap-4 px-4 py-2">
          <Link
            href="/"
            aria-label="Stratify home"
            className="inline-flex items-center shrink-0"
          >
            <Image
              src="/stratify.png"
              alt="Stratify"
              width={200}
              height={400}
              priority
              className="h-12 w-auto md:h-16"
            />
          </Link>
          <div className="min-w-0">
            <p className="text-sm md:text-base lg:text-lg font-medium text-slate-100/90 leading-snug">
              <span className="font-semibold text-slate-50">Stratify</span> —
              Visualize. Compare. Understand the World.
            </p>
            <p className="text-xs">Updates in a few seconds</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {/* Controls */}
        <div className="mb-3 flex flex-wrap gap-3">
          <select
            value={continent}
            onChange={(e) => setContinent(e.target.value as Continent)}
            className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
          >
            {CONTINENTS.map((c) => (
              <option key={c} className="bg-slate-900">
                {c}
              </option>
            ))}
          </select>

          <select
            value={countryCca3}
            onChange={(e) => setCountryCca3(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
          >
            {countries.map((c) => (
              <option key={c.cca3} value={c.cca3} className="bg-slate-900">
                {c.name}
              </option>
            ))}
          </select>

          {/* Indicator dropdown uses lean policy: all non-economy + economy lean only */}
          <select
            value={indicator}
            onChange={(e) => setIndicator(e.target.value as MetricKey)}
            className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-100"
          >
            {VISIBLE_KEYS.map((k) => (
              <option key={k} value={k} className="bg-slate-900">
                {METRICS[k].label} ({METRICS[k].unit})
              </option>
            ))}
          </select>
        </div>

        {/* Two columns: Map | Line + Rank */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Map block + StatCard below */}
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
              <div className="text-sm font-semibold text-slate-100 mb-1">
                {selected?.name ?? "—"} — Countries
              </div>
              <PoiMap
                key={mapFitKey} // hard re-mount to guarantee re-fit even if view effect isn't present
                points={points}
                selectedId={selected?.cca3}
                onPointClick={handlePointClick}
                className="h-[280px] w-full"
                view={mapView}
                fitKey={mapFitKey}
              />
            </div>

            {/* Latest bundle for the selected country (your StatCard comp handles content) */}
            <StatCard iso3={countryCca3} countryLabel={selected?.name ?? ""} />
          </div>

          {/* Chart + Rank */}
          <div className="space-y-4">
            <IndicatorLine
              iso3={countryCca3}
              metric={indicator}
              countryLabel={selected?.name ?? ""}
              className="h-[340px]"
            />
            <IndicatorRank
              continentLabel={continent}
              countries={rankCountries}
              selectedIso3={countryCca3}
              metric={indicator}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
