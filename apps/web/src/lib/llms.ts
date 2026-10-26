import { isClosed } from "@/lib/launch";
import { plainText } from "@/components/rich-text";
import { FACTS, FACTS_UPDATED, TIMELINE } from "@/content/facts";
import { GUIDES, guideModified, isIndexable } from "@/content/guides";
import { MYTHS, MYTHS_UPDATED } from "@/content/myths";
import type { Block, Guide } from "@/content/guides/types";
import { OPERATOR, SITE, absoluteUrl, REVIEWER } from "./site";
import { STATIC_PAGES } from "./static-pages";
import { SETUP_SERVICE } from "@/content/services";
import { OBOR_LANDINGS, landingPath } from "@/content/obor-landings";
import { reviewedMoneyPaths } from "./money-review";

/** S2 B1: kalkulačky a ověření v llms.txt */
const CALC_TOOLS = [
  "/nastroje/overeni-ico",
  "/nastroje/overeni-dic",
  "/nastroje/overeni-iban",
  "/nastroje/ucet-na-iban",
  "/nastroje/datum-splatnosti",
  "/kalkulacka-dph",
  "/kalkulacka-urok-z-prodleni",
];

function indexedGuides() {
  return GUIDES.filter(isIndexable);
}

function factsSection(): string {
  return [
    "## Klíčová fakta o EET 2.0",
    "",
    `- ${FACTS.law.name} – ${FACTS.law.printNo}, podepsán ${FACTS.law.signedOn}, účinnost od ${FACTS.law.effectiveFrom}.`,
    ...TIMELINE.map((t) => `- ${t.dateLabel}: ${t.title}. ${t.action}`),
    `- ${FACTS.pilot.summary}`,
    `- ${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}`,
    `- ${FACTS.whoMust.summary} ${FACTS.whoMust.exemptions}`,
    `- ${FACTS.whoMust.occasional}`,
    `- ${FACTS.offline.summary} ${FACTS.offline.responseTimeout}`,
    `- ${FACTS.receipt.summary}`,
    `- ${FACTS.confirmation.summary} ${FACTS.confirmation.onReceipt}`,
    `- ${FACTS.units.summary} ${FACTS.units.allUnits} ${FACTS.units.change}`,
    `- ${FACTS.certificate.summary}`,
    `- ${FACTS.eetOff.summary} ${FACTS.eetOff.howTo} ${FACTS.eetOff.naturalOnly} ${FACTS.eetOff.binding} ${FACTS.eetOff.midYear} ${FACTS.eetOff.overLimit} ${FACTS.eetOff.exit}`,
    `- ${FACTS.taxCredit.summary}`,
    `- ${FACTS.penalties.summary}`,
    `- ${FACTS.mojeEet.summary}`,
    "",
    `Fakta ověřena k ${FACTS_UPDATED}. Oficiální zdroj: https://eet.gov.cz`,
  ].join("\n");
}

/** S3: sekce „Katalog firem“ – jen když je katalog veřejný (lib/launch.ts). Statický text, bez dotazu do DB. */
function catalogSection(): string[] {
  if (isClosed("/firmy")) return [];
  return [
    "## Katalog firem",
    "",
    `- [Katalog firem v Karlovarském kraji](${absoluteUrl("/firmy")}): firmy z veřejných registrů ARES (Ministerstvo financí) a RES ČSÚ – IČO, DIČ (jen u právnických osob), plátce DPH, právní forma, datum vzniku, sídlo, obory CZ-NACE, provozovny firem a orientační odhad, zda se subjektu týká EET 2.0 (podle oboru; rozhoduje způsob placení). U každé stránky je datum ověření v ARES a odkaz na oficiální záznam.`,
    `- Firmu podle IČO otevřete na adrese /firma/<IČO>, např. ${absoluteUrl("/firma/22269134")} (přesměruje na stránku subjektu; firmu mimo katalog načte živě z ARES). Vyhledávání podle názvu: ${absoluteUrl("/firmy")} (jen firmy, ne OSVČ).`,
    `- Seznamy: kraj ${absoluteUrl("/firmy/kraj/karlovarsky")}, obce /firmy/obec/<kód obce>-<název>, obor × obec /obor/<obor>/obec/<kód obce>-<název> (např. ${absoluteUrl("/obor/kadernictvi-a-kosmetika/kraj/karlovarsky")}).`,
    "- Podnikající fyzické osoby (OSVČ) mají jen základní údaje a obec – bez adresy, DIČ a provozoven; jejich stránky nejsou ve vyhledávačích a v seznamech jsou jen počtem. Zaniklé subjekty v seznamech nejsou, jejich stránka po 90 dnech zmizí.",
    "- Pro AI asistenty: MCP nástroj eet_check_ico vrací k IČO odhad EET 2.0 a odkaz catalog_url na stránku v katalogu.",
    `- Námitka a oprava údajů: ${absoluteUrl("/namitka")}`,
    "",
  ];
}

export function llmsTxt(): string {
  return [
    `# ${SITE.name}`,
    "",
    // dokud je pokladna za heslem, AI asistenti nesmí o ní mluvit jako o dostupné (R7.6)
    isClosed("/pokladna")
      ? `> EvidujZdarma připravuje bezplatnou pokladnu pro EET 2.0. Pokladnu právě spouštíme; zatím je otevřená předregistrace. ${SITE.independenceNotice} Provozovatel: ${OPERATOR.name}.`
      : `> ${SITE.name} (${SITE.domain}) je bezplatná pokladna pro evidenci tržeb EET 2.0 v České republice: funguje i bez signálu (dodatečné odeslání do 48 hodin), až 5 uživatelů a 3 evidenční jednotky zdarma, účtenka e-mailem a QR kódem (SMS připravujeme), export CSV pro účetní. ${SITE.independenceNotice} Provozovatel: ${OPERATOR.name}.`,
    "",
    factsSection(),
    "",
    "## Nástroje (zdarma, bez registrace)",
    "",
    ...STATIC_PAGES.filter((p) => ["/kontrola-ico", "/musim-evidovat", "/kalkulacka-eet-off", "/evidencni-jednotky", "/qr-platba", "/doklad-o-prodeji", "/checklist-eet", "/ucetni/hromadna-kontrola"].includes(p.path)).map(
      (p) => `- [${p.title}](${absoluteUrl(p.path)})`,
    ),
    ...STATIC_PAGES.filter((p) => p.path === "/faktura-zdarma").map((p) => `- [${p.title}](${absoluteUrl(p.path)}): plátce i neplátce DPH, zálohová faktura, QR platba; nic se neukládá. Předvyplnění odběratele: ${absoluteUrl("/faktura-zdarma")}#odberatel=<IČO>.`),
    // S2 B1: kalkulačky a ověření (vše v prohlížeči, nic se neodesílá)
    ...STATIC_PAGES.filter((p) => CALC_TOOLS.includes(p.path)).map((p) => `- [${p.title}](${absoluteUrl(p.path)})`),
    // S2/B2: peněžní kalkulačky až po kontrole účetní (lib/money-review.ts; zkontrolované 17. 10. 2026)
    ...STATIC_PAGES.filter((p) => reviewedMoneyPaths().includes(p.path)).map((p) => `- [${p.title}](${absoluteUrl(p.path)})`),
    // S3-OPEN: vzor pověření (§ 10) po kontrole účetní 17. 10. 2026
    ...STATIC_PAGES.filter((p) => p.path === "/vzor-povereni").map((p) => `- [${p.title}](${absoluteUrl(p.path)}): pověření podle § 10 zákona o evidenci tržeb – kdo za koho eviduje, v jakém rozsahu a odkdy; text se skládá v prohlížeči, na server se nic neodesílá.`),
    "",
    // S3: katalog firem (otevřený s testem oprávněného zájmu; OSVČ jen základní údaje a noindex)
    ...catalogSection(),
    "## Návody",
    "",
    // jen návody po odborné revizi – nerevidované mají noindex a nemají jít ani do AI (R2.9)
    ...indexedGuides().map((g) => `- [${g.h1 ?? g.title}](${absoluteUrl(`/navody/${g.slug}`)}): ${g.description}`),
    "",
    // S4: stránky pro obory – rychlá kontrola (fakta z revidovaných návodů) a pokladna pro obor
    "## EET pro obory",
    "",
    ...OBOR_LANDINGS.map((l) => `- [${l.h1}](${absoluteUrl(landingPath(l))}): ${l.description()}`),
    "",
    "## Služba",
    "",
    `- [Co se o EET 2.0 píše špatně](${absoluteUrl("/co-se-o-eet-pise-spatne")}): tvrzení, která neodpovídají schválenému zákonu (výjimka 50 000 Kč, evidence až od února, sleva 5 000 Kč pro každého), se zdroji a datem stavu.`,
    `- [Je EET dole? Stav systému evidence tržeb](${absoluteUrl("/stav-eet")}): nezávislé měření dostupnosti rozhraní EET každých 5 minut, historie výpadků; strojově na ${absoluteUrl("/api/stav-eet")}.`,
    `- [MCP server pro AI asistenty](${absoluteUrl("/mcp")}): veřejný MCP server (Streamable HTTP, bez přihlášení) na ${absoluteUrl("/api/mcp")} – nástroje eet_check_ico, eet_calculate_eet_off, eet_classify_payment, eet_get_facts, eet_list_misconceptions, eet_search_guides, eet_get_guide, eet_get_fs_status.`,
    `- [Srovnání s MOJE eet](${absoluteUrl("/srovnani/moje-eet")})`,
    `- [Přechod z jiné pokladny](${absoluteUrl("/prechod-z-jine-pokladny")}): ceny základních tarifů pokladen s evidencí tržeb podle ceníků výrobců (s datem a zdroji), kalkulačka ročních nákladů a postup přechodu včetně importu zboží z CSV.`,
    `- [Ukázka pokladny bez registrace](${absoluteUrl("/ukazka")}): prodej, platba a účtenka v prohlížeči; nic se neukládá ani neodesílá.`,
    // S2-A / S3-OPEN: nápověda k pokladně je veřejná už před otevřením pokladny; do 2. 11. popisuje, jak pokladna bude fungovat (R7.6)
    isClosed("/pokladna")
      ? `- [Nápověda k pokladně](${absoluteUrl("/napoveda")}): jak bude v pokladně EvidujZdarma (spouštíme ji 2. 11. 2026) fungovat nastavení firmy, certifikátu a jednotek, prodej, účtenka, vratka, uzávěrka a export pro účetní.`
      : `- [Nápověda k pokladně](${absoluteUrl("/napoveda")}): jak v pokladně EvidujZdarma nastavit firmu, certifikát a jednotky, prodávat, vydat účtenku, udělat vratku a uzávěrku a stáhnout export pro účetní.`,
    `- [Všechny návody](${absoluteUrl("/navody")}) a [všechny nástroje](${absoluteUrl("/nastroje")})`,
    `- [O nás a odborná revize](${absoluteUrl("/o-nas")}): kdo web provozuje, jak ověřujeme fakta a kdo návody reviduje.`,
    `- [Ceník](${absoluteUrl("/cenik")}): evidence tržeb zdarma navždy; Premium 149 Kč/měsíc.`,
    // S5-SLUŽBY
    `- [Nastavení EET na klíč](${absoluteUrl("/nastaveni-na-klic")}): placená technická pomoc (${SETUP_SERVICE.priceLabel}, platí se po dokončení) – postup na míru pro DIS+ a pokladní certifikát, kontrola a nastavení pokladny; písemně e-mailem. Daňové poradenství (EET ON/OFF) neposkytujeme.`,
    `- [Pro účetní](${absoluteUrl("/ucetni")})`,
    `- [Kompletní text návodů pro AI](${absoluteUrl("/llms-full.txt")})`,
    "",
  ].join("\n");
}

function blockText(b: Block): string {
  if ("p" in b) return plainText(b.p);
  if ("h3" in b) return `### ${plainText(b.h3)}`;
  if ("ul" in b) return b.ul.map((li) => `- ${plainText(li)}`).join("\n");
  if ("ol" in b) return b.ol.map((li, i) => `${i + 1}. ${plainText(li)}`).join("\n");
  if ("table" in b) return [b.table.head.map(plainText).join(" | "), ...b.table.rows.map((r) => r.map(plainText).join(" | "))].join("\n");
  if ("note" in b) return `> ${plainText(b.note)}`;
  if ("quote" in b) return `> „${plainText(b.quote)}“ — ${b.cite}`;
  return "";
}

export function guideText(g: Guide): string {
  return [
    `# ${g.h1 ?? g.title}`,
    // poslední změna stránky (i revize), stejně jako sitemap a JSON-LD (R10.3 M1)
    `URL: ${absoluteUrl(`/navody/${g.slug}`)} · Aktualizováno: ${guideModified(g)}${g.reviewedBy ? ` · Odborná revize: ${g.reviewedBy === REVIEWER.name ? `${REVIEWER.name}, ${REVIEWER.title}` : g.reviewedBy}` : ""}`,
    "",
    plainText(g.lead),
    "",
    "Stručně:",
    ...g.summary.map((s) => `- ${plainText(s)}`),
    "",
    ...g.sections.flatMap((s) => [`## ${s.heading}`, "", ...s.blocks.map(blockText).filter(Boolean), ""]),
    ...(g.faq?.length ? ["## Časté otázky", "", ...g.faq.flatMap((f) => [`**${f.q}** ${plainText(f.a)}`, ""])] : []),
    "Zdroje: " + g.sources.map((s) => `${s.label} (${s.url})`).join("; "),
  ].join("\n");
}

function mythsText(): string {
  return [
    "# Co se o EET 2.0 píše špatně",
    "",
    `URL: ${absoluteUrl("/co-se-o-eet-pise-spatne")} · Aktualizováno: ${MYTHS_UPDATED}`,
    "",
    ...MYTHS.flatMap((m) => [
      `## ${m.question}`,
      "",
      `Píše se: ${m.claim}`,
      `Co platí (stav k ${m.asOf}): ${m.truth}`,
      ...(m.comment ? [`Náš názor: ${m.comment}`] : []),
      `Zdroje: ${m.sources.map((x) => x.url).join(", ")}`,
      "",
    ]),
  ].join("\n");
}

export function llmsFullTxt(): string {
  return [llmsTxt(), "---", "", mythsText(), "", "---", "", ...indexedGuides().map(guideText).flatMap((t) => [t, "", "---", ""])].join("\n");
}
