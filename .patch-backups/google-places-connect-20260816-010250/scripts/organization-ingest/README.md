# Stratify Global Organization Ingestion

This folder is the source-adapter boundary for Stratify Connect.

## Master file

`public/data/organization-network/organizations.json`

All source adapters must normalize their output to:

```json
{
  "organizations": [
    {
      "id": "provider-stable-id",
      "name": "Organization name",
      "entityType": "business",
      "sectors": ["agriculture"],
      "subsectors": ["grains"],
      "services": ["supplier", "exporter"],
      "tags": ["wheat"],
      "country": "Pakistan",
      "countryCode": "PK",
      "city": "Karachi",
      "region": null,
      "address": null,
      "lat": 24.86,
      "lng": 67.01,
      "website": "https://example.com",
      "phone": null,
      "email": null,
      "description": null,
      "coverage": "Regional",
      "verified": false,
      "featured": false,
      "verificationStatus": "discovered",
      "locationPrecision": "poi",
      "sources": [
        {
          "provider": "fsq-os",
          "sourceId": "abc",
          "sourceUrl": null,
          "confidence": "discovered"
        }
      ],
      "identifiers": {
        "fsqPlaceId": "abc",
        "lei": null,
        "iatiIdentifier": null,
        "reliefwebSourceId": null,
        "osmId": null
      }
    }
  ]
}
```

Merge normalized files with:

```powershell
node .\scripts\organization-ingest\merge-normalized.mjs .\path\to\normalized.json
```

## Recommended providers

### Foursquare Open Source Places
Primary physical-organization / POI source.

Current access uses Foursquare Places Portal and an Iceberg catalog. The portal provides connection snippets for DuckDB, Spark and PyIceberg. Use the provider's current snippet, filter business categories, export the relevant rows, normalize them to the schema above, then merge.

Recommended sectors:
- agriculture
- macro-finance
- professional-services
- energy
- corporate
- NGO offices where present

### IATI Datastore v3
Primary NGO / development / aid-organization source.

Requires a free IATI API Gateway subscription key.

Useful activity fields include reporting organization, participating organizations, organization types, recipient countries, sectors and activity descriptions. Normalize organization identities and attach relevant development-sector tags.

### ReliefWeb API v2
Secondary humanitarian / NGO organization source.

Use the `sources` endpoint. ReliefWeb requires a pre-approved `appname` for API use. Treat ReliefWeb source records as source-linked/discovered unless independently verified.

### GLEIF API
Verification/enrichment source, especially for finance and larger legal entities.

GLEIF provides free, no-registration legal entity search and fuzzy matching. Use it to attach LEIs and strengthen identity confidence. Do not treat lack of an LEI as evidence that an organization is invalid.

## Sector keys

- `agriculture`
- `macro-finance`
- `ngo-development`
- `energy`
- `professional-services`
- `corporate`

## Verification policy

- `verified`: official/legal identity has been independently checked.
- `source-linked`: reliable source and/or official site exists, but final Stratify verification is pending.
- `discovered`: machine-discovered candidate.
- `claimed`: organization owner has claimed the profile; separate verification may still be needed.
