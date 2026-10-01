import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { krajByCode } from "@ez/cz";
import { FirmList, Pagination } from "@/components/catalog/firm-list";
import { formatCount, isMonthParam, monthLabel, monthPath, pageParam } from "@/components/catalog/paths";
import { ListSource } from "@/components/catalog/list-source";
import { PageHeader } from "@/components/page-header";
import { PER_PAGE, foundingMonths, indexRegions, listFirms, todayIso, catalogDataDate } from "@/lib/server/catalog";

function regionsLabel(): string {
  const names = indexRegions()
    .map((c) => krajByCode(c)?.name)
    .filter(Boolean);
  return names.length > 3 ? "vybrané kraje" : names.join(", ");
}

function validMonth(mesic: string): boolean {
  return isMonthParam(mesic) && mesic <= todayIso().slice(0, 7);
}

export async function generateMetadata({ params, searchParams }: PageProps<"/firmy/nove/[mesic]">): Promise<Metadata> {
  const { mesic } = await params;
  if (!validMonth(mesic)) return {};
  const page = pageParam((await searchParams).strana);
  const { total } = await listFirms({ foundedMonth: mesic, onlyIndexRegions: true }, page, PER_PAGE).catch(() => ({ total: 0 }));
  return {
    title: `Nové firmy – ${monthLabel(mesic)}${page > 1 ? ` (strana ${page})` : ""}`,
    description: `Firmy a podnikatelé založení v období ${monthLabel(mesic)} (${regionsLabel()}) podle data vzniku v registru. EET 2.0 platí od 1. 1. 2027 – připravte se rovnou.`,
    alternates: { canonical: monthPath(mesic, page) },
    robots: total > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function NewFirmsPage({ params, searchParams }: PageProps<"/firmy/nove/[mesic]">) {
  const { mesic } = await params;
  if (!validMonth(mesic)) notFound();
  const page = pageParam((await searchParams).strana);
  const [{ items, total }, months, dataDate] = await Promise.all([
    listFirms({ foundedMonth: mesic, onlyIndexRegions: true }, page, PER_PAGE).catch(() => ({ items: [], total: 0 })),
    foundingMonths(12).catch(() => []),
    catalogDataDate().catch(() => null),
  ]);
  if (page > 1 && items.length === 0) notFound();

  return (
    <>
      <PageHeader
        title={`Nové firmy – ${monthLabel(mesic)}`}
        crumbs={[
          { name: "Katalog firem", path: "/firmy" },
          { name: `Nové firmy ${monthLabel(mesic)}`, path: monthPath(mesic) },
        ]}
        lead={
          <>
            Subjekty s datem vzniku v období {monthLabel(mesic)} ({regionsLabel()}). Počet: <strong>{formatCount(total)}</strong>.
          </>
        }
      />

      <div className="container-page space-y-10 py-10">
        <aside className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-ink">Začínáte podnikat? Vítejte!</h2>
          <p className="mt-2 max-w-2xl text-lg text-ink-soft">
            Od 1. 1. 2027 platí EET 2.0. Pokud přijímáte platby osobně – hotově, kartou nebo QR kódem na místě – zkontrolujte, co musíte udělat,
            a evidujte v pokladně zdarma.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/kontrola-ico" className="btn-primary">
              Zkontrolovat IČO
            </Link>
            <Link href="/#registrace" className="btn-secondary">
              Pokladna zdarma – předregistrace
            </Link>
          </div>
        </aside>

        <section aria-labelledby="seznam">
          <h2 id="seznam" className="mb-4 text-xl font-bold">
            Založeno v období {monthLabel(mesic)}
          </h2>
          {items.length > 0 ? (
            <FirmList items={items} showRegion showFounded />
          ) : (
            <p className="rounded-2xl bg-surface p-5 text-ink-soft">Pro toto období zatím nemáme v katalogu žádné nové subjekty.</p>
          )}
          <Pagination page={page} total={total} perPage={PER_PAGE} href={(p) => monthPath(mesic, p)} />
          <ListSource date={dataDate} />
        </section>

        {months.length > 1 && (
          <nav aria-label="Další měsíce">
            <h2 className="mb-3 text-lg font-bold">Další měsíce</h2>
            <ul className="flex flex-wrap gap-2">
              {months
                .filter((m) => m.month !== mesic)
                .map((m) => (
                  <li key={m.month}>
                    <Link href={monthPath(m.month)} className="inline-block rounded-full border border-line bg-white px-4 py-2 text-[15px] hover:border-brand-500 hover:bg-brand-50">
                      {monthLabel(m.month)}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}
