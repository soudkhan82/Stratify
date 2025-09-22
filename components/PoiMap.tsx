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

type MapView =
  | {
      type: "bounds";
      bounds: [[number, number], [number, number]]; // [[south,west],[north,east]] in LAT,LON
      padding?: number;
    }
  | { type: "center"; center: [number, number]; zoom: number }; // [lat,lon]

export type PoiMapProps = {
  points: readonly Poi[];
  selectedId?: string;
  onPointClick?: (p: Poi) => void;
  className?: string;

  /** Auto-zoom view (bounds or center) */
  view?: MapView;

  /** Changing this string forces a re-fit (e.g., `${continent}:${country}`) */
  fitKey?: string;

  /** Legacy center prop (kept for backward-compat) */
  center?: { lon: number; lat: number; zoom?: number };
};

export default function PoiMap({
  points,
  selectedId,
  onPointClick,
  className,
  view,
  fitKey,
  center,
}: PoiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const latestViewRef = useRef<MapView | undefined>(view);

  useEffect(() => {
    latestViewRef.current = view;
  }, [view]);

  const initialBounds = useMemo(() => {
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

  const applyView = (map: MLMap, v: MapView) => {
    if (v.type === "bounds") {
      const [[s, w], [n, e]] = v.bounds; // lat,lon
      map.fitBounds(
        [
          [w, s], // lng,lat
          [e, n],
        ],
        { padding: v.padding ?? 24, duration: 700 }
      );
    } else {
      const [lat, lon] = v.center;
      map.easeTo({ center: [lon, lat], zoom: v.zoom, duration: 700 });
    }
  };

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: center ? [center.lon, center.lat] : [0, 20],
      zoom: center?.zoom ?? 1.5,
      attributionControl: false, // boolean here
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    mapRef.current = map;

    const onLoad = () => {
      const v = latestViewRef.current;
      if (v) {
        applyView(map, v);
      } else if (!center && initialBounds) {
        map.fitBounds(
          [
            [initialBounds.minLon, initialBounds.minLat],
            [initialBounds.maxLon, initialBounds.maxLat],
          ],
          { padding: 24, duration: 0 }
        );
      }
    };

    if (map.isStyleLoaded()) onLoad();
    else map.once("load", onLoad);

    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react to view / fitKey changes after load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !view) return;

    if (!map.isStyleLoaded()) {
      const handler = () => applyView(map, view);
      map.once("load", handler);
      // ✅ cleanup must return void, not the map object
      return () => {
        map.off("load", handler);
      };
    }

    applyView(map, view);
  }, [view, fitKey]);

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
