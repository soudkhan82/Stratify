"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Interest Payments (% of Revenue)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This indicator is not available in your current WEO dataset yet.
            Once the indicator code is ingested, this page will automatically
            work using the existing API route.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
