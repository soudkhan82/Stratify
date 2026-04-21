import type { CountryOption, PolicyFiltersState } from "../_types/policy";

type Props = {
  filters: PolicyFiltersState;
  regions: string[];
  countries: CountryOption[];
  sectorOptions: string[];
  kindOptions: string[];
  loading?: boolean;
  onChange: <K extends keyof PolicyFiltersState>(
    key: K,
    value: PolicyFiltersState[K],
  ) => void;
  onReset: () => void;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PolicyFilters({
  filters,
  regions,
  countries,
  sectorOptions,
  kindOptions,
  loading,
  onChange,
  onReset,
}: Props) {
  return (
    <aside className="sticky top-4 rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Control panel
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
          Refine intelligence
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Tight filters for geography, taxonomy, and search.
        </p>
      </div>

      <div className="space-y-4 px-5 py-5">
        <SelectField
          label="Region"
          value={filters.region}
          options={regions}
          onChange={(value) => onChange("region", value)}
        />

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Country
          </span>
          <select
            value={filters.country}
            onChange={(e) => onChange("country", e.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          >
            <option value="All">All</option>
            {countries.map((country) => (
              <option key={country.iso3} value={country.iso3}>
                {country.country}
              </option>
            ))}
          </select>
        </label>

        <SelectField
          label="Sector"
          value={filters.sector}
          options={sectorOptions}
          onChange={(value) => onChange("sector", value)}
        />

        <SelectField
          label="Program kind"
          value={filters.kind}
          options={kindOptions}
          onChange={(value) => onChange("kind", value)}
        />

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Search program
          </span>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange("search", e.target.value)}
            placeholder="Search by name, key, sector, kind..."
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>

          <div className="flex h-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-medium text-white">
            {loading ? "Loading..." : "Filters ready"}
          </div>
        </div>
      </div>
    </aside>
  );
}
