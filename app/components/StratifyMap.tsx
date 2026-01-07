"use client";

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleQuantile } from "d3-scale";
import { interpolateBlues } from "d3-scale-chromatic";

/* =======================
   Types
======================= */

export type StratifyMapRow = {
  iso3: string; // ISO3 from DB (COD, SAU, etc.)
  country: string; // DB country name
  region: string | null;
  value: number;
};

type Props = {
  rows: StratifyMapRow[];
  topoJsonUrl: string;
  selectedIso3: string | null;
  onSelectIso3?: (iso3: string) => void;
};

type GeoProps = {
  name?: unknown;

  // Sometimes present if you later switch to better geojson/topojson
  ISO_A3?: unknown;
  ADM0_A3?: unknown;
  SOV_A3?: unknown;
  WB_A3?: unknown;
  ISO3?: unknown;
  iso3?: unknown;
  iso_a3?: unknown;
};

type RsmGeo = {
  rsmKey: string;
  id?: unknown; // ✅ your topo uses numeric IDs (ISO numeric)
  properties?: GeoProps;
};

/* =======================
   Helpers
======================= */

function stripDiacritics(s: string) {
  // "côte" -> "cote"
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normName(v: unknown) {
  return stripDiacritics(String(v ?? ""))
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\./g, "") // "S. Sudan" -> "s sudan"
    .replace(/\(|\)/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanISO3(v: unknown) {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function isValidISO3(v: unknown): v is string {
  return typeof v === "string" && /^[A-Z]{3}$/.test(v);
}

/* =======================
   ✅ Numeric ID -> ISO3 (no dependency)
   NOTE:
   - This fixes the countries you flagged.
   - If you want 100% global coverage, ask me for the full list and I’ll paste it.
======================= */

const ISO_NUM_TO_A3: Record<string, string> = {
  // From your screenshots + common problem ones
  "012": "DZA", // Algeria
  "818": "EGY", // Egypt
  "434": "LBY", // Libya
  "788": "TUN", // Tunisia
  "504": "MAR", // Morocco
  "242": "FJI", // Fiji

  "728": "SSD", // South Sudan (S. Sudan)
  "178": "COG", // Congo (Rep.)
  "180": "COD", // Congo (Dem. Rep.)

  "364": "IRN", // Iran
  "417": "KGZ", // Kyrgyzstan
  "140": "CAF", // Central African Rep.
  "384": "CIV", // Côte d'Ivoire
  "418": "LAO", // Laos
  "887": "YEM", // Yemen
  "703": "SVK", // Slovakia
  "732": "ESH", // Western Sahara
  "706": "SOM", // Somalia
  "807": "MKD", // North Macedonia
  "070": "BIH", // Bosnia and Herz.
};

function iso3FromNumericId(id: unknown): string {
  const raw = String(id ?? "").trim();
  if (!raw) return "";
  const padded = raw.padStart(3, "0");
  const iso3 = ISO_NUM_TO_A3[padded];
  return iso3 ? iso3.toUpperCase() : "";
}

/* =======================
   Name Fixes (last resort only)
======================= */

const TOPO_TO_DB_NAME: Record<string, string> = {
  "united states of america": "united states",
  russia: "russian federation",
  "iran islamic rep": "iran, islamic rep.",
  "iran islamic republic of": "iran, islamic rep.",

  vietnam: "viet nam",
  "south korea": "korea, rep.",
  "north korea": "korea, dem. people's rep.",

  "democratic republic of the congo": "congo, dem. rep.",
  "democratic republic of congo": "congo, dem. rep.",
  "dem rep congo": "congo, dem. rep.",
  congo: "congo, rep.", // ⚠️ ambiguous; numeric id is preferred

  egypt: "egypt, arab rep.",
  venezuela: "venezuela, rb",

  gambia: "gambia, the",
  bahamas: "bahamas, the",

  turkiye: "türkiye",
  turkey: "türkiye",

  "s sudan": "south sudan",
  "cote d'ivoire": "cote d'ivoire",
  "central african rep": "central african republic",
};

function topoNameToDbName(topoNameNorm: string) {
  const mapped = TOPO_TO_DB_NAME[topoNameNorm];
  return mapped ? normName(mapped) : topoNameNorm;
}

/* =======================
   Component
======================= */

export default function StratifyMap({
  rows,
  topoJsonUrl,
  selectedIso3,
  onSelectIso3,
}: Props) {
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);

  // zoom state
  const [mapPos, setMapPos] = useState<{
    coordinates: [number, number];
    zoom: number;
  }>({ coordinates: [0, 0], zoom: 1 });

  /* ---- DB maps ---- */

  const valueByIso = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows || []) {
      const iso = cleanISO3(r.iso3);
      if (isValidISO3(iso) && Number.isFinite(r.value)) m.set(iso, r.value);
    }
    return m;
  }, [rows]);

  const isoByDbCountryName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows || []) {
      const iso = cleanISO3(r.iso3);
      const nm = normName(r.country);
      if (!nm) continue;
      if (isValidISO3(iso) && !m.has(nm)) m.set(nm, iso);
    }
    return m;
  }, [rows]);

  /* ---- Color scale ---- */

  const values = useMemo(() => Array.from(valueByIso.values()), [valueByIso]);

  const quant = useMemo(() => {
    if (!values.length) return null;
    return scaleQuantile<number>()
      .domain(values)
      .range([0.15, 0.3, 0.45, 0.6, 0.75, 0.9]);
  }, [values]);

  /* ---- ISO resolver ---- */

  function resolveIso3(geo: RsmGeo): { iso3: string; topoNameNorm: string } {
    const p = geo.properties ?? {};
    const topoNameNorm = normName(p.name);

    // ✅ 1) BEST: numeric geo.id -> ISO3 (fixes most issues forever)
    const fromNumeric = iso3FromNumericId(geo.id);
    if (isValidISO3(fromNumeric)) return { iso3: fromNumeric, topoNameNorm };

    // 2) If file has ISO3 fields, use them
    const candidate = [
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

    if (candidate && isValidISO3(candidate)) {
      return { iso3: candidate, topoNameNorm };
    }

    // 3) Last resort: topo name -> DB name -> iso
    if (!topoNameNorm) return { iso3: "", topoNameNorm: "" };

    const dbNameNorm = topoNameToDbName(topoNameNorm);
    const iso =
      isoByDbCountryName.get(topoNameNorm) ??
      isoByDbCountryName.get(dbNameNorm) ??
      "";

    return { iso3: iso, topoNameNorm };
  }

  const selected = selectedIso3 ? selectedIso3.toUpperCase() : null;

  /* ---- Zoom handlers ---- */

  function clampZoom(z: number) {
    return Math.max(1, Math.min(8, z));
  }
  function zoomIn() {
    setMapPos((p) => ({ ...p, zoom: clampZoom(p.zoom * 1.35) }));
  }
  function zoomOut() {
    setMapPos((p) => ({ ...p, zoom: clampZoom(p.zoom / 1.35) }));
  }
  function resetZoom() {
    setMapPos({ coordinates: [0, 0], zoom: 1 });
  }

  return (
    <div className="relative rounded-xl border bg-white p-3">
      {/* Zoom controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="h-9 w-9 rounded-lg border bg-white shadow text-sm font-bold"
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="h-9 w-9 rounded-lg border bg-white shadow text-sm font-bold"
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={resetZoom}
          className="h-9 w-9 rounded-lg border bg-white shadow text-[11px] font-bold"
          aria-label="Reset zoom"
          title="Reset"
        >
          ⟳
        </button>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          rotate: [0, 0, 0], // ✅ no rotation
          center: [0, 15], // ✅ lifts the map slightly (prevents "tilt" feeling)
          scale: 155, // tweak 145–175
        }}
        width={980}
        height={460}
      >
        <ZoomableGroup
          center={mapPos.coordinates}
          zoom={mapPos.zoom}
          onMoveEnd={(pos: any) =>
            setMapPos({
              coordinates: pos.coordinates as [number, number],
              zoom: pos.zoom,
            })
          }
        >
          <Geographies geography={topoJsonUrl}>
            {({ geographies }: { geographies: RsmGeo[] }) => (
              <>
                {geographies.map((geo) => {
                  const { iso3, topoNameNorm } = resolveIso3(geo);
                  const value = iso3 ? valueByIso.get(iso3) : undefined;

                  const fill =
                    value !== undefined && quant
                      ? interpolateBlues(quant(value)!)
                      : "#e5e7eb";

                  const isSelected = !!selected && !!iso3 && iso3 === selected;

                  // clickable if we resolved ISO (even if no value)
                  const clickable = !!iso3;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo as unknown as object}
                      onClick={() => {
                        setDebug({
                          topoName: geo.properties?.name ?? null,
                          topoNameNorm: topoNameNorm || null,
                          geoId: geo.id ?? null,
                          resolvedIso3: iso3 || "—",
                          hasValue: value !== undefined,
                          value: value ?? null,
                          rawProps: geo.properties ?? null,
                        });
                        if (iso3) onSelectIso3?.(iso3);
                      }}
                      style={{
                        default: {
                          fill,
                          stroke: "#ffffff",
                          strokeWidth: 0.6,
                          outline: "none",
                          opacity: isSelected ? 1 : 0.96,
                          cursor: clickable ? "pointer" : "default",
                        },
                        hover: {
                          fill: clickable ? "#94a3b8" : fill,
                          opacity: 1,
                          outline: "none",
                        },
                        pressed: { fill, outline: "none" },
                      }}
                    />
                  );
                })}
              </>
            )}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Debug overlay */}
      {debug && (
        <div className="absolute bottom-3 left-3 max-w-[360px] rounded-lg border bg-white/95 p-3 text-xs shadow">
          <div className="mb-1 font-semibold">Map debug</div>
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(debug, null, 2)}
          </pre>
          <button
            className="mt-2 text-xs underline"
            onClick={() => setDebug(null)}
          >
            close
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span>Low</span>
          {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((t) => (
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
