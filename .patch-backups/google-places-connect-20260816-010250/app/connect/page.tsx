"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BadgeCheck,
  Building2,
  ExternalLink,
  Globe2,
  Loader2,
  MapPinned,
  Search,
  ShieldCheck,
} from "lucide-react";

import type {
  ConnectMapOrganization,
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
        <div className="flex min-h-[520px] items-center justify-center rounded-[24px] bg-slate-100">
          <div className="flex items-center gap-2 text-sm font-black text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Preparing organization map
          </div>
        </div>
      ),
    },
  );

type Organization =
  ConnectMapOrganization & {
    entityType: string;
    subsectors: string[];
    tags: string[];
    description?: string | null;
    coverage?: string | null;
    verificationStatus: string;
    sources: Array<{
      provider: string;
      sourceUrl?: string | null;
      confidence: string;
    }>;
  };

type Facet = {
  name: string;
  count: number;
};

type Payload = {
  ok: boolean;
  directorySize?: number;
  totalMatches?: number;
  organizations?: Organization[];
  facets?: {
    sectors?: Facet[];
    subsectors?: Facet[];
    services?: Facet[];
    countries?: Facet[];
    sourceTypes?: Facet[];
  };
  sourcePolicy?: string;
  error?: string;
};

const SECTOR_OPTIONS = [
  {
    value: "",
    label: "All organizations",
  },
  {
    value: "agriculture",
    label: "Agriculture",
  },
  {
    value: "macro-finance",
    label: "Macro & Finance",
  },
  {
    value: "ngo-development",
    label: "NGO & Development",
  },
  {
    value: "energy",
    label: "Energy",
  },
  {
    value: "professional-services",
    label: "Professional Services",
  },
  {
    value: "corporate",
    label: "Corporate",
  },
] as const;

function titleCase(
  value: string,
) {
  return value
    .replace(
      /[-_]+/g,
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

export default function ConnectPage() {
  const [
    sector,
    setSector,
  ] = useState("");
  const [
    q,
    setQ,
  ] = useState("");
  const [
    country,
    setCountry,
  ] = useState("");
  const [
    service,
    setService,
  ] = useState("");
  const [
    payload,
    setPayload,
  ] =
    useState<Payload | null>(
      null,
    );
  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    let alive = true;

    const timer =
      window.setTimeout(
        () => {
          const params =
            new URLSearchParams();

          if (sector) {
            params.set(
              "sector",
              sector,
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

          if (country) {
            params.set(
              "country",
              country,
            );
          }

          if (service) {
            params.set(
              "service",
              service,
            );
          }

          params.set(
            "limit",
            "200",
          );

          setLoading(true);

          fetch(
            `/api/organizations?${params.toString()}`,
            {
              cache:
                "no-store",
            },
          )
            .then(
              async (
                response,
              ) => {
                const json =
                  (await response.json()) as Payload;

                if (
                  !response.ok ||
                  !json.ok
                ) {
                  throw new Error(
                    json.error ||
                      "Unable to load organizations.",
                  );
                }

                return json;
              },
            )
            .then(
              (
                json,
              ) => {
                if (alive) {
                  setPayload(
                    json,
                  );
                }
              },
            )
            .catch(
              (
                error,
              ) => {
                if (alive) {
                  setPayload({
                    ok: false,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Unable to load organizations.",
                    organizations: [],
                  });
                }
              },
            )
            .finally(
              () => {
                if (alive) {
                  setLoading(
                    false,
                  );
                }
              },
            );
        },
        180,
      );

    return () => {
      alive = false;
      window.clearTimeout(
        timer,
      );
    };
  }, [
    sector,
    q,
    country,
    service,
  ]);

  const organizations =
    payload?.organizations ??
    [];

  const countries =
    payload?.facets
      ?.countries ??
    [];

  const services =
    payload?.facets
      ?.services ??
    [];

  const verifiedCount =
    useMemo(
      () =>
        organizations.filter(
          (
            organization,
          ) =>
            organization.verified,
        ).length,
      [organizations],
    );

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
                Global Organization Network
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                One commercial and institutional directory for agriculture, finance, NGOs, energy, professional services and corporate intelligence.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                <div className="text-lg font-black text-slate-950">
                  {
                    payload
                      ?.directorySize ??
                    0
                  }
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                  Directory
                </div>
              </div>

              <div className="rounded-xl bg-indigo-50 px-3 py-2 text-center">
                <div className="text-lg font-black text-indigo-800">
                  {
                    payload
                      ?.totalMatches ??
                    0
                  }
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-indigo-500">
                  Matches
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center">
                <div className="text-lg font-black text-emerald-800">
                  {
                    verifiedCount
                  }
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-emerald-600">
                  Verified
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-[1.05fr_1.4fr_1fr_1fr]">
            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Sector
              </span>

              <select
                value={
                  sector
                }
                onChange={(
                  event,
                ) => {
                  setSector(
                    event.target.value,
                  );
                  setCountry(
                    "",
                  );
                  setService(
                    "",
                  );
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
              >
                {SECTOR_OPTIONS.map(
                  (
                    option,
                  ) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Search organizations
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
                  placeholder="Name, service, crop, NGO, bank, consultant..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none"
                />
              </div>
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Country
              </span>

              <select
                value={
                  country
                }
                onChange={(
                  event,
                ) =>
                  setCountry(
                    event.target.value,
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
              >
                <option value="">
                  All countries
                </option>

                {countries
                  .slice(
                    0,
                    120,
                  )
                  .map(
                    (
                      item,
                    ) => (
                      <option
                        key={
                          item.name
                        }
                        value={
                          item.name
                        }
                      >
                        {
                          item.name
                        }{" "}
                        ({
                          item.count
                        })
                      </option>
                    ),
                  )}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Service
              </span>

              <select
                value={
                  service
                }
                onChange={(
                  event,
                ) =>
                  setService(
                    event.target.value,
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
              >
                <option value="">
                  All services
                </option>

                {services
                  .slice(
                    0,
                    80,
                  )
                  .map(
                    (
                      item,
                    ) => (
                      <option
                        key={
                          item.name
                        }
                        value={
                          item.name
                        }
                      >
                        {titleCase(
                          item.name,
                        )}{" "}
                        ({
                          item.count
                        })
                      </option>
                    ),
                  )}
              </select>
            </label>
          </div>
        </section>

        {payload?.error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {
              payload.error
            }
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm">
            <OrganizationMap
              organizations={
                organizations
              }
            />
          </div>

          <aside className="flex h-[620px] max-h-[calc(100vh-130px)] min-h-[520px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-100 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />

                    <h2 className="text-lg font-black text-slate-950">
                      Organizations
                    </h2>
                  </div>

                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Showing{" "}
                    {
                      organizations.length
                    }{" "}
                    of{" "}
                    {
                      payload
                        ?.totalMatches ??
                      0
                    }{" "}
                    matches
                  </div>
                </div>

                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                ) : (
                  <MapPinned className="h-5 w-5 text-slate-300" />
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {organizations.length ? (
                organizations.map(
                  (
                    organization,
                  ) => (
                    <article
                      key={
                        organization.id
                      }
                      className="border-b border-slate-100 px-4 py-4 last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-700">
                          {
                            organization.name
                              .charAt(
                                0,
                              )
                              .toUpperCase()
                          }
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="truncate text-sm font-black text-slate-950">
                              {
                                organization.name
                              }
                            </h3>

                            {organization.verified ? (
                              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : null}
                          </div>

                          <div className="mt-0.5 truncate text-[10px] font-bold text-slate-400">
                            {
                              organization.city
                            }
                            {organization.city &&
                            organization.country
                              ? ", "
                              : ""}
                            {
                              organization.country
                            }
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1">
                            {organization.services
                              .slice(
                                0,
                                4,
                              )
                              .map(
                                (
                                  item,
                                ) => (
                                  <span
                                    key={
                                      item
                                    }
                                    className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600"
                                  >
                                    {titleCase(
                                      item,
                                    )}
                                  </span>
                                ),
                              )}
                          </div>

                          {organization.description ? (
                            <p className="mt-2 line-clamp-3 text-xs font-medium leading-5 text-slate-600">
                              {
                                organization.description
                              }
                            </p>
                          ) : null}

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {
                                organization.verificationStatus
                              }
                            </div>

                            {organization.website ? (
                              <a
                                href={
                                  organization.website
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[10px] font-black !text-white"
                              >
                                Website
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  ),
                )
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-slate-500">
                  No organizations match the current filters. External source ingestion can populate this sector without changing the UI.
                </div>
              )}
            </div>
          </aside>
        </section>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-semibold leading-5 text-slate-500 shadow-sm">
          {payload?.sourcePolicy ||
            "Stratify Connect keeps verified, source-linked and discovered records visibly distinct."}
        </div>
      </div>
    </main>
  );
}
