import { SITE } from "@/lib/site";
import { FACTS } from "../facts";
import type { HelpArticle } from "./types";

/**
 * Účet, certifikát a podpora: setup-app.tsx (Pokladní certifikát, Evidenční jednotky, Zrušit účet), lib/server/fiscal.ts
 * (výměna certifikátu, BLOCK_TEXT), lib/server/reminders.ts (e-maily), lib/legal.ts RETENTION (lhůty po zrušení),
 * lib/server/auth.ts (čerstvé přihlášení), status-bar.tsx (hodiny zařízení).
 */
export const UCET: readonly HelpArticle[] = [
  {
    slug: "platnost-certifikatu",
    topic: "ucet",
    title: "Platnost certifikátu a jeho výměna",
    description:
      "Jak dlouho platí pokladní certifikát, kde v pokladně EvidujZdarma vidíte konec platnosti, kdy přijde upozornění e-mailem a jak certifikát vyměnit.",
    lead: `${FACTS.certificate.summary} Konec platnosti vidíte v nastavení pokladny v kroku **Pokladní certifikát** („platný do …“).`,
    sections: [
      {
        id: "upozorneni",
        heading: "Upozornění e-mailem",
        blocks: [{ p: "Třicet a sedm dní před koncem platnosti ostrého certifikátu pošleme vlastníkům e-mail „Pokladní certifikát vyprší …“." }],
      },
      {
        id: "kdyz-vyprsi",
        heading: "Když certifikát vyprší",
        blocks: [
          {
            p: "Tržby se uloží, ale neodešlou – pokladna u nich hlásí „Pokladní certifikát vypršel – nahrajte nový z DIS+.“ Nový certifikát proto nahrajte hned.",
          },
          { p: "Certifikát odstraníte tlačítkem **Odstranit** – smažeme i jeho šifrovaný klíč. V DIS+ ho pak můžete zneplatnit." },
        ],
      },
    ],
    stepsHeading: "Výměna certifikátu",
    stepsAt: 1,
    steps: [
      {
        name: "Vygenerujte nový certifikát",
        text: "V DIS+ vygenerujte nový pokladní certifikát – postup je stejný jako poprvé, viz [návod k DIS+ a certifikátu](/navody/jak-aktivovat-dis-a-certifikat).",
      },
      { name: "Nahrajte ho", text: "V kroku **Pokladní certifikát** ho nahrajte s heslem. Nový certifikát nahradí dosavadní certifikát stejného prostředí." },
      {
        name: "Ověřte ho",
        text: "Klepněte na **Odeslat ověřovací tržbu**. Do té doby nové ostré tržby čekají a po ověření se odešlou samy – nenechávejte to na poslední chvíli, lhůta je 48 hodin od prodeje.",
      },
    ],
    related: ["pokladni-certifikat", "rezim-evidence", "odmitnuta-trzba"],
    guides: ["jak-aktivovat-dis-a-certifikat"],
    updated: "2026-10-17",
  },
  {
    slug: "zmeny-v-provozovne",
    topic: "ucet",
    title: "Změny v provozovně a evidenčních jednotkách",
    description:
      "Co v pokladně EvidujZdarma udělat, když otevíráte novou provozovnu, jednu zavíráte nebo vám Finanční správa přidělila jiné číslo evidenční jednotky.",
    lead: `${FACTS.units.change} V pokladně změnu promítnete v nastavení, v kroku **Evidenční jednotky**.`,
    steps: [
      {
        name: "Nová provozovna",
        text: "Přidejte novou jednotku tlačítkem **+ Přidat jednotku** a po oznámení v DIS+ jí doplňte číslo. Pro ostrý provoz musí mít číslo každá aktivní jednotka.",
      },
      {
        name: "Zavřená provozovna",
        text: "U jednotky klepněte na **Odebrat**. Jednotka se jen vypne – tržby, které na ní proběhly, zůstanou v historii i v exportu.",
      },
      {
        name: "Jiné číslo jednotky",
        text: "Přepište číslo v poli **Číslo z DIS+** u jednotky a klepněte na **Uložit**. Odmítnuté tržby se starým číslem pak odešlete tlačítkem **Odeslat s opravenými údaji** – viz [Odmítnutá tržba](/napoveda/odmitnuta-trzba).",
      },
    ],
    sections: [
      {
        id: "pripominka",
        heading: "Připomínka e-mailem",
        blocks: [
          {
            p: "Den po úpravě nebo odebrání jednotky pošleme vlastníkům připomínku „Nezapomeňte oznámit změnu evidenční jednotky“ s datem, do kdy změnu v DIS+ oznámit.",
          },
        ],
      },
      {
        id: "co-zatim-nejde",
        heading: "Co v nastavení zatím nejde",
        blocks: [
          {
            p: `Změnit název nebo adresu existující jednotky a znovu zapnout odebranou jednotku v nastavení zatím nejde. Potřebujete-li to, napište nám na **${SITE.email}**, nebo přidejte jednotku novou.`,
          },
        ],
      },
    ],
    related: ["evidencni-jednotky", "odmitnuta-trzba", "rezim-evidence"],
    guides: ["evidencni-jednotka"],
    updated: "2026-10-17",
  },
  {
    slug: "zruseni-uctu",
    topic: "ucet",
    title: "Zrušení účtu a co se stane s daty",
    description:
      "Jak zrušit účet v pokladně EvidujZdarma, co se stane s certifikáty, pokladnami a neodeslanými tržbami a kdy data smažeme – po 30, nejdéle po 60 dnech.",
    lead: "Účet zrušíte sami v nastavení pokladny. Certifikáty přestanou okamžitě fungovat a pokladny přestanou prodávat. Na stažení dat máte 30 dní.",
    steps: [
      { name: "Stáhněte si data", text: "Nejdřív si stáhněte export tržeb a pokladní knihu – viz [Export pro účetní](/napoveda/export-pro-ucetni)." },
      {
        name: "Zrušte účet",
        text: "Na konci **Nastavení pokladny** klepněte na **Chci zrušit účet**, napište ZRUSIT a potvrďte tlačítkem **Zrušit účet**. Krok vyžaduje přihlášení ne starší než 15 minut.",
      },
      {
        name: "Vyřiďte neodeslané tržby",
        text: "Má-li účet neodeslané tržby, pokladna je vypíše a zeptá se znovu. Ostré tržby se po zrušení Finanční správě neodešlou – evidujte je jinak (např. v aplikaci MOJE eet) a pak je v nastavení označte tlačítkem **Evidováno jinak**.",
      },
      { name: "Zneplatněte certifikát", text: "Certifikát nezapomeňte zneplatnit v DIS+." },
    ],
    sections: [
      {
        id: "co-se-stane",
        heading: "Co se stane potom",
        blocks: [
          {
            ul: [
              "Pokladny už neprodávají, jen předají uložené tržby do účtu. Po 30 dnech se odpojí.",
              "Data smažeme po 30 dnech od zrušení. Má-li účet neodeslané ostré tržby, nejdéle po 60 dnech.",
              "V den zrušení pošleme souhrn e-mailem. Zůstanou-li neodeslané ostré tržby, připomeneme je ještě 30. a 55. den.",
              "Testovací tržby z Playgroundu se neevidují – nic s nimi dělat nemusíte.",
            ],
          },
          { p: "Jak s osobními údaji zacházíme, popisují [zásady ochrany osobních údajů](/ochrana-osobnich-udaju)." },
        ],
      },
    ],
    related: ["export-pro-ucetni", "platnost-certifikatu", "podpora"],
    updated: "2026-10-17",
  },
  {
    slug: "bezpecnost",
    topic: "ucet",
    title: "Bezpečnost účtu a pokladny",
    description:
      "Jak EvidujZdarma chrání účet a pokladnu: přihlášení odkazem bez hesla, nové přihlášení u citlivých kroků, šifrovaný certifikát, PINy a upozornění e-mailem.",
    lead: "Účet chrání několik vrstev: přihlášení odkazem z e-mailu, PINy obsluhy a e-mailová upozornění na důležité změny. Tady je přehled, co hlídá pokladna sama a co můžete udělat vy.",
    sections: [
      {
        id: "co-hlida-pokladna",
        heading: "Co hlídá pokladna",
        blocks: [
          {
            ul: [
              "Přihlášení bez hesla: odkaz z e-mailu platí 15 minut a jen v prohlížeči, ve kterém jste o něj požádali.",
              "Nahrání certifikátu, zapnutí ostrého provozu a zrušení účtu chtějí přihlášení ne starší než 15 minut – jinak pokladna nabídne **Poslat přihlašovací odkaz**.",
              "Privátní klíč certifikátu je šifrovaný na serverech v EU, heslo k certifikátu neukládáme.",
              "E-mailem upozorníme vlastníky na nahraný certifikát, novou pokladnu a propojení s účetní.",
              "PIN vlastníka se ověřuje jen na serveru a po chybných PINech roste prodleva.",
            ],
          },
        ],
      },
      {
        id: "co-udelat-vy",
        heading: "Co můžete udělat vy",
        blocks: [
          {
            ul: [
              "Nastavte PIN každé pokladní a vlastníkovi PIN se 6–8 číslicemi.",
              "PIN ani heslo k certifikátu nikomu neposílejte – ani nám.",
              "Na sdíleném zařízení se po registraci v nastavení odhlaste tlačítkem **Odhlásit**; pokladna funguje dál.",
              "Ztracené zařízení hned odpojte tlačítkem **Odpojit** a změňte PIN vlastníka.",
              "Nechte v zařízení automatický čas. Když se hodiny liší aspoň o 2 minuty, pokladna upozorní a čas tržeb opraví podle serveru.",
            ],
          },
        ],
      },
    ],
    related: ["pokladni-a-pin", "vice-zarizeni", "pokladni-certifikat"],
    updated: "2026-10-17",
  },
  {
    slug: "podpora",
    topic: "ucet",
    title: "Podpora a kontakt",
    description:
      "Jak kontaktovat podporu pokladny EvidujZdarma, co do zprávy napsat, aby šlo rychle pomoci, a kde hledat další odpovědi k EET 2.0, DIS+ a certifikátu.",
    lead: `Nenašli jste odpověď? Napište nám na **${SITE.email}**. Pomůžeme s nastavením pokladny, s certifikátem i s tržbou, která se nechce odeslat.`,
    sections: [
      {
        id: "co-napsat",
        heading: "Co do zprávy napsat",
        blocks: [
          {
            ul: [
              "IČO firmy a e-mail, kterým se přihlašujete.",
              "Označení pokladny (například P1) a zařízení – telefon, tablet nebo počítač a prohlížeč.",
              "Evidenční jednotku, pokud jich máte víc.",
              "U tržby číslo dokladu, čas a částku.",
              "Přesné znění chybové hlášky, nejlépe celou větu.",
            ],
          },
          { note: "Nikdy nám neposílejte heslo k certifikátu, soubor certifikátu ani PIN. Nepotřebujeme je.", tone: "warn" },
        ],
      },
      {
        id: "kde-hledat",
        heading: "Kde hledat dál",
        blocks: [
          {
            ul: [
              "[Návody k EET 2.0](/navody) – povinnosti, evidenční jednotky, DIS+ a certifikát.",
              "[Jak aktivovat DIS+ a certifikát](/navody/jak-aktivovat-dis-a-certifikat) – přihlášení k evidenci a vygenerování certifikátu krok za krokem.",
              "[Je EET dole?](/stav-eet) – stav systému evidence tržeb.",
              "[Ukázka pokladny](/ukazka) – vyzkoušejte si prodej bez registrace.",
              "[O nás a kontakt](/o-nas) – kdo službu provozuje.",
            ],
          },
          {
            p: `${SITE.independenceNotice} Oficiální informace k EET 2.0 najdete na [eet.gov.cz](https://eet.gov.cz).`,
          },
        ],
      },
    ],
    related: ["prvni-spusteni", "odmitnuta-trzba", "bezpecnost"],
    updated: "2026-10-17",
  },
];
