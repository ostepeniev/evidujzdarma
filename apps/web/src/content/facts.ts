/**
 * Jediný zdroj faktů o EET 2.0 pro celý web (landing, e-maily, kvíz, kalkulačky,
 * llms.txt, návody). Každý fakt má zdroj. Při změně zákona/harmonogramu upravte JEN
 * tento soubor a FACTS_UPDATED — projeví se všude.
 *
 * Stav ověření k 1. 10. 2026. Údaje označené `provisional: true` ještě nejsou
 * definitivně publikované (např. paušální daň 2027) — web je tak i označuje.
 */

export const FACTS_UPDATED = "2026-10-01";

export interface Source {
  label: string;
  url: string;
}

export const SOURCES = {
  eetGov: { label: "eet.gov.cz – oficiální web EET 2.0", url: "https://eet.gov.cz" },
  harmonogram: { label: "eet.gov.cz: Jaký je harmonogram EET 2.0", url: "https://eet.gov.cz/cs/o-eet/jaky-je-harmonogram-eet-2-0" },
  kdoMusi: { label: "eet.gov.cz: Kdo musí evidovat tržby", url: "https://eet.gov.cz/cs/koho-se-eet-tyka/kdo-musi-evidovat-trzby" },
  jakZacit: { label: "eet.gov.cz: Jak začít evidovat", url: "https://eet.gov.cz/cs/zacinam-s-eet/jak-zacit-evidovat" },
  prakticke: { label: "eet.gov.cz: Praktické informace", url: "https://eet.gov.cz/cs/zacinam-s-eet/prakticke-informace" },
  eetOff: { label: "eet.gov.cz: Co je režim EET OFF", url: "https://eet.gov.cz/cs/eet-off/co-je-rezim-eet-off" },
  eetOffJak: { label: "eet.gov.cz: Jak a kdy se přihlásit k režimu EET OFF", url: "https://eet.gov.cz/cs/eet-off/jak-a-kdy-se-prihlasit-k-rezimu-eet-off" },
  prezident: {
    label: "eet.gov.cz: Prezident podepsal zákon o EET 2.0",
    url: "https://eet.gov.cz/cs/pro-media/tiskove-zpravy/2026/prezident-podepsal-zakon-o-eet-2-0-evidence-trzeb-1315",
  },
  mfPredstavuje: {
    label: "MF ČR: EET 2.0 – ministerstvo představuje moderní evidenci",
    url: "https://mf.gov.cz/cs/ministerstvo/media/tiskove-zpravy/2026/eet-2-0-ministerstvo-financi-predstavuje-moderni-a-62878",
  },
  psp: { label: "Poslanecká sněmovna: sněmovní tisk 189", url: "https://www.psp.cz/sqw/historie.sqw?o=10&t=189" },
  fsFaq: { label: "Finanční správa: Nejčastější otázky k EET 2.0", url: "https://financnisprava.gov.cz/cs/financni-sprava/novinky/novinky-2026/nejcastejsi-otazky-k-eet-2-0" },
  fsPlayground: {
    label: "Finanční správa: testovací prostředí EET2 Playground",
    url: "https://financnisprava.gov.cz/cs/financni-sprava/novinky/novinky-2026/financni-sprava-zpristupnila-testovaci-prostredi-eet2-playground",
  },
  pokuty: {
    label: "Podnikatel.cz: Maximální výše sankce zůstane 500 000 Kč",
    url: "https://www.podnikatel.cz/clanky/provozovnu-uz-vam-kvuli-eet-nezavrou-maximalni-vyse-sankce-ale-zustane-500-000-kc/",
  },
  mojeEet: {
    label: "Podnikatel.cz: Jak bude fungovat aplikace zdarma MOJE eet",
    url: "https://www.podnikatel.cz/clanky/jak-bude-fungovat-aplikace-zdarma-moje-eet-zjistili-jsme-detaily-od-financni-spravy/",
  },
  mojeEet2fa: {
    label: "Podnikatel.cz: Přihlášení do EET bude přísnější",
    url: "https://www.podnikatel.cz/clanky/prihlaseni-do-eet-bude-prisnejsi-financni-sprava-vysvetluje-proc/",
  },
  pausal2026: {
    label: "Finanční správa: snížení zálohy v 1. pásmu paušálního režimu",
    url: "https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2026/poplatnikum-v-prvnim-pasmu-pausalniho-rezimu-snizeni-zalohy",
  },
  pausal2027: {
    label: "Podnikatel.cz: Paušální daň OSVČ v roce 2027",
    url: "https://www.podnikatel.cz/clanky/pausalni-dan-osvc-v-roce-2027-opet-vzroste-vime-kolik-bude-nove-cinit-1/",
  },
  zos: { label: "Zákon o ochraně spotřebitele č. 634/1992 Sb., § 16", url: "https://www.zakonyprolidi.cz/cs/1992-634" },
  vyvojari: { label: "eet.gov.cz: Pro vývojáře", url: "https://eet.gov.cz/pro-vyvojare/" },
  // --- doplněno pro návody (vlna 1, 1. 10. 2026) ---
  fsVladaSchvalila: {
    label: "Finanční správa: Vláda schválila EET 2.0",
    url: "https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2026/vlada-schvalila-eet-2-0",
  },
  srovnani: {
    label: "Podnikatel.cz: V čem se EET 2.0 liší od EET 1.0",
    url: "https://www.podnikatel.cz/clanky/v-cem-se-eet-2-0-lisi-od-eet-1-0-prinasime-velke-srovnani/",
  },
  podnikatelPrehled: {
    label: "Podnikatel.cz: EET 2.0 – kdy začne, koho se týká, co se eviduje a jaké hrozí pokuty",
    url: "https://www.podnikatel.cz/clanky/eet-2-0-kdy-zacne-koho-se-tyka-co-vsechno-se-bude-evidovat-a-jake-hrozi-pokuty/",
  },
  fsPausalFaq: {
    label: "Finanční správa: Dotazy a odpovědi k paušální dani",
    url: "https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/pausalni-dan/dotazy-a-odpovedi/dotazy-a-odpovedi-k-pausalni-dani",
  },
  caeetPostupy: {
    label: "eet.gov.cz: Certifikační autorita EET v2.0 – postupy získání pokladního certifikátu (PDF)",
    url: "https://eet.gov.cz/files/CAEET_postupy_zadost_certifikat_v2.pdf",
  },
  caeetNapoveda: {
    label: "eet.gov.cz: Certifikační autorita EET v2.0 – nápověda webové aplikace (PDF)",
    url: "https://eet.gov.cz/files/CAEET_napoveda_webove_aplikace_v2.pdf",
  },
  mojeDane: { label: "Portál MOJE daně – přihlášení do DIS+", url: "https://mojedane.gov.cz/pmd/home/prihlaseni-do-dis" },
  usoudEet: {
    label: "Ústavní soud: zrušení náběhu 3. a 4. etapy EET a evidence plateb kartou (Pl. ÚS 26/16)",
    url: "https://www.usoud.cz/aktualne/ustavni-soud-zrusil-nabeh-treti-a-ctvrte-etapy-elektronicke-evidence-trzeb-ale-samotnou-evidenci-neshledal-protiustavni",
  },
  fsZruseni2023: {
    label: "Finanční správa: Zrušení elektronické evidence tržeb od 1. 1. 2023",
    url: "https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2022/zruseni-elektronicke-evidence-trzeb-od",
  },
  businessinfoEet1: {
    label: "BusinessInfo.cz: Speciál – Elektronická evidence tržeb (první EET)",
    url: "https://www.businessinfo.cz/clanky/special-elektronicka-evidence-trzeb-eet/",
  },
  podnikatelDetail: {
    label: "Podnikatel.cz: Jak bude vypadat EET 2.0 a doprovodné daňové změny – detailní přehled",
    url: "https://www.podnikatel.cz/clanky/jak-bude-vypadat-eet-2-0-a-doprovodne-danove-zmeny-pripravili-jsme-detailni-prehled/",
  },
  podnikatelPilot: {
    label: "Podnikatel.cz: EET 2.0 odstartuje v lednu 2027, první měsíc ale půjde jen o pilotní provoz",
    url: "https://www.podnikatel.cz/clanky/eet-sice-odstartuje-v-lednu-2027-prvni-mesic-ale-pujde-jen-o-pilotni-provoz/",
  },
  finmagNavod: {
    label: "Finmag.cz: Finanční správa doplnila návod, termíny a technické detaily EET 2.0",
    url: "https://www.finmag.cz/byrokracie/492937-eet-2-0-se-blizi-nove-informace-a-prehled-terminu-a-technickych-detailu-financni-spravy",
  },
  fsPausalLhuta: {
    label: "Finanční správa: Do 10. ledna se lze přihlásit, odhlásit a změnit pásmo paušální daně",
    url: "https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2023/do-10-ledna-se-lze-prihlasit-odhlasit-a",
  },
  zmp: { label: "Zákon o místních poplatcích č. 565/1990 Sb. (poplatek z pobytu)", url: "https://www.zakonyprolidi.cz/cs/1990-565" },
  danovkyKontaktni: {
    label: "Daňovky.cz: Finanční správa vysvětluje nový pojem kontaktní platby",
    url: "https://danovky.cz/cs/eet-2-0-financni-sprava-vysvetluje-novy-pojem-kontaktni-platby",
  },
  leitnerNerezidenti: {
    label: "LeitnerLeitner: Evidence tržeb (EET 2.0) se vrací – poplatníci daně z příjmů i nerezidenti",
    url: "https://www.leitnerleitner.cz/novinky/evidence-trzeb-eet-2-0-se-vraci-povinnost-miri-na-poplatniky-dane-z-prijmu-a-za-urcitych-okolnosti-i-na-nerezidenty/",
  },
} as const satisfies Record<string, Source>;

export interface TimelineItem {
  date: string; // ISO
  dateLabel: string;
  title: string;
  action: string;
  source: Source;
}

export const TIMELINE: readonly TimelineItem[] = [
  {
    date: "2026-11-01",
    dateLabel: "1. 11. 2026",
    title: "EET v DIS+",
    action: "Přihlaste se k evidenci v DIS+ (MOJE daně), oznamte evidenční jednotky a vygenerujte pokladní certifikát.",
    source: SOURCES.harmonogram,
  },
  {
    date: "2026-12-01",
    dateLabel: "1. 12. 2026",
    title: "Státní aplikace MOJE eet",
    action: "Vyberte pokladnu a vyzkoušejte si ji – státní MOJE eet, nebo pokladnu s prací bez signálu.",
    source: SOURCES.harmonogram,
  },
  {
    date: "2027-01-01",
    dateLabel: "1. 1. 2027",
    title: "Účinnost zákona, pilotní provoz",
    action: "Zákon nabývá účinnosti. Leden je pilotní (dobrovolný) provoz – ideální čas na zkoušku nanečisto.",
    source: SOURCES.mfPredstavuje,
  },
  {
    date: "2027-01-11",
    dateLabel: "11. 1. 2027",
    title: "Lhůta pro EET OFF",
    action: "Poslední den pro oznámení o přihlášení k přirážce (EET OFF) – jen paušalisté v 1. pásmu s příjmy do 1 mil. Kč.",
    source: SOURCES.eetOffJak,
  },
  {
    date: "2027-02-01",
    dateLabel: "1. 2. 2027",
    title: "Ostrý provoz",
    action: "Tržby přijaté hotově, kartou nebo QR kódem při osobním kontaktu se musí evidovat.",
    source: SOURCES.harmonogram,
  },
];

export const LIVE_DATE = "2027-02-01";

export const FACTS = {
  law: {
    name: "zákon o evidenci tržeb (EET 2.0)",
    printNo: "sněmovní tisk 189",
    signedOn: "17. 9. 2026",
    effectiveFrom: "1. 1. 2027",
    sources: [SOURCES.prezident, SOURCES.psp],
  },
  /** Co se eviduje */
  evidenced: {
    summary:
      "Evidují se platby přijaté při osobním kontaktu nebo v provozovně: hotovost, platební karta, QR kód, poukázka, šek i virtuální aktiva.",
    notEvidenced:
      "Neevidují se vzdálené platby – platební brána e-shopu, QR kód na webu, bankovní převod na základě faktury.",
    prepayments:
      "U záloh, dárkových poukazů a dobíjení kreditu se eviduje přijetí platby určené k pozdějšímu čerpání i samotné čerpání – jako samostatné částky.",
    sources: [SOURCES.kdoMusi, SOURCES.mfPredstavuje],
  },
  whoMust: {
    summary: "Evidovat musí každý poplatník daně z příjmů (fyzická i právnická osoba), který přijímá evidované tržby.",
    notCovered: "Netýká se příjmů ze zaměstnání, kapitálových příjmů, nájmu a příležitostných příjmů.",
    exemptions:
      "Zákon vyjímá některé činnosti – podle dostupných rozborů například část osobní dopravy, poštovní služby, hazardní hry, dodávky energií a vody nebo některé finanční služby. Výjimka se týká jen dané činnosti; přesný výčet ověřte na eet.gov.cz.",
    sources: [SOURCES.kdoMusi],
  },
  offline: {
    hours: 48,
    summary:
      "Datová zpráva se odesílá nejpozději při přijetí platby. Při výpadku spojení lze prodávat dál a tržbu odeslat bez zbytečného odkladu, nejpozději do 48 hodin.",
    sources: [SOURCES.prakticke, SOURCES.fsFaq],
  },
  receipt: {
    summary:
      "EET 2.0 neukládá povinnost vydat účtenku. Pokud o doklad zákazník požádá, vydává se podle § 16 zákona o ochraně spotřebitele (datum, zboží či služba, cena, jméno a IČO prodávajícího); podle běžného výkladu ho lze vydat i elektronicky.",
    sources: [SOURCES.prezident, SOURCES.zos],
  },
  confirmation: {
    summary: "Finanční správa na každou evidovanou tržbu odpoví potvrzovacím kódem (POK).",
    sources: [SOURCES.prakticke],
  },
  units: {
    summary:
      "Evidenční jednotka je provozovna (i mobilní stánek), automat, internetová stránka či aplikace nebo dopravní prostředek. Podnikatel bez provozovny uvede jako jednotku sám sebe.",
    types: ["stálá provozovna", "mobilní provozovna", "automat", "internetová stránka", "dopravní prostředek"],
    change: "Změny se oznamují v DIS+ před první tržbou po změně, nejpozději do 15 dnů.",
    sources: [SOURCES.jakZacit],
  },
  certificate: {
    summary:
      "Pokladní certifikát se vydává zdarma v DIS+ (aplikace Správa pokladních certifikátů EET). Platí 366 dní a patří poplatníkovi, ne zařízení – jeden certifikát lze použít pro více pokladen.",
    sources: [SOURCES.jakZacit],
  },
  eetOff: {
    surchargeMonthly: 1400,
    incomeLimit: 1_000_000,
    band: 1,
    deadline: "11. 1. 2027",
    summary:
      "Režim EET OFF je dobrovolný: fyzická osoba v 1. pásmu paušálního režimu s příjmy ze samostatné činnosti do 1 mil. Kč ročně zaplatí přirážku 1 400 Kč měsíčně a tržby neeviduje.",
    howTo:
      "Oznámení o přihlášení k přirážce se podává do 10. dne zdaňovacího období – pro rok 2027 do 11. 1. 2027 (10. 1. je neděle). Pozdní oznámení je neúčinné.",
    sources: [SOURCES.eetOff, SOURCES.eetOffJak],
  },
  pausal: {
    /** měsíční paušální záloha (Kč) */
    2026: { band1: 9162, band2: 16745, band3: 27139 },
    2027: { band1: 9662, band2: 16745, band3: 27139, provisional: true },
    sources: [SOURCES.pausal2026, SOURCES.pausal2027],
  },
  penalties: {
    max: 500_000,
    summary:
      "Za neodeslání datové zprávy nebo závažné maření evidence hrozí pokuta až 500 000 Kč. Uzavření provozovny jako sankce v EET 2.0 není.",
    sources: [SOURCES.pokuty],
  },
  mojeEet: {
    summary:
      "MOJE eet je bezplatná webová aplikace Finanční správy (od 1. 12. 2026): až 2 evidenční jednotky a přístup pro 2 zaměstnance, katalog zboží, PDF doklady, dvoufázové ověření při přihlášení. Pro provoz potřebuje připojení k internetu.",
    sources: [SOURCES.mojeEet, SOURCES.mojeEet2fa],
  },
} as const;

export function daysUntil(isoDate: string, now = new Date()): number {
  const target = new Date(`${isoDate}T00:00:00+01:00`).getTime();
  return Math.max(0, Math.ceil((target - now.getTime()) / 86_400_000));
}

export function formatKc(n: number): string {
  return `${new Intl.NumberFormat("cs-CZ").format(n)} Kč`;
}
