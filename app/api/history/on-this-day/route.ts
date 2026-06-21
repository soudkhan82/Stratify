import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WikiPage = {
  title?: string;
  normalizedtitle?: string;
  description?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
  thumbnail?: {
    source?: string;
  };
};

type WikiOnThisDayItem = {
  text?: string;
  year?: number;
  pages?: WikiPage[];
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function asInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeItems(items: WikiOnThisDayItem[] | undefined, kind: string) {
  return (items || []).map((item, index) => {
    const page = item.pages?.[0] || null;

    return {
      id: `${kind}-${item.year ?? "na"}-${index}`,
      kind,
      year: typeof item.year === "number" ? item.year : null,
      text: cleanText(item.text),
      title: cleanText(page?.normalizedtitle || page?.title),
      description: cleanText(page?.description),
      articleUrl: page?.content_urls?.desktop?.page || null,
      thumbnailUrl: page?.thumbnail?.source || null,
    };
  });
}

export async function GET(req: Request) {
  try {
    const now = new Date();
    const { searchParams } = new URL(req.url);

    const month = Math.max(
      1,
      Math.min(12, asInt(searchParams.get("month"), now.getMonth() + 1)),
    );

    const day = Math.max(
      1,
      Math.min(31, asInt(searchParams.get("day"), now.getDate())),
    );

    const mm = pad2(month);
    const dd = pad2(day);

    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "StratifyAnalytics/1.0 (https://worldstats360.com; history-on-this-day)",
        },
        cache: "no-store",
      },
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Wikipedia On This Day failed: ${response.status} ${response.statusText} ${text.slice(
          0,
          240,
        )}`,
      );
    }

    const json = JSON.parse(text) as {
      selected?: WikiOnThisDayItem[];
      events?: WikiOnThisDayItem[];
      births?: WikiOnThisDayItem[];
      deaths?: WikiOnThisDayItem[];
      holidays?: WikiOnThisDayItem[];
    };

    const selected = normalizeItems(json.selected, "Selected");
    const events = normalizeItems(json.events, "Events");
    const births = normalizeItems(json.births, "Births");
    const deaths = normalizeItems(json.deaths, "Deaths");
    const holidays = normalizeItems(json.holidays, "Holidays");

    return NextResponse.json(
      {
        ok: true,
        month,
        day,
        selected,
        events,
        births,
        deaths,
        holidays,
        source: "Wikipedia On This Day feed",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "On This Day API failed",
        selected: [],
        events: [],
        births: [],
        deaths: [],
        holidays: [],
      },
      { status: 500 },
    );
  }
}