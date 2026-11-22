import type { Metadata } from "next";
import Link from "next/link";
import { DokladyWaitlistForm } from "@/components/doklady-waitlist-form";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { getGuide } from "@/content/guides";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S12 (22. 11. 2026): pilíř clusteru „Doklady pro účetní bez chaosu“ (nápad majitele: podnikatele účetní pořád žádá
 * o chybějící faktury; chyby a zdržení vznikají z chybějících a pozdních dokladů a z ruční práce, ne u účetních).
 * Stránka bez daňových tvrzení – indexuje se; články clusteru jsou koncepty do revize (noindex, Ф8, Ф12).
 * Čekací listina bety „Doklady k platbám“ = předregistrace se zájmem "doklady" (lib/interests.ts, R7.4).
 */
export const metadata: Metadata = {
  title: "Doklady pro účetní bez chaosu",
  description:
    "Účetní vás pořád žádá o chybějící faktury? Jak předávat doklady včas a na jednom místě, párovat je s výpisem z banky a beta nástroje Doklady k platbám zdarma.",
  ...canonicalMeta("/ucetnictvi-bez-chaosu"),
};

const CLUSTER = [
  "co-ucetni-potrebuje-kazdy-mesic",
  "chybejici-doklady-k-platbam",
  "pokladni-kniha-eet-a-banka",
  "proc-ucetni-chce-faktury",
  "parovani-plateb-s-doklady",
] as const;

const CAUSES: readonly { title: string; text: string }[] = [
  { title: "Doklad chybí", text: "Faktura zůstala v e-mailu, účtenka v peněžence nebo v autě. Účetní vidí platbu na výpisu, ale neví, za co byla." },
  { title: "Doklad přijde pozdě", text: "Když podklady dorazí až po termínu, účetní pracuje pod tlakem a dohledává to, co mohlo přijít průběžně." },
  { title: "Ruční přepisování", text: "Tržby opsané z pokladny do tabulky, faktury přeposílané po jedné. Každý ruční krok je místo, kde se něco ztratí." },
];

const BETA: readonly { title: string; text: string }[] = [
  { title: "Výpis z banky dovnitř", text: "Nahrajete výpis a každá platba se objeví jako řádek, ke kterému patří doklad." },
  { title: "Ke každé platbě doklad", text: "Fakturu nebo účtenku přiřadíte k platbě – nahráním souboru nebo fotkou z telefonu." },
  { title: "Připomínky chybějících", text: "Nástroj vám připomene platby, ke kterým doklad ještě chybí – dřív, než se zeptá účetní." },
  { title: "Přístup pro účetní", text: "Účetní uvidí platby i doklady na jednom místě, jen když jí přístup dáte." },
];

const FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: "Co je Doklady k platbám?",
    a: "Nástroj, který připravujeme pro uživatele EvidujZdarma: nahrajete výpis z banky, ke každé platbě přiřadíte doklad, nástroj připomene chybějící a účetní k nim může dostat přístup.",
  },
  {
    q: "Kdy bude beta dostupná a kolik bude stát?",
    a: "Termín spuštění zatím neznáme – pozvánku pošleme e-mailem těm, kdo o betu projeví zájem. Beta bude zdarma pro uživatele EvidujZdarma.",
  },
  {
    q: "Nahrazuje nástroj účetní?",
    a: "Ne. Účetní dál zaúčtuje a posoudí doklady. Nástroj má jen zajistit, aby k ní doklady došly včas a úplné.",
  },
  {
    q: "Když dám zájem o betu, budete mi posílat reklamu?",
    a: "Ne. Pošleme vám potvrzovací e-mail a pozvánku do bety. Novinky a nabídky jen tehdy, když k tomu zaškrtnete samostatný souhlas.",
  },
];

export default function UcetnictviBezChaosu() {
  const guides = CLUSTER.map(getGuide).filter((g): g is NonNullable<typeof g> => !!g);
  return (
    <>
      <JsonLd data={faqLd(FAQ_ITEMS.map((f) => ({ q: f.q, a: f.a })))} />
      <PageHeader
        title="Doklady pro účetní bez chaosu"
        crumbs={[{ name: "Doklady pro účetní bez chaosu", path: "/ucetnictvi-bez-chaosu" }]}
        lead="Většina zdržení v účetnictví nevzniká u účetní, ale cestou k ní: doklad chybí, přijde pozdě nebo se ztratí v e-mailu. Pár návyků a dobře nastavený postup ušetří čas vám i jí."
      >
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href="#beta" className="btn-primary px-6 py-3 text-lg no-underline">
            Beta Doklady k platbám zdarma
          </a>
          <a href="#navody" className="btn-secondary px-6 py-3 text-lg no-underline">
            Návody
          </a>
        </div>
      </PageHeader>

      <div className="container-page py-12">
        <section aria-labelledby="pricina-h">
          <h2 id="pricina-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Odkud se chaos bere
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">
            Účetní pracují pečlivě. Opravy a dotazy na konci měsíce obvykle nejsou chybou účetní – vznikají z dokladů, které chybí nebo přišly pozdě, a z ruční práce kolem nich.
          </p>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {CAUSES.map((c) => (
              <li key={c.title} className="card">
                <h3 className="text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{c.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="navody" aria-labelledby="navody-h" className="mt-16 scroll-mt-24">
          <h2 id="navody-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Návody krok za krokem
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/navody/${g.slug}`} className="card block h-full transition-colors hover:border-brand-200">
                  <p className="text-lg font-semibold text-ink">{g.h1 ?? g.title}</p>
                  <p className="mt-2 text-[15px] text-ink-soft">{g.description}</p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">Návody v této sekci připravujeme a před odbornou revizí je průběžně doplňujeme. Informativní přehled, nejde o daňové ani účetní poradenství.</p>
        </section>

        <section id="beta" aria-labelledby="beta-h" className="mt-16 grid scroll-mt-24 gap-10 rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="chip bg-white text-brand-700 ring-1 ring-brand-200">Připravujeme · beta zdarma pro uživatele EvidujZdarma</p>
            <h2 id="beta-h" className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Doklady k platbám
            </h2>
            <p className="mt-2 text-lg text-ink-soft">Výpis z banky dovnitř, ke každé platbě její doklady. Nástroj zatím vyvíjíme – zanechte e-mail a pozveme vás do bety mezi prvními.</p>
            <ul className="mt-6 space-y-3 text-[16px]">
              {BETA.map((b) => (
                <li key={b.title} className="flex gap-3">
                  <span aria-hidden="true" className="text-brand-600">
                    ✓
                  </span>
                  <span>
                    <strong className="text-ink">{b.title}.</strong> <span className="text-ink-soft">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card self-start p-6 shadow-sm sm:p-8">
            <DokladyWaitlistForm />
          </div>
        </section>

        <section aria-labelledby="uz-ted-h" className="mt-16">
          <h2 id="uz-ted-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Co funguje už teď
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            <li className="card">
              <h3 className="text-lg font-semibold">Export pro účetní</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Export tržeb a pokladní kniha z pokladny EvidujZdarma v CSV – bez přepisování.</p>
              <Link href="/napoveda/export-pro-ucetni" className="mt-3 inline-block text-[15px] font-semibold text-brand-700 underline underline-offset-4">
                Jak na export →
              </Link>
            </li>
            <li className="card">
              <h3 className="text-lg font-semibold">Účetní s přístupem</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Účetní vidí tržby propojených klientů v Účetním kabinetu – jen když ji klient pozve.</p>
              <Link href="/ucetni" className="mt-3 inline-block text-[15px] font-semibold text-brand-700 underline underline-offset-4">
                Pro účetní →
              </Link>
            </li>
            <li className="card">
              <h3 className="text-lg font-semibold">Faktura zdarma</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Vydanou fakturu s variabilním symbolem vystavíte za minutu – platby se pak párují samy.</p>
              <Link href="/faktura-zdarma" className="mt-3 inline-block text-[15px] font-semibold text-brand-700 underline underline-offset-4">
                Vystavit fakturu →
              </Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="faq-h" className="mx-auto mt-16 max-w-3xl">
          <h2 id="faq-h" className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Časté otázky
          </h2>
          <Faq items={FAQ_ITEMS.map((f) => ({ q: f.q, a: f.a }))} />
        </section>
      </div>
    </>
  );
}
