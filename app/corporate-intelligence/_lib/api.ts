import type {
  CorporateDirectorySummary,
  CorporateProfile,
  CorporateScope,
} from "./types";

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "rows" in payload &&
    Array.isArray((payload as { rows?: unknown }).rows)
  ) {
    return (payload as { rows: T[] }).rows;
  }

  return [];
}

function unwrapObject<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;

  if ("data" in payload && (payload as { data?: unknown }).data) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

function scopeParam(scope?: CorporateScope) {
  return `?scope=${encodeURIComponent(scope || "sp500")}`;
}

export async function fetchCorporateDirectory(
  scope: CorporateScope = "sp500",
): Promise<CorporateProfile[]> {
  const res = await fetch(
    `/api/corporate-intelligence/directory${scopeParam(scope)}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch corporate directory");
  }

  const json = await res.json();
  return unwrapArray<CorporateProfile>(json);
}

export async function fetchCorporateSummary(
  scope: CorporateScope = "sp500",
): Promise<CorporateDirectorySummary | null> {
  const res = await fetch(
    `/api/corporate-intelligence/summary${scopeParam(scope)}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  return unwrapObject<CorporateDirectorySummary>(json);
}
