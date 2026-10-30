import type { Metadata } from "next";
import Link from "next/link";
import { Faq, type FaqItem } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { canonicalMeta } from "@/lib/metadata";
import { OPERATOR, SITE, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * Prodejní stránka EET API (S8, 30. 10. 2026, pokyn majitele „prodej vystavit“). Technické detaily jsou na /api-docs;
 * tady jen to, co API v1 skutečně umí a co bylo ověřeno proti Playgroundu FS. Cena = ceník (od 990 Kč/měsíc).
 * Ostrý provoz pro cizí partnery až po podpisu smlouvy (API_LIVE_PUBLIC) – proto „pilotní přístup“.
 */
const PATH = "/eet-api";
const SUBJECT = encodeURIComponent("EET API – pilotní přístup");

export const metadata: Metadata = {
  title: { absolute: "EET API: EET 2.0 do vašeho PMS, rezervací nebo fakturace" },
  description:
    "REST API pro EET 2.0: tržby z hotelového PMS, rezervačního systému nebo fakturace do Finanční správy bez vlastního podpisu, SOAP a fronty. POK hned, webhooky, vratky, Playground zdarma.",
  ...canonicalMeta(PATH),
};

const PAINS = [
  { title: "Podpis a SOAP", text: "XML podpis certifikátem klienta, WS-Security, ověření odpovědi Finanční správy a POK. U nás jedno volání JSON." },
  { title: "Výpadky a 48 hodin", text: "Fronta s opakováním podle pravidel FS (nové UUID, prvni_zaslani=false) a upozornění, než vyprší 48 hodin." },
  { title: "Certifikáty klientů", text: "Klient nahraje svůj pokladní certifikát u nás. Vy ho nikdy nevidíte a nemusíte ho bezpečně ukládat." },
  { title: "Vratky a uzávěrky", text: "Částečné i úplné vratky s kontrolou proti originálu, denní přehled podle jednotky, způsobu platby a DPH." },
] as const;

const STEPS = [
  { title: "Vyzkoušejte v Playgroundu", text: "Testovací token si vytvoříte sami v pokladně (Integrace). Tržby jdou do testovacího prostředí Finanční správy, POK končí na „ff“." },
  { title: "Připojte klienty jedním klikem", text: "Tlačítko „Připojit EvidujZdarma“ ve vašem systému: podnikatel se přihlásí, vybere provozovny a povolí přístup (OAuth 2.0 + PKCE)." },
  { title: "Posílejte platby z místa", text: "Každou platbu na recepci nebo u pultu pošlete POST /v1/sales. Do ~2,5 s vrátíme POK, jinak stav „ve frontě“ a webhook." },
  { title: "Tiskněte údaje na doklad", text: "Odpověď obsahuje vše pro doklad: POK, čas, jednotku, pořadové číslo, rozpis DPH, případně odkaz na doklad." },
] as const;

const FEATURES = [
  "REST API /v1 s OpenAPI 3.1 a dokumentací v češtině",
  "Idempotence podle vašeho ID platby a externalRef",
  "Webhooky s podpisem HMAC: potvrzeno, odmítnuto, blíží se 48 h, končí certifikát",
  "Vratky, denní přehledy, stav jednotek a certifikátů",
  "Playground Finanční správy zdarma, testovací tokeny bez schvalování",
  "Stejná evidence a fronta jako v naší pokladně – žádná zvláštní cesta",
] as const;

const HOTEL = [
  ["Záloha převodem, platební bránou, přes Booking nebo Airbnb online", "Neeviduje se – vzdálená platba"],
  ["Záloha nebo doplatek zaplacený na recepci (hotovost, karta, QR)", "Eviduje se – každá platba zvlášť"],
  ["Minibar, wellness, parkování placené na místě", "Eviduje se"],
  ["Vratná kauce – složení a vrácení", "Neeviduje se; jen ponechaná část kauce složené na místě"],
  ["Storno nebo vrácení peněz na místě", "Vratka přes API"],
] as const;

const FAQ: FaqItem[] = [
  {
    q: "Kdo odpovídá Finanční správě za evidenci?",
    a: "Podnikatel (poplatník). Tržba jde pod jeho EIČ, z jeho evidenční jednotky a s jeho pokladním certifikátem. EvidujZdarma je technický nástroj, který zprávu podepíše, odešle, opakuje a vrátí výsledek.",
  },
  {
    q: "Uvidí náš systém certifikát klienta?",
    a: "Ne. Klient nahraje pokladní certifikát přímo do EvidujZdarma. Váš systém dostane jen token s oprávněními, který klient může kdykoli odpojit.",
  },
  {
    q: "Co když Finanční správa neodpoví?",
    a: "Prodej se neblokuje. Tržba čeká ve frontě, odešle se znovu podle pravidel FS a výsledek dostanete webhookem. Pokud se blíží lhůta 48 hodin, pošleme událost sale.deadline_soon.",
  },
  {
    q: "Kolik to stojí?",
    a: "Testování v Playgroundu je zdarma. Ostrý provoz od 990 Kč měsíčně podle počtu aktivních evidenčních jednotek – přesnou nabídku pošleme e-mailem.",
  },
  {
    q: "Odkdy jde ostrý provoz?",
    a: "Produkční prostředí Finanční správy přijímá tržby v přechodném režimu od 1. 11. 2026, povinně od 1. 1. 2027. Ostrý přístup k API zapínáme partnerům po podpisu smlouvy v pilotním provozu.",
  },
  {
    q: "Funguje to i pro rezervační systémy a fakturaci?",
    a: "Ano. Evidují se jen platby přijaté při osobním kontaktu nebo v provozovně (hotovost, karta, QR na místě). Platby převodem na fakturu nebo přes platební bránu se neevidují – API je přijme jako neevidované, nebo je neposíláte vůbec.",
  },
];

function productLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EET API EvidujZdarma",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: absoluteUrl(PATH),
    description: "REST API pro evidenci tržeb EET 2.0 z hotelových PMS, rezervačních a fakturačních systémů.",
    offers: { "@type": "Offer", price: "990", priceCurrency: "CZK", url: absoluteUrl(PATH) },
    provider: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE.name, legalName: OPERATOR.name },
  };
}

export default function EetApiPage() {
  return (
    <>
      <JsonLd data={[productLd(), faqLd(FAQ)]} />
      <PageHeader
        title="EET 2.0 ve vašem systému za jeden den"
        crumbs={[{ name: "EET API", path: PATH }]}
        lead={
          <>
            REST API pro <strong>hotelová PMS, rezervační systémy a fakturaci</strong>. Pošlete platbu jako JSON – podpis, komunikaci s Finanční
            správou, frontu při výpadku a vratky řešíme my. POK vrátíme hned, nebo webhookem.
          </>
        }
      >
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href={`mailto:${SITE.email}?subject=${SUBJECT}`} className="btn-primary px-6 py-3 text-lg no-underline">
            Chci pilotní přístup
          </a>
          <Link href="/api-docs" className="btn-secondary px-6 py-3 text-lg no-underline">
            Dokumentace API
          </Link>
        </div>
      </PageHeader>

      <section className="container-page py-12" aria-labelledby="bolest-h">
        <h2 id="bolest-h" className="text-3xl font-bold tracking-tight">
          Co nemusíte programovat
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAINS.map((p) => (
            <div key={p.title} className="card p-5">
              <h3 className="text-lg font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface py-14" aria-labelledby="jak-h">
        <div className="container-page">
          <h2 id="jak-h" className="text-3xl font-bold tracking-tight">
            Jak to funguje
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-5">
                <p className="text-sm font-semibold text-brand-700">Krok {i + 1}</p>
                <h3 className="mt-1 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
          <pre className="mt-8 overflow-x-auto rounded-2xl bg-ink p-5 text-[13px] leading-relaxed text-white">
            <code>{`curl -X POST ${SITE_URL}/api/v1/sales \\
  -H "Authorization: Bearer ezk_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{"sales":[{"id":"6f1c…","externalRef":"REZ-2027-0042","unitId":"…",
       "soldAt":"2027-01-02T08:10:00+01:00",
       "lines":[{"name":"Ubytování 2 noci","qty":1,"unitPrice":320000,"vatRate":12}],
       "payments":[{"method":"card","amount":320000}]}]}'

→ {"results":[{"status":"confirmed","pok":"…","evidencedAmount":320000,"receipt":{…}}]}`}</code>
          </pre>
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="funkce-h">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 id="funkce-h" className="text-3xl font-bold tracking-tight">
              Co API umí
            </h2>
            <ul className="mt-6 space-y-3 text-[17px] text-ink">
              {FEATURES.map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="text-brand-600">
                    ✓
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="card self-start border-2 border-brand-500 p-6 sm:p-8" aria-label="Cena">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">EET API</p>
            <p className="mt-3 text-5xl font-extrabold tracking-tight text-ink">od 990 Kč</p>
            <p className="mt-1 text-[15px] text-muted">měsíčně podle počtu aktivních evidenčních jednotek</p>
            <p className="mt-4 text-[15px] text-ink-soft">Playground Finanční správy zdarma. Ostrý provoz v pilotním programu po podpisu smlouvy.</p>
            <a href={`mailto:${SITE.email}?subject=${SUBJECT}`} className="btn-primary mt-6 w-full py-3 text-center no-underline">
              Chci pilotní přístup
            </a>
          </aside>
        </div>
      </section>

      <section id="hotelove-pms" className="scroll-mt-24 border-y border-line bg-surface py-14" aria-labelledby="hotel-h">
        <div className="container-page">
          <h2 id="hotel-h" className="text-3xl font-bold tracking-tight">
            Pro hotelová PMS a penziony
          </h2>
          <p className="mt-3 max-w-3xl text-lg text-ink-soft">
            Evidují se jen platby přijaté na místě. Pravidla podle našeho návodu{" "}
            <Link href="/navody/eet-ubytovani" className="font-medium text-brand-700 underline">
              EET u ubytování
            </Link>
            :
          </p>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-surface-2 text-ink">
                <tr>
                  <th className="p-3 font-semibold">Platba v PMS</th>
                  <th className="p-3 font-semibold">EET 2.0</th>
                </tr>
              </thead>
              <tbody>
                {HOTEL.map(([a, b]) => (
                  <tr key={a} className="border-t border-line">
                    <td className="p-3 text-ink">{a}</td>
                    <td className="p-3 text-ink-soft">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">Místní poplatek z pobytu Finanční správa zatím podrobně nevysvětlila – v API je to nastavení na straně ubytovatele.</p>
        </div>
      </section>

      <section className="container-page max-w-3xl py-14" aria-labelledby="faq-h">
        <h2 id="faq-h" className="mb-6 text-2xl font-bold">
          Časté otázky
        </h2>
        <Faq items={FAQ} />
        <p className="mt-6 text-sm text-muted">
          Provozuje {OPERATOR.name}, IČO {OPERATOR.ico}. {SITE.independenceNotice}
        </p>
      </section>
    </>
  );
}
