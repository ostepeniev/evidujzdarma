import { FACTS, SOURCES, timelineAt } from "../facts";
import type { Guide } from "./types";

const DIS = timelineAt("2026-11-01");
const MOJE_EET = timelineAt("2026-12-01");

export const pokladnaVMobiluZdarma: Guide = {
  slug: "pokladna-v-mobilu-zdarma",
  category: "prakticke",
  title: "Pokladna v mobilu zdarma pro EET 2.0: co musí umět",
  h1: "Pokladna v mobilu zdarma pro EET 2.0: co musí umět a jak začít",
  description:
    "Co musí od 1. 1. 2027 umět pokladna v mobilu pro EET 2.0, co nabízí státní aplikace MOJE eet, na co se ptát u jiných pokladen a jak začít krok za krokem.",
  lead:
    "Od **1. 1. 2027** vám pro EET 2.0 stačí mobil, tablet nebo počítač s pokladní aplikací – i státní MOJE eet je webová aplikace. Pokladna musí o každé kontaktní platbě odeslat Finanční správě datovou zprávu podepsanou vaším pokladním certifikátem a při výpadku signálu ji doposlat nejpozději do 48 hodin.",
  summary: [
    "Zvláštní pokladní zařízení není potřeba – stačí aplikace v mobilu, tabletu nebo počítači.",
    "Pokladna odesílá datovou zprávu o každé kontaktní platbě a přijímá potvrzovací kód (POK).",
    "Pokladní certifikát je zdarma v DIS+, platí 366 dní a jeden certifikát lze použít pro více pokladen.",
    "Bez signálu se prodává dál; tržba se odešle nejpozději do 48 hodin.",
    "Státní MOJE eet bude od 1. 12. 2026 zdarma – pro nejvýše 2 evidenční jednotky a 2 zaměstnance.",
  ],
  sections: [
    {
      id: "co-musi-umet",
      heading: "Co musí pokladna pro EET 2.0 umět",
      blocks: [
        {
          p: "Zákon nepředepisuje konkrétní zařízení ani aplikaci. Pokladnou může být mobilní aplikace, webová pokladna, tablet i klasická pokladna – pokud zvládne to, co evidence vyžaduje:",
        },
        {
          ul: [
            "**Odeslat datovou zprávu o každé evidované tržbě**, nejpozději při přijetí platby. Zpráva obsahuje celkovou částku, datum, evidenční jednotku a pořadové číslo – způsob platby, sazby DPH ani položky ne.",
            `**Podepsat zprávu pokladním certifikátem.** ${FACTS.certificate.summary}`,
            `**Přijmout potvrzovací kód.** ${FACTS.confirmation.summary}`,
            `**Doposlat tržbu po výpadku spojení.** ${FACTS.offline.summary} Zda pokladna umí prodávat i bez signálu, se liší podle aplikace – viz checklist níže.`,
            `**Nečekat na odpověď donekonečna.** ${FACTS.offline.responseTimeout}`,
          ],
        },
        { note: `Tiskárnu mít nemusíte. ${FACTS.receipt.summary}` },
      ],
    },
    {
      id: "moje-eet",
      heading: "Státní aplikace MOJE eet",
      blocks: [
        { p: FACTS.mojeEet.summary },
        {
          p: "Když vám tyto parametry stačí, je MOJE eet bezplatná volba přímo od státu. Pokud potřebujete víc evidenčních jednotek nebo pokladních, případně jistotu prodeje bez signálu a exportu pro účetní (u MOJE eet je Finanční správa zatím nezveřejnila), porovnejte ji s nezávislými pokladnami – například v našem [srovnání EvidujZdarma a MOJE eet](/srovnani/moje-eet), které uvádí jen zveřejněné údaje.",
        },
      ],
    },
    {
      id: "nezavisle-pokladny",
      heading: "Nezávislé pokladny v mobilu",
      blocks: [
        {
          p: "Evidovat můžete i v jiné pokladně než ve státní aplikaci. Finanční správa pro jejich výrobce zveřejnila technickou dokumentaci a testovací prostředí Playground. Pokladní certifikát z DIS+ patří vám, ne aplikaci – do nezávislé pokladny ho nahrajete a při změně pokladny ho můžete použít dál.",
        },
        {
          p: "Ceny a funkce se liší a „zdarma“ často znamená jen základní verzi. Vždy si ověřte, co je v ceně a co je placený doplněk.",
        },
        {
          note: "Pokladnu EvidujZdarma připravujeme: zdarma pro až 5 uživatelů a 3 evidenční jednotky, s prodejem bez signálu a dodatečným odesláním do 48 hodin. Spustit ji plánujeme 1. 12. 2026, předregistrovat se můžete už teď.",
        },
      ],
    },
    {
      id: "checklist",
      heading: "Checklist: na co se zeptat před výběrem",
      blocks: [
        {
          ul: [
            "Funguje pokladna **bez signálu** a hlídá lhůtu 48 hodin u neodeslaných tržeb?",
            "Kolik **evidenčních jednotek** a **pokladních** je zdarma – a kolik jich potřebujete vy?",
            "Jak se do ní **nahrává pokladní certifikát** a kde je uložený jeho klíč?",
            "Umí **doklad pro zákazníka**, když o něj požádá – e-mailem, QR kódem nebo tiskem?",
            "Dá se **exportovat přehled tržeb** pro účetní, a v jakém formátu?",
            "Co se stane s tržbami, které ještě nejsou odeslané, když **změníte pokladnu** nebo zrušíte účet?",
            "Kdo pokladnu provozuje, kde jsou uložená data a co je **placený doplněk**?",
          ],
        },
        { cta: "registrace" },
      ],
    },
    {
      id: "jak-zacit",
      heading: "Jak začít: od DIS+ k první tržbě",
      blocks: [
        {
          ol: [
            `Od **${DIS.dateLabel}** se přihlaste k evidenci tržeb v DIS+ (portál MOJE daně).`,
            "Oznamte evidenční jednotky – provozovnu, stánek, vozidlo, web, nebo sebe, pokud provozovnu nemáte.",
            "Vygenerujte si zdarma pokladní certifikát (Správa pokladních certifikátů EET).",
            `Vyberte pokladnu – státní MOJE eet je k dispozici od **${MOJE_EET.dateLabel}** – a u nezávislé pokladny do ní nahrajte certifikát.`,
            "Od **1. 1. 2027** evidujte každou kontaktní platbu.",
          ],
        },
        {
          p: "Podrobný postup v DIS+ popisuje návod [Jak aktivovat DIS+ a stáhnout certifikát EET 2.0](/navody/jak-aktivovat-dis-a-certifikat).",
        },
      ],
    },
  ],
  faq: [
    { q: "Je státní aplikace MOJE eet opravdu zdarma?", a: FACTS.mojeEet.summary },
    { q: "Potřebuji k pokladně v mobilu tiskárnu?", a: `Ne. ${FACTS.receipt.summary}` },
    { q: "Můžu mít stejný certifikát v mobilu i v tabletu?", a: FACTS.certificate.summary },
    {
      q: "Funguje pokladna v mobilu bez internetu?",
      a: `Záleží na aplikaci. Zákon to umožňuje: ${FACTS.offline.summary} Zda bude bez připojení fungovat MOJE eet, Finanční správa zatím nezveřejnila.`,
    },
    {
      q: "Musím mít pokladnu, když mi všichni platí převodem na fakturu?",
      a: `Ne. ${FACTS.evidenced.notEvidenced} Pokud ale zákazník zaplatí převodem nebo QR kódem přímo u vás, jde o kontaktní platbu. Pokladnu potřebujete jen pro kontaktní platby.`,
    },
  ],
  howTo: {
    name: "Jak začít evidovat tržby v pokladně v mobilu",
    description: "Od přihlášení v DIS+ po první evidovanou tržbu.",
    steps: [
      { name: "Přihlaste se v DIS+", text: `Od ${DIS.dateLabel} se v portálu MOJE daně přihlaste k evidenci tržeb.` },
      { name: "Oznamte evidenční jednotky", text: "Provozovnu, stánek, vozidlo, web, nebo sebe, pokud provozovnu nemáte." },
      { name: "Vygenerujte pokladní certifikát", text: "Zdarma v DIS+ v aplikaci Správa pokladních certifikátů EET; platí 366 dní." },
      { name: "Vyberte pokladnu", text: `Státní MOJE eet (od ${MOJE_EET.dateLabel}) nebo nezávislou pokladnu, do které nahrajete certifikát.` },
      { name: "Evidujte", text: "Od 1. 1. 2027 odesílejte každou kontaktní platbu; při výpadku signálu nejpozději do 48 hodin." },
    ],
  },
  sources: [
    SOURCES.harmonogram,
    SOURCES.jakZacit,
    SOURCES.prakticke,
    SOURCES.fsFaq,
    SOURCES.vyvojari,
    SOURCES.fsPlayground,
    SOURCES.mojeEet,
    SOURCES.mojeEet2fa,
    SOURCES.kdoMusi,
    SOURCES.prezident,
    SOURCES.zos,
  ],
  related: ["jak-aktivovat-dis-a-certifikat", "eet-bez-internetu", "musim-vydavat-uctenku"],
  published: "2026-10-07",
  updated: "2026-10-07",
  changelog: [{ date: "2026-10-07", text: "Koncept návodu – před odbornou revizí." }],
  reviewedBy: null,
};
