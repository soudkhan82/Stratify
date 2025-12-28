"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleQuantile } from "d3-scale";
import { interpolateBlues as d3Blues } from "d3-scale-chromatic";
import { fetchWdiSelectedRank, type WdiSelectedRank } from "@/app/lib/rpc/wdiCountryRanking";

type MapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

type RsmGeo = {
  rsmKey: string;
  id?: string | number;
  properties?: Record<string, unknown>;
};

function normName(s: unknown) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'")
    .trim();
}

const NAME_FIX: Record<string, string> = {
  "united states": "united states of america",
  russia: "russian federation",
  iran: "iran, islamic rep.",
  venezuela: "venezuela, rb",
  tanzania: "tanzania, united rep.",
  syria: "syrian arab republic",
  laos: "lao pdr",
  "south korea": "korea, rep.",
  "north korea": "korea, dem. people's rep.",
  czechia: "czech republic",
};

export default function StratifyMap({
  indicator,
  region,
  selectedIso3,
  onSelectIso3,
}: {
  indicator: string;
  region: string | null;
  selectedIso3: string | null;
  onSelectIso3: (iso3: string | null) => void;
}) {
  const [data, setData] = useState<MapRow[]>([]);
  const [loading, setLoading] = useState(true);

  // zoom + pan
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState<{ coordinates: [number, number] }>({
    coordinates: [0, 0],
  });

  // selected rank
  const [rankLoading, setRankLoading] = useState(false);
  const [rankErr, setRankErr] = useState<string | null>(null);
  const [rankInfo, setRankInfo] = useState<WdiSelectedRank | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const params = new URLSearchParams({ indicator });
      if (region) params.set("region", region);

      try {
        const res = await fetch(`/api/map?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          setData([]);
          return;
        }
        const json = await res.json();
        setData(Array.isArray(json.data) ? json.data : []);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [indicator, region]);

  // Fetch rank for selected country (single integer)
  useEffect(() => {
    let alive = true;

    async function runRank() {
      setRankErr(null);
      setRankInfo(null);

      if (!selectedIso3) return;

      setRankLoading(true);
      try {
        const r = await fetchWdiSelectedRank(indicator, selectedIso3, region);
        if (!alive) return;
        setRankInfo(r);
      } catch (e: any) {
        if (!alive) return;
        setRankErr(e?.message ?? "Failed to load rank");
      } finally {
        if (alive) setRankLoading(false);
      }
    }

    runRank();
    return () => {
      alive = false;
    };
  }, [indicator, selectedIso3, region]);

  const valueByIso = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data) {
      if (r?.iso3 && typeof r.value === "number") {
        m.set(String(r.iso3).toUpperCase(), r.value);
      }
    }
    return m;
  }, [data]);

  const isoByCountryName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data) {
      const key = normName(r.country);
      if (key && r.iso3) m.set(key, String(r.iso3).toUpperCase());
    }
    return m;
  }, [data]);

  const values = useMemo(
    () => data.map((d) => d.value).filter((v) => Number.isFinite(v)),
    [data]
  );

  const colorScale = useMemo(() => {
    return scaleQuantile<number, string>()
      .domain(values.length ? values : [0, 1])
      .range(Array.from({ length: 9 }, (_, i) => d3Blues((i + 1) / 10)));
  }, [values]);

  const geoUrl = "/maps/countries.geojson";

  const zoomIn = () => setZoom((z) => Math.min(6, Number((z + 0.25).toFixed(2))));
  const zoomOut = () => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))));
  const resetView = () => {
    setZoom(1);
    setPosition({ coordinates: [0, 0] });
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="text-sm font-medium">World Map</div>
        <div className="text-xs text-slate-500">
          {loading ? "Loading…" : `${data.length} countries`}
        </div>
      </div>

      <div className="p-2 md:p-3">
        <div className="relative w-full h-[380px] md:h-[420px] lg:h-[460px]">
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
            <button
              type="button"
              className="h-9 w-9 rounded-md border bg-white text-sm font-semibold shadow-sm hover:bg-slate-50"
              onClick={zoomIn}
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="h-9 w-9 rounded-md border bg-white text-sm font-semibold shadow-sm hover:bg-slate-50"
              onClick={zoomOut}
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="h-9 px-2 rounded-md border bg-white text-[11px] shadow-sm hover:bg-slate-50"
              onClick={resetView}
              aria-label="Reset view"
              title="Reset"
            >
              Reset
            </button>
          </div>

          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 150, center: [0, 10] }}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup
              zoom={zoom}
              center={position.coordinates}
              onMoveEnd={(p: { coordinates: [number, number]; zoom: number }) => {
                setZoom(p.zoom);
                setPosition({ coordinates: p.coordinates });
              }}
              minZoom={1}
              maxZoom={6}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }: { geographies: RsmGeo[] }) =>
                  geographies.map((geo) => {
                    const props: any = geo?.properties ?? {};
                    const iso3 =
                      props.ISO_A3 ||
                      props["ISO3166-1-Alpha-3"] ||
                      props["iso_a3"] ||
                      null;

                    const mapNameRaw = props.name ?? props.ADMIN ?? "";
                    const mapName = normName(mapNameRaw);
                    const fixedName = NAME_FIX[mapName] ? normName(NAME_FIX[mapName]) : mapName;

                    const isoFromName = isoByCountryName.get(fixedName) ?? null;
                    const isoFinal = (iso3 && iso3 !== "-99" ? String(iso3) : isoFromName)?.toUpperCase() ?? null;

                    const v = isoFinal ? valueByIso.get(isoFinal) : null;
                    const fill = typeof v === "number" ? colorScale(v) : "#F8FAFC"; // light fallback
                    const isSelected = !!selectedIso3 && isoFinal === selectedIso3;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#CBD5E1"
                        strokeWidth={0.6}
                        style={{
                          default: { outline: "none" as const },
                          hover: { outline: "none" as const, fill: "#93C5FD" },
                          pressed: { outline: "none" as const, fill: "#60A5FA" },
                        }}
                        onClick={() => {
                          if (!isoFinal) return;
                          onSelectIso3(isoFinal);
                        }}
                        opacity={isSelected ? 1 : 1}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        <div className="mt-2 text-xs text-slate-500">
          Metric: <span className="font-medium text-slate-700">{indicator}</span>
          {region ? (
            <>
              {" "}
              • Region: <span className="font-medium text-slate-700">{region}</span>
            </>
          ) : null}
          {selectedIso3 ? (
            <>
              {" "}
              • Selected: <span className="font-medium text-slate-700">{selectedIso3}</span>
            </>
          ) : null}
          <span className="ml-2 text-slate-400">(Tip: scroll/drag to pan)</span>
        </div>

        {/* ✅ Single rank line (not a table) */}
        <div className="mt-2 text-sm">
          {!selectedIso3 ? (
            <div className="text-slate-500">Select a country to see its rank for this indicator.</div>
          ) : rankLoading ? (
            <div className="text-slate-500">Loading rank…</div>
          ) : rankErr ? (
            <div className="text-red-600">{rankErr}</div>
          ) : rankInfo ? (
            <div className="text-slate-700">
              Rank:{" "}
              <span className="font-semibold text-slate-900">
                #{rankInfo.rank}
              </span>{" "}
              <span className="text-slate-500">
                / {rankInfo.total_in_scope}
                {rankInfo.year ? ` • ${rankInfo.year}` : ""}
              </span>
            </div>
          ) : (
            <div className="text-slate-500">Rank not available for this scope.</div>
          )}
        </div>
      </div>
    </div>
  );
}
