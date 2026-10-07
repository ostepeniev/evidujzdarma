import Link from "next/link";
import type { Block } from "@/content/guides/types";
import { isClosed } from "@/lib/launch";
import { RichText } from "./rich-text";

const CTAS = {
  // dokud je pokladna zavřená, nesmí CTA tvrdit, že už funguje (рецензія №7, B-I5)
  registrace: isClosed("/pokladna")
    ? { text: "Pokladnu pro EET 2.0 zdarma připravujeme – bude fungovat i bez signálu.", href: "/#registrace", label: "Předregistrovat zdarma" }
    : { text: "Pokladna pro EET 2.0 zdarma – funguje i bez signálu.", href: "/#registrace", label: "Začít evidovat zdarma" },
  "kontrola-ico": { text: "Týká se vás EET? Zjistěte to podle IČO za 10 vteřin.", href: "/kontrola-ico", label: "Zkontrolovat IČO" },
  "eet-off": { text: "Vyplatí se vám přirážka místo evidence?", href: "/kalkulacka-eet-off", label: "Spočítat EET OFF" },
  jednotky: { text: "Které evidenční jednotky oznámit v DIS+?", href: "/evidencni-jednotky", label: "Spustit průvodce" },
  qr: { text: "QR kód pro platbu na účet během pár sekund.", href: "/qr-platba", label: "Vytvořit QR platbu" },
  kviz: { text: "Musíte evidovat? Odpovězte na 6 otázek.", href: "/musim-evidovat", label: "Spustit kvíz" },
} as const;

export function GuideBlock({ block }: { block: Block }) {
  if ("p" in block)
    return (
      <p>
        <RichText text={block.p} />
      </p>
    );
  if ("h3" in block)
    return (
      <h3>
        <RichText text={block.h3} />
      </h3>
    );
  if ("ul" in block)
    return (
      <ul>
        {block.ul.map((li, i) => (
          <li key={i}>
            <RichText text={li} />
          </li>
        ))}
      </ul>
    );
  if ("ol" in block)
    return (
      <ol>
        {block.ol.map((li, i) => (
          <li key={i}>
            <RichText text={li} />
          </li>
        ))}
      </ol>
    );
  if ("table" in block)
    return (
      <div className="overflow-x-auto">
        <table>
          {block.table.caption && <caption className="mb-2 text-left text-sm text-muted">{block.table.caption}</caption>}
          <thead>
            <tr>
              {block.table.head.map((h, i) => (
                <th key={i} scope="col">
                  <RichText text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <RichText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if ("note" in block)
    return (
      <div className={`my-6 rounded-xl border-l-4 px-5 py-4 text-base ${block.tone === "warn" ? "border-sun-500 bg-warn-50 text-ink" : "border-brand-500 bg-brand-50 text-ink"}`}>
        <RichText text={block.note} />
      </div>
    );
  const cta = CTAS[block.cta];
  return (
    <div className="not-prose my-8 flex flex-col items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 text-base font-medium text-ink">{cta.text}</p>
      <Link href={cta.href} className="btn-primary shrink-0 no-underline">
        {cta.label}
      </Link>
    </div>
  );
}
