import GeoDashboard from "@/components/geoDashboard";
import Image from "next/image";

export const revalidate = 60 * 60 * 24;

export default function Page() {
  return (
    <main className="p-4 space-y-8">
      <GeoDashboard />
    </main>
  );
}
