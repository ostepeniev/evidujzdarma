import { EFFECTIVE_DATE, TIMELINE, daysUntil } from "@/content/facts";

export function Countdown({ now = new Date() }: { now?: Date }) {
  const days = daysUntil(EFFECTIVE_DATE, now);
  return (
    <div className="inline-flex items-baseline gap-2 rounded-2xl bg-sun-100 px-5 py-3">
      <span className="text-4xl font-extrabold tabular-nums text-ink">{days}</span>
      <span className="text-base font-medium text-ink-soft">{days === 1 ? "den" : days >= 2 && days <= 4 ? "dny" : "dní"} do povinné evidence (1. 1. 2027)</span>
    </div>
  );
}

export function Timeline({ now = new Date() }: { now?: Date }) {
  const today = now.toISOString().slice(0, 10);
  const nextIdx = TIMELINE.findIndex((t) => t.date >= today);
  return (
    <ol className="relative grid gap-4 md:grid-cols-5">
      {TIMELINE.map((t, i) => {
        const past = t.date < today;
        const next = i === nextIdx;
        return (
          <li
            key={t.date}
            className={`rounded-2xl border p-5 ${next ? "border-brand-500 bg-brand-50" : past ? "border-line bg-surface opacity-70" : "border-line bg-white"}`}
          >
            <time dateTime={t.date} className={`text-sm font-bold ${next ? "text-brand-700" : "text-muted"}`}>
              {t.dateLabel}
            </time>
            <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{t.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t.action}</p>
            {next && <span className="chip mt-3 bg-brand-600 text-white">Nejbližší termín</span>}
          </li>
        );
      })}
    </ol>
  );
}
