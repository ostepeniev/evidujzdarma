/** Vyhledávání v katalogu — obyčejný GET formulář (funguje i bez JavaScriptu). */
export function CatalogSearch({ initial = "", size = "md" }: { initial?: string; size?: "md" | "lg" }) {
  return (
    <form action="/firmy" method="get" role="search" className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="catalog-q" className="sr-only">
        IČO nebo název firmy
      </label>
      <input
        id="catalog-q"
        name="q"
        type="search"
        defaultValue={initial}
        placeholder="IČO nebo název firmy"
        autoComplete="off"
        minLength={2}
        maxLength={100}
        required
        className={`input ${size === "lg" ? "py-4 text-lg" : ""}`}
      />
      <button type="submit" className="btn-primary shrink-0">
        Hledat
      </button>
    </form>
  );
}
