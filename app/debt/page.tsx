import { redirect } from "next/navigation";

export default function DebtLegacyPage() {
  redirect("/macro-finance?view=debt");
}
