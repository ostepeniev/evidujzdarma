import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "@/components/external-link";
import { PageHeader } from "@/components/page-header";
import { FACTS, FACTS_UPDATED, TIMELINE } from "@/content/facts";
import { SETUP_SERVICE } from "@/content/services";
import { canonicalMeta } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "EET 2.0 v kostce – přehled pro klienty účetních",
  description:
    "Jedna stránka pro podnikatele: termíny EET 2.0, co udělat v DIS+, jakou pokladnu zvolit a kdo může zvolit EET OFF. Účetní ji mohou poslat klientům nebo vytisknout.",
  ...canonicalMeta("/ucetni/pro-klienty"),
};

/**
 * S11 (3. 11. 2026): „Balíček pro klienty“ – jednostránkový přehled, který účetní pošle klientovi (místo webináře).
 * Jen fakta z content/facts.ts se zdroji (inv. 8); bez strašení pokutami a bez jmen konkurence.
 */
const STEPS: readonly { title: string; text: string }[] = [
  {
    title: "V DIS+ se přihlaste k evidenci",
    text: "V daňovém portálu MOJE daně (DIS+) se přihlásíte k evidenci tržeb a oznámíte evidenční jednotky – provozovny, e-shop nebo třeba mobilní prodej.",
  },
  {
    title: "Vygenerujte pokladní certifikát",
    text: FACTS.certificate.summary,
  },
  {
    title: "Vyberte pokladnu a vyzkoušejte ji",
    text: "Státní aplikace MOJE eet, pokladna EvidujZdarma (zdarma, funguje i bez signálu) nebo jiný pokladní systém. Test naplánujte na prosinec.",
  },
];

export default function ClientOnePagerPage() {
  return (
    <>
      <PageHeader
        title="EET 2.0 v kostce"
        crumbs={[
          { name: "Pro účetní", path: "/ucetni" },
          { name: "EET 2.0 v kostce pro klienty", path: "/ucetni/pro-klienty" },
        ]}
        lead={`Evidence tržeb platí od ${FACTS.law.effectiveFrom} (${FACTS.law.sbNo}). Co to pro vás znamená a co udělat – na jedné stránce.`}
      />
      <div className="container-page py-10">
        <div className="prose-ez mx-auto max-w-3xl">
          <h2>Termíny</h2>
          <ul>
            {TIMELINE.map((t) => (
              <li key={t.date}>
                <strong>{t.dateLabel}</strong> – {t.action}{" "}
                <ExternalLink href={t.source.url} className="text-sm text-muted">
                  (zdroj)
                </ExternalLink>
              </li>
            ))}
          </ul>

          <h2>Co udělat</h2>
          <ol>
            {STEPS.map((s) => (
              <li key={s.title}>
                <strong>{s.title}.</strong> {s.text}
              </li>
            ))}
          </ol>

          <h2>EET OFF pro paušalisty</h2>
          <p>
            {FACTS.eetOff.summary} {FACTS.eetOff.howTo} Zda se vám vyplatí, spočítáte v{" "}
            <Link href="/kalkulacka-eet-off">kalkulačce EET OFF</Link>; rozhodnutí proberte se svou účetní.
          </p>

          <h2>Nechcete to nastavovat sami?</h2>
          <p>
            Technickou část (DIS+, evidenční jednotky, certifikát, telefon pro pokladní) s vámi můžeme projít písemně: služba{" "}
            <Link href="/nastaveni-na-klic">{SETUP_SERVICE.name}</Link> za {SETUP_SERVICE.priceLabel}, platíte až po dokončení. Pokud vám
            ji doporučila vaše účetní, použijte odkaz od ní.
          </p>

          <p className="text-sm text-muted">
            Přehled je sestaven z oficiálních zdrojů (eet.gov.cz, Finanční správa, Ministerstvo financí) k{" "}
            {new Date(FACTS_UPDATED).toLocaleDateString("cs-CZ")}. Není právní ani daňovou radou. Stránku můžete vytisknout (Ctrl+P).
          </p>
        </div>
      </div>
    </>
  );
}
