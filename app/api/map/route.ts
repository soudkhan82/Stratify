import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

const YEAR_FALLBACK = ["2024","2023","2022","2021","2020","2019","2018","2017","2016","2015","2014","2013","2012","2011","2010"] as const;

function pickLatest(row: any) {
  for (const y of YEAR_FALLBACK) {
    const v = row?.[y];
    if (v !== null && v !== undefined) return Number(v);
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const indicator = searchParams.get("indicator") ?? "SP.POP.TOTL"; // default map metric
  const region = searchParams.get("region"); // optional continent filter

  // Pull WDI rows for this indicator for all countries
  const { data: rows, error } = await supabase
    .from("wdi_dataset")
    .select(
      `"Country Name","Country Code","Indicator Code",
       "2010","2011","2012","2013","2014","2015","2016","2017","2018","2019",
       "2020","2021","2022","2023","2024"`
    )
    .eq("Indicator Code", indicator);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get regions
  const { data: countries, error: cErr } = await supabase
    .from("wdicountry")
    .select(`"Country Code","Region","Table Name"`);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const regionMap = new Map<string, { region: string | null; name: string | null }>();
  for (const c of countries ?? []) {
    regionMap.set(c["Country Code"], { region: c["Region"] ?? null, name: c["Table Name"] ?? null });
  }

  const out = (rows ?? [])
    .map((r: any) => {
      const iso3 = r["Country Code"];
      const meta = regionMap.get(iso3);
      return {
        iso3,
        country: r["Country Name"],
        region: meta?.region ?? null,
        value: pickLatest(r),
      };
    })
    .filter((r) => r.iso3 && r.value !== null && r.country !== "World")
    .filter((r) => (region ? r.region === region : true));

  return NextResponse.json({ indicator, region: region ?? null, data: out });
}
