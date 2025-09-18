import { METRICS, METRICS_BY_TOPIC } from "@/lib/metrics";
import { latestFor } from "@/lib/data";
import StatCard from "@/components/StatCard";

export const revalidate = 60 * 60 * 24; // 24h
const ISO = "WLD";

export default async function MetricsOverviewPage() {
  // Flatten the metric keys we want to show
  const keys = [
    ...METRICS_BY_TOPIC.demographics,
    ...METRICS_BY_TOPIC.economy,
    ...METRICS_BY_TOPIC.environment,
    ...METRICS_BY_TOPIC.energy,
    ...METRICS_BY_TOPIC.health,
    ...METRICS_BY_TOPIC.agriculture,
  ];

  // Fetch latest values in parallel
  const rows = await Promise.all(
    keys.map(async (k) => {
      const m = METRICS[k];
      const value = await latestFor(ISO, m.code);
      return { key: k, ...m, value };
    })
  );

  return (
    <main className="p-4 space-y-6">
      {(
        [
          "demographics",
          "economy",
          "environment",
          "energy",
          "health",
          "agriculture",
        ] as const
      ).map((topic) => {
        const group = rows.filter((r) => r.topic === topic);
        if (!group.length) return null;
        return (
          <section key={topic} className="space-y-3">
            <h2 className="text-lg font-semibold capitalize">{topic}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {group.map((r) => (
                <StatCard
                  key={r.key}
                  title={r.label}
                  value={r.value}
                  foot={r.unit}
                />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
