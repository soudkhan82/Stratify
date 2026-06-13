import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FISCAL_METRICS } from "./_lib/fiscalMeta";

const cleanText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/â€¢/g, "|")
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/[Â�]/g, "")
    .replace(/[€£¥¢©®™§¶]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const FISCAL_SOURCE_NOTE = cleanText(
  "Data sources: IMF World Economic Outlook (WEO), IMF Government Finance Statistics (GFS), IMF Fiscal Monitor, World Bank World Development Indicators (WDI), World Bank International Debt Statistics (IDS), and UN National Accounts / UNData. Updated periodically for analytical use.",
);

export default function FiscalHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full border-b border-slate-200 bg-white px-6 py-2 text-[12px] font-semibold text-slate-600">
        {FISCAL_SOURCE_NOTE}
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5">
          <div className="text-xs text-muted-foreground">
            {cleanText("KPI | Fiscal Space")}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {cleanText("Budget Sustainability")}
          </h1>

          <div className="mt-1 text-sm text-muted-foreground">
            {cleanText(
              "Explore fiscal capacity, budget balance, and sustainability metrics using IMF WEO, IMF GFS, IMF Fiscal Monitor, World Bank WDI, World Bank IDS, and UN National Accounts / UNData.",
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FISCAL_METRICS.map((m) => (
            <Link
              key={m.slug}
              href={`/fiscal/${m.slug}`}
              prefetch={false}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {cleanText(m.title)}
                  </CardTitle>

                  <div className="text-xs text-muted-foreground">
                    {cleanText(m.subtitle)}
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Unit:</span>{" "}
                    <span className="font-medium">{cleanText(m.unit)}</span>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {cleanText(`Code: ${m.indicator_code}`)}
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
