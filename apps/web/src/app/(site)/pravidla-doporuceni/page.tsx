import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { REFERRAL_RULES_VERSION_LABEL } from "@/lib/legal";
import { SITE, operatorLine } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pravidla akce Doporučte kolegu",
  description: "Pravidla akce Doporučte kolegu: kdo se může zapojit, kdy získáte Premium na 3 měsíce zdarma a jak dlouho akce trvá.",
  alternates: { canonical: "/pravidla-doporuceni" },
};

/** Pravidla akce „Doporučte kolegu“ (rozhodnutí Ц3, рецензія №4 R7.10) – text doslovně z recenze. */
export default function ReferralRulesPage() {
  return (
    <>
      <PageHeader title="Pravidla akce Doporučte kolegu" crumbs={[{ name: "Pravidla akce Doporučte kolegu", path: "/pravidla-doporuceni" }]} />
      <div className="container-page py-10">
        <div className="prose-ez max-w-3xl">
          <p>
            <strong>Pravidla akce Doporučte kolegu</strong>
          </p>
          <p>
            <strong>1. Pořadatel.</strong> Akci pořádá {operatorLine()}, provozovatel služby EvidujZdarma.
          </p>
          <p>
            <strong>2. Kdo se může zapojit.</strong> Podnikatel s IČO – fyzická i právnická osoba –, který se předregistroval nebo má účet v
            EvidujZdarma („doporučující“), a podnikatel, který se předregistruje přes jeho odkaz („doporučený“).
          </p>
          <p>
            <strong>3. Kdy odměnu získáte.</strong> Po potvrzení předregistrace dostanete osobní odkaz. Odměnu získáte oba, když doporučený
          </p>
          <p>
            a) se přes tento odkaz předregistruje a předregistraci potvrdí odkazem z e-mailu,
            <br />
            b) má jiné IČO než doporučující a v EvidujZdarma dosud předregistrovaný nebyl,
            <br />
            c) do 31. 3. 2027 začne v EvidujZdarma evidovat tržby v ostrém režimu, tedy odešle Finanční správě alespoň jednu tržbu, a
            <br />
            d) předregistraci mezitím nezruší.
          </p>
          <p>
            <strong>4. Odměna.</strong> Každý z vás získá tarif Premium na 3 měsíce zdarma. Premium připravujeme; odměnu připíšeme ke dni
            jeho spuštění a o spuštění vás budeme informovat e-mailem. Po 3 měsících Premium samo nepřechází do placeného tarifu. Odměny
            za více doporučených se sčítají, nejvýše na 12 měsíců Premium pro jednoho doporučujícího. Odměnu nelze vyměnit za peníze ani
            převést na někoho jiného.
          </p>
          <p>
            <strong>5. Zneužití.</strong> Doporučení sebe sama, předregistrace s vymyšleným nebo cizím IČO ani jiné obcházení pravidel se
            nezapočítávají.
          </p>
          <p>
            <strong>6. Trvání a změny.</strong> Akce trvá od zveřejnění těchto pravidel do 31. 3. 2027. Pořadatel ji může ukončit dříve
            nebo pravidla změnit; změna platí jen pro doporučení po jejím zveřejnění a už splněné nároky zůstávají.
          </p>
          <p>
            <strong>7. Osobní údaje.</strong> Kvůli akci zpracováváme kód doporučení a to, kdo koho doporučil, abychom mohli odměnu
            připsat. Podrobnosti najdete v <Link href="/ochrana-osobnich-udaju">zásadách ochrany osobních údajů</Link>.
          </p>
          <p>
            <strong>8. Kontakt.</strong> Dotazy pište na <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>
          <p>Platí od {REFERRAL_RULES_VERSION_LABEL}.</p>
        </div>
      </div>
    </>
  );
}
