import { buildMonetaryCategoryResponse } from "../_category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDICATORS = [
  {
    code: "PA.NUS.FCRF",
    label: "Official exchange rate",
    unit: "LCU per US$",
    category: "Exchange Rates",
  },
];

export async function GET(req: Request) {
  return buildMonetaryCategoryResponse(req, "Exchange Rates", INDICATORS);
}
