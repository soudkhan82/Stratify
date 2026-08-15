import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  searchOrganizations,
} from "@/app/lib/organization-network";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

function normalize(
  value: string | null,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase();
}

export async function GET(
  request: NextRequest,
) {
  try {
    const params =
      request.nextUrl
        .searchParams;

    const moduleKey =
      normalize(
        params.get(
          "module",
        ) ||
          "agriculture",
      );

    const item =
      normalize(
        params.get(
          "item",
        ),
      );
    const group =
      normalize(
        params.get(
          "group",
        ),
      );
    const role =
      normalize(
        params.get(
          "role",
        ),
      );
    const q =
      normalize(
        params.get(
          "q",
        ),
      );

    const requestedLimit =
      Number(
        params.get(
          "limit",
        ) ??
          120,
      );

    const limit =
      Math.max(
        20,
        Math.min(
          200,
          Number.isFinite(
            requestedLimit,
          )
            ? Math.trunc(
                requestedLimit,
              )
            : 120,
        ),
      );

    const result =
      await searchOrganizations(
        {
          sector:
            moduleKey,
          subsector:
            group ||
            null,
          service:
            role ||
            null,
          tag:
            item ||
            null,
          q:
            q ||
            null,
          limit,
          offset: 0,
        },
      );

    const businesses =
      result.page.map(
        (
          organization,
        ) => ({
          id:
            organization
              .identifiers
              .legacyBusinessId ||
            organization.id,
          organizationId:
            organization.id,
          name:
            organization.name,
          module:
            moduleKey,
          country:
            organization.country,
          countryCode:
            organization.countryCode,
          city:
            organization.city,
          lat:
            organization.lat,
          lng:
            organization.lng,
          coverage:
            organization.coverage ||
            "Global",
          roles:
            organization.services,
          commerceGroups:
            organization.subsectors,
          itemKeys:
            organization.tags,
          description:
            organization.description ||
            "",
          website:
            organization.website ||
            "",
          sourceUrl:
            organization.sources[0]
              ?.sourceUrl ||
            organization.website ||
            "",
          verified:
            organization.verified,
          featured:
            organization.featured ??
            false,
          sourceType:
            organization.sources[0]
              ?.provider ||
            "organization-network",
          verificationStatus:
            organization
              .verificationStatus,
          locationPrecision:
            organization
              .locationPrecision ??
            null,
          matchType:
            organization.matchType,
          matchScore:
            organization.matchScore,
        }),
      );

    return NextResponse.json(
      {
        ok: true,
        generatedAt:
          result.payload
            .generatedAt,
        sourcePolicy:
          result.payload
            .sourcePolicy,
        module:
          moduleKey,
        item,
        group,
        directorySize:
          result.payload
            .organizations
            .length,
        totalMatches:
          result.totalMatches,
        count:
          businesses.length,
        businesses,
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load business network.",
        businesses: [],
      },
      {
        status: 500,
      },
    );
  }
}
