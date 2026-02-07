// app/faostat/explore/page.tsx
import { Suspense } from "react";
import ExploreClient from "./ExploreClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070A12] p-6 text-white/80">
          Loading Explore…
        </div>
      }
    >
      <ExploreClient />
    </Suspense>
  );
}
