import fs from "node:fs/promises";
import path from "node:path";

const root =
  process.cwd();

const inputPath =
  path.join(
    root,
    "public",
    "data",
    "business-network",
    "businesses.json",
  );

const outputDir =
  path.join(
    root,
    "public",
    "data",
    "organization-network",
  );

const outputPath =
  path.join(
    outputDir,
    "organizations.json",
  );

function clean(value) {
  return String(
    value ?? "",
  ).trim();
}

function uniq(values) {
  return [
    ...new Set(
      (values ?? [])
        .map(clean)
        .filter(Boolean),
    ),
  ];
}

function sourceConfidence(
  business,
) {
  if (
    business.verified
  ) {
    return "verified";
  }

  if (
    String(
      business.verificationStatus ??
        "",
    )
      .toLowerCase()
      .includes(
        "source",
      )
  ) {
    return "source-linked";
  }

  return "discovered";
}

function verificationStatus(
  business,
) {
  if (
    business.verified
  ) {
    return "verified";
  }

  const value =
    clean(
      business.verificationStatus,
    ).toLowerCase();

  if (
    value ===
      "source-linked" ||
    value ===
      "discovered" ||
    value ===
      "claimed"
  ) {
    return value;
  }

  return "source-linked";
}

const source =
  JSON.parse(
    await fs.readFile(
      inputPath,
      "utf8",
    ),
  );

const businesses =
  Array.isArray(
    source.businesses,
  )
    ? source.businesses
    : [];

const organizations =
  businesses.map(
    (
      business,
    ) => {
      const moduleKey =
        clean(
          business.module ||
            "agriculture",
        ).toLowerCase();

      const sourceType =
        clean(
          business.sourceType,
        ) ||
        (
          business.verified
            ? "curated-official"
            : "source-linked"
        );

      return {
        id:
          `org-${clean(
            business.id,
          )}`,
        name:
          clean(
            business.name,
          ),
        entityType:
          "business",
        sectors:
          uniq([
            moduleKey,
          ]),
        subsectors:
          uniq(
            business.commerceGroups,
          ),
        services:
          uniq(
            business.roles,
          ),
        tags:
          uniq(
            business.itemKeys,
          ),

        country:
          clean(
            business.country,
          ),
        countryCode:
          clean(
            business.countryCode,
          ),
        city:
          clean(
            business.city,
          ),
        region:
          clean(
            business.region,
          ) ||
          null,
        address:
          clean(
            business.address,
          ) ||
          null,
        lat:
          Number.isFinite(
            Number(
              business.lat,
            ),
          )
            ? Number(
                business.lat,
              )
            : null,
        lng:
          Number.isFinite(
            Number(
              business.lng,
            ),
          )
            ? Number(
                business.lng,
              )
            : null,

        website:
          clean(
            business.website,
          ) ||
          null,
        phone:
          clean(
            business.phone,
          ) ||
          null,
        email:
          clean(
            business.email,
          ) ||
          null,
        description:
          clean(
            business.description,
          ) ||
          null,
        coverage:
          clean(
            business.coverage,
          ) ||
          null,

        verified:
          Boolean(
            business.verified,
          ),
        featured:
          Boolean(
            business.featured,
          ),
        verificationStatus:
          verificationStatus(
            business,
          ),
        locationPrecision:
          clean(
            business.locationPrecision,
          ) ||
          null,

        sources: [
          {
            provider:
              sourceType,
            sourceId:
              clean(
                business.fsqPlaceId ||
                  business.wikidataId ||
                  business.id,
              ) ||
              null,
            sourceUrl:
              clean(
                business.sourceUrl ||
                  business.website,
              ) ||
              null,
            confidence:
              sourceConfidence(
                business,
              ),
          },
        ],

        identifiers: {
          legacyBusinessId:
            clean(
              business.id,
            ) ||
            null,
          fsqPlaceId:
            clean(
              business.fsqPlaceId,
            ) ||
            null,
          lei:
            clean(
              business.lei,
            ) ||
            null,
          iatiIdentifier:
            clean(
              business.iatiIdentifier,
            ) ||
            null,
          reliefwebSourceId:
            clean(
              business.reliefwebSourceId,
            ) ||
            null,
          osmId:
            clean(
              business.osmId,
            ) ||
            null,
          corporateSymbol:
            clean(
              business.corporateSymbol,
            ) ||
            null,
        },

        legacy: {
          module:
            moduleKey,
          roles:
            uniq(
              business.roles,
            ),
          commerceGroups:
            uniq(
              business.commerceGroups,
            ),
          itemKeys:
            uniq(
              business.itemKeys,
            ),
        },
      };
    },
  );

await fs.mkdir(
  outputDir,
  {
    recursive: true,
  },
);

await fs.writeFile(
  outputPath,
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt:
        new Date()
          .toISOString(),
      sourcePolicy:
        "Stratify Connect merges curated, source-linked and discovered organizations into one cross-module directory. Verified status is retained only when independently established; discovered records remain explicitly unverified until reviewed or claimed.",
      organizations,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(
  `Organization network synced: ${organizations.length} organizations`,
);
console.log(
  outputPath,
);
