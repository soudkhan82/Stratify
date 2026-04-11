"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type Props = {
  country: string;
  iso3: string;
  region: string;
};

const WORLDVIEW = "US";

export default function PolicyMapboxCard({ country, iso3, region }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [12, 18],
      zoom: 1.2,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      if (!map.getSource("countries")) {
        map.addSource("countries", {
          type: "vector",
          url: "mapbox://mapbox.country-boundaries-v1",
        });
      }

      const worldviewFilter: any = [
        "all",
        ["==", ["get", "disputed"], "false"],
        [
          "any",
          ["==", "all", ["get", "worldview"]],
          ["in", WORLDVIEW, ["get", "worldview"]],
        ],
      ];

      if (!map.getLayer("countries-highlight-fill")) {
        map.addLayer({
          id: "countries-highlight-fill",
          type: "fill",
          source: "countries",
          "source-layer": "country_boundaries",
          paint: {
            "fill-color": [
              "match",
              ["get", "iso_3166_1_alpha_3"],
              iso3,
              "#16a34a",
              "rgba(0,0,0,0)",
            ],
            "fill-opacity": 0.5,
          },
          filter: worldviewFilter,
        });
      }

      if (!map.getLayer("countries-highlight-line")) {
        map.addLayer({
          id: "countries-highlight-line",
          type: "line",
          source: "countries",
          "source-layer": "country_boundaries",
          paint: {
            "line-color": [
              "match",
              ["get", "iso_3166_1_alpha_3"],
              iso3,
              "#166534",
              "rgba(0,0,0,0)",
            ],
            "line-width": [
              "match",
              ["get", "iso_3166_1_alpha_3"],
              iso3,
              2.2,
              0,
            ],
          },
          filter: worldviewFilter,
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [iso3]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer("countries-highlight-fill")) {
      map.setPaintProperty("countries-highlight-fill", "fill-color", [
        "match",
        ["get", "iso_3166_1_alpha_3"],
        iso3,
        "#16a34a",
        "rgba(0,0,0,0)",
      ]);
    }

    if (map.getLayer("countries-highlight-line")) {
      map.setPaintProperty("countries-highlight-line", "line-color", [
        "match",
        ["get", "iso_3166_1_alpha_3"],
        iso3,
        "#166534",
        "rgba(0,0,0,0)",
      ]);

      map.setPaintProperty("countries-highlight-line", "line-width", [
        "match",
        ["get", "iso_3166_1_alpha_3"],
        iso3,
        2.2,
        0,
      ]);
    }
  }, [iso3]);

  return (
    <div className="rounded-2xl bg-white/65 backdrop-blur-md border border-white/60 shadow-lg overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-xs tracking-widest text-slate-500">
          POLICY INTELLIGENCE
        </div>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">
          Country Focus Map
        </h3>
        <div className="mt-1 text-sm text-slate-600">
          {country} · {region}
        </div>
      </div>

      <div ref={mapContainerRef} className="h-[560px] w-full" />
    </div>
  );
}
