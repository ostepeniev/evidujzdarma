import { hasDatabase } from "@ez/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { FACTS, SOURCES } from "@/content/facts";
import { STATUS_LABEL, SLOW_MS, type ProbeStatus } from "@/lib/fs-status";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { statusSummary, type EnvSummary } from "@/lib/server/fs-monitor";
import { ExternalLink } from "@/components/external-link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Je EET dole? Stav systému evidence tržeb",
  description:
    "Funguje EET právě teď? Nezávislé měření dostupnosti rozhraní Finanční správy pro evidenci tržeb každých 5 minut: aktuální stav, odezva, dostupnost za 30 dní a historie výpadků.",
  alternates: { canonical: "/stav-eet" },
};

const ENV_INFO: Record<EnvSummary["environment"], { title: string; host: string; note: string }> = {
  production: { title: "Ostrý provoz", host: "trzbyeet.gov.cz", note: "Rozhraní, přes které pokladny evidují skutečné tržby." },
  playground: {
    title: "Playground (test)",
    host: "pg.trzbyeet.gov.cz",
    note: "Testovací prostředí pro vývojáře. Podle provozních informací FS má servisní okno každý čtvrtek 20:00–6:00.",
  },
};

const TONE: Record<ProbeStatus, string> = {
  up: "bg-brand-600 text-white",
  slow: "bg-sun-300 text-ink",
  down: "bg-danger-600 text-white",
};

const FAQ = [
  {
    q: "EET nefunguje – co mám dělat?",
    a: `Prodávejte dál. ${FACTS.offline.summary} Pokladna EvidujZdarma tržby při výpadku uloží v zařízení a odešle je sama, jakmile rozhraní znovu odpovídá.`,
  },
  { q: "Jak dlouho mám čekat na odpověď Finanční správy?", a: FACTS.offline.responseTimeout },
  {
    q: "Jak měříte dostupnost?",
    a: "Každých 5 minut pošleme z našeho serveru v EU jednoduchý požadavek na adresu rozhraní EET a změříme, zda a jak rychle server odpoví. Neodesíláme žádné tržby. Výpadek hlásíme až po dvou neúspěšných měřeních po sobě. Měření ukazuje dostupnost ze sítě našeho serveru – u vašeho připojení se může lišit.",
  },
  {
    q: "Je to oficiální stránka Finanční správy?",
    a: "Ne. EvidujZdarma je nezávislá služba. Oficiální informace o plánovaných odstávkách zveřejňuje Finanční správa na eet.gov.cz.",
  },
];

const fmtTime = (d: Date) => d.toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("cs-CZ")} %`);

function ago(d: Date, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (min < 1) return "před chvílí";
  if (min < 60) return `před ${min} min`;
  return `před ${Math.round(min / 60)} h`;
}

function duration(start: Date, end: Date | null, now: Date): string {
  const min = Math.max(1, Math.round(((end ?? now).getTime() - start.getTime()) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

function EnvCard({ s, now }: { s: EnvSummary; now: Date }) {
  const info = ENV_INFO[s.environment];
  const status = s.latest?.status as ProbeStatus | undefined;
  const max = Math.max(SLOW_MS, ...s.hourly.map((h) => h.avgMs ?? 0));
  return (
    <section className="card" aria-labelledby={`env-${s.environment}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`env-${s.environment}`} className="text-xl font-bold text-ink">
            {info.title}
          </h2>
          <p className="font-mono text-sm text-muted">{info.host}</p>
        </div>
        {status ? (
          <span className={`chip px-3 py-1 text-sm ${TONE[status]}`}>{STATUS_LABEL[status]}</span>
        ) : (
          <span className="chip bg-surface-2 px-3 py-1 text-sm text-ink-soft">Zatím neměřeno</span>
        )}
      </div>
      <p className="mt-3 text-[15px] text-ink-soft">{info.note}</p>
      {s.latest && (
        <p className="mt-2 text-sm text-muted">
          Poslední měření {ago(s.latest.checkedAt, now)} ({fmtTime(s.latest.checkedAt)})
          {s.latest.latencyMs !== null && <> · odezva {s.latest.latencyMs.toLocaleString("cs-CZ")} ms</>}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        {[
          ["24 hodin", s.uptime.h24],
          ["7 dní", s.uptime.d7],
          ["30 dní", s.uptime.d30],
        ].map(([label, v]) => (
          <div key={label as string} className="rounded-xl bg-surface p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{pct(v as number | null)}</dd>
          </div>
        ))}
      </dl>

      <figure className="mt-5">
        <div className="flex h-20 items-end gap-[3px]" role="img" aria-label="Průměrná odezva po hodinách za posledních 24 hodin">
          {s.hourly.map((h) => (
            <div
              key={h.hour.toISOString()}
              title={`${fmtTime(h.hour)}: ${h.down ? "výpadek" : h.avgMs === null ? "bez dat" : `${h.avgMs} ms`}`}
              className={`flex-1 rounded-sm ${h.down ? "bg-danger-600" : h.avgMs === null ? "bg-surface-2" : h.avgMs > SLOW_MS ? "bg-sun-500" : "bg-brand-500"}`}
              style={{ height: h.down ? "100%" : h.avgMs === null ? "8%" : `${Math.max(8, Math.round((h.avgMs / max) * 100))}%` }}
            />
          ))}
        </div>
        <figcaption className="mt-1 flex justify-between text-xs text-muted">
          <span>před 24 h</span>
          <span>odezva po hodinách · červeně výpadek</span>
          <span>teď</span>
        </figcaption>
      </figure>
    </section>
  );
}

export default async function StatusPage() {
  const now = new Date();
  const summary = hasDatabase() ? await statusSummary(now).catch(() => null) : null;
  const allIncidents = (summary ?? []).flatMap((s) => s.incidents.map((i) => ({ ...i, environment: s.environment })));
  allIncidents.sort((a, b) => b.start.getTime() - a.start.getTime());

  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="Je EET dole?"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "Stav EET", path: "/stav-eet" },
        ]}
        lead="Nezávislé měření dostupnosti rozhraní Finanční správy pro evidenci tržeb. Měříme každých 5 minut z našeho serveru v EU."
      />
      <div className="container-page space-y-10 py-10">
        {!summary ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Měření se právě spouští. Zkuste stránku otevřít za pár minut.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {summary.map((s) => (
              <EnvCard key={s.environment} s={s} now={now} />
            ))}
          </div>
        )}

        <section aria-labelledby="vypadky" className="max-w-3xl">
          <h2 id="vypadky" className="text-2xl font-bold">
            Výpadky za posledních 30 dní
          </h2>
          {allIncidents.length === 0 ? (
            <p className="mt-3 text-ink-soft">Žádný výpadek jsme nezaznamenali.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
              {allIncidents.map((i) => (
                <li key={`${i.environment}-${i.start.toISOString()}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <span className="font-medium text-ink">
                    {ENV_INFO[i.environment].title}: {fmtTime(i.start)}
                    {i.end ? ` – ${fmtTime(i.end)}` : " – trvá"}
                  </span>
                  <span className={`chip ${i.end ? "bg-surface-2 text-ink-soft" : "bg-danger-600 text-white"}`}>{duration(i.start, i.end, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="max-w-3xl rounded-2xl bg-brand-50 p-6">
          <h2 className="text-xl font-bold text-ink">Co dělat, když EET nefunguje</h2>
          <p className="mt-2 text-ink-soft">{FACTS.offline.summary}</p>
          <p className="mt-2 text-ink-soft">{FACTS.offline.responseTimeout}</p>
          <Link href="/navody/eet-bez-internetu" className="btn-secondary mt-4 py-2 text-[15px]">
            Návod: EET bez internetu →
          </Link>
        </section>

        <section className="max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Časté otázky</h2>
          <Faq items={FAQ} />
          <p className="mt-4 text-sm text-muted">
            Zdroje:{" "}
            <ExternalLink href={SOURCES.prakticke.url} className="underline">
              {SOURCES.prakticke.label}
            </ExternalLink>
            . Data o stavu jsou k dispozici i strojově na{" "}
            <a href="/api/stav-eet" className="underline">
              /api/stav-eet
            </a>
            .
          </p>
        </section>
        <ToolCta text="Pokladna EvidujZdarma při výpadku EET prodává dál: tržby uloží a odešle je sama do 48 hodin. Zdarma navždy." />
      </div>
    </>
  );
}
