import type { Metadata } from "next";
import Link from "next/link";
import { PartnerBadge } from "@/components/accountant/partner-badge";
import { WebinarForm } from "@/components/accountant/webinar-form";
import { ClarityOnView } from "@/components/clarity-on-view";
import { Faq, type FaqItem } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { DIS_OPENS, FACTS, TIMELINE, timelineAt } from "@/content/facts";
import { PARTNER_PLAN } from "@/content/pricing";
import { ACCOUNTANT_REWARD_DISCLOSURE, ACCOUNTANT_SETUP_REWARD, SETUP_SERVICE, setupReferralPath } from "@/content/services";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { isClosed } from "@/lib/launch";
import { ExternalLink } from "@/components/external-link";
import { canonicalMeta } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "EET 2.0 pro účetní – kabinet zdarma a nastavení za klienty",
  description:
    "Pro účetní kanceláře: Účetní kabinet zdarma bez limitu klientů, tržby klientů s rozpisem DPH, export CSV a Pohoda XML (beta), hromadná kontrola IČO. Nastavení DIS+ a certifikátu za klienty uděláme my.",
  ...canonicalMeta("/ucetni"),
};

/**
 * S11 (3. 11. 2026): stránka pro účetní po otevření pokladny – hero, „Co vám ušetříme“, Nastavení na klíč s osobním odkazem
 * a odměnou, kabinet, partnerský program, balíček pro klienty (místo webináře), odznak, FAQ. Bez jmen konkurence a bez
 * strašení pokutami. Kdyby byl kabinet zase za heslem (isClosed), stránka nesmí tvrdit, že funguje (inv. 10) – pak místo
 * odkazu na kabinet formulář „dejte mi vědět o spuštění“.
 */
const KABINET_OPEN = !isClosed("/kabinet");
const kabinet = (linkLabel: string) => (KABINET_OPEN ? { status: "now" as const, href: "/kabinet", linkLabel } : { status: "launch" as const });

const SAVINGS: readonly { title: string; text: string; href: string; linkLabel: string }[] = [
  {
    title: "Technickou část za klienty",
    text: `Přístup do DIS+, evidenční jednotky, pokladní certifikát a telefon pro pokladní. Projdeme to s klientem písemně za vás – za ${SETUP_SERVICE.priceExVatLabel}, platí klient. Do DIS+ se klient přihlásí sám, certifikát nám neposílá.`,
    href: "#nastaveni-na-klic",
    linkLabel: "Jak to funguje",
  },
  {
    title: "Chaos na konci měsíce",
    text: "Tržby všech propojených klientů na jednom místě: hotovost, karta, QR, vratky a DPH podle sazeb. Do EET jde jen celková částka – v kabinetu máte i rozpis DPH. Export CSV a Pohoda XML (beta).",
    href: "#kabinet",
    linkLabel: "Co umí kabinet",
  },
  {
    title: "Rozhodnutí o EET OFF",
    text: `Hromadná kontrola IČO ukáže, koho se evidence pravděpodobně týká a kdo může zvolit EET OFF. Kalkulačka spočítá, co se klientovi vyplatí. Oznámení pro rok 2027 se podává do ${FACTS.eetOff.deadline}.`,
    href: "/ucetni/hromadna-kontrola",
    linkLabel: "Zkontrolovat IČO klientů",
  },
];

const SETUP_STEPS_FOR_ACCOUNTANT: readonly { title: string; text: string }[] = [
  {
    title: "Pošlete klientovi svůj odkaz",
    text: `V kabinetu najdete osobní odkaz ve tvaru evidujzdarma.cz${setupReferralPath("kód-kanceláře")}. Pošlete ho e-mailem, nebo vložte odznak na web kanceláře.`,
  },
  {
    title: "Klient poptá nastavení",
    text: `Vyplní krátký formulář. Ozveme se mu e-mailem do 1 pracovního dne; platí až po dokončení, ${SETUP_SERVICE.priceLabel}.`,
  },
  {
    title: "Vy vidíte stav v kabinetu",
    text: "V části „Doporučená nastavení“ vidíte název a IČO klienta, stav (zadáno, v řešení, hotovo) a odměnu.",
  },
];

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
    text: "Přehledně u každého klienta: přihlášení v DIS+, oznámené evidenční jednotky, pokladní certifikát, první tržba. I u klientů s jinou pokladnou nebo se státní aplikací.",
    ...kabinet("Otevřít kabinet"),
  },
  {
    title: "Pozvání klienta osobním odkazem",
    text: "Klient se přes váš odkaz zaregistruje k pokladně a vy hned vidíte jeho stav i tržby.",
    ...kabinet("Otevřít kabinet"),
  },
  {
    title: "Export tržeb klientů",
    text: "CSV zdarma a Pohoda XML (beta) s denními souhrny a rozpisem DPH. Money S3 a ABRA připravujeme.",
    ...kabinet("Otevřít kabinet"),
  },
  {
    title: "Kalendář termínů",
    text: "Upozornění na termíny pro všechny klienty najednou – lhůta EET OFF, začátek evidence 1. 1. 2027, konec platnosti certifikátů.",
    status: "launch",
  },
];

const FAQ: FaqItem[] = [
  {
    q: "Kolik Účetní kabinet stojí?",
    a: "Nic, a počet klientů není omezený. Vyděláváme na placených doplňcích a službách, které si mohou zvolit vaši klienti – například na nastavení na klíč.",
  },
  {
    q: "Musím klientům nastavovat DIS+ a certifikát sám?",
    a: `Ne. Pošlete jim svůj odkaz na ${SETUP_SERVICE.name} a technickou část s nimi projdeme my – písemně, bez telefonování. Klient se do DIS+ přihlásí sám a certifikát nahraje sám, soubor ani heslo nám neposílá. Cena je ${SETUP_SERVICE.priceLabel}, platí klient až po dokončení.`,
  },
  {
    q: "Kolik dostanu za doporučené nastavení?",
    a: `${ACCOUNTANT_REWARD_DISCLOSURE} Přehled a součet vidíte v kabinetu, odměnu vyplácíme ručně převodem. Podrobnosti jsou v pravidlech odměny.`,
  },
  {
    q: "Musí moji klienti používat pokladnu EvidujZdarma?",
    a: "Ne. Hromadnou kontrolu IČO a šablony dopisů můžete využít pro kohokoli. Stav připravenosti v kabinetu můžete vést i u klientů, kteří evidují ve státní aplikaci MOJE eet nebo v jiné pokladně.",
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
    a: KABINET_OPEN
      ? "Kabinet funguje už teď: přidejte klienty podle IČO, sledujte jejich připravenost, pošlete jim pozvánku do pokladny a stáhněte export tržeb. Kalendář termínů připravujeme."
      : "Kabinet spouštíme spolu s pokladnou. Hromadnou kontrolu IČO a šablony dopisů můžete používat už teď. O spuštění kabinetu vám dáme vědět – stačí nechat e-mail ve formuláři níže.",
  },
  {
    q: "Na co mají klienti myslet nejdřív?",
    a: `Od 1. 11. 2026 se v DIS+ přihlašuje k evidenci, oznamují evidenční jednotky a vydávají pokladní certifikáty. Evidovat se musí od ${FACTS.law.effectiveFrom} – „pilotní“ leden není zákonná výjimka, test pokladny proto naplánujte na prosinec. Paušalisté v 1. pásmu se musí do ${FACTS.eetOff.deadline} rozhodnout o EET OFF.`,
  },
];

const DEADLINES = TIMELINE.filter((t) => ["2026-11-01", "2026-12-01", "2027-01-01", "2027-01-11"].includes(t.date));

export default function AccountantsPage() {
  return (
    <>
      <JsonLd data={[faqLd(FAQ)]} />
      <ClarityOnView name="acc_lp_view" />
      <PageHeader
        title="EET 2.0 pro vaše klienty. Pokladna zdarma, nastavení za nás."
        crumbs={[{ name: "Pro účetní", path: "/ucetni" }]}
        lead="Účetní kabinet zdarma a bez limitu klientů. Nastavení DIS+ a pokladního certifikátu za vaše klienty uděláme my."
      >
        <div className="mt-6 flex flex-wrap gap-3">
          {KABINET_OPEN ? (
            <Link href="/kabinet" className="btn-primary">
              Založit kabinet zdarma
            </Link>
          ) : (
            <Link href="#zpravy" className="btn-primary">
              Dát mi vědět o spuštění kabinetu
            </Link>
          )}
          <Link href="#nastaveni-na-klic" className="btn-secondary">
            Poslat klientovi odkaz na nastavení
          </Link>
        </div>
      </PageHeader>

      <div className="container-page py-10 sm:py-14">
        {/* Co vám ušetříme */}
        <section aria-labelledby="usetrime">
          <h2 id="usetrime" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Co vám ušetříme
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {SAVINGS.map((s) => (
              <li key={s.title} className="card flex flex-col">
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">{s.text}</p>
                <Link href={s.href} className="mt-4 text-[15px] font-semibold text-brand-700 underline underline-offset-4">
                  {s.linkLabel} →
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Nastavení na klíč */}
        <section id="nastaveni-na-klic" aria-labelledby="nastaveni-h" className="mt-16 scroll-mt-24 rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:p-10">
          <h2 id="nastaveni-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Nastavení na klíč pro vaše klienty
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">
            Klienti se ptají vás, technické nastavení ale dělat nemusíte. Pošlete jim odkaz a o zbytek se postaráme.
          </p>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {SETUP_STEPS_FOR_ACCOUNTANT.map((s, i) => (
              <li key={s.title} className="rounded-2xl bg-white p-5">
                <p className="text-sm font-semibold text-brand-700">Krok {i + 1}</p>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-lg font-semibold text-ink" data-reward-disclosure="">
            {ACCOUNTANT_REWARD_DISCLOSURE}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {KABINET_OPEN && (
              <Link href="/kabinet#odkaz" className="btn-primary">
                Můj odkaz v kabinetu
              </Link>
            )}
            <Link href="/nastaveni-na-klic" className="btn-secondary">
              Co klient dostane
            </Link>
            <Link href="/pravidla-doporuceni#ucetni" className="btn-ghost">
              Pravidla odměny
            </Link>
          </div>
        </section>

        {/* Kabinet */}
        <section aria-labelledby="kabinet" className="mt-16 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="kabinet" className="scroll-mt-24 text-2xl font-bold tracking-tight sm:text-3xl">
                Účetní kabinet zdarma
              </h2>
              <p className="mt-2 max-w-3xl text-lg text-ink-soft">
                Jedno místo pro všechny klienty: připravenost na EET, pozvánky do pokladny a tržby s rozpisem DPH.{" "}
                <strong className="text-ink">{KABINET_OPEN ? "Zdarma, bez limitu klientů, funguje už teď." : "Zdarma, spouštíme spolu s pokladnou."}</strong>
              </p>
            </div>
            {KABINET_OPEN ? (
              <Link href="/kabinet" className="btn-primary">
                Založit kabinet zdarma
              </Link>
            ) : (
              <Link href="#zpravy" className="btn-primary">
                Dát mi vědět o spuštění
              </Link>
            )}
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CABINET.map((c) => (
              <li key={c.title} className="card flex flex-col">
                <span className={`chip self-start ${c.status === "now" ? "bg-brand-100 text-brand-700" : "bg-surface-2 text-ink-soft"}`}>
                  {c.status === "now" ? "Dostupné už teď" : KABINET_OPEN ? "Připravujeme" : "Spouštíme s pokladnou"}
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

        {/* Termíny */}
        <section aria-labelledby="terminy" className="mt-16">
          <h2 id="terminy" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Termíny EET 2.0 pro vaše klienty
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
            <ExternalLink href={timelineAt(DIS_OPENS).source.url} className="underline underline-offset-2">
              {timelineAt(DIS_OPENS).source.label}
            </ExternalLink>
          </p>
        </section>

        {/* Partner */}
        <section id="partner" aria-labelledby="partner-h" className="mt-16 scroll-mt-24 rounded-2xl border border-line bg-surface p-6 sm:p-10">
          <h2 id="partner-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Partnerský program
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">
            Účast je zdarma a bez závazků. Pokladna je pro vaše klienty zdarma navždy – odměna se týká jen placených služeb a doplňků, které si
            klient sám zvolí.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Nastavení na klíč</p>
              <h3 className="mt-1 text-xl font-bold">{ACCOUNTANT_SETUP_REWARD} Kč za každé dokončené nastavení</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Klient přijde přes váš odkaz; cena pro něj je stejná. Platí už teď.</p>
            </div>
            <div className="rounded-2xl bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Placené doplňky – varianta A</p>
              <h3 className="mt-1 text-xl font-bold">{PARTNER_PLAN.share} % z plateb klientů</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                Z každé platby klienta, kterého přivedete, dostanete {PARTNER_PLAN.share} % – po celou dobu, kdy platí.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Placené doplňky – varianta B</p>
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
            . Podmínky podílu z doplňků upraví smlouva, kterou zveřejníme před spuštěním placených tarifů. Odměnu za nastavení upravují{" "}
            <Link href="/pravidla-doporuceni#ucetni" className="underline underline-offset-2">
              pravidla odměny
            </Link>
            .
          </p>
        </section>

        {/* Balíček pro klienty (S11: místo webináře) */}
        <section id="balicek" aria-labelledby="balicek-h" className="mt-16 scroll-mt-24">
          <h2 id="balicek-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Balíček pro klienty
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">Co klientům poslat, když se ptají na EET 2.0. Všechno zdarma a bez registrace.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li className="card flex flex-col">
              <h3 className="text-lg font-semibold">EET 2.0 v kostce</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">Jedna stránka pro klienta: termíny, co udělat v DIS+ a jaké má možnosti. Dá se i vytisknout.</p>
              <Link href="/ucetni/pro-klienty" className="mt-4 text-[15px] font-semibold text-brand-700 underline underline-offset-4">
                Otevřít přehled →
              </Link>
            </li>
            <li className="card flex flex-col">
              <h3 className="text-lg font-semibold">Šablony dopisů</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">Hotové e-maily k jednotlivým termínům s názvem vaší kanceláře.</p>
              <Link href="/ucetni/sablony" className="mt-4 text-[15px] font-semibold text-brand-700 underline underline-offset-4">
                Otevřít šablony →
              </Link>
            </li>
            <li className="card flex flex-col">
              <h3 className="text-lg font-semibold">Kalkulačka EET OFF</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">Pro paušalisty v 1. pásmu: vyplatí se přirážka, nebo evidence?</p>
              <Link href="/kalkulacka-eet-off" className="mt-4 text-[15px] font-semibold text-brand-700 underline underline-offset-4">
                Spočítat →
              </Link>
            </li>
          </ul>
        </section>

        {!KABINET_OPEN && (
          <div id="zpravy" className="mt-16 grid scroll-mt-24 gap-10 lg:grid-cols-2">
            <section aria-labelledby="zpravy-h">
              <h2 id="zpravy-h" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Zpráva o spuštění kabinetu
              </h2>
              <p className="mt-2 text-lg text-ink-soft">Zanechte e-mail a dáme vám vědět, jakmile Účetní kabinet spustíme.</p>
            </section>
            <div className="card self-start p-6 shadow-sm sm:p-8">
              <WebinarForm />
            </div>
          </div>
        )}

        {/* Odznak */}
        <section aria-labelledby="odznak" className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 id="odznak" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Odznak „Partner EvidujZdarma“
            </h2>
            <p className="mt-2 text-lg text-ink-soft">
              Dejte klientům najevo, že je na EET 2.0 připravíte. Odznak vložte na web kanceláře – odkaz obsahuje kód vaší kanceláře, takže
              poptávky nastavení, které přes něj přijdou, se vám připíšou.
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
