import type { Metadata } from "next";
import Link from "next/link";
import { DemoPos } from "@/components/demo/demo-pos";
import { RelatedGuides } from "@/components/related-guides";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { SERVICE_COPY } from "@/lib/site";

/** Ukázka pokladny bez registrace (R17.5) – dostupná hned, nečeká na otevření pokladny. Texty doslovně. */
export const metadata: Metadata = {
  // S1: v titulku i „EET 2.0“ a „zdarma“ – tak se hledá
  title: { absolute: "Ukázka pokladny pro EET 2.0 zdarma – bez registrace" },
  description: "Vyzkoušejte si pokladnu EvidujZdarma pro EET 2.0 bez registrace: zboží, platba hotově nebo kartou a účtenka. Nic se neukládá ani neodesílá.",
  ...canonicalMeta("/ukazka"),
};

export default function DemoPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Úvod", path: "/" }, { name: "Ukázka pokladny", path: "/ukazka" }])} />
      <div className="border-b border-sun-200 bg-sun-100 py-2 text-center text-[15px] font-semibold text-warn-700" role="note">
        Ukázka. Nic se neukládá ani neodesílá Finanční správě.
      </div>
      <div className="container-page py-8">
        <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">Vyzkoušejte si pokladnu bez registrace</h1>
        <DemoPos />
        <div className="mt-8 flex justify-center">
          <Link href={SERVICE_COPY.startCta.href} className="btn-primary px-6 py-3 text-lg">
            {SERVICE_COPY.startCta.label}
          </Link>
        </div>
        <section className="prose-ez mx-auto mt-14 max-w-3xl" aria-labelledby="jak-funguje">
          <h2 id="jak-funguje">Jak ukázka funguje</h2>
          <p>
            Naťukejte zboží nebo zadejte částku, zvolte platbu hotově nebo kartou a pokladna ukáže účtenku. Tak bude vypadat prodej v pokladně EvidujZdarma –
            v mobilu, tabletu i počítači. V ukázce se nic neukládá a nic se neodesílá Finanční správě, proto na účtence chybí potvrzovací kód POK.
          </p>
          <p>
            Ve skutečné pokladně se každá tržba podepíše vaším pokladním certifikátem a odešle do systému EET 2.0. Když nejde signál, prodáváte dál a pokladna
            tržbu doposílá sama, nejpozději do 48 hodin. Porovnání se státní aplikací najdete v článku{" "}
            <Link href="/srovnani/moje-eet">EvidujZdarma vs. MOJE eet</Link>, ceny doplňků na stránce <Link href="/cenik">Ceník</Link>.
          </p>
        </section>
        <RelatedGuides
          slugs={["eet-bez-internetu", "kontaktni-platba", "musim-vydavat-uctenku"]}
          title="Návody k EET 2.0"
          className="mx-auto mt-14 max-w-5xl"
        />
      </div>
    </>
  );
}
