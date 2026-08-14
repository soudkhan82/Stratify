import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Business = {
  id: string;
  name: string;
  module: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  coverage: string;
  roles: string[];
  commerceGroups: string[];
  itemKeys: string[];
  description: string;
  website: string;
  sourceUrl: string;
  verified: boolean;
  featured?: boolean;
  sourceType?: string;
  verificationStatus?: string;
  locationPrecision?: string;
};

type SeedPayload = {
  generatedAt: string;
  sourcePolicy: string;
  businesses: Business[];
};

function normalize(value: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

async function readSeed(): Promise<SeedPayload> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "business-network",
    "businesses.json",
  );

  const raw = await readFile(
    filePath,
    "utf8",
  );

  return JSON.parse(raw) as SeedPayload;
}

export async function GET(
  request: Request,
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const moduleKey = normalize(
      searchParams.get("module") ||
        "agriculture",
    );
    const item = normalize(
      searchParams.get("item"),
    );
    const group = normalize(
      searchParams.get("group"),
    );
    const role = normalize(
      searchParams.get("role"),
    );
    const q = normalize(
      searchParams.get("q"),
    );

    const requestedLimit = Number(
      searchParams.get("limit") ??
        120,
    );

    const limit = Math.max(
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

    const seed = await readSeed();

    const ranked =
      seed.businesses
        .filter((business) => {
          if (
            normalize(
              business.module,
            ) !== moduleKey
          ) {
            return false;
          }

          if (
            role &&
            !business.roles.some(
              (value) =>
                normalize(value) ===
                role,
            )
          ) {
            return false;
          }

          if (q) {
            const haystack = [
              business.name,
              business.country,
              business.city,
              business.description,
              ...business.roles,
              ...business
                .commerceGroups,
            ]
              .join(" ")
              .toLowerCase();

            if (
              !haystack.includes(q)
            ) {
              return false;
            }
          }

          const itemMatch =
            !!item &&
            business.itemKeys.some(
              (value) =>
                normalize(value) ===
                item,
            );

          const groupMatch =
            !!group &&
            business.commerceGroups.some(
              (value) =>
                normalize(value) ===
                group,
            );

          const generalMatch =
            business.commerceGroups.some(
              (value) =>
                normalize(value) ===
                "agriculture",
            );

          return (
            itemMatch ||
            groupMatch ||
            generalMatch
          );
        })
        .map((business) => {
          const itemMatch =
            business.itemKeys.some(
              (value) =>
                normalize(value) ===
                item,
            );

          const groupMatch =
            business.commerceGroups.some(
              (value) =>
                normalize(value) ===
                group,
            );

          const matchType =
            itemMatch
              ? "exact-item"
              : groupMatch
                ? "category"
                : "agriculture-sector";

          const matchScore =
            (itemMatch
              ? 120
              : groupMatch
                ? 70
                : 15) +
            (business.verified
              ? 25
              : 0) +
            (business.featured
              ? 10
              : 0);

          return {
            ...business,
            matchType,
            matchScore,
          };
        })
        .sort((a, b) => {
          if (
            b.matchScore !==
            a.matchScore
          ) {
            return (
              b.matchScore -
              a.matchScore
            );
          }

          return a.name.localeCompare(
            b.name,
          );
        });

    const rows =
      ranked.slice(0, limit);

    return NextResponse.json(
      {
        ok: true,
        generatedAt:
          seed.generatedAt,
        sourcePolicy:
          seed.sourcePolicy,
        module: moduleKey,
        item,
        group,
        directorySize:
          seed.businesses.length,
        totalMatches:
          ranked.length,
        count: rows.length,
        businesses: rows,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
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
      { status: 500 },
    );
  }
}