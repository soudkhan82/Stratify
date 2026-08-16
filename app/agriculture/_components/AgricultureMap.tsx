"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Pane,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";

export type AgricultureMapRow = {
  iso3: string;
  areaCode: string;
  country: string;
  lat: number;
  lng: number;
  crop: string;
  cropKey: string;
  year: number;
  value: number;
  unit: string;
  rank?: number | null;
  sharePct?: number | null;
};

export type BusinessMapRow = {
  id: string;
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  roles: string[];
  coverage: string;
  website: string;
  verified: boolean;
  matchType?: string;
};

export type AgricultureMapMode =
  | "production"
  | "businesses"
  | "both";

const WORLD_MAP_URL = "/maps/world-110m.min.geojson";

function compact(value: number) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function BaseWorldLayer() {
  const [world, setWorld] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    fetch(WORLD_MAP_URL, {
      signal: controller.signal,
      cache: "force-cache",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `World map HTTP ${response.status}`,
          );
        }

        return response.json();
      })
      .then((data) => {
        if (alive) {
          setWorld(data);
        }
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.warn(
            "Agriculture base world layer unavailable:",
            error,
          );
        }
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  if (!world) {
    return null;
  }

  return (
    <GeoJSON
      data={world}
      interactive={false}
      style={{
        color: "#b9c8d8",
        weight: 0.65,
        opacity: 0.95,
        fillColor: "#f8fafc",
        fillOpacity: 1,
      }}
    />
  );
}

function MapViewport({
  rows,
  businesses,
  selected,
  mode,
}: {
  rows: AgricultureMapRow[];
  businesses: BusinessMapRow[];
  selected: AgricultureMapRow | null;
  mode: AgricultureMapMode;
}) {
  const map = useMap();

  useEffect(() => {
    if (selected && mode !== "businesses") {
      map.setView(
        [selected.lat, selected.lng],
        Math.max(map.getZoom(), 4),
        { animate: false },
      );
      return;
    }

    const productionPoints =
      mode === "businesses"
        ? []
        : rows
            .filter(
              (row) =>
                Number.isFinite(row.lat) &&
                Number.isFinite(row.lng),
            )
            .map(
              (row) =>
                [row.lat, row.lng] as [number, number],
            );

    const businessPoints =
      mode === "production"
        ? []
        : businesses
            .filter(
              (business) =>
                Number.isFinite(business.lat) &&
                Number.isFinite(business.lng),
            )
            .map(
              (business) =>
                [
                  business.lat,
                  business.lng,
                ] as [number, number],
            );

    const points = [
      ...productionPoints,
      ...businessPoints,
    ];

    if (!points.length) {
      map.setView([18, 5], 1.5, {
        animate: false,
      });
      return;
    }

    map.fitBounds(points, {
      paddingTopLeft: [70, 55],
      paddingBottomRight: [70, 55],
      maxZoom: mode === "businesses" ? 2.2 : 1.5,
      animate: false,
    });
  }, [map, rows, businesses, selected, mode]);

  return null;
}

function AgricultureMapComponent({
  rows,
  businesses,
  selectedIso3,
  mode,
  onSelect,
}: {
  rows: AgricultureMapRow[];
  businesses: BusinessMapRow[];
  selectedIso3: string | null;
  mode: AgricultureMapMode;
  onSelect: (row: AgricultureMapRow) => void;
}) {
  const maxValue = useMemo(
    () =>
      Math.max(
        1,
        ...rows.map(
          (row) => Number(row.value) || 0,
        ),
      ),
    [rows],
  );

  const selected = useMemo(
    () =>
      rows.find(
        (row) => row.iso3 === selectedIso3,
      ) ?? null,
    [rows, selectedIso3],
  );

  function radius(value: number) {
    const ratio =
      Math.max(0, value) / maxValue;

    return Math.max(
      4.5,
      Math.min(
        25,
        4.5 + Math.sqrt(ratio) * 20.5,
      ),
    );
  }

  return (
    <div className="relative h-full min-h-[410px] overflow-hidden rounded-[24px] bg-[#dcecf3]">
      <MapContainer
        center={[18, 5]}
        zoom={1.5}
        minZoom={1.5}
        maxZoom={7}
        zoomSnap={0.5}
        zoomDelta={0.5}
        scrollWheelZoom
        preferCanvas
        worldCopyJump={false}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        inertia={false}
        maxBounds={[
          [-84, -180],
          [84, 180],
        ]}
        maxBoundsViscosity={0.8}
        attributionControl={false}
        className="h-full min-h-[410px] w-full"
        style={{
          background: "#dcecf3",
        }}
      >
        <Pane
          name="agriculture-tooltip-layer"
          style={{
            zIndex: 900,
            pointerEvents: "none",
          }}
        />

        <Pane
          name="agriculture-popup-layer"
          style={{
            zIndex: 1000,
          }}
        />

        <Pane
          name="agriculture-basemap"
          style={{
            zIndex: 200,
            pointerEvents: "none",
          }}
        >
          <BaseWorldLayer />
        </Pane>

        {mode !== "businesses" ? (
          <Pane
            name="agriculture-production"
            style={{ zIndex: 450 }}
          >
            {rows.map((row) => {
              const active =
                row.iso3 === selectedIso3;

              return (
                <CircleMarker
                  key={`${row.iso3}-${row.year}-${row.cropKey}`}
                  center={[
                    row.lat,
                    row.lng,
                  ]}
                  radius={radius(row.value)}
                  pathOptions={{
                    color: active
                      ? "#312e81"
                      : "#047857",
                    fillColor: active
                      ? "#6366f1"
                      : "#10b981",
                    fillOpacity: active
                      ? 0.86
                      : 0.68,
                    opacity: 0.98,
                    weight: active
                      ? 2.6
                      : 1.35,
                  }}
                  eventHandlers={{
                    click: () =>
                      onSelect(row),
                  }}
                >
                  <Tooltip pane="agriculture-tooltip-layer"
                    direction="top"
                    opacity={0.98}
                    sticky
                  >
                    <div className="min-w-[150px]">
                      <div className="font-extrabold text-slate-950">
                        {row.country}
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        {row.crop} | {row.year}
                      </div>

                      <div className="mt-1 text-sm font-black text-emerald-700">
                        {compact(row.value)}{" "}
                        {row.unit}
                      </div>

                      {row.rank ? (
                        <div className="mt-0.5 text-[11px] font-bold text-slate-500">
                          Global rank #
                          {row.rank}
                        </div>
                      ) : null}
                    </div>
                  </Tooltip>

                  <Popup pane="agriculture-popup-layer">
                    <div className="min-w-[190px]">
                      <div className="text-[15px] font-black text-slate-950">
                        {row.country}
                      </div>

                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {row.crop} production |
                        {" "}
                        {row.year}
                      </div>

                      <div className="mt-2 text-lg font-black text-emerald-700">
                        {compact(row.value)}{" "}
                        {row.unit}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="font-bold text-slate-400">
                            Rank
                          </div>
                          <div className="font-black text-slate-800">
                            {row.rank
                              ? `#${row.rank}`
                              : "n/a"}
                          </div>
                        </div>

                        <div>
                          <div className="font-bold text-slate-400">
                            Global share
                          </div>
                          <div className="font-black text-slate-800">
                            {row.sharePct ==
                            null
                              ? "n/a"
                              : `${row.sharePct.toFixed(
                                  2,
                                )}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </Pane>
        ) : null}

        {mode !== "production" ? (
          <Pane
            name="agriculture-businesses"
            style={{ zIndex: 520 }}
          >
            {businesses.map(
              (business) => (
                <CircleMarker
                  key={business.id}
                  center={[
                    business.lat,
                    business.lng,
                  ]}
                  radius={7}
                  pathOptions={{
                    color: "#9a3412",
                    fillColor: "#f59e0b",
                    fillOpacity: 0.92,
                    opacity: 1,
                    weight: 2,
                  }}
                >
                  <Tooltip pane="agriculture-tooltip-layer"
                    direction="top"
                    opacity={0.98}
                    sticky
                  >
                    <div className="min-w-[180px]">
                      <div className="font-black text-slate-950">
                        {business.name}
                      </div>

                      <div className="mt-1 text-xs font-semibold text-slate-600">
                        {business.city},{" "}
                        {business.country}
                      </div>

                      <div className="mt-1 text-[11px] font-bold text-amber-700">
                        {business.roles
                          .slice(0, 3)
                          .join(" | ")}
                      </div>
                    </div>
                  </Tooltip>

                  <Popup pane="agriculture-popup-layer">
                    <div className="min-w-[220px]">
                      <div className="text-[15px] font-black text-slate-950">
                        {business.name}
                      </div>

                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {business.city},{" "}
                        {business.country}
                      </div>

                      <div className="mt-2 text-xs font-bold text-amber-700">
                        {business.roles
                          .slice(0, 4)
                          .join(" | ")}
                      </div>

                      <div className="mt-2 text-[11px] font-semibold text-slate-500">
                        Map pin represents a
                        listed company office.
                        Coverage:{" "}
                        {business.coverage}.
                      </div>

                      <a
                        href={business.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-lg border border-amber-500 bg-amber-400 px-3 py-2 text-xs font-black !text-slate-950 shadow-sm transition hover:bg-amber-300"
                      >
                        Visit company
                      </a>
                    </div>
                  </Popup>
                </CircleMarker>
              ),
            )}
          </Pane>
        ) : null}

        <MapViewport
          rows={rows}
          businesses={businesses}
          selected={selected}
          mode={mode}
        />
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[600] flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur">
        {mode !== "businesses" ? (
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            Production
          </div>
        ) : null}

        {mode !== "production" ? (
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
            Businesses
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(
  AgricultureMapComponent,
);