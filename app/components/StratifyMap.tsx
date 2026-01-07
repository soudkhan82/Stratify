"use client";

import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
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
  ISO_A3?: unknown;
  ADM0_A3?: unknown;
  iso_a3?: unknown;
};

type RsmGeo = {
  rsmKey: string;
  properties?: GeoProps;
};

/* =======================
   Helpers
======================= */

function normName(v: unknown) {
  // normalize very aggressively for matching
  return String(v ?? "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\./g, "") // remove dots: "S. Sudan" -> "s sudan"
    .replace(/\s+/g, " ")
    .trim();
}

function isValidISO3(v: unknown): v is string {
  return typeof v === "string" && /^[A-Z]{3}$/.test(v);
}

/**
 * TopoJSON country name -> World Bank / DB country name normalization.
 * (This is the direction you need for name-based matching.)
 */
const TOPO_TO_DB_NAME: Record<string, string> = {
  // USA / Russia / Iran etc
  "united states of america": "united states",
  russia: "russian federation",
  iran: "iran, islamic rep.",
  "iran islamic republic of": "iran, islamic rep.",

  // Vietnam / Korea
  vietnam: "viet nam",
  "south korea": "korea, rep.",
  "north korea": "korea, dem. people's rep.",
  "democratic peoples republic of korea": "korea, dem. people's rep.",

  // Congo pair (Topo varies a lot by source)
  "democratic republic of the congo": "congo, dem. rep.",
  "democratic republic of congo": "congo, dem. rep.",
  "congo dem rep": "congo, dem. rep.",
  "congo (kinshasa)": "congo, dem. rep.",
  "congo kinshasa": "congo, dem. rep.",
  "republic of congo": "congo, rep.",
  "congo (brazzaville)": "congo, rep.",
  "congo brazzaville": "congo, rep.",

  // Sudans
  "south sudan": "south sudan",
  "s sudan": "south sudan",

  // Côte d'Ivoire
  "cote divoire": "cote d'ivoire",
  "côte d'ivoire": "cote d'ivoire",

  // Egypt / Venezuela
  egypt: "egypt, arab rep.",
  venezuela: "venezuela, rb",

  // Gambia / Bahamas
  gambia: "gambia, the",
  bahamas: "bahamas, the",

  // Türkiye spelling variants
  turkiye: "türkiye",
  turkey: "türkiye",
};

function applyTopoToDbFix(topoNameNorm: string) {
  // topoNameNorm is already normalized; normalize the mapping output too
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

  /* ---- DB maps ---- */

  const valueByIso = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows || []) {
      const iso = String(r.iso3 ?? "").toUpperCase();
      if (isValidISO3(iso) && Number.isFinite(r.value)) m.set(iso, r.value);
    }
    return m;
  }, [rows]);

  const isoByDbCountryName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows || []) {
      const iso = String(r.iso3 ?? "").toUpperCase();
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

  function resolveIso3(geo: RsmGeo): { iso3: string; topoName: string } {
    const p = geo.properties;
    const topoName = normName(p?.name);

    // 1) If topo has ISO3, use it
    const candidate = String(p?.ISO_A3 ?? p?.ADM0_A3 ?? p?.iso_a3 ?? "")
      .trim()
      .toUpperCase();

    if (isValidISO3(candidate) && candidate !== "ATA" && candidate !== "-99") {
      return { iso3: candidate, topoName };
    }

    // 2) Name-based match: topoName -> DB-name
    if (!topoName) return { iso3: "", topoName: "" };

    const dbName = applyTopoToDbFix(topoName);

    const iso =
      isoByDbCountryName.get(topoName) ?? isoByDbCountryName.get(dbName) ?? "";

    return { iso3: iso, topoName };
  }

  /* ---- Unmatched diagnostics (no DevTools needed) ---- */
  const diag = useMemo(() => {
    // we can’t precompute all geographies without loading the topojson ourselves,
    // so we show live debug per click + a summary counter in the UI via clicks.
    // Still useful: show how many DB values exist.
    return {
      dbValues: valueByIso.size,
      dbCountries: isoByDbCountryName.size,
    };
  }, [valueByIso, isoByDbCountryName]);

  return (
    <div className="relative rounded-xl border bg-white p-3">
      <ComposableMap projection="geoEqualEarth" style={{ width: "100%" }}>
        <Geographies geography={topoJsonUrl}>
          {({ geographies }: { geographies: RsmGeo[] }) => (
            <>
              {geographies.map((geo) => {
                const { iso3, topoName } = resolveIso3(geo);
                const value = iso3 ? valueByIso.get(iso3) : undefined;

                const fill =
                  value !== undefined && quant
                    ? interpolateBlues(quant(value)!)
                    : "#e5e7eb";

                const isSelected =
                  !!selectedIso3 &&
                  !!iso3 &&
                  iso3 === selectedIso3.toUpperCase();

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo as unknown as object}
                    onClick={() => {
                      setDebug({
                        topoName: geo.properties?.name ?? null,
                        topoNameNorm: topoName || null,
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
                        stroke: "#fff",
                        strokeWidth: 0.5,
                        outline: "none",
                        opacity: isSelected ? 1 : 0.95,
                        cursor: iso3 ? "pointer" : "default",
                      },
                      hover: {
                        fill: iso3 ? "#94a3b8" : fill,
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
      </ComposableMap>

      {/* Debug overlay */}
      {debug && (
        <div className="absolute bottom-3 left-3 max-w-[340px] rounded-lg border bg-white/95 p-3 text-xs shadow">
          <div className="font-semibold mb-1">Map debug</div>
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

      {/* Legend + tiny health */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <div>
          DB values:{" "}
          <span className="font-semibold text-slate-700">{diag.dbValues}</span>{" "}
          • DB country names:{" "}
          <span className="font-semibold text-slate-700">
            {diag.dbCountries}
          </span>
        </div>

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
