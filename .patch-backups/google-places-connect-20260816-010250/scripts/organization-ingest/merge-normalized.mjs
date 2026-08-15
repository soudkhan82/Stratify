import fs from "node:fs/promises";
import path from "node:path";

const root =
  process.cwd();

const masterPath =
  path.join(
    root,
    "public",
    "data",
    "organization-network",
    "organizations.json",
  );

const input =
  process.argv[2];

if (!input) {
  console.error(
    "Usage: node scripts/organization-ingest/merge-normalized.mjs <normalized-organizations.json>",
  );
  process.exit(2);
}

const inputPath =
  path.resolve(
    root,
    input,
  );

function clean(value) {
  return String(
    value ?? "",
  ).trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(
      /\s+/g,
      " ",
    );
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

function websiteHost(
  value,
) {
  const raw =
    clean(value);

  if (!raw) {
    return "";
  }

  try {
    return new URL(
      raw,
    ).hostname
      .toLowerCase()
      .replace(
        /^www\./,
        "",
      );
  } catch {
    return "";
  }
}

function identityKeys(
  organization,
) {
  const keys = [];

  for (
    const [
      name,
      value,
    ] of Object.entries(
      organization.identifiers ??
        {},
    )
  ) {
    const cleanValue =
      clean(value);

    if (cleanValue) {
      keys.push(
        `${name}:${normalize(
          cleanValue,
        )}`,
      );
    }
  }

  const host =
    websiteHost(
      organization.website,
    );

  if (host) {
    keys.push(
      `host:${host}`,
    );
  }

  const name =
    normalize(
      organization.name,
    );
  const city =
    normalize(
      organization.city,
    );
  const country =
    normalize(
      organization.country,
    );

  if (name) {
    keys.push(
      `name:${name}|${city}|${country}`,
    );
  }

  return keys;
}

function merge(
  target,
  incoming,
) {
  target.sectors =
    uniq([
      ...(
        target.sectors ??
        []
      ),
      ...(
        incoming.sectors ??
        []
      ),
    ]);
  target.subsectors =
    uniq([
      ...(
        target.subsectors ??
        []
      ),
      ...(
        incoming.subsectors ??
        []
      ),
    ]);
  target.services =
    uniq([
      ...(
        target.services ??
        []
      ),
      ...(
        incoming.services ??
        []
      ),
    ]);
  target.tags =
    uniq([
      ...(
        target.tags ??
        []
      ),
      ...(
        incoming.tags ??
        []
      ),
    ]);

  target.sources = [
    ...(
      target.sources ??
      []
    ),
    ...(
      incoming.sources ??
      []
    ),
  ].filter(
    (
      source,
      index,
      array,
    ) =>
      array.findIndex(
        (
          candidate,
        ) =>
          `${candidate.provider}|${candidate.sourceId}|${candidate.sourceUrl}` ===
          `${source.provider}|${source.sourceId}|${source.sourceUrl}`,
      ) === index,
  );

  target.identifiers = {
    ...(
      target.identifiers ??
      {}
    ),
    ...Object.fromEntries(
      Object.entries(
        incoming.identifiers ??
          {},
      ).filter(
        ([, value]) =>
          clean(
            value,
          ),
      ),
    ),
  };

  for (
    const field of [
      "website",
      "phone",
      "email",
      "description",
      "coverage",
      "country",
      "countryCode",
      "city",
      "region",
      "address",
      "locationPrecision",
    ]
  ) {
    if (
      !clean(
        target[field],
      ) &&
      clean(
        incoming[field],
      )
    ) {
      target[field] =
        incoming[field];
    }
  }

  if (
    target.lat == null &&
    incoming.lat != null
  ) {
    target.lat =
      incoming.lat;
  }

  if (
    target.lng == null &&
    incoming.lng != null
  ) {
    target.lng =
      incoming.lng;
  }

  if (
    incoming.verified
  ) {
    target.verified =
      true;
    target.verificationStatus =
      "verified";
  }

  target.featured =
    Boolean(
      target.featured ||
      incoming.featured,
    );

  return target;
}

const master =
  JSON.parse(
    await fs.readFile(
      masterPath,
      "utf8",
    ),
  );

const incomingPayload =
  JSON.parse(
    await fs.readFile(
      inputPath,
      "utf8",
    ),
  );

const incoming =
  Array.isArray(
    incomingPayload,
  )
    ? incomingPayload
    : Array.isArray(
        incomingPayload.organizations,
      )
      ? incomingPayload.organizations
      : [];

const organizations =
  Array.isArray(
    master.organizations,
  )
    ? master.organizations
    : [];

const index =
  new Map();

function indexOrganization(
  organization,
) {
  for (
    const key of
    identityKeys(
      organization,
    )
  ) {
    index.set(
      key,
      organization,
    );
  }
}

for (
  const organization of
  organizations
) {
  indexOrganization(
    organization,
  );
}

let added = 0;
let merged = 0;

for (
  const organization of
  incoming
) {
  const keys =
    identityKeys(
      organization,
    );

  let existing =
    null;

  for (
    const key of keys
  ) {
    const candidate =
      index.get(
        key,
      );

    if (candidate) {
      existing =
        candidate;
      break;
    }
  }

  if (existing) {
    merge(
      existing,
      organization,
    );
    merged += 1;
    indexOrganization(
      existing,
    );
    continue;
  }

  organizations.push(
    organization,
  );
  added += 1;
  indexOrganization(
    organization,
  );
}

master.organizations =
  organizations;
master.generatedAt =
  new Date()
    .toISOString();

await fs.writeFile(
  masterPath,
  JSON.stringify(
    master,
    null,
    2,
  ),
  "utf8",
);

console.log(
  `Merge complete | added=${added} merged=${merged} total=${organizations.length}`,
);
