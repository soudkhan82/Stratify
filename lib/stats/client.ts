// /lib/stats/client.ts
import type { MetricKey } from "@/lib/metrics";

const API_ROUTE = "/api/stats/latest"; // one unified API endpoint

export async function fetchLatestMetrics(
  iso3: string,
  metricKeys: MetricKey[]
): Promise<Record<MetricKey, number | null>> {
  const res = await fetch(API_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iso3, metricKeys }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch latest metrics");
  }
  return res.json();
}
