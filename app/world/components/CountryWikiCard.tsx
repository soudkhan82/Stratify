"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  Globe2,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type WikiFact = {
  group?: string | null;
  label?: string | null;
  value?: string | null;
};

type WikiSection = {
  title?: string;
  paragraphs?: string[];
};

type EconomyPayload = {
  ok?: boolean;
  title?: string;
  displayTitle?: string;
  description?: string;
  extract?: string;
  pageUrl?: string | null;
  thumbnailUrl?: string | null;
  facts?: WikiFact[];
  highlights?: WikiFact[];
  sections?: WikiSection[];
  error?: string;
};

type WikiPayload = {
  ok?: boolean;
  iso3?: string;
  country?: string;
  title?: string;
  displayTitle?: string;
  description?: string;
  extract?: string;
  pageUrl?: string | null;
  thumbnailUrl?: string | null;
  facts?: WikiFact[];
  highlights?: WikiFact[];
  demographics?: {
    title?: string;
    paragraphs?: string[];
  } | null;
  economics?: EconomyPayload | null;
  source?: string;
  license?: string;
  fetchedAt?: string;
  error?: string;
};

type Props = {
  iso3: string;
  countryName?: string | null;
  region?: string | null;
};

type TabKey = "profile" | "economy" | "external";

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(value: unknown, limit = 520) {
  const text = cleanText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

function normalizeFacts(facts: WikiFact[] | undefined | null): WikiFact[] {
  return (facts || [])
    .map((fact) => ({
      group: cleanText(fact.group || "General") || "General",
      label: cleanText(fact.label),
      value: cleanText(fact.value),
    }))
    .filter((fact) => fact.label && fact.value);
}

function keyOf(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function labelKey(fact: WikiFact) {
  return keyOf(fact.label);
}

function groupKey(fact: WikiFact) {
  return keyOf(fact.group);
}

function formatFetchedAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function splitFactValue(value: unknown) {
  return cleanText(value)
    .split(/\s+\|\s+/)
    .map(cleanText)
    .filter(Boolean);
}

function classifyEconomyGroup(title: unknown, value: unknown): string {
  const haystack = `${cleanText(title)} ${cleanText(value)}`.toLowerCase();

  if (
    /export|import|trade|foreign investment|investment|fdi|current account|balance of payments|external debt|remittance|partner|port|shipping|logistics|commodity|customs|tariff/.test(
      haystack,
    )
  ) {
    return "External";
  }

  if (
    /public finance|government debt|debt|budget|fiscal|tax|revenue|spending|expenditure|reserves|credit rating|aid|subsidy|deficit|surplus|treasury|sovereign/.test(
      haystack,
    )
  ) {
    return "Public finance";
  }

  return "Business structure";
}

function makeFactsFromSections(sections?: WikiSection[] | null) {
  return (sections || [])
    .map((section) => {
      const title = cleanText(section.title);
      const value = (section.paragraphs || [])
        .map(cleanText)
        .filter(Boolean)
        .slice(0, 3)
        .join(" | ");

      if (!title || !value) return null;

      return {
        group: classifyEconomyGroup(title, value),
        label: title,
        value,
      };
    })
    .filter(Boolean) as WikiFact[];
}

function makeExtractFact(extract?: string | null) {
  const value = cleanText(extract);

  if (!value) return [];

  return [
    {
      group: "Business structure",
      label: "Economic overview",
      value,
    },
  ] as WikiFact[];
}

function dedupeFacts(facts: WikiFact[]) {
  const seen = new Set<string>();
  const output: WikiFact[] = [];

  for (const fact of facts) {
    const group = cleanText(fact.group || "General");
    const label = cleanText(fact.label);
    const value = cleanText(fact.value);

    if (!label || !value) continue;

    const key = `${keyOf(group)}|${keyOf(label)}|${keyOf(value).slice(0, 120)}`;

    if (seen.has(key)) continue;

    seen.add(key);
    output.push({ group, label, value });
  }

  return output;
}

function groupFacts(facts: WikiFact[]) {
  const map = new Map<string, WikiFact[]>();

  for (const fact of facts) {
    const group = cleanText(fact.group || "General") || "General";
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(fact);
  }

  return Array.from(map.entries()).map(([group, rows]) => ({ group, rows }));
}

function findFact(facts: WikiFact[], keys: string[]) {
  const exact = facts.find((fact) => {
    const label = labelKey(fact);
    return keys.some((key) => label === key);
  });

  if (exact) return exact;

  return facts.find((fact) => {
    const label = labelKey(fact);
    return keys.some((key) => label.includes(key));
  });
}

function InfoCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: unknown;
  tone?: "slate" | "emerald" | "indigo" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/40"
      : tone === "indigo"
        ? "border-indigo-200 bg-indigo-50/40"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50/50"
          : "border-slate-200 bg-white";

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-black leading-6 text-slate-950">
        {shortText(value, 240)}
      </div>
    </div>
  );
}

function FactGrid({ facts, max = 9 }: { facts: WikiFact[]; max?: number }) {
  if (!facts.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {facts.slice(0, max).map((fact, index) => (
        <InfoCard
          key={`${fact.label}-${index}`}
          label={cleanText(fact.label)}
          value={cleanText(fact.value)}
        />
      ))}
    </div>
  );
}

function SplitValueCard({
  fact,
  tone = "slate",
}: {
  fact: WikiFact;
  tone?: "slate" | "emerald" | "indigo" | "amber";
}) {
  const lines = splitFactValue(fact.value);
  const rowTone =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-950"
      : tone === "indigo"
        ? "bg-indigo-50 text-indigo-950"
        : tone === "amber"
          ? "bg-amber-50 text-amber-950"
          : "bg-slate-50 text-slate-800";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {cleanText(fact.label)}
      </div>

      {lines.length > 1 ? (
        <div className="mt-2 space-y-1.5">
          {lines.map((line, index) => (
            <div
              key={`${fact.label}-${index}`}
              className={`rounded-xl px-3 py-2 text-xs font-bold leading-5 ${rowTone}`}
            >
              {line}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-sm font-bold leading-6 text-slate-800">
          {cleanText(fact.value)}
        </div>
      )}
    </div>
  );
}

function FactsTable({
  groups,
}: {
  groups: { group: string; rows: WikiFact[] }[];
}) {
  if (!groups.length) return null;

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section
          key={group.group}
          className="rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4"
        >
          <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
            {group.group}
          </h4>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {group.rows.map((fact, index) => (
                  <tr
                    key={`${group.group}-${fact.label}-${index}`}
                    className="border-t first:border-t-0"
                  >
                    <td className="w-[34%] bg-slate-50 px-3 py-2.5 align-top text-xs font-black uppercase tracking-wide text-slate-500">
                      {fact.label}
                    </td>
                    <td className="px-3 py-2.5 align-top text-sm font-semibold leading-6 text-slate-800">
                      {fact.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function CountryProfileTab({
  payload,
  countryHighlights,
  demographicsParagraphs,
}: {
  payload: WikiPayload;
  countryHighlights: WikiFact[];
  demographicsParagraphs: string[];
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">
          <Sparkles className="h-3.5 w-3.5" />
          Country overview
        </div>
        <p className="text-sm font-medium leading-7 text-slate-700">
          {cleanText(payload.extract)}
        </p>
      </section>

      {countryHighlights.length ? (
        <section>
          <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-900">
            Country facts
          </div>
          <FactGrid facts={countryHighlights} />
        </section>
      ) : null}

      {demographicsParagraphs.length ? (
        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
            Demographics
          </h4>
          <div className="mt-2 space-y-3">
            {demographicsParagraphs.map((paragraph, index) => (
              <p key={index} className="text-sm font-medium leading-7 text-slate-600">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EconomyOverviewTab({
  facts,
  extract,
}: {
  facts: WikiFact[];
  extract?: string;
}) {
  const extractText = cleanText(extract);

  const coreCards = [
    findFact(facts, ["population"]),
    findFact(facts, ["gdp"]),
    findFact(facts, ["gdp rank"]),
    findFact(facts, ["gdp growth"]),
    findFact(facts, ["gdp per capita"]),
    findFact(facts, ["currency"]),
    findFact(facts, ["inflation", "inflation cpi"]),
    findFact(facts, ["unemployment"]),
    findFact(facts, ["labour force", "labor force"]),
  ].filter(Boolean) as WikiFact[];

  const cards = coreCards.length ? coreCards : facts.slice(0, 9);

  return (
    <div className="space-y-4">
      {extractText ? (
        <section className="rounded-[22px] border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            Economy overview
          </div>
          <p className="text-sm font-medium leading-7 text-slate-700">
            {extractText}
          </p>
        </section>
      ) : null}

      <section>
        <div className="mb-2 text-sm font-black uppercase tracking-wide text-emerald-800">
          Economic indicators dashboard
        </div>

        {cards.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((fact, index) => (
              <InfoCard
                key={`economy-card-${cleanText(fact.label)}-${index}`}
                label={cleanText(fact.label)}
                value={cleanText(fact.value)}
                tone="emerald"
              />
            ))}
          </div>
        ) : (
          <InfoCard
            label="Economy overview"
            value={extractText || "Economy page loaded, but no structured economy facts were available."}
            tone="amber"
          />
        )}
      </section>
    </div>
  );
}

function ExternalBusinessTab({
  facts,
  extract,
}: {
  facts: WikiFact[];
  extract?: string;
}) {
  const extractText = cleanText(extract);

  const externalFacts = facts.filter((fact) => {
    const group = groupKey(fact);
    const label = labelKey(fact);

    return (
      group.includes("external") ||
      label.includes("export") ||
      label.includes("import") ||
      label.includes("trade") ||
      label.includes("partner") ||
      label.includes("current account") ||
      label.includes("external debt") ||
      label.includes("fdi") ||
      label.includes("investment") ||
      label.includes("remittance") ||
      label.includes("port") ||
      label.includes("logistics") ||
      label.includes("commodity")
    );
  });

  const publicFinanceFacts = facts.filter((fact) => {
    const group = groupKey(fact);
    const label = labelKey(fact);

    return (
      group.includes("public finance") ||
      label.includes("government debt") ||
      label.includes("foreign reserves") ||
      label.includes("budget balance") ||
      label === "revenue" ||
      label === "spending" ||
      label.includes("expenditure") ||
      label.includes("tax") ||
      label.includes("fiscal") ||
      label.includes("economic aid") ||
      label.includes("credit rating") ||
      label.includes("deficit") ||
      label.includes("surplus")
    );
  });

  const structuralFacts = facts.filter((fact) => {
    const group = groupKey(fact);
    const label = labelKey(fact);

    return (
      group.includes("business structure") ||
      label.includes("gdp by sector") ||
      label.includes("gdp by component") ||
      label.includes("labour force by occupation") ||
      label.includes("labor force by occupation") ||
      label.includes("main industries") ||
      label.includes("industry") ||
      label.includes("tourism") ||
      label.includes("agriculture") ||
      label.includes("manufacturing") ||
      label.includes("services") ||
      label.includes("oil") ||
      label.includes("gas") ||
      label.includes("mining") ||
      label.includes("poverty") ||
      label.includes("gini") ||
      label.includes("human development") ||
      label.includes("economic overview")
    );
  });

  const usedFacts = new Set([
    ...externalFacts,
    ...publicFinanceFacts,
    ...structuralFacts,
  ]);

  const fallbackFacts = facts.filter((fact) => !usedFacts.has(fact)).slice(0, 12);

  const extractFallbackFacts: WikiFact[] =
    !externalFacts.length &&
    !publicFinanceFacts.length &&
    !structuralFacts.length &&
    !fallbackFacts.length &&
    extractText
      ? [
          {
            group: "Business structure",
            label: "Business intelligence from economy page",
            value: extractText,
          },
        ]
      : [];

  return (
    <div className="space-y-4">
      {externalFacts.length ? (
        <section className="rounded-[22px] border border-emerald-200 bg-emerald-50/35 p-4">
          <div className="mb-3">
            <div className="text-sm font-black uppercase tracking-wide text-emerald-800">
              External trade profile
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              Exports, imports, trade, investment, partner shares and external balances.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {externalFacts.map((fact, index) => (
              <SplitValueCard
                key={`external-${cleanText(fact.label)}-${index}`}
                fact={fact}
                tone="emerald"
              />
            ))}
          </div>
        </section>
      ) : null}

      {publicFinanceFacts.length ? (
        <section className="rounded-[22px] border border-indigo-200 bg-indigo-50/35 p-4">
          <div className="mb-3">
            <div className="text-sm font-black uppercase tracking-wide text-indigo-800">
              Public finance profile
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              Debt, reserves, budget, revenue, spending, aid, taxation and fiscal position.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {publicFinanceFacts.map((fact, index) => (
              <SplitValueCard
                key={`finance-${cleanText(fact.label)}-${index}`}
                fact={fact}
                tone="indigo"
              />
            ))}
          </div>
        </section>
      ) : null}

      {structuralFacts.length ? (
        <section className="rounded-[22px] border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <div className="text-sm font-black uppercase tracking-wide text-slate-900">
              Business structure
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              Sector mix, industries, employment, resources and broader economic structure.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {structuralFacts.map((fact, index) => (
              <SplitValueCard
                key={`structure-${cleanText(fact.label)}-${index}`}
                fact={fact}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!externalFacts.length && !publicFinanceFacts.length && fallbackFacts.length ? (
        <section className="rounded-[22px] border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <div className="text-sm font-black uppercase tracking-wide text-slate-900">
              Business intelligence from economy page
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              This page does not expose a separate External/Public finance block, so Stratify is displaying the available economy content dynamically.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fallbackFacts.map((fact, index) => (
              <SplitValueCard
                key={`fallback-${cleanText(fact.label)}-${index}`}
                fact={fact}
              />
            ))}
          </div>
        </section>
      ) : null}

      {extractFallbackFacts.length ? (
        <section className="rounded-[22px] border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <div className="text-sm font-black uppercase tracking-wide text-slate-900">
              Business intelligence from economy page
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              Structured trade/public finance rows were not available, so Stratify is using the economy overview dynamically.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {extractFallbackFacts.map((fact, index) => (
              <SplitValueCard
                key={`extract-${cleanText(fact.label)}-${index}`}
                fact={fact}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!externalFacts.length &&
      !publicFinanceFacts.length &&
      !structuralFacts.length &&
      !fallbackFacts.length &&
      !extractFallbackFacts.length ? (
        <InfoCard
          label="Economy profile unavailable"
          value="Wikipedia returned the country profile, but no economy profile content was available for this country."
          tone="amber"
        />
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function CountryWikiCard({ iso3, countryName, region }: Props) {
  const [payload, setPayload] = useState<WikiPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  useEffect(() => {
    const normalizedIso3 = cleanText(iso3).toUpperCase();
    if (!normalizedIso3) return;

    const controller = new AbortController();

    async function loadWikiProfile() {
      try {
        setLoading(true);
        setPayload(null);

        const qs = new URLSearchParams();
        qs.set("iso3", normalizedIso3);

        const name = cleanText(countryName);
        if (name && name !== normalizedIso3) {
          qs.set("country", name);
        }

        const response = await fetch(`/api/wiki/country?${qs.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json = (await response.json()) as WikiPayload;

        if (!controller.signal.aborted) {
          setPayload(json);
        }
      } catch {
        if (!controller.signal.aborted) {
          setPayload({
            ok: false,
            error: "Wikipedia profile unavailable",
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadWikiProfile();

    return () => controller.abort();
  }, [iso3, countryName]);

  const countryFacts = useMemo(
    () => normalizeFacts(payload?.facts),
    [payload?.facts],
  );

  const countryHighlights = useMemo(
    () => normalizeFacts(payload?.highlights),
    [payload?.highlights],
  );

  const economyBaseFacts = useMemo(
    () => normalizeFacts(payload?.economics?.facts),
    [payload?.economics?.facts],
  );

  const dynamicEconomyFacts = useMemo(
    () =>
      dedupeFacts([
        ...economyBaseFacts,
        ...makeFactsFromSections(payload?.economics?.sections),
        ...makeExtractFact(payload?.economics?.extract),
      ]),
    [
      economyBaseFacts,
      payload?.economics?.sections,
      payload?.economics?.extract,
    ],
  );

  const economyFactGroups = useMemo(
    () => groupFacts(dynamicEconomyFacts),
    [dynamicEconomyFacts],
  );

  const countryFactGroups = useMemo(
    () => groupFacts(countryFacts),
    [countryFacts],
  );

  const demographicsParagraphs = useMemo(() => {
    return (payload?.demographics?.paragraphs || [])
      .map(cleanText)
      .filter(Boolean);
  }, [payload?.demographics?.paragraphs]);

  const displayName = cleanText(
    payload?.displayTitle ||
      payload?.title ||
      payload?.country ||
      countryName ||
      "Country profile",
  );

  const fetchedAt = formatFetchedAt(payload?.fetchedAt);

  if (loading) {
    return (
      <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900">
                Loading country and economy profile...
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Fetching Wikipedia summary and dedicated economy page
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!payload?.ok || !payload.extract) {
    return null;
  }

  return (
    <>
      <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              <Sparkles className="h-3.5 w-3.5" />
              Country profile
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              <Globe2 className="h-3.5 w-3.5" />
              {cleanText(iso3).toUpperCase()}
            </span>

            {payload.economics?.ok ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                Economy page ingested
              </span>
            ) : null}

            {region ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                {cleanText(region)}
              </span>
            ) : null}
          </div>

          <h2 className="mb-1 text-2xl font-black tracking-tight text-slate-950">
            {displayName}
          </h2>

          {payload.description ? (
            <div className="mb-4 text-xs font-bold uppercase tracking-wide text-violet-700">
              {cleanText(payload.description)}
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
            <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>
              Country overview
            </TabButton>
            <TabButton active={activeTab === "economy"} onClick={() => setActiveTab("economy")}>
              Economy dashboard
            </TabButton>
            <TabButton active={activeTab === "external"} onClick={() => setActiveTab("external")}>
              External business profile
            </TabButton>
          </div>

          {activeTab === "profile" ? (
            <CountryProfileTab
              payload={payload}
              countryHighlights={countryHighlights}
              demographicsParagraphs={demographicsParagraphs}
            />
          ) : null}

          {activeTab === "economy" ? (
            <EconomyOverviewTab
              facts={dynamicEconomyFacts}
              extract={payload.economics?.extract}
            />
          ) : null}

          {activeTab === "external" ? (
            <ExternalBusinessTab
              facts={dynamicEconomyFacts}
              extract={payload.economics?.extract}
            />
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="text-[11px] font-medium text-slate-500">
              Source: {payload.source || "Wikipedia"} contributors
              {payload.license ? ` · License: ${payload.license}` : ""}
              {fetchedAt ? ` · Updated: ${fetchedAt}` : ""}
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Info className="h-3.5 w-3.5" />
              View full profile
            </button>
          </div>
        </CardContent>
      </Card>

      {open ? (
        <div
          className="fixed inset-0 z-[99999] flex items-stretch justify-center bg-white/95 p-0 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                  Country intelligence profile
                </div>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                  {displayName}
                </h3>
                <div className="mt-1 text-sm font-semibold text-slate-500">
                  {cleanText(iso3).toUpperCase()}
                  {region ? ` · ${cleanText(region)}` : ""}
                  {payload.description ? ` · ${cleanText(payload.description)}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-100"
                aria-label="Close country profile"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-white p-3 sm:p-4">
              <div className="space-y-4">
                <CountryProfileTab
                  payload={payload}
                  countryHighlights={countryHighlights}
                  demographicsParagraphs={demographicsParagraphs}
                />

                <EconomyOverviewTab
                  facts={dynamicEconomyFacts}
                  extract={payload.economics?.extract}
                />

                <ExternalBusinessTab
                  facts={dynamicEconomyFacts}
                  extract={payload.economics?.extract}
                />

                {economyFactGroups.length ? (
                  <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-900">
                      Complete economy facts
                    </div>
                    <FactsTable groups={economyFactGroups} />
                  </section>
                ) : null}

                {countryFactGroups.length ? (
                  <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-900">
                      Complete country facts
                    </div>
                    <FactsTable groups={countryFactGroups} />
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
