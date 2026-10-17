import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RelatedGuides } from "@/components/related-guides";
import { ToolCta } from "@/components/tool-cta";
import { IcoValidator } from "@/components/tools/ico-validator";
import { ToolFaq } from "@/components/tools/tool-faq";
import { SOURCES } from "@/content/facts";
import { JsonLd, faqLd, howToLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S2 B1 (17. 10. 2026): ověření kontrolní číslice IČO – po vzoru konkurence (fakturujzdarma.cz/nastroje/ico-validator),
 * navíc s rozpisem výpočtu a návazností na kontrolu EET 2.0 (odkaz s IČO ve fragmentu, COMMON 9).
 */
export const metadata: Metadata = {
  title: "Ověření IČO zdarma: kontrolní číslice i s výpočtem",
  description:
    "Zkontrolujte, zda IČO má platnou kontrolní číslici, a podívejte se na výpočet krok za krokem. Platné IČO pak jedním klikem prověříte, zda se firmy týká EET 2.0.",
  ...canonicalMeta("/nastroje/overeni-ico"),
};

const STEPS = [
  { name: "Vynásobte číslice vahami", text: "Prvních sedm číslic IČO vynásobte postupně vahami 8, 7, 6, 5, 4, 3 a 2." },
  { name: "Sečtěte součiny", text: "Všech sedm součinů sečtěte." },
  { name: "Spočítejte zbytek po dělení 11", text: "Součet vydělte jedenácti a vezměte zbytek." },
  {
    name: "Určete kontrolní číslici",
    text: "Je-li zbytek 0, je kontrolní číslice 1; je-li zbytek 1, je kontrolní číslice 0; jinak je to 11 minus zbytek. Musí se rovnat osmé číslici IČO.",
  },
];

const FAQ = [
  {
    q: "Co ověření IČO prozradí?",
    a: "Jen to, zda má IČO správný tvar: osm číslic a sedící kontrolní číslici. Zda firma existuje, jak se jmenuje a zda se jí týká EET 2.0, ukáže až registr ARES – k tomu slouží naše kontrola IČO.",
  },
  {
    q: "Proč má IČO někdy méně než osm číslic?",
    a: "Starší IČO se někdy zapisují bez úvodních nul. Ověření je doplní zleva a počítá vždy s osmi číslicemi.",
  },
  {
    q: "Může IČO po zaniklé firmě dostat někdo jiný?",
    a: "Ne. Podle § 26 odst. 8 zákona o základních registrech smí mít každá osoba jen jedno IČO a jednou přidělené IČO nesmí dostat nikdo jiný, ani když osoba zanikla.",
  },
  {
    q: "Odesíláte IČO na server?",
    a: "Při ověření kontrolní číslice ne – počítá se jen ve vašem prohlížeči. Teprve když kliknete na „Týká se firmy EET 2.0?“, otevře se kontrola IČO, která se ptá registru ARES.",
  },
];

const FAQ_SOURCES = [SOURCES.zakladniRegistry, SOURCES.kdoMusi];

export default function IcoValidatorPage() {
  return (
    <>
      <JsonLd
        data={[
          howToLd({ name: "Jak ověřit kontrolní číslici IČO", description: "Výpočet kontrolní číslice IČO modulo 11 ve čtyřech krocích.", steps: STEPS }),
          faqLd(FAQ),
        ]}
      />
      <PageHeader
        title="Ověření IČO"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Ověření IČO", path: "/nastroje/overeni-ico" },
        ]}
        lead="Zadejte IČO a hned uvidíte, zda sedí kontrolní číslice – i s výpočtem. Platné IČO pak jedním klikem prověříte v kontrole EET 2.0 podle registru ARES."
      />
      <div className="container-page py-10">
        <IcoValidator />
        <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="jak-ico">
          <h2 id="jak-ico" className="text-2xl font-bold">
            Jak se kontrolní číslice IČO počítá
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            IČO má osm číslic a poslední z nich je kontrolní. Spočítá se z prvních sedmi takzvanou metodou modulo 11:
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-[17px] text-ink-soft">
            {STEPS.map((s) => (
              <li key={s.name}>{s.text}</li>
            ))}
          </ol>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
            Příklad pro IČO 12345679: 1×8 + 2×7 + 3×6 + 4×5 + 5×4 + 6×3 + 7×2 = 112. Zbytek po dělení 11 je 2, kontrolní číslice je 11 − 2 = 9 – a IČO
            opravdu končí devítkou. Máte víc IČO najednou? Použijte{" "}
            <Link href="/ucetni/hromadna-kontrola" className="font-medium text-brand-700 underline underline-offset-4">
              hromadnou kontrolu IČO
            </Link>
            .
          </p>
        </section>
        <ToolFaq items={FAQ} sources={FAQ_SOURCES} />
        <RelatedGuides slugs={["koho-se-eet-tyka", "eet-2-0-kompletni-pruvodce", "jak-aktivovat-dis-a-certifikat"]} className="mx-auto mt-14 max-w-5xl" />
        <ToolCta />
      </div>
    </>
  );
}
