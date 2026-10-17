import { ExternalLink } from "@/components/external-link";
import { Faq, type FaqItem } from "@/components/faq";
import type { Source } from "@/content/facts";

/** S2 B1: FAQ nástroje se seznamem zdrojů pod ním (stejně jako /qr-platba a /doklad-o-prodeji). */
export function ToolFaq({ items, sources, className = "mx-auto mt-14 max-w-3xl" }: { items: readonly FaqItem[]; sources: readonly Source[]; className?: string }) {
  return (
    <section className={className}>
      <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
      <Faq items={items} />
      <p className="mt-3 text-base text-muted">
        Zdroje:{" "}
        {sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <ExternalLink href={s.url}>{s.label}</ExternalLink>
          </span>
        ))}
      </p>
    </section>
  );
}
