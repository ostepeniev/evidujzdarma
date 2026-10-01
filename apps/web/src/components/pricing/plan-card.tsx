import Link from "next/link";
import { FEATURE_MATRIX, STATUS_LABEL, type Addon, type Plan } from "@/content/pricing";

function Check({ className = "text-brand-600" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${className}`}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function StatusChip({ status }: { status: Plan["status"] }) {
  const tone = status === "prereg" ? "bg-brand-100 text-brand-700" : status === "later" ? "bg-surface-2 text-ink-soft" : "bg-sun-100 text-ink";
  return <span className={`chip ${tone}`}>{STATUS_LABEL[status]}</span>;
}

export function PlanCard({ plan }: { plan: Plan }) {
  const headingId = `plan-${plan.id}`;
  return (
    <section
      aria-labelledby={headingId}
      className={`flex h-full flex-col rounded-2xl border bg-white p-6 sm:p-8 ${plan.highlight ? "border-2 border-brand-500 shadow-sm" : "border-line"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-2xl font-bold text-ink">
          {plan.name}
        </h3>
        <StatusChip status={plan.status} />
      </div>
      <p className="mt-2 text-[15px] text-ink-soft">{plan.tagline}</p>
      <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{plan.priceLabel}</span>
        {plan.period && <span className="text-lg text-muted">{plan.period}</span>}
      </p>
      {plan.alt && <p className="mt-1 text-[15px] text-ink-soft">{plan.alt}</p>}
      <ul className="mt-6 flex-1 space-y-2.5 text-[15px] text-ink">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={plan.cta.href} className={`mt-8 w-full ${plan.highlight ? "btn-primary" : "btn-secondary"}`}>
        {plan.cta.label}
      </Link>
    </section>
  );
}

export function AddonCard({ addon }: { addon: Addon }) {
  const headingId = `addon-${addon.id}`;
  return (
    <section aria-labelledby={headingId} className="card flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-xl font-bold text-ink">
          {addon.name}
        </h3>
        <StatusChip status={addon.status} />
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-extrabold tracking-tight text-ink">{addon.priceLabel}</span>
        {addon.period && <span className="text-base text-muted">{addon.period}</span>}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{addon.text}</p>
      {addon.bullets && (
        <ul className="mt-4 flex-1 space-y-2 text-[15px] text-ink">
          {addon.bullets.map((b) => (
            <li key={b} className="flex gap-2.5">
              <Check />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={addon.cta.href} className="btn-ghost mt-6 self-start px-0 hover:bg-transparent hover:underline">
        {addon.cta.label} →
      </Link>
    </section>
  );
}

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return (
      <span className="inline-flex items-center gap-1 text-brand-700">
        <Check className="text-brand-600" />
        <span className="sr-only">Ano</span>
      </span>
    );
  if (value === false)
    return (
      <span className="text-muted">
        <span aria-hidden="true">–</span>
        <span className="sr-only">Ne</span>
      </span>
    );
  return <span className="font-medium text-ink">{value}</span>;
}

export function FeatureMatrix() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[480px] border-collapse text-left">
        <caption className="sr-only">Srovnání tarifů Zdarma a Premium</caption>
        <thead>
          <tr className="bg-surface">
            <th scope="col" className="px-4 py-3 text-sm font-semibold text-ink-soft">
              Funkce
            </th>
            <th scope="col" className="bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
              Zdarma
            </th>
            <th scope="col" className="px-4 py-3 text-sm font-semibold text-ink-soft">
              Premium
            </th>
          </tr>
        </thead>
        <tbody>
          {FEATURE_MATRIX.map((r) => (
            <tr key={r.feature} className="border-t border-line">
              <th scope="row" className="px-4 py-3 text-[15px] font-medium text-ink">
                {r.feature}
              </th>
              <td className="bg-brand-50/50 px-4 py-3 text-[15px]">
                <Cell value={r.free} />
              </td>
              <td className="px-4 py-3 text-[15px]">
                <Cell value={r.premium} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
