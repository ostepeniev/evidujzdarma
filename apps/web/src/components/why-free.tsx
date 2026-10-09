import Link from "next/link";
import { WHY_FREE } from "@/content/why-free";
import { SERVICE_COPY } from "@/lib/site";
import { RichText } from "./rich-text";

/** „Proč je to zdarma? A kde je háček?“ – úvodní stránka pod prvním obrazovkou (R14.1). */
export function WhyFree() {
  return (
    <section className="container-page py-16" aria-labelledby="zdarma">
      <h2 id="zdarma" className="text-3xl font-bold tracking-tight sm:text-4xl">
        {WHY_FREE.title}
      </h2>
      <p className="mt-2 text-lg text-ink-soft">{WHY_FREE.intro}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {WHY_FREE.cards.map((c) => (
          <div key={c.title} className="card">
            <h3 className="text-lg font-semibold">{c.title}</h3>
            <p className="mt-2 text-ink-soft [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-4">
              <RichText text={c.text} />
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href={SERVICE_COPY.startCta.href} className="btn-primary">
          {SERVICE_COPY.startCta.label}
        </Link>
        <p className="text-[15px] text-muted">{WHY_FREE.guarantee}</p>
      </div>
    </section>
  );
}
