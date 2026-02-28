import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FISCAL_METRICS } from "./_lib/fiscalMeta";

export default function FiscalHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5">
          <div className="text-xs text-muted-foreground">
            KPI • Fiscal Space
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Budget Sustainability
          </h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Explore fiscal capacity, budget balance, and sustainability metrics
            (IMF WEO).
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FISCAL_METRICS.map((m) => (
            <Link key={m.slug} href={`/fiscal/${m.slug}`} className="block">
              <Card className="hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {m.subtitle}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Unit:</span>{" "}
                    <span className="font-medium">{m.unit}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {m.indicator_code
                      ? `Code: ${m.indicator_code}`
                      : "Not available yet (pending ingestion)"}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
