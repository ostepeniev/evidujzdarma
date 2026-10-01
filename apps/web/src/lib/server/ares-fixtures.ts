/**
 * Vymyšlené testovací subjekty pro vývoj bez přístupu k ARES (ARES_MOCK=1).
 * IČO mají platnou kontrolní číslici, ale NEJDE o skutečné firmy.
 */
export const ARES_FIXTURES: Record<string, { subject: unknown; rzp?: unknown }> = {
  "12345679": {
    subject: {
      ico: "12345679",
      obchodniJmeno: "Jana Testovací",
      pravniForma: "101",
      datumVzniku: "2015-03-01",
      datumAktualizace: "2026-09-20",
      sidlo: { nazevObce: "Karlovy Vary", kodObce: 554961, kodKraje: 51, nazevKraje: "Karlovarský kraj", psc: 36001, textovaAdresa: "Karlovy Vary" },
      czNace: ["9602"],
      seznamRegistraci: { stavZdrojeRzp: "AKTIVNI", stavZdrojeRes: "AKTIVNI" },
    },
    rzp: {
      zaznamy: [
        {
          primarniZaznam: true,
          zivnosti: [
            {
              predmetPodnikani: "Holičství, kadeřnictví",
              druhZivnosti: "R",
              datumVzniku: "2015-03-01",
              provozovny: [
                {
                  identifikacniCisloProvozovny: "1001234567",
                  sidloProvozovny: { nazevObce: "Karlovy Vary", nazevUlice: "Zahradní", cisloDomovni: 12, psc: 36001, kodKraje: 51 },
                  datumZahajeniCinnosti: "2015-03-01",
                },
              ],
            },
          ],
        },
      ],
    },
  },
  "11111119": {
    subject: {
      ico: "11111119",
      obchodniJmeno: "Testovací Penzion s.r.o.",
      pravniForma: "112",
      dic: "CZ11111119",
      datumVzniku: "2008-06-10",
      datumAktualizace: "2026-08-02",
      sidlo: {
        nazevObce: "Mariánské Lázně",
        kodKraje: 51,
        nazevKraje: "Karlovarský kraj",
        nazevUlice: "Hlavní",
        cisloDomovni: 101,
        psc: 35301,
        textovaAdresa: "Hlavní 101, 35301 Mariánské Lázně",
      },
      czNace: ["551", "561"],
      seznamRegistraci: { stavZdrojeVr: "AKTIVNI", stavZdrojeRzp: "AKTIVNI", stavZdrojeDph: "AKTIVNI" },
    },
    rzp: {
      zaznamy: [
        {
          primarniZaznam: true,
          zivnosti: [
            {
              predmetPodnikani: "Hostinská činnost",
              provozovny: [
                { identifikacniCisloProvozovny: "1009876543", sidloProvozovny: { nazevObce: "Mariánské Lázně", nazevUlice: "Hlavní", cisloDomovni: 101, kodKraje: 51 } },
              ],
            },
            {
              predmetPodnikani: "Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona",
              oboryCinnosti: [{ nazev: "Ubytovací služby" }],
              provozovny: [{ identifikacniCisloProvozovny: "1009876543" }],
            },
          ],
        },
      ],
    },
  },
  "22222227": {
    subject: {
      ico: "22222227",
      obchodniJmeno: "Testovací Software a.s.",
      pravniForma: "121",
      dic: "CZ22222227",
      datumVzniku: "2003-08-06",
      sidlo: { nazevObce: "Praha", kodKraje: 19, nazevKraje: "Hlavní město Praha", psc: 14000, textovaAdresa: "Praha 4" },
      czNace: ["620", "6201", "631"],
      seznamRegistraci: { stavZdrojeVr: "AKTIVNI", stavZdrojeDph: "AKTIVNI" },
    },
  },
};
