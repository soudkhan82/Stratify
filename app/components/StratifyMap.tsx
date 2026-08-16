"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, Pane, useMap } from "react-leaflet";

export type StratifyMapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

type Props = {
  rows: StratifyMapRow[];
  selectedIso3: string | null;
  onSelectIso3?: (iso3: string) => void;
  indicatorLabel: string;
  indicatorUnit?: string;
  scale?: "sequential" | "diverging";
  sourceLabel?: string;
  // Kept optional for backwards compatibility with the old component API.
  topoJsonUrl?: string;
};

type WorldFeatureProperties = {
  name?: string;
  iso3?: string;
};

const WORLD_MAP_URL = "/maps/world-110m.min.geojson";

const SEQUENTIAL_COLORS = [
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#2563eb",
  "#1e3a8a",
] as const;

const DIVERGING_COLORS = [
  "#991b1b",
  "#dc2626",
  "#fecaca",
  "#f8fafc",
  "#bfdbfe",
  "#3b82f6",
  "#1e3a8a",
] as const;

const MISSING_FILL = "#eef2f7";
const DEFAULT_STROKE = "#b8c6d8";
const SELECTED_STROKE = "#312e81";
const HOVER_STROKE = "#0f172a";

function cleanIso3(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function compact(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return "No data";

  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) {
    return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function formatMapValue(value: number | undefined, unit?: string) {
  if (value == null || !Number.isFinite(value)) return "No data";
  if (unit === "US$") return `$${compact(value)}`;
  if (unit === "%") return `${compact(value)}%`;
  if (unit && unit.startsWith("% of")) return `${compact(value)} ${unit}`;
  if (unit === "years") return `${compact(value)} years`;
  if (unit === "months") return `${compact(value)} months`;
  if (unit === "count") return compact(value);
  return unit ? `${compact(value)} ${unit}` : compact(value);
}

function quantile(sorted: number[], percentile: number) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function buildThresholds(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return [
    quantile(sorted, 0.17),
    quantile(sorted, 0.34),
    quantile(sorted, 0.5),
    quantile(sorted, 0.67),
    quantile(sorted, 0.84),
  ];
}

function sequentialColor(value: number | undefined, thresholds: number[]) {
  if (value == null || !Number.isFinite(value)) return MISSING_FILL;
  let index = 0;
  while (index < thresholds.length && value > thresholds[index]) index += 1;
  return SEQUENTIAL_COLORS[Math.min(index, SEQUENTIAL_COLORS.length - 1)];
}

function divergingCap(values: number[]) {
  const abs = values
    .filter(Number.isFinite)
    .map((value) => Math.abs(value))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  return Math.max(quantile(abs, 0.9), 0.000001);
}

function divergingColor(value: number | undefined, cap: number) {
  if (value == null || !Number.isFinite(value)) return MISSING_FILL;
  const ratio = Math.max(-1, Math.min(1, value / cap));
  if (ratio <= -0.66) return DIVERGING_COLORS[0];
  if (ratio <= -0.25) return DIVERGING_COLORS[1];
  if (ratio < -0.05) return DIVERGING_COLORS[2];
  if (ratio <= 0.05) return DIVERGING_COLORS[3];
  if (ratio < 0.25) return DIVERGING_COLORS[4];
  if (ratio < 0.66) return DIVERGING_COLORS[5];
  return DIVERGING_COLORS[6];
}

function ResetViewport({ resetSignal }: { resetSignal: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([18, 3], 1.35, { animate: false });
  }, [map, resetSignal]);
  return null;
}

function StratifyMapComponent({
  rows,
  selectedIso3,
  onSelectIso3,
  indicatorLabel,
  indicatorUnit,
  scale = "sequential",
  sourceLabel = "World Bank WDI",
}: Props) {
  const [world, setWorld] = useState<any>(null);
  const [geoError, setGeoError] = useState("");
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    fetch(WORLD_MAP_URL, { signal: controller.signal, cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`World boundary HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!alive) return;
        setWorld(payload);
        setGeoError("");
      })
      .catch((error) => {
        if (error?.name === "AbortError" || !alive) return;
        setGeoError(error instanceof Error ? error.message : "Unable to load world boundaries.");
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const selected = cleanIso3(selectedIso3);

  const rowByIso = useMemo(() => {
    const map = new Map<string, StratifyMapRow>();
    for (const row of rows) {
      const iso3 = cleanIso3(row.iso3);
      if (iso3.length === 3) map.set(iso3, row);
    }
    return map;
  }, [rows]);

  const values = useMemo(
    () => rows.map((row) => Number(row.value)).filter(Number.isFinite),
    [rows],
  );

  const thresholds = useMemo(() => buildThresholds(values), [values]);
  const zeroCap = useMemo(() => divergingCap(values), [values]);

  const renderKey = useMemo(
    () =>
      [
        indicatorLabel,
        scale,
        selected,
        rows.length,
        ...rows.slice(0, 8).map((row) => `${row.iso3}:${Math.round(row.value * 100)}`),
      ].join("|"),
    [indicatorLabel, scale, selected, rows],
  );

  function baseStyle(iso3: string) {
    const row = rowByIso.get(iso3);
    const isSelected = Boolean(selected && selected === iso3);
    const fillColor =
      scale === "diverging"
        ? divergingColor(row?.value, zeroCap)
        : sequentialColor(row?.value, thresholds);

    return {
      fillColor,
      fillOpacity: row ? 0.88 : 0.72,
      color: isSelected ? SELECTED_STROKE : DEFAULT_STROKE,
      weight: isSelected ? 2.4 : 0.75,
      opacity: 1,
    };
  }

  function onEachFeature(feature: any, layer: any) {
    const properties = (feature?.properties ?? {}) as WorldFeatureProperties;
    const iso3 = cleanIso3(properties.iso3);
    const row = rowByIso.get(iso3);
    const country = row?.country || properties.name || iso3 || "Country";
    const tooltipValue = row
      ? formatMapValue(row.value, indicatorUnit)
      : "No data in current scope";

    layer.bindTooltip(
      `
        <div class="stratify-home-map-tip">
          <div class="stratify-home-map-tip-country">${escapeHtml(country)}</div>
          <div class="stratify-home-map-tip-value">
            ${escapeHtml(indicatorLabel)}: <strong>${escapeHtml(tooltipValue)}</strong>
          </div>
        </div>
      `,
      {
        sticky: true,
        direction: "top",
        opacity: 0.98,
        className: "stratify-home-leaflet-tooltip",
      },
    );

    layer.on({
      mouseover: (event: any) => {
        const path = event.target;
        path.setStyle({
          color: HOVER_STROKE,
          weight: 2,
          fillOpacity: row ? 0.96 : 0.78,
        });
        if (path.bringToFront) path.bringToFront();
      },
      mouseout: (event: any) => {
        event.target.setStyle(baseStyle(iso3));
      },
      click: () => {
        if (!row || !iso3) return;
        onSelectIso3?.(iso3);
      },
    });
  }

  const legendColors = scale === "diverging" ? DIVERGING_COLORS : SEQUENTIAL_COLORS;

  return (
    <div className="relative h-full min-h-[500px] overflow-hidden rounded-[24px] bg-[#dfeef5]">
      {!world && !geoError ? (
        <div className="pointer-events-none absolute inset-0 z-[800] flex items-center justify-center bg-white/35 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-xs font-black text-slate-600 shadow-md">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            Preparing Leaflet map
          </div>
        </div>
      ) : null}

      {geoError ? (
        <div className="absolute left-4 top-4 z-[820] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 shadow">
          {geoError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setResetSignal((value) => value + 1)}
        className="absolute right-3 top-3 z-[820] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600 shadow-md backdrop-blur hover:bg-white"
      >
        Reset map
      </button>

      <MapContainer
        center={[18, 3]}
        zoom={1.35}
        minZoom={1.25}
        maxZoom={7}
        zoomSnap={0.25}
        zoomDelta={0.5}
        scrollWheelZoom
        preferCanvas={false}
        worldCopyJump={false}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        inertia={false}
        maxBounds={[
          [-62, -180],
          [84, 180],
        ]}
        maxBoundsViscosity={0.9}
        attributionControl={false}
        className="h-full min-h-[500px] w-full"
        style={{ background: "#dfeef5" }}
      >
        <Pane name="home-choropleth" style={{ zIndex: 350 }}>
          {world ? (
            <GeoJSON
              key={renderKey}
              data={world}
              style={(feature) => {
                const properties = (feature?.properties ?? {}) as WorldFeatureProperties;
                return baseStyle(cleanIso3(properties.iso3));
              }}
              onEachFeature={onEachFeature}
            />
          ) : null}
        </Pane>
        <ResetViewport resetSignal={resetSignal} />
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[700] flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur">
        <span className="text-[9px] font-black uppercase tracking-[0.09em] text-slate-400">
          {scale === "diverging" ? "Negative" : "Lower"}
        </span>
        <div className="flex gap-0.5">
          {legendColors.map((color) => (
            <span key={color} className="h-3 w-5" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.09em] text-slate-400">
          {scale === "diverging" ? "Positive" : "Higher"}
        </span>
        <span className="ml-1 h-3 w-4 border border-slate-200 bg-[#eef2f7]" />
        <span className="text-[9px] font-bold text-slate-400">No data</span>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-[700] rounded-lg bg-white/90 px-2 py-1 text-[9px] font-bold text-slate-400 shadow-sm backdrop-blur">
        Natural Earth | {sourceLabel}
      </div>
    </div>
  );
}

export default memo(StratifyMapComponent);