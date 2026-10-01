import { plainText } from "@/components/rich-text";
import { FACTS, FACTS_UPDATED, TIMELINE } from "@/content/facts";
import { GUIDES } from "@/content/guides";
import type { Block, Guide } from "@/content/guides/types";
import { OPERATOR, SITE, absoluteUrl } from "./site";
import { STATIC_PAGES } from "./static-pages";

function factsSection(): string {
  return [
    "## Klíčová fakta o EET 2.0",
    "",
    `- ${FACTS.law.name} – ${FACTS.law.printNo}, podepsán ${FACTS.law.signedOn}, účinnost od ${FACTS.law.effectiveFrom}.`,
    ...TIMELINE.map((t) => `- ${t.dateLabel}: ${t.title}. ${t.action}`),
    `- ${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}`,
    `- ${FACTS.whoMust.summary} ${FACTS.whoMust.exemptions}`,
    `- ${FACTS.offline.summary}`,
    `- ${FACTS.receipt.summary}`,
    `- ${FACTS.units.summary} ${FACTS.units.change}`,
    `- ${FACTS.certificate.summary}`,
    `- ${FACTS.eetOff.summary} ${FACTS.eetOff.howTo}`,
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

export function llmsFullTxt(): string {
  return [llmsTxt(), "---", "", ...GUIDES.map(guideText).flatMap((t) => [t, "", "---", ""])].join("\n");
}
