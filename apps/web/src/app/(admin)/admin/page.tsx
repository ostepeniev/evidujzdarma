import Link from "next/link";
import { notFound } from "next/navigation";
import { currentAdmin } from "@/lib/server/admin";
import { trafficReport, type TrafficReport } from "@/lib/server/analytics";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;
const DEVICE: Record<string, string> = { mobile: "телефон", tablet: "планшет", desktop: "комп'ютер" };
const nf = (n: number) => n.toLocaleString("uk-UA");
const seconds = (s: number | null) => (s === null ? "—" : s < 60 ? `${s} с` : `${Math.floor(s / 60)} хв ${s % 60} с`);

/** Огляд (R15.2): відвідуваність лише з агрегатів по днях – без персональних даних, тому без запису в аудит. */
export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  if (!(await currentAdmin())) notFound();
  const { d } = await searchParams;
  const days = PERIODS.find((p) => String(p) === d) ?? 30;
  const r = await trafficReport(days);
  const funnel = [
    { label: "Відвідувачі", value: r.visitors },
    { label: "Перевірки IČO", value: r.events.ico_check },
    { label: "Передреєстрації", value: r.events.prereg_submitted },
    { label: "Підтверджені", value: r.events.prereg_confirmed },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Огляд</h1>
        <nav aria-label="Період" className="flex gap-1">
          {PERIODS.map((p) => (
            <Link key={p} href={`/admin?d=${p}`} aria-current={p === days ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-[15px] ${p === days ? "bg-brand-600 text-white" : "border border-line bg-white text-ink-soft"}`}>
              {p} днів
            </Link>
          ))}
        </nav>
      </div>

      <section className="grid gap-4 sm:grid-cols-4" aria-label="Підсумок">
        <Stat label="Перегляди" value={nf(r.views)} />
        <Stat label="Відвідувачі (сума за дні)" value={nf(r.visitors)} />
        <Stat label="Квіз пройдено" value={nf(r.events.quiz_done)} />
        <Stat label="Калькулятор" value={nf(r.events.calculator_used)} />
      </section>

      <section className="card" aria-labelledby="den">
        <h2 id="den" className="text-xl font-semibold">
          Перегляди і відвідувачі по днях
        </h2>
        <DailyChart daily={r.daily} />
      </section>

      <section className="card" aria-labelledby="voronka">
        <h2 id="voronka" className="text-xl font-semibold">
          Воронка
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-4">
          {funnel.map((f, i) => (
            <li key={f.label} className="rounded-xl bg-surface p-4">
              <p className="text-sm text-muted">{f.label}</p>
              <p className="text-2xl font-bold">{nf(f.value)}</p>
              {i > 0 && funnel[i - 1]!.value > 0 && <p className="text-sm text-muted">{Math.round((f.value / funnel[i - 1]!.value) * 100)} % від попереднього</p>}
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-x-auto" aria-labelledby="stranky">
          <h2 id="stranky" className="text-xl font-semibold">
            Топ сторінок
          </h2>
          <table className="mt-4 w-full text-left text-[15px]">
            <thead>
              <tr className="text-muted">
                <th className="py-1 pr-3 font-medium">Сторінка</th>
                <th className="py-1 pr-3 text-right font-medium">Перегляди</th>
                <th className="py-1 pr-3 text-right font-medium">Відвідувачі</th>
                <th className="py-1 text-right font-medium">Сер. час</th>
              </tr>
            </thead>
            <tbody>
              {r.pages.slice(0, 30).map((p) => (
                <tr key={p.path} className="border-t border-line">
                  <td className="py-1.5 pr-3 font-mono text-sm">{p.path}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{nf(p.views)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{nf(p.visitors)}</td>
                  <td className="py-1.5 text-right tabular-nums">{seconds(p.avgSeconds)}</td>
                </tr>
              ))}
              {!r.pages.length && (
                <tr>
                  <td colSpan={4} className="py-3 text-muted">
                    Ще немає даних.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <div className="space-y-8">
          <Breakdown title="Джерела переходів" rows={r.referrers.map((x) => ({ key: x.domain, views: x.views }))} empty="Лише прямі заходи." />
          <Breakdown title="Пристрої" rows={r.devices.map((x) => ({ key: DEVICE[x.device] ?? x.device, views: x.views }))} empty="Ще немає даних." />
        </div>
      </div>
      <p className="text-sm text-muted">
        Без cookies і без IP: відвідувач за день — анонімний відбиток на один день (лише в пам&apos;яті сервера). Відвідувачі за період — сума
        денних, одна людина за кілька днів рахується кілька разів. Боти, Do Not Track і Global Privacy Control не враховуються.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: { key: string; views: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <section className="card">
      <h2 className="text-xl font-semibold">{title}</h2>
      {rows.length ? (
        <ul className="mt-4 space-y-2">
          {rows.slice(0, 15).map((r) => (
            <li key={r.key}>
              <div className="flex justify-between gap-3 text-[15px]">
                <span className="truncate">{r.key}</span>
                <span className="tabular-nums">{nf(r.views)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-surface">
                <div className="h-1.5 rounded bg-brand-500" style={{ width: `${(r.views / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-muted">{empty}</p>
      )}
    </section>
  );
}

/** Стовпчики = перегляди, лінія = відвідувачі; під графіком та сама інформація таблицею для скрінрідерів. */
function DailyChart({ daily }: { daily: TrafficReport["daily"] }) {
  const W = 720;
  const H = 180;
  const max = Math.max(1, ...daily.map((d) => d.views));
  const step = W / daily.length;
  const y = (v: number) => H - (v / max) * (H - 10);
  const line = daily.map((d, i) => `${(i + 0.5) * step},${y(d.visitors)}`).join(" ");
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="mt-4 w-full" role="img" aria-label="Графік переглядів і відвідувачів по днях">
        {daily.map((d, i) => (
          <rect key={d.day} x={i * step + step * 0.15} y={y(d.views)} width={step * 0.7} height={H - y(d.views)} className="fill-brand-200">
            <title>{`${d.day}: ${d.views} переглядів, ${d.visitors} відвідувачів`}</title>
          </rect>
        ))}
        <polyline points={line} fill="none" strokeWidth={2} className="stroke-brand-700" />
        <text x={0} y={H + 16} className="fill-muted text-[11px]">
          {daily[0]?.day}
        </text>
        <text x={W} y={H + 16} textAnchor="end" className="fill-muted text-[11px]">
          {daily[daily.length - 1]?.day}
        </text>
      </svg>
      <p className="mt-2 text-sm text-muted">Стовпчики — перегляди, лінія — відвідувачі. Максимум за день: {nf(max)}.</p>
      <table className="sr-only">
        <caption>Перегляди і відвідувачі по днях</caption>
        <tbody>
          {daily.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.views}</td>
              <td>{d.visitors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
