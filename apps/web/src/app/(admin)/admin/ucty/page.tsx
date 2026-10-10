import { notFound } from "next/navigation";
import { isClosed } from "@/lib/launch";
import { auditView, currentAdmin, listAccounts, summarizeBySource } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

const date = (d: Date | null) => (d ? d.toLocaleDateString("uk-UA", { timeZone: "Europe/Prague" }) : "—");

/** Акаунти (R15.2): до відкриття каси порожньо; після – таблиця (IČO OSVČ – персональні дані, тому аудит). */
export default async function AdminAccounts() {
  const admin = await currentAdmin();
  if (!admin) notFound();
  if (isClosed("/pokladna")) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Акаунти</h1>
        <p className="card text-lg">Каса відкривається 2. 11.</p>
      </div>
    );
  }
  await auditView(admin, "/admin/ucty");
  const rows = await listAccounts();
  const bySource = summarizeBySource(rows);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Акаунти: {rows.length}</h1>
      {/* звідки приходять платні користувачі (R17.4, K9) */}
      <section className="card overflow-x-auto" aria-labelledby="dzherela">
        <h2 id="dzherela" className="text-xl font-semibold">
          За джерелом
        </h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                Джерело (utm_source)
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                Акаунти
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                З першою ostrou tržbou
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Premium
              </th>
            </tr>
          </thead>
          <tbody>
            {bySource.map((s) => (
              <tr key={s.source} className="border-t border-line">
                <td className="py-1.5 pr-3">{s.source}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{s.accounts}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{s.withProductionSale}</td>
                <td className="py-1.5 text-right tabular-nums">{s.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              {["Реєстрація", "Назва", "IČO", "Режим", "Сертифікат", "Jednotky", "Перша ostrá тржба", "Джерело", "Тариф"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-2 tabular-nums">{date(r.createdAt)}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 tabular-nums">{r.ico ?? "—"}</td>
                <td className="px-3 py-2">{r.mode}</td>
                <td className="px-3 py-2">{r.hasCertificate ? "так" : "ні"}</td>
                <td className="px-3 py-2 tabular-nums">{r.units}</td>
                <td className="px-3 py-2">{date(r.firstProductionSale)}</td>
                <td className="px-3 py-2">{r.source ?? "—"}</td>
                <td className="px-3 py-2">{r.plan === "free" ? "Zdarma" : r.plan === "premium" ? "Premium" : r.plan}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-muted">
                  Ще немає акаунтів.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
