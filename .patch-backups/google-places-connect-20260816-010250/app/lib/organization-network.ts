import "server-only";

import {
  readFile,
  stat,
} from "node:fs/promises";
import path from "node:path";

export type OrganizationSource = {
  provider: string;
  sourceId?: string | null;
  sourceUrl?: string | null;
  confidence:
    | "verified"
    | "source-linked"
    | "discovered";
};

export type OrganizationIdentifiers = {
  legacyBusinessId?: string | null;
  fsqPlaceId?: string | null;
  lei?: string | null;
  iatiIdentifier?: string | null;
  reliefwebSourceId?: string | null;
  osmId?: string | null;
  corporateSymbol?: string | null;
};

export type Organization = {
  id: string;
  name: string;
  entityType: string;
  sectors: string[];
  subsectors: string[];
  services: string[];
  tags: string[];

  country: string;
  countryCode: string;
  city: string;
  region?: string | null;
  address?: string | null;
  lat: number | null;
  lng: number | null;

  website?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  coverage?: string | null;

  verified: boolean;
  featured?: boolean;
  verificationStatus:
    | "verified"
    | "source-linked"
    | "discovered"
    | "claimed";

  locationPrecision?: string | null;
  sources: OrganizationSource[];
  identifiers: OrganizationIdentifiers;

  legacy?: {
    module?: string | null;
    roles?: string[];
    commerceGroups?: string[];
    itemKeys?: string[];
  } | null;
};

export type OrganizationPayload = {
  schemaVersion: number;
  generatedAt: string;
  sourcePolicy: string;
  organizations: Organization[];
};

export type OrganizationSearchInput = {
  sector?: string | null;
  subsector?: string | null;
  service?: string | null;
  tag?: string | null;
  country?: string | null;
  q?: string | null;
  verified?: boolean | null;
  limit?: number;
  offset?: number;
};

export type RankedOrganization =
  Organization & {
    matchScore: number;
    matchType: string;
  };

let cachedPayload:
  | OrganizationPayload
  | null = null;
let cachedMtime = -1;

function normalize(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase();
}

function includesNormalized(
  values: string[] | undefined,
  needle: string,
) {
  return (
    !!needle &&
    (values ?? []).some(
      (value) =>
        normalize(value) ===
        needle,
    )
  );
}

function cleanLimit(
  value: number | undefined,
  fallback = 100,
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return fallback;
  }

  return Math.max(
    1,
    Math.min(
      500,
      Math.trunc(
        numeric,
      ),
    ),
  );
}

function cleanOffset(
  value: number | undefined,
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(
      numeric,
    ),
  );
}

function countFacet(
  organizations: Organization[],
  accessor: (
    organization: Organization,
  ) => string[],
) {
  const counts =
    new Map<
      string,
      number
    >();

  for (
    const organization of
    organizations
  ) {
    for (
      const rawValue of
      accessor(
        organization,
      )
    ) {
      const value =
        String(
          rawValue ?? "",
        ).trim();

      if (!value) {
        continue;
      }

      counts.set(
        value,
        (counts.get(
          value,
        ) ?? 0) + 1,
      );
    }
  }

  return Array.from(
    counts.entries(),
  )
    .map(
      ([
        name,
        count,
      ]) => ({
        name,
        count,
      }),
    )
    .sort(
      (a, b) =>
        b.count -
          a.count ||
        a.name.localeCompare(
          b.name,
        ),
    );
}

export async function readOrganizationPayload(): Promise<OrganizationPayload> {
  const filePath =
    path.join(
      process.cwd(),
      "public",
      "data",
      "organization-network",
      "organizations.json",
    );

  const fileStat =
    await stat(
      filePath,
    );

  if (
    cachedPayload &&
    cachedMtime ===
      fileStat.mtimeMs
  ) {
    return cachedPayload;
  }

  const raw =
    await readFile(
      filePath,
      "utf8",
    );

  const parsed =
    JSON.parse(
      raw,
    ) as OrganizationPayload;

  if (
    !Array.isArray(
      parsed.organizations,
    )
  ) {
    throw new Error(
      "Organization network file has no organizations array.",
    );
  }

  cachedPayload =
    parsed;
  cachedMtime =
    fileStat.mtimeMs;

  return parsed;
}

export async function searchOrganizations(
  input: OrganizationSearchInput,
) {
  const payload =
    await readOrganizationPayload();

  const sector =
    normalize(
      input.sector,
    );
  const subsector =
    normalize(
      input.subsector,
    );
  const service =
    normalize(
      input.service,
    );
  const tag =
    normalize(
      input.tag,
    );
  const country =
    normalize(
      input.country,
    );
  const q =
    normalize(
      input.q,
    );

  const filtered =
    payload.organizations.filter(
      (
        organization,
      ) => {
        if (
          sector &&
          !includesNormalized(
            organization.sectors,
            sector,
          )
        ) {
          return false;
        }

        if (
          subsector &&
          !includesNormalized(
            organization.subsectors,
            subsector,
          )
        ) {
          return false;
        }

        if (
          service &&
          !includesNormalized(
            organization.services,
            service,
          )
        ) {
          return false;
        }

        if (
          tag &&
          !includesNormalized(
            organization.tags,
            tag,
          )
        ) {
          return false;
        }

        if (
          country &&
          normalize(
            organization.country,
          ) !==
            country &&
          normalize(
            organization.countryCode,
          ) !==
            country
        ) {
          return false;
        }

        if (
          input.verified ===
            true &&
          !organization.verified
        ) {
          return false;
        }

        if (
          input.verified ===
            false &&
          organization.verified
        ) {
          return false;
        }

        if (q) {
          const haystack = [
            organization.name,
            organization.entityType,
            organization.country,
            organization.countryCode,
            organization.city,
            organization.region,
            organization.address,
            organization.description,
            organization.coverage,
            ...(organization.sectors ??
              []),
            ...(organization.subsectors ??
              []),
            ...(organization.services ??
              []),
            ...(organization.tags ??
              []),
          ]
            .join(" ")
            .toLowerCase();

          if (
            !haystack.includes(
              q,
            )
          ) {
            return false;
          }
        }

        return true;
      },
    );

  const ranked: RankedOrganization[] =
    filtered
      .map(
        (
          organization,
        ) => {
          const exactTag =
            includesNormalized(
              organization.tags,
              tag,
            );
          const exactSubsector =
            includesNormalized(
              organization.subsectors,
              subsector,
            );
          const exactService =
            includesNormalized(
              organization.services,
              service,
            );
          const exactSector =
            includesNormalized(
              organization.sectors,
              sector,
            );
          const exactCountry =
            !!country &&
            (
              normalize(
                organization.country,
              ) === country ||
              normalize(
                organization.countryCode,
              ) === country
            );
          const nameHit =
            !!q &&
            normalize(
              organization.name,
            ).includes(
              q,
            );

          const matchScore =
            (exactTag
              ? 140
              : 0) +
            (exactSubsector
              ? 90
              : 0) +
            (exactService
              ? 70
              : 0) +
            (exactSector
              ? 45
              : 0) +
            (exactCountry
              ? 25
              : 0) +
            (nameHit
              ? 35
              : 0) +
            (organization.verified
              ? 25
              : 0) +
            (organization.featured
              ? 10
              : 0);

          const matchType =
            exactTag
              ? "exact-tag"
              : exactSubsector
                ? "subsector"
                : exactService
                  ? "service"
                  : exactSector
                    ? "sector"
                    : q
                      ? "text"
                      : "directory";

          return {
            ...organization,
            matchScore,
            matchType,
          };
        },
      )
      .sort(
        (a, b) =>
          b.matchScore -
            a.matchScore ||
          Number(
            b.verified,
          ) -
            Number(
              a.verified,
            ) ||
          a.name.localeCompare(
            b.name,
          ),
      );

  const offset =
    cleanOffset(
      input.offset,
    );
  const limit =
    cleanLimit(
      input.limit,
    );

  const page =
    ranked.slice(
      offset,
      offset + limit,
    );

  return {
    payload,
    ranked,
    page,
    offset,
    limit,
    totalMatches:
      ranked.length,
    facets: {
      sectors:
        countFacet(
          filtered,
          (
            organization,
          ) =>
            organization.sectors,
        ),
      subsectors:
        countFacet(
          filtered,
          (
            organization,
          ) =>
            organization.subsectors,
        ),
      services:
        countFacet(
          filtered,
          (
            organization,
          ) =>
            organization.services,
        ),
      countries:
        countFacet(
          filtered,
          (
            organization,
          ) => [
            organization.country,
          ],
        ),
      sourceTypes:
        countFacet(
          filtered,
          (
            organization,
          ) =>
            organization.sources.map(
              (
                source,
              ) =>
                source.provider,
            ),
        ),
    },
  };
}
