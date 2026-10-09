import { isClosed } from "./launch";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://evidujzdarma.cz").replace(/\/$/, "");

/**
 * Popis služby – jediné místo (R10.2, R11): dokud je /pokladna zavřená, mluví o pokladně v budoucím čase, aby web
 * netvrdil, že už funguje. Po otevření (odebrání z CLOSED_SECTIONS) se sám vrátí přítomný čas.
 *  - `site` = SITE.description (meta, patička, JSON-LD organizace), `home` = meta popis úvodní stránky;
 *  - `hero` = podtitul úvodní stránky, `toolCta` = výchozí text ToolCta, `guideSidebar` = boční panel návodu,
 *    `calculatorCta` = ToolCta kalkulačky EET OFF, `compareCta` = ToolCta srovnání s MOJE eet;
 *  - `compareIntro` = odstavec nad srovnáním na úvodní stránce, `offlineFaq` = věta za FACTS.offline.summary ve FAQ
 *    „Co když nemám signál?“, `offlineNote` = note v návodu eet-bez-internetu, `certificateComment` = komentář v myths.ts (R12.1).
 */
export const SERVICE_COPY = isClosed("/pokladna")
  ? {
      site: "Bezplatnou pokladnu pro EET 2.0 připravujeme: bude fungovat i bez signálu, pro až 5 uživatelů, s účtenkou e-mailem i QR. Nezávislá služba, není provozována Finanční správou.",
      home: "EET 2.0 od roku 2027: zkontrolujte podle IČO, zda se vás týká, a předregistrujte se k bezplatné pokladně. Bude fungovat i offline, pro až 5 uživatelů, s účtenkou e-mailem i QR.",
      hero: "Bezplatná pokladna pro EET 2.0, která bude fungovat i bez signálu.",
      toolCta: "Pokladnu pro EET 2.0 připravujeme: zdarma navždy, i bez signálu, pro až 5 uživatelů, s účtenkou e-mailem i QR.",
      guideSidebar: "Připravujeme: i bez signálu, pro až 5 uživatelů.",
      calculatorCta: "Rozhodli jste se evidovat? Pokladnu EvidujZdarma připravujeme – zdarma navždy a i bez signálu. Předregistrujte se už teď.",
      compareCta: "Zkontrolujte své IČO za 10 vteřin, nebo se rovnou předregistrujte k bezplatné pokladně, která bude fungovat i bez signálu.",
      compareIntro:
        "Státní aplikace MOJE eet je dobrá volba pro nejmenší podnikatele. Naše pokladna navíc bude umět prodávat bez signálu, tisknout na tiskárnu a posílat účtenky e-mailem; nástroje pro účetní nabízíme už teď. Tyto funkce MOJE eet podle dosud zveřejněných informací nemá.",
      offlineFaq: "Naše pokladna bude tržbu ukládat v zařízení, odešle ji sama, jakmile bude spojení, a ukáže, kolik času do konce lhůty zbývá.",
      offlineNote:
        "Pokladna EvidujZdarma, kterou připravujeme, bude u každé neodeslané tržby ukazovat, kolik času do konce lhůty zbývá, a upozorní vás dřív, než lhůta vyprší.",
      certificateComment: "Pro podnikatele je to detail – důležité je, že bez certifikátu z DIS+ evidovat nejde. Naše pokladna bude podpis řešit sama, certifikát jen nahrajete.",
      /** tlačítko bloku „Proč je to zdarma?“ a tlačítka dole na telefonu (R14.1, R14.5) */
      startCta: { label: "Předregistrovat se zdarma", href: "/#registrace" },
    }
  : {
      site: "Bezplatná pokladna pro EET 2.0: funguje i bez signálu, až 5 uživatelů, účtenka e-mailem i QR. Nezávislá služba, není provozována Finanční správou.",
      home: "EET 2.0 od roku 2027: zkontrolujte podle IČO, zda se vás týká, a předregistrujte se k bezplatné pokladně. Funguje i offline, až 5 uživatelů, účtenka e-mailem i QR.",
      hero: "Bezplatná pokladna pro EET 2.0, která funguje i bez signálu.",
      toolCta: "Pokladna pro EET 2.0 zdarma navždy: funguje i bez signálu, až 5 uživatelů, účtenka e-mailem i QR.",
      guideSidebar: "Funguje i bez signálu, až 5 uživatelů.",
      calculatorCta: "Rozhodli jste se evidovat? Pokladna EvidujZdarma je zdarma navždy, funguje i bez signálu a zvládne ji každý za 15 minut.",
      compareCta: "Zkontrolujte své IČO za 10 vteřin, nebo se rovnou předregistrujte k bezplatné pokladně, která funguje i bez signálu.",
      compareIntro:
        "Státní aplikace MOJE eet je dobrá volba pro nejmenší podnikatele. My navíc nabízíme práci bez signálu, tiskárny, účtenky e-mailem a nástroje pro účetní – funkce, které MOJE eet podle dosud zveřejněných informací nemá.",
      offlineFaq: "Naše pokladna tržbu uloží v zařízení, odešle ji sama, jakmile je spojení, a ukazuje, kolik času do konce lhůty zbývá.",
      offlineNote: "Pokladna EvidujZdarma ukazuje u každé neodeslané tržby, kolik času do konce lhůty zbývá, a upozorní vás dřív, než lhůta vyprší.",
      certificateComment: "Pro podnikatele je to detail – důležité je, že bez certifikátu z DIS+ evidovat nejde. Naše pokladna podpis řeší sama, certifikát jen nahrajete.",
      startCta: { label: "Začít zdarma", href: "/#registrace" },
    };

export const SITE = {
  name: "EvidujZdarma",
  domain: "evidujzdarma.cz",
  url: SITE_URL,
  tagline: "Evidence tržeb EET 2.0 zdarma",
  description: SERVICE_COPY.site,
  email: "ahoj@evidujzdarma.cz",
  independenceNotice: "Nezávislá služba, není provozována Finanční správou.",
  /** profily EvidujZdarma na sociálních sítích – sameAs v JSON-LD organizace (R8.11) */
  social: [
    "https://www.facebook.com/profile.php?id=61595251222968",
    "https://www.linkedin.com/company/146665642/",
    // R14.6
    "https://www.instagram.com/evidujzdarma/",
    "https://www.threads.com/@evidujzdarma",
  ],
} as const;

/**
 * Kdo odborně reviduje návody (Ф12, R8.10). Funkci mění jen kontrolor. Recenzentka si nepřeje, aby web uváděl její zápis
 * v profesním rejstříku – proto ani titul, ani číslo, ani sameAs/hasCredential v JSON-LD (R10.5).
 */
export const REVIEWER_TITLE = "účetní";
export const REVIEWER = { name: "Helena Jeřábková", title: REVIEWER_TITLE, path: "/o-nas#odborna-revize" } as const;
/** Praxe recenzentky – s jejím souhlasem (R10.5): text na /o-nas a description v JSON-LD. */
export const REVIEWER_PROFILE = `${REVIEWER_TITLE} s 22 lety praxe`;
/** Citát recenzentky (R10.5) – /o-nas a úvod kompletního průvodce. */
export const REVIEWER_QUOTE =
  "EET 2.0 není jen spuštění nějaké aplikace – pro každého podnikatele to znamená další každodenní rutinu. Stát sice slibuje základní aplikaci, ale ruční zadávání každé účtenky se rychle změní v bolest hlavy a bude zabírat spoustu času. Abyste se vyhnuli frontám a chybám, připravte se už teď: nejlépe hned nastavte automatizaci, která za vás papírování vyřídí na pozadí.";

/**
 * Provozovatel (§ 435 OZ) – veřejné údaje z obchodního rejstříku (ARES/VR, ověřeno 2. 10. 2026).
 * Jsou v kódu, ne v env: musí být na webu, v podmínkách i v každém e-mailu vždy (Р9).
 */
export const OPERATOR = {
  name: "Swipe Scape s.r.o.",
  ico: "22269134",
  dic: "CZ22269134",
  address: "Chebská 38/5, Dvory, 360 06 Karlovy Vary",
  registry: "zapsaná v obchodním rejstříku vedeném Krajským soudem v Plzni, oddíl C, vložka 47634",
} as const;

/** Úplná identifikace provozovatele na jednom řádku (patička, podmínky, e-maily). */
export function operatorLine(): string {
  return `${OPERATOR.name}, IČO ${OPERATOR.ico}, DIČ ${OPERATOR.dic}, se sídlem ${OPERATOR.address}, ${OPERATOR.registry}`;
}

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const NAV = [
  { href: "/kontrola-ico", label: "Kontrola IČO" },
  { href: "/navody", label: "Návody EET" },
  { href: "/nastroje", label: "Nástroje" },
  { href: "/ucetni", label: "Pro účetní" },
  { href: "/srovnani/moje-eet", label: "Srovnání" },
] as const;
