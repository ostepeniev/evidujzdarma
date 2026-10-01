/** URL slug without diacritics: "Kadeřnictví Šárka s.r.o." -> "kadernictvi-sarka-s-r-o" */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " a ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  return slug.slice(0, maxLength).replace(/-[^-]*$/, "") || slug.slice(0, maxLength);
}
