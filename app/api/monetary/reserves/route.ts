import { buildMonetaryCategoryResponse } from "../_category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDICATORS = [
  {
    code: "FI.RES.TOTL.CD",
    label: "Total reserves including gold",
    unit: "current US$",
    category: "FX Reserves",
  },
  {
    code: "FI.RES.XGLD.CD",
    label: "Total reserves excluding gold",
    unit: "current US$",
    category: "FX Reserves",
  },
  {
    code: "FI.RES.TOTL.MO",
    label: "Total reserves in months of imports",
    unit: "months",
    category: "FX Reserves",
  },
];

export async function GET(req: Request) {
  return buildMonetaryCategoryResponse(req, "FX Reserves", INDICATORS);
}
