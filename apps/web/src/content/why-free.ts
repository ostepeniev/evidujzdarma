import { plainText } from "@/components/rich-text";

/**
 * Blok „Proč je to zdarma? A kde je háček?“ na úvodní stránce (R14.1, karta 3 podle R15.3) – texty doslovně.
 * Odkazy v syntaxi RichText: „v podmínkách“ → čl. 6 obchodních podmínek (definice „navždy“), „Premium“ → ceník.
 * Cena Premium se musí shodovat s PLANS v pricing.ts (hlídá test r14-conversion).
 */
export const WHY_FREE = {
  title: "Proč je to zdarma? A kde je háček?",
  intro: "Ptáte se správně. Tady je, jak to funguje.",
  cards: [
    {
      title: "Základ zdarma navždy",
      text: "Evidence tržeb, účtenka e-mailem i QR kódem, práce bez signálu, až 5 uživatelů a 3 evidenční jednotky. Ne na zkoušku, ale trvale. Co přesně znamená „navždy“, najdete [v podmínkách](/podminky#zdarma).",
    },
    {
      title: "Vydělávat chceme na doplňcích",
      text: "Kdo bude chtít víc, si připlatí: [Premium](/cenik) za 149 Kč měsíčně (účtenky SMS, exporty), platební terminál nebo nastavení na klíč. Doplňky připravujeme a nikdo je nemusí.",
    },
    {
      title: "Nežijeme z reklamy ani z vašich dat",
      text: "Na webu nemáme reklamu ani sledovací cookies a vaše údaje nikomu neprodáváme.",
    },
  ],
  guarantee: "Bez závazku a bez platební karty.",
} as const;

/** Táž otázka v ceníku (PRICING_FAQ, FAQPage): karty 1–3 jedním odstavcem, stejnými větami. */
export const WHY_FREE_FAQ = {
  q: "Proč je pokladna zdarma a kde je háček?",
  a: WHY_FREE.cards.map((c) => plainText(c.text)).join(" "),
};
