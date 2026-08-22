import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

const AGGREGATE_URL =
  "https://areainsights.googleapis.com/v1:computeInsights";

type EcosystemDefinition = {
  label: string;
  types: string[];
};

type Profile = {
  label: string;
  focusTypes: string[];
  ecosystem: EcosystemDefinition[];
  priceSensitive?: boolean;
};

const PROFILES: Record<string, Profile> = {
  agriculture: {
    label: "Agriculture",
    // Keep the primary market count deliberately narrow.
    // Generic supplier/manufacturer types are NOT agriculture-specific.
    focusTypes: ["farm", "ranch", "farmers_market"],
    ecosystem: [
      { label: "Farmers markets", types: ["farmers_market"] },
      { label: "Garden centers", types: ["garden_center"] },
      { label: "Veterinary services", types: ["veterinary_care"] },
      { label: "General storage (context)", types: ["storage"] },
    ],
  },

  "macro-finance": {
    label: "Financial Services",
    focusTypes: ["bank", "accounting", "insurance_agency"],
    ecosystem: [
      { label: "Business centers", types: ["business_center", "coworking_space"] },
      { label: "Corporate offices", types: ["corporate_office"] },
      { label: "Real estate services", types: ["real_estate_agency"] },
    ],
  },

  energy: {
    label: "Energy and Utilities",
    focusTypes: [
      "gas_station",
      "electric_vehicle_charging_station",
      "supplier",
      "manufacturer",
    ],
    ecosystem: [
      { label: "Industrial suppliers", types: ["supplier"] },
      { label: "Manufacturing", types: ["manufacturer"] },
      { label: "Transport services", types: ["transportation_service", "truck_stop"] },
    ],
  },

  "ict-technology": {
    label: "ICT and Technology",
    focusTypes: [
      "telecommunications_service_provider",
      "electronics_store",
      "corporate_office",
    ],
    ecosystem: [
      { label: "Corporate offices", types: ["corporate_office"] },
      { label: "Business and coworking centers", types: ["business_center", "coworking_space"] },
      { label: "Universities and research", types: ["university", "research_institute"] },
    ],
  },

  "healthcare-life-sciences": {
    label: "Healthcare and Life Sciences",
    focusTypes: [
      "hospital",
      "general_hospital",
      "medical_clinic",
      "pharmacy",
      "medical_lab",
    ],
    ecosystem: [
      { label: "Doctors", types: ["doctor"] },
      { label: "Pharmacies", types: ["pharmacy"] },
      { label: "Medical labs", types: ["medical_lab"] },
      { label: "Dental services", types: ["dentist", "dental_clinic"] },
    ],
  },

  "ngo-development": {
    label: "NGO and Development",
    focusTypes: ["non_profit_organization", "association_or_organization"],
    ecosystem: [
      { label: "Government offices", types: ["government_office", "local_government_office"] },
      { label: "Education institutions", types: ["educational_institution", "university"] },
      { label: "Healthcare institutions", types: ["hospital", "medical_clinic"] },
    ],
  },

  "government-public": {
    label: "Government and Public Services",
    focusTypes: ["government_office", "local_government_office"],
    ecosystem: [
      { label: "Police", types: ["police"] },
      { label: "Fire stations", types: ["fire_station"] },
      { label: "Post offices", types: ["post_office"] },
      { label: "Public administration", types: ["city_hall", "courthouse"] },
    ],
  },

  "education-training": {
    label: "Educational Services",
    focusTypes: [
      "educational_institution",
      "school",
      "university",
      "research_institute",
    ],
    ecosystem: [
      { label: "Libraries", types: ["library"] },
      { label: "Cafes", types: ["cafe", "coffee_shop"] },
      { label: "Transit", types: ["transit_station", "bus_station", "train_station"] },
    ],
  },

  "professional-services": {
    label: "Professional Services",
    focusTypes: [
      "consultant",
      "lawyer",
      "accounting",
      "employment_agency",
      "marketing_consultant",
    ],
    ecosystem: [
      { label: "Corporate offices", types: ["corporate_office"] },
      { label: "Business centers", types: ["business_center", "coworking_space"] },
      { label: "Banks", types: ["bank"] },
    ],
  },

  "industrial-manufacturing": {
    label: "Industrial and Manufacturing",
    focusTypes: ["manufacturer", "supplier", "wholesaler"],
    ecosystem: [
      { label: "Storage", types: ["storage"] },
      { label: "Shipping services", types: ["shipping_service"] },
      { label: "Truck and transport services", types: ["truck_stop", "transportation_service"] },
    ],
  },

  "real-estate": {
    label: "Real Estate",
    focusTypes: ["real_estate_agency", "apartment_building", "apartment_complex"],
    ecosystem: [
      { label: "Banks", types: ["bank"] },
      { label: "Home improvement", types: ["home_improvement_store"] },
      { label: "Furniture and home goods", types: ["furniture_store", "home_goods_store"] },
    ],
  },

  "logistics-warehousing": {
    label: "Logistics and Warehousing",
    focusTypes: ["storage", "shipping_service", "courier_service", "transportation_service"],
    ecosystem: [
      { label: "Truck stops", types: ["truck_stop"] },
      { label: "Fuel stations", types: ["gas_station"] },
      { label: "Suppliers and wholesalers", types: ["supplier", "wholesaler"] },
    ],
  },
};

const KEYWORD_PROFILES: Array<{
  test: RegExp;
  profile: Profile;
}> = [
  {
    test: /\b(hotel|hotels|lodging|resort|hostel|motel)\b/i,
    profile: {
      label: "Hotels and Lodging",
      focusTypes: ["hotel", "resort_hotel", "motel", "hostel", "guest_house", "bed_and_breakfast"],
      priceSensitive: true,
      ecosystem: [
        { label: "Restaurants", types: ["restaurant"] },
        { label: "Cafes and coffee", types: ["cafe", "coffee_shop"] },
        { label: "Tourist attractions", types: ["tourist_attraction"] },
        { label: "Transit", types: ["transit_station", "train_station", "bus_station"] },
      ],
    },
  },
  {
    test: /\b(restaurant|restaurants|dining)\b/i,
    profile: {
      label: "Restaurants",
      focusTypes: ["restaurant"],
      priceSensitive: true,
      ecosystem: [
        { label: "Cafes and coffee", types: ["cafe", "coffee_shop"] },
        { label: "Shopping", types: ["shopping_mall", "market"] },
        { label: "Hotels", types: ["hotel", "lodging"] },
        { label: "Tourist attractions", types: ["tourist_attraction"] },
      ],
    },
  },
  {
    test: /\b(coffee|cafe|cafes)\b/i,
    profile: {
      label: "Coffee Shops and Cafes",
      focusTypes: ["coffee_shop", "cafe"],
      priceSensitive: true,
      ecosystem: [
        { label: "Corporate offices", types: ["corporate_office"] },
        { label: "Universities", types: ["university"] },
        { label: "Shopping", types: ["shopping_mall"] },
        { label: "Restaurants", types: ["restaurant"] },
      ],
    },
  },
  {
    test: /\b(pharmacy|pharmacies|drugstore|chemist)\b/i,
    profile: {
      label: "Pharmacies",
      focusTypes: ["pharmacy", "drugstore"],
      ecosystem: [
        { label: "Hospitals", types: ["hospital", "general_hospital"] },
        { label: "Medical clinics", types: ["medical_clinic"] },
        { label: "Doctors", types: ["doctor"] },
        { label: "Medical labs", types: ["medical_lab"] },
      ],
    },
  },
  {
    test: /\b(supermarket|grocery|groceries)\b/i,
    profile: {
      label: "Supermarkets and Grocery",
      focusTypes: ["supermarket", "grocery_store", "food_store"],
      ecosystem: [
        { label: "Convenience stores", types: ["convenience_store"] },
        { label: "Markets", types: ["market", "farmers_market"] },
        { label: "Shopping malls", types: ["shopping_mall"] },
        { label: "Housing", types: ["apartment_complex", "housing_complex"] },
      ],
    },
  },
  {
    test: /\b(gym|fitness|fitness center)\b/i,
    profile: {
      label: "Gyms and Fitness",
      focusTypes: ["gym", "fitness_center"],
      ecosystem: [
        { label: "Housing", types: ["apartment_complex", "housing_complex"] },
        { label: "Corporate offices", types: ["corporate_office"] },
        { label: "Universities", types: ["university"] },
        { label: "Sports facilities", types: ["sports_complex", "sports_club"] },
      ],
    },
  },
  {
    test: /\b(clinic|medical clinic)\b/i,
    profile: {
      label: "Medical Clinics",
      focusTypes: ["medical_clinic", "medical_center"],
      ecosystem: [
        { label: "Doctors", types: ["doctor"] },
        { label: "Hospitals", types: ["hospital", "general_hospital"] },
        { label: "Pharmacies", types: ["pharmacy"] },
        { label: "Medical labs", types: ["medical_lab"] },
      ],
    },
  },
  {
    test: /\b(bank|banking)\b/i,
    profile: {
      label: "Banks",
      focusTypes: ["bank"],
      ecosystem: [
        { label: "ATMs", types: ["atm"] },
        { label: "Corporate offices", types: ["corporate_office"] },
        { label: "Business centers", types: ["business_center"] },
        { label: "Real estate agencies", types: ["real_estate_agency"] },
      ],
    },
  },
];

const CATEGORY_OVERRIDES: Record<string, Profile> = {
  supplier: {
    label: "Suppliers",
    focusTypes: ["supplier", "wholesaler"],
    ecosystem: [
      { label: "Manufacturing", types: ["manufacturer"] },
      { label: "Storage", types: ["storage"] },
      { label: "Shipping", types: ["shipping_service"] },
    ],
  },
  warehousing: {
    label: "Warehousing",
    focusTypes: ["storage", "warehouse_store"],
    ecosystem: [
      { label: "Shipping", types: ["shipping_service"] },
      { label: "Transport services", types: ["transportation_service", "truck_stop"] },
      { label: "Suppliers", types: ["supplier", "wholesaler"] },
    ],
  },
  courier: {
    label: "Courier and Delivery",
    focusTypes: ["courier_service", "shipping_service"],
    ecosystem: [
      { label: "Storage", types: ["storage"] },
      { label: "Transport services", types: ["transportation_service"] },
      { label: "Business centers", types: ["business_center"] },
    ],
  },
  universities: {
    label: "Universities and Colleges",
    focusTypes: ["university", "educational_institution"],
    ecosystem: [
      { label: "Libraries", types: ["library"] },
      { label: "Cafes", types: ["cafe", "coffee_shop"] },
      { label: "Transit", types: ["transit_station", "bus_station"] },
    ],
  },
  schools: {
    label: "Schools",
    focusTypes: ["school", "primary_school", "secondary_school"],
    ecosystem: [
      { label: "Libraries", types: ["library"] },
      { label: "Parks", types: ["park", "city_park"] },
      { label: "Transit", types: ["bus_station", "transit_station"] },
    ],
  },
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function ratio(part: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return null;
  return round1((part / total) * 100);
}

function clean(value: unknown, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

async function fetchGoogleJson(
  url: string,
  init: RequestInit,
  timeoutMs = 20000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();

    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Google API returned non-JSON (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(
        json?.error?.message ||
          `Google API returned HTTP ${response.status}.`,
      );
    }

    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveMarket(apiKey: string, market: string) {
  const json = await fetchGoogleJson(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types",
    },
    body: JSON.stringify({
      textQuery: market,
      pageSize: 1,
    }),
  });

  const place = Array.isArray(json?.places) ? json.places[0] : null;

  if (!place?.id) {
    throw new Error(`Could not resolve '${market}'. Try a city, region or country name.`);
  }

  const lat = Number(place?.location?.latitude);
  const lng = Number(place?.location?.longitude);

  return {
    id: String(place.id),
    name: clean(place?.displayName?.text || market),
    address: clean(place?.formattedAddress || market),
    primaryType: clean(place?.primaryType),
    types: Array.isArray(place?.types)
      ? place.types.map((item: unknown) => clean(item, 80)).filter(Boolean)
      : [],
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function regionCapable(place: Awaited<ReturnType<typeof resolveMarket>>) {
  const allowed = new Set([
    "country",
    "locality",
    "postal_code",
    "administrative_area_level_1",
    "administrative_area_level_2",
  ]);

  if (allowed.has(place.primaryType)) return true;

  return place.types.some((item: string) => allowed.has(item));
}

function typeFilter(types: string[]) {
  return {
    includedPrimaryTypes: Array.from(
      new Set(types.filter(Boolean)),
    ),
  };
}

async function aggregateCount(
  apiKey: string,
  locationFilter: Record<string, unknown>,
  types: string[],
  extra: Record<string, unknown> = {},
) {
  const json = await fetchGoogleJson(AGGREGATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      insights: ["INSIGHT_COUNT"],
      filter: {
        locationFilter,
        typeFilter: typeFilter(types),
        ...extra,
      },
    }),
  });

  const count = Number(json?.count ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

async function aggregatePlaceIds(
  apiKey: string,
  locationFilter: Record<string, unknown>,
  types: string[],
  extra: Record<string, unknown> = {},
) {
  const count = await aggregateCount(
    apiKey,
    locationFilter,
    types,
    extra,
  );

  if (count > 100) {
    return {
      count,
      canList: false,
      placeIds: [] as string[],
    };
  }

  if (count <= 0) {
    return {
      count: 0,
      canList: true,
      placeIds: [] as string[],
    };
  }

  const json = await fetchGoogleJson(AGGREGATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      insights: ["INSIGHT_PLACES"],
      filter: {
        locationFilter,
        typeFilter: typeFilter(types),
        ...extra,
      },
    }),
  });

  const placeIds = Array.isArray(json?.placeInsights)
    ? json.placeInsights
        .map((item: unknown) => {
          const place =
            item && typeof item === "object"
              ? clean((item as { place?: unknown }).place, 220)
              : "";

          return place.startsWith("places/")
            ? place.slice("places/".length)
            : place;
        })
        .filter(Boolean)
    : [];

  return {
    count,
    canList: true,
    placeIds: Array.from(new Set(placeIds)),
  };
}

async function buildLocationFilter(
  apiKey: string,
  place: Awaited<ReturnType<typeof resolveMarket>>,
) {
  if (regionCapable(place)) {
    const filter = {
      region: {
        place: `places/${place.id}`,
      },
    };

    try {
      await aggregateCount(apiKey, filter, ["restaurant"]);
      return {
        filter,
        mode: "region" as const,
        label: "Whole resolved geographic area",
      };
    } catch {
      // Fall through to a practical local circle.
    }
  }

  if (place.lat === null || place.lng === null) {
    throw new Error("The selected location has no usable map coordinates.");
  }

  return {
    filter: {
      circle: {
        latLng: {
          latitude: place.lat,
          longitude: place.lng,
        },
        radius: 5000,
      },
    },
    mode: "circle" as const,
    label: "5 km around the searched location",
  };
}

function profileFor(args: {
  sector: string;
  category: string;
  keyword: string;
}) {
  const keyword = args.keyword.trim();

  if (keyword) {
    const found = KEYWORD_PROFILES.find((item) => item.test.test(keyword));
    if (found) return found.profile;
  }

  const category = CATEGORY_OVERRIDES[args.category];
  if (category) return category;

  return PROFILES[args.sector] || PROFILES.agriculture;
}

async function runInBatches<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 5,
) {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, tasks.length) },
      () => worker(),
    ),
  );

  return results;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "GOOGLE_PLACES_API_KEY is missing on the Stratify server.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    const market = clean(body?.market);
    const sector = clean(body?.sector, 80) || "agriculture";
    const category = clean(body?.category, 80) || "all";
    const keyword = clean(body?.keyword, 120);
    const action = clean(body?.action, 40) || "legacy";

    const requestedLat = Number(body?.lat);
    const requestedLng = Number(body?.lng);
    const requestedRadius = Number(body?.radiusMeters);

    const hasPoint =
      Number.isFinite(requestedLat) &&
      requestedLat >= -90 &&
      requestedLat <= 90 &&
      Number.isFinite(requestedLng) &&
      requestedLng >= -180 &&
      requestedLng <= 180;

    const radiusMeters =
      Number.isFinite(requestedRadius)
        ? Math.round(
            Math.min(
              50000,
              Math.max(100, requestedRadius),
            ),
          )
        : 5000;

    const segment =
      clean(body?.segment, 40) || "operational";

    const requestedTypes = Array.isArray(body?.types)
      ? body!.types
          .map((item) => clean(item, 80))
          .filter(Boolean)
          .slice(0, 10)
      : [];

    const pointAction =
      action === "analyze" || action === "list";

    if (pointAction && !hasPoint) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid GPS or tapped map point is required for this analysis.",
        },
        { status: 400 },
      );
    }

    if (!pointAction && market.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "A city, region or country is required.",
        },
        { status: 400 },
      );
    }

    const profile = profileFor({ sector, category, keyword });

    const resolved =
      pointAction && hasPoint
        ? {
            id: "",
            name: market || "Selected map point",
            address: market || "GPS / map point",
            primaryType: "",
            types: [] as string[],
            lat: requestedLat,
            lng: requestedLng,
          }
        : await resolveMarket(apiKey, market);

    if (action === "resolve") {
      if (resolved.lat === null || resolved.lng === null) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "The selected location has no usable map coordinates.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        action: "resolve",
        market: {
          query: market,
          name: resolved.name,
          address: resolved.address,
          lat: resolved.lat,
          lng: resolved.lng,
        },
        focus: {
          label: profile.label,
          types: profile.focusTypes,
        },
        source: "Google Places Aggregate API",
        attribution: "Google Maps",
      });
    }

    const location =
      (action === "analyze" || action === "list") &&
      hasPoint
        ? {
            filter: {
              circle: {
                latLng: {
                  latitude: requestedLat,
                  longitude: requestedLng,
                },
                radius: radiusMeters,
              },
            },
            mode: "circle" as const,
            label: `${Math.round(
              (radiusMeters / 1000) * 10,
            ) / 10} km around selected map point`,
          }
        : await buildLocationFilter(apiKey, resolved);

    if (action === "list") {
      if (!hasPoint) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "A map point is required to drill into listings.",
          },
          { status: 400 },
        );
      }

      const allowedTypes = new Set([
        ...profile.focusTypes,
        ...profile.ecosystem.flatMap((item) => item.types),
      ]);

      const effectiveTypes =
        requestedTypes.length > 0
          ? requestedTypes.filter((item) =>
              allowedTypes.has(item),
            )
          : profile.focusTypes;

      if (!effectiveTypes.length) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "The requested listing group is not available for this analysis.",
          },
          { status: 400 },
        );
      }

      const extra: Record<string, unknown> = {};

      if (segment === "temporary") {
        extra.operatingStatus = [
          "OPERATING_STATUS_TEMPORARILY_CLOSED",
        ];
      } else if (segment === "permanent") {
        extra.operatingStatus = [
          "OPERATING_STATUS_PERMANENTLY_CLOSED",
        ];
      } else {
        extra.operatingStatus = [
          "OPERATING_STATUS_OPERATIONAL",
        ];

        if (segment === "rated45") {
          extra.ratingFilter = { minRating: 4.5 };
        } else if (segment === "rated4") {
          extra.ratingFilter = { minRating: 4.0 };
        }
      }

      const listing = await aggregatePlaceIds(
        apiKey,
        location.filter,
        effectiveTypes,
        extra,
      );

      return NextResponse.json({
        ok: true,
        action: "list",
        label:
          clean(body?.label, 120) || profile.label,
        segment,
        types: effectiveTypes,
        center: {
          lat: requestedLat,
          lng: requestedLng,
        },
        radiusMeters,
        count: listing.count,
        canList: listing.canList,
        placeIds: listing.placeIds,
        source: "Google Places Aggregate API",
        attribution: "Google Maps",
        message: listing.canList
          ? listing.count === 0
            ? "No matching places were found in this circle."
            : `${listing.count} exact matching places are available for listing drill-down.`
          : `${listing.count} places match. Reduce the analysis radius until the count is 100 or fewer to retrieve exact Place IDs.`,
      });
    }

    const tasks: Array<() => Promise<{ key: string; count: number }>> = [
      async () => ({
        key: "operational",
        count: await aggregateCount(
          apiKey,
          location.filter,
          profile.focusTypes,
          {
            operatingStatus: ["OPERATING_STATUS_OPERATIONAL"],
          },
        ),
      }),

      async () => ({
        key: "rated4",
        count: await aggregateCount(
          apiKey,
          location.filter,
          profile.focusTypes,
          {
            operatingStatus: ["OPERATING_STATUS_OPERATIONAL"],
            ratingFilter: { minRating: 4.0 },
          },
        ),
      }),

      async () => ({
        key: "rated45",
        count: await aggregateCount(
          apiKey,
          location.filter,
          profile.focusTypes,
          {
            operatingStatus: ["OPERATING_STATUS_OPERATIONAL"],
            ratingFilter: { minRating: 4.5 },
          },
        ),
      }),

      async () => ({
        key: "temporary",
        count: await aggregateCount(
          apiKey,
          location.filter,
          profile.focusTypes,
          {
            operatingStatus: ["OPERATING_STATUS_TEMPORARILY_CLOSED"],
          },
        ),
      }),

      async () => ({
        key: "permanent",
        count: await aggregateCount(
          apiKey,
          location.filter,
          profile.focusTypes,
          {
            operatingStatus: ["OPERATING_STATUS_PERMANENTLY_CLOSED"],
          },
        ),
      }),

      ...profile.ecosystem.map((item, index) => async () => ({
        key: `ecosystem:${index}`,
        count: await aggregateCount(
          apiKey,
          location.filter,
          item.types,
          {
            operatingStatus: ["OPERATING_STATUS_OPERATIONAL"],
          },
        ),
      })),
    ];

    if (profile.priceSensitive) {
      tasks.push(
        async () => ({
          key: "priceBudget",
          count: await aggregateCount(
            apiKey,
            location.filter,
            profile.focusTypes,
            {
              operatingStatus: ["OPERATING_STATUS_OPERATIONAL"],
              priceLevels: [
                "PRICE_LEVEL_FREE",
                "PRICE_LEVEL_INEXPENSIVE",
                "PRICE_LEVEL_MODERATE",
              ],
            },
          ),
        }),

        async () => ({
          key: "pricePremium",
          count: await aggregateCount(
            apiKey,
            location.filter,
            profile.focusTypes,
            {
              operatingStatus: ["OPERATING_STATUS_OPERATIONAL"],
              priceLevels: [
                "PRICE_LEVEL_EXPENSIVE",
                "PRICE_LEVEL_VERY_EXPENSIVE",
              ],
            },
          ),
        }),
      );
    }

    const rows = await runInBatches(tasks, 5);
    const values = new Map(rows.map((item) => [item.key, item.count]));

    const operationalAggregate =
      values.get("operational") ?? 0;
    let operational = operationalAggregate;

    const rated4Plus = values.get("rated4") ?? 0;
    const rated45Plus = values.get("rated45") ?? 0;
    const temporarilyClosed = values.get("temporary") ?? 0;
    const permanentlyClosed = values.get("permanent") ?? 0;

    const ecosystem = profile.ecosystem.map((item, index) => ({
      label: item.label,
      types: item.types,
      count: values.get(`ecosystem:${index}`) ?? 0,
    }));

    const priceBudget = values.get("priceBudget") ?? 0;
    const pricePremium = values.get("pricePremium") ?? 0;

    const pointAnalysis =
      action === "analyze" && hasPoint;

    let primaryPlaceIds: string[] = [];
    let exactIdCount: number | null = null;
    let listingVerified: boolean | null = null;

    if (
      pointAnalysis &&
      operationalAggregate >= 0 &&
      operationalAggregate <= 100
    ) {
      const exact = await aggregatePlaceIds(
        apiKey,
        location.filter,
        profile.focusTypes,
        {
          operatingStatus: [
            "OPERATING_STATUS_OPERATIONAL",
          ],
        },
      );

      if (exact.canList) {
        primaryPlaceIds = exact.placeIds;
        exactIdCount = primaryPlaceIds.length;
        listingVerified =
          exactIdCount === operationalAggregate;

        // For a drillable cohort, display exactly the number
        // of unique IDs that the user will actually open.
        operational = exactIdCount;
      }
    }

    const areaKm2 = pointAnalysis
      ? Math.PI * Math.pow(radiusMeters / 1000, 2)
      : 0;

    const densityPerKm2 =
      areaKm2 > 0
        ? round1(operational / areaKm2)
        : 0;

    return NextResponse.json({
      ok: true,
      action: pointAnalysis ? "analyze" : "legacy",
      scopeVerified: pointAnalysis && location.mode === "circle",
      scopeMode: location.mode,

      market: {
        query: market,
        name: resolved.name,
        address: resolved.address,
        scopeMode: location.mode,
        scopeLabel: location.label,
      },

      focus: {
        label: profile.label,
        types: profile.focusTypes,
      },

      primaryPlaceIds,

      listingAudit: {
        aggregateCount: operationalAggregate,
        exactIdCount,
        verified: listingVerified,
      },

      center: pointAnalysis
        ? {
            lat: requestedLat,
            lng: requestedLng,
          }
        : null,

      radiusMeters: pointAnalysis ? radiusMeters : null,
      radiusKm: pointAnalysis
        ? round1(radiusMeters / 1000)
        : null,
      areaKm2: pointAnalysis
        ? round1(areaKm2)
        : null,

      snapshot: {
        operational,
        rated4Plus,
        rated45Plus,
        temporarilyClosed,
        permanentlyClosed,
        densityPerKm2,
      },

      quality: {
        rated4Share: ratio(rated4Plus, operational),
        rated45Share: ratio(rated45Plus, operational),
      },

      ecosystem,

      priceProfile: profile.priceSensitive
        ? {
            value: true,
            budgetModerate: priceBudget,
            premium: pricePremium,
          }
        : null,

      queryCount: tasks.length,
      generatedAt: new Date().toISOString(),
      source: "Google Places Aggregate API",
      attribution: "Google Maps",
      disclaimer:
        "Primary counts use the selected primary place types inside the exact map circle. Related ecosystem rows are separate contextual counts and are not components of the primary total. Area Insights does not predict demand, profitability, land availability, zoning, planning permission or investment suitability.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to build Area Insights.",
      },
      { status: 500 },
    );
  }
}