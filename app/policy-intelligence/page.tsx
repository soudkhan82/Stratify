"use client";

import { useEffect, useMemo, useState } from "react";
import PolicyHeader from "./_components/PolicyHeader";
import PolicyFilters from "./_components/PolicyFilters";
import PolicySectorTabs from "./_components/PolicySectorTabs";
import PolicyKpiGrid from "./_components/PolicyKpiGrid";
import PolicyMapboxCard from "./_components/PolicyMapboxCard";
import PolicySnapshotCard from "./_components/PolicySnapshotCard";
import PolicyProgramsTable from "./_components/PolicyProgramsTable";
import PolicyEvidenceTable from "./_components/PolicyEvidenceTable";
import SectorIntro from "./_components/SectorIntro";
import { POLICY_SECTORS } from "./_lib/sector-config";

type FilterCountry = {
  iso3: string;
  country: string;
  region: string;
};

type RegionCount = {
  region: string;
  count: number;
};

type FiltersResponse = {
  ok?: boolean;
  regions: string[];
  countries: FilterCountry[];
  error?: string;
  debug?: {
    totalRows?: number;
    validCountries?: number;
    countsByRegion?: RegionCount[];
    sample?: FilterCountry[];
  };
};

export default function Page() {
  const [sector, setSector] = useState(POLICY_SECTORS[0]?.key ?? "health");

  const [region, setRegion] = useState("World");
  const [country, setCountry] = useState("");
  const [countryIso3, setCountryIso3] = useState("");
  const [yearRange, setYearRange] = useState("2000 - 2024");
  const [evidenceFilter, setEvidenceFilter] = useState("All evidence");

  const [regionOptions, setRegionOptions] = useState<string[]>(["World"]);
  const [allCountries, setAllCountries] = useState<FilterCountry[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [filtersDebug, setFiltersDebug] = useState<FiltersResponse["debug"]>();

  const activeSector = useMemo(() => {
    return (
      POLICY_SECTORS.find((item) => item.key === sector) ?? POLICY_SECTORS[0]
    );
  }, [sector]);

  useEffect(() => {
    let alive = true;

    async function loadFilters() {
      setLoadingFilters(true);
      setFiltersError(null);

      try {
        const res = await fetch("/api/policy-intelligence/filters", {
          cache: "no-store",
        });

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            "Filters API is not returning JSON. Check /api/policy-intelligence/filters.",
          );
        }

        const json = (await res.json()) as FiltersResponse;

        if (!res.ok || json.ok === false) {
          throw new Error(json.error ?? "Failed to load filters");
        }

        if (!alive) return;

        const safeRegions = Array.isArray(json.regions)
          ? json.regions.filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0,
            )
          : ["World"];

        const safeCountries = Array.isArray(json.countries)
          ? json.countries.filter(
              (item): item is FilterCountry =>
                !!item &&
                typeof item.iso3 === "string" &&
                item.iso3.trim().length > 0 &&
                typeof item.country === "string" &&
                item.country.trim().length > 0 &&
                typeof item.region === "string" &&
                item.region.trim().length > 0,
            )
          : [];

        setRegionOptions(safeRegions.length ? safeRegions : ["World"]);
        setAllCountries(safeCountries);
        setFiltersDebug(json.debug);

        const pakistan =
          safeCountries.find((item) => item.iso3 === "PAK") ?? safeCountries[0];

        if (pakistan) {
          setRegion(pakistan.region);
          setCountry(pakistan.country);
          setCountryIso3(pakistan.iso3);
        } else {
          setRegion("World");
          setCountry("");
          setCountryIso3("");
        }

        console.log("[policy filters] loaded", {
          regionCount: safeRegions.length,
          countryCount: safeCountries.length,
          debug: json.debug,
        });
      } catch (error) {
        if (!alive) return;

        const message =
          error instanceof Error ? error.message : "Failed to load filters";

        setFiltersError(message);
        setRegionOptions(["World"]);
        setAllCountries([]);
        setRegion("World");
        setCountry("");
        setCountryIso3("");
        setFiltersDebug(undefined);

        console.error("[policy filters] failed", message);
      } finally {
        if (alive) setLoadingFilters(false);
      }
    }

    loadFilters();

    return () => {
      alive = false;
    };
  }, []);

  const filteredCountries = useMemo(() => {
    if (region === "World") return allCountries;
    return allCountries.filter((item) => item.region === region);
  }, [region, allCountries]);

  const countryOptions = useMemo(() => {
    return Array.from(
      new Set(
        filteredCountries
          .map((item) => item.country)
          .filter((item) => typeof item === "string" && item.trim().length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [filteredCountries]);

  useEffect(() => {
    if (!filteredCountries.length) {
      setCountry("");
      setCountryIso3("");
      return;
    }

    const exists = filteredCountries.some((item) => item.country === country);

    if (!exists) {
      const fallback = filteredCountries[0];
      setCountry(fallback.country);
      setCountryIso3(fallback.iso3);
    }
  }, [region, filteredCountries, country]);

  useEffect(() => {
    if (!country) {
      setCountryIso3("");
      return;
    }

    const found = allCountries.find((item) => item.country === country);
    if (found) {
      setCountryIso3(found.iso3);
    }
  }, [country, allCountries]);

  const kpis = useMemo(
    () => [
      {
        title: "Tracked programs",
        value: "24",
        subtitle: "Across active policy intelligence registry",
      },
      {
        title: "Indicators mapped",
        value: "18",
        subtitle: `Aligned to ${activeSector.label.toLowerCase()} sector`,
      },
      {
        title: "Impact coverage",
        value: "Quant + Qual",
        subtitle: "Economic and social outcome lens",
      },
      {
        title: "Active country",
        value: country || "—",
        subtitle: "Default workspace context",
      },
    ],
    [activeSector.label, country],
  );

  const filteredPreview = filteredCountries.slice(0, 25);

  return (
    <div className="app-shell px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <PolicyHeader
          eyebrow="WorldStats360 • Stratify"
          title="Policy Intelligence"
          description="Explore sector-focused government programs, strategic priorities, and measurable economic and social impact."
        />

        <PolicyFilters
          region={region}
          onRegionChange={setRegion}
          yearRange={yearRange}
          onYearRangeChange={setYearRange}
          country={country}
          onCountryChange={setCountry}
          countryOptions={countryOptions}
          evidenceFilter={evidenceFilter}
          onEvidenceFilterChange={setEvidenceFilter}
          regionOptions={regionOptions}
        />

        {filtersError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">Filters diagnostic failed</div>
            <div className="mt-1">{filtersError}</div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="font-semibold text-slate-800">Filters diagnostic</div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div>Loading: {loadingFilters ? "Yes" : "No"}</div>
            <div>Regions loaded: {regionOptions.length}</div>
            <div>Countries loaded: {allCountries.length}</div>
            <div>Filtered countries: {countryOptions.length}</div>
            <div>Selected region: {region || "—"}</div>
            <div>Selected country: {country || "—"}</div>
            <div>Selected ISO3: {countryIso3 || "—"}</div>
            <div>
              API debug:{" "}
              {filtersDebug
                ? `${filtersDebug.validCountries ?? 0} valid / ${filtersDebug.totalRows ?? 0} rows`
                : "—"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Region counts
              </div>
              <div className="mt-2 max-h-44 overflow-y-auto space-y-1 text-sm">
                {filtersDebug?.countsByRegion?.length ? (
                  filtersDebug.countsByRegion.map((item) => (
                    <div
                      key={item.region}
                      className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1"
                    >
                      <span>{item.region}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400">
                    No region counts available.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Filtered country preview
              </div>
              <div className="mt-2 max-h-44 overflow-y-auto space-y-1 text-sm">
                {filteredPreview.length ? (
                  filteredPreview.map((item) => (
                    <div
                      key={`${item.iso3}-${item.country}`}
                      className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1"
                    >
                      <span>{item.country}</span>
                      <span className="text-slate-500">{item.iso3}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400">
                    No countries in this region.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <PolicySectorTabs
          value={sector}
          onChange={setSector}
          sectors={POLICY_SECTORS}
        />

        <PolicyKpiGrid items={kpis} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <SectorIntro
              title={activeSector.label}
              description={activeSector.description}
              shortIntro={activeSector.shortIntro}
              accentClass="text-[#0b8a4b]"
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PolicyMapboxCard
                country={country || "No country"}
                iso3={countryIso3 || "PAK"}
                region={region}
              />

              <PolicySnapshotCard
                sector={activeSector.label}
                focus={activeSector.shortIntro}
                country={country || "—"}
                status={
                  loadingFilters
                    ? "Loading workspace filters..."
                    : filtersError
                      ? "Filter loading failed."
                      : "Filters now come from country_dim_clean and stay synchronized."
                }
              />
            </div>

            <PolicyProgramsTable
              sector={activeSector.label}
              country={country || "—"}
              rows={[]}
            />

            <PolicyEvidenceTable sector={activeSector.label} rows={[]} />
          </div>

          <div className="space-y-6 xl:col-span-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Workspace summary
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Region and country now come from the same source table and stay
                synchronized.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
