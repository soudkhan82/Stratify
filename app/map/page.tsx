import { latestForMany } from "@/lib/data";

import PoiMap from "@/components/PoiMap";
import { METRICS, type MetricKey } from "@/lib/metrics";
import { COUNTRIES } from "@/lib/country-centriods";

export const revalidate = 60 * 60 * 24; // 24h
const TOP_N = 200;

type Props = { searchParams: { metric?: string } };

export default async function MapPage({ searchParams }: Props) {
  const metricKey = (Object.keys(METRICS) as MetricKey[]).includes(
    searchParams.metric as MetricKey
  )
    ? (searchParams.metric as MetricKey)
    : ("CO2_TOTAL_KT" as MetricKey);

  const metric = METRICS[metricKey];
  const isos = COUNTRIES.map((c) => c.iso3);
  const latest = await latestForMany(isos, metric.code);

  const points = latest
    .map((r) => {
      const c = COUNTRIES.find((c) => c.iso3 === r.iso3)!;
      return r.value == null
        ? null
        : { id: c.iso3, name: c.name, lat: c.lat, lon: c.lon, value: r.value };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, TOP_N) as {
    id: string;
    name: string;
    lat: number;
    lon: number;
    value: number;
  }[];

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hotspots — {metric.label}</h1>
        <MetricSelect initialKey={metricKey} />
      </div>
      <PoiMap points={points} />
    </main>
  );
}

function MetricSelect({ initialKey }: { initialKey: MetricKey }) {
  "use client";
  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    const url = new URL(window.location.href);
    url.searchParams.set("metric", key);
    window.location.assign(url.toString());
  };
  return (
    <select
      defaultValue={initialKey}
      onChange={onChange}
      className="border rounded-md p-2 text-sm"
    >
      {(Object.keys(METRICS) as MetricKey[]).map((k) => (
        <option key={k} value={k}>
          {METRICS[k].label}
        </option>
      ))}
    </select>
  );
}
