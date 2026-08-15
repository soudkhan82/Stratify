import "server-only";

import {
  buildConnectQueries,
  getConnectCategory,
  getConnectSector,
} from "@/app/lib/stratify-connect-config";

const GOOGLE_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.businessStatus",
  "places.googleMapsUri",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "businessStatus",
  "googleMapsUri",
  "websiteUri",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
].join(",");

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GoogleSearchPlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: {
    latitude?: number;
    longitude?: number;
  };
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
  googleMapsUri?: string;
};

type GoogleTextSearchResponse = {
  places?: GoogleSearchPlace[];
};

export type StratifyGooglePlace = {
  id: string;
  name: string;
  address: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  primaryType: string;
  types: string[];
  businessStatus: string;
  googleMapsUri: string;
  sector: string;
  category: string;
  matchedServices: string[];
  matchedQueries: string[];
  source: "Google Places (New)";
};

export type GooglePlacesSearchInput = {
  sector: string;
  category?: string | null;
  tag?: string | null;
  q?: string | null;
  location: string;
  limit?: number;
};

function clean(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLocation(
  value: unknown,
) {
  return clean(value)
    .slice(0, 120);
}

function toFiniteNumber(
  value: unknown,
) {
  const numeric =
    Number(value);

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : null;
}

function getAddressPart(
  components:
    | GoogleAddressComponent[]
    | undefined,
  type: string,
  useShort = false,
) {
  const component =
    (components ?? []).find(
      (item) =>
        Array.isArray(
          item.types,
        ) &&
        item.types.includes(
          type,
        ),
    );

  if (!component) {
    return "";
  }

  return clean(
    useShort
      ? component.shortText
      : component.longText,
  );
}

function parseLocation(
  place: GoogleSearchPlace,
) {
  const components =
    place.addressComponents ??
    [];

  const country =
    getAddressPart(
      components,
      "country",
    );

  const countryCode =
    getAddressPart(
      components,
      "country",
      true,
    ).toUpperCase();

  const city =
    getAddressPart(
      components,
      "locality",
    ) ||
    getAddressPart(
      components,
      "postal_town",
    ) ||
    getAddressPart(
      components,
      "administrative_area_level_2",
    ) ||
    getAddressPart(
      components,
      "administrative_area_level_1",
    );

  return {
    country,
    countryCode,
    city,
  };
}

function requireApiKey() {
  const apiKey =
    process.env
      .GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is missing from the server environment.",
    );
  }

  return apiKey;
}

async function runTextSearch({
  query,
  location,
  serviceLabel,
  sector,
  category,
}: {
  query: string;
  location: string;
  serviceLabel: string;
  sector: string;
  category: string;
}) {
  const apiKey =
    requireApiKey();

  const textQuery =
    `${query} in ${location}`;

  const response =
    await fetch(
      GOOGLE_TEXT_SEARCH_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "X-Goog-Api-Key":
            apiKey,
          "X-Goog-FieldMask":
            SEARCH_FIELD_MASK,
        },
        body:
          JSON.stringify(
            {
              textQuery,
              pageSize: 20,
              languageCode:
                "en",
            },
          ),
        cache: "no-store",
      },
    );

  const raw =
    (await response.json()) as
      | GoogleTextSearchResponse
      | {
          error?: unknown;
        };

  if (!response.ok) {
    throw new Error(
      `Google Places search failed (${response.status}) for "${textQuery}": ${JSON.stringify(
        (raw as {
          error?: unknown;
        }).error ??
          raw,
      ).slice(
        0,
        500,
      )}`,
    );
  }

  const places =
    Array.isArray(
      (
        raw as GoogleTextSearchResponse
      ).places,
    )
      ? (
          raw as GoogleTextSearchResponse
        ).places ?? []
      : [];

  return places
    .map(
      (
        place,
      ):
        | StratifyGooglePlace
        | null => {
        const id =
          clean(
            place.id,
          );
        const name =
          clean(
            place
              .displayName
              ?.text,
          );
        const lat =
          toFiniteNumber(
            place.location
              ?.latitude,
          );
        const lng =
          toFiniteNumber(
            place.location
              ?.longitude,
          );

        if (
          !id ||
          !name ||
          lat === null ||
          lng === null
        ) {
          return null;
        }

        if (
          place.businessStatus ===
          "CLOSED_PERMANENTLY"
        ) {
          return null;
        }

        const parsedLocation =
          parseLocation(
            place,
          );

        return {
          id,
          name,
          address:
            clean(
              place
                .formattedAddress,
            ),
          country:
            parsedLocation.country,
          countryCode:
            parsedLocation.countryCode,
          city:
            parsedLocation.city,
          lat,
          lng,
          primaryType:
            clean(
              place.primaryType,
            ),
          types:
            Array.isArray(
              place.types,
            )
              ? place.types
                  .map(clean)
                  .filter(
                    Boolean,
                  )
              : [],
          businessStatus:
            clean(
              place.businessStatus,
            ) ||
            "OPERATIONAL",
          googleMapsUri:
            clean(
              place
                .googleMapsUri,
            ),
          sector,
          category,
          matchedServices: [
            serviceLabel,
          ],
          matchedQueries: [
            textQuery,
          ],
          source:
            "Google Places (New)",
        };
      },
    )
    .filter(
      (
        place,
      ): place is StratifyGooglePlace =>
        place !== null,
    );
}

export async function searchGooglePlaces(
  input: GooglePlacesSearchInput,
) {
  const location =
    cleanLocation(
      input.location,
    );

  if (
    location.length < 2
  ) {
    throw new Error(
      "A country, city or region is required for Google Places discovery.",
    );
  }

  const sector =
    getConnectSector(
      input.sector,
    );
  const category =
    getConnectCategory(
      sector.value,
      input.category,
    );
  const queries =
    buildConnectQueries(
      {
        sector:
          sector.value,
        category:
          category.value,
        tag:
          input.tag,
        q:
          input.q,
      },
    ).slice(
      0,
      3,
    );

  const settled =
    await Promise.allSettled(
      queries.map(
        (
          query,
        ) =>
          runTextSearch(
            {
              query:
                query.text,
              location,
              serviceLabel:
                query.label,
              sector:
                sector.value,
              category:
                category.value,
            },
          ),
      ),
    );

  const errors: string[] =
    [];
  const merged =
    new Map<
      string,
      StratifyGooglePlace
    >();

  for (
    const result of
    settled
  ) {
    if (
      result.status ===
      "rejected"
    ) {
      errors.push(
        result.reason instanceof
          Error
          ? result.reason
              .message
          : String(
              result.reason,
            ),
      );
      continue;
    }

    for (
      const place of
      result.value
    ) {
      const existing =
        merged.get(
          place.id,
        );

      if (!existing) {
        merged.set(
          place.id,
          place,
        );
        continue;
      }

      existing.matchedServices =
        Array.from(
          new Set([
            ...existing
              .matchedServices,
            ...place
              .matchedServices,
          ]),
        );

      existing.matchedQueries =
        Array.from(
          new Set([
            ...existing
              .matchedQueries,
            ...place
              .matchedQueries,
          ]),
        );
    }
  }

  if (
    merged.size === 0 &&
    errors.length ===
      settled.length
  ) {
    throw new Error(
      errors[0] ||
        "Google Places search failed.",
    );
  }

  const requestedLimit =
    Number(
      input.limit ?? 60,
    );

  const limit =
    Number.isFinite(
      requestedLimit,
    )
      ? Math.max(
          1,
          Math.min(
            60,
            Math.trunc(
              requestedLimit,
            ),
          ),
        )
      : 60;

  const places =
    Array.from(
      merged.values(),
    ).slice(
      0,
      limit,
    );

  return {
    source:
      "Google Places (New)",
    sector:
      sector.value,
    sectorLabel:
      sector.label,
    category:
      category.value,
    categoryLabel:
      category.label,
    location,
    queryCount:
      queries.length,
    queries:
      queries.map(
        (query) =>
          `${query.text} in ${location}`,
      ),
    places,
    totalMatches:
      places.length,
    errors,
  };
}

export async function getGooglePlaceDetails(
  placeId: string,
) {
  const id =
    clean(placeId);

  if (!id) {
    throw new Error(
      "Google Place ID is required.",
    );
  }

  const apiKey =
    requireApiKey();

  const response =
    await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(
        id,
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type":
            "application/json",
          "X-Goog-Api-Key":
            apiKey,
          "X-Goog-FieldMask":
            DETAILS_FIELD_MASK,
        },
        cache: "no-store",
      },
    );

  const raw =
    await response.json();

  if (!response.ok) {
    throw new Error(
      `Google Place Details failed (${response.status}): ${JSON.stringify(
        raw?.error ??
          raw,
      ).slice(
        0,
        500,
      )}`,
    );
  }

  return {
    id:
      clean(raw?.id),
    name:
      clean(
        raw?.displayName
          ?.text,
      ),
    address:
      clean(
        raw
          ?.formattedAddress,
      ),
    businessStatus:
      clean(
        raw
          ?.businessStatus,
      ),
    googleMapsUri:
      clean(
        raw
          ?.googleMapsUri,
      ),
    websiteUri:
      clean(
        raw?.websiteUri,
      ),
    internationalPhoneNumber:
      clean(
        raw
          ?.internationalPhoneNumber,
      ),
    nationalPhoneNumber:
      clean(
        raw
          ?.nationalPhoneNumber,
      ),
    source:
      "Google Places (New)",
  };
}
