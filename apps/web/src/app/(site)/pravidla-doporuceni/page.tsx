import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ACCOUNTANT_REWARD_DISCLOSURE, SETUP_SERVICE } from "@/content/services";
import { ACCOUNTANT_REWARD_RULES_VERSION_LABEL, REFERRAL_RULES_VERSION_LABEL } from "@/lib/legal";
import { SETUP_REF_MAX_AGE_DAYS } from "@/lib/setup-ref";
import { SITE, operatorLine } from "@/lib/site";
import { canonicalMeta } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Pravidla akce Doporučte kolegu",
  description: "Pravidla akce Doporučte kolegu (Premium na 3 měsíce zdarma) a odměny pro účetní kanceláře za Nastavení EET na klíč doporučených klientů.",
  ...canonicalMeta("/pravidla-doporuceni"),
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

          {/* S11 (3. 11. 2026): odměna účetním kancelářím za Nastavení na klíč doporučených klientů */}
          <h2 id="ucetni" className="scroll-mt-24">
            Odměna pro účetní kanceláře za Nastavení na klíč
          </h2>
          <p>
            <strong>1. Kdo.</strong> Účetní kancelář, která má v EvidujZdarma Účetní kabinet (zdarma). V kabinetu najde osobní odkaz
            na stránku {SETUP_SERVICE.name} s kódem kanceláře a odznak pro svůj web.
          </p>
          <p>
            <strong>2. Odměna.</strong> {ACCOUNTANT_REWARD_DISCLOSURE}
          </p>
          <p>
            <strong>3. Kdy se nastavení připíše.</strong> Klient přijde přes odkaz kanceláře a do {SETUP_REF_MAX_AGE_DAYS} dnů z téhož
            prohlížeče pošle poptávku {SETUP_SERVICE.name}. Dokončené je nastavení, které jsme pro klienta provedli; v kabinetu
            má stav „hotovo“. Klient na stránce poptávky vidí, že přišel přes odkaz kanceláře.
          </p>
          <p>
            <strong>4. Výplata.</strong> Přehled poptávek, jejich stav a součet odměn kancelář vidí v kabinetu v části „Doporučená
            nastavení“. Odměnu vyplácíme ručně převodem na účet kanceláře; podrobnosti domluvíme e-mailem.
          </p>
          <p>
            <strong>5. Zneužití.</strong> Poptávka vlastní firmy kanceláře, vymyšlené nebo cizí IČO ani jiné obcházení pravidel se
            nezapočítávají.
          </p>
          <p>
            <strong>6. Změny.</strong> Pravidla můžeme změnit nebo odměnu ukončit; změna platí jen pro poptávky po jejím zveřejnění.
            Dotazy pište na <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>
          <p>Platí od {ACCOUNTANT_REWARD_RULES_VERSION_LABEL}.</p>
        </div>
      </div>
    </>
  );
}
