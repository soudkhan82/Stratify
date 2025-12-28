// app/api/landing/route.ts
import { NextResponse } from "next/server";

/**
 * This route is usually used to serve "landing page" datasets
 * (cards/tiles/sections) in a single call.
 *
 * Key: No `any` used. We keep JSON parsing typed with unknown
 * and validate minimally.
 */

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

function normalizeLandingPayload(input: unknown): LandingResponse {
  // Accept either already-shaped payload or transform loosely.
  // This prevents runtime crashes and avoids any.
  if (!isRecord(input)) {
    return { generated_at: new Date().toISOString(), sections: [] };
  }

  const generated_at = asString(input.generated_at, new Date().toISOString());

  const rawSections = input.sections;
  const sections: LandingSection[] = Array.isArray(rawSections)
    ? rawSections
        .map((s): LandingSection | null => {
          if (!isRecord(s)) return null;

          const id = asString(s.id);
          const title = asString(s.title);

          if (!id || !title) return null;

          const subtitle = typeof s.subtitle === "string" ? s.subtitle : undefined;

          const rawStats = s.stats;
          const stats: LandingStat[] | undefined = Array.isArray(rawStats)
            ? rawStats
                .map((st): LandingStat | null => {
                  if (!isRecord(st)) return null;
                  const key = asString(st.key);
                  const label = asString(st.label);
                  if (!key || !label) return null;

                  const value = asNumber(st.value, 0);
                  const unit = typeof st.unit === "string" ? st.unit : undefined;

                  return { key, label, value, unit };
                })
                .filter((x): x is LandingStat => x !== null)
            : undefined;

          return { id, title, subtitle, stats };
        })
        .filter((x): x is LandingSection => x !== null)
    : [];

  return { generated_at, sections };
}

export async function GET() {
  try {
    // If you have a data source (Supabase/Postgres), plug it here.
    // For now, we return a stable typed shape and keep parsing safe.

    const payload: LandingResponse = {
      generated_at: new Date().toISOString(),
      sections: [
        {
          id: "overview",
          title: "Stratify Overview",
          subtitle: "Global indicators + maps",
          stats: [
            { key: "countries", label: "Countries", value: 214 },
            { key: "indicators", label: "Indicators", value: 16000 },
          ],
        },
      ],
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Optional: if you POST custom landing payload
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const normalized = normalizeLandingPayload(body);
    return NextResponse.json(normalized, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
