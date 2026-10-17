import { personsCountText } from "@/lib/catalog-summary";
import { IconUser } from "./icons";

/**
 * OSVČ v seznamech jen počtem (rozhodnutí majitele, S3; LIA): „a dalších 37 živnostníků – najděte se podle IČO“
 * a políčko pro IČO. Formulář vede na /firmy?q= (výsledky noindex, robots.txt je zakazuje); platné IČO přesměruje
 * na stránku subjektu.
 */
export function PersonsNote({ count, withOthers, id = "osvc" }: { count: number; withOthers: boolean; id?: string }) {
  if (count <= 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface p-5" aria-labelledby={`${id}-h`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-white p-2 text-brand-700 ring-1 ring-line">
          <IconUser />
        </span>
        <div className="min-w-0 flex-1">
          <p id={`${id}-h`} className="font-semibold text-ink">
            {personsCountText(count, withOthers)}
          </p>
          <p className="mt-1 text-[15px] text-ink-soft">
            Podnikající fyzické osoby (OSVČ) v seznamech jmenovitě neuvádíme. Svou stránku najdete podle IČO.
          </p>
          <form action="/firmy" method="get" role="search" className="mt-3 flex max-w-md gap-2">
            <label htmlFor={`${id}-ico`} className="sr-only">
              IČO
            </label>
            <input
              id={`${id}-ico`}
              name="q"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9 ]{6,10}"
              maxLength={10}
              placeholder="IČO (8 číslic)"
              required
              className="input py-2"
            />
            <button type="submit" className="btn-primary shrink-0 px-4 py-2">
              Najít
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
