import { notFound } from "next/navigation";
import { apiUsageThisMonth, auditView, currentAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** EET API: облік використання за поточний місяць (S8, розд. 11) – без білінгу. Назва акаунта = персональні дані → аудит. */
export default async function AdminApi() {
  const admin = await currentAdmin();
  if (!admin) notFound();
  await auditView(admin, "/admin/api");
  const { month, rows } = await apiUsageThisMonth();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">EET API · {month}</h1>
      <section className="card overflow-x-auto">
        {rows.length === 0 ? (
          <p>Інтеграцій поки немає.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">Інтеграція</th>
                <th scope="col" className="py-1 pr-3 font-medium">Акаунт</th>
                <th scope="col" className="py-1 pr-3 font-medium">Середовище</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Активні одиниці</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Тржби</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Запити</th>
                <th scope="col" className="py-1 font-medium">Стан</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5 pr-3">{r.name}</td>
                  <td className="py-1.5 pr-3">{r.accountName}</td>
                  <td className="py-1.5 pr-3">{r.environment}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.activeUnits}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.salesAccepted}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.requests}</td>
                  <td className="py-1.5">{r.revokedAt ? "відключена" : "активна"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
