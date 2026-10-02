// TODO(právník): Pracovní návrh zásad zpracování osobních údajů – před spuštěním pokladny nechat zrevidovat
// advokátem / pověřencem. Zkontrolovat zejména: (1) test proporcionality (LIA) pro katalog firem z veřejných
// registrů a rozsah údajů u fyzických osob; (2) doby uložení v sekci „Jak dlouho údaje uchováváme“ (jsou to
// navržené interní lhůty, ne zákonné); (3) roli správce × zpracovatele u dat pokladny (údaje zákazníků a pokladních
// podnikatele) a potřebu zpracovatelské smlouvy dle čl. 28 GDPR v obchodních podmínkách; (4) doplnit jména
// zpracovatelů (hosting v EU, doručování e-mailů, později platební partner a poskytovatel AI přehledu – u AI ověřit,
// že data neopustí EU); (5) cookies – nyní jen nezbytné (přihlášení) a localStorage pro kód doporučení; při nasazení
// analytiky doplnit; (6) identifikační údaje správce jsou v lib/site.ts (OPERATOR, ověřeno v OR 2. 10. 2026).
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { PRIVACY_VERSION, PRIVACY_VERSION_LABEL } from "@/lib/legal";
import { SITE, operatorLine } from "@/lib/site";

const VERSION_DATE = PRIVACY_VERSION;
const VERSION_LABEL = PRIVACY_VERSION_LABEL;

export const metadata: Metadata = {
  title: "Ochrana osobních údajů (GDPR)",
  description:
    "Jak EvidujZdarma zpracovává osobní údaje: předregistrace, marketing jen se souhlasem, data pokladny, katalog firem z veřejných registrů, doby uložení a práva.",
  alternates: { canonical: "/ochrana-osobnich-udaju" },
};

const PURPOSES: readonly { purpose: string; data: string; basis: string; retention: string }[] = [
  {
    purpose: "Předregistrace k pokladně a přihláška na webinář",
    data: "E-mail, nepovinně IČO a název firmy z ARES, obor, počet provozoven, o co máte zájem, kód doporučení, zdroj návštěvy (UTM).",
    basis: "Provedení opatření před uzavřením smlouvy na vaši žádost – čl. 6 odst. 1 písm. b) GDPR.",
    retention:
      "Do spuštění pokladny (1. 12. 2026) a poté nejvýše 12 měsíců od spuštění, nebo od registrace, pokud proběhla později – pokud si nezaložíte účet ani neudělíte souhlas s novinkami; dříve na vaši žádost.",
  },
  {
    purpose: "Novinky k EET a nabídky e-mailem",
    data: "E-mail, údaje z předregistrace, datum udělení souhlasu, verze jeho textu a čas potvrzení e-mailu (u předregistrací do 2. 10. 2026 místo verze textu otisk IP adresy a prohlížeče).",
    basis: "Váš souhlas – čl. 6 odst. 1 písm. a) GDPR a § 7 zákona č. 480/2004 Sb., o některých službách informační společnosti.",
    retention: "Do odvolání souhlasu. Doklad o souhlasu a jeho odvolání uchováváme ještě 3 roky po odvolání pro případ sporu.",
  },
  {
    purpose: "Účet a provoz pokladny",
    data: "E-mail a jméno uživatele, údaje firmy (název, IČO, DIČ), jména pokladních, evidenční jednotky, pokladní certifikát, tržby, doklady.",
    basis: "Plnění smlouvy – čl. 6 odst. 1 písm. b) GDPR; u placených tarifů také právní povinnost (účetní a daňové doklady) – písm. c).",
    retention: "Po dobu trvání účtu a 30 dnů po jeho zrušení (na export), potom údaje smažeme. Účetní doklady k platbám po dobu stanovenou zákonem.",
  },
  {
    purpose: "Účetní kabinet",
    data: "U účetní: e-mail, název a IČO kanceláře, seznam IČO a popisků klientů. U klienta, který pozvánku přijme: stav připravenosti na EET a export tržeb, které účetní uvidí.",
    basis:
      "Plnění smlouvy s účetní – čl. 6 odst. 1 písm. b) GDPR. Seznam IČO klientů je oprávněný zájem účetní na správě klientů – písm. f). Sdílení dat z pokladny jen po přijetí pozvánky klientem.",
    retention: "Po dobu trvání účtu účetní. Propojení s klientem trvá, dokud ho klient nebo účetní nezruší (klient ho zruší v nastavení pokladny).",
  },
  {
    purpose: "Katalog firem a kontrola IČO",
    data: "Veřejné údaje z registrů ARES, živnostenského rejstříku (RŽP) a ČSÚ: název, IČO, právní forma, obory činnosti, provozovny. U fyzických osob nezobrazujeme adresu bydliště.",
    basis: "Oprávněný zájem – čl. 6 odst. 1 písm. f) GDPR: informovat podnikatele a veřejnost o tom, zda se jich může týkat evidence tržeb.",
    retention: "Po dobu, kdy jsou údaje veřejné v registrech; aktualizujeme je pravidelně. Odpovědi ARES pro kontrolu IČO ukládáme do mezipaměti na 24 hodin.",
  },
  {
    purpose: "Vyřízení námitek a žádostí",
    data: "Jméno, e-mail, IČO či číslo provozovny, text žádosti.",
    basis: "Splnění právní povinnosti – čl. 6 odst. 1 písm. c) GDPR (výkon vašich práv).",
    retention: "3 roky od vyřízení.",
  },
  {
    purpose: "Bezpečnost a ochrana před zneužitím",
    data: "IP adresa a technické údaje o požadavku (např. pro omezení počtu dotazů), přihlašovací relace.",
    basis: "Oprávněný zájem – čl. 6 odst. 1 písm. f) GDPR: zabezpečení služby.",
    retention:
      "Přihlašovací relace a odkazy do vypršení, záznamy o odeslaných e-mailech 90 dnů. Technické záznamy serveru jsou omezené velikostí a průběžně se přepisují.",
  },
];

function controllerIdentity(): string {
  return operatorLine();
}

const SECTIONS: readonly { id: string; title: string; body: ReactNode }[] = [
  {
    id: "spravce",
    title: "Kdo je správce",
    body: (
      <>
        <p>
          Správcem osobních údajů je společnost {controllerIdentity()}, provozovatel služby EvidujZdarma (dále „my“). S
          jakýmkoli dotazem nebo žádostí nám napište na <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
        <p>EvidujZdarma je nezávislá služba, nejsme Finanční správa ani jiný státní orgán.</p>
      </>
    ),
  },
  {
    id: "ucely",
    title: "Jaké údaje, proč a jak dlouho",
    body: (
      <>
        <p>Zpracováváme jen údaje, které pro daný účel potřebujeme. Přehled účelů, právních základů a dob uložení:</p>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
            <caption className="sr-only">Účely zpracování osobních údajů</caption>
            <thead>
              <tr className="bg-surface">
                <th scope="col" className="border-b-2 border-line px-3 py-2 font-semibold text-ink">
                  Účel
                </th>
                <th scope="col" className="border-b-2 border-line px-3 py-2 font-semibold text-ink">
                  Údaje
                </th>
                <th scope="col" className="border-b-2 border-line px-3 py-2 font-semibold text-ink">
                  Právní základ
                </th>
                <th scope="col" className="border-b-2 border-line px-3 py-2 font-semibold text-ink">
                  Doba uložení
                </th>
              </tr>
            </thead>
            <tbody>
              {PURPOSES.map((p) => (
                <tr key={p.purpose}>
                  <th scope="row" className="border-b border-line px-3 py-3 align-top font-semibold text-ink">
                    {p.purpose}
                  </th>
                  <td className="border-b border-line px-3 py-3 align-top text-ink-soft">{p.data}</td>
                  <td className="border-b border-line px-3 py-3 align-top text-ink-soft">{p.basis}</td>
                  <td className="border-b border-line px-3 py-3 align-top text-ink-soft">{p.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "marketing",
    title: "Marketingové e-maily jen se souhlasem",
    body: (
      <p>
        Novinky a nabídky posíláme jen tehdy, když jste k tomu zaškrtli souhlas. Souhlas je dobrovolný a jeho neudělení nemá vliv
        na předregistraci ani na používání pokladny. Odvolat ho můžete kdykoli odkazem v každém e-mailu nebo zprávou na{" "}
        {SITE.email}. Servisní e-maily (potvrzení e-mailu, přihlášení, upozornění na neodeslané tržby nebo konec platnosti
        certifikátu) posíláme bez souhlasu, protože jsou nutné pro službu.
      </p>
    ),
  },
  {
    id: "pokladna",
    title: "Data v pokladně",
    body: (
      <>
        <p>
          Údaje o vašich tržbách, dokladech a pokladních zpracováváme proto, abychom vám mohli poskytovat pokladnu a odesílat
          datové zprávy Finanční správě. Privátní klíč pokladního certifikátu ukládáme šifrovaně a používáme ho jen k podepisování
          datových zpráv za vás. Heslo k souboru certifikátu neukládáme – použijeme ho jen jednou při nahrání.
        </p>
        <p>
          Pokud v pokladně zadáte osobní údaje dalších osob (například e-mail zákazníka, kterému posíláte doklad, nebo jména
          pokladních), jste ve vztahu k nim správcem vy a my je zpracováváme jen podle vašich pokynů a pro účel poskytování
          služby. Podrobnosti upravuje zpracovatelská doložka v{" "}
          <Link href="/podminky#zpracovani">čl. 10 obchodních podmínek</Link>.
        </p>
      </>
    ),
  },
  {
    id: "katalog",
    title: "Katalog firem z veřejných registrů",
    body: (
      <>
        <p>
          Na webu zveřejňujeme katalog firem a provozoven s orientačním vyhodnocením, zda se jich může týkat EET 2.0. Údaje
          přebíráme z veřejných registrů – ARES, živnostenského rejstříku (RŽP) a Českého statistického úřadu. U podnikajících
          fyzických osob nezobrazujeme adresu bydliště.
        </p>
        <p>
          <strong>Máte právo vznést námitku</strong> proti tomuto zpracování podle čl. 21 GDPR nebo požádat o opravu údajů,
          a to přes <Link href="/namitka">formulář námitky</Link>. Námitku vyřídíme nejpozději do 30 dnů. Pokud neprokážeme
          závažné oprávněné důvody pro další zpracování, údaje z katalogu odstraníme nebo stránku vyřadíme z vyhledávačů.
        </p>
        <p>
          Seznamy IČO, které zadáte do kontroly IČO nebo do hromadné kontroly pro účetní, neukládáme k žádnému profilu. Veřejné
          odpovědi registru ARES krátkodobě ukládáme do mezipaměti.
        </p>
      </>
    ),
  },
  {
    id: "prijemci",
    title: "Kdo k údajům má přístup",
    body: (
      <>
        <p>Údaje neprodáváme. Předáváme je jen těmto příjemcům, a to v nezbytném rozsahu:</p>
        <ul>
          <li>
            <strong>Zpracovatelé</strong> – poskytovatel hostingu se servery v Evropské unii a poskytovatel doručování e-mailů.
            Po spuštění placených doplňků také platební partner. Se všemi máme uzavřenou smlouvu o zpracování osobních údajů.
          </li>
          <li>
            <strong>Finanční správa</strong> – datové zprávy o evidovaných tržbách, které pokladna odesílá za vás podle zákona o
            evidenci tržeb.
          </li>
          <li>
            <strong>Vaše účetní</strong> – jen pokud jí v pokladně sami zpřístupníte údaje (například přes pozvánku z Účetního
            kabinetu).
          </li>
          <li>
            <strong>Orgány veřejné moci</strong> – pokud nám to ukládá zákon.
          </li>
        </ul>
        <p>
          <strong>Osobní údaje nepředáváme mimo Evropskou unii</strong> (Evropský hospodářský prostor). Aktuální seznam
          zpracovatelů vám na požádání pošleme.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies a úložiště v prohlížeči",
    body: (
      <p>
        Používáme jen nezbytné cookies pro přihlášení do účtu. Pokud přijdete přes odkaz s doporučením, uložíme si kód
        doporučení do úložiště vašeho prohlížeče, abychom ho mohli přiřadit k předregistraci. Když hlasujete v anketě, uložíme
        náhodný identifikátor do cookie <code>ez_voter</code> (platnost 1 rok), aby z jednoho prohlížeče šel jen jeden hlas;
        u hlasu ukládáme jen jeho otisk, ne IP adresu ani jméno. Analytické ani reklamní cookies
        nepoužíváme; kdybychom to změnili, nejdřív vás požádáme o souhlas.
      </p>
    ),
  },
  {
    id: "prava",
    title: "Vaše práva",
    body: (
      <>
        <p>Máte právo:</p>
        <ul>
          <li>na přístup ke svým údajům (čl. 15 GDPR) a na jejich opravu (čl. 16),</li>
          <li>na výmaz (čl. 17) a na omezení zpracování (čl. 18),</li>
          <li>na přenositelnost údajů, které jste nám poskytli (čl. 20),</li>
          <li>vznést námitku proti zpracování na základě oprávněného zájmu (čl. 21),</li>
          <li>kdykoli odvolat souhlas, aniž by tím byla dotčena zákonnost dřívějšího zpracování.</li>
        </ul>
        <p>
          Žádost pošlete na <a href={`mailto:${SITE.email}`}>{SITE.email}</a>, námitku ke katalogu firem přes{" "}
          <Link href="/namitka">formulář námitky</Link>. Odpovíme nejpozději do 30 dnů. Abychom údaje nevydali nesprávné osobě,
          můžeme vás požádat o ověření totožnosti.
        </p>
        <p>
          Pokud se domníváte, že údaje zpracováváme v rozporu s předpisy, můžete podat stížnost u Úřadu pro ochranu osobních
          údajů (
          <a href="https://uoou.gov.cz" rel="noopener">
            uoou.gov.cz
          </a>
          ).
        </p>
        <p>
          Nepoužíváme automatizované rozhodování s právními účinky (čl. 22 GDPR). Orientační vyhodnocení v nástrojích (např. „EET
          se vás pravděpodobně týká“) žádné právní účinky nemá.
        </p>
      </>
    ),
  },
  {
    id: "zabezpeceni",
    title: "Zabezpečení",
    body: (
      <p>
        Data ukládáme na serverech v Evropské unii. Privátní klíče pokladních certifikátů ukládáme šifrovaně (AES-256-GCM,
        šifrovací klíč je uložen mimo databázi); heslo k souboru certifikátu neukládáme. Přenos probíhá šifrovaně (HTTPS) a
        přístup k datům mají jen pověřené osoby v rozsahu nezbytném pro provoz a podporu.
      </p>
    ),
  },
  {
    id: "zmeny",
    title: "Změny zásad",
    body: (
      <p>
        Zásady můžeme aktualizovat, například při spuštění nových funkcí. O podstatných změnách vás předem informujeme e-mailem.
        Tato verze platí od {VERSION_LABEL}.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="Ochrana osobních údajů"
        crumbs={[{ name: "Ochrana osobních údajů", path: "/ochrana-osobnich-udaju" }]}
        lead={
          <>
            Verze ze dne <time dateTime={VERSION_DATE}>{VERSION_LABEL}</time>. Srozumitelně o tom, jaké údaje zpracováváme, proč a
            jaká máte práva.
          </>
        }
      />
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Obsah zásad" className="lg:sticky lg:top-24 lg:self-start">
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
              <strong>Ve zkratce:</strong> údaje neprodáváme a nepředáváme mimo EU. Marketingové e-maily posíláme jen se souhlasem.
              Katalog firem stavíme z veřejných registrů a fyzickým osobám nezobrazujeme adresu bydliště. Proti zobrazení můžete
              kdykoli vznést <Link href="/namitka">námitku</Link>.
            </p>
            {SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
                <h2 id={`${s.id}-h`}>
                  {i + 1}. {s.title}
                </h2>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
