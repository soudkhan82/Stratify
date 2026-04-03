export default function DashboardLoading() {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-800 bg-black px-8 py-10 shadow-2xl">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-white" />
        <div className="text-center">
          <p className="text-base font-semibold text-white">
            Loading dashboard...
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Fetching fiscal data and preparing visuals
          </p>
        </div>
      </div>
    </div>
  );
}
