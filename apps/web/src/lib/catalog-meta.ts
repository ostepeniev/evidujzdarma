/**
 * S3 – title a meta description šablon katalogu v délkách, které vyhledávače zobrazí celé:
 * title ≤ 60 znaků (včetně „| EvidujZdarma“, vejde-li se), description 140–160 znaků.
 * Kořenový layout má šablonu „%s | EvidujZdarma“ – katalog proto vrací `{ absolute }` a značku přidá sám, jen když se vejde.
 */

export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 140;
export const DESCRIPTION_MAX = 160;
const BRAND = " | EvidujZdarma";

/** Zkrátí text na `max` znaků po celých slovech a přidá „…“. */
export function truncateWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

/**
 * Title ≤ 60 znaků. `variants` = od nejpopisnější po nejkratší („Kadeřnictví a kosmetika Karlovy Vary – firmy a EET 2.0“,
 * „… – EET 2.0“, „…“). Vyhraje první varianta, která se vejde (klíčová slova mají přednost před značkou); značka
 * „| EvidujZdarma“ se přidá, jen když se vejde i s ní. Nevejde-li se žádná, zkrátí se poslední po slovech.
 */
export function fitTitle(variants: readonly string[]): { absolute: string } {
  const clean = variants.map((v) => v.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (const v of clean) {
    if (v.length + BRAND.length <= TITLE_MAX) return { absolute: v + BRAND };
    if (v.length <= TITLE_MAX) return { absolute: v };
  }
  return { absolute: truncateWords(clean[clean.length - 1] ?? "", TITLE_MAX) };
}

/** Obecné věty pravdivé pro každou stránku katalogu – doplní description, když šablona nestačí na 140 znaků. */
const CATALOG_FILL = ["Jen veřejné údaje z registrů.", "Zdarma a bez registrace.", "Nezávislá služba EvidujZdarma.cz.", "Údaje z ARES.", "Bez reklam."];

/**
 * Description 140–160 znaků: věty z `parts` se přidávají, dokud se vejdou do 160; je-li text kratší než 140, doplní se
 * věty z `fill` (obecné, pravdivé pro celou šablonu) a pak z CATALOG_FILL. První věta delší než 160 se zkrátí po slovech.
 */
export function fitDescription(parts: readonly string[], fill: readonly string[] = []): string {
  const sentences = parts.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (sentences.length === 0) return "";
  let out = sentences[0]!.length > DESCRIPTION_MAX ? truncateWords(sentences[0]!, DESCRIPTION_MAX) : sentences[0]!;
  for (const s of sentences.slice(1)) {
    const next = `${out} ${s}`;
    if (next.length <= DESCRIPTION_MAX) out = next;
  }
  for (const s of [...fill, ...CATALOG_FILL]) {
    if (out.length >= DESCRIPTION_MIN) break;
    if (out.includes(s)) continue;
    const next = `${out} ${s}`;
    if (next.length <= DESCRIPTION_MAX) out = next;
  }
  return out;
}
