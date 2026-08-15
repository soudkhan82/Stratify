"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Globe2,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  TrendingUp,
} from "lucide-react";

import type { StratifyMapRow } from "@/app/components/StratifyMap";

const StratifyMap = dynamic(
  () =>
    import(
      "@/app/components/StratifyMap"
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[500px] items-center justify-center rounded-[24px] bg-[#dfeef5]">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          Preparing Leaflet map
        </div>
      </div>
    ),
  },
);

type MapRow = {
  iso3: string;
  country: string;
  region: string | null;
  value: number;
};

type MapApiResponse = {
  rows: MapRow[];
  error?: string;
};

type IndicatorMeta = {
  code: string;
  label: string;
  unit?: string;
  description: string;
};

const REGIONS = [
  "World",
  "Sub-Saharan Africa",
  "Europe & Central Asia",
  "Middle East & North Africa",
  "South Asia",
  "East Asia & Pacific",
  "Latin America & Caribbean",
  "North America",
] as const;

const INDICATORS: IndicatorMeta[] = [
  {
    code: "SP.POP.TOTL",
    label: "Population",
    description:
      "Total resident population.",
  },
  {
    code: "NY.GDP.MKTP.CD",
    label: "GDP (current US$)",
    unit: "US$",
    description:
      "Size of the economy at current market prices.",
  },
  {
    code: "SP.POP.GROW",
    label: "Population Growth",
    unit: "%",
    description:
      "Annual population growth rate.",
  },
  {
    code: "SP.DYN.LE00.IN",
    label: "Life Expectancy",
    unit: "years",
    description:
      "Life expectancy at birth.",
  },
  {
    code: "SP.URB.TOTL.IN.ZS",
    label: "Urban Population",
    unit: "%",
    description:
      "Share of population living in urban areas.",
  },
  {
    code: "EG.ELC.ACCS.ZS",
    label: "Access to Electricity",
    unit: "%",
    description:
      "Population with access to electricity.",
  },
];

const DEFAULT_INDICATOR =
  "SP.POP.TOTL";

function numberValue(
  value: unknown,
) {
  const numeric =
    Number(value);

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : 0;
}

function compact(
  value: number,
) {
  if (
    !Number.isFinite(value)
  ) {
    return "n/a";
  }

  const abs =
    Math.abs(value);

  if (abs >= 1e12) {
    return `${(
      value / 1e12
    ).toFixed(2)}T`;
  }

  if (abs >= 1e9) {
    return `${(
      value / 1e9
    ).toFixed(2)}B`;
  }

  if (abs >= 1e6) {
    return `${(
      value / 1e6
    ).toFixed(2)}M`;
  }

  if (abs >= 1e3) {
    return new Intl.NumberFormat(
      "en",
      {
        maximumFractionDigits: 0,
      },
    ).format(value);
  }

  return new Intl.NumberFormat(
    "en",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function displayValue(
  value: number,
  unit?: string,
) {
  if (unit === "US$") {
    return `$${compact(
      value,
    )}`;
  }

  if (unit === "%") {
    return `${new Intl.NumberFormat(
      "en",
      {
        maximumFractionDigits: 2,
      },
    ).format(value)}%`;
  }

  if (unit === "years") {
    return `${new Intl.NumberFormat(
      "en",
      {
        maximumFractionDigits: 1,
      },
    ).format(value)} years`;
  }

  return compact(value);
}

function regionParam(
  region: string,
) {
  return region === "World"
    ? null
    : region;
}

export default function Page() {
  const router =
    useRouter();

  const [
    region,
    setRegion,
  ] = useState("World");

  const [
    indicator,
    setIndicator,
  ] = useState(
    DEFAULT_INDICATOR,
  );

  const [
    rows,
    setRows,
  ] = useState<MapRow[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedIso3,
    setSelectedIso3,
  ] = useState<
    string | null
  >(null);

  const [
    countryQuery,
    setCountryQuery,
  ] = useState("");

  const currentIndicator =
    useMemo(
      () =>
        INDICATORS.find(
          (item) =>
            item.code ===
            indicator,
        ) ??
        INDICATORS[0],
      [indicator],
    );

  const currentRegionParam =
    useMemo(
      () =>
        regionParam(
          region,
        ),
      [region],
    );

  useEffect(() => {
    let active = true;

    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const params =
          new URLSearchParams();

        params.set(
          "indicator",
          indicator,
        );

        if (
          currentRegionParam
        ) {
          params.set(
            "region",
            currentRegionParam,
          );
        }

        const response =
          await fetch(
            `/api/map?${params.toString()}`,
            {
              cache:
                "no-store",
              signal:
                controller.signal,
            },
          );

        const payload =
          (await response.json()) as MapApiResponse;

        if (
          !response.ok
        ) {
          throw new Error(
            payload.error ||
              "Unable to load WDI map data.",
          );
        }

        if (!active) {
          return;
        }

        setRows(
          Array.isArray(
            payload.rows,
          )
            ? payload.rows
            : [],
        );

        setSelectedIso3(
          null,
        );
        setCountryQuery(
          "",
        );
      } catch (
        loadError
      ) {
        if (
          !active ||
          (
            loadError instanceof
              DOMException &&
            loadError.name ===
              "AbortError"
          )
        ) {
          return;
        }

        setError(
          loadError instanceof
            Error
            ? loadError.message
            : "Unable to load WDI map data.",
        );
      } finally {
        if (active) {
          setLoading(
            false,
          );
        }
      }
    }

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    indicator,
    currentRegionParam,
  ]);

  const mapRows =
    useMemo(
      (): StratifyMapRow[] =>
        rows
          .map((row) => ({
            iso3:
              String(
                row.iso3 ??
                  "",
              )
                .trim()
                .toUpperCase(),
            country:
              String(
                row.country ??
                  "",
              ).trim(),
            region:
              row.region ??
              null,
            value:
              numberValue(
                row.value,
              ),
          }))
          .filter(
            (row) =>
              row.iso3.length ===
                3 &&
              row.country,
          ),
      [rows],
    );

  const sortedRows =
    useMemo(
      () =>
        [...mapRows].sort(
          (a, b) =>
            b.value -
            a.value,
        ),
      [mapRows],
    );

  const selected =
    useMemo(
      () =>
        selectedIso3
          ? mapRows.find(
              (row) =>
                row.iso3 ===
                selectedIso3,
            ) ?? null
          : null,
      [
        mapRows,
        selectedIso3,
      ],
    );

  const selectedRank =
    useMemo(() => {
      if (!selected) {
        return null;
      }

      const index =
        sortedRows.findIndex(
          (row) =>
            row.iso3 ===
            selected.iso3,
        );

      return index >= 0
        ? index + 1
        : null;
    }, [
      sortedRows,
      selected,
    ]);

  const values =
    useMemo(
      () =>
        sortedRows.map(
          (row) =>
            row.value,
        ),
      [sortedRows],
    );

  const median =
    useMemo(() => {
      if (!values.length) {
        return null;
      }

      const ascending =
        [...values].sort(
          (a, b) => a - b,
        );

      const midpoint =
        Math.floor(
          ascending.length /
            2,
        );

      if (
        ascending.length %
          2 ===
        0
      ) {
        return (
          (
            ascending[
              midpoint - 1
            ] +
            ascending[
              midpoint
            ]
          ) / 2
        );
      }

      return ascending[
        midpoint
      ];
    }, [values]);

  const countryMatches =
    useMemo(() => {
      const query =
        countryQuery
          .trim()
          .toLowerCase();

      if (
        query.length < 2
      ) {
        return [];
      }

      return mapRows
        .filter(
          (row) =>
            row.country
              .toLowerCase()
              .includes(
                query,
              ) ||
            row.iso3
              .toLowerCase()
              .includes(
                query,
              ),
        )
        .slice(0, 7);
    }, [
      countryQuery,
      mapRows,
    ]);

  function selectCountry(
    iso3: string,
  ) {
    const normalized =
      String(iso3)
        .trim()
        .toUpperCase();

    if (!normalized) {
      return;
    }

    setSelectedIso3(
      normalized,
    );
    setCountryQuery("");
  }

  function openProfile(
    iso3: string,
  ) {
    router.push(
      `/world/country/${encodeURIComponent(
        iso3,
      )}?indicator=${encodeURIComponent(
        indicator,
      )}&dataset=wdi`,
    );
  }

  function resetDashboard() {
    setRegion("World");
    setIndicator(
      DEFAULT_INDICATOR,
    );
    setSelectedIso3(
      null,
    );
    setCountryQuery(
      "",
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef2ff_0,_#f8fafc_38%,_#f1f5f9_100%)]">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-indigo-600">
                <Globe2 className="h-4 w-4" />
                Global intelligence
              </div>

              <h1 className="mt-1 text-[32px] font-black tracking-[-0.04em] text-slate-950 sm:text-[38px]">
                World Intelligence Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                Explore World Bank development indicators on a fast interactive choropleth, then open any country for deeper WDI, IMF and economic intelligence.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-black text-indigo-700">
                World Bank WDI
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600">
                Leaflet + Natural Earth
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(180px,0.8fr)_minmax(260px,1.2fr)_auto]">
            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                Region
              </span>

              <select
                value={
                  region
                }
                onChange={(
                  event,
                ) =>
                  setRegion(
                    event.target
                      .value,
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {REGIONS.map(
                  (
                    item,
                  ) => (
                    <option
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {
                        item
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                Indicator
              </span>

              <select
                value={
                  indicator
                }
                onChange={(
                  event,
                ) =>
                  setIndicator(
                    event.target
                      .value,
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {INDICATORS.map(
                  (
                    item,
                  ) => (
                    <option
                      key={
                        item.code
                      }
                      value={
                        item.code
                      }
                    >
                      {
                        item.label
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={
                  resetDashboard
                }
                disabled={
                  loading
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </section>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  Choropleth view
                </div>

                <div className="mt-1 text-lg font-black text-slate-900">
                  {
                    currentIndicator.label
                  }
                </div>

                <div className="text-xs font-semibold text-slate-500">
                  {
                    currentIndicator.description
                  }{" "}
                  | Scope:{" "}
                  {region}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {loading ? (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-indigo-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating data
                  </div>
                ) : null}

                <div className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600">
                  {
                    mapRows.length
                  }{" "}
                  countries
                </div>
              </div>
            </div>

            <div className="p-2">
              <StratifyMap
                rows={
                  mapRows
                }
                selectedIso3={
                  selectedIso3
                }
                onSelectIso3={
                  selectCountry
                }
                indicatorLabel={
                  currentIndicator.label
                }
                indicatorUnit={
                  currentIndicator.unit
                }
              />
            </div>
          </div>

          <aside className="flex min-h-[590px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-600" />

                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Country intelligence
                </div>
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={
                    countryQuery
                  }
                  onChange={(
                    event,
                  ) =>
                    setCountryQuery(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search country or ISO3"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />

                {countryMatches.length >
                0 ? (
                  <div className="absolute left-0 right-0 top-[44px] z-[950] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    {countryMatches.map(
                      (
                        row,
                      ) => (
                        <button
                          key={
                            row.iso3
                          }
                          type="button"
                          onClick={() =>
                            selectCountry(
                              row.iso3,
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-black text-slate-800">
                              {
                                row.country
                              }
                            </span>

                            <span className="text-[9px] font-bold text-slate-400">
                              {
                                row.iso3
                              }
                            </span>
                          </span>

                          <span className="shrink-0 text-xs font-black text-indigo-700">
                            {displayValue(
                              row.value,
                              currentIndicator.unit,
                            )}
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {selected ? (
                <div className="p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">
                    Selected country
                  </div>

                  <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
                    {
                      selected.country
                    }
                  </h2>

                  <div className="mt-1 text-xs font-bold text-slate-400">
                    {
                      selected.iso3
                    }{" "}
                    |{" "}
                    {
                      selected.region ??
                      "Region unavailable"
                    }
                  </div>

                  <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-500">
                      {
                        currentIndicator.label
                      }
                    </div>

                    <div className="mt-1 text-[30px] font-black tracking-[-0.04em] text-indigo-950">
                      {displayValue(
                        selected.value,
                        currentIndicator.unit,
                      )}
                    </div>

                    <div className="mt-1 text-xs font-semibold leading-5 text-indigo-700">
                      {
                        currentIndicator.description
                      }
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                        Position by value
                      </div>

                      <div className="mt-1 text-xl font-black text-slate-900">
                        {selectedRank
                          ? `#${selectedRank}`
                          : "n/a"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                        Scope
                      </div>

                      <div className="mt-1 truncate text-sm font-black text-slate-900">
                        {
                          region
                        }
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openProfile(
                        selected.iso3,
                      )
                    }
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black !text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    Open country profile
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">
                    Global snapshot
                  </div>

                  <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
                    {
                      currentIndicator.label
                    }
                  </h2>

                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    Hover a country for an instant value. Click a country to pin its intelligence here.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                        Coverage
                      </div>

                      <div className="mt-1 text-xl font-black text-slate-900">
                        {
                          mapRows.length
                        }
                      </div>

                      <div className="text-[10px] font-semibold text-slate-400">
                        countries
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                        Median
                      </div>

                      <div className="mt-1 truncate text-base font-black text-slate-900">
                        {median == null
                          ? "n/a"
                          : displayValue(
                              median,
                              currentIndicator.unit,
                            )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />

                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Highest values
                  </div>
                </div>

                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  {sortedRows
                    .slice(0, 6)
                    .map(
                      (
                        row,
                        index,
                      ) => (
                        <button
                          key={
                            row.iso3
                          }
                          type="button"
                          onClick={() =>
                            selectCountry(
                              row.iso3,
                            )
                          }
                          className={[
                            "flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50",
                            row.iso3 ===
                            selectedIso3
                              ? "bg-indigo-50"
                              : "bg-white",
                          ].join(
                            " ",
                          )}
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-500">
                            {
                              index +
                              1
                            }
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-black text-slate-800">
                              {
                                row.country
                              }
                            </div>

                            <div className="text-[9px] font-bold text-slate-400">
                              {
                                row.iso3
                              }
                            </div>
                          </div>

                          <div className="shrink-0 text-xs font-black text-indigo-700">
                            {displayValue(
                              row.value,
                              currentIndicator.unit,
                            )}
                          </div>
                        </button>
                      ),
                    )}
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-[0.11em] text-slate-400">
              Active indicator
            </div>

            <div className="mt-1 text-sm font-black text-slate-900">
              {
                currentIndicator.label
              }
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-[0.11em] text-slate-400">
              Geographic scope
            </div>

            <div className="mt-1 text-sm font-black text-slate-900">
              {
                region
              }
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-[0.11em] text-slate-400">
              Data coverage
            </div>

            <div className="mt-1 text-sm font-black text-slate-900">
              {
                mapRows.length
              }{" "}
              countries with values
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
