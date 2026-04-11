export type PolicySector = {
  key: string;
  label: string;
  description: string;
  shortIntro: string;
  accentClass: string;
};

export const POLICY_SECTORS: PolicySector[] = [
  {
    key: "health",
    label: "Health",
    description:
      "Healthcare access, public health programs, and system performance indicators.",
    shortIntro: "Healthcare systems, access, outcomes, and reform programs.",
    accentClass: "text-emerald-400",
  },
  {
    key: "fiscal",
    label: "Fiscal",
    description:
      "Government revenue, spending, debt, and macroeconomic stability.",
    shortIntro: "Budgets, taxation, debt, and fiscal reform priorities.",
    accentClass: "text-cyan-400",
  },
  {
    key: "financial",
    label: "Financial",
    description:
      "Banking access, financial inclusion, and capital market depth.",
    shortIntro: "Financial inclusion, credit systems, and market development.",
    accentClass: "text-violet-400",
  },
  {
    key: "trade",
    label: "Trade",
    description:
      "Exports, imports, competitiveness, and trade-related policy direction.",
    shortIntro: "Trade flows, openness, and export-oriented programs.",
    accentClass: "text-amber-400",
  },
  {
    key: "education",
    label: "Education",
    description:
      "School access, learning systems, skills, and education sector priorities.",
    shortIntro: "Enrollment, learning access, and human capital investment.",
    accentClass: "text-pink-400",
  },
];
