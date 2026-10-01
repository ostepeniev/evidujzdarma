import Link from "next/link";

/** Každý nástroj končí výzvou k akci (princip: každá stránka vede k akci). */
export function ToolCta({ title = "Začněte evidovat zdarma", text }: { title?: string; text?: string }) {
  return (
    <aside className="mt-12 rounded-2xl bg-brand-700 p-8 text-white sm:p-10">
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-lg text-brand-100">
        {text ?? "Pokladna pro EET 2.0 zdarma navždy: funguje i bez signálu, až 5 uživatelů, účtenka e-mailem i QR."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/#registrace" className="btn bg-white text-brand-700 hover:bg-brand-50">
          Začít evidovat zdarma
        </Link>
        <Link href="/kontrola-ico" className="btn border border-brand-200/40 text-white hover:bg-brand-600">
          Zkontrolovat IČO
        </Link>
      </div>
    </aside>
  );
}
