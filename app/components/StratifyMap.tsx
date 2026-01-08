"use client";

import type React from "react";
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
  id?: unknown; // numeric ISO code in world-atlas topojson
  properties?: GeoProps;
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

/* =======================
   ✅ FULL ISO numeric -> ISO3 mapping
   This is the real “forever fix” for world-atlas topojson.
   Source: ISO 3166-1 numeric ↔ alpha-3 codes (compiled list).
======================= */

const ISO_NUM_TO_A3: Record<string, string> = {
  "004": "AFG",
  "008": "ALB",
  "012": "DZA",
  "016": "ASM",
  "020": "AND",
  "024": "AGO",
  "028": "ATG",
  "031": "AZE",
  "032": "ARG",
  "036": "AUS",
  "040": "AUT",
  "044": "BHS",
  "048": "BHR",
  "050": "BGD",
  "051": "ARM",
  "052": "BRB",
  "056": "BEL",
  "060": "BMU",
  "064": "BTN",
  "068": "BOL",
  "070": "BIH",
  "072": "BWA",
  "076": "BRA",
  "084": "BLZ",
  "086": "IOT",
  "090": "SLB",
  "092": "VGB",
  "096": "BRN",
  "100": "BGR",
  "104": "MMR",
  "108": "BDI",
  "112": "BLR",
  "116": "KHM",
  "120": "CMR",
  "124": "CAN",
  "132": "CPV",
  "136": "CYM",
  "140": "CAF",
  "144": "LKA",
  "148": "TCD",
  "152": "CHL",
  "156": "CHN",
  "158": "TWN",
  "162": "CXR",
  "166": "CCK",
  "170": "COL",
  "174": "COM",
  "175": "MYT",
  "178": "COG",
  "180": "COD",
  "184": "COK",
  "188": "CRI",
  "191": "HRV",
  "192": "CUB",
  "196": "CYP",
  "203": "CZE",
  "204": "BEN",
  "208": "DNK",
  "212": "DMA",
  "214": "DOM",
  "218": "ECU",
  "222": "SLV",
  "226": "GNQ",
  "231": "ETH",
  "232": "ERI",
  "233": "EST",
  "234": "FRO",
  "238": "FLK",
  "239": "SGS",
  "242": "FJI",
  "246": "FIN",
  "250": "FRA",
  "254": "GUF",
  "258": "PYF",
  "260": "ATF",
  "262": "DJI",
  "266": "GAB",
  "268": "GEO",
  "270": "GMB",
  "275": "PSE",
  "276": "DEU",
  "288": "GHA",
  "292": "GIB",
  "296": "KIR",
  "300": "GRC",
  "304": "GRL",
  "308": "GRD",
  "312": "GLP",
  "316": "GUM",
  "320": "GTM",
  "324": "GIN",
  "328": "GUY",
  "332": "HTI",
  "334": "HMD",
  "336": "VAT",
  "340": "HND",
  "344": "HKG",
  "348": "HUN",
  "352": "ISL",
  "356": "IND",
  "360": "IDN",
  "364": "IRN",
  "368": "IRQ",
  "372": "IRL",
  "376": "ISR",
  "380": "ITA",
  "384": "CIV",
  "388": "JAM",
  "392": "JPN",
  "398": "KAZ",
  "400": "JOR",
  "404": "KEN",
  "408": "PRK",
  "410": "KOR",
  "414": "KWT",
  "417": "KGZ",
  "418": "LAO",
  "422": "LBN",
  "426": "LSO",
  "428": "LVA",
  "430": "LBR",
  "434": "LBY",
  "438": "LIE",
  "440": "LTU",
  "442": "LUX",
  "446": "MAC",
  "450": "MDG",
  "454": "MWI",
  "458": "MYS",
  "462": "MDV",
  "466": "MLI",
  "470": "MLT",
  "474": "MTQ",
  "478": "MRT",
  "480": "MUS",
  "484": "MEX",
  "492": "MCO",
  "496": "MNG",
  "498": "MDA",
  "499": "MNE",
  "500": "MSR",
  "504": "MAR",
  "508": "MOZ",
  "512": "OMN",
  "516": "NAM",
  "520": "NRU",
  "524": "NPL",
  "528": "NLD",
  "531": "CUW",
  "533": "ABW",
  "534": "SXM",
  "535": "BES",
  "540": "NCL",
  "548": "VUT",
  "554": "NZL",
  "558": "NIC",
  "562": "NER",
  "566": "NGA",
  "570": "NIU",
  "574": "NFK",
  "578": "NOR",
  "580": "MNP",
  "581": "UMI",
  "583": "FSM",
  "584": "MHL",
  "585": "PLW",
  "586": "PAK",
  "591": "PAN",
  "598": "PNG",
  "600": "PRY",
  "604": "PER",
  "608": "PHL",
  "612": "PCN",
  "616": "POL",
  "620": "PRT",
  "624": "GNB",
  "626": "TLS",
  "630": "PRI",
  "634": "QAT",
  "638": "REU",
  "642": "ROU",
  "643": "RUS",
  "646": "RWA",
  "652": "BLM",
  "654": "SHN",
  "659": "KNA",
  "660": "AIA",
  "662": "LCA",
  "663": "MAF",
  "666": "SPM",
  "670": "VCT",
  "674": "SMR",
  "678": "STP",
  "682": "SAU",
  "686": "SEN",
  "688": "SRB",
  "690": "SYC",
  "694": "SLE",
  "702": "SGP",
  "703": "SVK",
  "704": "VNM",
  "705": "SVN",
  "706": "SOM",
  "710": "ZAF",
  "716": "ZWE",
  "724": "ESP",
  "728": "SSD",
  "729": "SDN",
  "732": "ESH",
  "740": "SUR",
  "744": "SJM",
  "748": "SWZ",
  "752": "SWE",
  "756": "CHE",
  "760": "SYR",
  "762": "TJK",
  "764": "THA",
  "768": "TGO",
  "772": "TKL",
  "776": "TON",
  "780": "TTO",
  "784": "ARE",
  "788": "TUN",
  "792": "TUR",
  "795": "TKM",
  "796": "TCA",
  "798": "TUV",
  "800": "UGA",
  "804": "UKR",
  "807": "MKD",
  "818": "EGY",
  "826": "GBR",
  "831": "GGY",
  "832": "JEY",
  "833": "IMN",
  "834": "TZA",
  "840": "USA",
  "850": "VIR",
  "854": "BFA",
  "858": "URY",
  "860": "UZB",
  "862": "VEN",
  "876": "WLF",
  "882": "WSM",
  "887": "YEM",
  "894": "ZMB",
};

function iso3FromGeo(geo: RsmGeo): string {
  // 1) numeric id from world-atlas
  const rawId = String(geo.id ?? "").trim();
  if (rawId) {
    const id = rawId.padStart(3, "0");
    const hit = ISO_NUM_TO_A3[id];
    if (hit) return hit;
  }

  // 2) if you ever switch to a topo that includes ISO fields
  const p = geo.properties ?? {};
  const cand = [
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

  return cand ?? "";
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
      if (isValidISO3(iso) && Number.isFinite(r.value)) m.set(iso, r.value);
    }
    return m;
  }, [rows]);

  const values = useMemo(() => Array.from(valueByIso.values()), [valueByIso]);

  const quant = useMemo(() => {
    if (!values.length) return null;
    return scaleQuantile<number>()
      .domain(values)
      .range([0.15, 0.3, 0.45, 0.6, 0.75, 0.9]);
  }, [values]);

  return (
    <div className="relative rounded-xl border bg-white p-3">
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
          style={{
            left: tip.x + 12,
            top: Math.max(tip.y - 10, 0),
          }}
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
        projectionConfig={{
          rotate: [0, 0, 0], // no skew / rotation
          center: [0, 15],
          scale: 190,
        }}
        width={1200}
        height={600}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup zoom={zoom}>
          <Geographies geography={topoJsonUrl}>
            {({ geographies }: { geographies: RsmGeo[] }) => (
              <>
                {geographies.map((geo) => {
                  const iso3 = iso3FromGeo(geo);

                  const dbRow = iso3 ? rowByIso.get(iso3) : undefined;
                  const value = iso3 ? valueByIso.get(iso3) : undefined;

                  const fill =
                    value !== undefined && quant
                      ? interpolateBlues(quant(value)!)
                      : "#e5e7eb";

                  const isSelected = !!selected && !!iso3 && iso3 === selected;

                  const geoName = String(geo.properties?.name ?? "").trim();
                  const countryName =
                    dbRow?.country?.trim() || geoName || iso3 || "—";

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo as unknown as object}
                      onClick={() => {
                        if (!iso3) return;
                        onSelectIso3?.(iso3);
                      }}
                      onMouseEnter={(
                        e: React.MouseEvent<SVGPathElement, MouseEvent>
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
                        e: React.MouseEvent<SVGPathElement, MouseEvent>
                      ) => {
                        if (!iso3) return;
                        const { x, y } = getLocalXY(e);
                        setTip((prev) =>
                          prev.show && prev.iso3 === iso3
                            ? { ...prev, x, y }
                            : prev
                        );
                      }}
                      onMouseLeave={() =>
                        setTip((p) => ({ ...p, show: false }))
                      }
                      style={{
                        default: {
                          fill,
                          stroke: "#ffffff",
                          strokeWidth: 0.6,
                          outline: "none",
                          opacity: isSelected ? 1 : 0.96,
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
        </ZoomableGroup>
      </ComposableMap>

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
