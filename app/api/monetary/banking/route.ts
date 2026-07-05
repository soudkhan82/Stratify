import { buildMonetaryCategoryResponse } from "../_category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDICATORS = [
  {
    code: "FS.AST.PRVT.GD.ZS",
    label: "Domestic credit to private sector by banks",
    unit: "% of GDP",
    category: "Banking / Credit",
  },
  {
    code: "FS.AST.DOMS.GD.ZS",
    label: "Domestic credit provided by financial sector",
    unit: "% of GDP",
    category: "Banking / Credit",
  },
  {
    code: "FB.AST.NPER.ZS",
    label: "Bank nonperforming loans",
    unit: "% of total gross loans",
    category: "Banking Health",
  },
  {
    code: "FB.BNK.CAPA.ZS",
    label: "Bank capital to assets ratio",
    unit: "%",
    category: "Banking Health",
  },
];

export async function GET(req: Request) {
  return buildMonetaryCategoryResponse(req, "Banking Health", INDICATORS);
}
