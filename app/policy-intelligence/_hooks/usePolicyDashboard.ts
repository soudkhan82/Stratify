"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CifResponse,
  CountryOption,
  FiltersResponse,
  PolicyFiltersState,
  PolicyKpis,
  PolicyProgram,
  SummaryResponse,
} from "../_types/policy";

const DEFAULT_FILTERS: PolicyFiltersState = {
  region: "All",
  country: "All",
  sector: "All",
  kind: "All",
  search: "",
};

function normalizeCountries(
  payload?: FiltersResponse["countries"],
): CountryOption[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      if ("iso3" in item) {
        return {
          iso3: String(item.iso3 || "")
            .trim()
            .toUpperCase(),
          country: String(item.country || "").trim(),
          region: String(item.region || "").trim(),
        };
      }

      return {
        iso3: String(item.country_code || "")
          .trim()
          .toUpperCase(),
        country: String(item.country_name || "").trim(),
        region: String(item.region || "").trim(),
      };
    })
    .filter((item) => item.iso3 && item.country && item.region);
}

export function usePolicyDashboard() {
  const [filters, setFilters] = useState<PolicyFiltersState>(DEFAULT_FILTERS);

  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [programs, setPrograms] = useState<PolicyProgram[]>([]);
  const [allProgramsMeta, setAllProgramsMeta] = useState<PolicyProgram[]>([]);
  const [summarySource, setSummarySource] = useState<string>("");
  const [selectedProgramKey, setSelectedProgramKey] = useState<string>("");
  const [cif, setCif] = useState<CifResponse | null>(null);

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCif, setLoadingCif] = useState(false);

  const [filtersError, setFiltersError] = useState<string>("");
  const [summaryError, setSummaryError] = useState<string>("");
  const [cifError, setCifError] = useState<string>("");

  const [kpis, setKpis] = useState<PolicyKpis>({
    programs: 0,
    evidence_rows: 0,
    indicator_links: 0,
    country_examples: 0,
  });

  useEffect(() => {
    let active = true;

    async function loadFilters() {
      try {
        setLoadingFilters(true);
        setFiltersError("");

        const res = await fetch("/api/policy-intelligence/filters", {
          cache: "no-store",
        });
        const json: FiltersResponse = await res.json();

        if (!active) return;

        if (!res.ok) {
          setFiltersError(json.error || "Failed to load filters");
          setRegions([]);
          setCountries([]);
          return;
        }

        const normalizedCountries = normalizeCountries(json.countries);
        const normalizedRegions =
          Array.isArray(json.regions) && json.regions.length > 0
            ? ["All", ...json.regions.filter((r) => r && r !== "All")]
            : [
                "All",
                ...Array.from(
                  new Set(normalizedCountries.map((c) => c.region)),
                ).sort(),
              ];

        setRegions(Array.from(new Set(normalizedRegions)));
        setCountries(normalizedCountries);
      } catch (error) {
        if (!active) return;
        setFiltersError(
          error instanceof Error ? error.message : "Failed to load filters",
        );
      } finally {
        if (active) setLoadingFilters(false);
      }
    }

    async function loadAllProgramsMeta() {
      try {
        const res = await fetch(
          "/api/policy-intelligence/summary?region=All&country=All&sector=All&kind=All&search=",
          { cache: "no-store" },
        );
        const json: SummaryResponse = await res.json();

        if (!active) return;
        if (!res.ok) return;

        setAllProgramsMeta(Array.isArray(json.programs) ? json.programs : []);
      } catch {
        if (!active) return;
        setAllProgramsMeta([]);
      }
    }

    loadFilters();
    loadAllProgramsMeta();

    return () => {
      active = false;
    };
  }, []);

  const availableCountries = useMemo(() => {
    if (filters.region === "All") return countries;
    return countries.filter((c) => c.region === filters.region);
  }, [countries, filters.region]);

  useEffect(() => {
    if (filters.country === "All") return;

    const exists = availableCountries.some((c) => c.iso3 === filters.country);
    if (!exists) {
      setFilters((prev) => ({ ...prev, country: "All" }));
    }
  }, [availableCountries, filters.country]);

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        setLoadingSummary(true);
        setSummaryError("");

        const params = new URLSearchParams();
        if (filters.region) params.set("region", filters.region);
        if (filters.country) params.set("country", filters.country);
        if (filters.sector) params.set("sector", filters.sector);
        if (filters.kind) params.set("kind", filters.kind);
        if (filters.search) params.set("search", filters.search);

        const res = await fetch(
          `/api/policy-intelligence/summary?${params.toString()}`,
          { cache: "no-store" },
        );
        const json: SummaryResponse = await res.json();

        if (!active) return;

        if (!res.ok) {
          setSummaryError(json.error || "Failed to load summary");
          setPrograms([]);
          setKpis({
            programs: 0,
            evidence_rows: 0,
            indicator_links: 0,
            country_examples: 0,
          });
          return;
        }

        setPrograms(Array.isArray(json.programs) ? json.programs : []);
        setKpis(
          json.stats || {
            programs: 0,
            evidence_rows: 0,
            indicator_links: 0,
            country_examples: 0,
          },
        );
        setSummarySource(json.source || "");
      } catch (error) {
        if (!active) return;
        setSummaryError(
          error instanceof Error ? error.message : "Failed to load summary",
        );
      } finally {
        if (active) setLoadingSummary(false);
      }
    }

    loadSummary();

    return () => {
      active = false;
    };
  }, [filters]);

  useEffect(() => {
    if (!programs.length) {
      setSelectedProgramKey("");
      return;
    }

    const exists = programs.some((p) => p.program_key === selectedProgramKey);
    if (!exists) {
      setSelectedProgramKey(programs[0].program_key);
    }
  }, [programs, selectedProgramKey]);

  const selectedProgram = useMemo(() => {
    return programs.find((p) => p.program_key === selectedProgramKey) || null;
  }, [programs, selectedProgramKey]);

  const selectedCountryMeta = useMemo(() => {
    return countries.find((c) => c.iso3 === filters.country) || null;
  }, [countries, filters.country]);

  useEffect(() => {
    let active = true;

    async function loadCif() {
      if (!filters.country || filters.country === "All") {
        setCif(null);
        setCifError("");
        return;
      }

      try {
        setLoadingCif(true);
        setCifError("");

        const res = await fetch(
          `/api/policy-intelligence/cif?country=${encodeURIComponent(filters.country)}`,
          { cache: "no-store" },
        );
        const json: CifResponse = await res.json();

        if (!active) return;

        if (!res.ok) {
          if (res.status === 404) {
            setCif({
              ok: false,
              country: filters.country,
              rows: [],
              summary: null,
              message: "CIF endpoint not available yet.",
            });
            setCifError("");
            return;
          }

          setCifError(json.error || "Failed to load country intelligence");
          setCif(null);
          return;
        }

        setCif(json);
      } catch (error) {
        if (!active) return;
        setCifError(
          error instanceof Error
            ? error.message
            : "Failed to load country intelligence",
        );
        setCif(null);
      } finally {
        if (active) setLoadingCif(false);
      }
    }

    loadCif();

    return () => {
      active = false;
    };
  }, [filters.country]);

  const sectorOptions = useMemo(() => {
    const source = allProgramsMeta.length ? allProgramsMeta : programs;

    const values = Array.from(
      new Set(source.map((p) => (p.sector_key || "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    return ["All", ...values];
  }, [allProgramsMeta, programs]);

  const kindOptions = useMemo(() => {
    const source = allProgramsMeta.length ? allProgramsMeta : programs;

    const values = Array.from(
      new Set(source.map((p) => (p.kind || "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    return ["All", ...values];
  }, [allProgramsMeta, programs]);

  function updateFilter<K extends keyof PolicyFiltersState>(
    key: K,
    value: PolicyFiltersState[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return {
    filters,
    regions,
    countries,
    availableCountries,
    sectorOptions,
    kindOptions,
    filteredPrograms: programs,
    selectedProgram,
    selectedProgramKey,
    selectedCountryMeta,
    summarySource,
    cif,
    kpis,
    loadingFilters,
    loadingSummary,
    loadingCif,
    filtersError,
    summaryError,
    cifError,
    updateFilter,
    resetFilters,
    setSelectedProgramKey,
  };
}
