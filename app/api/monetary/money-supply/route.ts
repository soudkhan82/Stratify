import { buildMonetaryCategoryResponse } from "../_category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDICATORS = [
  {
    code: "FM.LBL.BMNY.GD.ZS",
    label: "Broad money",
    unit: "% of GDP",
    category: "Money Supply",
  },
  {
    code: "FM.LBL.BMNY.ZG",
    label: "Broad money growth",
    unit: "annual %",
    category: "Money Supply",
  },
];

export async function GET(req: Request) {
  return buildMonetaryCategoryResponse(req, "Money Supply", INDICATORS);
}
