// app/api/landing/route.ts
import { NextResponse } from "next/server";
import supabase from "@/app/config/supabase-config";

/* =======================
   Types
======================= */

type LandingStat = {
  key: string;
  label: string;
  value: number;
  unit?: string;
};

type LandingSection = {
  id: string;
  title: string;
  subtitle?: string;
  stats?: LandingStat[];
};

type LandingResponse = {
  generated_at: string; // ISO
  sections: LandingSection[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Minimal coercion for a LandingResponse coming from DB or computed logic */
function coerceLandingResponse(payload: unknown): LandingResponse {
  if (!isRecord(payload)) {
    return { generated_at: new Date().toISOString(), sections: [] };
  }

  const generated_at = asString(payload.generated_at, new Date().toISOString());

  const rawSections = payload.sections;
  const sections: LandingSection[] = Array.isArray(rawSections)
    ? rawSections.map((s): LandingSection => {
        if (!isRecord(s)) {
          return { id: "", title: "" };
        }

        const statsRaw = s.stats;
        const stats: LandingStat[] | undefined = Array.isArray(statsRaw)
          ? statsRaw.map((st): LandingStat => {
              if (!isRecord(st)) {
                return { key: "", label: "", value: 0 };
              }
              return {
                key: asString(st.key),
                label: asString(st.label),
                value: asNumber(st.value),
                unit: typeof st.unit === "string" ? st.unit : undefined,
              };
            })
          : undefined;

        return {
          id: asString(s.id),
          title: asString(s.title),
          subtitle: typeof s.subtitle === "string" ? s.subtitle : undefined,
          stats,
        };
      })
    : [];

  return { generated_at, sections };
}

export async function GET() {
  // If you were calling an RPC / table, keep your existing logic here.
  // Example shown (adjust to your actual source):
  const { data, error } = await supabase.rpc("fetch_landing", {});

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        generated_at: new Date().toISOString(),
        sections: [],
      },
      { status: 500 }
    );
  }

  // ✅ NO any: treat as unknown and coerce
  const safe = coerceLandingResponse(data as unknown);

  return NextResponse.json(safe);
}
