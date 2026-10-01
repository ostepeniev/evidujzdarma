import { FACTS, SOURCES, TIMELINE, formatKc } from "../facts";
import type { Guide } from "./types";

const surcharge = FACTS.eetOff.surchargeMonthly;

export const eet20KompletniPruvodce: Guide = {
  slug: "eet-2-0-kompletni-pruvodce",
  category: "zaklady",
  title: "EET 2.0 v roce 2027: kompletní průvodce",
  h1: "EET 2.0 v roce 2027: kompletní průvodce pro podnikatele",
  description:
    "Vše o EET 2.0 na jednom místě: od kdy platí, koho se týká, co se eviduje, EET OFF, DIS+ a certifikát, pokuty, účtenky a výběr pokladny. Stav k 1. 10. 2026.",
  lead: `EET 2.0 je nová elektronická evidence tržeb. Zákon platí od **1. 1. 2027** a evidovat se musí od prvního dne – „pilotní“ leden není zákonná výjimka. Týká se OSVČ i firem, které přijímají platby osobně – hotově, kartou nebo QR kódem. Účtenka povinná není, pokuta může dosáhnout ${formatKc(FACTS.penalties.max)}. Paušalisté v 1. pásmu se mohou vyvázat přes EET OFF.`,
  summary: [
    "Účinnost i povinnost evidovat od 1. 1. 2027. Zákon pilotní ani dobrovolný režim nezná.",
    "Evidují se kontaktní platby: hotovost, karta, QR kód, poukázka – ne převody na fakturu ani platební brána e-shopu.",
    "Od 1. 11. 2026 se v DIS+ přihlásíte k evidenci, oznámíte evidenční jednotky a stáhnete certifikát.",
    `EET OFF: paušalisté v 1. pásmu s příjmy do 1 mil. Kč zaplatí ${formatKc(surcharge)} měsíčně a neevidují; lhůta ${FACTS.eetOff.deadline}.`,
    "Účtenka není povinná, kódy FIK a BKP nahradil POK; provozovnu za EET už nelze zavřít.",
  ],
  sections: [
    {
      id: "co-je-eet-2-0",
      heading: "Co je EET 2.0",
      blocks: [
        {
          p: `EET 2.0 je zkratka, pod kterou se vžil nový **zákon o evidenci tržeb**. Vláda ho schválila v květnu 2026, Poslanecká sněmovna ho projednávala jako ${FACTS.law.printNo} a po přehlasování Senátu ho prezident podepsal **${FACTS.law.signedOn}**. Účinnosti nabývá **${FACTS.law.effectiveFrom}**.`,
        },
        {
          p: "Princip je podobný jako u první EET z let 2016–2020: podnikatel při přijetí platby odešle údaje o tržbě online Finanční správě a ta mu potvrdí přijetí. Nový systém je ale v mnoha ohledech jiný. Neukládá povinnost vydávat účtenky, posílá se méně údajů, místo tří kódů (FIK, BKP, PKP) existuje jediný **potvrzovací kód POK** a vše se vyřizuje v Daňové informační schránce (DIS+). Zároveň má širší záběr – evidují se i platby kartou a QR kódem na místě – a startuje pro všechny obory najednou.",
        },
        {
          p: "Ministerstvo financí a Finanční správa nový systém představují jako jednodušší a levnější pro podnikatele: na evidenci má stačit běžný telefon, tablet nebo počítač a stát nabídne vlastní pokladní aplikaci MOJE eet zdarma.",
        },
        { h3: "Proč stát evidenci vrací" },
        {
          p: "Podle Finanční správy má EET 2.0 přinést férovější trh a jednodušší správu daní. Cílem je, aby podnikatelé, kteří tržby přiznávají poctivě, nesoutěžili s těmi, kdo část příjmů zamlčí. Oproti první EET stát zdůrazňuje nižší zátěž: žádné povinné účtenky, méně údajů, bezplatnou aplikaci a možnost se z evidence vyvázat přes EET OFF. Pro podnikatele je podstatné, že zákon je schválený a od roku 2027 platí.",
        },
        {
          note: "EvidujZdarma.cz je nezávislý web a pokladní aplikace, nikoli státní služba. Oficiální informace najdete na [eet.gov.cz](https://eet.gov.cz) a na webu Finanční správy. Každé tvrzení v tomto průvodci odkazuje na zdroj; kde Finanční správa zatím nic nezveřejnila, píšeme to otevřeně.",
        },
      ],
    },
    {
      id: "harmonogram",
      heading: "Harmonogram: klíčová data 2026–2027",
      blocks: [
        {
          table: {
            head: ["Datum", "Co se děje", "Co udělat"],
            rows: TIMELINE.map((t) => [`**${t.dateLabel}**`, t.title, t.action]),
            caption: "Podle harmonogramu Finanční správy a tiskových zpráv ministerstva financí.",
          },
        },
        {
          p: "Pro podnikatele je nejdůležitější období **listopad a prosinec 2026**. V listopadu se otevírají funkce v DIS+, v prosinci státní aplikace MOJE eet. Prosinec je poslední příležitost vyzkoušet si pokladnu nanečisto – od 1. 1. 2027 se eviduje naostro. Do 11. ledna se pak rozhoduje o EET OFF.",
        },
        {
          note: FACTS.pilot.summary,
          tone: "warn",
        },
      ],
    },
    {
      id: "koho-se-tyka",
      heading: "Koho se EET 2.0 týká",
      blocks: [
        { p: FACTS.whoMust.summary },
        {
          p: "Rozhodují dvě věci: že jste **poplatník daně z příjmů** (OSVČ nebo firma) a že **přijímáte kontaktní platby** v rámci podnikání. Nezáleží na oboru, na tom, zda jste plátce DPH, ani na výši obratu – obecná hranice, pod kterou by evidence odpadla, neexistuje. Kadeřnice, penzion, instalatér, stánkař na trhu, kavárna i lektor, kterému klienti platí na místě, spadají do EET 2.0 stejně.",
        },
        { p: FACTS.whoMust.notCovered },
        { p: FACTS.whoMust.exemptions },
        { p: FACTS.whoMust.occasional },
        {
          p: "Podrobný rozbor včetně výjimek pro spolky, automaty a zahraniční podnikatele najdete v návodu [Koho se EET týká a kdo má výjimku](/navody/koho-se-eet-tyka). Rychlou odpověď dá [kvíz Musím evidovat?](/musim-evidovat) nebo [kontrola podle IČO](/kontrola-ico).",
        },
        { cta: "kontrola-ico" },
      ],
    },
    {
      id: "co-se-eviduje",
      heading: "Co se eviduje: kontaktní platby",
      blocks: [
        {
          p: "Klíčový pojem nového zákona je **kontaktní platba** – platba přijatá při osobním kontaktu se zákazníkem nebo v souvislosti s objednáním či převzetím zboží a služby v provozovně. Rozhoduje okolnost platby, ne platební prostředek.",
        },
        { p: FACTS.evidenced.summary },
        { p: FACTS.evidenced.notEvidenced },
        {
          table: {
            head: ["Platba", "Eviduje se?"],
            rows: [
              ["Hotovost na místě", "**Ano**"],
              ["Karta přes terminál (i mobil, hodinky)", "**Ano**"],
              ["QR kód na pokladně, zákazník platí hned", "**Ano**"],
              ["Poukázka, stravenka, šek, kryptoměny na místě", "**Ano**"],
              ["Platba při osobním odběru zboží z e-shopu", "**Ano**"],
              ["Platební brána e-shopu", "Ne"],
              ["Převod na základě faktury", "Ne"],
              ["QR kód na webu nebo ve faktuře zaplacený z domova", "Ne"],
            ],
          },
        },
        { p: FACTS.evidenced.prepayments },
        {
          p: "Hraniční případy (převod „hned teď“ při návštěvě, dobírka, kauce, poukazy koupené online) rozebírá návod [Kontaktní platba: co se eviduje a co ne](/navody/kontaktni-platba). QR kód pro platbu na místě vytvoříte v [nástroji QR platba](/qr-platba) – i taková platba se ale eviduje.",
        },
      ],
    },
    {
      id: "eet-off",
      heading: "EET OFF: dobrovolná výjimka pro malé paušalisty",
      blocks: [
        { p: FACTS.eetOff.summary },
        {
          table: {
            head: ["", "Hodnota"],
            rows: [
              ["Kdo může", "Fyzická osoba v 1. pásmu paušálního režimu, příjmy ze samostatné činnosti za předchozí rok do 1 mil. Kč"],
              ["Přirážka", `${formatKc(surcharge)} měsíčně (${formatKc(FACTS.eetOff.surchargeYearly)} ročně)`],
              ["Lhůta pro rok 2027", FACTS.eetOff.deadline],
              ["Platnost", "Celý kalendářní rok, v průběhu roku ji změnit nelze"],
              ["Měsíční platba v 1. pásmu (2027, předběžně)", formatKc(FACTS.pausal[2027].band1 + surcharge)],
            ],
          },
        },
        { p: FACTS.eetOff.howTo },
        {
          ul: [FACTS.eetOff.naturalOnly, FACTS.eetOff.binding, FACTS.eetOff.midYear, FACTS.eetOff.overLimit, FACTS.eetOff.exit],
        },
        {
          p: "Zda se vám EET OFF vyplatí, záleží hlavně na tom, kolik vás stojí evidence – čas, zařízení, starosti s výpadky signálu. Pokladní aplikace jsou dnes k dispozici zdarma, takže rozhodujete mezi přirážkou a vlastním pohodlím. Podrobný rozbor najdete v návodu [EET OFF: vyplatí se?](/navody/eet-off), souvislosti s paušálem v článku [EET a paušální daň](/navody/eet-a-pausalni-dan) a čísla pro vaši situaci v [kalkulačce EET OFF](/kalkulacka-eet-off).",
        },
        {
          note: "Paušální záloha pro rok 2027 je zatím předběžná – Finanční správa ji definitivně nezveřejnila. Přirážka 1 400 Kč je pevná.",
          tone: "warn",
        },
        { cta: "eet-off" },
      ],
    },
    {
      id: "co-udelat",
      heading: "Co musíte udělat: postup krok za krokem",
      blocks: [
        {
          ol: [
            "**Do konce října 2026:** zjistěte, zda evidovat musíte, a připravte si přístup do portálu MOJE daně (např. Identita občana nebo datová schránka).",
            "**Od 1. 11. 2026:** v DIS+ se přihlaste k evidenci tržeb – [postup](/navody/jak-aktivovat-dis-a-certifikat).",
            "**Hned poté:** oznamte evidenční jednotky (provozovny, stánky, vozidla, web, nebo sebe) – [jak na to](/navody/evidencni-jednotka).",
            "**Vygenerujte pokladní certifikát** v aplikaci Správa pokladních certifikátů EET a stáhněte soubor .p12.",
            "**Vyberte pokladnu** – státní MOJE eet (od 1. 12. 2026), komerční pokladnu, nebo [EvidujZdarma](/#registrace) – a nahrajte do ní certifikát a ID jednotek.",
            `**Do ${FACTS.eetOff.deadline}:** pokud splňujete podmínky, rozhodněte o EET OFF.`,
            "**V prosinci 2026:** v testovacím režimu pokladny (nebo na Playgroundu Finanční správy) vyzkoušejte, že pokladna tržby odesílá a dostává POK.",
            "**Od 1. 1. 2027:** evidujte každou kontaktní platbu – leden už je standardní evidence.",
          ],
        },
        { cta: "jednotky" },
      ],
    },
    {
      id: "evidencni-jednotky",
      heading: "Evidenční jednotky",
      blocks: [
        { p: FACTS.units.summary },
        { p: FACTS.units.allUnits },
        {
          p: "Jednotky zakládáte v DIS+ a systém každé přidělí neměnné **ID jednotky**, které pokladna posílá s každou tržbou. Pozor, nejde o IČP z živnostenského rejstříku. Několik pokladen v jedné provozovně je jedna jednotka; dvě provozovny ve dvou městech jsou dvě jednotky. Řemeslník nebo mobilní kadeřnice bez provozovny uvede jako jednotku sám sebe.",
        },
        { p: FACTS.units.change },
        {
          p: "Kolik jednotek budete potřebovat, předběžně zjistíte v [průvodci evidenčními jednotkami](/evidencni-jednotky), který vychází z provozoven zapsaných v živnostenském rejstříku. Podrobnosti v návodu [Evidenční jednotka: co to je a jak ji oznámit](/navody/evidencni-jednotka).",
        },
      ],
    },
    {
      id: "certifikat",
      heading: "DIS+ a pokladní certifikát",
      blocks: [
        { p: FACTS.certificate.summary },
        {
          p: "Certifikát získáte v Daňové informační schránce (DIS+) na portálu MOJE daně, kde se zároveň přihlásíte k evidenci tržeb a založíte jednotky. Při generování zvolíte heslo k soukromému klíči a stáhnete soubor ve formátu PKCS#12 (.p12). Ten nahrajete do pokladny. Obnovu po 366 dnech umí některé pokladny provést automaticky; jinak vygenerujete nový certifikát ručně.",
        },
        {
          p: "Soubor s certifikátem a heslo chraňte – kdo je má, může vaším jménem odesílat tržby. Krok za krokem vše popisuje návod [Jak aktivovat DIS+ a stáhnout certifikát EET](/navody/jak-aktivovat-dis-a-certifikat), který po spuštění funkcí 1. 11. 2026 doplníme o snímky obrazovek.",
        },
        {
          p: "Firmy (s. r. o., a. s.) vyřizují DIS+ prostřednictvím statutárního orgánu nebo osoby s oprávněním k daňové schránce. Pokud vám agendu vede účetní, může vám s nastavením pomoci – certifikát ale patří vám jako poplatníkovi a nikdo jiný by neměl mít soubor i heslo zároveň, pokud za vás výslovně nemá evidovat.",
        },
      ],
    },
    {
      id: "jak-probiha-evidence",
      heading: "Jak probíhá evidence jedné tržby",
      blocks: [
        {
          ol: [
            "Zákazník zaplatí – hotově, kartou nebo QR kódem.",
            "Pokladna sestaví **datovou zprávu**: vaše EIČ, ID evidenční jednotky, označení pokladny, pořadové číslo, datum a čas, celkovou částku (případně zálohu a čerpání).",
            "Zprávu podepíše vaším pokladním certifikátem a odešle Finanční správě.",
            "Finanční správa vrátí **potvrzovací kód (POK)**. Tržba je zaevidovaná.",
          ],
        },
        {
          p: "Zpráva neobsahuje sazby DPH, způsob platby ani položky. Celé odeslání trvá běžně okamžik a zákazníka nijak nezdržuje.",
        },
        {
          p: "U záloh a poukazů posílá pokladna částky zvlášť: prodej dárkového poukazu na místě odešle jako částku určenou k pozdějšímu čerpání, jeho uplatnění pak jako čerpání. Pokladna, kterou si vyberete, proto musí zálohy a poukazy umět rozlišit – ověřte si to dřív, než začnete poukazy na rok 2027 prodávat.",
        },
        { h3: "Co když vypadne internet" },
        { p: FACTS.offline.summary },
        { p: FACTS.offline.responseTimeout },
        {
          p: "Pokladna tržbu uloží, opakuje odeslání s příznakem, že nejde o první zaslání, a hlídá lhůtu. Státní aplikace MOJE eet podle zveřejněných informací potřebuje pro provoz připojení k internetu; pokladna EvidujZdarma tržby bez signálu řadí do fronty a odešle je automaticky. Podrobně v návodu [EET bez internetu: pravidlo 48 hodin](/navody/eet-bez-internetu).",
        },
      ],
    },
    {
      id: "uctenka",
      heading: "Účtenka: povinná není, doklad na žádost ano",
      blocks: [
        { p: FACTS.receipt.summary },
        {
          p: `Kvůli EET 2.0 tedy nemusíte kupovat tiskárnu ani tisknout účtenky. Pokud zákazník doklad chce, vydáte ho – papírový nebo elektronický. ${FACTS.confirmation.onReceipt} Plátci DPH se dál řídí pravidly zákona o DPH pro daňové doklady. Podle dostupných rozborů zákona odpadá i povinnost vyvěšovat informační oznámení o evidenci tržeb. Více v návodu [Musím vydávat účtenku?](/navody/musim-vydavat-uctenku)`,
        },
      ],
    },
    {
      id: "pokuty",
      heading: "Pokuty a kontroly",
      blocks: [
        { p: FACTS.penalties.summary },
        {
          p: "Částka 500 000 Kč je horní hranice pro nejzávažnější případy; konkrétní výši určuje úřad podle okolností. Na rozdíl od první EET už nelze provozovnu uzavřít ani pozastavit činnost. Pokuta za „nevydání účtenky“ podle zákona o evidenci tržeb nehrozí, protože účtenka povinná není. Nesplnění oznamovacích povinností (například u evidenčních jednotek) se podle rozborů zákona řeší obecnými sankcemi daňového řádu.",
        },
        {
          p: "Nejčastější rizika v praxi: tržba, která se při výpadku signálu do 48 hodin neodešle, propadlý certifikát, nebo nová provozovna, kterou podnikatel zapomene oznámit. Přehled najdete v návodu [Pokuty za EET 2.0](/navody/pokuty-eet).",
        },
      ],
    },
    {
      id: "pokladna",
      heading: "Jakou pokladnu zvolit",
      blocks: [
        {
          p: "Na evidenci potřebujete pokladní software s nahraným certifikátem. Na výběr máte tři hlavní cesty:",
        },
        {
          table: {
            head: ["", "MOJE eet (stát)", "EvidujZdarma", "Komerční pokladny"],
            rows: [
              ["Cena", "Zdarma", "Zdarma (evidence tržeb)", "Různě, často měsíční poplatek"],
              ["Dostupnost", "Od 1. 12. 2026, webová aplikace", "Webová aplikace", "Různé"],
              ["Evidenční jednotky", "Až 2", "3 zdarma", "Podle tarifu"],
              ["Uživatelé", "Až 2 zaměstnanci", "Až 5 uživatelů", "Podle tarifu"],
              ["Bez signálu", "Podle zveřejněných informací vyžaduje připojení", "Fronta s odesláním do 48 hodin", "Podle výrobce"],
              ["Další funkce", "Katalog zboží, PDF doklady, dvoufázové přihlášení", "Upozornění na lhůtu u neodeslaných tržeb", "Sklad, terminál, rezervace, věrnostní programy"],
            ],
            caption: "Údaje o MOJE eet podle informací Finanční správy zveřejněných v médiích k 1. 10. 2026.",
          },
        },
        {
          p: "Státní aplikace je dobrá volba pro jednoduchý provoz se stabilním připojením. Kdo prodává venku, na horách nebo na trzích, potřebuje pokladnu, která zvládne výpadky signálu. Větší provozy s terminálem a skladem často sáhnou po komerčním řešení. Nezávislé srovnání najdete na stránce [EvidujZdarma vs MOJE eet](/srovnani/moje-eet).",
        },
        { cta: "registrace" },
      ],
    },
    {
      id: "obory",
      heading: "EET 2.0 podle oborů",
      blocks: [
        { h3: "Ubytování" },
        {
          p: "Evidují se platby na recepci, neevidují se zálohy převodem ani platby přes platformy online. Otevřené otázky kolem kaucí a místního poplatku z pobytu rozebírá návod [EET u ubytování](/navody/eet-ubytovani).",
        },
        { h3: "Řemeslníci a služby u klienta" },
        {
          p: "Faktura uhrazená převodem se neeviduje, platba na místě ano. Jednotkou je podnikatel sám. Viz [EET pro řemeslníky](/navody/eet-remeslnici).",
        },
        { h3: "Kadeřnictví, kosmetika, barbershopy" },
        {
          p: "Většina plateb je kontaktních, dárkové poukazy se evidují dvakrát, pronájem křesla znamená vlastní evidenci každé OSVČ. Viz [EET pro kadeřnictví a kosmetiku](/navody/eet-kadernictvi-kosmetika).",
        },
        { h3: "Gastronomie" },
        {
          p: "Kavárny, restaurace a bistra evidují všechny platby hostů na místě včetně stravenek (poukázek). Rozvoz přes aplikace placený online se neeviduje; platba kurýrovi při převzetí může být kontaktní platbou a může vyžadovat pověření – viz [Tržba za jiného](/navody/trzba-za-jineho).",
        },
        { h3: "Stánky, trhy a jarmarky" },
        {
          p: "Stánek je mobilní provozovna. Na trzích bývá slabý signál, proto je důležitá pokladna s offline režimem – nebo, u malých paušalistů, EET OFF.",
        },
        { h3: "E-shopy" },
        {
          p: "Platby přes platební bránu se neevidují. Evidujete jen platby, které zákazník provede osobně – typicky při osobním odběru na prodejně nebo výdejním místě.",
        },
        { h3: "Spolky a neziskové organizace" },
        {
          p: "Podle Finanční správy zůstávají akce, které jsou součástí hlavní činnosti spolku (ples, slavnost, festival), mimo EET a pro drobnou vedlejší podnikatelskou činnost veřejně prospěšných poplatníků je připravena výjimka. Konkrétní limity zatím nebyly zveřejněny – spolky, které pravidelně prodávají občerstvení nebo zboží, by je měly sledovat.",
        },
      ],
    },
    {
      id: "trzba-za-jineho",
      heading: "Tržba za jiného (pověření)",
      blocks: [
        {
          p: "Zákon umožňuje, aby tržbu evidoval jiný poplatník na základě pověření – například hotel za externího maséra nebo jedna kadeřnice za druhou ve sdíleném salonu. Datová zpráva pak nese identifikaci obou. Pověřujícího to podle rozborů zákona nezbavuje odpovědnosti za evidenci jeho tržby. Často je jednodušší, když každý eviduje sám. Viz [Tržba za jiného (pověření)](/navody/trzba-za-jineho).",
        },
      ],
    },
    {
      id: "rozdily",
      heading: "Co se změnilo oproti staré EET",
      blocks: [
        {
          table: {
            head: ["", "Stará EET", "EET 2.0"],
            rows: [
              ["Účtenka", "Povinná", "Jen na žádost (zákon o ochraně spotřebitele)"],
              ["Kódy", "FIK, BKP, PKP", "POK"],
              ["Platby kartou", "Jen do roku 2018", "Ano"],
              ["Náběh", "Ve vlnách", "Všichni najednou"],
              ["Místo prodeje", "Provozovna", "Evidenční jednotka"],
              ["Vyvázání z evidence", "Ne", "EET OFF"],
              ["Uzavření provozovny", "Možné", "Ne"],
            ],
          },
        },
        {
          p: "Úplné srovnání najdete v článku [EET 2.0 vs stará EET](/navody/eet-2-0-vs-eet-1-0) a pojmy vysvětluje [Glosář EET 2.0](/navody/glosar-eet).",
        },
      ],
    },
    {
      id: "myty",
      heading: "Nejčastější mýty o EET 2.0",
      blocks: [
        {
          table: {
            head: ["Mýtus", "Skutečnost"],
            rows: [
              ["„EET se týká jen hotovosti.“", "Ne. Evidují se kontaktní platby včetně karet, QR kódů na místě, poukázek a stravenek."],
              ["„Převody na účet se taky evidují.“", "Převod na základě faktury ani platba přes platební bránu se neevidují. Rozhoduje osobní kontakt při platbě."],
              ["„Musím tisknout účtenky.“", "Ne. Účtenka v EET 2.0 povinná není; doklad vydáváte jen na žádost zákazníka."],
              ["„Neplátci DPH evidovat nemusí.“", "Musí, pokud přijímají kontaktní platby. Registrace k DPH s EET nesouvisí."],
              ["„Paušalisté mají výjimku.“", "Jen ti, kdo si v 1. pásmu s příjmy do 1 mil. Kč včas zvolí EET OFF a platí přirážku."],
              ["„Za chybu mi zavřou provozovnu.“", "Uzavření provozovny jako sankce v EET 2.0 není. Pokuta až 500 000 Kč ale hrozí."],
              ["„Potřebuji drahou pokladnu.“", "Stačí telefon nebo tablet s pokladní aplikací; existují i bezplatné aplikace včetně státní MOJE eet."],
              ["„Bez signálu nemůžu prodávat.“", "Můžete. Tržbu stačí odeslat dodatečně, nejpozději do 48 hodin."],
              ["„Leden 2027 je jen zkušební, bez povinností.“", "Ne. Zákon je účinný od 1. 1. 2027 a pilotní ani dobrovolný režim nezná. Pokladnu si vyzkoušejte v prosinci 2026."],
              ["„Příležitostné tržby do 50 000 Kč se evidovat nemusí.“", "Pevnou hranici pro příležitostné tržby schválený zákon nemá. Zná jen tržbu ojedinělou z hlediska obvykle přijímaných tržeb – a ta se posuzuje podle okolností, ne podle částky."],
              ["„Každá OSVČ dostane slevu na dani 5 000 Kč.“", "Sleva je až 5 000 Kč, jen pro OSVČ a jen za první zdaňovací období, ve kterém začnou evidovat. Podle dílčího základu daně ze samostatné činnosti může být nižší, nebo nulová."],
            ],
          },
        },
      ],
    },
    {
      id: "co-neni-jasne",
      heading: "Co zatím není jasné (stav k 1. 10. 2026)",
      blocks: [
        {
          p: "Zákon je schválený, ale řadu praktických otázek Finanční správa zatím metodicky nevysvětlila. Upozorňujeme na ně, aby vás nic nepřekvapilo:",
        },
        {
          ul: [
            `číslo zákona ve Sbírce zákonů (paragrafy uvádíme podle schváleného znění – ${FACTS.law.printNo}),`,
            "zda bude Finanční správa v lednu 2027 pokutovat – oficiálně to stanoveno není, evidovat se ale musí od 1. 1. 2027,",
            "jak zacházet s místním poplatkem z pobytu, vratnými kaucemi a spropitným,",
            "jak evidovat čerpání zálohy, která byla zaplacena převodem,",
            "převody provedené „u pokladny“ bez QR kódu a další hraniční případy kontaktní platby,",
            "konkrétní limity výjimky pro drobnou vedlejší činnost spolků,",
            "kdy je tržba ojedinělá z hlediska obvykle přijímaných tržeb – pevnou částku zákon nestanoví,",
            "definitivní výše paušální zálohy pro rok 2027.",
          ],
        },
        {
          note: "U těchto otázek doporučujeme sledovat [eet.gov.cz](https://eet.gov.cz) a poradit se s daňovým poradcem. Jakmile Finanční správa vydá metodiku, průvodce aktualizujeme a změnu zapíšeme do historie změn.",
          tone: "warn",
        },
      ],
    },
    {
      id: "vyvojari-a-ucetni",
      heading: "Pro vývojáře a účetní",
      blocks: [
        {
          p: "Technickou dokumentaci rozhraní (popis rozhraní, schéma XSD, WSDL) zveřejňuje Finanční správa na [eet.gov.cz pro vývojáře](https://eet.gov.cz/pro-vyvojare/). Komunikace probíhá přes SOAP, zprávy se podepisují pokladním certifikátem a k testování slouží prostředí EET2 Playground. Oproti staré EET se mění i názvy polí – například **eic_popl** místo dic_popl a **id_jednotky** místo id_provoz.",
        },
        {
          p: "Účetní a daňoví poradci, kteří budou klientům pomáhat s nastavením DIS+, jednotek a EET OFF, najdou informace na stránce [Pro účetní](/ucetni).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Od kdy platí EET 2.0?",
      a: `${FACTS.pilot.summary} Přípravné kroky v DIS+ jsou možné od 1. 11. 2026.`,
    },
    {
      q: "Je leden 2027 zkušební měsíc bez pokut?",
      a: `Ne. Zákon je účinný od 1. 1. 2027 (${FACTS.law.sections.effect}) a pokuta až ${formatKc(FACTS.penalties.max)} (${FACTS.law.sections.penalty}) platí od stejného dne. Finanční správa leden označuje jako pilotní měsíc s důrazem na metodickou podporu, zda bude pokutovat, ale oficiálně stanoveno není. Test si udělejte v prosinci 2026.`,
    },
    {
      q: "Musím evidovat platby kartou?",
      a: "Ano, pokud zákazník platí kartou osobně na místě. EET 2.0 eviduje kontaktní platby bez ohledu na to, zda jde o hotovost, kartu nebo QR kód.",
    },
    {
      q: "Musím vydávat účtenky?",
      a: "Ne. EET 2.0 účtenku nepřikazuje. Na žádost zákazníka ale musíte vydat doklad podle § 16 zákona o ochraně spotřebitele.",
    },
    {
      q: "Kolik stojí EET OFF a kdo ho může využít?",
      a: `Přirážka ${formatKc(surcharge)} měsíčně k paušální záloze, tedy ${formatKc(FACTS.eetOff.surchargeYearly)} ročně. Jen pro fyzické osoby v 1. pásmu paušálního režimu s příjmy ze samostatné činnosti do 1 mil. Kč; pro rok 2027 je lhůta ${FACTS.eetOff.deadline}. ${FACTS.eetOff.binding}`,
    },
    {
      q: "Jaká je pokuta za neevidování?",
      a: `Až ${formatKc(FACTS.penalties.max)} za neodeslání datové zprávy nebo závažné maření evidence. Uzavření provozovny jako sankce v EET 2.0 není.`,
    },
    {
      q: "Potřebuji speciální pokladnu?",
      a: "Ne. Stačí telefon, tablet nebo počítač s pokladní aplikací a pokladním certifikátem. Stát nabídne aplikaci MOJE eet zdarma od 1. 12. 2026; existují i další bezplatné a komerční pokladny.",
    },
    {
      q: "Co když nemám signál?",
      a: "Prodávejte dál. Tržbu je třeba odeslat bez zbytečného odkladu, nejpozději do 48 hodin od přijetí platby.",
    },
    {
      q: "Kde se k EET 2.0 přihlásím?",
      a: "V Daňové informační schránce (DIS+) na portálu MOJE daně, a to od 1. 11. 2026. Tam se přihlásíte k evidenci tržeb, oznámíte evidenční jednotky a vygenerujete pokladní certifikát.",
    },
    {
      q: "Jsem neplátce DPH. Musím evidovat?",
      a: "Ano, pokud přijímáte kontaktní platby. Povinnost evidovat nesouvisí s registrací k DPH ani s výší obratu; jedinou výjimkou navázanou na příjmy je EET OFF pro paušalisty v 1. pásmu.",
    },
    {
      q: "Platí výjimka pro příležitostné tržby do 50 000 Kč?",
      a: FACTS.whoMust.occasional,
    },
    {
      q: "Komu patří sleva na dani 5 000 Kč a kolik opravdu ušetřím?",
      a: FACTS.taxCredit.summary,
    },
    {
      q: "Musí evidovat spolky?",
      a: "Jen tržby z podnikatelské činnosti, a i tam je pro drobnou vedlejší činnost veřejně prospěšných poplatníků připravena výjimka. Akce v rámci hlavní činnosti (ples, slavnost) podle Finanční správy mimo EET zůstávají.",
    },
    {
      q: "Týká se EET 2.0 e-shopů?",
      a: "Jen u plateb přijatých osobně, například při osobním odběru. Platby přes platební bránu a převody na fakturu se neevidují.",
    },
  ],
  sources: [
    SOURCES.prezident,
    SOURCES.mfPredstavuje,
    SOURCES.fsVladaSchvalila,
    SOURCES.psp,
    SOURCES.harmonogram,
    SOURCES.kdoMusi,
    SOURCES.jakZacit,
    SOURCES.prakticke,
    SOURCES.eetOff,
    SOURCES.eetOffJak,
    SOURCES.fsFaq,
    SOURCES.pokuty,
    SOURCES.mojeEet,
    SOURCES.pausal2027,
    SOURCES.zos,
    SOURCES.danovkyKontaktni,
    SOURCES.srovnani,
    SOURCES.vyvojari,
    SOURCES.fsPlayground,
    SOURCES.podnikatelDetail,
    SOURCES.zdp,
  ],
  related: ["koho-se-eet-tyka", "kontaktni-platba", "jak-aktivovat-dis-a-certifikat"],
  published: "2026-10-01",
  updated: "2026-10-01",
  changelog: [
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: evidovat se musí od 1. 1. 2027, leden není zákonný pilotní ani dobrovolný provoz; test pokladny přesunut na prosinec 2026. Doplněno: žádná hranice 50 000 Kč pro příležitostné tržby, pravidla EET OFF během roku, oznamování všech evidenčních jednotek a podmínky slevy na dani až 5 000 Kč.",
    },
  ],
  reviewedBy: null,
};
