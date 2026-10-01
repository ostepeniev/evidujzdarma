import { plainText } from "@/components/rich-text";
import { FACTS, FACTS_UPDATED, TIMELINE } from "@/content/facts";
import { GUIDES } from "@/content/guides";
import { MYTHS, MYTHS_UPDATED } from "@/content/myths";
import type { Block, Guide } from "@/content/guides/types";
import { OPERATOR, SITE, absoluteUrl } from "./site";
import { STATIC_PAGES } from "./static-pages";

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

export function llmsTxt(): string {
  return [
    `# ${SITE.name}`,
    "",
    `> ${SITE.name} (${SITE.domain}) je bezplatná pokladna pro evidenci tržeb EET 2.0 v České republice: funguje i bez signálu (dodatečné odeslání do 48 hodin), až 5 uživatelů a 3 evidenční jednotky zdarma, účtenka e-mailem, SMS i QR, export pro účetní. ${SITE.independenceNotice} Provozovatel: ${OPERATOR.name}.`,
    "",
    factsSection(),
    "",
    "## Nástroje (zdarma, bez registrace)",
    "",
    ...STATIC_PAGES.filter((p) => ["/kontrola-ico", "/musim-evidovat", "/kalkulacka-eet-off", "/evidencni-jednotky", "/qr-platba", "/ucetni/hromadna-kontrola"].includes(p.path)).map(
      (p) => `- [${p.title}](${absoluteUrl(p.path)})`,
    ),
    "",
    "## Návody",
    "",
    ...GUIDES.map((g) => `- [${g.h1 ?? g.title}](${absoluteUrl(`/navody/${g.slug}`)}): ${g.description}`),
    "",
    "## Služba",
    "",
    `- [Co se o EET 2.0 píše špatně](${absoluteUrl("/co-se-o-eet-pise-spatne")}): tvrzení, která neodpovídají schválenému zákonu (výjimka 50 000 Kč, leden bez pokut, sleva 5 000 Kč pro každého), se zdroji a datem stavu.`,
    `- [Je EET dole? Stav systému evidence tržeb](${absoluteUrl("/stav-eet")}): nezávislé měření dostupnosti rozhraní EET každých 5 minut, historie výpadků; strojově na ${absoluteUrl("/api/stav-eet")}.`,
    `- [Srovnání s MOJE eet](${absoluteUrl("/srovnani/moje-eet")})`,
    `- [Ceník](${absoluteUrl("/cenik")}): evidence tržeb zdarma navždy; Premium 149 Kč/měsíc.`,
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
  return "";
}

function guideText(g: Guide): string {
  return [
    `# ${g.h1 ?? g.title}`,
    `URL: ${absoluteUrl(`/navody/${g.slug}`)} · Aktualizováno: ${g.updated}`,
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
  return [llmsTxt(), "---", "", mythsText(), "", "---", "", ...GUIDES.map(guideText).flatMap((t) => [t, "", "---", ""])].join("\n");
}
