import { buildMonetaryCategoryResponse } from "../_category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDICATORS = [
  {
    code: "FR.INR.LEND",
    label: "Lending interest rate",
    unit: "%",
    category: "Interest Rates",
  },
  {
    code: "FR.INR.DPST",
    label: "Deposit interest rate",
    unit: "%",
    category: "Interest Rates",
  },
  {
    code: "FR.INR.RINR",
    label: "Real interest rate",
    unit: "%",
    category: "Interest Rates",
  },
  {
    code: "FR.INR.LNDP",
    label: "Interest rate spread",
    unit: "%",
    category: "Interest Rates",
  },
];

export async function GET(req: Request) {
  return buildMonetaryCategoryResponse(req, "Interest Rates", INDICATORS);
}
