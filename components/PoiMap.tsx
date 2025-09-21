"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type Poi = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  value?: number;
};

export type PoiMapProps = {
  points: readonly Poi[];
  selectedId?: string;
  onPointClick?: (p: Poi) => void;
  className?: string;
  center?: { lon: number; lat: number; zoom?: number };
};

export default function PoiMap({
  points,
  selectedId,
  onPointClick,
  className,
  center,
}: PoiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // compute bounds for auto-fit
  const bounds = useMemo(() => {
    if (!points.length) return null;
    let minLat = Infinity,
      minLon = Infinity,
      maxLat = -Infinity,
      maxLon = -Infinity;
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }
    return { minLat, minLon, maxLat, maxLon };
  }, [points]);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: center ? [center.lon, center.lat] : [0, 20],
      zoom: center?.zoom ?? 1.5,
      attributionControl: { compact: true }, // ✅ fix: provide options, not `true`
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    mapRef.current = map;

    map.on("load", () => {
      if (!center && bounds) {
        map.fitBounds(
          [
            [bounds.minLon, bounds.minLat],
            [bounds.maxLon, bounds.maxLat],
          ],
          { padding: 24, duration: 0 }
        );
      }
    });

    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // add/update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const p of points) {
      const el = document.createElement("div");
      const isSel = p.id === selectedId;
      el.style.width = isSel ? "12px" : "9px";
      el.style.height = isSel ? "12px" : "9px";
      el.style.borderRadius = "50%";
      el.style.background = isSel ? "#60a5fa" : "#22d3ee";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.6)";
      el.title = p.name;
      el.onclick = () => onPointClick?.(p);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [points, selectedId, onPointClick]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="w-full h-full rounded-lg border border-slate-800 overflow-hidden"
      />
    </div>
  );
}
