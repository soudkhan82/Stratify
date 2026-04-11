type Props = {
  title: string;
  description: string;
  shortIntro?: string;
  accentClass?: string;
};

export default function SectorIntro({
  title,
  description,
  shortIntro,
  accentClass = "text-slate-900",
}: Props) {
  return (
    <div className="ws-card-soft p-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Active sector
          </p>
          <h2 className={`mt-1 text-2xl font-semibold ${accentClass}`}>
            {title}
          </h2>
        </div>

        {shortIntro ? <span className="ws-chip">{shortIntro}</span> : null}
      </div>

      <p className="text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
