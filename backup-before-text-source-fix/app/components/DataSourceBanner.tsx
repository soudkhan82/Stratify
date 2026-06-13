export default function DataSourceBanner() {
  return (
    <div className="border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-2">
        <p className="text-center text-[12px] font-medium leading-5 text-slate-500">
          Data sources: World Bank Open Data, FAOSTAT, IMF/WEO, UN datasets, and curated public datasets. Updated periodically for analytical use.
        </p>
      </div>
    </div>
  );
}
