"use client";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Props = {
  region: string;
  onRegionChange: (value: string) => void;
  yearRange: string;
  onYearRangeChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  countryOptions: string[];
  evidenceFilter: string;
  onEvidenceFilterChange: (value: string) => void;
  regionOptions: string[];
};

type SelectBoxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
};

function SelectBox({ value, onChange, options, placeholder }: SelectBoxProps) {
  const safeOptions = options.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );

  const safeValue =
    safeOptions.length > 0 && safeOptions.includes(value) ? value : undefined;

  return (
    <Select
      value={safeValue}
      onValueChange={onChange}
      disabled={safeOptions.length === 0}
    >
      <SelectTrigger className="h-11 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SelectValue
          placeholder={
            safeOptions.length === 0 ? `No ${placeholder}` : placeholder
          }
        />
      </SelectTrigger>

      <SelectContent>
        {safeOptions.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function PolicyFilters({
  region,
  onRegionChange,
  yearRange,
  onYearRangeChange,
  country,
  onCountryChange,
  countryOptions,
  evidenceFilter,
  onEvidenceFilterChange,
  regionOptions,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SelectBox
        value={region}
        onChange={onRegionChange}
        options={regionOptions}
        placeholder="Region"
      />

      <SelectBox
        value={yearRange}
        onChange={onYearRangeChange}
        options={["2000 - 2024", "2005 - 2024", "2010 - 2024", "2020 - 2024"]}
        placeholder="Year range"
      />

      <SelectBox
        value={country}
        onChange={onCountryChange}
        options={countryOptions}
        placeholder="Country"
      />

      <SelectBox
        value={evidenceFilter}
        onChange={onEvidenceFilterChange}
        options={["All evidence", "Quantitative", "Qualitative", "Mixed"]}
        placeholder="Evidence"
      />
    </div>
  );
}
