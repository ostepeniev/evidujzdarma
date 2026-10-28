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
  if ("quote" in block)
    return (
      <figure className="my-8 border-l-4 border-brand-500 pl-5">
        <blockquote className="m-0 text-lg italic text-ink">
          <RichText text={block.quote} />
        </blockquote>
        <figcaption className="mt-2 text-base text-ink-soft">— {block.cite}</figcaption>
      </figure>
    );
  // S7-VIZ: vizuální bloky – velká čísla, časová osa, příběh po hodinách, podmínky „+“
  if ("stats" in block)
    return (
      <div className={`not-prose my-8 grid gap-4 ${block.stats.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`} data-block="stats">
        {block.stats.map((x, i) => (
          <div key={i} className="rounded-2xl bg-brand-900 p-6 text-white shadow-sm">
            <p className="m-0 text-4xl font-extrabold tracking-tight text-sun-300 sm:text-5xl">{x.value}</p>
            <p className="m-0 mt-2 text-base font-semibold leading-snug">
              <RichText text={x.label} />
            </p>
            {x.note && (
              <p className="m-0 mt-1 text-sm leading-snug text-brand-100">
                <RichText text={x.note} />
              </p>
            )}
          </div>
        ))}
      </div>
    );
  if ("timeline" in block)
    return (
      <ol className="not-prose relative my-8 ml-3 list-none border-l-4 border-sun-300 p-0" data-block="timeline">
        {block.timeline.map((x, i) => (
          <li key={i} className="relative mb-6 pl-7 last:mb-0">
            <span aria-hidden="true" className="absolute -left-[16px] top-1 h-7 w-7 rounded-full border-4 border-white bg-sun-500" />
            <p className="m-0 text-lg font-extrabold text-brand-700">{x.date}</p>
            <p className="m-0 text-base font-semibold text-ink">
              <RichText text={x.title} />
            </p>
            {x.text && (
              <p className="m-0 mt-1 text-base text-ink-soft">
                <RichText text={x.text} />
              </p>
            )}
          </li>
        ))}
      </ol>
    );
  if ("story" in block)
    return (
      <div className="not-prose my-8 space-y-4" data-block="story">
        {block.story.map((x, i) => (
          <div key={i} className="flex gap-4">
            <span className="h-fit shrink-0 rounded-xl bg-ink px-3 py-2 font-mono text-base font-bold text-sun-300">{x.time}</span>
            <div className="flex-1 rounded-2xl border border-line bg-white p-5 shadow-sm">
              <p className="m-0 text-lg font-bold text-ink">
                <RichText text={x.title} />
              </p>
              <p className="m-0 mt-2 text-base leading-relaxed text-ink-soft">
                <RichText text={x.text} />
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  if ("conditions" in block)
    return (
      <div className="not-prose my-8 flex flex-col items-stretch gap-3 sm:flex-row" data-block="conditions">
        {block.conditions.map((x, i) => (
          <div key={i} className="contents">
            {i > 0 && (
              <span aria-hidden="true" className="flex items-center justify-center text-3xl font-extrabold text-sun-500">
                +
              </span>
            )}
            <div className="flex-1 rounded-2xl border-2 border-brand-200 bg-brand-50 p-5">
              <p className="m-0 text-sm font-bold uppercase tracking-wide text-brand-700">{i + 1}.</p>
              <p className="m-0 mt-1 text-lg font-bold text-ink">
                <RichText text={x.title} />
              </p>
              <p className="m-0 mt-2 text-base text-ink-soft">
                <RichText text={x.text} />
              </p>
            </div>
          </div>
        ))}
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
