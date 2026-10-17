import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "@/components/external-link";
import { Faq, type FaqItem } from "@/components/faq";
import { InvoicePaper } from "@/components/invoice-paper";
import { PageHeader } from "@/components/page-header";
import { SOURCES } from "@/content/facts";
import { type Invoice, dueDateOf, invoiceTotals, variableSymbolFrom } from "@/lib/faktura";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";

/**
 * S2 (17. 10. 2026): vyplněné vzory faktur (neplátce, plátce DPH) s vysvětlením údajů. Údaje jsou vymyšlené: IČO 12345678
 * a 87654321 ani účet 123456789/0800 nemají platnou kontrolní číslici, takže nemohou patřit skutečné firmě ani účtu.
 * Vzory nemají .doc-paper (paper=false) – na stránce jsou dva a při tisku by se překryly.
 */
export const metadata: Metadata = {
  title: "Vzor faktury pro neplátce i plátce DPH (2026)",
  description:
    "Vyplněný vzor faktury pro neplátce DPH a daňového dokladu pro plátce s rekapitulací DPH. U každého údaje vysvětlíme, proč na faktuře je, a podle čeho.",
  ...canonicalMeta("/faktura-vzor"),
};

const SUPPLIER_OSVC = {
  name: "Jana Vzorová",
  ico: "12345678",
  dic: "",
  address: "Ukázková 12\n360 01 Karlovy Vary",
  registry: "Fyzická osoba zapsaná v živnostenském rejstříku.",
};
const CUSTOMER = { name: "Ukázkový odběratel s.r.o.", ico: "87654321", dic: "CZ87654321", address: "Vzorová 3\n110 00 Praha 1" };

const NEPLATCE: Invoice = {
  kind: "faktura",
  vatPayer: false,
  number: "2026015",
  issueDate: "2026-10-15",
  taxDate: "2026-10-15",
  dueDays: "14",
  payment: "prevodem",
  account: "123456789/0800",
  vs: "",
  supplier: SUPPLIER_OSVC,
  customer: CUSTOMER,
  items: [
    { name: "Grafický návrh letáku", qty: "1", unit: "ks", price: "4500", rate: 21 },
    { name: "Úpravy podle připomínek", qty: "3", unit: "hod", price: "600", rate: 21 },
  ],
  note: "Fakturujeme vám podle objednávky ze dne 1. 10. 2026.",
};

const PLATCE: Invoice = {
  ...NEPLATCE,
  vatPayer: true,
  number: "FV-2026/087",
  taxDate: "2026-10-14",
  supplier: {
    name: "Vzorová firma s.r.o.",
    ico: "12345678",
    dic: "CZ12345678",
    address: "Ukázková 12\n360 01 Karlovy Vary",
    registry: "Zapsáno v obchodním rejstříku vedeném Krajským soudem v Plzni, oddíl C, vložka 00000.",
  },
  items: [
    { name: "Ubytování – 2 noci, 2 osoby", qty: "2", unit: "noc", price: "1800", rate: 12 },
    { name: "Půjčení elektrokola", qty: "2", unit: "den", price: "600", rate: 21 },
    { name: "Sleva na půjčení elektrokola", qty: "1", unit: "ks", price: "-200", rate: 21 },
  ],
  note: "",
};

const notesNeplatce = [
  "Dodavatel: jméno, sídlo, IČO a údaj o zápisu – u OSVČ v živnostenském rejstříku. Vyžaduje je § 435 odst. 1 občanského zákoníku.",
  "Odběratel, číslo faktury, datum vystavení a splatnost zákon neplátci výslovně nepředepisuje. Bez nich by ale faktura nesloužila jako doklad ani jako výzva k platbě.",
  "Variabilní symbol je tu číslo faktury bez písmen – podle něj si platbu na účtu spárujete.",
  "Položky mají množství, jednotku a cenu. DPH na faktuře neplátce není: kdo daň na dokladu uvede, musí ji přiznat (§ 108 odst. 4 písm. g) zákona o DPH).",
  "Věta „Dodavatel není plátcem DPH.“ zákonem povinná není, v praxi se uvádí.",
];

const notesPlatce = [
  "Dodavatel i odběratel mají označení (firma, sídlo) a DIČ – § 29 odst. 1 písm. a) až d) zákona o DPH. Firma navíc uvádí soud, oddíl a vložku z obchodního rejstříku (§ 435 občanského zákoníku).",
  "Evidenční číslo dokladu, den vystavení a den uskutečnění plnění, který se tu od dne vystavení liší – § 29 odst. 1 písm. e), g) a h).",
  "U položek je jednotková cena bez daně a sazba daně; sleva je samostatná položka – § 29 odst. 1 písm. i) a k).",
  "Rekapitulace DPH: základ daně a výše daně za každou sazbu, daň v korunách – § 29 odst. 1 písm. j) a l). Ubytovací služby mají sníženou sazbu 12 % (příloha č. 2 zákona o DPH), půjčení elektrokola základní sazbu 21 % (§ 47 odst. 1).",
];

const FAQ: FaqItem[] = [
  {
    q: "Můžu vzor použít pro vlastní fakturu?",
    a: "Ano. Nejrychleji v generátoru Faktura zdarma: vyplníte své údaje, odběratele načtete z ARES a fakturu vytisknete nebo uložíte jako PDF. Stažení šablony ve Wordu nebo Excelu nepotřebujete.",
  },
  {
    q: "Jsou údaje na vzoru skutečné?",
    a: "Ne. Jména, adresy, IČO i číslo účtu jsou vymyšlené. IČO 12345678 a 87654321 ani účet na vzoru nemají platnou kontrolní číslici, takže nepatří žádné skutečné firmě ani účtu.",
  },
  {
    q: "Proč má faktura plátce dvě různá data?",
    a: "Den vystavení a den uskutečnění zdanitelného plnění (DUZP). Podle § 29 odst. 1 písm. h) zákona o DPH se DUZP uvádí, pokud se liší ode dne vystavení; v praxi se uvádí vždy.",
  },
];

const SOURCES_LIST = [SOURCES.oz435, SOURCES.zdph];

function Example({ id, title, intro, inv, notes }: { id: string; title: string; intro: string; inv: Invoice; notes: string[] }) {
  const totals = invoiceTotals(inv.items, inv.vatPayer);
  return (
    <section className="mt-14" aria-labelledby={id}>
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-lg leading-relaxed text-ink-soft">{intro}</p>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <InvoicePaper inv={inv} totals={totals} dueDate={dueDateOf(inv)} vs={variableSymbolFrom(inv.number)} iban={null} qrSvg={null} paper={false} />
        <div>
          <h3 className="text-lg font-bold">Co na vzoru je a proč</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default function InvoiceSamplePage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Vzor faktury"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Faktura zdarma", path: "/faktura-zdarma" },
          { name: "Vzor faktury", path: "/faktura-vzor" },
        ]}
        lead="Dva vyplněné vzory: faktura OSVČ, která není plátcem DPH, a daňový doklad firmy, která plátcem je. U každého vzoru vysvětlujeme, který údaj tam musí být a podle kterého zákona. Údaje jsou vymyšlené."
      >
        <Link href="/faktura-zdarma" className="btn-primary mt-6">
          Vyplnit vlastní fakturu zdarma
        </Link>
      </PageHeader>
      <div className="container-page pb-10">
        <Example
          id="neplatce"
          title="Vzor faktury pro neplátce DPH"
          intro="OSVČ, která není plátcem DPH, fakturuje firmě grafické práce. Faktura nemá DPH ani rekapitulaci daně."
          inv={NEPLATCE}
          notes={notesNeplatce}
        />
        <Example
          id="platce"
          title="Vzor faktury plátce DPH (daňový doklad)"
          intro="Firma, která je plátcem DPH, fakturuje ubytování a půjčení elektrokola – každé plnění má jinou sazbu daně, proto má faktura rekapitulaci DPH podle sazeb."
          inv={PLATCE}
          notes={notesPlatce}
        />
        <p className="mt-10 max-w-3xl text-lg leading-relaxed text-ink-soft">
          Úplný přehled náležitostí – i pro zjednodušený daňový doklad do 10 000 Kč a zálohovou fakturu – najdete u{" "}
          <Link href="/faktura-zdarma" className="font-medium text-brand-700 underline underline-offset-4">
            generátoru Faktura zdarma
          </Link>
          . Stav k 17. 10. 2026.
        </p>
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
          <p className="mt-3 text-base text-muted">
            Zdroje:{" "}
            {SOURCES_LIST.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <ExternalLink href={s.url}>{s.label}</ExternalLink>
              </span>
            ))}
          </p>
          <p className="mt-3 text-sm text-muted">Vzor je pomůcka, nejde o daňové poradenství.</p>
        </section>
      </div>
    </>
  );
}
