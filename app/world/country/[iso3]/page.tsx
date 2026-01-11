"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type WdiPoint = { year: number; value: number; unit?: string | null };
type WdiResponse = {
  iso3: string;
  country: string;
  region: string | null;
  indicator: { code: string; label: string; unit: string | null };
  latest: WdiPoint | null;
  series: WdiPoint[];
  error?: string;
};

type FaostatTopRow = {
  item: string;
  value: number;
  unit: string | null;
};

type FaostatProfile = {
  iso3: string;
  country: string;

  latest_year: number | null;

  production_total: number | null;
  production_unit: string | null;

  import_total: number | null;
  import_unit: string | null;

  export_total: number | null;
  export_unit: string | null;

  top_production_items: FaostatTopRow[];
  top_import_items: FaostatTopRow[];
  top_export_items: FaostatTopRow[];

  notes?: string | null;
  error?: string;
};

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function qsSet(
  routerReplace: (url: string) => void,
  iso3: string,
  code: string
) {
  routerReplace(`/world/country/${iso3}?indicator=${encodeURIComponent(code)}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function parseWdiResponse(
  raw: unknown,
  iso3: string,
  indicator: string
): WdiResponse {
  // Accept either correct shape OR { error: string } from API
  if (isRecord(raw)) {
    const maybeErr = raw.error;
    if (typeof maybeErr === "string" && maybeErr.trim()) {
      return {
        iso3,
        country: iso3,
        region: null,
        indicator: { code: indicator, label: indicator, unit: null },
        latest: null,
        series: [],
        error: maybeErr,
      };
    }

    // If it's already the right structure, normalize lightly
    const country = asString(raw.country, iso3);
    const region = asNullableString(raw.region);

    const ind = isRecord(raw.indicator) ? raw.indicator : {};
    const code = asString(ind.code, indicator);
    const label = asString(ind.label, indicator);
    const unit = (typeof ind.unit === "string" ? ind.unit : null) as
      | string
      | null;

    const latestRaw = isRecord(raw.latest) ? raw.latest : null;
    const latest: WdiPoint | null =
      latestRaw &&
      asNumber(latestRaw.year) !== null &&
      asNumber(latestRaw.value) !== null
        ? {
            year: asNumber(latestRaw.year)!,
            value: asNumber(latestRaw.value)!,
            unit: typeof latestRaw.unit === "string" ? latestRaw.unit : null,
          }
        : null;
    const seriesRaw = Array.isArray(raw.series) ? raw.series : [];

    const series = seriesRaw
      .map((r): WdiPoint | null => {
        if (!isRecord(r)) return null;

        const y = asNumber(r.year);
        const v = asNumber(r.value);
        if (y === null || v === null) return null;

        return {
          year: y,
          value: v,
          unit: typeof r.unit === "string" ? r.unit : null,
        };
      })
      .filter((x): x is WdiPoint => x !== null);

    return {
      iso3,
      country,
      region,
      indicator: { code, label, unit },
      latest,
      series,
    };
  }

  return {
    iso3,
    country: iso3,
    region: null,
    indicator: { code: indicator, label: indicator, unit: null },
    latest: null,
    series: [],
    error: "Invalid WDI API response (not an object).",
  };
}

async function fetchJsonOrThrow(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });

  // If route is missing or server threw, surface real text
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${res.statusText}${
        text ? ` — ${text.slice(0, 300)}` : ""
      }`
    );
  }

  // Sometimes Next returns HTML error pages even with 200 (rare), guard it
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Expected JSON but got "${ct || "unknown"}"${
        text ? ` — ${text.slice(0, 200)}` : ""
      }`
    );
  }

  return res.json();
}

export default function CountryProfilePage({
  params,
}: {
  params: { iso3: string };
}) {
  const router = useRouter();
  const search = useSearchParams();

  const iso3 = String(params.iso3 || "").toUpperCase();
  const indicator = (search.get("indicator") || "SP.POP.TOTL").trim();

  const [tab, setTab] = useState<"wdi" | "faostat">("wdi");

  const [wdi, setWdi] = useState<WdiResponse | null>(null);
  const [wdiLoading, setWdiLoading] = useState(false);

  const [fao, setFao] = useState<FaostatProfile | null>(null);
  const [faoLoading, setFaoLoading] = useState(false);

  const quickPicks = useMemo(
    () => [
      { label: "Population", code: "SP.POP.TOTL" },
      { label: "GDP (current US$)", code: "NY.GDP.MKTP.CD" },
      { label: "Population density", code: "EN.POP.DNST" },
      { label: "Life expectancy", code: "SP.DYN.LE00.IN" },
      { label: "Unemployment (%)", code: "SL.UEM.TOTL.ZS" },
    ],
    []
  );

  // ✅ Fetch WDI (DB-backed route) with real error reporting
  useEffect(() => {
    let alive = true;

    async function run() {
      setWdiLoading(true);

      try {
        const url = `/api/wdi/country?iso3=${encodeURIComponent(
          iso3
        )}&indicator=${encodeURIComponent(indicator)}`;

        const raw = await fetchJsonOrThrow(url);

        if (!alive) return;

        const parsed = parseWdiResponse(raw, iso3, indicator);

        // If API returned empty series but no error, show a clearer message
        if (!parsed.error && parsed.series.length === 0) {
          setWdi({
            ...parsed,
            error:
              "No WDI rows returned. (API succeeded, but dataset is empty for this iso3/indicator.)",
          });
          return;
        }

        setWdi(parsed);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setWdi({
          iso3,
          country: iso3,
          region: null,
          indicator: { code: indicator, label: indicator, unit: null },
          latest: null,
          series: [],
          error: `Failed to load WDI: ${msg}`,
        });
      } finally {
        if (alive) setWdiLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [iso3, indicator]);

  // Fetch FAOSTAT when tab opened (lazy)
  useEffect(() => {
    if (tab !== "faostat") return;
    let alive = true;

    async function run() {
      setFaoLoading(true);
      try {
        const res = await fetch(
          `/api/faostat/country?iso3=${encodeURIComponent(iso3)}`,
          {
            cache: "no-store",
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `HTTP ${res.status} ${res.statusText}${
              text ? ` — ${text.slice(0, 200)}` : ""
            }`
          );
        }

        const json = (await res.json()) as FaostatProfile;
        if (!alive) return;
        setFao(json);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setFao({
          iso3,
          country: iso3,
          latest_year: null,
          production_total: null,
          production_unit: null,
          import_total: null,
          import_unit: null,
          export_total: null,
          export_unit: null,
          top_production_items: [],
          top_import_items: [],
          top_export_items: [],
          error: `Failed to load FAOSTAT: ${msg}`,
        });
      } finally {
        if (alive) setFaoLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [tab, iso3]);

  const countryTitle = wdi?.country ? `${wdi.country} (${iso3})` : iso3;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="h-9"
            >
              ← Back
            </Button>

            <div className="min-w-0">
              <div className="text-[12px] uppercase tracking-wider text-slate-500">
                Country Profile
              </div>
              <h1 className="truncate text-2xl font-bold text-slate-900">
                {countryTitle}
              </h1>

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border px-2 py-1 text-slate-600">
                  Region: {wdi?.region ?? "—"}
                </span>
                <span className="rounded-full border px-2 py-1 text-slate-600">
                  Indicator: {wdi?.indicator?.label ?? indicator}
                </span>
                <span className="rounded-full border px-2 py-1 text-slate-600">
                  Code: {wdi?.indicator?.code ?? indicator}
                </span>
                <span className="rounded-full border px-2 py-1 text-slate-600">
                  Unit: {wdi?.indicator?.unit ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "wdi" | "faostat")}>
          <TabsList className="mb-3">
            <TabsTrigger value="wdi">WDI</TabsTrigger>
            <TabsTrigger value="faostat">FAOSTAT</TabsTrigger>
          </TabsList>

          {/* WDI TAB */}
          <TabsContent value="wdi" className="space-y-3">
            <Card className="shadow-sm">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold text-slate-800">
                  Quick indicator picks
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {quickPicks.map((p) => {
                    const active =
                      (wdi?.indicator?.code ?? indicator) === p.code;
                    return (
                      <button
                        key={p.code}
                        onClick={() => qsSet(router.replace, iso3, p.code)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          active
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Card className="shadow-sm lg:col-span-1">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Latest value
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {wdiLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : wdi?.error ? (
                    <div className="text-sm text-rose-600">{wdi.error}</div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-slate-900 leading-tight">
                        {fmt(wdi?.latest?.value ?? null)}
                        <span className="ml-2 text-sm font-medium text-slate-500">
                          {wdi?.latest?.unit ?? wdi?.indicator?.unit ?? ""}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Year: {wdi?.latest?.year ?? "—"}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm lg:col-span-2">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Last 25 years
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="max-h-[280px] overflow-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                            Year
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(wdi?.series ?? []).slice(-25).map((r) => (
                          <tr key={r.year} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {r.year}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {fmt(r.value)}{" "}
                              <span className="text-xs text-slate-500">
                                {r.unit ?? wdi?.indicator?.unit ?? ""}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!wdiLoading && (wdi?.series?.length ?? 0) === 0 && (
                          <tr>
                            <td
                              className="px-3 py-6 text-sm text-slate-500"
                              colSpan={2}
                            >
                              No data.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* FAOSTAT TAB */}
          {/* FAOSTAT TAB */}
          <TabsContent value="faostat" className="space-y-3">
            {/* FAOSTAT Modules (click-to-load) */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              {[
                {
                  key: "overview",
                  label: "Overview (SUA)",
                  desc: "Latest year + headline + nutrition",
                },
                {
                  key: "top-production",
                  label: "Top Production",
                  desc: "Top produced items (Production table)",
                },
                {
                  key: "top-import",
                  label: "Top Imports",
                  desc: "Top import items (SUA)",
                },
                {
                  key: "top-export",
                  label: "Top Exports",
                  desc: "Top export items (SUA)",
                },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => {
                    setFao(
                      (prev) =>
                        ({ ...(prev ?? ({} as any)), __module: m.key } as any)
                    );
                  }}
                  className="text-left rounded-xl border p-4 hover:bg-slate-50 transition"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {m.label}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{m.desc}</div>
                </button>
              ))}
            </div>

            {(() => {
              type Overview = {
                iso3: string;
                country: string;
                latest_year: number | null;

                production_qty: number | null;
                production_unit: string | null;

                import_qty: number | null;
                import_unit: string | null;

                export_qty: number | null;
                export_unit: string | null;

                kcal_per_capita_day: number | null;
                protein_g_per_capita_day: number | null;
                fat_g_per_capita_day: number | null;

                error?: string;
              };

              type TopPayload = {
                iso3: string;
                country: string;
                latest_year: number | null;
                kind?: string;
                items: { item: string; value: number; unit: string | null }[];
                error?: string;
              };

              const module = ((fao as any)?.__module ?? "") as
                | ""
                | "overview"
                | "top-production"
                | "top-import"
                | "top-export";

              const [overview, setOverview] = useState<Overview | null>(null);
              const [top, setTop] = useState<TopPayload | null>(null);
              const [loading, setLoading] = useState(false);

              useEffect(() => {
                if (!module) return;
                let alive = true;

                async function run() {
                  setLoading(true);
                  try {
                    if (module === "overview") {
                      const res = await fetch(
                        `/api/faostat/overview?iso3=${encodeURIComponent(
                          iso3
                        )}`,
                        {
                          cache: "no-store",
                        }
                      );
                      const json = (await res.json()) as Overview;
                      if (!alive) return;
                      setOverview(json);
                      setTop(null);
                    } else {
                      const res = await fetch(
                        `/api/faostat/module?iso3=${encodeURIComponent(
                          iso3
                        )}&kind=${encodeURIComponent(module)}&top=10`,
                        { cache: "no-store" }
                      );
                      const json = (await res.json()) as TopPayload;
                      if (!alive) return;
                      setTop(json);
                      setOverview(null);
                    }
                  } catch (e) {
                    const msg =
                      e instanceof Error
                        ? e.message
                        : "Failed to load FAOSTAT module.";
                    if (!alive) return;
                    if (module === "overview")
                      setOverview({
                        iso3,
                        country: iso3,
                        latest_year: null,
                        production_qty: null,
                        production_unit: null,
                        import_qty: null,
                        import_unit: null,
                        export_qty: null,
                        export_unit: null,
                        kcal_per_capita_day: null,
                        protein_g_per_capita_day: null,
                        fat_g_per_capita_day: null,
                        error: msg,
                      });
                    else
                      setTop({
                        iso3,
                        country: iso3,
                        latest_year: null,
                        items: [],
                        error: msg,
                      });
                  } finally {
                    if (alive) setLoading(false);
                  }
                }

                run();
                return () => {
                  alive = false;
                };
              }, [module, iso3]);

              if (!module) {
                return (
                  <div className="text-sm text-slate-500">
                    Select a module above to load FAOSTAT insights (prevents
                    timeouts).
                  </div>
                );
              }

              return (
                <Card className="shadow-sm">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold text-slate-800">
                      {module === "overview"
                        ? "FAOSTAT Overview"
                        : module === "top-production"
                        ? "Top Production Items"
                        : module === "top-import"
                        ? "Top Import Items"
                        : "Top Export Items"}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {loading ? (
                      <div className="text-sm text-slate-500">Loading…</div>
                    ) : (overview as any)?.error || (top as any)?.error ? (
                      <div className="text-sm text-rose-600">
                        {(overview as any)?.error ?? (top as any)?.error}
                      </div>
                    ) : module === "overview" ? (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-slate-500">
                            Latest year
                          </div>
                          <div className="mt-1 text-2xl font-bold text-slate-900">
                            {overview?.latest_year ?? "—"}
                          </div>
                        </div>

                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-slate-500">
                            Quantities (headline)
                          </div>
                          <div className="mt-2 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Production</span>
                              <span className="font-semibold text-slate-900">
                                {fmt(overview?.production_qty ?? null)}{" "}
                                <span className="text-xs font-normal text-slate-500">
                                  {overview?.production_unit ?? ""}
                                </span>
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Imports</span>
                              <span className="font-semibold text-slate-900">
                                {fmt(overview?.import_qty ?? null)}{" "}
                                <span className="text-xs font-normal text-slate-500">
                                  {overview?.import_unit ?? ""}
                                </span>
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Exports</span>
                              <span className="font-semibold text-slate-900">
                                {fmt(overview?.export_qty ?? null)}{" "}
                                <span className="text-xs font-normal text-slate-500">
                                  {overview?.export_unit ?? ""}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-slate-500">
                            Nutrition (per capita/day)
                          </div>
                          <div className="mt-2 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Calories</span>
                              <span className="font-semibold text-slate-900">
                                {fmt(overview?.kcal_per_capita_day ?? null)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">
                                Protein (g)
                              </span>
                              <span className="font-semibold text-slate-900">
                                {fmt(
                                  overview?.protein_g_per_capita_day ?? null
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Fat (g)</span>
                              <span className="font-semibold text-slate-900">
                                {fmt(overview?.fat_g_per_capita_day ?? null)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-[360px] overflow-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                                Item
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                                Value
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(top?.items ?? []).map((r) => (
                              <tr
                                key={r.item}
                                className="border-b last:border-b-0"
                              >
                                <td className="px-3 py-2 text-slate-800">
                                  {r.item}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                  {fmt(r.value)}{" "}
                                  <span className="text-xs font-normal text-slate-500">
                                    {r.unit ?? ""}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {(top?.items?.length ?? 0) === 0 && (
                              <tr>
                                <td
                                  className="px-3 py-6 text-sm text-slate-500"
                                  colSpan={2}
                                >
                                  No rows found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
