"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Factory,
  Globe2,
  Layers3,
  MapPinned,
  RefreshCw,
  Search,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

import CorporateDirectoryTable from "./_components/CorporateDirectoryTable";
import { fetchCorporateDirectory, fetchCorporateSummary } from "./_lib/api";
import type {
  ChartDatum,
  CorporateDirectorySummary,
  CorporateProfile,
} from "./_lib/types";

type CorporateProfileExtended = CorporateProfile & {
  market_cap?: number | string | null;
  market_value?: number | string | null;
  market_value_usd?: number | string | null;
};

type MapPoint = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  count: number;
};

const US_STATES = new Set([
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
  "district of columbia",
  "dc",
]);

const STATE_NAME_BY_CODE: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

const STATE_CENTROIDS: Record<string, [number, number]> = {
  Alabama: [32.806671, -86.79113],
  Alaska: [61.370716, -152.404419],
  Arizona: [33.729759, -111.431221],
  Arkansas: [34.969704, -92.373123],
  California: [36.116203, -119.681564],
  Colorado: [39.059811, -105.311104],
  Connecticut: [41.597782, -72.755371],
  Delaware: [39.318523, -75.507141],
  Florida: [27.766279, -81.686783],
  Georgia: [33.040619, -83.643074],
  Hawaii: [21.094318, -157.498337],
  Idaho: [44.240459, -114.478828],
  Illinois: [40.349457, -88.986137],
  Indiana: [39.849426, -86.258278],
  Iowa: [42.011539, -93.210526],
  Kansas: [38.5266, -96.726486],
  Kentucky: [37.66814, -84.670067],
  Louisiana: [31.169546, -91.867805],
  Maine: [44.693947, -69.381927],
  Maryland: [39.063946, -76.802101],
  Massachusetts: [42.230171, -71.530106],
  Michigan: [43.326618, -84.536095],
  Minnesota: [45.694454, -93.900192],
  Mississippi: [32.741646, -89.678696],
  Missouri: [38.456085, -92.288368],
  Montana: [46.921925, -110.454353],
  Nebraska: [41.12537, -98.268082],
  Nevada: [38.313515, -117.055374],
  "New Hampshire": [43.452492, -71.563896],
  "New Jersey": [40.298904, -74.521011],
  "New Mexico": [34.840515, -106.248482],
  "New York": [42.165726, -74.948051],
  "North Carolina": [35.630066, -79.806419],
  "North Dakota": [47.528912, -99.784012],
  Ohio: [40.388783, -82.764915],
  Oklahoma: [35.565342, -96.928917],
  Oregon: [44.572021, -122.070938],
  Pennsylvania: [40.590752, -77.209755],
  "Rhode Island": [41.680893, -71.51178],
  "South Carolina": [33.856892, -80.945007],
  "South Dakota": [44.299782, -99.438828],
  Tennessee: [35.747845, -86.692345],
  Texas: [31.054487, -97.563461],
  Utah: [40.150032, -111.862434],
  Vermont: [44.045876, -72.710686],
  Virginia: [37.769337, -78.169968],
  Washington: [47.400902, -121.490494],
  "West Virginia": [38.491226, -80.954453],
  Wisconsin: [44.268543, -89.616508],
  Wyoming: [42.755966, -107.30249],
  "District of Columbia": [38.9072, -77.0369],
};

function safeText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMarketValue(row: CorporateProfile): number | string | null {
  const extended = row as CorporateProfileExtended;

  return (
    extended.market_cap ??
    extended.market_value_usd ??
    extended.market_value ??
    null
  );
}

function formatMarketValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "N/A";

  const num =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^0-9.-]/g, ""));

  if (!Number.isFinite(num)) return String(value);

  if (num >= 1_000_000_000_000) {
    return `$${(num / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  }

  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }

  return `$${num.toLocaleString()}`;
}

function normalizeState(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (STATE_NAME_BY_CODE[upper]) return STATE_NAME_BY_CODE[upper];

  const title = raw
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  if (STATE_CENTROIDS[title]) return title;

  return null;
}

function inferStateFromHeadquarters(headquarters: unknown): string | null {
  const text = String(headquarters ?? "").trim();
  if (!text) return null;

  const parts = text
    .split(/[,\|]/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const state = normalizeState(part);
    if (state) return state;
  }

  for (const [code, name] of Object.entries(STATE_NAME_BY_CODE)) {
    const regex = new RegExp(`\\b${code}\\b|\\b${name}\\b`, "i");
    if (regex.test(text)) return name;
  }

  return null;
}

function getCompanyState(row: CorporateProfile): string | null {
  return (
    normalizeState(row.state) ??
    inferStateFromHeadquarters(row.headquarters) ??
    null
  );
}

function normalizeCountry(row: CorporateProfile): string {
  const raw = String(row.country ?? "").trim();
  const rawLower = raw.toLowerCase();

  const state = getCompanyState(row);

  if (state) return "United States";
  if (rawLower && US_STATES.has(rawLower)) return "United States";

  if (
    [
      "us",
      "u.s.",
      "usa",
      "u.s.a.",
      "united states",
      "united states of america",
    ].includes(rawLower)
  ) {
    return "United States";
  }

  if (
    [
      "uk",
      "u.k.",
      "united kingdom",
      "great britain",
      "england",
      "scotland",
      "wales",
      "northern ireland",
    ].includes(rawLower)
  ) {
    return "United Kingdom";
  }

  if (rawLower === "ireland") return "Ireland";
  if (rawLower === "switzerland") return "Switzerland";
  if (rawLower === "netherlands") return "Netherlands";
  if (rawLower === "canada") return "Canada";
  if (rawLower === "bermuda") return "Bermuda";
  if (rawLower === "cayman islands") return "Cayman Islands";
  if (rawLower === "curacao") return "Curaçao";
  if (rawLower === "israel") return "Israel";

  return raw || "United States";
}

function uniqueCount(
  rows: CorporateProfile[],
  getValue: (row: CorporateProfile) => unknown,
) {
  return new Set(
    rows
      .map(getValue)
      .filter((value) => value !== null && value !== undefined && value !== ""),
  ).size;
}

function countBy(
  rows: CorporateProfile[],
  getValue: (row: CorporateProfile) => unknown,
  limit = 10,
): ChartDatum[] {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const raw = getValue(row);
    const name = raw ? String(raw) : "Unknown";
    map.set(name, (map.get(name) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function fallbackSummary(rows: CorporateProfile[]): CorporateDirectorySummary {
  return {
    total_companies: rows.length,
    sectors: uniqueCount(rows, (row) => row.sector),
    industries: uniqueCount(rows, (row) => row.industry),
    countries: uniqueCount(rows, (row) => normalizeCountry(row)),
    enriched_profiles: rows.filter(
      (row) =>
        row.headquarters ||
        row.city ||
        row.state ||
        row.cik ||
        row.founded ||
        row.website,
    ).length,
  };
}

function normalizeSummary(
  apiSummary: CorporateDirectorySummary | null,
  rows: CorporateProfile[],
): CorporateDirectorySummary {
  const fallback = fallbackSummary(rows);

  return {
    total_companies:
      toNumber(apiSummary?.total_companies) > 0
        ? toNumber(apiSummary?.total_companies)
        : fallback.total_companies,
    sectors:
      toNumber(apiSummary?.sectors) > 0
        ? toNumber(apiSummary?.sectors)
        : fallback.sectors,
    industries:
      toNumber(apiSummary?.industries) > 0
        ? toNumber(apiSummary?.industries)
        : fallback.industries,
    countries: fallback.countries,
    enriched_profiles:
      toNumber(apiSummary?.enriched_profiles) > 0
        ? toNumber(apiSummary?.enriched_profiles)
        : fallback.enriched_profiles,
  };
}

function buildStateMapPoints(rows: CorporateProfile[]): MapPoint[] {
  const grouped = new Map<string, number>();

  rows.forEach((row) => {
    const state = getCompanyState(row) ?? "United States";
    grouped.set(state, (grouped.get(state) ?? 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(([state, count]) => {
      const coords = STATE_CENTROIDS[state] ?? [39.8283, -98.5795];

      return {
        key: state,
        label: state,
        lat: coords[0],
        lng: coords[1],
        count,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function StatCard({
  title,
  value,
  icon,
  helper,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {helper ? (
            <p className="mt-1 text-xs text-slate-500">{helper}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function BarListCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: ChartDatum[];
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {data.map((item) => {
          const width = Math.max(8, (item.value / maxValue) * 100);

          return (
            <div
              key={item.name}
              className="grid grid-cols-[180px_1fr_42px] items-center gap-3"
            >
              <div className="text-xs font-medium leading-snug text-slate-700">
                {item.name}
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600"
                  style={{ width: `${width}%` }}
                />
              </div>

              <div className="text-right text-xs font-semibold text-slate-700">
                {item.value}
              </div>
            </div>
          );
        })}

        {data.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No data available.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UsaLeafletMap({ points }: { points: MapPoint[] }) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let map: any = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadMap() {
      if (!mapRef.current) return;

      const L = await import("leaflet");

      if (cancelled || !mapRef.current) return;

      mapRef.current.innerHTML = "";

      map = L.map(mapRef.current, {
        center: [39.8283, -98.5795],
        zoom: 4,
        minZoom: 3,
        maxZoom: 8,
        scrollWheelZoom: false,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      points.forEach((point) => {
        const radius = Math.max(8, Math.min(28, Math.sqrt(point.count) * 2.4));

        L.circleMarker([point.lat, point.lng], {
          radius,
          color: "#312e81",
          fillColor: "#4f46e5",
          fillOpacity: 0.72,
          weight: 1,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${point.label}</strong><br/>${point.count} companies`,
          );
      });

      const fitMap = () => {
        if (cancelled || !map) return;

        map.invalidateSize();

        if (points.length > 0) {
          const bounds = L.latLngBounds(
            points.map((point) => [point.lat, point.lng]),
          );
          map.fitBounds(bounds, {
            padding: [32, 32],
            maxZoom: 5,
          });
        }
      };

      setTimeout(fitMap, 150);
      setTimeout(fitMap, 450);
      setTimeout(fitMap, 900);

      if (mapRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(fitMap, 120);
        });

        resizeObserver.observe(mapRef.current);
      }
    }

    loadMap();

    return () => {
      cancelled = true;

      if (resizeTimer) clearTimeout(resizeTimer);

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      if (map) {
        map.remove();
        map = null;
      }
    };
  }, [points]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            USA Company Map
          </h2>
          <p className="text-xs text-slate-500">
            State-level distribution based on company headquarters.
          </p>
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {points.length} locations
        </div>
      </div>

      <div className="relative h-[460px] w-full overflow-hidden bg-slate-100">
        <div ref={mapRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
const DynamicUsaLeafletMap = dynamic(() => Promise.resolve(UsaLeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
      Loading USA map...
    </div>
  ),
});

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">
        {safeText(value)}
      </p>
    </div>
  );
}

function DetailModal({
  company,
  onClose,
}: {
  company: CorporateProfile | null;
  onClose: () => void;
}) {
  if (!company) return null;

  const normalizedCountry = normalizeCountry(company);
  const state = getCompanyState(company);
  const locationParts = [company.city, state, normalizedCountry].filter(
    Boolean,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {safeText(company.symbol)}
            </div>
            <h2 className="text-lg font-semibold text-slate-950">
              {safeText(company.company_name)}
            </h2>
            <p className="text-sm text-slate-500">
              {safeText(company.sector)} · {safeText(company.industry)}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close company detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Info label="Ticker" value={company.symbol} />
          <Info label="Exchange" value={company.exchange} />
          <Info label="Sector" value={company.sector} />
          <Info label="Industry" value={company.industry} />
          <Info label="Country / Location" value={locationParts.join(", ")} />
          <Info label="Headquarters" value={company.headquarters} />
          <Info label="Founded" value={company.founded} />
          <Info label="CIK" value={company.cik} />
          <Info
            label="Market Value"
            value={formatMarketValue(getMarketValue(company))}
          />
          <Info label="Source" value={company.source} />
        </div>

        {company.website || company.business_summary ? (
          <div className="border-t border-slate-100 px-5 py-4">
            {company.website ? (
              <a
                href={String(company.website)}
                target="_blank"
                rel="noreferrer"
                className="mb-3 inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900"
              >
                Visit website
              </a>
            ) : null}

            {company.business_summary ? (
              <p className="text-sm leading-6 text-slate-600">
                {company.business_summary}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CorporateIntelligencePage() {
  const [rows, setRows] = useState<CorporateProfile[]>([]);
  const [summary, setSummary] = useState<CorporateDirectorySummary | null>(
    null,
  );
  const [selectedCompany, setSelectedCompany] =
    useState<CorporateProfile | null>(null);

  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [refreshingProfiles, setRefreshingProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setError(null);
      setLoading(true);

      const [directoryRows, summaryData] = await Promise.all([
        fetchCorporateDirectory(),
        fetchCorporateSummary(),
      ]);

      setRows(Array.isArray(directoryRows) ? directoryRows : []);
      setSummary(summaryData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load corporate intelligence data",
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfiles() {
    try {
      setRefreshingProfiles(true);

      const res = await fetch("/api/corporate-intelligence/profiles/refresh", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Profile refresh failed");
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh corporate profiles",
      );
    } finally {
      setRefreshingProfiles(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        country: normalizeCountry(row),
        state: getCompanyState(row) ?? row.state,
      })),
    [rows],
  );

  const computedSummary = useMemo(
    () => normalizeSummary(summary, normalizedRows),
    [summary, normalizedRows],
  );

  const sectors = useMemo(
    () =>
      [
        "All",
        ...Array.from(
          new Set(normalizedRows.map((row) => row.sector).filter(Boolean)),
        ).sort(),
      ] as string[],
    [normalizedRows],
  );

  const states = useMemo(
    () =>
      [
        "All",
        ...Array.from(
          new Set(
            normalizedRows.map((row) => getCompanyState(row)).filter(Boolean),
          ),
        ).sort(),
      ] as string[],
    [normalizedRows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return normalizedRows.filter((row) => {
      const marketValue = getMarketValue(row);
      const companyState = getCompanyState(row);

      const matchesSearch =
        !q ||
        [
          row.symbol,
          row.company_name,
          row.sector,
          row.industry,
          row.country,
          row.city,
          companyState,
          row.headquarters,
          row.exchange,
          marketValue,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      const matchesSector = sector === "All" || row.sector === sector;
      const matchesState =
        stateFilter === "All" || companyState === stateFilter;

      return matchesSearch && matchesSector && matchesState;
    });
  }, [normalizedRows, search, sector, stateFilter]);

  const sectorChart = useMemo(
    () => countBy(normalizedRows, (row) => row.sector, 10),
    [normalizedRows],
  );

  const stateChart = useMemo(
    () =>
      countBy(normalizedRows, (row) => getCompanyState(row) ?? "Unknown", 10),
    [normalizedRows],
  );

  const industryChart = useMemo(
    () => countBy(normalizedRows, (row) => row.industry, 10),
    [normalizedRows],
  );

  const mapPoints = useMemo(
    () => buildStateMapPoints(normalizedRows),
    [normalizedRows],
  );

  const marketValueCoverage = useMemo(
    () =>
      normalizedRows.filter((row) => {
        const value = getMarketValue(row);
        return value !== null && value !== undefined && value !== "";
      }).length,
    [normalizedRows],
  );

  const totalMarketValue = useMemo(
    () =>
      normalizedRows.reduce((sum, row) => {
        const value = getMarketValue(row);
        return sum + toNumber(value);
      }, 0),
    [normalizedRows],
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <Sparkles size={14} />
                Corporate Intelligence
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Corporate Directory
              </h1>

              <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
                S&amp;P 500 corporate directory with USA headquarters map,
                sector breakdown, industry concentration and market value
                support.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Reload
              </button>

              <button
                onClick={refreshProfiles}
                disabled={refreshingProfiles}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={refreshingProfiles ? "animate-spin" : ""}
                />
                Refresh Profiles
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            title="Total Companies"
            value={computedSummary.total_companies}
            helper="Imported companies"
            icon={<Building2 size={20} />}
          />

          <StatCard
            title="Sectors"
            value={computedSummary.sectors}
            helper="Unique sectors"
            icon={<Layers3 size={20} />}
          />

          <StatCard
            title="Industries"
            value={computedSummary.industries}
            helper="Unique industries"
            icon={<Factory size={20} />}
          />

          <StatCard
            title="States"
            value={states.length > 0 ? states.length - 1 : 0}
            helper="Detected HQ states"
            icon={<Globe2 size={20} />}
          />

          <StatCard
            title="Enriched Profiles"
            value={computedSummary.enriched_profiles}
            helper="Populated profile rows"
            icon={<Sparkles size={20} />}
          />

          <StatCard
            title="Market Cap"
            value={
              marketValueCoverage > 0
                ? formatMarketValue(totalMarketValue)
                : "N/A"
            }
            helper={
              marketValueCoverage > 0
                ? `${marketValueCoverage} profiles covered`
                : "Backend field missing"
            }
            icon={<Wallet size={20} />}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <BarListCard
            title="Companies by Sector"
            subtitle="Top sectors by company count"
            data={sectorChart}
          />

          <BarListCard
            title="Companies by State"
            subtitle="USA headquarters distribution"
            data={stateChart}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <DynamicUsaLeafletMap points={mapPoints} />

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Map Summary
                </h2>
                <p className="text-xs text-slate-500">
                  USA headquarters concentration
                </p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700">
                <MapPinned size={18} />
              </div>
            </div>

            <div className="space-y-2">
              {mapPoints.slice(0, 8).map((point) => (
                <div
                  key={point.key}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {point.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-950">
                    {point.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-1">
          <BarListCard
            title="Top Industries"
            subtitle="Largest industries in directory"
            data={industryChart}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticker, company, sector, industry, state, headquarters..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <select
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
            >
              {sectors.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All sectors" : item}
                </option>
              ))}
            </select>

            <select
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
            >
              {states.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All states" : item}
                </option>
              ))}
            </select>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="rounded-2xl bg-slate-900 px-7 py-6 text-center shadow-xl">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <p className="text-sm font-semibold text-white">
                Loading directory...
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Fetching corporate profiles
              </p>
            </div>
          </div>
        ) : (
          <CorporateDirectoryTable
            rows={filteredRows}
            onSelect={setSelectedCompany}
          />
        )}
      </div>

      <DetailModal
        company={selectedCompany}
        onClose={() => setSelectedCompany(null)}
      />
    </main>
  );
}
