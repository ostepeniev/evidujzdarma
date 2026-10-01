import { LAW_HISTORY } from "@/content/facts";

/** Historie zákona o evidenci tržeb – od konceptu MF po podpis prezidenta. */
export function LawHistory() {
  return (
    <ol className="relative space-y-5 border-l-2 border-brand-100 pl-6">
      {LAW_HISTORY.map((s) => (
        <li key={s.date} className="relative">
          <span aria-hidden="true" className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
          <time dateTime={s.date} className="text-sm font-bold text-brand-700">
            {s.dateLabel}
          </time>
          <p className="mt-0.5 text-base text-ink">{s.text}</p>
          <a href={s.source.url} rel="noopener" target="_blank" className="text-sm text-muted underline decoration-line underline-offset-2 hover:text-brand-700">
            {s.source.label}
          </a>
        </li>
      ))}
    </ol>
  );
}
