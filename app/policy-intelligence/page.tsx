"use client";

import { useEffect, useMemo, useState } from "react";

type CountryItem = {
  iso3: string;
  country: string;
  region: string;
};

type FilterResponse = {
  ok: boolean;
  error?: string;
  regions: string[];
  countries: CountryItem[];
};

function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="flex min-w-[260px] flex-col items-center rounded-3xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-900" />
        <div className="text-base font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-sm text-slate-500">
          Please wait while data is being fetched
        </div>
      </div>
    </div>
  );
}

function SafeImage({
  src,
  alt,
  className,
  fallback = "/placeholder.png",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const [imgSrc, setImgSrc] = useState(src && src.trim() ? src : fallback);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => setImgSrc(fallback)}
    />
  );
}

async function fetchJsonSafe<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("Non-JSON API response:", text);
    throw new Error("API returned invalid JSON");
  }
}

export default function PolicyIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<CountryItem[]>([]);

  const [region, setRegion] = useState("World");
  const [country, setCountry] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadFilters() {
      setLoading(true);
      setError(null);

      try {
        // IMPORTANT: this must match your actual file:
        // app/api/policy-intelligence/filter/route.ts
        const json = await fetchJsonSafe<FilterResponse>(
          "/api/policy-intelligence/filter",
        );

        if (!alive) return;

        if (!json.ok) {
          throw new Error(json.error || "Failed to load filters");
        }

        const nextRegions = Array.isArray(json.regions) ? json.regions : [];
        const nextCountries = Array.isArray(json.countries)
          ? json.countries
          : [];

        setRegions(nextRegions);
        setCountries(nextCountries);

        if (nextCountries.length > 0) {
          setCountry((prev) => prev || nextCountries[0].iso3);
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Unknown client error");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadFilters();

    return () => {
      alive = false;
    };
  }, []);

  const filteredCountries = useMemo(() => {
    if (region === "World") return countries;
    return countries.filter((c) => c.region === region);
  }, [countries, region]);

  useEffect(() => {
    if (!filteredCountries.find((c) => c.iso3 === country)) {
      setCountry(filteredCountries[0]?.iso3 ?? "");
    }
  }, [filteredCountries, country]);

  if (loading) {
    return <LoadingBlock label="Loading Policy Intelligence..." />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          <div className="text-lg font-semibold">
            Failed to load Policy Intelligence
          </div>
          <div className="mt-2 break-words text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Control Panel
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Policy Intelligence
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose region and country to explore.
              </p>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
                >
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
                >
                  {filteredCountries.map((c) => (
                    <option key={c.iso3} value={c.iso3}>
                      {c.country}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </aside>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Policy Intelligence Dashboard
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Region: {region} {country ? `• Country: ${country}` : ""}
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700">
                  Selected Country
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {filteredCountries.find((c) => c.iso3 === country)?.country ||
                    "—"}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {country || "—"}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700">
                  Preview Image
                </div>
                <SafeImage
                  src="/policy-intelligence-cover.png"
                  alt="Policy Intelligence"
                  className="h-48 w-full rounded-2xl object-cover"
                  fallback="/placeholder.png"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
