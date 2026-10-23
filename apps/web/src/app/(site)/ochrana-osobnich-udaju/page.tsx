// TODO(právník): Pracovní návrh zásad zpracování osobních údajů – před spuštěním pokladny nechat zrevidovat
// advokátem / pověřencem. Zkontrolovat zejména: (1) test oprávněného zájmu (LIA) pro katalog firem z veřejných
// registrů – hotový v docs/LIA-katalog-firem.md (S3), katalog je od 17. 10. 2026 veřejný – a rozsah údajů u fyzických osob; (2) doby uložení v sekci „Jak dlouho údaje uchováváme“ (jsou to
// navržené interní lhůty, ne zákonné); (3) roli správce × zpracovatele u dat pokladny (údaje zákazníků a pokladních
// podnikatele) a potřebu zpracovatelské smlouvy dle čl. 28 GDPR v obchodních podmínkách; (4) doplnit jména
// zpracovatelů (hosting v EU, doručování e-mailů, později platební partner a poskytovatel AI přehledu – u AI ověřit,
// že data neopustí EU); (5) cookies – nyní jen nezbytné (přihlášení) a cookie ankety ez_voter; v localStorage jen
// název kanceláře v šablonách, kód doporučení se do prohlížeče neukládá (R7.10); měření návštěvnosti bez cookies (R15.3);
// (6) identifikační údaje správce jsou v lib/site.ts (OPERATOR, ověřeno v OR 2. 10. 2026); (7) S4 (23. 10. 2026): souhlas
// s cookies – první vrstva lišty bez „Odmítnout“ je rozhodnutí majitele (DECISIONS К10, ÚOOÚ/EDPB to vidí jako riziko);
// po zapnutí značek ověřit u Meta Pixelu společné správcovství (čl. 26 GDPR, dodatek Meta pro správce) a doby cookies;
// (8) S4b (23. 10. 2026): zapnutý Microsoft Clarity (záznamy průchodu, teplotní mapy) – ověřit roli Microsoftu (podle FAQ
// Clarity „data controller“, smluvní strana v EU Microsoft Ireland Operations Ltd.) a podmínky Clarity (Clarity Terms of Use).
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { CATALOG_DATA } from "@/content/catalog-data";
import { PRIVACY_DATE_ISO, PRIVACY_VERSION_LABEL } from "@/lib/legal";
import { SITE, operatorLine } from "@/lib/site";
import { ExternalLink } from "@/components/external-link";
import { canonicalMeta } from "@/lib/metadata";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_DAYS } from "@/lib/consent";
import { configuredTracking } from "@/lib/tracking-config";

const VERSION_DATE = PRIVACY_DATE_ISO;
const VERSION_LABEL = PRIVACY_VERSION_LABEL;

export const metadata: Metadata = {
  title: "Ochrana osobních údajů (GDPR)",
  description:
    "Jak EvidujZdarma zpracovává osobní údaje: předregistrace, marketing jen se souhlasem, data pokladny, katalog firem z veřejných registrů, doby uložení a práva.",
  ...canonicalMeta("/ochrana-osobnich-udaju"),
};

/**
 * S4-COOKIES: značky třetích stran, které se načtou až po souhlasu. V zásadách jen ty, které jsou v lib/tracking-config.ts
 * zapnuté. Názvy a doby cookies podle dokumentace poskytovatelů k 23. 10. 2026.
 */
const TRACKING_ON = configuredTracking();
const TRACKING_VENDORS: readonly { on: boolean; tool: string; category: string; purpose: string; cookies: string; controller: string }[] = [
  {
    on: !!TRACKING_ON.ga4,
    tool: "Google Analytics 4",
    category: "Analytické",
    purpose: "Statistiky návštěvnosti a používání stránek a nástrojů.",
    cookies: "_ga a _ga_<ID> (2 roky).",
    controller:
      "Google Ireland Limited; údaje mohou být předány společnosti Google LLC do USA na základě rámce EU-U.S. Data Privacy Framework.",
  },
  {
    on: !!TRACKING_ON.clarity,
    tool: "Microsoft Clarity",
    category: "Analytické",
    purpose:
      "Záznamy průchodu stránkami (kliknutí, posouvání, pohyb myši) a teplotní mapy, abychom viděli, kde se lidé na webu zasekávají. Co napíšete do formulářů, se nezaznamenává; čísla a e-mailové adresy na stránce se v záznamu skryjí. Na pokladně a v kabinetu Clarity neběží.",
    cookies: "_clck (1 rok) a _clsk (1 den); na doménách Microsoftu (clarity.ms, bing.com) například CLID a MUID (1 rok).",
    controller:
      "Microsoft Ireland Operations Limited; údaje mohou být předány společnosti Microsoft Corporation do USA na základě standardních smluvních doložek EU a rámce EU-U.S. Data Privacy Framework. Záznamy se uchovávají 30 dní, teplotní mapy nejvýš 9 měsíců.",
  },
  {
    on: !!TRACKING_ON.googleAds,
    tool: "Google Ads",
    category: "Marketingové",
    purpose: "Měření konverzí z reklamy a zobrazování reklamy lidem, kteří náš web navštívili.",
    cookies: "_gcl_au (90 dní); na doménách Googlu (doubleclick.net, google.com) například IDE (nejvýš 13 měsíců).",
    controller:
      "Google Ireland Limited; údaje mohou být předány společnosti Google LLC do USA na základě rámce EU-U.S. Data Privacy Framework.",
  },
  {
    on: !!TRACKING_ON.metaPixel,
    tool: "Meta Pixel",
    category: "Marketingové",
    purpose: "Měření výsledků reklamy na Facebooku a Instagramu a zobrazování reklamy lidem, kteří náš web navštívili.",
    cookies: "_fbp a _fbc (90 dní); na doméně facebook.com například fr (90 dní).",
    controller:
      "Meta Platforms Ireland Limited; při shromáždění a předání údajů jsme s ní společnými správci. Údaje mohou být předány společnosti Meta Platforms, Inc. do USA na základě rámce EU-U.S. Data Privacy Framework.",
  },
  {
    on: !!TRACKING_ON.sklik,
    tool: "Sklik (retargeting)",
    category: "Marketingové",
    purpose: "Zobrazování reklamy v síti Seznam.cz lidem, kteří náš web navštívili, a měření jejích výsledků.",
    cookies: "Cookies na doménách Seznam.cz podle zásad Seznam.cz.",
    controller: "Seznam.cz, a.s., Praha; údaje zůstávají v EU.",
  },
];

const PURPOSES: readonly { purpose: string; data: string; basis: string; retention: string }[] = [
  {
    purpose: "Předregistrace k pokladně, přihláška na webinář a zájem o Účetní kabinet",
    data: "E-mail, nepovinně IČO a název firmy z ARES, obor, počet provozoven, co potřebujete (platební terminál, tiskárna, pomoc s DIS+), kód doporučení, zdroj návštěvy (UTM), u webinářů a Účetního kabinetu, o co máte zájem.",
    basis: "Provedení opatření před uzavřením smlouvy na vaši žádost – čl. 6 odst. 1 písm. b) GDPR.",
    retention:
      "Do spuštění pokladny (2. 11. 2026) a poté nejvýše 12 měsíců od spuštění, nebo od registrace, pokud proběhla později – pokud si nezaložíte účet ani neudělíte souhlas s novinkami; dříve na vaši žádost. Předregistraci, kterou jste nepotvrdili odkazem z e-mailu, smažeme do 90 dnů od posledního zaslaného odkazu. Zrušíte-li předregistraci (odkazem „Odhlásit odběr“ v e-mailu), ostatní údaje smažeme a ponecháme si jen e-mail, datum předregistrace a datum zrušení, abychom vám už nic neposílali (3 roky).",
  },
  {
    purpose: "Novinky k EET a nabídky e-mailem",
    data: "E-mail, údaje z předregistrace, datum udělení souhlasu, verze jeho textu a čas potvrzení e-mailu (u předregistrací do 2. 10. 2026 místo verze textu otisk IP adresy a prohlížeče).",
    basis: "Váš souhlas – čl. 6 odst. 1 písm. a) GDPR a § 7 zákona č. 480/2004 Sb., o některých službách informační společnosti.",
    retention:
      "Do odvolání souhlasu. Doklad o souhlasu a jeho odvolání (e-mail, datum a verzi textu souhlasu) uchováváme ještě 3 roky po odvolání pro případ sporu. Předregistrace po odvolání souhlasu trvá dál podle předchozího řádku.",
  },
  {
    purpose: "Účet a provoz pokladny",
    // R17.4 – doslovně
    data: "E-mail a jméno uživatele, údaje firmy (název, IČO, DIČ), jména pokladních, evidenční jednotky, pokladní certifikát, tržby, doklady. Pokud jste se předregistrovali, převezmeme z předregistrace i zdroj návštěvy (UTM) – na základě oprávněného zájmu zjistit, které cesty k nám fungují (čl. 6 odst. 1 písm. f) GDPR).",
    basis: "Plnění smlouvy – čl. 6 odst. 1 písm. b) GDPR; u placených tarifů také právní povinnost (účetní a daňové doklady) – písm. c).",
    retention:
      "Po dobu trvání účtu a 30 dnů po jeho zrušení (na export), potom údaje smažeme. Obsahuje-li zrušený účet ostré tržby, které nebyly odeslány Finanční správě, uchováme ho nejdéle 60 dnů od zrušení, abyste je mohli vyřídit; dříve, pokud je v nastavení označíte jako evidované jinak. Účetní doklady k platbám po dobu stanovenou zákonem.",
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
    data: `Veřejné údaje z Registru ekonomických subjektů ČSÚ a z ARES: ${CATALOG_DATA}. U podnikajících fyzických osob nezobrazujeme adresu, DIČ ani provozovny.`,
    basis:
      "Oprávněný zájem – čl. 6 odst. 1 písm. f) GDPR: umožnit najít obchodního partnera podle IČO, vystavit mu fakturu a ověřit jeho údaje a informovat podnikatele a veřejnost o tom, zda se jich může týkat evidence tržeb. Test oprávněného zájmu máme zdokumentovaný.",
    retention:
      "Po dobu, kdy je subjekt zapsán v registrech; údaje z registrů pravidelně obnovujeme. Zaniklý subjekt vyřadíme ze seznamů při nejbližší aktualizaci, jeho stránku 90 dnů po zániku zrušíme a údaje smažeme při nejbližší aktualizaci dat. Odpovědi ARES pro kontrolu IČO ukládáme do mezipaměti na 24 hodin.",
  },
  {
    purpose: "Vyřízení námitek a žádostí",
    data: "Jméno, e-mail, IČO či číslo provozovny, text žádosti.",
    basis: "Splnění právní povinnosti – čl. 6 odst. 1 písm. c) GDPR (výkon vašich práv).",
    retention: "3 roky od vyřízení.",
  },
  {
    purpose: "Měření návštěvnosti webu",
    data: "Souhrnná čísla za den: zobrazení stránek, počet návštěvníků, průměrný čas na stránce, doména webu, ze kterého jste přišli, typ zařízení, označení kampaně z odkazu (UTM) a počet použití nástrojů (např. kontroly IČO). Z IP adresy a typu prohlížeče se v paměti serveru počítá anonymní otisk; IP adresu ani otisk neukládáme.",
    basis: "Oprávněný zájem – čl. 6 odst. 1 písm. f) GDPR: zlepšování webu.",
    retention: "Souhrnná čísla 25 měsíců. Otisk se o půlnoci zahodí.",
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
          Od 17. 10. 2026 zveřejňujeme <Link href="/firmy">katalog firem a provozoven</Link>, zatím pro Karlovarský kraj. Ukazuje údaje
          o podnikatelích z veřejných registrů a orientační odhad, zda se jich může týkat EET 2.0. Tato část zásad je informací podle
          čl. 14 GDPR pro podnikatele, jejichž údaje jsme nezískali přímo od nich.
        </p>
        <p>
          <strong>Odkud údaje máme.</strong> Z Registru ekonomických subjektů Českého statistického úřadu (zveřejňovaného jako otevřená
          data) a z registru ARES Ministerstva financí. U firem (právnických osob) přebíráme z ARES i provozovny ze živnostenského
          rejstříku.
        </p>
        <p>
          <strong>Jaké údaje.</strong> {CATALOG_DATA}. U podnikajících fyzických osob (OSVČ) nezveřejňujeme adresu bydliště ani sídla,
          DIČ, provozovny a živnosti. Nikde neuvádíme datum narození ani rodné číslo, údaje o statutárních orgánech a stránky osob
          nevytváříme.
        </p>
        <p>
          <strong>Proč a na jakém základě.</strong> Na základě oprávněného zájmu (čl. 6 odst. 1 písm. f) GDPR) našeho i uživatelů webu:
          najít obchodního partnera podle IČO, vystavit mu fakturu, ověřit jeho údaje a zjistit, zda se ho může týkat evidence tržeb.
          Test oprávněného zájmu (balanční test) máme zdokumentovaný a na vyžádání ho poskytneme.
        </p>
        <p>
          <strong>Jak omezujeme zásah do soukromí.</strong> Stránky OSVČ označujeme pro vyhledávače jako neindexované, nejsou v mapě
          webu a v seznamech uvádíme OSVČ jen počtem – stránku najde ten, kdo zná IČO. Zaniklý subjekt vyřadíme ze seznamů při
          nejbližší aktualizaci, jeho stránku 90 dnů po zániku zrušíme a údaje smažeme při nejbližší aktualizaci dat. Údaje z registrů
          pravidelně obnovujeme a nic k nim nedoplňujeme ani je nehodnotíme.
        </p>
        <p>
          <strong>Kdo údaje uvidí.</strong> Stránky katalogu jsou veřejně přístupné; stránky firem (právnických osob) mohou indexovat
          vyhledávače. Dalším příjemcům údaje nepředáváme, technicky je u nás zpracovává jen poskytovatel hostingu.
        </p>
        <p>
          <strong>Máte právo vznést námitku</strong> proti tomuto zpracování podle čl. 21 GDPR nebo požádat o opravu údajů,
          a to přes <Link href="/namitka">formulář námitky</Link>. U OSVČ stránku vyřadíme z vyhledávačů hned po odeslání, u firem po
          potvrzení e-mailu. Námitku vyřídíme nejpozději do 30 dnů. Pokud neprokážeme závažné oprávněné důvody pro další zpracování,
          údaje z katalogu odstraníme nebo stránku vyřadíme z vyhledávačů. Máte také právo na přístup k údajům a jejich opravu a právo
          podat stížnost u Úřadu pro ochranu osobních údajů (viz <a href="#prava">Vaše práva</a>).
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
            <strong>Zpracovatelé</strong> – poskytovatel hostingu se servery v Evropské unii a poskytovatel doručování e-mailů Brevo
            (Sendinblue SAS, 17 rue Salneuve, 75017 Paříž, Francie). Odkazy v e-mailech vedou přes doménu Brevo, která anonymně
            počítá otevření a prokliky, bez vazby na konkrétního příjemce. Po spuštění placených doplňků také platební partner. Se
            všemi máme uzavřenou smlouvu o zpracování osobních údajů.
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
          <strong>Údaje ukládáme v Evropské unii.</strong> Brevo e-maily odesílá a ukládá na serverech v EU; jeho podpora a někteří
          jeho subdodavatelé mohou mít k údajům v nezbytném rozsahu přístup i ze zemí mimo EU (USA, Indie), a to na základě
          standardních smluvních doložek EU, u společností v USA také rámce EU-U.S. Data Privacy Framework. Aktuální seznam
          zpracovatelů vám na požádání pošleme.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies a úložiště v prohlížeči",
    body: (
      <>
        <p>
          Používáme jen nezbytné cookies pro přihlášení do účtu. Pokud přijdete přes odkaz s doporučením, kód doporučení
          odešleme jen spolu s formulářem předregistrace; do prohlížeče ho neukládáme. Když hlasujete v anketě, uložíme
          náhodný identifikátor do cookie <code>ez_voter</code> (platnost 1 rok), aby z jednoho prohlížeče šel jen jeden hlas;
          u hlasu ukládáme jen jeho otisk, ne IP adresu ani jméno (oprávněný zájem na férovém výsledku ankety, čl. 6 odst. 1
          písm. f) GDPR).{" "}
          {TRACKING_ON.marketing
            ? "Analytické a reklamní cookies používáme jen s vaším souhlasem – podrobnosti níže."
            : TRACKING_ON.analytics
              ? "Analytické cookies používáme jen s vaším souhlasem – podrobnosti níže. Reklamní cookies nepoužíváme."
              : "Analytické ani reklamní cookies nepoužíváme; kdybychom to změnili, nejdřív vás požádáme o souhlas."}
          Název kanceláře, který vyplníte v šablonách dopisů pro klienty, zůstává jen ve vašem prohlížeči a na server ho
          neposíláme.
        </p>
        {/* S4-COOKIES: souhlas s cookies (lib/consent.ts) */}
        <p id="souhlas-s-cookies">
          <strong>Souhlas s cookies.</strong> Měřicí a reklamní nástroje třetích stran (Google, Microsoft, Meta, Seznam) načteme jen tehdy,
          když nám k tomu dáte souhlas v liště cookies; bez souhlasu se z nich do vašeho prohlížeče nic nedostane. Vaši volbu
          uložíme do nezbytné cookie <code>{CONSENT_COOKIE}</code> na {Math.round(CONSENT_MAX_AGE_DAYS / 30)} měsíců (verze lišty,
          zda jste povolili analytické a marketingové cookies, a den rozhodnutí), pak se zeptáme znovu. Souhlas můžete kdykoli
          změnit nebo odvolat tlačítkem „Nastavení cookies“ v patičce webu; odvolání se netýká zpracování před ním. Právním
          základem je váš souhlas (§ 89 odst. 3 zákona o elektronických komunikacích, čl. 6 odst. 1 písm. a) GDPR).
        </p>
        {TRACKING_ON.any ? (
          <div className="overflow-x-auto">
            <table>
              <caption className="mb-2 text-left text-sm text-muted">Nástroje, které načteme jen s vaším souhlasem</caption>
              <thead>
                <tr>
                  <th scope="col">Nástroj</th>
                  <th scope="col">Kategorie a účel</th>
                  <th scope="col">Cookies (doba)</th>
                  <th scope="col">Správce, předání mimo EU</th>
                </tr>
              </thead>
              <tbody>
                {TRACKING_VENDORS.filter((v) => v.on).map((v) => (
                  <tr key={v.tool}>
                    <td>{v.tool}</td>
                    <td>
                      {v.category}: {v.purpose}
                    </td>
                    <td>{v.cookies}</td>
                    <td>{v.controller}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Teď žádný takový nástroj nepoužíváme, proto vám lištu cookies neukazujeme.</p>
        )}
        {/* R15.3 – doslovně */}
        <p id="mereni-navstevnosti">
          <strong>Měření návštěvnosti.</strong> Abychom věděli, které stránky lidem pomáhají, počítáme návštěvy webu vlastním
          nástrojem na našem serveru. Nepoužíváme cookies ani jiné ukládání do vašeho zařízení a vaši IP adresu neukládáme: z IP
          adresy a typu prohlížeče se po dobu jednoho dne vypočítá anonymní otisk, který se o půlnoci zahodí. Uchováváme jen
          souhrnná čísla za den (počet zobrazení stránek, počet návštěvníků, odkud přišli a z jakého typu zařízení) po dobu 25
          měsíců. Pokud máte v prohlížeči zapnutý signál Do Not Track nebo Global Privacy Control, nepočítáme vás vůbec. Právním
          základem je náš oprávněný zájem na zlepšování webu.
        </p>
      </>
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
          <ExternalLink href="https://uoou.gov.cz">
            uoou.gov.cz
          </ExternalLink>
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
              <strong>Ve zkratce:</strong> údaje neprodáváme a ukládáme je v EU. Marketingové e-maily posíláme jen se souhlasem.
              Katalog firem stavíme jen z veřejných registrů; u podnikajících fyzických osob v něm neukazujeme adresu ani DIČ a jejich
              stránky nejsou ve vyhledávačích. Proti zpracování můžete kdykoli vznést <Link href="/namitka">námitku</Link>.
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
