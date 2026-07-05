import { buildMonetaryCategoryResponse } from "../_category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDICATORS = [
  {
    code: "CM.MKT.LCAP.GD.ZS",
    label: "Market capitalization of listed domestic companies",
    unit: "% of GDP",
    category: "Capital Markets",
  },
  {
    code: "CM.MKT.LCAP.CD",
    label: "Market capitalization of listed domestic companies",
    unit: "current US$",
    category: "Capital Markets",
  },
  {
    code: "CM.MKT.LDOM.NO",
    label: "Listed domestic companies",
    unit: "count",
    category: "Capital Markets",
  },
  {
    code: "CM.MKT.TRAD.GD.ZS",
    label: "Stocks traded total value",
    unit: "% of GDP",
    category: "Capital Markets",
  },
  {
    code: "CM.MKT.TRNR",
    label: "Stocks traded turnover ratio",
    unit: "%",
    category: "Capital Markets",
  },
];

export async function GET(req: Request) {
  return buildMonetaryCategoryResponse(req, "Capital Markets", INDICATORS);
}
