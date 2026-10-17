/** Hledání v katalogu: název, kategorie nebo kód / EAN (čtečka čárových kódů píše kód jako klávesnice) – S3-POKLADNA. */
export function catalogMatches(item: { name: string; category?: string | null; ean?: string | null }, q: string): boolean {
  const query = q.trim().toLocaleLowerCase("cs");
  if (!query) return true;
  return item.name.toLocaleLowerCase("cs").includes(query) || !!item.category?.toLocaleLowerCase("cs").includes(query) || (!!item.ean && item.ean.toLocaleLowerCase("cs") === query);
}
