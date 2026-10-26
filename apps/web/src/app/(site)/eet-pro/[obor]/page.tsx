import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Faq } from "@/components/faq";
import { QuickCheck } from "@/components/obor/quick-check";
import { PageHeader } from "@/components/page-header";
import { PreregForm } from "@/components/prereg-form";
import { RichText, plainText } from "@/components/rich-text";
import { Timeline } from "@/components/timeline";
import { FACTS, timelineAt } from "@/content/facts";
import { getGuide } from "@/content/guides";
import { OBOR_LANDINGS, POS_LAUNCH_LABEL, getLanding, landingFaq, landingPath } from "@/content/obor-landings";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { isClosed } from "@/lib/launch";
import { canonicalMeta } from "@/lib/metadata";
import { REVIEWER, SERVICE_COPY } from "@/lib/site";
import { SETUP_SERVICE } from "@/content/services";

/**
 * S4 (23. 10. 2026): „EET pro kadeřnice / bistro / restaurace“ – trychtýř rychlá kontrola → co pro vás platí →
 * pokladna → předregistrace. Data a pravidla pro texty: content/obor-landings.ts.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return OBOR_LANDINGS.map((l) => ({ obor: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/eet-pro/[obor]">): Promise<Metadata> {
  const { obor } = await params;
  const l = getLanding(obor);
  if (!l) return {};
  // bez „| EvidujZdarma“ – celý titulek (≤ 60 znaků) patří hledaným slovům, jako u /ukazka
  return { title: { absolute: l.title }, description: l.description(), ...canonicalMeta(landingPath(l)) };
}

export default async function OborLandingPage({ params }: PageProps<"/eet-pro/[obor]">) {
  const { obor } = await params;
  const l = getLanding(obor);
  if (!l) notFound();
  const closed = isClosed("/pokladna");
  const guide = getGuide(l.guideSlug);
  const faq = landingFaq(l);
  const path = landingPath(l);

  return (
    <>
      <JsonLd data={faqLd(faq.map((f) => ({ q: f.q, a: plainText(f.a) })))} />
      <PageHeader title={l.h1} crumbs={[{ name: l.short, path }]} lead={<RichText text={l.lead} />}>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Pro koho">
          {l.chips.map((c) => (
            <li key={c} className="chip bg-white text-brand-700 ring-1 ring-brand-200">
              {c}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href="#kontrola" className="btn-primary px-6 py-3 text-lg no-underline">
            Zjistit, co platí pro mě
          </a>
          {closed ? (
            <a href="#registrace" className="btn-secondary px-6 py-3 text-lg no-underline">
              Předregistrovat zdarma
            </a>
          ) : (
            <Link href={SERVICE_COPY.startCta.href} className="btn-secondary px-6 py-3 text-lg no-underline">
              {SERVICE_COPY.startCta.label}
            </Link>
          )}
        </div>
        <p className="mt-3 text-sm text-muted">
          {l.questions.length} {l.questions.length >= 5 ? "otázek" : "otázky"}, 30 vteřin, bez registrace.
        </p>
      </PageHeader>

      <section id="kontrola" className="container-page scroll-mt-24 py-12" aria-labelledby="kontrola-h">
        <h2 id="kontrola-h" className="mb-6 text-center text-3xl font-bold tracking-tight">
          Rychlá kontrola {l.forYour}
        </h2>
        <QuickCheck
          questions={l.questions}
          forYour={l.forYour}
          closed={closed}
          disLabel={timelineAt("2026-11-01").dateLabel}
          launchLabel={POS_LAUNCH_LABEL}
          eetOffDeadline={FACTS.eetOff.deadline}
          startHref={SERVICE_COPY.startCta.href}
          startLabel={SERVICE_COPY.startCta.label}
        />
      </section>

      <section className="border-y border-line bg-surface py-14" aria-labelledby="meni-h">
        <div className="container-page">
          <h2 id="meni-h" className="text-3xl font-bold tracking-tight">
            Co se od 1. 1. 2027 mění
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {l.pains.map((p) => (
              <li key={p.title} className="card p-5">
                <h3 className="text-lg font-semibold text-ink">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="pokladna-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="pokladna-h" className="text-3xl font-bold tracking-tight">
              Pokladna EvidujZdarma {l.forYour}
            </h2>
            <p className="mt-2 text-lg text-ink-soft">
              {closed ? `Zdarma navždy – spouštíme ${POS_LAUNCH_LABEL}.` : "Zdarma navždy."} Evidence tržeb, až 5 uživatelů a 3 evidenční jednotky bez poplatku.
            </p>
          </div>
          <Link href="/ukazka" className="btn-ghost">
            Vyzkoušet ukázku bez registrace →
          </Link>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {l.features.map((f) => (
            <li key={f.title} className="flex gap-3 rounded-2xl border border-line bg-white p-5">
              <span aria-hidden="true" className="mt-0.5 text-lg text-brand-600">
                ✓
              </span>
              <span>
                <strong className="block text-ink">{f.title}</strong>
                <span className="text-[15px] leading-relaxed text-ink-soft">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-xl border-l-4 border-sun-500 bg-warn-50 px-5 py-4 text-base text-ink">
          <strong>{l.fit.title}:</strong> <RichText text={l.fit.text} />
        </div>
      </section>

      <section className="container-page pb-14" aria-labelledby="terminy-h">
        <h2 id="terminy-h" className="mb-6 text-3xl font-bold tracking-tight">
          Termíny EET 2.0
        </h2>
        <Timeline />
      </section>

      {closed ? (
        <section id="registrace" className="border-y border-line bg-brand-50 py-14 scroll-mt-24" aria-labelledby="registrace-h">
          <div className="container-page grid gap-10 lg:grid-cols-2">
            <div>
              <h2 id="registrace-h" className="text-3xl font-bold tracking-tight">
                Předregistrace k pokladně {l.forYour}
              </h2>
              <p className="mt-3 text-lg text-ink-soft">
                Pokladnu spouštíme {POS_LAUNCH_LABEL}. Pošleme vám osobní EET plán a pozvánku, jakmile bude připravená.
              </p>
              <ul className="mt-6 space-y-3 text-[17px]">
                {["Osobní checklist: co udělat od 1. 11., do 1. 12. a do 1. 1.", "Návod k DIS+ a certifikátu krok za krokem", "Včasný přístup k pokladně podle pořadí", "Zdarma navždy, bez závazků"].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden="true" className="text-brand-600">
                      ✓
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6 shadow-sm sm:p-8">
              <PreregForm industry={l.industry} campaign={`eet-pro-${l.slug}`} />
            </div>
          </div>
        </section>
      ) : (
        <section id="registrace" className="border-y border-line bg-brand-50 py-14 scroll-mt-24" aria-labelledby="registrace-h">
          <div className="container-page text-center">
            <h2 id="registrace-h" className="text-3xl font-bold tracking-tight">
              Začněte evidovat zdarma
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-ink-soft">Pokladna EvidujZdarma {l.forYour}: zdarma navždy, až 5 uživatelů a 3 evidenční jednotky.</p>
            <Link href={SERVICE_COPY.startCta.href} className="btn-primary mt-6 px-8 py-4 text-lg no-underline">
              {SERVICE_COPY.startCta.label}
            </Link>
          </div>
        </section>
      )}

      <section className="container-page py-14" aria-labelledby="faq-h">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-h" className="mb-6 text-3xl font-bold tracking-tight">
            Časté otázky
          </h2>
          <Faq items={faq.map((f) => ({ q: f.q, a: plainText(f.a), rich: <p><RichText text={f.a} /></p> }))} />
        </div>
      </section>

      <section className="container-page pb-16" aria-labelledby="podrobne-h">
        <div className="mx-auto max-w-5xl">
          <h2 id="podrobne-h" className="mb-6 text-2xl font-bold">
            Podrobně a nástroje
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {guide && (
              <Link href={`/navody/${guide.slug}`} className="card block p-5 no-underline hover:border-brand-500">
                <span className="text-sm font-semibold text-brand-700">Návod</span>
                <strong className="mt-1 block text-ink">{guide.h1 ?? guide.title}</strong>
                <span className="mt-1 block text-[15px] text-ink-soft">Všechny situace podrobně, se zdroji.</span>
              </Link>
            )}
            {l.tools.map((t) => (
              <Link key={t.href} href={t.href} className="card block p-5 no-underline hover:border-brand-500">
                <span className="text-sm font-semibold text-brand-700">Nástroj</span>
                <strong className="mt-1 block text-ink">{t.label}</strong>
                <span className="mt-1 block text-[15px] text-ink-soft">{t.text}</span>
              </Link>
            ))}
            <Link href={l.catalog.href} className="card block p-5 no-underline hover:border-brand-500">
              <span className="text-sm font-semibold text-brand-700">Katalog firem</span>
              <strong className="mt-1 block text-ink">{l.catalog.label}</strong>
              <span className="mt-1 block text-[15px] text-ink-soft">Firmy z veřejných registrů a co pro ně EET 2.0 znamená.</span>
            </Link>
            {/* S5-SLUŽBY */}
            <Link href="/nastaveni-na-klic" className="card block p-5 no-underline hover:border-brand-500" data-service-cta="obor">
              <span className="text-sm font-semibold text-brand-700">Služba</span>
              <strong className="mt-1 block text-ink">Nastavení EET na klíč za {SETUP_SERVICE.priceLabel}</strong>
              <span className="mt-1 block text-[15px] text-ink-soft">Postup na míru pro DIS+ a certifikát, kontrola a příprava pokladny – písemně, bez telefonování.</span>
            </Link>
          </div>
          {guide && (
            <p className="mt-8 text-sm text-muted">
              Právní část vychází z návodu{" "}
              <Link href={`/navody/${guide.slug}`} className="underline underline-offset-2">
                {guide.h1 ?? guide.title}
              </Link>
              , který prošel odbornou revizí (
              <Link href={REVIEWER.path} className="underline underline-offset-2">
                {REVIEWER.name}
              </Link>
              , {REVIEWER.title}). Informativní přehled, nejde o daňové poradenství.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
