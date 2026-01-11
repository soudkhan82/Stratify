"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* =======================
   Types
======================= */

type FaoModule =
  | ""
  | "overview"
  | "top-production"
  | "top-import"
  | "top-export";

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

type OverviewPayload = {
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

type TopItem = { item: string; value: number; unit: string | null };

type TopPayload = {
  iso3: string;
  country: string;
  latest_year: number | null;
  kind?: string;
  items: TopItem[];
  error?: string;
};

/* =======================
   Helpers
======================= */

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
  if (!isRecord(raw)) {
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

async function fetchJsonOrThrow(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${res.statusText}${
        text ? ` — ${text.slice(0, 300)}` : ""
      }`
    );
  }

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

function titleForFaoModule(m: FaoModule): string {
  switch (m) {
    case "overview":
      return "FAOSTAT Overview";
    case "top-production":
      return "Top Production Items";
    case "top-import":
      return "Top Import Items";
    case "top-export":
      return "Top Export Items";
    default:
      return "FAOSTAT";
  }
}

/* =======================
   Page
======================= */

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

  // ✅ Only FAOSTAT states we need:
  const [faoModule, setFaoModule] = useState<FaoModule>("");
  const [faoLoading, setFaoLoading] = useState(false);
  const [faoError, setFaoError] = useState<string | null>(null);
  const [faoOverview, setFaoOverview] = useState<OverviewPayload | null>(null);
  const [faoTop, setFaoTop] = useState<TopPayload | null>(null);

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

  /* ================
     WDI fetch
  ================ */
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
        if (!parsed.error && parsed.series.length === 0) {
          setWdi({
            ...parsed,
            error:
              "No WDI rows returned. (API succeeded, but dataset is empty for this iso3/indicator.)",
          });
        } else {
          setWdi(parsed);
        }
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

  /* ================
     FAOSTAT fetch (module-based)
  ================ */
  useEffect(() => {
    if (tab !== "faostat") return;
    if (!faoModule) return;

    let alive = true;

    async function run() {
      setFaoLoading(true);
      setFaoError(null);

      // clear previous module payloads (keeps UI clean)
      setFaoOverview(null);
      setFaoTop(null);

      try {
        if (faoModule === "overview") {
          const raw = await fetchJsonOrThrow(
            `/api/faostat/overview?iso3=${encodeURIComponent(iso3)}`
          );
          if (!alive) return;

          if (!isRecord(raw)) {
            throw new Error(
              "Invalid FAOSTAT Overview response (not an object)."
            );
          }
          if (typeof raw.error === "string" && raw.error.trim()) {
            setFaoError(raw.error);
            return;
          }

          // minimal normalization
          setFaoOverview({
            iso3: asString(raw.iso3, iso3),
            country: asString(raw.country, iso3),
            latest_year: (asNumber(raw.latest_year) as number | null) ?? null,

            production_qty:
              (asNumber(raw.production_qty) as number | null) ?? null,
            production_unit: asNullableString(raw.production_unit),

            import_qty: (asNumber(raw.import_qty) as number | null) ?? null,
            import_unit: asNullableString(raw.import_unit),

            export_qty: (asNumber(raw.export_qty) as number | null) ?? null,
            export_unit: asNullableString(raw.export_unit),

            kcal_per_capita_day:
              (asNumber(raw.kcal_per_capita_day) as number | null) ?? null,
            protein_g_per_capita_day:
              (asNumber(raw.protein_g_per_capita_day) as number | null) ?? null,
            fat_g_per_capita_day:
              (asNumber(raw.fat_g_per_capita_day) as number | null) ?? null,
          });
        } else {
          const raw = await fetchJsonOrThrow(
            `/api/faostat/module?iso3=${encodeURIComponent(
              iso3
            )}&kind=${encodeURIComponent(faoModule)}&top=10`
          );
          if (!alive) return;

          if (!isRecord(raw)) {
            throw new Error("Invalid FAOSTAT module response (not an object).");
          }
          if (typeof raw.error === "string" && raw.error.trim()) {
            setFaoError(raw.error);
            return;
          }

          const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
          const items: TopItem[] = itemsRaw
            .map((r): TopItem | null => {
              if (!isRecord(r)) return null;
              const item = asString(r.item, "");
              const value = asNumber(r.value);
              if (!item || value === null) return null;
              return { item, value, unit: asNullableString(r.unit) };
            })
            .filter((x): x is TopItem => x !== null);

          setFaoTop({
            iso3: asString(raw.iso3, iso3),
            country: asString(raw.country, iso3),
            latest_year: (asNumber(raw.latest_year) as number | null) ?? null,
            kind: asNullableString(raw.kind) ?? undefined,
            items,
          });
        }
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setFaoError(msg);
      } finally {
        if (alive) setFaoLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [tab, faoModule, iso3]);

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
          <TabsContent value="faostat" className="space-y-3">
            {/* Module buttons */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              {(
                [
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
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setFaoModule(m.key)}
                  className={[
                    "text-left rounded-xl border p-4 transition",
                    faoModule === m.key
                      ? "bg-slate-900 text-white border-slate-900"
                      : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div
                    className={[
                      "mt-1 text-xs",
                      faoModule === m.key ? "text-white/70" : "text-slate-500",
                    ].join(" ")}
                  >
                    {m.desc}
                  </div>
                </button>
              ))}
            </div>

            {!faoModule ? (
              <div className="text-sm text-slate-500">
                Select a module above to load FAOSTAT insights (prevents
                timeouts).
              </div>
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    {titleForFaoModule(faoModule)}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-0">
                  {faoLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : faoError ? (
                    <div className="text-sm text-rose-600">{faoError}</div>
                  ) : faoModule === "overview" ? (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-slate-500">
                          Latest year
                        </div>
                        <div className="mt-1 text-2xl font-bold text-slate-900">
                          {faoOverview?.latest_year ?? "—"}
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
                              {fmt(faoOverview?.production_qty ?? null)}{" "}
                              <span className="text-xs font-normal text-slate-500">
                                {faoOverview?.production_unit ?? ""}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Imports</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(faoOverview?.import_qty ?? null)}{" "}
                              <span className="text-xs font-normal text-slate-500">
                                {faoOverview?.import_unit ?? ""}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Exports</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(faoOverview?.export_qty ?? null)}{" "}
                              <span className="text-xs font-normal text-slate-500">
                                {faoOverview?.export_unit ?? ""}
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
                              {fmt(faoOverview?.kcal_per_capita_day ?? null)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Protein (g)</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(
                                faoOverview?.protein_g_per_capita_day ?? null
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Fat (g)</span>
                            <span className="font-semibold text-slate-900">
                              {fmt(faoOverview?.fat_g_per_capita_day ?? null)}
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
                          {(faoTop?.items ?? []).map((r) => (
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
                          {(faoTop?.items?.length ?? 0) === 0 && (
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
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
