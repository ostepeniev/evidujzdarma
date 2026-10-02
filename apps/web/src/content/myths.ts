/**
 * „Co se o EET 2.0 píše špatně“ — rozpory mezi tím, co koluje v médiích a na webech,
 * a schváleným zněním zákona / oficiálními informacemi Finanční správy.
 *
 * Každá položka odděluje tři věci: tvrzení (co se píše – parafráze, ne citace cizích textů),
 * shrnutí zdrojů (co říká zákon / FS) a náš komentář (názor, vždy označený).
 * Fakta se berou z facts.ts, aby se při změně opravila všude.
 */
import { FACTS, SOURCES, type Source } from "./facts";

export interface Myth {
  id: string;
  /** Otázka, jak ji lidé hledají (pro FAQ schema a nadpis kotvy) */
  question: string;
  /** Co se píše (parafráze) */
  claim: string;
  /** Kde se to objevuje – obecně, bez jmenování konkrétních autorů */
  seenIn: string;
  /** Co platí podle zdrojů */
  truth: string;
  /** Náš komentář – názor, ne fakt */
  comment?: string;
  /** Co udělat teď */
  action: { text: string; href: string; label: string };
  sources: readonly Source[];
  /** Stav k (ISO) */
  asOf: string;
}

export const MYTHS_UPDATED = "2026-10-01";

export const MYTHS: readonly Myth[] = [
  {
    id: "prilezitostne-trzby-50-000",
    question: "Platí výjimka pro příležitostné tržby do 50 000 Kč?",
    claim: "Kdo má jen příležitostné tržby do 50 000 Kč ročně, evidovat nemusí.",
    seenIn: "Tisková zpráva MF z 18. 2. 2026 a články, které z ní vycházely.",
    truth: FACTS.whoMust.occasional,
    comment:
      "Částku 50 000 Kč bychom nebrali jako jistotu. Kdo přijímá platby osobně opakovaně, i když jen občas, měl by počítat s evidencí – nebo zvážit EET OFF.",
    action: { text: "Projděte si, zda se vás evidence týká.", href: "/musim-evidovat", label: "Kvíz: Musím evidovat?" },
    sources: [SOURCES.psp, SOURCES.mfPredstavuje],
    asOf: "2026-09-29",
  },
  {
    id: "leden-bez-pokut",
    question: "Platí povinnost evidovat už pro leden 2027, nebo až od února?",
    claim: "V lednu 2027 se ještě evidovat nemusí, naostro se začne až v únoru a do té doby nic nehrozí.",
    seenIn: "Rané materiály MF a řada komerčních webů.",
    truth: FACTS.pilot.summary,
    comment:
      "Spoléhat na shovívavost úřadu je zbytečné riziko. Pokladnu a certifikát mějte hotové do Vánoc a od 1. 1. evidujte.",
    action: { text: "Připravte si DIS+ a certifikát od 1. 11. 2026.", href: "/navody/jak-aktivovat-dis-a-certifikat", label: "Návod: DIS+ a certifikát" },
    sources: [SOURCES.harmonogram, SOURCES.psp, SOURCES.podnikatelPilot],
    asOf: "2026-09-29",
  },
  {
    id: "sleva-na-dani-5000",
    question: "Komu patří sleva na dani 5 000 Kč a kolik opravdu ušetřím?",
    claim: "Každý, kdo začne evidovat, dostane zpět 5 000 Kč na dani.",
    seenIn: "Srovnání s první EET v médiích.",
    truth: FACTS.taxCredit.summary,
    comment: "Právnické osoby slevu nemají. Pokladna u nás je zdarma, takže sleva není podmínkou, aby se evidence vyplatila.",
    action: { text: "Jak EET souvisí s paušální daní.", href: "/navody/eet-a-pausalni-dan", label: "Návod: EET a paušální daň" },
    sources: [SOURCES.zdp, SOURCES.podnikatelDetail],
    asOf: "2026-09-29",
  },
  {
    id: "karty-se-neeviduji",
    question: "Evidují se v EET 2.0 i platby kartou?",
    claim: "Senát platby kartou z evidence vyškrtl, evidovat se bude jen hotovost.",
    seenIn: "Zprávy z doby projednávání v Senátu.",
    truth:
      "Senát zákon vrátil s pozměňovacími návrhy a mimo jiné chtěl bezhotovostní platby vyjmout. Sněmovna ho 9. 9. 2026 přehlasovala a schválila původní znění. Evidují se proto i platby kartou a QR kódem přijaté při osobním kontaktu.",
    action: { text: "Co přesně je kontaktní platba.", href: "/navody/kontaktni-platba", label: "Návod: Kontaktní platba" },
    sources: [SOURCES.mfSnemovnaPrehlasovala, SOURCES.finmagSchvalena],
    asOf: "2026-09-17",
  },
  {
    id: "pok-na-uctence",
    question: "Musím mít na účtence potvrzovací kód (POK)?",
    claim: "Na každé účtence musí být kód od Finanční správy, jako dřív FIK.",
    seenIn: "Návody, které vycházejí z první EET.",
    truth: `${FACTS.confirmation.onReceipt} ${FACTS.receipt.summary}`,
    comment:
      "Zákazník z dokladu bez POK nepozná, zda evidujete, nebo jste v EET OFF – a poznat to nemusí. Pokud chcete, aby bylo vidět, že tržba prošla, POK na doklad tisknout můžete. V naší pokladně si v nastavení vyberete, zda ho na účtenku tisknout.",
    action: { text: "Co musí být na dokladu podle zákona o ochraně spotřebitele.", href: "/navody/musim-vydavat-uctenku", label: "Návod: Musím vydávat účtenku?" },
    sources: [SOURCES.prakticke, SOURCES.zos],
    asOf: "2026-10-01",
  },
  {
    id: "rest-api-klic",
    question: "Funguje EET 2.0 přes REST API a API klíč?",
    claim: "Nová EET komunikuje přes REST/JSON a místo certifikátu stačí API klíč.",
    seenIn: "Některé komerční blogy o pokladnách.",
    truth:
      "Finanční správa zveřejnila rozhraní SOAP (verze v4) se schématem XSD a WSDL. Každá zpráva se podepisuje pokladním certifikátem (WS-Security, RSA-SHA256). Certifikát si zdarma vygenerujete v DIS+.",
    comment: "Pro podnikatele je to detail – důležité je, že bez certifikátu z DIS+ evidovat nejde. Naše pokladna podpis řeší sama, certifikát jen nahrajete.",
    action: { text: "Jak získat pokladní certifikát.", href: "/navody/jak-aktivovat-dis-a-certifikat", label: "Návod: DIS+ a certifikát" },
    sources: [SOURCES.dokumenty, SOURCES.vyvojari],
    asOf: "2026-10-01",
  },
  {
    id: "offline-5-dni",
    question: "Jak dlouho můžu tržby doposlat, když nemám signál?",
    claim: "Bez internetu lze tržby doposlat až do 5 dnů.",
    seenIn: "Některé komerční weby.",
    truth: `${FACTS.offline.summary} ${FACTS.offline.responseTimeout}`,
    action: { text: "Jak evidovat bez signálu.", href: "/navody/eet-bez-internetu", label: "Návod: EET bez internetu" },
    sources: [SOURCES.prakticke, SOURCES.fsFaq],
    asOf: "2026-10-01",
  },
  {
    id: "obrat-2-miliony",
    question: "Týká se EET jen podnikatelů s obratem nad 2 miliony?",
    claim: "Evidovat musí jen podnikatelé s obratem nad 2 mil. Kč.",
    seenIn: "Některé komerční weby.",
    truth: `Hranice obratu v zákoně není. ${FACTS.whoMust.summary} Vyvázat se lze jen přes EET OFF: ${FACTS.eetOff.summary}`,
    action: { text: "Zjistěte za 10 vteřin, jak je na tom vaše firma.", href: "/kontrola-ico", label: "Kontrola podle IČO" },
    sources: [SOURCES.kdoMusi, SOURCES.eetOff],
    asOf: "2026-10-01",
  },
  {
    id: "eet-off-kdykoli",
    question: "Můžu se k EET OFF přihlásit nebo ho změnit kdykoli během roku?",
    claim: "K EET OFF se lze přihlásit, nebo z něj odejít, kdykoli během roku.",
    seenIn: "Diskuse a starší články.",
    truth: `${FACTS.eetOff.howTo} ${FACTS.eetOff.binding} ${FACTS.eetOff.midYear} ${FACTS.eetOff.exit}`,
    action: { text: "Spočítejte, zda se vám přirážka vyplatí.", href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF" },
    sources: [SOURCES.eetOffJak, SOURCES.eetOff],
    asOf: "2026-10-01",
  },
  {
    id: "zavreni-provozovny",
    question: "Mohou mi kvůli EET zavřít provozovnu?",
    claim: "Kdo neeviduje, riskuje uzavření provozovny jako za první EET.",
    seenIn: "Články, které vycházejí z první EET.",
    truth: FACTS.penalties.summary,
    action: { text: "Jaké sankce hrozí a jak se jim vyhnout.", href: "/navody/pokuty-eet", label: "Návod: Pokuty EET" },
    sources: [SOURCES.pokuty, SOURCES.psp],
    asOf: "2026-09-29",
  },
  {
    id: "certifikovana-pokladna",
    question: "Potřebuji pro EET 2.0 certifikovanou pokladnu nebo fiskální tiskárnu?",
    claim: "Pro EET 2.0 je potřeba nová certifikovaná pokladna nebo fiskální tiskárna.",
    seenIn: "Nabídky prodejců pokladen.",
    truth:
      "Stát pokladní software neschvaluje ani necertifikuje a fiskální tiskárnu nevyžaduje. Stačí jakékoli zařízení – telefon, tablet, počítač – se softwarem, který tržbu podepíše certifikátem a odešle. Účtenku zákon o evidenci tržeb nevyžaduje.",
    action: { text: "Pokladna v mobilu zdarma, funguje i bez signálu.", href: "/#registrace", label: "Chci pokladnu zdarma" },
    sources: [SOURCES.prakticke, SOURCES.vyvojari],
    asOf: "2026-10-01",
  },
];
