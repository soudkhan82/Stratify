import { compact } from "@/lib/format";

export default function StatCard({
  title,
  value,
  foot,
}: {
  title: string;
  subtitle?: string;
  value: number | null;
  foot?: string;
  unit?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold">
        {value == null ? "—" : compact(value)}
      </div>
      {foot && <div className="text-xs text-muted-foreground mt-1">{foot}</div>}
    </div>
  );
}
