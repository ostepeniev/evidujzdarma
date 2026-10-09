import { notFound } from "next/navigation";
import { isClosed } from "@/lib/launch";
import { auditView, currentAdmin, listAccounts } from "@/lib/server/admin";

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
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Акаунти: {rows.length}</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              {["Реєстрація", "Назва", "IČO", "Режим", "Сертифікат", "Jednotky", "Перша ostrá тржба"].map((h) => (
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
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-muted">
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
