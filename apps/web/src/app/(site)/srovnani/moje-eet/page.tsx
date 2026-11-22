import type { Metadata } from "next";
import Link from "next/link";
import { ComparisonTable } from "@/components/comparison-table";
import { Faq, type FaqItem } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { COMPARISON_AS_OF } from "@/content/comparison";
import { FACTS, FACTS_UPDATED, SOURCES } from "@/content/facts";
import { JsonLd, articleLd, faqLd } from "@/lib/jsonld";
import { ExternalLink } from "@/components/external-link";
import { canonicalMeta } from "@/lib/metadata";
import { SERVICE_COPY } from "@/lib/site";

// S12 (22. 11. 2026): title a description míří na hledání „MOJE eet“; údaje podle dotazů veřejnosti FS z 18. 11. 2026
const TITLE = "MOJE eet, nebo EvidujZdarma? Srovnání pokladen";
const DESCRIPTION =
  "MOJE eet od 1. 12. 2026: nejvýš 2 evidenční jednotky, 4 účty, katalog 42 položek, bez rozpisu DPH. Srovnání s pokladnou EvidujZdarma podle údajů Finanční správy.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...canonicalMeta("/srovnani/moje-eet", { type: "article", title: TITLE, description: DESCRIPTION }),
};

const PUBLISHED = "2026-10-01";
const MODIFIED = "2026-11-22";

const CHOOSE_STATE = [
  "Máte jednu malou provozovnu (nejvýš dvě) a málo prodejů za den.",
  "Prodáváte tam, kde je vždy spolehlivý internet (kamenná prodejna s Wi-Fi, kancelář).",
  "Nejste plátce DPH a vystačíte si s katalogem do 42 položek.",
  "Stačí vám PDF doklad a nepotřebujete tiskárnu účtenek ani napojení na jiný systém.",
  "Chcete aplikaci přímo od Finanční správy a nevadí vám dvoufázové ověření při každém přihlášení.",
];

const CHOOSE_US = [
  "Prodáváte na trzích, festivalech, ve vozidle, na chatě nebo ve sklepě – tam, kde signál vypadává.",
  "Máte 3 evidenční jednotky, nebo víc (tarif Firma bez limitu spustíme později), či víc lidí u pokladny – až 5 zdarma, každý s vlastním PINem.",
  "Jste plátce DPH nebo máte širší sortiment než 42 položek.",
  "Vaše účetní chce data – export CSV je zdarma, Pohoda XML (beta) taky; Money a ABRA připravujeme v Premium. Účetní má vlastní Účetní kabinet.",
  "Potřebujete napojit e-shop, rezervační nebo hotelový systém – přes EET API.",
  "Chcete tisknout účtenky na Bluetooth tiskárně nebo zákazníkům posílat doklad e-mailem či ukázat QR kód.",
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
    a: "Podle Finanční správy (dotaz veřejnosti z 18. 11. 2026) eviduje MOJE eet nejvýš za 2 evidenční jednotky a poplatník může využívat až 4 zaměstnanecké účty. EvidujZdarma nabízí zdarma až 3 evidenční jednotky a až 5 uživatelů; tarif Firma bez limitu jednotek a uživatelů spustíme později.",
  },
  {
    q: "Hodí se MOJE eet pro plátce DPH?",
    a: "Podle Finanční správy MOJE eet neumožňuje evidovat ani uvádět rozpis sazeb a částek DPH, a proto nebude vhodná pro všechny situace – například pro plátce DPH. V pokladně EvidujZdarma má každá položka svou sazbu DPH a export pro účetní obsahuje rozpad DPH.",
  },
  {
    q: "Má MOJE eet export pro účetní?",
    a: "Podle Finanční správy exportuje MOJE eet vystavené doklady v PDF (za zvolené období, případně roční archiv). Soubor tržeb v CSV za evidenční jednotku a období se vytváří v DIS+, ne v MOJE eet. Pokladna EvidujZdarma exportuje tržby do CSV zdarma a do Pohody (XML, beta) přímo z pokladny i z Účetního kabinetu.",
  },
  {
    q: "Funguje MOJE eet s e-shopem nebo rezervačním systémem?",
    a: "Napojení jiných systémů (API) Finanční správa u MOJE eet nezveřejnila. EvidujZdarma nabízí placené EET API, přes které tržby odesílá e-shop, rezervační systém nebo hotelový systém.",
  },
  {
    q: "Mohu začít s MOJE eet a později přejít jinam (nebo naopak)?",
    a: `Evidenční jednotky oznamujete v DIS+ a jejich čísla přiděluje Finanční správa, ne aplikace. ${FACTS.certificate.summary} Volbou pokladny se proto nezavazujete natrvalo. Přesný postup přechodu z MOJE eet popíšeme po jejím spuštění.`,
  },
  {
    q: "Kdy bude MOJE eet k dispozici?",
    a: "Spuštění se podle Finanční správy předpokládá od 1. 12. 2026 na eet.gov.cz. Už od 1. 11. 2026 se v DIS+ přihlašuje k evidenci, oznamují se evidenční jednotky a vydávají pokladní certifikáty – to platí bez ohledu na to, kterou aplikaci zvolíte.",
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
          articleLd({ title: TITLE, description: DESCRIPTION, path: "/srovnani/moje-eet", published: PUBLISHED, modified: MODIFIED > FACTS_UPDATED ? MODIFIED : FACTS_UPDATED }),
          faqLd(FAQ),
        ]}
      />
      <PageHeader
        title="EvidujZdarma, nebo státní MOJE eet?"
        crumbs={[{ name: "Srovnání s MOJE eet", path: "/srovnani/moje-eet" }]}
        lead={
          <p>
            <strong className="text-ink">Krátká odpověď:</strong> Státní MOJE eet (spuštění se předpokládá od 1. 12. 2026) je
            bezplatná webová aplikace pro nejmenší podnikatele se stabilním internetem – nejvýš 2 evidenční jednotky, až 4
            zaměstnanecké účty a katalog do 42 položek, bez rozpisu DPH. EvidujZdarma je nezávislá pokladna, rovněž zdarma: prodá
            i bez signálu, zvládne 3 jednotky a 5 uživatelů zdarma, exportuje pro účetní a má API i Účetní kabinet.
          </p>
        }
      >
        <p className="mt-4 text-sm text-muted">
          Stav k {COMPARISON_AS_OF} · Údaje o MOJE eet podle dotazů veřejnosti Finanční správy, eet.gov.cz a odborného tisku
        </p>
      </PageHeader>

      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <p role="note" className="rounded-2xl border border-line bg-surface p-5 text-[15px] leading-relaxed text-ink">
            <strong>Píšeme o konkurenci, proto férově:</strong> EvidujZdarma provozuje soukromá firma Swipe Scape s.r.o., nikoli
            stát. Státní aplikaci zatím nikdo nemohl vyzkoušet – vycházíme z odpovědí Finanční správy a ke každému údaji uvádíme
            zdroj. <strong>Po spuštění MOJE eet doplníme recenzi se snímky obrazovky</strong> a tabulku podle skutečnosti
            opravíme.
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
            <ExternalLink href={SOURCES.eetGov.url} className="btn-secondary mt-6">
              Oficiální web eet.gov.cz <span aria-hidden="true">↗</span>
            </ExternalLink>
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
            Zvýraznili jsme řádky, ve kterých se aplikace liší nejvíc. Funkce označené jako placené nebo „připravujeme“ (terminál,
            tarif Firma, export do Money a ABRA) spouštíme později – podrobnosti v{" "}
            <Link href="/cenik" className="font-medium text-brand-700 underline underline-offset-4">
              ceníku
            </Link>
            .
          </p>
          <div className="mt-6">
            <ComparisonTable />
          </div>
          <p className="mt-4 max-w-3xl text-[15px] text-ink-soft">
            Platíte dnes za jinou pokladnu? Ceny základních tarifů podle ceníků výrobců, kalkulačku a postup přechodu najdete na stránce{" "}
            <Link href="/prechod-z-jine-pokladny" className="font-medium text-brand-700 underline underline-offset-4">
              přechod z jiné pokladny
            </Link>
            .
          </p>
        </section>

        <article className="prose-ez mx-auto mt-16 max-w-3xl">
          <h2>Co víme o státní aplikaci MOJE eet</h2>
          <p>{FACTS.mojeEet.summary}</p>
          <p>
            Spuštění se předpokládá od <strong>1. 12. 2026</strong> na{" "}
            <ExternalLink href={SOURCES.eetGov.url}>
              eet.gov.cz
            </ExternalLink>
            . Podle Finanční správy mohou MOJE eet využít i právnické osoby, například jako doplňkovou pokladnu pro prodej
            v terénu; nebude ale vhodná pro všechny situace, například pro plátce DPH. Doklad vytvoří jako PDF, který můžete
            vytisknout, poslat e-mailem nebo sdílet – zákazníkovi ho aplikace sama neposílá.
          </p>
          <p>
            Za klíčovou výhodu MOJE eet považujeme, že je přímo od Finanční správy a je zdarma bez jakýchkoli doplňků. Pro
            kadeřnici s jedním salonem, malým sortimentem a stabilní Wi-Fi to může být nejjednodušší cesta.
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
            Zdarma až 5 uživatelů s vlastním PINem a až 3 evidenční jednotky; tarif Firma bez limitu spustíme později. Kolik
            jednotek potřebujete, zjistíte v <Link href="/evidencni-jednotky">průvodci evidenčními jednotkami</Link>.
          </p>
          <h3>DPH a větší sortiment</h3>
          <p>
            Každá položka v katalogu má svou sazbu DPH a katalog naimportujete z tabulky. Export pro účetní obsahuje rozpad DPH.
          </p>
          <h3>Nástroje pro účetní</h3>
          <p>
            Export tržeb do CSV je zdarma, Pohoda XML (beta) taky. Účetní mají <Link href="/ucetni">Účetní kabinet</Link> s
            přehledem připravenosti klientů, exporty a souborem CSV pro hromadný import evidenčních jednotek do DIS+. Všechny
            klienty zkontrolují najednou v <Link href="/ucetni/hromadna-kontrola">hromadné kontrole IČO</Link>.
          </p>
          <h3>Napojení jiných systémů</h3>
          <p>
            E-shop, rezervační nebo hotelový systém může tržby odesílat přes <Link href="/eet-api">EET API</Link> (placené).
          </p>

          <h2>Co platí pro obě aplikace</h2>
          <ul>
            <li>Obě jsou pro základní evidenci tržeb zdarma.</li>
            <li>
              Než začnete evidovat, musíte se od 1. 11. 2026 přihlásit k evidenci v DIS+ (MOJE daně) a oznámit evidenční
              jednotky. Návod najdete v článku{" "}
              <Link href="/navody/jak-aktivovat-dis-a-certifikat">jak aktivovat DIS+ a certifikát</Link>.{" "}
              {FACTS.registrations.activation}
            </li>
            <li>
              {FACTS.confirmation.summary} {FACTS.confirmation.onReceipt}
            </li>
            <li>
              {FACTS.pilot.short} Obě aplikace si proto vyzkoušejte ještě v prosinci 2026 (MOJE eet je dostupná od
              1. 12.) a vyberte tu, která vám sedne.
            </li>
          </ul>

          <p className="text-base text-muted">
            Zdroje:{" "}
            {[SOURCES.fsDotazMojeEet, SOURCES.fsDotazMojeEetExport, SOURCES.prakticke, SOURCES.fsTzPrihlasit, SOURCES.podnikatelRegistrace, SOURCES.mojeEet, SOURCES.mojeEet2fa, SOURCES.harmonogram].map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <ExternalLink href={s.url}>
                  {s.label}
                </ExternalLink>
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
            text={SERVICE_COPY.compareCta}
          />
        </section>
      </div>
    </>
  );
}
