import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";

/**
 * S7-VIZ (28. 10. 2026): modelové příběhy prvního týdne s EET 2.0. Každé pravidlo v nich je oficiální příklad
 * MF a FS (seminář pro vývojáře, „Specifické případy“) nebo znění zákona → basis "official" (Ф15).
 */
export const prvniTydenSEet: Guide = {
  slug: "prvni-tyden-s-eet",
  category: "prakticke",
  title: "První týden s EET 2.0: pět příběhů z provozu",
  h1: "První týden s EET 2.0: kavárna, trh, penzion, obchod a salon",
  description:
    "Dýško na kartě, výpadek signálu na trhu, kauce v penzionu, med v komisi a překlep v salonu: pět modelových příběhů z prvního týdne s EET 2.0 v lednu 2027.",
  lead:
    "Pondělí **4. ledna 2027**, čtvrtý den evidence: EET 2.0 platí od **1. 1. 2027** a pro většinu podniků je to první běžný pracovní týden s ní. Na pěti modelových příbězích ukazujeme situace, které v provozu přijdou hned, a co v nich podle Finanční správy evidovat.",
  summary: [
    "Stravenka a karta v jedné platbě jsou jedna tržba; dýško zaměstnanců evidovat nemusíte.",
    "Bez signálu se prodává dál, tržba se odešle hned, jak je spojení zpět.",
    "Z kauce se eviduje jen částka, kterou si ponecháte – a jen z kauce složené na místě.",
    "Komisní prodej eviduje obchod celou částkou; storno jde s aktuálním datem.",
  ],
  sections: [
    {
      id: "kavarna",
      heading: "Kavárna: stravenka, karta a dýško",
      blocks: [
        {
          story: [
            { time: "07:30", title: "Otevíráme", text: "Pokladna je připravená od prosince: provozovna oznámená v DIS+, certifikát nahraný. Ráno se nic nenastavuje." },
            { time: "08:10", title: "Snídaně za 149 Kč: 100 Kč stravenkou, 49 Kč kartou", text: "Jedna platba dvěma způsoby = **jedna tržba 149 Kč**." },
            { time: "12:40", title: "Host připíše k platbě kartou 30 Kč dýško", text: "Dýško patří obsluze, která je zaměstnaná – evidenci nepodléhá. Pokladna ho smí evidovat spolu s platbou; v přehledu dne je zvlášť." },
            { time: "16:00", title: "Firma zaplatí převodem fakturu za catering", text: "Převod na fakturu není kontaktní platba – **neeviduje se**." },
          ],
        },
        { p: "Víc o dýšku a novém osvobození od daně v návodu [Spropitné a EET 2.0](/navody/spropitne-a-eet)." },
      ],
    },
    {
      id: "trh",
      heading: "Stánek na trhu: bez signálu",
      blocks: [
        {
          story: [
            { time: "09:00", title: "Na náměstí nejde signál", text: "Prodává se dál – přijetí platby výpadek neblokuje. Pokladna tržby ukládá." },
            { time: "11:30", title: "Signál se vrátil", text: "Uložené tržby se odešlou **hned** – bezodkladně, ne „někdy do 48 hodin“." },
            { time: "Středa", title: "Lhůta 48 hodin", text: `Nejpozději do 48 hodin od přijetí platby musí být tržba odeslána; povinnost trvá i po lhůtě. ${FACTS.penalties.summary}` },
          ],
        },
      ],
    },
    {
      id: "penzion",
      heading: "Penzion: kauce a rozbitý hrnek",
      blocks: [
        {
          story: [
            { time: "Pátek", title: "Host při příjezdu složí na recepci 2 000 Kč kauci v hotovosti", text: "Složení kauce se **neeviduje**." },
            { time: "Neděle", title: "Při odjezdu chybí rozbitý hrnek za 300 Kč", text: "Z kauce si ponecháte 300 Kč: evidujete **tržbu 300 Kč**. Zbytek 1 700 Kč vrátíte – to se neeviduje, ani stornem." },
            { time: "Neděle", title: "Jiný host poslal kauci předem převodem", text: "Když si z ní něco ponecháte, neevidujete – kauce nebyla složena kontaktně." },
          ],
        },
      ],
    },
    {
      id: "obchod",
      heading: "Obchod: med místního včelaře v komisi",
      blocks: [
        {
          story: [
            { time: "10:15", title: "Zákazník koupí sklenici medu za 250 Kč", text: "Obchod med prodává svým jménem na účet včelaře (komisní prodej) – jde o nepřímé zastoupení." },
            { time: "10:15", title: "Co se eviduje", text: "Obchod eviduje **celých 250 Kč** svým jménem a svým certifikátem, i když mu z nich patří jen provize. Včelař tento prodej neeviduje." },
          ],
        },
        { p: "Pověření a zastoupení podrobně v návodu [Tržba za jiného](/navody/trzba-za-jineho)." },
      ],
    },
    {
      id: "salon",
      heading: "Kadeřnictví: překlep v částce",
      blocks: [
        {
          story: [
            { time: "14:20", title: "Střih za 150 Kč, v pokladně omylem 1 500 Kč", text: "Zákaznice zaplatila správně 150 Kč kartou, ale odeslala se tržba 1 500 Kč." },
            { time: "14:25", title: "Oprava", text: "Buď storno −1 500 Kč a nová tržba 150 Kč, nebo jedna rozdílová tržba −1 350 Kč. Vždy s **aktuálním datem a časem** a novým identifikátorem zprávy." },
          ],
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    { q: "Platí příběhy pro mou firmu?", a: "Jsou modelové. Pravidla v nich ale pocházejí z oficiálních příkladů Ministerstva financí a Finanční správy a ze zákona č. 180/2026 Sb." },
    { q: "Musím mít pokladnu nastavenou už 1. ledna?", a: `Ano. ${FACTS.pilot.short}` },
    { q: "Je pondělí 4. ledna první den evidence?", a: "Ne. Evidovat se musí od 1. 1. 2027; pondělí 4. ledna je jen první běžný pracovní týden." },
    { q: "Co když v lednu udělám chybu?", a: "Chybnou tržbu opravíte stornem a novou tržbou, nebo jednou rozdílovou tržbou – s aktuálním datem a časem." },
  ],
  howTo: {
    name: "Jak se připravit na první týden s EET 2.0",
    description: "Co udělat do konce roku, aby první týden proběhl bez překvapení.",
    steps: [
      { name: "Oznamte provozovny a stáhněte certifikát", text: "Od 1. 11. 2026 v DIS+ na portálu MOJE daně." },
      { name: "Vyzkoušejte pokladnu v prosinci", text: "Projděte si stravenku s kartou, dýško, storno a prodej bez signálu." },
      { name: "Proškolte obsluhu", text: "Co se eviduje (karta, hotovost, QR, stravenka) a co ne (převod na fakturu, uplatnění dárkového poukazu)." },
    ],
  },
  sources: [SOURCES.seminarVyvojari, SOURCES.zakonUplne, SOURCES.harmonogram, SOURCES.prakticke],
  related: ["eet-2-0-v-prikladech", "spropitne-a-eet", "eet-bez-internetu", "storno-a-vraceni-eet"],
  published: "2026-10-28",
  updated: "2026-10-28",
  changelog: [{ date: "2026-10-28", text: "Nový návod: modelové příběhy podle příkladů Ministerstva financí a Finanční správy." }],
  reviewedBy: null,
  basis: "official",
};
