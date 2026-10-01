import type { Metadata } from "next";
import Link from "next/link";
import { ComparisonTable } from "@/components/comparison-table";
import { Faq, type FaqItem } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { FACTS, FACTS_UPDATED, SOURCES } from "@/content/facts";
import { JsonLd, articleLd, faqLd } from "@/lib/jsonld";

const TITLE = "EvidujZdarma vs. MOJE eet: férové srovnání";
const DESCRIPTION =
  "Státní MOJE eet, nebo nezávislá pokladna EvidujZdarma? Obě jsou zdarma. Srovnání offline režimu, počtu uživatelů a jednotek, tiskáren a exportu pro účetní.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/srovnani/moje-eet" },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION, url: "/srovnani/moje-eet" },
};

const PUBLISHED = "2026-10-01";

const CHOOSE_STATE = [
  "Máte jednu nebo dvě provozovny a nejvýš dva zaměstnance u pokladny.",
  "Prodáváte tam, kde je vždy spolehlivý internet (kamenná prodejna s Wi-Fi, kancelář).",
  "Stačí vám PDF doklad a nepotřebujete tiskárnu účtenek ani čtečku kódů.",
  "Chcete aplikaci přímo od Finanční správy a nevadí vám dvoufázové ověření při každém přihlášení.",
];

const CHOOSE_US = [
  "Prodáváte na trzích, festivalech, ve vozidle, na chatě nebo ve sklepě – tam, kde signál vypadává.",
  "Potřebujete tisknout účtenky na Bluetooth nebo USB tiskárně, případně používat čtečku čárových kódů.",
  "Chcete zákazníkům posílat doklad e-mailem nebo ukázat QR kód místo papíru.",
  "U pokladny se střídá víc lidí (až 5 uživatelů zdarma, každý s vlastním PINem) nebo máte 3 evidenční jednotky.",
  "Vaše účetní chce data – export CSV je zdarma, napojení na Pohodu či Money připravujeme v Premium.",
];

const FAQ: FaqItem[] = [
  {
    q: "Je státní aplikace MOJE eet opravdu zdarma?",
    a: `Ano. ${FACTS.mojeEet.summary}`,
  },
  {
    q: "Je EvidujZdarma státní aplikace nebo partner Finanční správy?",
    a: "Ne. EvidujZdarma je nezávislá služba soukromé firmy Swipe Scape s.r.o. Není provozována Finanční správou ani jiným státním orgánem a nemá od ní žádné zvláštní postavení. Oficiální státní aplikace se jmenuje MOJE eet a najdete ji na eet.gov.cz.",
  },
  {
    q: "Funguje MOJE eet bez internetu?",
    a: `Podle zveřejněných informací potřebuje MOJE eet pro provoz připojení k internetu. Zákon přitom s výpadky počítá: ${FACTS.offline.summary} Pokladna EvidujZdarma tržby v takovém případě uloží v zařízení a odešle je sama, jakmile je spojení.`,
  },
  {
    q: "Kolik evidenčních jednotek a uživatelů mají obě aplikace?",
    a: "MOJE eet podle zveřejněných informací umožní až 2 evidenční jednotky a přístup pro 2 zaměstnance. EvidujZdarma nabízí zdarma až 3 evidenční jednotky a až 5 uživatelů; tarif Premium, který spustíme později, bude bez limitu.",
  },
  {
    q: "Mohu začít s MOJE eet a později přejít jinam (nebo naopak)?",
    a: `Evidenční jednotky oznamujete v DIS+ a jejich čísla přiděluje Finanční správa, ne aplikace. ${FACTS.certificate.summary} Volbou pokladny se proto nezavazujete natrvalo. Přesný postup přechodu z MOJE eet popíšeme po jejím spuštění.`,
  },
  {
    q: "Kdy bude MOJE eet k dispozici?",
    a: "Podle harmonogramu Finanční správy od 1. 12. 2026 na eet.gov.cz. Ještě předtím, od 1. 11. 2026, se v DIS+ přihlašuje k evidenci, oznamují se evidenční jednotky a vydávají pokladní certifikáty – to platí bez ohledu na to, kterou aplikaci zvolíte.",
  },
  {
    q: "Potřebuji aplikaci, když zvolím EET OFF?",
    a: `Ne. ${FACTS.eetOff.summary} Zda se vám to vyplatí, spočítáte v naší kalkulačce EET OFF.`,
  },
];

export default function CompareMojeEetPage() {
  return (
    <>
      <JsonLd
        data={[
          articleLd({ title: TITLE, description: DESCRIPTION, path: "/srovnani/moje-eet", published: PUBLISHED, modified: FACTS_UPDATED }),
          faqLd(FAQ),
        ]}
      />
      <PageHeader
        title="EvidujZdarma, nebo státní MOJE eet?"
        crumbs={[{ name: "Srovnání s MOJE eet", path: "/srovnani/moje-eet" }]}
        lead={
          <p>
            <strong className="text-ink">Krátká odpověď:</strong> Státní MOJE eet (od 1. 12. 2026) je bezplatná webová aplikace
            vhodná pro nejmenší podnikatele s trvalým internetem – až 2 evidenční jednotky a 2 zaměstnanci. EvidujZdarma je
            nezávislá pokladna, rovněž zdarma, která navíc funguje bez signálu, tiskne účtenky, posílá doklad e-mailem a zvládne
            5 uživatelů a 3 jednotky.
          </p>
        }
      >
        <p className="mt-4 text-sm text-muted">
          Aktualizováno {new Date(FACTS_UPDATED).toLocaleDateString("cs-CZ")} · Údaje o MOJE eet podle zveřejněných informací
          Finanční správy a odborného tisku
        </p>
      </PageHeader>

      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <p role="note" className="rounded-2xl border border-line bg-surface p-5 text-[15px] leading-relaxed text-ink">
            <strong>Píšeme o konkurenci, proto férově:</strong> EvidujZdarma provozuje soukromá firma Swipe Scape s.r.o., nikoli
            stát. Státní aplikaci zatím nikdo nemohl vyzkoušet – vycházíme ze zveřejněných informací a ke každému údaji uvádíme
            zdroj. <strong>V den spuštění MOJE eet (1. 12. 2026) doplníme recenzi se snímky obrazovky</strong> a tabulku podle
            skutečnosti opravíme.
          </p>
        </div>

        <section aria-labelledby="kdy" className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
          <h2 id="kdy" className="sr-only">
            Kdy zvolit kterou aplikaci
          </h2>
          <div className="card">
            <h3 className="text-xl font-bold text-ink">MOJE eet je dobrá volba, když…</h3>
            <ul className="mt-4 space-y-3 text-[15px] text-ink-soft">
              {CHOOSE_STATE.map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-muted" />
                  {t}
                </li>
              ))}
            </ul>
            <a href={SOURCES.eetGov.url} className="btn-secondary mt-6" rel="noopener">
              Oficiální web eet.gov.cz <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="card border-2 border-brand-500">
            <h3 className="text-xl font-bold text-ink">EvidujZdarma se vyplatí, když…</h3>
            <ul className="mt-4 space-y-3 text-[15px] text-ink-soft">
              {CHOOSE_US.map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/#registrace" className="btn-primary mt-6">
              Předregistrovat se zdarma
            </Link>
          </div>
        </section>

        <section aria-labelledby="tabulka" className="mx-auto mt-16 max-w-5xl">
          <h2 id="tabulka" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Srovnání funkcí bod po bodu
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">
            Zvýraznili jsme řádky, ve kterých se aplikace liší nejvíc. Funkce označené jako placené (terminál, SMS účtenky, export
            do Pohody a Money) spouštíme později – podrobnosti v{" "}
            <Link href="/cenik" className="font-medium text-brand-700 underline underline-offset-4">
              ceníku
            </Link>
            .
          </p>
          <div className="mt-6">
            <ComparisonTable />
          </div>
        </section>

        <article className="prose-ez mx-auto mt-16 max-w-3xl">
          <h2>Co víme o státní aplikaci MOJE eet</h2>
          <p>{FACTS.mojeEet.summary}</p>
          <p>
            Aplikace má být dostupná od <strong>1. 12. 2026</strong> na{" "}
            <a href={SOURCES.eetGov.url} rel="noopener">
              eet.gov.cz
            </a>
            . Podrobnosti o tom, jak bude fungovat při výpadku připojení, Finanční správa zatím nezveřejnila – podle dostupných
            informací vyžaduje pro provoz internet.
          </p>
          <p>
            Za klíčovou výhodu MOJE eet považujeme, že je přímo od Finanční správy a je zdarma bez jakýchkoli doplňků. Pro
            kadeřnici s jedním salonem a stabilní Wi-Fi to může být nejjednodušší cesta.
          </p>

          <h2>V čem se EvidujZdarma liší</h2>
          <h3>Práce bez signálu</h3>
          <p>
            {FACTS.offline.summary} Pokladna EvidujZdarma tržbu uloží v zařízení, po obnovení spojení ji odešle sama a ukazuje, kolik
            času do konce lhůty zbývá. Prodej na trhu nebo ve vozidle tak nezastaví slabý signál.
          </p>
          <h3>Tiskárna, e-mail, QR</h3>
          <p>
            {FACTS.receipt.summary} Pokud doklad vydáváte, u nás ho můžete vytisknout na Bluetooth či USB tiskárně, poslat
            e-mailem nebo ukázat jako QR kód na displeji.
          </p>
          <h3>Více lidí a provozoven</h3>
          <p>
            Zdarma až 5 uživatelů s vlastním PINem a až 3 evidenční jednotky. Kolik jednotek potřebujete, zjistíte v{" "}
            <Link href="/evidencni-jednotky">průvodci evidenčními jednotkami</Link>.
          </p>
          <h3>Nástroje pro účetní</h3>
          <p>
            Export tržeb do CSV je zdarma. Účetní mohou zkontrolovat všechny klienty najednou v{" "}
            <Link href="/ucetni/hromadna-kontrola">hromadné kontrole IČO</Link> a připravujeme pro ně{" "}
            <Link href="/ucetni">Účetní kabinet</Link>.
          </p>

          <h2>Co platí pro obě aplikace</h2>
          <ul>
            <li>Obě jsou pro základní evidenci tržeb zdarma.</li>
            <li>
              Než začnete evidovat, musíte se od 1. 11. 2026 přihlásit k evidenci v DIS+ (MOJE daně) a oznámit evidenční
              jednotky. Návod najdete v článku{" "}
              <Link href="/navody/jak-aktivovat-dis-a-certifikat">jak aktivovat DIS+ a certifikát</Link>.
            </li>
            <li>
              {FACTS.confirmation.summary} {FACTS.confirmation.onReceipt}
            </li>
            <li>
              {FACTS.pilot.short} Obě aplikace si proto vyzkoušejte nanečisto ještě v prosinci 2026 (MOJE eet je dostupná od
              1. 12.) a vyberte tu, která vám sedne.
            </li>
          </ul>

          <p className="text-base text-muted">
            Zdroje:{" "}
            {[SOURCES.mojeEet, SOURCES.mojeEet2fa, SOURCES.harmonogram, SOURCES.prakticke].map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url} rel="noopener">
                  {s.label}
                </a>
              </span>
            ))}
          </p>
        </article>

        <section aria-labelledby="faq" className="mx-auto mt-16 max-w-3xl">
          <h2 id="faq" className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Časté otázky
          </h2>
          <Faq items={FAQ} />
          <ToolCta
            title="Nevíte, zda vůbec musíte evidovat?"
            text="Zkontrolujte své IČO za 10 vteřin, nebo se rovnou předregistrujte k bezplatné pokladně, která funguje i bez signálu."
          />
        </section>
      </div>
    </>
  );
}
