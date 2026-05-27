"use client";

import { useEffect, useMemo, useState } from "react";
import StratifyMap, { StratifyMapRow } from "@/app/components/StratifyMap";

/* =======================
   Types
======================= */

type MapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

/* =======================
   Config
======================= */

const TOPO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const INDICATOR_LABEL = "Population";
const INDICATOR_UNIT = "";

/* =======================
   Page
======================= */

export default function Page() {
  const [rows, setRows] = useState<MapRow[]>([]);
  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      const res = await fetch("/api/map?indicator=SP.POP.TOTL", {
        cache: "no-store",
      });
      const json = (await res.json()) as { rows: MapRow[] };
      if (alive) setRows(json.rows ?? []);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const mapRows: StratifyMapRow[] = useMemo(
    () =>
      rows.map((r) => ({
        iso3: r.iso3,
        country: r.country,
        region: r.region,
        value: r.value,
      })),
    [rows]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-xl font-semibold mb-3">WDI Population Map</h1>

      <StratifyMap
        rows={mapRows}
        topoJsonUrl={TOPO_URL}
        selectedIso3={selectedIso3}
        onSelectIso3={setSelectedIso3}
        indicatorLabel={INDICATOR_LABEL}
        indicatorUnit={INDICATOR_UNIT}
      />
    </div>
  );
}
