// =============================
import { fetchSeries, SeriesSpec } from "@/lib/datasources";
import SeriesChart from "./SeriesChart";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Suspense } from "react";

export type SeriesPanelProps = {
  spec: SeriesSpec;
  title?: string;
  unit?: string; // e.g., "USD", "%", "GWh"
  className?: string;
  /** Optional formatter for the headline value */
  format?: (v: number) => string;
};

async function loadData(spec: SeriesSpec) {
  const series = await fetchSeries(spec);
  const latest = series.length ? series[series.length - 1] : null;
  const min = series.reduce(
    (m, d) => (d.value < m ? d.value : m),
    Number.POSITIVE_INFINITY
  );
  const max = series.reduce(
    (m, d) => (d.value > m ? d.value : m),
    Number.NEGATIVE_INFINITY
  );
  return {
    series,
    latest,
    min: isFinite(min) ? min : null,
    max: isFinite(max) ? max : null,
  } as const;
}

export default async function SeriesPanel({
  spec,
  title,
  unit,
  className,
  format,
}: SeriesPanelProps) {
  const { series, latest, min, max } = await loadData(spec);

  const headline = latest
    ? format
      ? format(latest.value)
      : Intl.NumberFormat().format(latest.value)
    : "—";
  const sub = latest ? `${latest.year}${unit ? ` · ${unit}` : ""}` : "No data";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-4">
          <span>{title ?? "Series"}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {sub}
          </span>
        </CardTitle>
        <div className="mt-1 text-3xl font-semibold tracking-tight">
          {headline}
        </div>
        {min != null && max != null && (
          <div className="mt-1 text-xs text-muted-foreground">
            Range: {Intl.NumberFormat().format(min)} –{" "}
            {Intl.NumberFormat().format(max)}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {series.length ? (
          <Suspense>
            {/* Client-side chart for interactivity */}
            <SeriesChart data={series} unit={unit} />
          </Suspense>
        ) : (
          <div className="text-sm text-muted-foreground">
            No observations found for this selection.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
