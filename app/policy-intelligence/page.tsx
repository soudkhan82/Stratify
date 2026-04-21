"use client";

import EmptyPolicyState from "./_components/EmptyPolicyState";
import PolicyDetailPanel from "./_components/PolicyDetailPanel";
import PolicyFilters from "./_components/PolicyFilters";
import PolicyKpiGrid from "./_components/PolicyKpiGrid";
import PolicyPageHeader from "./_components/PolicyPageHeader";
import PolicyProgramsList from "./_components/PolicyProgramsList";
import { usePolicyDashboard } from "./_hooks/usePolicyDashboard";

export default function PolicyIntelligencePage() {
  const {
    filters,
    regions,
    availableCountries,
    sectorOptions,
    kindOptions,
    filteredPrograms,
    selectedProgram,
    selectedProgramKey,
    selectedCountryMeta,
    summarySource,
    cif,
    kpis,
    loadingFilters,
    loadingSummary,
    loadingCif,
    filtersError,
    summaryError,
    cifError,
    updateFilter,
    resetFilters,
    setSelectedProgramKey,
  } = usePolicyDashboard();

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 xl:px-8">
        <div className="space-y-4">
          <PolicyPageHeader
            resultCount={filteredPrograms.length}
            summarySource={summarySource}
          />

          {(filtersError || summaryError) && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              {filtersError || summaryError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <PolicyFilters
              filters={filters}
              regions={regions.length ? regions : ["All"]}
              countries={availableCountries}
              sectorOptions={sectorOptions}
              kindOptions={kindOptions}
              loading={loadingFilters || loadingSummary}
              onChange={updateFilter}
              onReset={resetFilters}
            />

            <div className="space-y-4">
              <PolicyKpiGrid kpis={kpis} />

              {loadingSummary ? (
                <EmptyPolicyState
                  title="Loading dashboard"
                  message="Please wait while policy programs and summary metrics are being fetched."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
                  <PolicyProgramsList
                    programs={filteredPrograms}
                    selectedProgramKey={selectedProgramKey}
                    onSelect={setSelectedProgramKey}
                  />

                  <PolicyDetailPanel
                    program={selectedProgram}
                    selectedCountryMeta={selectedCountryMeta}
                    cif={cif}
                    loadingCif={loadingCif}
                    cifError={cifError}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
