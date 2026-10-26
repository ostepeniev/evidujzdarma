import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";

/**
 * S5-SLUŽBY (26. 10. 2026): kdo s čím u EET 2.0 pomůže – co musí udělat podnikatel sám, co dodavatel pokladny a co
 * účetní nebo daňový poradce (zákon č. 523/1992 Sb.). Koncept – noindex do odborné revize (Ф9).
 */
export const kdoPomuzeSEet: Guide = {
  slug: "kdo-pomuze-s-eet",
  category: "prakticke",
  title: "Kdo vám pomůže s EET: účetní, poradce, nebo pokladna?",
  h1: "Kdo vám pomůže s EET 2.0 – a s čím",
  description:
    "Co u EET 2.0 uděláte jen vy, s čím pomůže dodavatel pokladny a kdy potřebujete účetní nebo daňového poradce. Včetně toho, proč certifikát nikomu neposílat.",
  lead:
    "Evidovat tržby musíte od **1. 1. 2027** a odpovědnost za evidenci nesete vy jako podnikatel. Přihlášení do DIS+ a pokladní certifikát zůstávají ve vašich rukou, s technikou pomůže dodavatel pokladny. Daňová rozhodnutí, například zda zvolit EET OFF, patří účetní nebo daňovému poradci.",
  summary: [
    "Do DIS+ se přihlašujete sami a soubor certifikátu s heslem nikomu neposíláte.",
    "Dodavatel pokladny pomůže s technikou: nahrání certifikátu, evidenční jednotky, zkušební tržba.",
    "Za úplatu radit ve věcech daní smí soustavně jen daňový poradce, advokát nebo auditor (zákon č. 523/1992 Sb.).",
    "Rozhodnutí EET ON, nebo OFF, a přihlášení k přirážce proberte s účetní nebo daňovým poradcem.",
  ],
  sections: [
    {
      id: "co-udelate-sami",
      heading: "Co uděláte jen vy",
      blocks: [
        {
          ul: [
            "**Přihlášení do DIS+** – na portálu MOJE daně se přihlašujete svou identitou (například přes Identitu občana). Přihlašovací údaje nikomu nedávejte.",
            `**Pokladní certifikát** – ${FACTS.certificate.summary} Soubor .p12 a jeho heslo nikomu neposílejte e-mailem: kdo je má, může vaším jménem odesílat tržby.`,
            `**Odpovědnost za evidenci** – povinnost evidovat máte vy. ${FACTS.penalties.summary}`,
          ],
        },
        {
          p: "Postup v DIS+ krok za krokem najdete v návodu [Jak aktivovat DIS+ a certifikát](/navody/jak-aktivovat-dis-a-certifikat).",
        },
      ],
    },
    {
      id: "dodavatel-pokladny",
      heading: "S čím pomůže dodavatel pokladny",
      blocks: [
        {
          p: "Dodavatel pokladny vám pomůže s technickou stránkou: jak nahrát certifikát do pokladny, kam zadat ID evidenčních jednotek, jak funguje odeslání bez signálu a jak udělat zkušební tržbu. Nejde o daňové poradenství – jde o nastavení zařízení a aplikace.",
        },
        {
          p: "Pokud chcete mít nastavení písemně a bez telefonování, nabízíme [Nastavení EET na klíč](/nastaveni-na-klic): postup na míru pro DIS+ a certifikát, kontrolu a přípravu nastavení pokladny EvidujZdarma.",
        },
      ],
    },
    {
      id: "ucetni-a-poradce",
      heading: "S čím pomůže účetní a daňový poradce",
      blocks: [
        {
          p: "Daňovým poradenstvím je pomoc a rada ve věcech daní. Soustavně a za úplatu ho smí poskytovat jen daňový poradce zapsaný v seznamu daňových poradců; zákon nemění oprávnění advokátů a auditorů. Mnoho účetních je zároveň daňovými poradci – zeptejte se své.",
        },
        {
          ul: [
            `**EET ON, nebo OFF.** Zda se vám vyplatí přirážka, si orientačně spočítáte v [kalkulačce EET OFF](/kalkulacka-eet-off); rozhodnutí proberte s účetní nebo poradcem. Lhůta: ${FACTS.eetOff.deadline}.`,
            "**Přihlášení k přirážce a paušální režim.** Oznámení podáváte správci daně vy, nebo za vás zmocněná osoba.",
            "**Sleva na dani za EET.** Kdo na ni má nárok a v jaké výši, závisí na vašem daňovém přiznání – viz [Sleva na dani za EET](/navody/sleva-na-dani-za-eet).",
          ],
        },
      ],
    },
    {
      id: "povereni",
      heading: "Pověření: když tržbu eviduje někdo za vás",
      blocks: [
        {
          p: "Zákon zná i pověření (§ 10): tržbu, která patří vám, eviduje jiný podnikatel – typicky hotel, který na recepci inkasuje za externího maséra. To není pomoc s nastavením: pověřený za evidenci v rozsahu pověření odpovídá a vás to odpovědnosti úplně nezbavuje. Podrobně v návodu [Tržba za jiného](/navody/trzba-za-jineho), vzor najdete na stránce [Vzor pověření](/vzor-povereni).",
        },
      ],
    },
    {
      id: "pomoc-zdarma",
      heading: "Kde najít pomoc zdarma",
      blocks: [
        {
          ul: [
            "Finanční správa: web [eet.gov.cz](https://eet.gov.cz) a nejčastější otázky k EET 2.0.",
            "Naše [návody k EET 2.0](/navody), [checklist](/checklist-eet) a [kalkulačka EET OFF](/kalkulacka-eet-off).",
            "Váš finanční úřad – dotazy k vaší konkrétní situaci.",
          ],
        },
        { cta: "kontrola-ico" },
      ],
    },
  ],
  faq: [
    {
      q: "Smím poslat certifikát dodavateli pokladny, aby mi ho nahrál?",
      a: "Raději ne. Kdo má soubor certifikátu a heslo, může vaším jménem odesílat tržby. Certifikát nahrajte do pokladny sami podle návodu dodavatele.",
    },
    {
      q: "Může za mě přihlášení k EET OFF podat účetní?",
      a: "Oznámení může za vás podat zmocněná osoba. Pokud za to platíte, měl by to dělat daňový poradce (případně advokát) – jen ti smí soustavně a za úplatu pomáhat ve věcech daní.",
    },
    {
      q: "Kdo zaplatí pokutu, když evidence selže?",
      a: `Povinnost evidovat máte vy jako podnikatel. ${FACTS.penalties.summary} Případnou škodu způsobenou dodavatelem řešíte s ním podle smlouvy.`,
    },
    {
      q: "Je Nastavení EET na klíč daňové poradenství?",
      a: "Ne. Je to technická pomoc s DIS+, certifikátem a pokladnou. Zda evidovat, nebo zvolit EET OFF, neradíme – to patří účetní nebo daňovému poradci.",
    },
  ],
  howTo: {
    name: "Jak si rozdělit práci s EET 2.0",
    description: "Kdo udělá který krok: rozhodnutí o EET OFF, DIS+ a certifikát, nastavení pokladny.",
    steps: [
      { name: "Rozhodněte, zda evidovat", text: `Spočítejte si EET ON a OFF v kalkulačce a rozhodnutí proberte s účetní nebo daňovým poradcem; lhůta pro EET OFF je ${FACTS.eetOff.deadline}.` },
      { name: "Přihlaste se v DIS+", text: "Od 1. 11. 2026 se sami přihlaste k evidenci, založte evidenční jednotky a vygenerujte pokladní certifikát." },
      { name: "Nastavte pokladnu", text: "Certifikát nahrajte do pokladny sami; s nastavením jednotek a zkušební tržbou pomůže dodavatel pokladny." },
    ],
  },
  sources: [SOURCES.zakonDanPoradenstvi, SOURCES.jakZacit, SOURCES.caeetPostupy, SOURCES.pokuty, SOURCES.eetOffJak, SOURCES.zakonUplne],
  related: ["jak-aktivovat-dis-a-certifikat", "eet-off", "trzba-za-jineho", "pokuty-eet"],
  published: "2026-10-26",
  updated: "2026-10-26",
  changelog: [{ date: "2026-10-26", text: "Nový návod – čeká na odbornou revizi." }],
  reviewedBy: null,
};
