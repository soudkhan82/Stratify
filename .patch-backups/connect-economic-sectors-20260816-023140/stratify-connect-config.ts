export type ConnectSectorKey =
  | "agriculture"
  | "macro-finance"
  | "ngo-development"
  | "energy"
  | "professional-services"
  | "corporate";

export type ConnectCategory = {
  value: string;
  label: string;
  terms: string[];
};

export type ConnectSector = {
  value: ConnectSectorKey;
  label: string;
  description: string;
  categories: ConnectCategory[];
};

export const CONNECT_SECTORS: ConnectSector[] = [
  {
    value: "agriculture",
    label: "Agriculture",
    description:
      "Suppliers, processors, exporters, agri-inputs, dairy, livestock, storage and logistics.",
    categories: [
      {
        value: "all",
        label: "All agriculture",
        terms: [
          "agricultural supplier",
          "agricultural wholesaler",
          "food processor",
        ],
      },
      {
        value: "supplier",
        label: "Suppliers",
        terms: [
          "agricultural supplier",
          "farm supply company",
          "agricultural wholesaler",
        ],
      },
      {
        value: "exporter",
        label: "Exporters & traders",
        terms: [
          "agricultural exporter",
          "commodity trader",
          "food exporter",
        ],
      },
      {
        value: "processor",
        label: "Processors & mills",
        terms: [
          "food processor",
          "agricultural processor",
          "grain mill",
        ],
      },
      {
        value: "agri-inputs",
        label: "Agri-inputs",
        terms: [
          "fertilizer supplier",
          "seed supplier",
          "agricultural input supplier",
        ],
      },
      {
        value: "dairy",
        label: "Dairy",
        terms: [
          "dairy farm",
          "dairy company",
          "milk producer",
        ],
      },
      {
        value: "livestock",
        label: "Livestock",
        terms: [
          "livestock farm",
          "cattle farm",
          "livestock supplier",
        ],
      },
      {
        value: "logistics",
        label: "Storage & logistics",
        terms: [
          "agricultural logistics",
          "cold storage",
          "food warehouse",
        ],
      },
    ],
  },
  {
    value: "macro-finance",
    label: "Macro & Finance",
    description:
      "Banks, accounting, tax, investment, insurance and financial advisory.",
    categories: [
      {
        value: "all",
        label: "All finance",
        terms: [
          "bank",
          "accounting firm",
          "financial consultant",
        ],
      },
      {
        value: "banking",
        label: "Banks & microfinance",
        terms: [
          "commercial bank",
          "microfinance bank",
          "investment bank",
        ],
      },
      {
        value: "accounting",
        label: "Accounting, audit & tax",
        terms: [
          "accounting firm",
          "audit firm",
          "tax consultant",
        ],
      },
      {
        value: "investment",
        label: "Investment & advisory",
        terms: [
          "investment company",
          "asset management company",
          "financial advisor",
        ],
      },
      {
        value: "insurance",
        label: "Insurance",
        terms: [
          "insurance company",
          "insurance broker",
          "insurance agency",
        ],
      },
    ],
  },
  {
    value: "ngo-development",
    label: "NGO & Development",
    description:
      "Nonprofits, charities, humanitarian groups, foundations and development organizations.",
    categories: [
      {
        value: "all",
        label: "All NGOs",
        terms: [
          "nonprofit organization",
          "NGO",
          "charity",
        ],
      },
      {
        value: "humanitarian",
        label: "Humanitarian",
        terms: [
          "humanitarian organization",
          "relief organization",
          "international NGO",
        ],
      },
      {
        value: "development",
        label: "Development",
        terms: [
          "development organization",
          "community development organization",
          "development foundation",
        ],
      },
      {
        value: "health",
        label: "Health",
        terms: [
          "health NGO",
          "public health nonprofit",
          "medical charity",
        ],
      },
      {
        value: "education",
        label: "Education",
        terms: [
          "education NGO",
          "education foundation",
          "education nonprofit",
        ],
      },
    ],
  },
  {
    value: "energy",
    label: "Energy",
    description:
      "Utilities, renewable energy, EPC, oil & gas and energy services.",
    categories: [
      {
        value: "all",
        label: "All energy",
        terms: [
          "energy company",
          "solar company",
          "power utility",
        ],
      },
      {
        value: "renewables",
        label: "Renewables",
        terms: [
          "renewable energy company",
          "solar energy company",
          "wind energy company",
        ],
      },
      {
        value: "oil-gas",
        label: "Oil & gas",
        terms: [
          "oil and gas company",
          "petroleum company",
          "oilfield services company",
        ],
      },
      {
        value: "epc",
        label: "EPC & engineering",
        terms: [
          "EPC contractor",
          "energy engineering company",
          "power engineering company",
        ],
      },
    ],
  },
  {
    value: "professional-services",
    label: "Professional Services",
    description:
      "Consulting, legal, engineering, accounting and technology services.",
    categories: [
      {
        value: "all",
        label: "All professional services",
        terms: [
          "management consulting firm",
          "law firm",
          "engineering consultant",
        ],
      },
      {
        value: "consulting",
        label: "Consulting",
        terms: [
          "management consulting firm",
          "business consultant",
          "strategy consulting firm",
        ],
      },
      {
        value: "legal",
        label: "Legal",
        terms: [
          "law firm",
          "corporate lawyer",
          "legal consultant",
        ],
      },
      {
        value: "engineering",
        label: "Engineering",
        terms: [
          "engineering consultant",
          "engineering company",
          "technical consulting firm",
        ],
      },
      {
        value: "technology",
        label: "Technology",
        terms: [
          "IT consulting company",
          "software company",
          "technology services company",
        ],
      },
    ],
  },
  {
    value: "corporate",
    label: "Corporate",
    description:
      "Company offices, manufacturers, industrial businesses and commercial organizations.",
    categories: [
      {
        value: "all",
        label: "All corporate",
        terms: [
          "company headquarters",
          "manufacturer",
          "industrial company",
        ],
      },
      {
        value: "manufacturing",
        label: "Manufacturing",
        terms: [
          "manufacturer",
          "manufacturing company",
          "industrial manufacturer",
        ],
      },
      {
        value: "headquarters",
        label: "Headquarters & offices",
        terms: [
          "company headquarters",
          "corporate office",
          "business office",
        ],
      },
    ],
  },
];

export function getConnectSector(
  value: string | null | undefined,
) {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  return (
    CONNECT_SECTORS.find(
      (sector) =>
        sector.value ===
        normalized,
    ) ??
    CONNECT_SECTORS[0]
  );
}

export function getConnectCategory(
  sectorValue: string | null | undefined,
  categoryValue: string | null | undefined,
) {
  const sector =
    getConnectSector(
      sectorValue,
    );

  const normalized =
    String(
      categoryValue ?? "",
    )
      .trim()
      .toLowerCase();

  return (
    sector.categories.find(
      (category) =>
        category.value ===
        normalized,
    ) ??
    sector.categories[0]
  );
}

function cleanQuery(
  value: string | null | undefined,
) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function buildConnectQueries({
  sector,
  category,
  tag,
  q,
}: {
  sector: string;
  category?: string | null;
  tag?: string | null;
  q?: string | null;
}) {
  const explicit =
    cleanQuery(q);

  if (explicit) {
    return [
      {
        label: "Search",
        text: explicit,
      },
    ];
  }

  const sectorConfig =
    getConnectSector(
      sector,
    );
  const categoryConfig =
    getConnectCategory(
      sector,
      category,
    );
  const tagText =
    cleanQuery(tag);

  if (
    sectorConfig.value ===
      "agriculture" &&
    (
      categoryConfig.value ===
        "dairy" ||
      categoryConfig.value ===
        "livestock"
    )
  ) {
    return categoryConfig.terms
      .slice(0, 3)
      .map(
        (
          term,
          index,
        ) => ({
          label:
            categoryConfig.value ===
            "dairy"
              ? [
                  "Dairy farm",
                  "Dairy company",
                  "Milk producer",
                ][index] ??
                categoryConfig.label
              : [
                  "Livestock farm",
                  "Cattle farm",
                  "Livestock supplier",
                ][index] ??
                categoryConfig.label,
          text: term,
        }),
      );
  }

  if (
    sectorConfig.value ===
      "agriculture" &&
    tagText
  ) {
    const crop =
      tagText.replace(
        /[-_]+/g,
        " ",
      );

    const categoryValue =
      categoryConfig.value;

    if (
      categoryValue ===
      "supplier"
    ) {
      return [
        {
          label: "Supplier",
          text: `${crop} supplier`,
        },
        {
          label: "Wholesaler",
          text: `${crop} wholesaler`,
        },
        {
          label: "Trader",
          text: `${crop} trader`,
        },
      ];
    }

    if (
      categoryValue ===
      "exporter"
    ) {
      return [
        {
          label: "Exporter",
          text: `${crop} exporter`,
        },
        {
          label: "Trader",
          text: `${crop} trader`,
        },
        {
          label: "Commodity company",
          text: `${crop} commodity company`,
        },
      ];
    }

    if (
      categoryValue ===
      "processor"
    ) {
      return [
        {
          label: "Processor",
          text: `${crop} processor`,
        },
        {
          label: "Mill",
          text: `${crop} mill`,
        },
        {
          label: "Manufacturer",
          text: `${crop} manufacturer`,
        },
      ];
    }

    return [
      {
        label: "Supplier",
        text: `${crop} supplier`,
      },
      {
        label: "Processor",
        text: `${crop} processor`,
      },
      {
        label: "Exporter",
        text: `${crop} exporter`,
      },
    ];
  }

  if (tagText) {
    const specialty = tagText.replace(/[-_]+/g, " ");
    const candidates = [
      specialty,
      `${specialty} company`,
      categoryConfig.terms[0],
    ]
      .map((value) => cleanQuery(value))
      .filter(Boolean);

    return Array.from(new Set(candidates))
      .slice(0, 3)
      .map((text, index) => ({
        label: index === 0 ? "Specialty" : categoryConfig.label,
        text,
      }));
  }

  const labels: Record<
    string,
    string[]
  > = {
    "agri-inputs": [
      "Fertilizer",
      "Seed",
      "Agri-inputs",
    ],
    dairy: [
      "Dairy farm",
      "Dairy company",
      "Milk producer",
    ],
    livestock: [
      "Livestock farm",
      "Cattle farm",
      "Livestock supplier",
    ],
    logistics: [
      "Logistics",
      "Cold storage",
      "Warehouse",
    ],
    banking: [
      "Commercial bank",
      "Microfinance",
      "Investment bank",
    ],
    accounting: [
      "Accounting",
      "Audit",
      "Tax",
    ],
    investment: [
      "Investment",
      "Asset management",
      "Financial advisory",
    ],
    insurance: [
      "Insurance",
      "Insurance broker",
      "Insurance agency",
    ],
    humanitarian: [
      "Humanitarian",
      "Relief",
      "International NGO",
    ],
    development: [
      "Development",
      "Community development",
      "Foundation",
    ],
    health: [
      "Health NGO",
      "Health nonprofit",
      "Medical charity",
    ],
    education: [
      "Education NGO",
      "Education foundation",
      "Education nonprofit",
    ],
    renewables: [
      "Renewable energy",
      "Solar",
      "Wind",
    ],
    "oil-gas": [
      "Oil & gas",
      "Petroleum",
      "Oilfield services",
    ],
    epc: [
      "EPC",
      "Energy engineering",
      "Power engineering",
    ],
    consulting: [
      "Management consulting",
      "Business consulting",
      "Strategy consulting",
    ],
    legal: [
      "Law firm",
      "Corporate legal",
      "Legal consulting",
    ],
    engineering: [
      "Engineering consulting",
      "Engineering company",
      "Technical consulting",
    ],
    technology: [
      "IT consulting",
      "Software company",
      "Technology services",
    ],
    manufacturing: [
      "Manufacturer",
      "Manufacturing",
      "Industrial manufacturer",
    ],
    headquarters: [
      "Headquarters",
      "Corporate office",
      "Business office",
    ],
  };

  const categoryLabels =
    labels[
      categoryConfig.value
    ];

  return categoryConfig.terms
    .slice(0, 3)
    .map(
      (
        term,
        index,
      ) => ({
        label:
          categoryLabels?.[
            index
          ] ??
          categoryConfig.label,
        text: term,
      }),
    );
}

