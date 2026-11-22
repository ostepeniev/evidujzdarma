import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";

/**
 * S12 (22. 11. 2026): doplňkový prodej (šampon u kadeřnice, krém v kosmetice, nápoj a kredit ve fitku). Jen obecná
 * pravidla, která už web má ze zdrojů FS: eviduje se každá kontaktní platba (kdoMusi), výjimky jen pro danou činnost
 * (FACTS.whoMust.exemptions), kredit ve fitcentru podle dotazu veřejnosti FS č. 5525, automaty odkazem na metodiku FS.
 * Vlastní daňový výklad ne. Nový návod → koncept, noindex a mimo strojové kanály do odborné revize (Ф8, Ф9).
 */
export const doplnkovyProdejEet: Guide = {
  slug: "doplnkovy-prodej-eet",
  category: "obory",
  title: "Doplňkový prodej a EET 2.0: kosmetika, fitness, salony",
  h1: "Doplňkový prodej v EET 2.0: šampon u kadeřnice, krém v kosmetice, nápoj ve fitku",
  description:
    "Prodáváte ke službě i zboží – šampon, krém, proteinovou tyčinku? Od 1. 1. 2027 je to evidovaná tržba, pokud zákazník platí na místě. Co to znamená v praxi.",
  lead:
    "Od **1. 1. 2027** se eviduje každá kontaktní platba, ať zákazník platí za službu, nebo za zboží, které k ní přikoupí. Šampon u kadeřnice, krém v kosmetickém salonu i tyčinka ve fitku jsou tedy běžnou evidovanou tržbou. Nic se nemění na tom, že výjimka platí jen pro konkrétní činnost.",
  summary: [
    "Rozhoduje způsob platby, ne to, co prodáváte: platba na místě se eviduje.",
    "Doplňkový prodej nemá v zákoně vlastní výjimku; výjimka se týká jen dané činnosti.",
    "Služba i zboží zaplacené najednou jsou jedna platba – jedna tržba.",
    "Kredit nebo čip ve fitku: eviduje se nabití i čerpání.",
  ],
  sections: [
    {
      id: "pravidlo",
      heading: "Platí stejné pravidlo jako pro hlavní službu",
      blocks: [
        { p: `${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}` },
        {
          p: `Zákon nerozlišuje „hlavní“ a „doplňkový“ prodej. ${FACTS.whoMust.exemptions}`,
        },
        {
          conditions: [
            { title: "Platí zákazník na místě?", text: "Hotově, kartou nebo QR kódem u vás – jde o kontaktní platbu." },
            { title: "Je to příjem z podnikání?", text: "Prodej zboží v salonu nebo ve fitku je příjmem podnikatele." },
            { title: "Nespadá činnost pod výjimku?", text: "Výjimky § 11–13 zákona jsou úzké a týkají se jen konkrétní činnosti." },
          ],
        },
        { p: "Platí-li všechny tři podmínky najednou, platbu evidujete." },
      ],
    },
    {
      id: "obory",
      heading: "Příklady z praxe",
      blocks: [
        {
          table: {
            head: ["Situace", "Eviduje se?"],
            rows: [
              ["Kadeřnice: střih 650 Kč a šampon 290 Kč, klient platí kartou najednou", "**Ano** – jedna platba 940 Kč"],
              ["Kosmetika: klientka si po ošetření koupí krém a zaplatí hotově", "**Ano**"],
              ["Fitness: vstup a proteinová tyčinka zaplacené na recepci QR kódem", "**Ano**"],
              ["Fitness: nabití čipu na 1 000 Kč a nápoj za 50 Kč", "**Ano** – 1 050 Kč, z toho 1 000 Kč určeno k čerpání"],
              ["Kosmetika: krém objednaný a zaplacený přes platební bránu e-shopu", "**Ne** – vzdálená platba"],
            ],
            caption: "Obecná pravidla podle eet.gov.cz a dotazu veřejnosti Finanční správy (22. 10. 2026). Stav k 22. 11. 2026.",
          },
        },
        {
          p: "Pokladna odesílá Finanční správě údaje o platbě – celkovou částku tržby, případně částku kreditu určenou k čerpání. Jednotlivé položky jako „šampon“ nebo „tyčinka“ datová zpráva neobsahuje; přehled o tom, co jste prodali, si vedete pro sebe a pro účetní.",
        },
      ],
    },
    {
      id: "fitness",
      heading: "Fitness: kredit, čip a automat",
      blocks: [
        {
          p: "U kreditu nebo čipu, který lze čerpat jen ve vašem fitcentru, se evidují obě operace: nabití i čerpání, pokud proběhnou kontaktně. Podrobnosti a příklad Finanční správy najdete v návodu [Poukazy a dárkové vouchery v EET 2.0](/navody/poukazy-a-vouchery-eet).",
        },
        {
          note: "Prodáváte nápoje nebo tyčinky v automatu? Zda se na tržby z automatu vztahuje výjimka, vysvětluje metodická informace Finanční správy k prodejním automatům a samoobslužným zařízením (§ 13 odst. 2–4 zákona). Posuďte svůj případ podle ní, případně s daňovým poradcem.",
          tone: "info",
        },
      ],
    },
    {
      id: "kreslo",
      heading: "Pronajaté křeslo a prodej za jiného",
      blocks: [
        {
          p: "Prodává-li kadeřnice v pronajatém křesle zboží na svůj účet, eviduje ho sama ve své pokladně – stejně jako své služby. Pokud prodáváte zboží jiného podnikatele, podívejte se do návodu [Tržba za jiného](/navody/trzba-za-jineho). Více o salonech v návodu [EET pro kadeřnictví a kosmetiku](/navody/eet-kadernictvi-kosmetika).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Musím evidovat šampon, který klientovi prodám ke střihu?",
      a: "Ano, pokud ho klient zaplatí na místě – hotově, kartou nebo QR kódem. Doplňkový prodej nemá vlastní výjimku.",
    },
    {
      q: "Musí datová zpráva obsahovat, že šlo o šampon?",
      a: "Ne. Pokladna posílá údaje o platbě – celkovou částku tržby. Seznam zboží v ní není.",
    },
    {
      q: "Klient zaplatí střih i krém jednou kartou. Jsou to dvě tržby?",
      a: "Ne, jedna platba je jedna tržba s celkovou částkou za službu i zboží.",
    },
    {
      q: "Eviduje se nabití čipu ve fitku?",
      a: "Ano. U kreditu čerpaného jen u vás se eviduje nabití i pozdější čerpání, pokud proběhnou kontaktně.",
    },
    {
      q: "Eviduje se zboží, které zákazník koupí na e-shopu salonu?",
      a: `Jen pokud ho zákazník zaplatí u vás osobně. ${FACTS.evidenced.notEvidenced}`,
    },
  ],
  howTo: {
    name: "Jak evidovat doplňkový prodej od 1. 1. 2027",
    description: "Tři kroky podle obecných pravidel EET 2.0.",
    steps: [
      { name: "Zjistěte, jak zákazník platí", text: "Platba na místě (hotově, kartou, QR kódem) se eviduje, platba přes platební bránu e-shopu ne." },
      { name: "Účtujte službu i zboží najednou", text: "Jedna platba je jedna tržba – zboží přidejte na stejný doklad jako službu." },
      { name: "Veďte si přehled o zboží", text: "Datová zpráva položky neobsahuje; přehled o zboží potřebujete pro sebe a pro účetní." },
    ],
  },
  sources: [SOURCES.kdoMusi, SOURCES.fsDotazPoukazy, SOURCES.seminarVyvojari, SOURCES.eetAutomaty, SOURCES.zakonUplne, SOURCES.dokumenty],
  related: ["eet-kadernictvi-kosmetika", "kontaktni-platba", "eet-2-0-v-prikladech", "trzba-za-jineho"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [{ date: "2026-11-22", text: "Nový návod – čeká na odbornou revizi." }],
  reviewedBy: null,
};
