import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { QrGenerator } from "@/components/qr-generator";
import { ToolCta } from "@/components/tool-cta";
import { JsonLd, faqLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Generátor QR platby zdarma (SPAYD)",
  description:
    "Vytvořte QR kód pro platbu na účet během pár sekund. Formát QR Platba (SPAYD) čtou všechny české bankovní aplikace. Zdarma, bez registrace, data neopouštějí váš prohlížeč.",
  alternates: { canonical: "/qr-platba" },
};

const FAQ = [
  {
    q: "Je QR platba tržbou, kterou musím evidovat v EET 2.0?",
    a: "Záleží na tom, jak zákon o evidenci tržeb vymezuje evidované platby. Bezhotovostní převod na účet se v původní EET neevidoval; jak je tomu v EET 2.0, popisujeme v návodu Kontaktní platba: co se eviduje a co ne. V pokladně EvidujZdarma můžete QR platbu zaznamenat jako samostatný způsob úhrady.",
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
        </section>
        <ToolCta text="V pokladně EvidujZdarma se QR kód na přesnou částku zobrazí jedním dotykem a platba se rovnou zapíše do denního přehledu." />
      </div>
    </>
  );
}
