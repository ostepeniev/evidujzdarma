import Link from "next/link";
import { HELP_CLOSED_NOTE, getHelpArticle, helpIndexable } from "@/content/napoveda";
import type { HelpStep } from "@/content/napoveda/types";
import { SITE } from "@/lib/site";
import { RichText } from "./rich-text";
import { ToolCta } from "./tool-cta";

/** Dokud je pokladna zavřená, nápověda popisuje, jak bude fungovat (S2-A, R17). Po otevření se nevypisuje. */
export function HelpClosedNote() {
  if (helpIndexable()) return null;
  return (
    <p role="note" className="border-b border-sun-200 bg-sun-100 px-4 py-2 text-center text-[15px] font-semibold text-warn-700">
      {HELP_CLOSED_NOTE}
    </p>
  );
}

/** Postup krok za krokem – číslované kroky s nadpisem a textem. */
export function HelpSteps({ steps, heading = "Postup" }: { steps: readonly HelpStep[]; heading?: string }) {
  return (
    <section id="postup" className="not-prose mt-10 scroll-mt-24" aria-labelledby="postup-h">
      <h2 id="postup-h" className="mb-5 text-2xl font-bold text-ink">
        {heading}
      </h2>
      <ol className="space-y-5">
        {steps.map((s, i) => (
          <li key={s.name} className="flex gap-4">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <h3 className="text-lg font-semibold text-ink">{s.name}</h3>
              <p className="mt-1 text-base leading-relaxed text-ink-soft [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2">
                <RichText text={s.text} />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Související články nápovědy (karty). */
export function RelatedHelp({ slugs, title = "Související články nápovědy" }: { slugs: readonly string[]; title?: string }) {
  const items = slugs.map(getHelpArticle).filter((a): a is NonNullable<typeof a> => !!a);
  if (!items.length) return null;
  return (
    <section aria-labelledby="souvisejici-napoveda">
      <h2 id="souvisejici-napoveda" className="text-2xl font-bold">
        {title}
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <li key={a.slug}>
            <Link href={`/napoveda/${a.slug}`} className="card block h-full hover:border-brand-200">
              <p className="font-semibold text-ink">{a.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{a.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Kontakt na podporu na konci každé stránky nápovědy. */
export function HelpContact() {
  return (
    <aside className="rounded-2xl border border-line bg-surface p-6" aria-label="Kontakt na podporu">
      <p className="text-lg font-semibold text-ink">Nenašli jste odpověď?</p>
      <p className="mt-1 text-base text-ink-soft">
        Napište nám na{" "}
        <a href={`mailto:${SITE.email}`} className="font-medium text-brand-700 underline underline-offset-2">
          {SITE.email}
        </a>
        . Co do zprávy napsat, radí článek{" "}
        <Link href="/napoveda/podpora" className="font-medium text-brand-700 underline underline-offset-2">
          Podpora a kontakt
        </Link>
        .
      </p>
    </aside>
  );
}

/**
 * Výzva k akci na konci nápovědy. Dokud je pokladna zavřená, na ni web neodkazuje (eet-open-site) – zve k předregistraci;
 * po otevření vede rovnou do pokladny a do nastavení.
 */
export function HelpCta() {
  if (!helpIndexable()) return <ToolCta />;
  return (
    <aside className="mt-12 rounded-2xl bg-brand-700 p-8 text-white sm:p-10">
      <h2 className="text-2xl font-bold sm:text-3xl">Vyzkoušejte to v pokladně</h2>
      <p className="mt-2 max-w-2xl text-lg text-brand-100">Pokladna EvidujZdarma je zdarma. Přihlásíte se e-mailem, bez hesla.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/pokladna" className="btn bg-white text-brand-700 hover:bg-brand-50">
          Otevřít pokladnu
        </Link>
        <Link href="/pokladna/nastaveni" className="btn border border-brand-200/40 text-white hover:bg-brand-600">
          Nastavení pokladny
        </Link>
      </div>
    </aside>
  );
}
