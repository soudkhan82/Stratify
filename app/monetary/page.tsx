import { redirect } from "next/navigation";

export default function MonetaryLegacyPage() {
  redirect("/macro-finance?view=monetary");
}
