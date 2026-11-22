import { SOURCES } from "../facts";
import type { Guide } from "./types";

/** S12 (22. 11. 2026): cluster „Doklady pro účetní bez chaosu“ – viz co-ucetni-potrebuje-kazdy-mesic.ts. Koncept do revize. */
export const procUcetniChceFaktury: Guide = {
  slug: "proc-ucetni-chce-faktury",
  category: "doklady",
  title: "Proč účetní pořád chce faktury a jak to zautomatizovat",
  h1: "Proč účetní pořád chce faktury (a jak to zautomatizovat)",
  description:
    "Proč účetní ke každé platbě potřebuje fakturu nebo účtenku, co se stane, když doklad chybí, a jak sběr dokladů zautomatizovat, aby vás nemusela pořád upomínat.",
  lead:
    "Účetní chce faktury, protože bez dokladu nemůže platbu správně zaúčtovat: zákon o účetnictví i zákon o DPH stavějí na dokladech, ne na výpisu z banky. Když se ptá znovu, obvykle jí k některým platbám stále chybí podklad. Sběr dokladů se dá z velké části zautomatizovat.",
  summary: [
    "Účetní zápis stojí na účetním dokladu (§ 11 zákona o účetnictví), odpočet DPH na daňovém dokladu (§ 29 zákona o DPH).",
    "Výpis z banky dokazuje platbu, ne její obsah – proto k němu účetní hledá doklad.",
    "Upomínání stojí čas obě strany; nejvíc pomáhá doklad předat hned a na jedno místo.",
    "Automatizace: přeposílání faktur z e-mailu, pravidelné stahování z klientských zón, párování s výpisem.",
  ],
  sections: [
    {
      id: "proc",
      heading: "Proč účetní bez dokladu nepohne",
      blocks: [
        {
          p: "Účetní případ se zapisuje na základě účetního dokladu s náležitostmi podle § 11 zákona o účetnictví – kdo, co, kolik a kdy. Plátce DPH může odpočet uplatnit jen s daňovým dokladem podle zákona o DPH. Výpis z banky ukáže, že peníze odešly, ale ne za co a s jakou sazbou DPH.",
        },
        { p: "Účetní tedy faktury nechce z opatrnosti nebo pro formu: bez nich by musela odhadovat, a odhad je přesně to, co se při kontrole neobhájí." },
      ],
    },
    {
      id: "co-zdrzuje",
      heading: "Co nejčastěji zdržuje",
      blocks: [
        {
          ul: [
            "Faktura zůstala v e-mailu, který účetní nevidí.",
            "Doklad dorazí až po termínu, který si s účetní domluvíte – plátce DPH navíc tlačí lhůty přiznání a kontrolního hlášení.",
            "Účtenka z cesty se ztratila nebo vybledla.",
            "U platby není poznat, ke které zakázce nebo provozovně patří.",
          ],
        },
        { p: "Žádná z těchto věcí není chyba účetní. Vznikají z ruční práce a z toho, že doklady chodí z mnoha míst – a to je přesně ta část, kterou jde zautomatizovat." },
      ],
    },
    {
      id: "automatizace",
      heading: "Jak sběr dokladů zautomatizovat",
      blocks: [
        {
          ol: [
            "**Jedna adresa pro faktury.** Dodavatelům dejte jednu e-mailovou adresu a nastavte pravidlo, které přílohy přeposílá účetní nebo do sdílené složky.",
            "**Faktury z klientských zón.** U předplatného (software, telefon, energie) si zapište, kde se faktura stahuje; řada služeb umí posílat fakturu e-mailem automaticky.",
            "**Tržby z pokladny exportem.** Přehled tržeb a pokladní knihu z pokladny nepřepisujte ručně – předejte export, nebo dejte účetní přístup přes Účetní kabinet.",
            "**Párování s výpisem.** Jednou týdně projděte výpis a ke každé platbě přiřaďte doklad – postup v návodu [Párování plateb s doklady](/navody/parovani-plateb-s-doklady).",
          ],
        },
        {
          note: "Připravujeme bezplatnou betu **Doklady k platbám** pro uživatele EvidujZdarma: výpis z banky dovnitř, ke každé platbě její doklady, připomínky chybějících a přístup pro účetní. Zájem můžete dát na stránce [Doklady pro účetní bez chaosu](/ucetnictvi-bez-chaosu).",
          tone: "info",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Proč nestačí výpis z banky?",
      a: "Výpis dokazuje platbu, ne její obsah. Účetní potřebuje vědět, co jste koupili nebo prodali, od koho a s jakou sazbou DPH – to je na dokladu.",
    },
    {
      q: "Musím účetní posílat i účtenky z čerpací stanice nebo z obchodu?",
      a: "Pokud jde o výdaj podnikání, ano. Bez dokladu ho účetní obtížně uplatní. Která drobná vydání má smysl dokládat, se domluvte s ní.",
    },
    {
      q: "Jak dlouho doklady schovávat?",
      a: "Lhůty pro uchování stanoví zákon o účetnictví, zákon o DPH a daňové předpisy a liší se podle typu dokladu. Které platí pro vás, vám řekne účetní.",
    },
  ],
  sources: [SOURCES.zoUcetnictvi, SOURCES.zdph, SOURCES.zdp],
  related: ["musim-vydavat-uctenku", "storno-a-vraceni-eet", "eet-2-0-kompletni-pruvodce"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [{ date: "2026-11-22", text: "Nový návod – čeká na odbornou revizi." }],
  reviewedBy: null,
};
