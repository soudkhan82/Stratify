// app/world/components/CountryHeader.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bug } from "lucide-react";

type Props = {
  countryTitle: string;
  region: string;

  indicatorLabel: string;
  indicatorCode: string;
  indicatorUnit: string; // can be "—" or empty

  wdiError: string | null;
  faoError: string | null;

  onBack: () => void;
  onDebug: () => void;
};

function isRealUnit(u: any) {
  const s = String(u ?? "").trim();
  return (
    !!s && s !== "—" && s.toLowerCase() !== "null" && s.toLowerCase() !== "none"
  );
}

export default function CountryHeader({
  countryTitle,
  region,
  indicatorLabel,
  indicatorCode,
  indicatorUnit,
  wdiError,
  faoError,
  onBack,
  onDebug,
}: Props) {
  const showUnit = isRealUnit(indicatorUnit);

  return (
    <div className="border-b bg-white">
      <div className="mx-auto max-w-5xl px-3 py-3">
        {/* Top row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {countryTitle}
            </div>
            <div className="text-xs text-slate-500 truncate">{region}</div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onDebug}
            >
              <Bug className="mr-2 h-4 w-4" />
              Debug
            </Button>
          </div>
        </div>

        {/* Indicator row (label left, unit right, vertically centered) */}
        <div className="mt-3 rounded-2xl border bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] tracking-widest text-slate-400">
                INDICATOR • {indicatorCode}
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate">
                {indicatorLabel}
              </div>
            </div>

            {showUnit ? (
              <div className="flex items-center justify-center">
                <Badge className="rounded-xl bg-slate-900 text-white px-3 py-1">
                  {String(indicatorUnit).trim()}
                </Badge>
              </div>
            ) : (
              <div className="w-[1px]" />
            )}
          </div>

          {wdiError || faoError ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {wdiError ? (
                <Badge className="bg-rose-600 text-white">
                  WDI: {wdiError}
                </Badge>
              ) : null}
              {faoError ? (
                <Badge className="bg-rose-600 text-white">
                  FAOSTAT: {faoError}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
