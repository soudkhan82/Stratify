// app/components/StratifyMap.tsx
"use client";

import { useMemo } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleQuantile } from "d3-scale";
import { interpolateBlues as d3Blues } from "d3-scale-chromatic";
import worldCountries from "world-countries";

export type StratifyMapRow = {
  iso3: string; // e.g. "PAK"
  country: string;
  region: string | null;
  value: number;
};

type Props = {
  rows: StratifyMapRow[];
  topoJsonUrl: string; // e.g. "/maps/countries-110m.json"
  selectedIso3?: string | null;
  onSelectIso3?: (iso3: string) => void;
  height?: number;
};

type GeoProps = Record<string, unknown>;

// react-simple-maps gives us a feature-like object for each geography
type RsmGeo = {
  rsmKey: string;
  id?: string | number; // in world-atlas countries-110m.json it's numeric ISO_N3
  properties?: GeoProps;
};

type GeographiesRenderProps = {
  geographies: RsmGeo[];
};

type WorldCountry = {
  cca3?: unknown; // ISO3
  ccn3?: unknown; // numeric ISO (string)
};

function normIso3(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  return s.length === 3 ? s : null;
}

function normN3(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  if (!s) return null;
  // pad numeric to 3 digits ("4" -> "004") to match world-atlas ids
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(3, "0");
}

export default function StratifyMap({
  rows,
  topoJsonUrl,
  selectedIso3 = null,
  onSelectIso3,
  height = 420,
}: Props) {
  // Map: ISO3 -> value
  const valueByIso3 = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.iso3.toUpperCase(), r.value);
    return m;
  }, [rows]);

  // Build: N3 -> ISO3 using world-countries dataset
  const n3ToIso3 = useMemo(() => {
    const m = new Map<string, string>();
    const arr = Array.isArray(worldCountries) ? (worldCountries as WorldCountry[]) : [];
    for (const c of arr) {
      const iso3 = normIso3(c.cca3);
      const n3 = normN3(c.ccn3);
      if (iso3 && n3) m.set(n3, iso3);
    }
    return m;
  }, []);

  const values = useMemo(
    () => rows.map((r) => r.value).filter((v) => Number.isFinite(v)),
    [rows]
  );

  const colorFor = useMemo(() => {
    if (values.length === 0) return () => "#e5e7eb";
    const s = scaleQuantile<number>()
      .domain(values)
      .range(Array.from({ length: 7 }, (_, i) => d3Blues((i + 1) / 7)));
    return (v: number) => s(v);
  }, [values]);

  function geoToIso3(geo: RsmGeo): string | null {
    // world-atlas uses geo.id as numeric ISO_N3
    const n3 = normN3(geo.id);
    if (!n3) return null;
    return n3ToIso3.get(n3) ?? null;
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border bg-white overflow-hidden">
        <ComposableMap
          projection="geoMercator"
          style={{ width: "100%", height }}
          projectionConfig={{ scale: 140 }}
        >
          <Geographies geography={topoJsonUrl}>
            {({ geographies }: GeographiesRenderProps) =>
              geographies.map((geo: RsmGeo) => {
                const iso3 = geoToIso3(geo);
                const value = iso3 ? valueByIso3.get(iso3) : undefined;
                const isSelected = !!iso3 && selectedIso3 === iso3;

                const fill =
                  typeof value === "number" && Number.isFinite(value) ? colorFor(value) : "#e5e7eb";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => {
                      if (iso3 && onSelectIso3) onSelectIso3(iso3);
                    }}
                    style={{
                      default: {
                        fill,
                        outline: "none",
                        stroke: isSelected ? "#111827" : "#ffffff",
                        strokeWidth: isSelected ? 1.25 : 0.5,
                      },
                      hover: {
                        fill,
                        outline: "none",
                        stroke: "#111827",
                        strokeWidth: 1,
                      },
                      pressed: { fill, outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
    </div>
  );
}
