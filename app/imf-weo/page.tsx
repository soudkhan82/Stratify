import { redirect } from "next/navigation";

export default function IMFWeoRedirectPage() {
  redirect("/macro-finance?view=weo");
}