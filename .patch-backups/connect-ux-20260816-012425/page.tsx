"use client";

import dynamic from "next/dynamic";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Building2,
  ExternalLink,
  Globe2,
  Loader2,
  MapPinned,
  Phone,
  Search,
  ShieldCheck,
} from "lucide-react";

import {
  CONNECT_SECTORS,
  getConnectSector,
} from "@/app/lib/stratify-connect-config";

import type {
  ConnectGooglePlace,
} from "./_components/OrganizationMap";

const OrganizationMap =
  dynamic(
    () =>
      import(
        "./_components/OrganizationMap"
      ),
    {
      ssr: false,
      loading: () => (
        <div className="flex min-h-[560px] items-center justify-center rounded-[24px] bg-slate-100">
          <div className="flex items-center gap-2 text-sm font-black text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Google Maps
          </div>
        </div>
      ),
    },
  );

type SearchPayload = {
  ok: boolean;
  source?: string;
  sector?: string;
  sectorLabel?: string;
  category?: string;
  categoryLabel?: string;
  location?: string;
  queryCount?: number;
  queries?: string[];
  totalMatches?: number;
  places?: ConnectGooglePlace[];
  organizations?: ConnectGooglePlace[];
  partialErrors?: string[];
  sourcePolicy?: string;
  error?: string;
};

type PlaceDetails = {
  id: string;
  name: string;
  address: string;
  businessStatus: string;
  googleMapsUri: string;
  websiteUri: string;
  internationalPhoneNumber: string;
  nationalPhoneNumber: string;
  source: string;
};

type DetailsPayload = {
  ok: boolean;
  place?: PlaceDetails;
  error?: string;
};

type SearchInput = {
  sector: string;
  category: string;
  tag: string;
  q: string;
  location: string;
};

function titleCase(
  value: string,
) {
  return String(
    value ?? "",
  )
    .replace(
      /[_-]+/g,
      " ",
    )
    .split(" ")
    .filter(Boolean)
    .map(
      (
        part,
      ) =>
        part.charAt(0)
          .toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

async function requestPlaces(
  input: SearchInput,
) {
  const params =
    new URLSearchParams();

  params.set(
    "sector",
    input.sector,
  );
  params.set(
    "category",
    input.category,
  );
  params.set(
    "location",
    input.location.trim(),
  );
  params.set(
    "limit",
    "60",
  );

  if (
    input.tag.trim()
  ) {
    params.set(
      "tag",
      input.tag.trim(),
    );
  }

  if (
    input.q.trim()
  ) {
    params.set(
      "q",
      input.q.trim(),
    );
  }

  const response =
    await fetch(
      `/api/organizations?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

  const payload =
    (await response.json()) as SearchPayload;

  if (
    !response.ok ||
    !payload.ok
  ) {
    throw new Error(
      payload.error ||
        "Unable to search Google Places.",
    );
  }

  return payload;
}

export default function ConnectPage() {
  const [
    sector,
    setSector,
  ] = useState(
    "agriculture",
  );
  const [
    category,
    setCategory,
  ] = useState(
    "all",
  );
  const [
    location,
    setLocation,
  ] = useState("");
  const [
    tag,
    setTag,
  ] = useState("");
  const [
    q,
    setQ,
  ] = useState("");
  const [
    payload,
    setPayload,
  ] =
    useState<SearchPayload | null>(
      null,
    );
  const [
    loading,
    setLoading,
  ] = useState(false);
  const [
    error,
    setError,
  ] = useState("");
  const [
    selectedId,
    setSelectedId,
  ] =
    useState<string | null>(
      null,
    );
  const [
    detailsById,
    setDetailsById,
  ] =
    useState<
      Record<
        string,
        PlaceDetails
      >
    >({});
  const [
    detailLoadingId,
    setDetailLoadingId,
  ] =
    useState<string | null>(
      null,
    );
  const [
    initializedFromUrl,
    setInitializedFromUrl,
  ] = useState(false);

  const sectorConfig =
    useMemo(
      () =>
        getConnectSector(
          sector,
        ),
      [sector],
    );

  useEffect(() => {
    if (
      initializedFromUrl
    ) {
      return;
    }

    setInitializedFromUrl(
      true,
    );

    const params =
      new URLSearchParams(
        window.location.search,
      );

    const nextSector =
      params.get(
        "sector",
      ) ||
      "agriculture";
    const nextLocation =
      params.get(
        "location",
      ) ||
      "";
    const nextTag =
      params.get(
        "tag",
      ) ||
      "";
    const nextQ =
      params.get(
        "q",
      ) ||
      "";
    const requestedCategory =
      params.get(
        "category",
      ) ||
      "all";

    const config =
      getConnectSector(
        nextSector,
      );
    const nextCategory =
      config.categories.some(
        (item) =>
          item.value ===
          requestedCategory,
      )
        ? requestedCategory
        : "all";

    setSector(
      config.value,
    );
    setCategory(
      nextCategory,
    );
    setLocation(
      nextLocation,
    );
    setTag(
      nextTag,
    );
    setQ(
      nextQ,
    );

    if (
      nextLocation.trim()
        .length >= 2
    ) {
      setLoading(true);

      requestPlaces({
        sector:
          config.value,
        category:
          nextCategory,
        location:
          nextLocation,
        tag:
          nextTag,
        q:
          nextQ,
      })
        .then(
          (
            nextPayload,
          ) => {
            setPayload(
              nextPayload,
            );
            setSelectedId(
              nextPayload
                .places?.[0]
                ?.id ??
                null,
            );
          },
        )
        .catch(
          (
            requestError,
          ) => {
            setError(
              requestError instanceof
                Error
                ? requestError.message
                : "Unable to search Google Places.",
            );
          },
        )
        .finally(
          () => {
            setLoading(
              false,
            );
          },
        );
    }
  }, [
    initializedFromUrl,
  ]);

  const places =
    payload?.places ??
    payload?.organizations ??
    [];

  async function runSearch(
    event?: FormEvent,
  ) {
    event?.preventDefault();

    if (
      location.trim()
        .length < 2
    ) {
      setError(
        "Enter a country, city or region first.",
      );
      return;
    }

    setLoading(true);
    setError("");
    setSelectedId(
      null,
    );

    try {
      const nextPayload =
        await requestPlaces(
          {
            sector,
            category,
            location,
            tag,
            q,
          },
        );

      setPayload(
        nextPayload,
      );
      setSelectedId(
        nextPayload
          .places?.[0]
          ?.id ??
          null,
      );
    } catch (
      requestError
    ) {
      setPayload(null);
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Unable to search Google Places.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(
    placeId: string,
  ) {
    if (
      detailsById[
        placeId
      ]
    ) {
      return;
    }

    setDetailLoadingId(
      placeId,
    );

    try {
      const response =
        await fetch(
          `/api/google-places/details?placeId=${encodeURIComponent(
            placeId,
          )}`,
          {
            cache:
              "no-store",
          },
        );

      const detailsPayload =
        (await response.json()) as DetailsPayload;

      if (
        !response.ok ||
        !detailsPayload.ok ||
        !detailsPayload.place
      ) {
        throw new Error(
          detailsPayload.error ||
            "Unable to load place details.",
        );
      }

      setDetailsById(
        (current) => ({
          ...current,
          [placeId]:
            detailsPayload.place!,
        }),
      );
    } catch {
      // Search results remain useful even if an Enterprise detail call fails.
    } finally {
      setDetailLoadingId(
        null,
      );
    }
  }

  function changeSector(
    nextSector: string,
  ) {
    const config =
      getConnectSector(
        nextSector,
      );

    setSector(
      config.value,
    );
    setCategory(
      "all",
    );
    setTag("");
    setPayload(null);
    setSelectedId(
      null,
    );
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#eef3f8] px-3 py-5 text-slate-950 sm:px-5">
      <div className="mx-auto w-full max-w-[1480px]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-indigo-600">
                <Globe2 className="h-4 w-4" />
                Stratify Connect
              </div>

              <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Global Business & Organization Discovery
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Search live Google Places data across agriculture, finance, NGOs, energy, professional services and corporate activity in any country or city.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-500">
                Live provider
              </div>

              <div
                translate="no"
                className="mt-1 text-sm font-normal text-[#1f1f1f]"
              >
                Google Maps
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CONNECT_SECTORS.map(
              (
                item,
              ) => (
                <button
                  key={
                    item.value
                  }
                  type="button"
                  onClick={() =>
                    changeSector(
                      item.value,
                    )
                  }
                  className={[
                    "shrink-0 rounded-xl px-3 py-2 text-xs font-black transition",
                    sector ===
                    item.value
                      ? "bg-slate-900 !text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(
                    " ",
                  )}
                >
                  {
                    item.label
                  }
                </button>
              ),
            )}
          </div>

          <form
            onSubmit={
              runSearch
            }
            className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-[1fr_1.15fr_1.2fr_1.4fr_auto]"
          >
            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Category
              </span>

              <select
                value={
                  category
                }
                onChange={(
                  event,
                ) =>
                  setCategory(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
              >
                {sectorConfig.categories.map(
                  (
                    item,
                  ) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
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

            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Country / city
              </span>

              <div className="relative">
                <MapPinned className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={
                    location
                  }
                  onChange={(
                    event,
                  ) =>
                    setLocation(
                      event.target.value,
                    )
                  }
                  placeholder="Pakistan, Dubai, London..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none"
                />
              </div>
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Crop / specialty
              </span>

              <input
                value={
                  tag
                }
                onChange={(
                  event,
                ) =>
                  setTag(
                    event.target.value,
                  )
                }
                disabled={
                  sector !==
                  "agriculture"
                }
                placeholder={
                  sector ===
                  "agriculture"
                    ? "Wheat, rice, coffee..."
                    : "Used for Agriculture"
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Organization / custom search
              </span>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={
                    q
                  }
                  onChange={(
                    event,
                  ) =>
                    setQ(
                      event.target.value,
                    )
                  }
                  placeholder="Optional: company name or custom query"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none"
                />
              </div>
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={
                  loading
                }
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black !text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 xl:w-auto"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
          </form>

          <div className="mt-3 text-xs font-semibold text-slate-500">
            {sectorConfig.description}
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {
              error
            }
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm">
            <OrganizationMap
              places={
                places
              }
              selectedId={
                selectedId
              }
              onSelect={
                setSelectedId
              }
            />
          </div>

          <aside className="flex h-[650px] max-h-[calc(100vh-130px)] min-h-[560px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-100 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />

                    <h2 className="text-lg font-black text-slate-950">
                      Live Places
                    </h2>
                  </div>

                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {payload
                      ? `${places.length} unique matches across ${payload.queryCount ?? 0} Google searches`
                      : "Choose a location and search"}
                  </div>
                </div>

                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-slate-300" />
                )}
              </div>

              {payload?.queries
                ?.length ? (
                <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {payload.queries.map(
                    (
                      queryText,
                    ) => (
                      <span
                        key={
                          queryText
                        }
                        className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-500"
                      >
                        {
                          queryText
                        }
                      </span>
                    ),
                  )}
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {places.length ? (
                places.map(
                  (
                    place,
                  ) => {
                    const active =
                      selectedId ===
                      place.id;
                    const details =
                      detailsById[
                        place.id
                      ];

                    return (
                      <article
                        key={
                          place.id
                        }
                        onClick={() =>
                          setSelectedId(
                            place.id,
                          )
                        }
                        className={[
                          "cursor-pointer border-b border-slate-100 px-4 py-4 transition last:border-b-0",
                          active
                            ? "bg-indigo-50/70"
                            : "hover:bg-slate-50",
                        ].join(
                          " ",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={[
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black",
                              active
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-700",
                            ].join(
                              " ",
                            )}
                          >
                            {place.name
                              .charAt(
                                0,
                              )
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-black leading-5 text-slate-950">
                              {
                                place.name
                              }
                            </h3>

                            <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                              {
                                place.address
                              }
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1">
                              {place.matchedServices.map(
                                (
                                  service,
                                ) => (
                                  <span
                                    key={
                                      service
                                    }
                                    className="rounded-md bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700"
                                  >
                                    {
                                      service
                                    }
                                  </span>
                                ),
                              )}

                              {place.primaryType ? (
                                <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">
                                  {titleCase(
                                    place.primaryType,
                                  )}
                                </span>
                              ) : null}
                            </div>

                            {details ? (
                              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                                {details.websiteUri ? (
                                  <a
                                    href={
                                      details.websiteUri
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(
                                      event,
                                    ) =>
                                      event.stopPropagation()
                                    }
                                    className="inline-flex items-center gap-1 text-xs font-black text-indigo-700"
                                  >
                                    Official website
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : null}

                                {details.internationalPhoneNumber ||
                                details.nationalPhoneNumber ? (
                                  <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                    <Phone className="h-3.5 w-3.5" />
                                    {details.internationalPhoneNumber ||
                                      details.nationalPhoneNumber}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(
                                  event,
                                ) => {
                                  event.stopPropagation();
                                  loadDetails(
                                    place.id,
                                  );
                                }}
                                disabled={
                                  detailLoadingId ===
                                  place.id
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                              >
                                {detailLoadingId ===
                                place.id
                                  ? "Loading..."
                                  : details
                                    ? "Details loaded"
                                    : "Contact & website"}
                              </button>

                              {place.googleMapsUri ? (
                                <a
                                  href={
                                    place.googleMapsUri
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(
                                    event,
                                  ) =>
                                    event.stopPropagation()
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[10px] font-black !text-white"
                                >
                                  Google Maps
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  },
                )
              ) : (
                <div className="flex h-full items-center justify-center px-7 text-center">
                  <div>
                    <MapPinned className="mx-auto h-8 w-8 text-slate-300" />

                    <div className="mt-3 text-sm font-black text-slate-700">
                      No live search yet
                    </div>

                    <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Enter any country, city or region, select a sector, then search Google Places.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3">
              <div
                translate="no"
                className="text-xs font-normal text-[#5e5e5e]"
              >
                Google Maps
              </div>

              <div className="mt-1 text-[9px] font-semibold leading-4 text-slate-400">
                Results use Google Maps ranking signals including relevance, distance and prominence. Stratify merges duplicate Place IDs across its query variants.
              </div>
            </div>
          </aside>
        </section>

        {payload?.sourcePolicy ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-semibold leading-5 text-slate-500 shadow-sm">
            {
              payload.sourcePolicy
            }
          </div>
        ) : null}
      </div>
    </main>
  );
}
