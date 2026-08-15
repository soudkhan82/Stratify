"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "@vnedyalk0v/react19-simple-maps";

import { scaleQuantile } from "d3-scale";
import { interpolateBlues } from "d3-scale-chromatic";

import isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

/* register once */
let __ISO_INIT__ = false;
function initIso() {
  if (__ISO_INIT__) return;
  isoCountries.registerLocale(enLocale as any);
  __ISO_INIT__ = true;
}

/* =======================
   Types
======================= */

export type StratifyMapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

type Props = {
  rows: StratifyMapRow[];
  topoJsonUrl: string;
  selectedIso3: string | null;
  onSelectIso3?: (iso3: string) => void;
  indicatorLabel: string;
  indicatorUnit?: string;
};

type GeoProps = {
  name?: unknown;
  NAME?: unknown;
  NAME_LONG?: unknown;

  ISO_A3?: unknown;
  ADM0_A3?: unknown;
  SOV_A3?: unknown;
  WB_A3?: unknown;
  ISO3?: unknown;
  iso3?: unknown;
  iso_a3?: unknown;
};

type TooltipState = {
  show: boolean;
  x: number;
  y: number;
  iso3: string;
  country: string;
  region: string | null;
  value?: number;
};

/* =======================
   Helpers
======================= */

function cleanISO3(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}
function isValidISO3(v: unknown): v is string {
  return typeof v === "string" && /^[A-Z]{3}$/.test(v);
}
function fmtNumber(v?: number): string {
  if (!Number.isFinite(v)) return "—";
  const n = v as number;
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return n.toLocaleString();
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
function getLocalXY(e: React.MouseEvent<SVGPathElement, MouseEvent>): {
  x: number;
  y: number;
} {
  const svg = e.currentTarget.ownerSVGElement;
  const rect = svg?.getBoundingClientRect();
  return {
    x: rect ? e.clientX - rect.left : e.clientX,
    y: rect ? e.clientY - rect.top : e.clientY,
  };
}

function iso3FromGeo(geo: unknown): string {
  initIso();
  const g = geo as any;
  const p = (g?.properties ?? {}) as GeoProps;

  const propCand = [
    p.ISO_A3,
    p.ADM0_A3,
    p.SOV_A3,
    p.WB_A3,
    p.ISO3,
    p.iso3,
    p.iso_a3,
  ]
    .map(cleanISO3)
    .find((x) => isValidISO3(x) && x !== "ATA" && x !== "-99");

  if (propCand) return propCand;

  const rawId = String(g?.id ?? "").trim();
  if (rawId) {
    const num = rawId.padStart(3, "0");
    const a3 = isoCountries.numericToAlpha3(num);
    const iso3 = cleanISO3(a3);
    if (isValidISO3(iso3)) return iso3;
  }

  return "";
}

/**
 * centroid of Polygon/MultiPolygon using bbox center.
 * (Good enough to separate mainland France vs French Guiana in world-atlas@2.)
 */
function centroidLonLat(geo: any): [number, number] | null {
  const geom = geo?.geometry;
  if (!geom) return null;

  const coords = geom.coordinates;
  if (!coords) return null;

  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;

  function visitPoint(pt: any) {
    const lon = Number(pt?.[0]);
    const lat = Number(pt?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }

  // Polygon: [ [ [lon,lat], ... ] , [hole...], ... ]
  // MultiPolygon: [ Polygon, Polygon, ... ]
  if (geom.type === "Polygon") {
    for (const ring of coords) for (const pt of ring) visitPoint(pt);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of coords)
      for (const ring of poly) for (const pt of ring) visitPoint(pt);
  } else {
    return null;
  }

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

/**
 * ✅ FIX for world-atlas@2: FRA appears twice (mainland + overseas).
 * Remove the overseas FRA piece(s) by longitude (western hemisphere).
 */
function isFranceDuplicateGeo(geo: any): boolean {
  const iso = iso3FromGeo(geo);
  if (iso !== "FRA") return false;

  const c = centroidLonLat(geo);
  if (!c) return false;

  const [lon] = c;

  // Mainland France ~ +2 lon. French Guiana ~ -53 lon.
  // Remove any FRA geometry far west.
  return lon < -20;
}

/* =======================
   Component
======================= */

export default function StratifyMap({
  rows,
  topoJsonUrl,
  selectedIso3,
  onSelectIso3,
  indicatorLabel,
  indicatorUnit,
}: Props) {
  const [zoom, setZoom] = useState<number>(1);

  const [tip, setTip] = useState<TooltipState>({
    show: false,
    x: 0,
    y: 0,
    iso3: "",
    country: "",
    region: null,
    value: undefined,
  });

  const [geoData, setGeoData] = useState<any>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setGeoErr(null);
        setGeoLoading(true);

        const url = topoJsonUrl.includes("?")
          ? `${topoJsonUrl}&v=1`
          : `${topoJsonUrl}?v=1`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok)
          throw new Error(
            `TopoJSON fetch failed: ${res.status} ${res.statusText}`,
          );

        const json = await res.json();
        if (!alive) return;
        setGeoData(json);
      } catch (e: any) {
        if (!alive) return;
        setGeoErr(e?.message || "Failed to load map data");
        setGeoData(null);
      } finally {
        if (!alive) return;
        setGeoLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [topoJsonUrl]);

  const selected = selectedIso3 ? selectedIso3.toUpperCase() : null;

  const rowByIso = useMemo(() => {
    const m = new Map<string, StratifyMapRow>();
    for (const r of rows || []) {
      const iso = cleanISO3(r.iso3);
      if (isValidISO3(iso) && !m.has(iso)) m.set(iso, r);
    }
    return m;
  }, [rows]);

  const valueByIso = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows || []) {
      const iso = cleanISO3(r.iso3);
      const v = Number(r.value);
      if (isValidISO3(iso) && Number.isFinite(v)) m.set(iso, v);
    }
    return m;
  }, [rows]);

  const values = useMemo(() => Array.from(valueByIso.values()), [valueByIso]);

  const quant = useMemo(() => {
    if (!values.length) return null;
    return scaleQuantile<number>()
      .domain(values)
      .range([0.2, 0.35, 0.5, 0.65, 0.8, 0.95]);
  }, [values]);

  const MISSING_FILL = "#e5e7eb";
  const STROKE = "#94a3b8";
  const HOVER_FILL = "#64748b";
  const SELECT_STROKE = "#1f2937";

  const legendStops = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95];

  return (
    <div className="relative rounded-xl border bg-white p-3">
      {geoLoading ? (
        <div className="mb-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Loading map…
        </div>
      ) : geoErr ? (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {geoErr}
        </div>
      ) : null}

      {/* Zoom controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => clamp(z * 1.3, 1, 8))}
          className="h-9 w-9 rounded-lg border bg-white shadow text-sm font-bold"
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => clamp(z / 1.3, 1, 8))}
          className="h-9 w-9 rounded-lg border bg-white shadow text-sm font-bold"
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="h-9 w-9 rounded-lg border bg-white shadow text-[11px] font-bold"
          aria-label="Reset zoom"
          title="Reset"
        >
          ⟳
        </button>
      </div>

      {/* Tooltip */}
      {tip.show ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[260px] rounded-lg border bg-white/95 px-3 py-2 text-xs shadow-lg"
          style={{ left: tip.x + 12, top: Math.max(tip.y - 10, 0) }}
        >
          <div className="text-[11px] font-semibold text-slate-900">
            {tip.country}{" "}
            <span className="font-normal text-slate-500">({tip.iso3})</span>
          </div>

          {tip.region ? (
            <div className="mt-0.5 text-[11px] text-slate-600">
              Region: {tip.region}
            </div>
          ) : null}

          <div className="mt-1 border-t pt-1 text-[11px] text-slate-700">
            <span className="font-medium">{indicatorLabel}:</span>{" "}
            <span className="font-semibold text-slate-900">
              {fmtNumber(tip.value)}
            </span>
            {indicatorUnit ? (
              <span className="text-slate-500"> {indicatorUnit}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <ComposableMap
        projection="geoMercator"
        width={1200}
        height={600}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup zoom={zoom}>
          <Geographies
            geography={geoData ?? { type: "FeatureCollection", features: [] }}
          >
            {({ geographies }: any) => (
              <>
                {(geographies as any[]).map((geo, idx) => {
                  // ✅ FIX: remove France overseas duplicate
                  if (isFranceDuplicateGeo(geo)) return null;

                  const iso3 = iso3FromGeo(geo);
                  const dbRow = iso3 ? rowByIso.get(iso3) : undefined;
                  const value = iso3 ? valueByIso.get(iso3) : undefined;

                  const isSelected = !!selected && !!iso3 && iso3 === selected;

                  const fillColor =
                    value !== undefined && quant
                      ? interpolateBlues(quant(value)!)
                      : MISSING_FILL;

                  const props = (geo as any)?.properties as
                    | GeoProps
                    | undefined;
                  const geoName = String((props as any)?.name ?? "").trim();
                  const countryName =
                    dbRow?.country?.trim() || geoName || iso3 || "—";

                  const key =
                    (geo as any)?.rsmKey ??
                    (geo as any)?.id ??
                    `${iso3 || "geo"}-${idx}`;

                  return (
                    <Geography
                      key={key}
                      geography={geo}
                      fill={fillColor}
                      stroke={isSelected ? SELECT_STROKE : STROKE}
                      strokeWidth={isSelected ? 1.2 : 0.8}
                      style={{
                        default: {
                          fill: fillColor,
                          stroke: isSelected ? SELECT_STROKE : STROKE,
                          strokeWidth: isSelected ? 1.2 : 0.8,
                          outline: "none",
                          cursor: iso3 ? "pointer" : "default",
                          opacity: 1,
                        },
                        hover: {
                          fill: HOVER_FILL,
                          stroke: SELECT_STROKE,
                          strokeWidth: 1.2,
                          outline: "none",
                          opacity: 1,
                        },
                        pressed: {
                          fill: fillColor,
                          stroke: SELECT_STROKE,
                          strokeWidth: 1.2,
                          outline: "none",
                        },
                      }}
                      onClick={() => {
                        if (!iso3) return;
                        onSelectIso3?.(iso3);
                      }}
                      onMouseEnter={(
                        e: React.MouseEvent<SVGPathElement, MouseEvent>,
                      ) => {
                        if (!iso3) return;
                        const { x, y } = getLocalXY(e);
                        setTip({
                          show: true,
                          x,
                          y,
                          iso3,
                          country: countryName,
                          region: dbRow?.region ?? null,
                          value,
                        });
                      }}
                      onMouseMove={(
                        e: React.MouseEvent<SVGPathElement, MouseEvent>,
                      ) => {
                        if (!iso3) return;
                        const { x, y } = getLocalXY(e);
                        setTip((prev) =>
                          prev.show && prev.iso3 === iso3
                            ? { ...prev, x, y }
                            : prev,
                        );
                      }}
                      onMouseLeave={() =>
                        setTip((p) => ({ ...p, show: false }))
                      }
                    />
                  );
                })}
              </>
            )}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span>Low</span>
          {legendStops.map((t) => (
            <div
              key={t}
              className="h-3 w-5"
              style={{ background: interpolateBlues(t) }}
            />
          ))}
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
