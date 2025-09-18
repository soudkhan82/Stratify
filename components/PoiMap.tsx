// components/PoiMap.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Source, Layer, MapRef, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Feature, Point } from "geojson";

export type Poi = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  value: number; // kept for compatibility (not used for color)
};

type PoiProps = { id: string; name: string; value: number };

type PoiMapProps = {
  points: Poi[];
  center?: { lon: number; lat: number; zoom?: number };
  selected?: { lon: number; lat: number }; // kept for compatibility (not strictly needed)
  selectedId?: string; // used to render blue highlight
  onPointClick?: (p: Poi) => void; // ← emits clicked point
};

export default function PoiMap({
  points,
  center,
  selected, // not used for marker; highlight is via selectedId
  selectedId,
  onPointClick,
}: PoiMapProps) {
  // Build GeoJSON once per change
  const fc: FeatureCollection<Point, PoiProps> = useMemo(
    () => ({
      type: "FeatureCollection",
      features: points.map<Feature<Point, PoiProps>>((p) => ({
        type: "Feature",
        properties: { id: p.id, name: p.name, value: p.value },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      })),
    }),
    [points]
  );

  const mapRef = useRef<MapRef | null>(null);
  const [hovered, setHovered] = useState<{
    lon: number;
    lat: number;
    name: string;
  } | null>(null);

  // Fly to center when provided
  useEffect(() => {
    if (!center || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [center.lon, center.lat],
      zoom: center.zoom ?? 3,
      duration: 800,
    });
  }, [center?.lon, center?.lat, center?.zoom]);

  return (
    <div className="h-[520px] rounded-xl overflow-hidden border">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 10, latitude: 20, zoom: 1.4 }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        interactiveLayerIds={["poi-circles"]}
        onMouseMove={(e) => {
          const f = e.features?.[0];
          if (f && f.properties && f.geometry?.type === "Point") {
            const [lon, lat] = f.geometry.coordinates as [number, number];
            setHovered({ lon, lat, name: String(f.properties.name) });
          } else {
            setHovered(null);
          }
        }}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          if (!onPointClick) return;
          const f = e.features?.[0];
          if (!f || !f.properties || f.geometry?.type !== "Point") return;

          const [lon, lat] = f.geometry.coordinates as [number, number];
          const id = String(f.properties.id);
          const name = String(f.properties.name);
          const value = Number(f.properties.value ?? 0);

          onPointClick({ id, name, lat, lon, value });
        }}
      >
        <Source id="pois" type="geojson" data={fc}>
          {/* Base circles (neutral color, fixed size) */}
          <Layer
            id="poi-circles"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": "#64748b", // slate-500 neutral
              "circle-opacity": 0.9,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#fff",
            }}
          />

          {/* Selected highlight (blue halo) */}
          {selectedId && (
            <Layer
              id="poi-selected"
              type="circle"
              filter={["==", ["get", "id"], selectedId]}
              paint={{
                "circle-radius": 9,
                "circle-color": "#2563eb", // blue-600
                "circle-opacity": 1,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#fff",
              }}
            />
          )}
        </Source>

        {/* Hover popup (name only) */}
        {hovered && (
          <Popup
            longitude={hovered.lon}
            latitude={hovered.lat}
            closeButton={false}
            closeOnClick={false}
          >
            <div className="text-sm">
              <strong>{hovered.name}</strong>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
