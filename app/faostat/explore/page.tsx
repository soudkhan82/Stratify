"use client";

import { useSearchParams } from "next/navigation";

export default function ExploreFaostat() {
  const sp = useSearchParams();
  const dataset = sp.get("dataset") || "production";
  return (
    <div className="min-h-screen bg-[#070A12] p-6 text-white/80">
      Explore page placeholder. Dataset:{" "}
      <span className="font-semibold">{dataset}</span>
    </div>
  );
}
