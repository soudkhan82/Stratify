export default function DataSourceBanner() {
  return (
    <div className="relative z-[999] border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-2">
        <p className="text-center text-[12px] font-semibold leading-5 text-slate-600">
          Data sources: World Bank Open Data, FAOSTAT, IMF/WEO, UN datasets, and
          curated public datasets. Updated periodically for analytical use.
        </p>
      </div>
    </div>
  );
}
