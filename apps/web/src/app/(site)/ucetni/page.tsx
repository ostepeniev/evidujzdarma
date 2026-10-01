import type { Metadata } from "next";
import Link from "next/link";
import { PartnerBadge } from "@/components/accountant/partner-badge";
import { WebinarForm } from "@/components/accountant/webinar-form";
import { WEBINARS } from "@/components/accountant/webinars";
import { Faq, type FaqItem } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { FACTS, TIMELINE } from "@/content/facts";
import { PARTNER_PLAN } from "@/content/pricing";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "EET 2.0 pro účetní – kabinet a partnerství",
  description:
    "Pro účetní kanceláře: hromadná kontrola IČO klientů, stav připravenosti na EET 2.0, šablony dopisů, export tržeb a 20 % z plateb klientů. Zdarma, i webináře.",
  alternates: { canonical: "/ucetni" },
};

const CABINET: readonly { title: string; text: string; status: "now" | "launch"; href?: string; linkLabel?: string }[] = [
  {
    title: "Hromadná kontrola IČO",
    text: "Vložte seznam IČO nebo CSV a zjistěte, kterých klientů se EET 2.0 pravděpodobně týká a kdo může zvolit EET OFF.",
    status: "now",
    href: "/ucetni/hromadna-kontrola",
    linkLabel: "Zkontrolovat klienty",
  },
  {
    title: "Šablony dopisů klientům",
    text: "Hotové texty k termínům EET 2.0 s vaším jménem kanceláře – stačí zkopírovat do e-mailu.",
    status: "now",
    href: "/ucetni/sablony",
    linkLabel: "Otevřít šablony",
  },
  {
    title: "Stav připravenosti klientů",
    text: "Přehledně u každého klienta: přihlášení v DIS+, oznámené evidenční jednotky, pokladní certifikát, první tržba. I u klientů s jinou pokladnou nebo s MOJE eet.",
    status: "now", href: "/kabinet", linkLabel: "Otevřít kabinet",
  },
  {
    title: "Pozvání klienta osobním odkazem",
    text: "Klient se přes váš odkaz zaregistruje k pokladně a vy hned vidíte jeho stav i tržby.",
    status: "now", href: "/kabinet", linkLabel: "Otevřít kabinet",
  },
  {
    title: "Export tržeb klientů",
    text: "CSV zdarma. Export pro Pohodu, Money S3 a ABRA v partnerském tarifu.",
    status: "now", href: "/kabinet", linkLabel: "Otevřít kabinet",
  },
  {
    title: "Kalendář termínů",
    text: "Upozornění na termíny pro všechny klienty najednou – lhůta EET OFF, ostrý provoz, konec platnosti certifikátů.",
    status: "launch",
  },
];

const FAQ: FaqItem[] = [
  {
    q: "Kolik Účetní kabinet stojí?",
    a: "Nic. Kabinet i partnerský program jsou pro účetní zdarma. Vyděláváme na placených doplňcích, které si mohou zapnout vaši klienti, a z nich vám dáváme podíl.",
  },
  {
    q: "Musí moji klienti používat pokladnu EvidujZdarma?",
    a: "Ne. Hromadnou kontrolu IČO a šablony dopisů můžete využít pro kohokoli. Stav připravenosti v kabinetu půjde vést i u klientů, kteří evidují ve státní aplikaci MOJE eet nebo v jiné pokladně.",
  },
  {
    q: "Mohu klientům doporučit státní MOJE eet?",
    a: "Samozřejmě, pro některé je to rozumná volba – typicky pro nejmenší podnikatele s jednou provozovnou a stabilním internetem. Rozdíly férově popisujeme ve srovnání EvidujZdarma a MOJE eet.",
  },
  {
    q: "Jak funguje podíl z plateb klientů?",
    a: `Když klient, kterého jste přivedli, platí za Premium nebo jiný placený doplněk, dostanete ${PARTNER_PLAN.share} % z jeho plateb po celou dobu, kdy platí. Pokud chcete, můžete se podílu vzdát a místo toho dát slevu klientům. Přesné podmínky upraví partnerská smlouva před spuštěním placených tarifů.`,
  },
  {
    q: "Funguje Účetní kabinet už teď?",
    a: "Kabinet funguje už teď: přidejte klienty podle IČO, sledujte jejich připravenost a pošlete jim pozvánku do pokladny. Kalendář termínů doplníme do konce roku.",
  },
  {
    q: "Na co mají klienti myslet nejdřív?",
    a: `Od 1. 11. 2026 se v DIS+ přihlašuje k evidenci, oznamují evidenční jednotky a vydávají pokladní certifikáty. Paušalisté v 1. pásmu se musí do ${FACTS.eetOff.deadline} rozhodnout o EET OFF. Ostrý provoz začíná 1. 2. 2027.`,
  },
];

function eventsLd() {
  return WEBINARS.map((w) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: `Webinář EET 2.0 pro účetní (${w.dateLabel})`,
    description: w.topic,
    startDate: w.date,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    isAccessibleForFree: true,
    inLanguage: "cs-CZ",
    location: { "@type": "VirtualLocation", url: absoluteUrl("/ucetni#webinar") },
    organizer: { "@id": `${SITE_URL}/#organization` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "CZK", url: absoluteUrl("/ucetni#webinar") },
  }));
}

const DEADLINES = TIMELINE.filter((t) => ["2026-11-01", "2026-12-01", "2027-01-11", "2027-02-01"].includes(t.date));

export default function AccountantsPage() {
  return (
    <>
      <JsonLd data={[...eventsLd(), faqLd(FAQ)]} />
      <PageHeader
        title="EET 2.0 pro účetní"
        crumbs={[{ name: "Pro účetní", path: "/ucetni" }]}
        lead="Vaši klienti se budou ptát vás. Připravte je všechny najednou: zjistěte, koho se evidence týká, pošlete jim srozumitelný dopis a mějte přehled, kdo je připravený. Zdarma."
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/ucetni/hromadna-kontrola" className="btn-primary">
            Zkontrolovat IČO klientů
          </Link>
          <Link href="#webinar" className="btn-secondary">
            Webinář EET 2.0 pro účetní
          </Link>
        </div>
      </PageHeader>

      <div className="container-page py-10 sm:py-14">
        {/* Termíny */}
        <section aria-labelledby="terminy">
          <h2 id="terminy" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Termíny, které vaši klienti nesmí propásnout
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEADLINES.map((t) => (
              <li key={t.date} className="card p-5">
                <time dateTime={t.date} className="text-sm font-semibold text-brand-700">
                  {t.dateLabel}
                </time>
                <h3 className="mt-1 text-lg font-semibold">{t.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t.action}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted">
            Zdroj:{" "}
            <a href={TIMELINE[0]!.source.url} className="underline underline-offset-2" rel="noopener">
              {TIMELINE[0]!.source.label}
            </a>
          </p>
        </section>

        {/* Kabinet */}
        <section aria-labelledby="kabinet" className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="kabinet" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Účetní kabinet zdarma
              </h2>
              <p className="mt-2 max-w-3xl text-lg text-ink-soft">
                Jedno místo pro všechny klienty: připravenost na EET, pozvánky do pokladny a export tržeb. <strong className="text-ink">Zdarma, funguje už teď.</strong>
              </p>
            </div>
            <Link href="/kabinet" className="btn-primary">
              Založit kabinet zdarma
            </Link>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CABINET.map((c) => (
              <li key={c.title} className="card flex flex-col">
                <span className={`chip self-start ${c.status === "now" ? "bg-brand-100 text-brand-700" : "bg-surface-2 text-ink-soft"}`}>
                  {c.status === "now" ? "Dostupné už teď" : "Spouštíme s pokladnou"}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">{c.text}</p>
                {c.href && (
                  <Link href={c.href} className="mt-4 text-[15px] font-semibold text-brand-700 underline underline-offset-4">
                    {c.linkLabel} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Partner */}
        <section id="partner" aria-labelledby="partner-h" className="mt-16 scroll-mt-24 rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:p-10">
          <h2 id="partner-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Partnerský program: vyberte si, kdo ušetří
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">
            Účast je zdarma a bez závazků. Pokladna je pro vaše klienty zdarma navždy – odměna se týká jen placených doplňků, které
            si klient sám zvolí.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Varianta A</p>
              <h3 className="mt-1 text-xl font-bold">{PARTNER_PLAN.share} % z plateb klientů</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                Z každé platby klienta, kterého přivedete, dostanete {PARTNER_PLAN.share} % – po celou dobu, kdy platí.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Varianta B</p>
              <h3 className="mt-1 text-xl font-bold">Sleva pro vaše klienty</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                Místo podílu dostanou vaši klienti slevu na placené doplňky. Výši slevy upřesníme se spuštěním placených tarifů.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            Ceny placených doplňků jsou zatím předběžné – viz{" "}
            <Link href="/cenik" className="underline underline-offset-2">
              ceník
            </Link>
            . Podmínky partnerství upraví smlouva, kterou zveřejníme před spuštěním placených tarifů.
          </p>
        </section>

        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          {/* Webinář */}
          <section id="webinar" aria-labelledby="webinar-h" className="scroll-mt-24">
            <h2 id="webinar-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Webinář „EET 2.0 pro účetní“
            </h2>
            <p className="mt-2 text-lg text-ink-soft">Zdarma, online, s prostorem pro dotazy. Vyberte si termín:</p>
            <ul className="mt-6 space-y-3">
              {WEBINARS.map((w) => (
                <li key={w.value} className="card p-5">
                  <time dateTime={w.date} className="text-sm font-semibold text-brand-700">
                    {w.dateLabel}
                  </time>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{w.topic}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">Přesný čas a odkaz na připojení pošleme přihlášeným e-mailem.</p>
          </section>
          <div className="card self-start p-6 shadow-sm sm:p-8">
            <h3 className="mb-5 text-xl font-bold">Přihláška</h3>
            <WebinarForm />
          </div>
        </div>

        {/* Odznak */}
        <section aria-labelledby="odznak" className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 id="odznak" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Odznak „Partner EvidujZdarma“
            </h2>
            <p className="mt-2 text-lg text-ink-soft">
              Dejte klientům najevo, že je na EET 2.0 připravíte. Odznak vložte na web kanceláře – odkaz obsahuje váš kód, takže
              klienti, kteří přes něj přijdou, se vám připíšou.
            </p>
          </div>
          <PartnerBadge />
        </section>

        <section aria-labelledby="faq" className="mx-auto mt-16 max-w-3xl">
          <h2 id="faq" className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Časté otázky účetních
          </h2>
          <Faq items={FAQ} />
        </section>
      </div>
    </>
  );
}
