import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

const YEAR_FALLBACK = [
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
  "2017",
  "2016",
  "2015",
  "2014",
  "2013",
  "2012",
  "2011",
  "2010",
] as const;

function pickLatest(row: any) {
  for (const y of YEAR_FALLBACK) {
    const v = row?.[y];
    if (v !== null && v !== undefined) return { year: y, value: Number(v) };
  }
  return { year: null, value: null };
}

const WDI_TIER1 = [
  // Population & Demographics
  { code: "SP.POP.TOTL", label: "Total Population" },
  { code: "SP.POP.GROW", label: "Population Growth (%)" },
  { code: "SP.DYN.CBRT.IN", label: "Birth Rate (per 1,000)" },
  { code: "SP.DYN.CDRT.IN", label: "Death Rate (per 1,000)" },
  { code: "SP.DYN.LE00.IN", label: "Life Expectancy (years)" },
  { code: "SP.URB.TOTL.IN.ZS", label: "Urban Population (%)" },

  // Economy
  { code: "NY.GDP.MKTP.CD", label: "GDP (Current US$)" },
  { code: "NY.GDP.PCAP.CD", label: "GDP per Capita (US$)" },
  { code: "NY.GDP.MKTP.KD.ZG", label: "GDP Growth (%)" },
  { code: "FP.CPI.TOTL.ZG", label: "Inflation (CPI %)" },

  // Health
  { code: "SH.DYN.MORT", label: "Under-5 Mortality" },
  { code: "SH.STA.MMRT", label: "Maternal Mortality" },
  { code: "SH.H2O.SAFE.ZS", label: "Access to Drinking Water (%)" },
  { code: "SH.STA.SMSS.ZS", label: "Access to Sanitation (%)" },

  // Energy & Environment
  { code: "EN.ATM.CO2E.KT", label: "CO₂ Emissions (kt)" },
  { code: "EN.ATM.CO2E.PC", label: "CO₂ Emissions per Capita" },
  { code: "EG.USE.PCAP.KG.OE", label: "Energy Use per Capita" },
  { code: "EG.ELC.ACCS.ZS", label: "Access to Electricity (%)" },
  { code: "AG.LND.FRST.ZS", label: "Forest Area (%)" },
];

const SUA_HEADLINES = [
  "Food supply (kcal/capita/day)",
  "Protein supply quantity (g/capita/day)",
  "Fat supply quantity (g/capita/day)",
  "Import quantity",
  "Export quantity",
];

function isAggregateArea(area: string) {
  const a = area ?? "";
  return (
    a === "World" ||
    ["Africa", "Americas", "Asia", "Europe", "Oceania"].includes(a) ||
    a.includes("(") ||
    /countries|income|union/i.test(a)
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const iso3 = searchParams.get("iso3"); // optional
  const regionRaw = searchParams.get("region");
  const region = regionRaw && regionRaw.trim().length ? regionRaw.trim() : null;

  // Resolve country name if iso3 is provided (from wdicountry)
  let countryName: string | null = null;
  if (iso3) {
    const { data: cRow, error: cErr } = await supabase
      .from("wdicountry")
      .select(`"Country Code","Table Name","Region"`)
      .eq("Country Code", iso3)
      .maybeSingle();

    if (cErr)
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    countryName = (cRow?.["Table Name"] as string) ?? null;
  }

  // --- WDI Tier-1 (World or specific country)
  // If region is chosen and iso3 not chosen, we keep world KPIs in top list (like Worldometers),
  // and region affects map and leaderboards separately.
  const wdiScopeName = iso3 ? countryName : "World";

  const { data: wdiRows, error: wdiErr } = await supabase
    .from("wdi_dataset")
    .select(
      `"Country Name","Country Code","Indicator Name","Indicator Code",
       "2010","2011","2012","2013","2014","2015","2016","2017","2018","2019",
       "2020","2021","2022","2023","2024"`
    )
    .eq("Country Name", wdiScopeName)
    .in(
      "Indicator Code",
      WDI_TIER1.map((x) => x.code)
    );

  if (wdiErr)
    return NextResponse.json({ error: wdiErr.message }, { status: 500 });

  const wdi = (wdiRows ?? [])
    .map((r: any) => {
      const lv = pickLatest(r);
      return {
        indicator_code: r["Indicator Code"],
        label:
          WDI_TIER1.find((x) => x.code === r["Indicator Code"])?.label ??
          r["Indicator Name"],
        year: lv.year,
        value: lv.value,
      };
    })
    .sort(
      (a, b) =>
        WDI_TIER1.findIndex((x) => x.code === a.indicator_code) -
        WDI_TIER1.findIndex((x) => x.code === b.indicator_code)
    );

  // --- SUA (only if we can resolve countryName; else show World)
  const suaArea = iso3 && countryName ? countryName : "World";

  const { data: suaYearRow, error: suaYearErr } = await supabase
    .from("faostat_sua")
    .select(`"Year"`)
    .order("Year", { ascending: false })
    .limit(1);

  if (suaYearErr)
    return NextResponse.json({ error: suaYearErr.message }, { status: 500 });
  const suaYear = suaYearRow?.[0]?.["Year"] ?? null;

  let sua: any[] = [];
  if (suaYear) {
    const { data: suaRows, error: suaErr } = await supabase
      .from("faostat_sua")
      .select(`"Area","Element","Unit","Value","Year"`)
      .eq("Year", suaYear)
      .eq("Area", suaArea)
      .in("Element", SUA_HEADLINES);

    if (suaErr)
      return NextResponse.json({ error: suaErr.message }, { status: 500 });

    sua = (suaRows ?? []).map((r: any) => ({
      label: r["Element"],
      unit: r["Unit"],
      value: r["Value"] == null ? null : Number(r["Value"]),
      year: r["Year"],
    }));
  }

  // --- Stratify Edge: Production top 10 commodities (latest year, country-only)
  const { data: prodYearRow, error: prodYearErr } = await supabase
    .from("faostat_production")
    .select(`"Year"`)
    .order("Year", { ascending: false })
    .limit(1);

  if (prodYearErr)
    return NextResponse.json({ error: prodYearErr.message }, { status: 500 });
  const prodYear = prodYearRow?.[0]?.["Year"] ?? null;

  let topCommodities: any[] = [];
  if (prodYear) {
    // We keep this light: filter year + element, then group on Item (done client-side? no).
    // Supabase supports `select` but not group by directly via client. We'll use RPC later.
    // For now: query a limited slice and aggregate in JS by Item.
    const { data: prodRows, error: prodErr } = await supabase
      .from("faostat_production")
      .select(`"Area","Item","Element","Year","Unit","Value"`)
      .eq("Year", prodYear)
      .ilike("Element", "%Production%")
      .limit(50000); // safe cap for landing; we’ll make RPC later

    if (!prodErr && prodRows) {
      const map = new Map<string, number>();
      for (const r of prodRows as any[]) {
        if (!r.Value || !r.Item) continue;
        // exclude aggregates
        if (r.Area && isAggregateArea(r.Area)) continue;
        map.set(r.Item, (map.get(r.Item) ?? 0) + Number(r.Value));
      }
      topCommodities = [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([item, value]) => ({ item, value }));
    }
  }

  return NextResponse.json({
    scope: iso3 ? "country" : region ? "region" : "world",
    iso3: iso3 ?? null,
    region: region ?? null,
    countryName: countryName ?? null,
    wdi,
    suaYear,
    sua,
    prodYear,
    topCommodities,
  });
}
