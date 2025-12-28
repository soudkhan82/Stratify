// app/components/StratifyMap.tsx
"use client";

import { useMemo } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleQuantile } from "d3-scale";
import { interpolateBlues as d3Blues } from "d3-scale-chromatic";

export type StratifyMapRow = {
  iso3: string; // ISO3 e.g. "PAK"
  country: string;
  region: string | null;
  value: number;
};

type Props = {
  rows: StratifyMapRow[];
  topoJsonUrl: string;
  selectedIso3?: string | null;
  onSelectIso3?: (iso3: string) => void;
  height?: number;
};

type GeoFeatureProperties = {
  ISO_A3?: string;
  ADM0_A3?: string;
  NAME?: string;
};

// Minimal shape we actually use from react-simple-maps “geo”
type RsmGeo = {
  rsmKey: string;
  type: "Feature";
  properties?: GeoFeatureProperties;
};

type GeographiesRenderProps = {
  geographies: RsmGeo[];
};

export default function StratifyMap({
  rows,
  topoJsonUrl,
  selectedIso3 = null,
  onSelectIso3,
  height = 420,
}: Props) {
  const valueByIso3 = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.iso3, r.value);
    return m;
  }, [rows]);

  const values = useMemo(
    () => rows.map((r) => r.value).filter((v) => Number.isFinite(v)),
    [rows]
  );

  const colorScale = useMemo(() => {
    if (values.length === 0) return (_v: number) => "#e5e7eb"; // gray-200
    const s = scaleQuantile<number>()
      .domain(values)
      .range(Array.from({ length: 7 }, (_, i) => d3Blues((i + 1) / 7)));
    return (v: number) => s(v);
  }, [values]);

  function getIso3FromFeature(geo: RsmGeo): string | null {
    const p = geo.properties;
    const iso = (p?.ISO_A3 ?? p?.ADM0_A3 ?? "").toString().trim();
    return iso && iso !== "-99" ? iso : null;
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
                const iso3 = getIso3FromFeature(geo);
                const value = iso3 ? valueByIso3.get(iso3) : undefined;
                const isSelected = !!iso3 && selectedIso3 === iso3;

                const fill =
                  typeof value === "number" && Number.isFinite(value)
                    ? colorScale(value)
                    : "#e5e7eb";

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
