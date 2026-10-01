// TODO(právník): Pracovní návrh obchodních podmínek – před spuštěním pokladny nechat zrevidovat advokátem.
// Zkontrolovat zejména: (1) omezení a vyloučení odpovědnosti s ohledem na § 2898 OZ a na uživatele-spotřebitele
// (služba je určena podnikatelům, ale ověřit dopady § 1810 a násl. OZ); (2) závazek „jádro zdarma navždy“ v čl. 6;
// (3) obsah přílohy SLA k Premium (dostupnost, kompenzace, doba reakce podpory) – zatím nevydána; (4) lhůty
// v čl. 10 a 11 (30 dní na export po ukončení, 60 dní výpověď ze strany provozovatele, 30 dní oznámení změn);
// (5) zda data pokladny zpracováváme jako zpracovatel (čl. 28 GDPR) a zda je třeba samostatná zpracovatelská smlouva;
// (6) identifikační údaje provozovatele (IČO, sídlo, zápis v OR) – doplnit do env NEXT_PUBLIC_OPERATOR_*.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { FACTS } from "@/content/facts";
import { OPERATOR, SITE } from "@/lib/site";

const VERSION_DATE = "2026-10-01";
const VERSION_LABEL = "1. 10. 2026";

export const metadata: Metadata = {
  title: "Obchodní podmínky",
  description:
    "Obchodní podmínky EvidujZdarma: co pokladna pro EET 2.0 zajišťuje, za co odpovídá podnikatel, tarify Zdarma a Premium, data a certifikáty v EU, ukončení služby.",
  alternates: { canonical: "/podminky" },
};

function operatorIdentity(): string {
  const parts: string[] = [OPERATOR.name];
  if (OPERATOR.ico) parts.push(`IČO ${OPERATOR.ico}`);
  if (OPERATOR.address) parts.push(`se sídlem ${OPERATOR.address}`);
  if (OPERATOR.registry) parts.push(OPERATOR.registry);
  return parts.join(", ");
}

const SECTIONS: readonly { id: string; title: string; body: ReactNode }[] = [
  {
    id: "uvod",
    title: "Úvodní ustanovení",
    body: (
      <>
        <p>
          1.1 Tyto obchodní podmínky (dále „podmínky“) upravují práva a povinnosti mezi společností {operatorIdentity()} (dále
          „provozovatel“) a uživatelem služby EvidujZdarma dostupné na webu {SITE.domain} a v souvisejících aplikacích (dále
          „služba“).
        </p>
        <p>
          1.2 Služba je určena podnikatelům – fyzickým i právnickým osobám, které ji využívají v rámci své podnikatelské činnosti
          (dále „uživatel“).
        </p>
        <p>
          1.3 EvidujZdarma je nezávislá služba soukromé společnosti. Není provozována Finanční správou ani jiným státním orgánem.
        </p>
      </>
    ),
  },
  {
    id: "pojmy",
    title: "Pojmy",
    body: (
      <ul>
        <li>
          <strong>Pokladna</strong> – software služby, ve kterém uživatel zaznamenává tržby a který odesílá datové zprávy o
          evidovaných tržbách Finanční správě.
        </li>
        <li>
          <strong>Účet</strong> – uživatelský účet podnikatele ve službě, ke kterému mohou být přizváni další uživatelé
          (pokladní).
        </li>
        <li>
          <strong>Evidenční jednotka</strong> – jednotka oznámená uživatelem v DIS+, ke které se tržby evidují (např. provozovna,
          mobilní provozovna, automat, internetová stránka, dopravní prostředek).
        </li>
        <li>
          <strong>Pokladní certifikát</strong> – certifikát vydaný uživateli v DIS+, kterým se podepisují datové zprávy.
        </li>
        <li>
          <strong>Tarif Zdarma</strong>, <strong>Premium</strong> a <strong>doplňky</strong> – rozsahy služby popsané v{" "}
          <Link href="/cenik">ceníku</Link>.
        </li>
      </ul>
    ),
  },
  {
    id: "predmet",
    title: "Předmět služby",
    body: (
      <>
        <p>
          3.1 Provozovatel poskytuje uživateli technický prostředek pro záznam tržeb a pro odesílání datových zpráv o
          evidovaných tržbách podle zákona o evidenci tržeb, včetně vystavení dokladu a přehledů tržeb.
        </p>
        <p>
          3.2 <strong>Zákonná povinnost evidovat tržby zůstává vždy na uživateli jako poplatníkovi.</strong> Provozovatel
          nepřebírá daňové ani jiné veřejnoprávní povinnosti uživatele, nejedná jeho jménem vůči Finanční správě a není jeho
          daňovým poradcem.
        </p>
        <p>
          3.3 Informace, návody a výsledky nástrojů na webu (např. kontrola IČO, kvíz, kalkulačka EET OFF) jsou orientační a
          nenahrazují odborné daňové poradenství ani stanovisko Finanční správy.
        </p>
      </>
    ),
  },
  {
    id: "ucet",
    title: "Registrace a účet",
    body: (
      <>
        <p>4.1 Uživatel při registraci uvádí pravdivé a úplné údaje a bez zbytečného odkladu je aktualizuje.</p>
        <p>
          4.2 Uživatel chrání přístupové údaje, zařízení s pokladnou a PINy pokladních před zneužitím. Za úkony provedené pod jeho
          účtem a za osoby, které do účtu přizve, odpovídá uživatel.
        </p>
        <p>4.3 Podezření na zneužití účtu uživatel neprodleně oznámí provozovateli na {SITE.email}.</p>
      </>
    ),
  },
  {
    id: "povinnosti",
    title: "Povinnosti uživatele",
    body: (
      <>
        <p>5.1 Uživatel zejména:</p>
        <ol type="a" className="list-[lower-alpha]">
          <li>se přihlásí k evidenci tržeb v DIS+ a oznámí všechny své evidenční jednotky a včas oznamuje jejich změny ({FACTS.units.change.replace(/\.$/, "")});</li>
          <li>v pokladně správně přiřadí tržby k evidenčním jednotkám a k číslům jednotek přiděleným Finanční správou;</li>
          <li>
            zajistí platný pokladní certifikát, nahraje ho do pokladny a včas ho obnoví (certifikát platí 366 dní); provozovatel
            na blížící se konec platnosti upozorní, odpovědnost za obnovu však nese uživatel;
          </li>
          <li>
            zajistí, aby zařízení s pokladnou bylo po výpadku spojení připojeno k internetu tak, aby tržby evidované bez spojení
            mohly být odeslány bez zbytečného odkladu, nejpozději do {FACTS.offline.hours} hodin od přijetí platby;
          </li>
          <li>kontroluje, zda pokladna u tržeb zobrazuje potvrzovací kód (POK), a neodeslané tržby řeší bez odkladu;</li>
          <li>vydává doklady v souladu s právními předpisy, pokud o ně zákazník požádá;</li>
          <li>nepoužívá službu v rozporu s právními předpisy a nezasahuje do jejího technického fungování.</li>
        </ol>
      </>
    ),
  },
  {
    id: "zdarma",
    title: "Tarif Zdarma",
    body: (
      <>
        <p>
          6.1 Tarif Zdarma je bezplatný a poskytuje se <strong>„tak, jak je“</strong>, bez záruky nepřetržité dostupnosti a bez
          nároku na konkrétní dobu odezvy podpory.
        </p>
        <p>
          6.2 Provozovatel se zavazuje, že funkce, které ceník ke dni registrace uživatele uvádí jako součást tarifu Zdarma
          (evidence tržeb, práce bez signálu, až 5 uživatelů, až 3 evidenční jednotky, doklad PDF a e-mailem, denní přehled,
          export CSV, QR platba), nezpoplatní.
        </p>
        <p>
          6.3 Pokladna je navržena tak, aby tržby zaznamenala i při nedostupnosti internetu nebo serverů provozovatele a odeslala
          je po obnovení spojení.
        </p>
      </>
    ),
  },
  {
    id: "premium",
    title: "Premium a placené doplňky",
    body: (
      <>
        <p>
          7.1 Placené tarify a doplňky (např. Premium, Terminál, Nastavení na klíč, API) se řídí cenou platnou v okamžiku
          objednávky. Provozovatel je spouští postupně; do jejich spuštění nejsou objednatelné.
        </p>
        <p>
          7.2 Předplatné se hradí předem na měsíční nebo roční období a automaticky se prodlužuje, dokud ho uživatel nezruší.
          Zrušení je účinné ke konci zaplaceného období.
        </p>
        <p>
          7.3 Pro tarif Premium provozovatel garantuje úroveň služeb (SLA) – dostupnost serverové části služby, dobu reakce
          prioritní podpory a kompenzace při jejich nedodržení. Konkrétní parametry stanoví příloha SLA, kterou provozovatel
          zveřejní před spuštěním placených tarifů.
        </p>
        <p>7.4 Platební služby (např. platba kartou v telefonu) poskytuje platební partner podle svých vlastních podmínek.</p>
      </>
    ),
  },
  {
    id: "odpovednost",
    title: "Odpovědnost",
    body: (
      <>
        <p>
          8.1 Provozovatel odpovídá za škodu způsobenou porušením svých povinností podle těchto podmínek a právních předpisů.
          V rozsahu, v jakém to právní řád České republiky připouští:
        </p>
        <ol type="a" className="list-[lower-alpha]">
          <li>provozovatel neodpovídá za ušlý zisk ani za nepřímé a následné škody;</li>
          <li>
            celková odpovědnost provozovatele vůči uživateli je omezena částkou, kterou uživatel provozovateli zaplatil za
            posledních 12 měsíců před vznikem škody; u tarifu Zdarma se odpovědnost omezuje na škodu způsobenou úmyslně nebo
            z hrubé nedbalosti;
          </li>
          <li>
            provozovatel neodpovídá za pokuty a jiné sankce uložené uživateli, pokud nebyly způsobeny porušením povinností
            provozovatele;
          </li>
          <li>
            provozovatel neodpovídá za výpadky systémů Finanční správy (včetně DIS+ a rozhraní pro příjem datových zpráv),
            veřejného internetu, mobilních sítí ani za závady zařízení uživatele.
          </li>
        </ol>
        <p>
          8.2 Omezení podle odst. 8.1 se nevztahuje na škodu způsobenou úmyslně nebo z hrubé nedbalosti, na újmu na přirozených
          právech člověka ani na jiné případy, kdy právní předpisy omezení nepřipouštějí.
        </p>
      </>
    ),
  },
  {
    id: "data",
    title: "Data a pokladní certifikáty",
    body: (
      <>
        <p>
          9.1 Data pokladny (tržby, doklady, katalog, přehledy) i pokladní certifikáty ukládá provozovatel šifrovaně na serverech
          v Evropské unii.
        </p>
        <p>
          9.2 Pokladní certifikát a jeho heslo používá provozovatel výhradně k podepisování datových zpráv za uživatele. Uživatel
          může certifikát ze služby kdykoli odstranit a v DIS+ zneplatnit.
        </p>
        <p>
          9.3 Data pokladny patří uživateli. Uživatel je může kdykoli exportovat (nejméně ve formátu CSV). Provozovatel je
          nepoužívá k jiným účelům než k poskytování služby a neprodává je.
        </p>
        <p>
          9.4 Zpracování osobních údajů popisují <Link href="/ochrana-osobnich-udaju">zásady ochrany osobních údajů</Link>.
        </p>
      </>
    ),
  },
  {
    id: "ukonceni",
    title: "Ukončení",
    body: (
      <>
        <p>10.1 Uživatel může službu kdykoli přestat používat a zrušit účet v nastavení nebo e-mailem na {SITE.email}.</p>
        <p>
          10.2 Provozovatel může tarif Zdarma ukončit s výpovědní dobou 60 dnů oznámenou e-mailem. Při závažném porušení podmínek
          uživatelem (např. zneužití služby) může provozovatel přístup omezit nebo účet zrušit s okamžitou účinností.
        </p>
        <p>
          10.3 Po ukončení má uživatel 30 dnů na export dat. Poté provozovatel data smaže, pokud mu jejich další uchování
          neukládá právní předpis.
        </p>
      </>
    ),
  },
  {
    id: "zmeny",
    title: "Změny podmínek",
    body: (
      <p>
        11.1 Provozovatel může podmínky měnit. Změnu oznámí uživatelům e-mailem nejméně 30 dnů před její účinností. Nesouhlasí-li
        uživatel se změnou, může službu do dne účinnosti změny ukončit; zaplacené a nevyčerpané předplatné mu provozovatel vrátí.
      </p>
    ),
  },
  {
    id: "pravo",
    title: "Rozhodné právo a závěrečná ustanovení",
    body: (
      <>
        <p>
          12.1 Tyto podmínky a vztahy z nich vyplývající se řídí právem České republiky, zejména zákonem č. 89/2012 Sb., občanský
          zákoník. Spory rozhodují obecné soudy České republiky.
        </p>
        <p>12.2 Je-li některé ustanovení neplatné nebo neúčinné, ostatní ustanovení tím nejsou dotčena.</p>
        <p>12.3 Tato verze podmínek je platná od {VERSION_LABEL}.</p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHeader
        title="Obchodní podmínky"
        crumbs={[{ name: "Obchodní podmínky", path: "/podminky" }]}
        lead={
          <>
            Verze ze dne <time dateTime={VERSION_DATE}>{VERSION_LABEL}</time>. Podmínky dokončujeme před spuštěním pokladny – o
            každé změně vás budeme informovat předem.
          </>
        }
      />
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Obsah podmínek" className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink">Obsah</h2>
            <ol className="space-y-1.5 text-[15px] text-ink-soft">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:text-brand-700 hover:underline">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="prose-ez min-w-0 max-w-3xl">
            <p className="mt-0 rounded-2xl border border-line bg-surface p-5 text-base text-ink">
              <strong>Ve zkratce:</strong> pokladna je technický nástroj – povinnost evidovat tržby máte vy. Tarif Zdarma je zdarma
              navždy, ale bez garancí; Premium bude mít garantovanou úroveň služeb. Data i certifikáty ukládáme šifrovaně v EU a
              kdykoli si je vyexportujete. Shrnutí nenahrazuje plné znění níže.
            </p>
            {SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
                <h2 id={`${s.id}-h`}>
                  {i + 1}. {s.title}
                </h2>
                {s.body}
              </section>
            ))}
            <p className="mt-12 text-base text-muted">
              Dotazy k podmínkám:{" "}
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
