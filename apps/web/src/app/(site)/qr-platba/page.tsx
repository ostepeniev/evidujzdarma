import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { QrGenerator } from "@/components/qr-generator";
import { ToolCta } from "@/components/tool-cta";
import { SOURCES } from "@/content/facts";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { ExternalLink } from "@/components/external-link";

export const metadata: Metadata = {
  title: "Generátor QR platby zdarma (SPAYD)",
  description:
    "Vytvořte QR kód pro platbu na účet během pár sekund. Formát QR Platba (SPAYD) čtou všechny české bankovní aplikace. Zdarma, bez registrace, data neopouštějí váš prohlížeč.",
  alternates: { canonical: "/qr-platba" },
};

const FAQ = [
  {
    q: "Je QR platba tržbou, kterou musím evidovat v EET 2.0?",
    a: "Ano, pokud vám zákazník zaplatí QR kódem při osobním kontaktu – v provozovně, u stánku nebo u vás na místě. Podle Ministerstva financí a eet.gov.cz se taková platba eviduje stejně jako hotovost nebo karta. Neeviduje se platba na dálku, například přes QR kód na webu e-shopu nebo úhrada faktury převodem. Bankovní převod, který zákazník odešle na místě bez QR kódu, oficiální zdroje zatím jednoznačně neřeší.",
  },
  {
    q: "Jaký formát QR kódu generátor používá?",
    a: "Standard QR Platba (Short Payment Descriptor, SPAYD) České bankovní asociace. Kód obsahuje IBAN, částku, měnu CZK, variabilní symbol a zprávu pro příjemce.",
  },
  {
    q: "Ukládáte číslo mého účtu?",
    a: "Ne. QR kód se vytváří přímo ve vašem prohlížeči, údaje se na náš server neodesílají.",
  },
  {
    q: "Proč se diakritika ve zprávě ztratí?",
    a: "Některé starší bankovní aplikace diakritiku v QR platbě zobrazují chybně, proto ji pro jistotu odstraňujeme. Zpráva může mít nejvýše 60 znaků, jméno příjemce 35 znaků.",
  },
];

/** Zdroje k odpovědi o evidenci QR platby. */
const FAQ_SOURCES = [SOURCES.kdoMusi, SOURCES.mfPredstavuje];

export default function QrPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Generátor QR platby"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "QR platba", path: "/qr-platba" },
        ]}
        lead="Zadejte číslo účtu a částku – zákazník QR kód naskenuje v bankovní aplikaci a platba je vyplněná. Funguje se všemi českými bankami, zdarma a bez registrace."
      />
      <div className="container-page py-10">
        <QrGenerator />
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
          <p className="mt-3 text-base text-muted">
            Zdroje:{" "}
            {FAQ_SOURCES.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <ExternalLink href={s.url}>
                  {s.label}
                </ExternalLink>
              </span>
            ))}
          </p>
        </section>
        <ToolCta text="V pokladně EvidujZdarma se QR kód na přesnou částku zobrazí jedním dotykem a platba se rovnou zapíše do denního přehledu." />
      </div>
    </>
  );
}
