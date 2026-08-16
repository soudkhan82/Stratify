"use client";

import dynamic from "next/dynamic";
import countries from "world-countries";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe2,
  Loader2,
  MapPinned,
  Phone,
  Search,
  ShieldCheck,
  X,
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
        <div className="flex min-h-[600px] items-center justify-center rounded-[20px] bg-slate-100">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading map
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

type PlacePhotoAttribution = {
  displayName: string;
  uri: string;
  photoUri: string;
};

type PlacePhoto = {
  name: string;
  widthPx: number;
  heightPx: number;
  authorAttributions: PlacePhotoAttribution[];
};

type PlaceReview = {
  name: string;
  rating: number | null;
  relativeTime: string;
  text: string;
  googleMapsUri: string;
  author: {
    displayName: string;
    uri: string;
    photoUri: string;
  };
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
  rating: number | null;
  userRatingCount: number;
  openNow: boolean | null;
  photos: PlacePhoto[];
  source: string;
};

type ReviewsPayload = {
  ok: boolean;
  reviews?: PlaceReview[];
  error?: string;
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
  signal?: AbortSignal;
};

type RawCountry = {
  name?: {
    common?: string;
  };
};

type CropMeta = {
  key: string;
  label: string;
  group?: string;
};

type AgricultureMeta = {
  crops?: CropMeta[];
};

type SelectOption = {
  value: string;
  label: string;
  meta?: string;
};

type SearchableSelectProps = {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowClear?: boolean;
};

const COUNTRY_OPTIONS: SelectOption[] =
  Array.from(
    new Set(
      (
        countries as RawCountry[]
      )
        .map(
          (country) =>
            String(
              country.name
                ?.common ??
                "",
            ).trim(),
        )
        .filter(Boolean),
    ),
  )
    .sort((a, b) =>
      a.localeCompare(b),
    )
    .map((name) => ({
      value: name,
      label: name,
    }));

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
      (part) =>
        part
          .charAt(0)
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

  if (input.tag.trim()) {
    params.set(
      "tag",
      input.tag.trim(),
    );
  }

  if (input.q.trim()) {
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
        signal:
          input.signal,
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

function SearchableSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  allowClear = true,
}: SearchableSelectProps) {
  const rootRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const selected =
    options.find(
      (option) =>
        option.value === value,
    );

  const [
    query,
    setQuery,
  ] = useState(
    selected?.label ?? "",
  );
  const [
    open,
    setOpen,
  ] = useState(false);

  useEffect(() => {
    setQuery(
      selected?.label ??
        "",
    );
  }, [
    selected?.label,
    value,
  ]);

  useEffect(() => {
    const onPointerDown = (
      event: MouseEvent,
    ) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);

        if (
          selected?.label
        ) {
          setQuery(
            selected.label,
          );
        } else if (
          !value
        ) {
          setQuery("");
        }
      }
    };

    document.addEventListener(
      "mousedown",
      onPointerDown,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        onPointerDown,
      );
  }, [
    selected?.label,
    value,
  ]);

  const filtered =
    useMemo(() => {
      const needle =
        query
          .trim()
          .toLowerCase();

      if (!needle) {
        return options.slice(
          0,
          120,
        );
      }

      return options
        .filter(
          (option) =>
            option.label
              .toLowerCase()
              .includes(
                needle,
              ) ||
            option.meta
              ?.toLowerCase()
              .includes(
                needle,
              ),
        )
        .slice(0, 120);
    }, [
      options,
      query,
    ]);

  function choose(
    option: SelectOption,
  ) {
    onChange(
      option.value,
    );
    setQuery(
      option.label,
    );
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
    window.setTimeout(
      () =>
        inputRef.current?.focus(),
      0,
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
    >
      <div className="mb-1.5 pl-0.5 text-[11px] font-medium tracking-[-0.01em] text-slate-500">
        {label}
      </div>

      <div
        className={[
          "relative flex h-11 items-center rounded-[14px] border bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition",
          open
            ? "border-indigo-300 ring-4 ring-indigo-100/70"
            : "border-slate-200/90 hover:border-indigo-200 hover:bg-white",
          disabled
            ? "cursor-not-allowed bg-slate-50 opacity-60"
            : "",
        ].join(" ")}
      >
        <Search className="pointer-events-none ml-3 h-3.5 w-3.5 shrink-0 text-slate-400" />

        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          onFocus={() =>
            setOpen(true)
          }
          onChange={(event) => {
            setQuery(
              event.target.value,
            );
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (
              event.key ===
              "Escape"
            ) {
              setOpen(false);
              setQuery(
                selected?.label ??
                  "",
              );
            }

            if (
              event.key ===
                "Enter" &&
              filtered.length
            ) {
              event.preventDefault();
              choose(
                filtered[0],
              );
            }
          }}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] font-normal text-slate-700 outline-none placeholder:text-slate-400"
        />

        {allowClear &&
        value &&
        !disabled ? (
          <button
            type="button"
            onClick={
              clear
            }
            className="mr-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Clear ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(
              (current) =>
                !current,
            );
            inputRef.current?.focus();
          }}
          className="mr-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none"
          aria-label={`Open ${label}`}
        >
          <ChevronDown
            className={[
              "h-4 w-4 transition-transform",
              open
                ? "rotate-180"
                : "",
            ].join(" ")}
          />
        </button>
      </div>

      {open &&
      !disabled ? (
        <div className="absolute left-0 right-0 top-[66px] z-[500] max-w-full overflow-hidden rounded-[16px] border border-slate-200/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="max-h-[300px] overflow-y-auto overscroll-contain p-1.5">
            {filtered.length ? (
              filtered.map(
                (option) => {
                  const active =
                    option.value ===
                    value;

                  return (
                    <button
                      key={
                        option.value
                      }
                      type="button"
                      onMouseDown={(
                        event,
                      ) =>
                        event.preventDefault()
                      }
                      onClick={() =>
                        choose(
                          option,
                        )
                      }
                      className={[
                        "flex w-full items-center gap-2 rounded-[11px] px-3 py-2.5 text-left transition",
                        active
                          ? "bg-indigo-50/90 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-50/90 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-normal">
                          {
                            option.label
                          }
                        </div>

                        {option.meta ? (
                          <div className="mt-0.5 truncate text-[10px] font-normal text-slate-400">
                            {
                              option.meta
                            }
                          </div>
                        ) : null}
                      </div>

                      {active ? (
                        <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                      ) : null}
                    </button>
                  );
                },
              )
            ) : (
              <div className="px-3 py-8 text-center text-xs font-normal text-slate-500">
                No matching options
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
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
    reviewsById,
    setReviewsById,
  ] =
    useState<
      Record<
        string,
        PlaceReview[]
      >
    >({});
  const [
    reviewLoadingId,
    setReviewLoadingId,
  ] =
    useState<string | null>(
      null,
    );
  const [
    insightPlaceId,
    setInsightPlaceId,
  ] =
    useState<string | null>(
      null,
    );
  const [
    initialized,
    setInitialized,
  ] = useState(false);
  const [
    sectorSearch,
    setSectorSearch,
  ] = useState("");
  const [
    agricultureCrops,
    setAgricultureCrops,
  ] = useState<CropMeta[]>([]);

  const sectorConfig =
    useMemo(
      () =>
        getConnectSector(
          sector,
        ),
      [sector],
    );

  const sectorMenuItems =
    useMemo(() => {
      const needle =
        sectorSearch
          .trim()
          .toLowerCase();

      return [...CONNECT_SECTORS]
        .sort((a, b) =>
          a.label.localeCompare(
            b.label,
          ),
        )
        .filter((item) => {
          if (!needle) {
            return true;
          }

          return [
            item.label,
            item.description,
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle);
        });
    }, [sectorSearch]);

  const categoryOptions =
    useMemo<SelectOption[]>(
      () =>
        sectorConfig.categories.map(
          (item) => ({
            value:
              item.value,
            label:
              item.label,
          }),
        ),
      [sectorConfig],
    );

  useEffect(() => {
    let alive = true;

    fetch(
      "/data/agriculture/meta.json?v=connect-searchable",
      {
        cache:
          "force-cache",
      },
    )
      .then(
        async (
          response,
        ) => {
          if (
            !response.ok
          ) {
            throw new Error(
              `Agriculture metadata HTTP ${response.status}`,
            );
          }

          return (await response.json()) as AgricultureMeta;
        },
      )
      .then((meta) => {
        if (!alive) {
          return;
        }

        setAgricultureCrops(
          Array.isArray(
            meta.crops,
          )
            ? [
                ...meta.crops,
              ].sort(
                (
                  a,
                  b,
                ) =>
                  a.label.localeCompare(
                    b.label,
                  ),
              )
            : [],
        );
      })
      .catch(() => {
        if (alive) {
          setAgricultureCrops(
            [],
          );
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  const specialtyOptions =
    useMemo<
      SelectOption[]
    >(() => {
      if (
        sector ===
        "agriculture"
      ) {
        const cropOptions =
          agricultureCrops.map(
            (crop) => ({
              value: crop.key,
              label:
                crop.label,
              meta:
                crop.group
                  ? titleCase(
                      crop.group,
                    )
                  : undefined,
            }),
          );

        const hasUmbrellaCitrus =
          cropOptions.some(
            (option) =>
              option.value ===
                "citrus" ||
              option.label
                .trim()
                .toLowerCase() ===
                "citrus",
          );

        if (
          !hasUmbrellaCitrus
        ) {
          cropOptions.push({
            value: "citrus",
            label: "Citrus",
            meta:
              "Oranges, lemons, limes & other citrus",
          });
        }

        return cropOptions.sort(
          (a, b) =>
            a.label.localeCompare(
              b.label,
            ),
        );
      }

      const unique =
        new Map<
          string,
          string
        >();

      for (
        const categoryItem of
        sectorConfig.categories
      ) {
        for (
          const term of
          categoryItem.terms
        ) {
          const value =
            String(
              term ?? "",
            ).trim();

          if (!value) {
            continue;
          }

          unique.set(
            value.toLowerCase(),
            titleCase(
              value,
            ),
          );
        }
      }

      return Array.from(
        unique.entries(),
      )
        .map(
          ([
            value,
            label,
          ]) => ({
            value,
            label,
          }),
        )
        .sort(
          (a, b) =>
            a.label.localeCompare(
              b.label,
            ),
        );
    }, [
      agricultureCrops,
      sector,
      sectorConfig,
    ]);

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    const requestedSector =
      params.get(
        "sector",
      ) ||
      "agriculture";
    const config =
      getConnectSector(
        requestedSector,
      );

    const requestedCategory =
      params.get(
        "category",
      ) ||
      "all";

    setSector(
      config.value,
    );
    setCategory(
      config.categories.some(
        (item) =>
          item.value ===
          requestedCategory,
      )
        ? requestedCategory
        : "all",
    );
    setLocation(
      params.get(
        "location",
      ) ||
        "",
    );
    setTag(
      params.get(
        "tag",
      ) ||
        "",
    );
    setQ(
      params.get(
        "q",
      ) ||
        "",
    );
    setInitialized(
      true,
    );
  }, []);

  useEffect(() => {
    if (
      !initialized
    ) {
      return;
    }

    if (!location) {
      setPayload(null);
      setSelectedId(
        null,
      );
      setLoading(false);
      setError("");
      return;
    }

    const controller =
      new AbortController();

    const delay =
      q.trim()
        ? 550
        : 180;

    const timer =
      window.setTimeout(
        async () => {
          setLoading(true);
          setError("");

          try {
            const nextPayload =
              await requestPlaces(
                {
                  sector,
                  category,
                  location,
                  tag,
                  q,
                  signal:
                    controller.signal,
                },
              );

            setPayload(
              nextPayload,
            );

            setSelectedId(
              (current) =>
                nextPayload
                  .places?.some(
                    (
                      place,
                    ) =>
                      place.id ===
                      current,
                  )
                  ? current
                  : nextPayload
                      .places?.[0]
                      ?.id ??
                    null,
            );

            const params =
              new URLSearchParams();

            params.set(
              "sector",
              sector,
            );
            params.set(
              "category",
              category,
            );
            params.set(
              "location",
              location,
            );

            if (tag) {
              params.set(
                "tag",
                tag,
              );
            }

            if (
              q.trim()
            ) {
              params.set(
                "q",
                q.trim(),
              );
            }

            window.history.replaceState(
              null,
              "",
              `/connect?${params.toString()}`,
            );
          } catch (
            requestError
          ) {
            if (
              controller.signal
                .aborted
            ) {
              return;
            }

            setPayload(null);
            setSelectedId(
              null,
            );
            setError(
              requestError instanceof
                Error
                ? requestError.message
                : "Unable to search Google Places.",
            );
          } finally {
            if (
              !controller.signal
                .aborted
            ) {
              setLoading(
                false,
              );
            }
          }
        },
        delay,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
      controller.abort();
    };
  }, [
    initialized,
    sector,
    category,
    location,
    tag,
    q,
  ]);

  const places =
    payload?.places ??
    payload?.organizations ??
    [];

  const insightPlace =
    insightPlaceId
      ? places.find(
          (place) =>
            place.id ===
            insightPlaceId,
        ) ??
        null
      : null;

  const insightDetails =
    insightPlaceId
      ? detailsById[
          insightPlaceId
        ] ??
        null
      : null;

  const insightReviews =
    insightPlaceId
      ? reviewsById[
          insightPlaceId
        ]
      : undefined;

  useEffect(() => {
    if (
      !insightPlaceId
    ) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setInsightPlaceId(
          null,
        );
      }
    };

    document.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        onKeyDown,
      );
    };
  }, [insightPlaceId]);

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
          `/api/places/details?placeId=${encodeURIComponent(
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
      // Search result remains usable even if details fail.
    } finally {
      setDetailLoadingId(
        null,
      );
    }
  }

  async function loadReviews(
    placeId: string,
  ) {
    if (
      reviewsById[
        placeId
      ]
    ) {
      return;
    }

    setReviewLoadingId(
      placeId,
    );

    try {
      const response =
        await fetch(
          `/api/places/reviews?placeId=${encodeURIComponent(
            placeId,
          )}`,
          {
            cache:
              "no-store",
          },
        );

      const reviewsPayload =
        (await response.json()) as ReviewsPayload;

      if (
        !response.ok ||
        !reviewsPayload.ok
      ) {
        throw new Error(
          reviewsPayload.error ||
            "Unable to load reviews.",
        );
      }

      setReviewsById(
        (current) => ({
          ...current,
          [placeId]:
            reviewsPayload.reviews ??
            [],
        }),
      );
    } catch {
      setReviewsById(
        (current) => ({
          ...current,
          [placeId]: [],
        }),
      );
    } finally {
      setReviewLoadingId(
        null,
      );
    }
  }

  function openInsights(
    placeId: string,
  ) {
    setSelectedId(
      placeId,
    );
    setInsightPlaceId(
      placeId,
    );

    if (
      !detailsById[
        placeId
      ]
    ) {
      void loadDetails(
        placeId,
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
    setSelectedId(
      null,
    );
    setError("");
  }

  const resultSummary =
    !location
      ? "Select a country to begin"
      : loading
        ? "Refreshing live results"
        : payload
          ? `${places.length} organizations found`
          : "Ready";

  const categoryLabel =
    sectorConfig.categories.find(
      (item) =>
        item.value === category,
    )?.label ??
    "All";

  const specialtyLabel =
    specialtyOptions.find(
      (item) =>
        item.value === tag,
    )?.label ??
    "";

  const animalAgricultureCategory =
    sector === "agriculture" &&
    (
      category === "dairy" ||
      category === "livestock"
    );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.07),_transparent_25%),linear-gradient(180deg,#f7f9fc_0%,#edf2f7_100%)] px-2.5 py-3 text-slate-800 sm:px-4">
      <div className="mx-auto w-full max-w-[1580px]">
        <header className="mb-3 flex flex-col gap-3 rounded-[22px] border border-white/90 bg-white/88 px-4 py-3 shadow-[0_10px_34px_rgba(30,41,59,0.07)] backdrop-blur-xl sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-[0_6px_16px_rgba(79,70,229,0.2)]">
              <Globe2 className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[21px] font-semibold tracking-[-0.035em] text-slate-800">
                  Stratify Connect
                </h1>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 py-1 text-[9px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Google Places live
                </span>
              </div>

              <p className="mt-0.5 text-[11px] font-normal text-slate-500">
                Global organization discovery across 27 economic sectors.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-[11px] border border-slate-200/80 bg-slate-50/80 px-3 py-1.5">
              <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
                Results
              </span>
              <span className="ml-2 text-[12px] font-semibold text-slate-700">
                {loading
                  ? "Updating"
                  : `${places.length} places`}
              </span>
            </div>

            <div className="rounded-[11px] border border-slate-200/80 bg-slate-50/80 px-3 py-1.5">
              <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
                Queries
              </span>
              <span className="ml-2 text-[12px] font-semibold text-slate-700">
                {payload?.queryCount ?? 0}
              </span>
            </div>

            <div className="flex h-8 items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 text-[10px] font-medium text-slate-500">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              )}

              {resultSummary}
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-3 rounded-[14px] border border-rose-200/80 bg-rose-50/90 px-4 py-2.5 text-xs font-medium text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="grid items-stretch gap-3 xl:grid-cols-[300px_minmax(0,1fr)_400px]">
          <aside className="flex h-[calc(100vh-142px)] min-h-[650px] flex-col overflow-hidden rounded-[22px] border border-white/90 bg-white/90 shadow-[0_12px_38px_rgba(30,41,59,0.07)] backdrop-blur-xl">
            <div className="shrink-0 border-b border-slate-100 bg-[linear-gradient(145deg,rgba(248,250,252,0.98),rgba(238,242,255,0.72))] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold tracking-[-0.015em] text-slate-700">
                    Economic sectors
                  </div>
                  <div className="mt-0.5 text-[9.5px] font-normal text-slate-400">
                    A-Z directory
                  </div>
                </div>

                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-semibold text-indigo-600">
                  {CONNECT_SECTORS.length}
                </span>
              </div>

              <div className="mt-2.5 flex h-9 items-center rounded-[11px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100/70">
                <Search className="ml-2.5 h-3.5 w-3.5 shrink-0 text-slate-400" />

                <input
                  value={sectorSearch}
                  onChange={(event) =>
                    setSectorSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search sectors..."
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-[12px] font-normal text-slate-700 outline-none placeholder:text-slate-400"
                />

                {sectorSearch ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSectorSearch("")
                    }
                    className="mr-1.5 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear sector search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              {sectorMenuItems.length ? (
                <div className="space-y-0.5">
                  {sectorMenuItems.map(
                    (item) => {
                      const active =
                        item.value ===
                        sector;

                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() =>
                            changeSector(
                              item.value,
                            )
                          }
                          className={[
                            "group flex min-h-[46px] w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2.5 text-left transition",
                            active
                              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_5px_15px_rgba(79,70,229,0.18)]"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          ].join(
                            " ",
                          )}
                        >
                          <span
                            className={[
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[10px] font-semibold",
                              active
                                ? "bg-white/15 text-white"
                                : "bg-slate-50 text-slate-400 ring-1 ring-slate-200/80 group-hover:bg-indigo-50 group-hover:text-indigo-600",
                            ].join(
                              " ",
                            )}
                          >
                            {item.label
                              .charAt(0)
                              .toUpperCase()}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="whitespace-normal break-words text-[11.5px] font-medium leading-[15px]">
                              {item.label}
                            </div>
                          </div>

                          <ChevronRight
                            className={[
                              "h-3.5 w-3.5 shrink-0",
                              active
                                ? "text-white/80"
                                : "text-slate-300 group-hover:text-indigo-400",
                            ].join(
                              " ",
                            )}
                          />
                        </button>
                      );
                    },
                  )}
                </div>
              ) : (
                <div className="px-3 py-8 text-center text-[11px] font-normal text-slate-400">
                  No matching sector
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
              <div className="text-[9px] font-medium uppercase tracking-[0.08em] text-indigo-500">
                Active sector
              </div>

              <div className="mt-1 text-[12px] font-semibold text-slate-700">
                {sectorConfig.label}
              </div>
            </div>
          </aside>

          <div className="flex h-[calc(100vh-142px)] min-h-[650px] min-w-0 flex-col gap-3">
            <section className="relative z-[90] shrink-0 rounded-[22px] border border-white/90 bg-white/90 px-3.5 py-3 shadow-[0_10px_30px_rgba(30,41,59,0.06)] backdrop-blur-xl">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold tracking-[-0.015em] text-slate-700">
                    {sectorConfig.label}
                  </div>

                  <div className="mt-0.5 truncate text-[10px] font-normal text-slate-400">
                    {sectorConfig.description}
                  </div>
                </div>

                {(location ||
                  tag ||
                  q ||
                  category !==
                    "all") ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCategory(
                        "all",
                      );
                      setLocation("");
                      setTag("");
                      setQ("");
                      setPayload(
                        null,
                      );
                      setSelectedId(
                        null,
                      );
                      setError("");
                    }}
                    className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[9.5px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>

              <div className="grid min-w-0 gap-2.5 md:grid-cols-2">
                <SearchableSelect
                  label="Category"
                  value={category}
                  options={categoryOptions}
                  placeholder="Find category..."
                  allowClear={false}
                  onChange={(value) => {
                    const nextCategory =
                      value ||
                      "all";

                    setCategory(
                      nextCategory,
                    );

                    if (
                      sector ===
                        "agriculture" &&
                      (
                        nextCategory ===
                          "dairy" ||
                        nextCategory ===
                          "livestock"
                      )
                    ) {
                      setTag("");
                    }

                    setSelectedId(
                      null,
                    );
                  }}
                />

                <SearchableSelect
                  label="Country"
                  value={location}
                  options={COUNTRY_OPTIONS}
                  placeholder="Type country..."
                  onChange={(value) => {
                    setLocation(
                      value,
                    );
                    setSelectedId(
                      null,
                    );
                  }}
                />

                <SearchableSelect
                  label={
                    sector ===
                    "agriculture"
                      ? "Crop / product"
                      : "Specialty"
                  }
                  value={tag}
                  options={
                    typeof animalAgricultureCategory !== "undefined" &&
                    animalAgricultureCategory
                      ? []
                      : specialtyOptions
                  }
                  placeholder={
                    typeof animalAgricultureCategory !== "undefined" &&
                    animalAgricultureCategory
                      ? "Not applicable"
                      : sector ===
                          "agriculture"
                        ? "Type crop or Citrus..."
                        : "Type specialty..."
                  }
                  disabled={
                    typeof animalAgricultureCategory !== "undefined"
                      ? animalAgricultureCategory
                      : false
                  }
                  onChange={(value) => {
                    setTag(
                      value,
                    );
                    setSelectedId(
                      null,
                    );
                  }}
                />

                <div>
                  <div className="mb-1.5 pl-0.5 text-[11px] font-medium tracking-[-0.01em] text-slate-500">
                    Company or keyword
                  </div>

                  <div className="flex h-11 items-center rounded-[14px] border border-slate-200/90 bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-indigo-200 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100/70">
                    <Building2 className="ml-3 h-3.5 w-3.5 shrink-0 text-slate-400" />

                    <input
                      value={q}
                      onChange={(event) =>
                        setQ(
                          event.target.value,
                        )
                      }
                      disabled={
                        !location
                      }
                      placeholder={
                        location
                          ? "Optional name or keyword..."
                          : "Choose country first"
                      }
                      className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] font-normal text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                    />

                    {q ? (
                      <button
                        type="button"
                        onClick={() =>
                          setQ("")
                        }
                        className="mr-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Clear keyword"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex min-h-[28px] flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-medium text-indigo-600">
                  {sectorConfig.label}
                </span>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-medium text-slate-500">
                  {categoryLabel}
                </span>

                {location ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-medium text-emerald-700">
                    {location}
                  </span>
                ) : null}

                {specialtyLabel ? (
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[9px] font-medium text-sky-700">
                    {specialtyLabel}
                  </span>
                ) : null}
              </div>
            </section>

            <section className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-white/90 bg-white/90 shadow-[0_12px_38px_rgba(30,41,59,0.07)] backdrop-blur-xl">
              <div className="flex h-[46px] items-center justify-between gap-3 border-b border-slate-100 bg-white/90 px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600">
                    <MapPinned className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-slate-700">
                      Geographic coverage
                    </div>
                    <div className="truncate text-[9.5px] font-normal text-slate-400">
                      Live Google Places mapped for the active filters
                    </div>
                  </div>
                </div>

                <div className="hidden items-center gap-1.5 sm:flex">
                  {location ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-medium text-slate-500">
                      {location}
                    </span>
                  ) : null}

                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-medium text-indigo-600">
                    {sectorConfig.label}
                  </span>
                </div>
              </div>

              <div className="h-[calc(100%-46px)] min-h-[520px] bg-slate-100 p-1.5">
                <OrganizationMap
                  places={places}
                  selectedId={
                    selectedId
                  }
                  onSelect={
                    setSelectedId
                  }
                />
              </div>
            </section>
          </div>

          <aside className="flex h-[calc(100vh-142px)] min-h-[650px] flex-col overflow-hidden rounded-[22px] border border-white/90 bg-white/90 shadow-[0_12px_38px_rgba(30,41,59,0.07)] backdrop-blur-xl">
            <div className="shrink-0 border-b border-slate-100 bg-[linear-gradient(130deg,rgba(248,250,252,0.98),rgba(238,242,255,0.78))] px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100">
                    <Building2 className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <h2 style={{ fontSize: "15px", fontWeight: 600, lineHeight: "20px", letterSpacing: "-0.01em", color: "#334155" }}>Organizations</h2>

                    <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                      {!location
                        ? "Choose a country to begin"
                        : loading
                          ? "Updating directory"
                          : payload
                            ? `${places.length} unique Google Places results`
                            : "Ready for discovery"}
                    </div>
                  </div>
                </div>

                <div className="rounded-full border border-white bg-white/90 px-2.5 py-1 text-[9.5px] font-medium text-slate-500 shadow-sm">
                  {payload?.queryCount
                    ? `${payload.queryCount} variants`
                    : "Live"}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/65 p-2.5">
              {places.length ? (
                <div className="space-y-2">
                  {places.map(
                    (place) => {
                      const active =
                        selectedId ===
                        place.id;

                      return (
                        <article
                          key={place.id}
                          onClick={() =>
                            setSelectedId(
                              place.id,
                            )
                          }
                          className={[
                            "group relative cursor-pointer overflow-hidden rounded-[17px] border bg-white px-4 py-3.5 shadow-[0_3px_12px_rgba(15,23,42,0.035)] transition-all duration-200",
                            active
                              ? "border-indigo-200 bg-[linear-gradient(120deg,#ffffff_0%,#f5f7ff_100%)] shadow-[0_8px_22px_rgba(79,70,229,0.09)]"
                              : "border-slate-200/70 hover:-translate-y-[1px] hover:border-indigo-100 hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)]",
                          ].join(
                            " ",
                          )}
                        >
                          {active ? (
                            <span className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-500 to-blue-400" />
                          ) : null}

                          <div className="flex items-start gap-3">
                            <div
                              className={[
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[12px] font-medium transition",
                                active
                                  ? "bg-indigo-600 text-white shadow-[0_5px_14px_rgba(79,70,229,0.22)]"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600",
                              ].join(
                                " ",
                              )}
                            >
                              {place.name
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 style={{ fontSize: "12px", fontWeight: 500, lineHeight: "16px", letterSpacing: "-0.003em", color: "#334155" }}>{place.name}</h3>

                              <div className="mt-1 line-clamp-2 text-[11px] font-normal leading-[16px] text-slate-600">
                                {place.address}
                              </div>

                              {place.matchedServices
                                .length ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {place.matchedServices
                                    .slice(
                                      0,
                                      3,
                                    )
                                    .map(
                                      (
                                        service,
                                      ) => (
                                        <span
                                          key={service}
                                          className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-medium text-indigo-700"
                                        >
                                          {titleCase(
                                            service,
                                          )}
                                        </span>
                                      ),
                                    )}
                                </div>
                              ) : null}

                              <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2.5">
                                <button
                                  type="button"
                                  disabled={
                                    detailLoadingId ===
                                    place.id
                                  }
                                  onClick={(
                                    event,
                                  ) => {
                                    event.stopPropagation();
                                    openInsights(
                                      place.id,
                                    );
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-medium text-indigo-700 transition hover:text-indigo-900 disabled:opacity-50"
                                >
                                  {detailLoadingId ===
                                  place.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Building2 className="h-3 w-3" />
                                  )}

                                  Details & insights
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
                                    className="inline-flex items-center gap-1 text-[10px] font-normal text-slate-500 transition hover:text-slate-800"
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
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-6">
                  <div className="max-w-[270px] rounded-[18px] border border-white bg-white/75 px-5 py-6 text-center shadow-sm">
                    {loading ? (
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" />
                    ) : (
                      <ShieldCheck className="mx-auto h-7 w-7 text-indigo-200" />
                    )}

                    <div className="mt-3 text-sm font-medium text-slate-600">
                      {!location
                        ? "Choose a country"
                        : loading
                          ? "Discovering organizations"
                          : "No matching organizations"}
                    </div>

                    <p className="mt-1.5 text-[11px] font-normal leading-5 text-slate-400">
                      {!location
                        ? "Use the filters above the map. Results refresh automatically."
                        : loading
                          ? "Google Places is updating the map and directory."
                          : "Try a broader category or remove the specialty filter."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white/90 px-4 py-2.5 text-[9.5px] font-normal leading-4 text-slate-500">
              Live Google Places results. Duplicate Place IDs are merged across Stratify query variants.
            </div>
          </aside>
        </section>

        {insightPlaceId &&
        insightPlace ? (
          <div
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[3px] sm:p-5"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setInsightPlaceId(
                  null,
                );
              }
            }}
          >
            <div className="flex max-h-[90vh] w-[96vw] max-w-[1040px] flex-col overflow-hidden rounded-[24px] border border-white/90 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-[linear-gradient(120deg,#f8fafc_0%,#eef2ff_55%,#f0f9ff_100%)] px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-indigo-600 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.22)]">
                    {insightPlace.name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="text-[17px] font-semibold leading-6 tracking-[-0.015em] text-slate-800">
                      {insightPlace.name}
                    </div>

                    <div className="mt-1 max-w-2xl text-[11.5px] font-normal leading-5 text-slate-500">
                      {insightPlace.address}
                    </div>

                    {insightPlace.matchedServices
                      .length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {insightPlace.matchedServices
                          .slice(
                            0,
                            5,
                          )
                          .map(
                            (
                              service,
                            ) => (
                              <span
                                key={
                                  service
                                }
                                className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-100"
                              >
                                {titleCase(
                                  service,
                                )}
                              </span>
                            ),
                          )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setInsightPlaceId(
                      null,
                    )
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close organization insights"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/55 p-4 sm:p-5">
                {!insightDetails ? (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <div className="text-center">
                      {detailLoadingId ===
                      insightPlaceId ? (
                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-500" />
                      ) : (
                        <ShieldCheck className="mx-auto h-7 w-7 text-slate-300" />
                      )}

                      <div className="mt-3 text-sm font-medium text-slate-700">
                        {detailLoadingId ===
                        insightPlaceId
                          ? "Loading organization insights"
                          : "Insights unavailable"}
                      </div>

                      <div className="mt-1 text-[11px] font-normal text-slate-500">
                        Google Places details are requested on demand.
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
                      <section className="overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-4 py-3">
                          <div className="text-[13px] font-semibold text-slate-700">
                            Photos
                          </div>
                          <div className="mt-0.5 text-[9.5px] font-normal text-slate-400">
                            Google Places imagery
                          </div>
                        </div>

                        {insightDetails.photos
                          .length ? (
                          <div className="p-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              {insightDetails.photos
                                .slice(
                                  0,
                                  3,
                                )
                                .map(
                                  (
                                    photo,
                                    index,
                                  ) => (
                                    <img
                                      key={
                                        photo.name
                                      }
                                      src={`/api/places/photo?name=${encodeURIComponent(
                                        photo.name,
                                      )}&width=${index === 0 ? 900 : 560}`}
                                      alt={`${insightPlace.name} photo`}
                                      className={[
                                        "w-full rounded-[13px] object-cover",
                                        index ===
                                        0
                                          ? "h-[250px] sm:col-span-2"
                                          : "h-[145px]",
                                      ].join(
                                        " ",
                                      )}
                                      loading="lazy"
                                    />
                                  ),
                                )}
                            </div>

                            {insightDetails
                              .photos[0]
                              ?.authorAttributions?.[0]
                              ?.displayName ? (
                              <div className="mt-2 text-[9px] font-normal text-slate-400">
                                Photo attribution:{" "}
                                {insightDetails.photos[0]
                                  .authorAttributions[0]
                                  .uri ? (
                                  <a
                                    href={
                                      insightDetails.photos[0]
                                        .authorAttributions[0]
                                        .uri
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-slate-600"
                                  >
                                    {
                                      insightDetails.photos[0]
                                        .authorAttributions[0]
                                        .displayName
                                    }
                                  </a>
                                ) : (
                                  insightDetails.photos[0]
                                    .authorAttributions[0]
                                    .displayName
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex h-[280px] items-center justify-center bg-slate-50 text-[11px] font-normal text-slate-400">
                            No place photos available
                          </div>
                        )}
                      </section>

                      <section className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-sm">
                        <div className="text-[13px] font-semibold text-slate-700">
                          Organization overview
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-[13px] bg-amber-50 px-3 py-3">
                            <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-amber-600">
                              Rating
                            </div>
                            <div className="mt-1 text-[18px] font-semibold text-amber-800">
                              {insightDetails.rating !=
                              null
                                ? `${insightDetails.rating.toFixed(
                                    1,
                                  )} / 5`
                                : "N/A"}
                            </div>
                          </div>

                          <div className="rounded-[13px] bg-indigo-50 px-3 py-3">
                            <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-indigo-500">
                              Reviews
                            </div>
                            <div className="mt-1 text-[18px] font-semibold text-indigo-800">
                              {insightDetails.userRatingCount.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {insightDetails.openNow !=
                        null ? (
                          <div className="mt-3 rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2.5 text-[11px] font-medium">
                            <span
                              className={
                                insightDetails.openNow
                                  ? "text-emerald-700"
                                  : "text-slate-600"
                              }
                            >
                              {insightDetails.openNow
                                ? "Open now"
                                : "Closed now"}
                            </span>
                          </div>
                        ) : null}

                        <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
                          {insightDetails
                            .internationalPhoneNumber ||
                          insightDetails
                            .nationalPhoneNumber ? (
                            <div className="flex items-start gap-2.5">
                              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                              <div>
                                <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-slate-400">
                                  Phone
                                </div>
                                <div className="mt-0.5 text-[11px] font-normal text-slate-700">
                                  {insightDetails.internationalPhoneNumber ||
                                    insightDetails.nationalPhoneNumber}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {insightDetails.websiteUri ? (
                            <a
                              href={
                                insightDetails.websiteUri
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-start gap-2.5 rounded-[11px] transition hover:bg-slate-50"
                            >
                              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />

                              <div>
                                <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-slate-400">
                                  Website
                                </div>
                                <div className="mt-0.5 text-[11px] font-medium text-indigo-700">
                                  Visit official website
                                </div>
                              </div>
                            </a>
                          ) : null}

                          {insightPlace.googleMapsUri ? (
                            <a
                              href={
                                insightPlace.googleMapsUri
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-start gap-2.5 rounded-[11px] transition hover:bg-slate-50"
                            >
                              <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />

                              <div>
                                <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-slate-400">
                                  Location
                                </div>
                                <div className="mt-0.5 text-[11px] font-medium text-indigo-700">
                                  Open in Google Maps
                                </div>
                              </div>
                            </a>
                          ) : null}
                        </div>
                      </section>
                    </div>

                    <section className="mt-4 rounded-[18px] border border-slate-200/80 bg-white shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                        <div>
                          <div className="text-[13px] font-semibold text-slate-700">
                            Google reviews
                          </div>
                          <div className="mt-0.5 text-[9.5px] font-normal text-slate-400">
                            Review snippets are loaded only when requested.
                          </div>
                        </div>

                        {insightDetails.userRatingCount >
                        0 &&
                        insightReviews ===
                          undefined ? (
                          <button
                            type="button"
                            disabled={
                              reviewLoadingId ===
                              insightPlaceId
                            }
                            onClick={() =>
                              loadReviews(
                                insightPlaceId,
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-[10px] bg-indigo-600 px-3 py-2 text-[10px] font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {reviewLoadingId ===
                            insightPlaceId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}

                            {reviewLoadingId ===
                            insightPlaceId
                              ? "Loading reviews"
                              : "Load review snippets"}
                          </button>
                        ) : null}
                      </div>

                      <div className="p-4">
                        {insightReviews ===
                        undefined ? (
                          <div className="rounded-[13px] bg-slate-50 px-4 py-6 text-center text-[11px] font-normal text-slate-500">
                            Reviews have not been loaded yet.
                          </div>
                        ) : insightReviews.length ? (
                          <div className="grid gap-3 lg:grid-cols-3">
                            {insightReviews.map(
                              (
                                review,
                              ) => (
                                <article
                                  key={
                                    review.name
                                  }
                                  className="rounded-[14px] border border-slate-200/80 bg-slate-50/60 p-3.5"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-[11px] font-semibold text-slate-700">
                                        {review.author.displayName ||
                                          "Google user"}
                                      </div>

                                      <div className="mt-0.5 text-[9px] font-normal text-slate-400">
                                        {review.relativeTime ||
                                          "Google review"}
                                      </div>
                                    </div>

                                    {review.rating !=
                                    null ? (
                                      <div className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-medium text-amber-700">
                                        Ã¢Ëœâ€¦ {review.rating}
                                      </div>
                                    ) : null}
                                  </div>

                                  {review.text ? (
                                    <p className="mt-3 text-[10.5px] font-normal leading-[16px] text-slate-600">
                                      {review.text}
                                    </p>
                                  ) : (
                                    <p className="mt-3 text-[10.5px] font-normal text-slate-400">
                                      No review text available.
                                    </p>
                                  )}

                                  {review.googleMapsUri ? (
                                    <a
                                      href={
                                        review.googleMapsUri
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-3 inline-flex items-center gap-1 text-[9.5px] font-medium text-indigo-600 hover:text-indigo-800"
                                    >
                                      View on Google
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : null}
                                </article>
                              ),
                            )}
                          </div>
                        ) : (
                          <div className="rounded-[13px] bg-slate-50 px-4 py-6 text-center text-[11px] font-normal text-slate-500">
                            No review snippets were returned for this organization.
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
