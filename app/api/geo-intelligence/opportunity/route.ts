import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGGREGATE_URL = "https://areainsights.googleapis.com/v1:computeInsights";
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

type ModelKey =
  | "pharmacy"
  | "restaurant"
  | "coffee_shop"
  | "supermarket"
  | "hotel"
  | "gym"
  | "medical_clinic";

type Coordinate = { latitude: number; longitude: number };

type ModelDefinition = {
  label: string;
  competitorType: string;
  demandTypes: string[];
  ecosystemTypes: string[];
};

const MODELS: Record<ModelKey, ModelDefinition> = {
  pharmacy: {
    label: "Pharmacy",
    competitorType: "pharmacy",
    demandTypes: ["hospital", "medical_clinic", "doctor"],
    ecosystemTypes: ["supermarket"],
  },
  restaurant: {
    label: "Restaurant",
    competitorType: "restaurant",
    demandTypes: ["hotel", "shopping_mall", "tourist_attraction"],
    ecosystemTypes: ["cafe"],
  },
  coffee_shop: {
    label: "Coffee Shop",
    competitorType: "coffee_shop",
    demandTypes: ["corporate_office", "shopping_mall", "university"],
    ecosystemTypes: ["restaurant"],
  },
  supermarket: {
    label: "Supermarket",
    competitorType: "supermarket",
    demandTypes: ["apartment_complex", "school", "university"],
    ecosystemTypes: ["shopping_mall"],
  },
  hotel: {
    label: "Hotel",
    competitorType: "hotel",
    demandTypes: ["tourist_attraction", "airport", "convention_center"],
    ecosystemTypes: ["restaurant"],
  },
  gym: {
    label: "Gym / Fitness",
    competitorType: "gym",
    demandTypes: ["apartment_complex", "corporate_office", "university"],
    ecosystemTypes: ["shopping_mall"],
  },
  medical_clinic: {
    label: "Medical Clinic",
    competitorType: "medical_clinic",
    demandTypes: ["pharmacy", "doctor", "hospital"],
    ecosystemTypes: ["supermarket"],
  },
};

type ZoneBase = {
  id: string;
  label: string;
  center: Coordinate;
  polygon: Coordinate[];
};

type ZoneAccumulator = ZoneBase & {
  competitors: number;
  demand: number;
  ecosystem: number;
  quality: number;
  breakdown: Record<string, number>;
};

type QueryJob = {
  zoneId: string;
  group: "competitors" | "demand" | "ecosystem";
  type: string;
};

function finite(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function normalize(values: number[]) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((value) => ((value - min) / (max - min)) * 100);
}

function average(values: number[]) {
  if (!values.length) return 50;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bandFromRank(rank: number) {
  if (rank <= 3) return "Higher Opportunity";
  if (rank <= 6) return "Mixed Opportunity";
  return "Lower Opportunity";
}

function buildReasons(scores: {
  demand: number;
  competition: number;
  ecosystem: number;
}) {
  const positives: string[] = [];
  const cautions: string[] = [];

  if (scores.demand >= 67) positives.push("Demand signals are stronger than most nearby zones.");
  if (scores.competition >= 67) positives.push("There is more room versus direct competitors.");
  if (scores.ecosystem >= 67) positives.push("Supporting business activity is stronger than most nearby zones.");

  if (scores.demand < 34) cautions.push("Demand signals are weaker than most nearby zones.");
  if (scores.competition < 34) cautions.push("Direct competitive pressure is relatively high.");
  if (scores.ecosystem < 34) cautions.push("Supporting business activity is relatively weak.");

  const combined = [...positives, ...cautions];
  if (!combined.length) {
    combined.push("The main signals are mixed, so this zone needs site-level validation.");
  }

  return combined.slice(0, 2);
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Google API returned non-JSON (${response.status}).`);
    }

    if (!response.ok) {
      const message = json?.error?.message || `Google API returned HTTP ${response.status}.`;
      throw new Error(message);
    }

    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveMarket(apiKey: string, market: string) {
  const json = await fetchJson(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: market,
      pageSize: 1,
    }),
  });

  const place = Array.isArray(json?.places) ? json.places[0] : null;
  const lat = Number(place?.location?.latitude);
  const lng = Number(place?.location?.longitude);

  if (!place || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Could not resolve the market '${market}'. Try 'City, Country'.`);
  }

  return {
    query: market,
    name: String(place?.displayName?.text || market).trim(),
    address: String(place?.formattedAddress || market).trim(),
    lat,
    lng,
  };
}

function createGrid(lat: number, lng: number, zoneKm: number): ZoneBase[] {
  const labels = ["NW", "N", "NE", "W", "CENTER", "E", "SW", "S", "SE"];
  const zones: ZoneBase[] = [];
  const half = zoneKm / 2;
  const latKm = 111.32;
  const lngKm = Math.max(20, 111.32 * Math.cos((lat * Math.PI) / 180));
  let index = 0;

  for (let row = -1; row <= 1; row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      const centerLat = lat - row * (zoneKm / latKm);
      const centerLng = lng + col * (zoneKm / lngKm);

      const south = centerLat - half / latKm;
      const north = centerLat + half / latKm;
      const west = centerLng - half / lngKm;
      const east = centerLng + half / lngKm;

      const polygon: Coordinate[] = [
        { latitude: south, longitude: west },
        { latitude: south, longitude: east },
        { latitude: north, longitude: east },
        { latitude: north, longitude: west },
        { latitude: south, longitude: west },
      ];

      zones.push({
        id: `zone-${index + 1}`,
        label: `Zone ${labels[index]}`,
        center: {
          latitude: centerLat,
          longitude: centerLng,
        },
        polygon,
      });

      index += 1;
    }
  }

  return zones;
}

async function aggregateCount(
  apiKey: string,
  zone: ZoneBase,
  placeType: string,
) {
  const filter: Record<string, unknown> = {
    locationFilter: {
      customArea: {
        polygon: {
          coordinates: zone.polygon,
        },
      },
    },
    typeFilter: {
      includedPrimaryTypes: [placeType],
    },
    operatingStatus: ["OPERATING_STATUS_OPERATIONAL"],
  };

  const json = await fetchJson(AGGREGATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      insights: ["INSIGHT_COUNT"],
      filter,
    }),
  });

  const count = Number(json?.count ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

async function runInBatches<T>(jobs: Array<() => Promise<T>>, batchSize = 8) {
  const results: T[] = [];

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map((job) => job()))));
  }

  return results;
}

function normalizedGroupByType(
  zones: ZoneAccumulator[],
  types: string[],
  group: "demand" | "ecosystem",
) {
  const perType = new Map<string, number[]>();

  types.forEach((type) => {
    const values = zones.map((zone) => zone.breakdown[`${group}:${type}`] ?? 0);
    perType.set(type, normalize(values));
  });

  return zones.map((_, zoneIndex) =>
    average(types.map((type) => perType.get(type)?.[zoneIndex] ?? 50)),
  );
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "GOOGLE_PLACES_API_KEY is not configured on the Stratify server.",
        },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;

    const market = String(body?.market ?? "").trim().slice(0, 120);
    const requestedModel = String(body?.model ?? "pharmacy") as ModelKey;
    const model = MODELS[requestedModel] ? requestedModel : "pharmacy";
    const zoneKm = clamp(finite(body?.zoneKm, 1.5), 0.5, 5);

    if (market.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "A city or market is required.",
        },
        { status: 400 },
      );
    }

    const resolved = await resolveMarket(apiKey, market);
    const definition = MODELS[model];
    const zones = createGrid(resolved.lat, resolved.lng, zoneKm);

    const accumulators = new Map<string, ZoneAccumulator>();

    zones.forEach((zone) => {
      accumulators.set(zone.id, {
        ...zone,
        competitors: 0,
        demand: 0,
        ecosystem: 0,
        quality: 0,
        breakdown: {},
      });
    });

    const jobs: QueryJob[] = [];

    zones.forEach((zone) => {
      jobs.push({
        zoneId: zone.id,
        group: "competitors",
        type: definition.competitorType,
      });

      definition.demandTypes.forEach((type) => {
        jobs.push({
          zoneId: zone.id,
          group: "demand",
          type,
        });
      });

      definition.ecosystemTypes.forEach((type) => {
        jobs.push({
          zoneId: zone.id,
          group: "ecosystem",
          type,
        });
      });
    });

    const values = await runInBatches(
      jobs.map((job) => async () => {
        const zone = zones.find((item) => item.id === job.zoneId)!;
        const count = await aggregateCount(apiKey, zone, job.type);

        return {
          ...job,
          count,
        };
      }),
      8,
    );

    values.forEach((result) => {
      const zone = accumulators.get(result.zoneId);
      if (!zone) return;

      zone[result.group] += result.count;
      zone.breakdown[`${result.group}:${result.type}`] = result.count;
    });

    const rawZones = zones.map((zone) => accumulators.get(zone.id)!);

    const demandNorm = normalizedGroupByType(
      rawZones,
      definition.demandTypes,
      "demand",
    );

    const ecosystemNorm = normalizedGroupByType(
      rawZones,
      definition.ecosystemTypes,
      "ecosystem",
    );

    const competitorNorm = normalize(
      rawZones.map((zone) => zone.competitors),
    );

    const competitionRoom = competitorNorm.map(
      (value) => 100 - value,
    );

    const scored = rawZones.map((zone, index) => {
      const demand = demandNorm[index];
      const competition = competitionRoom[index];
      const ecosystem = ecosystemNorm[index];

      const opportunity =
        demand * 0.40 +
        competition * 0.35 +
        ecosystem * 0.25;

      // Kept in the response for compatibility with the current Android types.
      // They are not used in the simplified Opportunity Map score.
      const whiteSpace =
        demand * 0.60 +
        competition * 0.40;

      const signalVolume =
        zone.competitors +
        zone.demand +
        zone.ecosystem;

      const signalCoverage =
        signalVolume >= 30 ? 95 :
        signalVolume >= 15 ? 82 :
        signalVolume >= 7 ? 68 :
        signalVolume >= 3 ? 52 : 35;

      const scores = {
        opportunity: round1(opportunity),
        demand: round1(demand),
        whiteSpace: round1(whiteSpace),
        ecosystem: round1(ecosystem),
        competition: round1(competition),
        quality: 0,
      };

      return {
        id: zone.id,
        label: zone.label,
        rank: 0,
        band: "",
        center: zone.center,
        polygon: zone.polygon,
        scores,
        raw: {
          competitors: zone.competitors,
          demand: zone.demand,
          ecosystem: zone.ecosystem,
          quality: 0,
          signalCoverage,
          breakdown: zone.breakdown,
        },
        reasons: buildReasons({
          demand,
          competition,
          ecosystem,
        }),
      };
    });

    scored.sort((a, b) => b.scores.opportunity - a.scores.opportunity);

    scored.forEach((zone, index) => {
      zone.rank = index + 1;
      zone.band = bandFromRank(zone.rank);
    });

    const totalSignals = scored.reduce(
      (sum, zone) =>
        sum +
        zone.raw.competitors +
        zone.raw.demand +
        zone.raw.ecosystem,
      0,
    );

    const warnings: string[] = [];

    if (totalSignals < 25) {
      warnings.push(
        "Place coverage is sparse in this market. Treat the ranking as directional and validate with local data.",
      );
    }

    warnings.push(
      "This is a relative comparison of nine nearby zones, not a financial return forecast.",
    );

    return NextResponse.json({
      ok: true,
      market: resolved,
      model,
      modelLabel: definition.label,
      zoneKm,
      grid: "3 x 3 local comparison",
      queryCount: jobs.length,
      generatedAt: new Date().toISOString(),
      source: "Google Places Aggregate API + Stratify scoring",
      attribution: "Google Maps",
      bestZone: scored[0] ?? null,
      zones: scored,
      methodology: {
        summary: "Each zone is compared with the other eight zones in the same local market. The Opportunity Score uses three signals only: demand, room versus direct competition and local supporting activity.",
        weights: {
          demand: 0.40,
          whiteSpace: 0,
          ecosystem: 0.25,
          competition: 0.35,
          quality: 0,
        },
      },
      warnings,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Geo Intelligence analysis failed.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}