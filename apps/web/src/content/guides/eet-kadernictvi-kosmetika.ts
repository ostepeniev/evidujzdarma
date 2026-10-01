import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";

export const eetKadernictviKosmetika: Guide = {
  slug: "eet-kadernictvi-kosmetika",
  category: "obory",
  title: "EET 2.0 pro kadeřnictví, kosmetiku a barbershopy",
  h1: "EET pro kadeřnictví, kosmetiku a barbershopy",
  description:
    "Salon, pronájem křesla, mobilní kadeřnice, dárkové poukazy, spropitné: co od 1. 2. 2027 evidovat v EET 2.0 v kadeřnictví, kosmetice a barbershopu.",
  lead:
    "Kadeřnictví, kosmetika, nehtová studia a barbershopy evidují od **1. 2. 2027** každou platbu klienta na místě – hotovost, kartu i QR kód. Dárkový poukaz se eviduje při prodeji i při uplatnění. Kdo si v salonu pronajímá křeslo, eviduje své tržby sám. Malé paušalistky mohou zvolit EET OFF za **1 400 Kč** měsíčně.",
  summary: [
    "Eviduje se každá platba klienta v salonu: hotovost, karta i QR kód, služby i prodej kosmetiky.",
    "Dárkové poukazy se evidují dvakrát: při prodeji (částka k čerpání) a při uplatnění (čerpání).",
    "Pronájem křesla: každá OSVČ eviduje své tržby sama, ve své pokladně a se svým certifikátem.",
    "Mobilní kadeřnice nebo kosmetička bez salonu uvede jako evidenční jednotku sama sebe.",
    "Záloha přes online rezervační systém (platební brána) se neeviduje.",
  ],
  sections: [
    {
      id: "co-evidovat",
      heading: "Co se v salonu eviduje",
      blocks: [
        {
          p: "Salony patří k oborům, kde se EET 2.0 projeví nejvíc: většina klientů platí na místě a podle zákona se nově evidují i platby kartou a QR kódem. Evidujete služby (střih, barvení, manikúra, ošetření pleti, holení) i prodej produktů (šampony, kosmetika).",
        },
        {
          table: {
            head: ["Platba", "Evidovat?"],
            rows: [
              ["Klientka zaplatí střih hotově nebo kartou", "**Ano**"],
              ["Klient zaplatí QR kódem u pultu", "**Ano**"],
              ["Prodej šamponu nebo kosmetiky na místě", "**Ano**"],
              ["Záloha za termín zaplacená online v rezervačním systému", "Ne (vzdálená platba)"],
              ["Prodej dárkového poukazu na místě", "**Ano** (částka určená k čerpání)"],
              ["Uplatnění dárkového poukazu", "**Ano** (čerpání)"],
              ["Dárkový poukaz zakoupený online přes platební bránu", "Při prodeji ne; jak evidovat jeho uplatnění, Finanční správa zatím podrobně nepopsala"],
            ],
          },
        },
        { cta: "kviz" },
      ],
    },
    {
      id: "poukazy",
      heading: "Dárkové poukazy krok za krokem",
      blocks: [
        { p: FACTS.evidenced.prepayments },
        {
          ol: [
            "Zákazník u vás koupí poukaz na kosmetické ošetření za 1 500 Kč a zaplatí kartou → evidujete 1 500 Kč jako částku **určenou k pozdějšímu čerpání**.",
            "Obdarovaná přijde na ošetření za 1 800 Kč, uplatní poukaz a 300 Kč doplatí hotově → evidujete **čerpání** 1 500 Kč a doplatek 300 Kč.",
          ],
        },
        {
          p: "Pokladna proto musí umět poukazy rozlišit. Ověřte si to u své pokladny dřív, než začnete na Vánoce prodávat poukazy na rok 2027.",
        },
      ],
    },
    {
      id: "pronajem-kresla",
      heading: "Pronájem křesla a sdílené salony",
      blocks: [
        {
          p: "Častý model: majitelka salonu pronajímá křesla dalším kadeřnicím, které podnikají jako OSVČ. Každá z nich je samostatný poplatník – **eviduje své tržby sama**, ve své pokladně a se svým pokladním certifikátem. Evidenční jednotky oznamuje každá ve své DIS+.",
        },
        {
          p: "Pokud všichni klienti platí u jednoho pultu do jedné kasy, jsou dvě možnosti: majitelka salonu prodává služby jako své vlastní a kadeřnice jí fakturují, nebo majitelka eviduje tržby kadeřnic **v pověření**. Druhá varianta vyžaduje dohodu a pokladnu, která evidenci za jiného podporuje – viz [Tržba za jiného (pověření)](/navody/trzba-za-jineho).",
        },
        {
          note: "Nejjednodušší a nejpřehlednější je, když má každá OSVČ vlastní pokladnu v mobilu a klienti jí platí přímo. Pak nikdo neodpovídá za tržby někoho jiného.",
        },
      ],
    },
    {
      id: "mobilni",
      heading: "Mobilní kadeřnice a kosmetičky",
      blocks: [
        {
          p: "Kdo jezdí za klientkami domů, do domovů seniorů nebo na svatby, nemá provozovnu. V DIS+ uvede jako evidenční jednotku **sama sebe** a eviduje platby přijaté u klientek. U klientek bez signálu platí lhůta 48 hodin na dodatečné odeslání – viz [EET bez internetu](/navody/eet-bez-internetu).",
        },
      ],
    },
    {
      id: "spropitne",
      heading: "Spropitné",
      blocks: [
        {
          p: "Výslovné stanovisko Finanční správy ke spropitnému v EET 2.0 jsme k 1. 10. 2026 nenašli. Prakticky: když klient zaplatí kartou částku včetně spropitného, terminál i pokladna pracují s celkovou částkou, kterou salon přijal. Spropitné dané přímo do ruky kadeřnici je jiná situace. Jak spropitné správně zdanit a evidovat, doporučujeme probrat s daňovým poradcem.",
        },
      ],
    },
    {
      id: "eet-off-a-pokladna",
      heading: "EET OFF, nebo pokladna?",
      blocks: [
        {
          p: `Kadeřnice nebo kosmetička v 1. pásmu paušálního režimu s příjmy do 1 mil. Kč může místo evidence platit přirážku ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně (${formatKc(FACTS.eetOff.surchargeMonthly * 12)} ročně). Rozhodnout se musí do ${FACTS.eetOff.deadline}. Spočítejte si to v [kalkulačce EET OFF](/kalkulacka-eet-off).`,
        },
        {
          p: "Pokud budete evidovat, vyberte si pokladnu podle velikosti salonu:",
        },
        {
          ul: [
            "Státní **MOJE eet** je zdarma, podle zveřejněných informací pro až 2 evidenční jednotky a 2 zaměstnance; potřebuje připojení k internetu.",
            "**EvidujZdarma** je zdarma pro 3 jednotky a až 5 uživatelů a funguje i bez signálu.",
            "Placené pokladny nabízejí rezervace, věrnostní programy nebo skladové hospodářství.",
          ],
        },
        {
          p: "Srovnání najdete na stránce [EvidujZdarma vs MOJE eet](/srovnani/moje-eet).",
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    {
      q: "Pronajímám si křeslo v salonu. Kdo eviduje moje tržby?",
      a: "Vy. Jako OSVČ jste samostatný poplatník a evidujete své tržby ve vlastní pokladně a s vlastním certifikátem. Výjimkou je, pokud se s majitelkou salonu dohodnete na pověření nebo pokud služby prodává ona jako své.",
    },
    {
      q: "Jak se evidují dárkové poukazy?",
      a: "Dvakrát: při prodeji jako částka určená k pozdějšímu čerpání a při uplatnění jako čerpání. Případný doplatek evidujete normálně.",
    },
    {
      q: "Klientka zaplatila zálohu přes rezervační systém. Eviduje se?",
      a: "Pokud zaplatila online přes platební bránu, ne – jde o vzdálenou platbu. Evidujete platbu, kterou přijmete na místě.",
    },
    {
      q: "Jezdím za klientkami domů. Co je moje evidenční jednotka?",
      a: "Vy sama. Podnikatel bez provozovny uvede v DIS+ jako evidenční jednotku sebe.",
    },
    {
      q: "Musím klientce dávat účtenku?",
      a: "Ne automaticky. EET 2.0 účtenku nepřikazuje; na žádost klientky ale musíte vydat doklad podle zákona o ochraně spotřebitele. Více v návodu [Musím vydávat účtenku?](/navody/musim-vydavat-uctenku)",
    },
  ],
  sources: [SOURCES.mfPredstavuje, SOURCES.kdoMusi, SOURCES.jakZacit, SOURCES.eetOff, SOURCES.mojeEet, SOURCES.podnikatelDetail],
  related: ["trzba-za-jineho", "eet-off", "musim-vydavat-uctenku"],
  published: "2026-10-01",
  updated: "2026-10-01",
  reviewedBy: null,
};
