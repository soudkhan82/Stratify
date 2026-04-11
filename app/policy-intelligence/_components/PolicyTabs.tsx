"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PolicySector } from "../_lib/sector-config";

type Props = {
  value: string;
  onChange: (val: string) => void;
  sectors: PolicySector[];
};

export default function PolicyTabs({ value, onChange, sectors }: Props) {
  return (
    <Tabs value={value} onValueChange={onChange} className="w-full">
      <TabsList className="w-full flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm h-auto">
        {sectors.map((sector) => (
          <TabsTrigger
            key={sector.key}
            value={sector.key}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700 transition data-[state=active]:bg-[#0ea75a] data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            {sector.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
