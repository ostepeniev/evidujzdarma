import { notFound } from "next/navigation";
import { OrderStatusEditor } from "@/components/admin/order-status";
import { ACCOUNTANT_SETUP_REWARD } from "@/content/services";
import { auditView, currentAdmin } from "@/lib/server/admin";
import { adminServiceOrders, orderReward, SERVICE_ORDER_STATUS_LABEL, SERVICE_ORDER_STATUSES } from "@/lib/server/service-orders";

export const dynamic = "force-dynamic";

const STATUSES = SERVICE_ORDER_STATUSES.map((v) => ({ value: v, label: SERVICE_ORDER_STATUS_LABEL[v] }));
const fmt = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Prague" });

/**
 * S11: замовлення послуг з /nastaveni-na-klic (service_orders). Стан змінює лише адмін; «hotovo» у «Nastavení na klíč»
 * дає бухгалтерці, що порекомендувала клієнта, винагороду (виплата вручну – сума по кожній канцелярії нижче).
 */
export default async function AdminServiceOrders() {
  const admin = await currentAdmin();
  if (!admin) notFound();
  await auditView(admin, "/admin/nastaveni");
  const orders = await adminServiceOrders();
  const byReferrer = new Map<string, number>();
  for (const o of orders) {
    const r = orderReward(o);
    if (r && o.referrerName) byReferrer.set(o.referrerName, (byReferrer.get(o.referrerName) ?? 0) + r);
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Замовлення послуг</h1>
      <p className="text-ink-soft">
        Стан бачить і бухгалтерка, що надіслала посилання (кабінет → «Doporučená nastavení»). За кожне «hotovo» в «Nastavení na klíč» – {ACCOUNTANT_SETUP_REWARD} Kč,
        виплата вручну.
      </p>
      {byReferrer.size > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">До виплати бухгалтеркам (усього, без урахування вже виплаченого)</h2>
          <ul className="text-sm">
            {[...byReferrer].map(([name, sum]) => (
              <li key={name}>
                {name}: {sum} Kč
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card overflow-x-auto">
        {orders.length === 0 ? (
          <p>Замовлень поки немає.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Дата</th>
                <th className="py-1 pr-3 font-medium">Послуга</th>
                <th className="py-1 pr-3 font-medium">E-mail</th>
                <th className="py-1 pr-3 font-medium">Фірма / IČO</th>
                <th className="py-1 pr-3 font-medium">Бухгалтерка</th>
                <th className="py-1 font-medium">Стан</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmt.format(o.createdAt)}</td>
                  <td className="py-1.5 pr-3">{o.package}</td>
                  <td className="py-1.5 pr-3 break-all">{o.email}</td>
                  <td className="py-1.5 pr-3">
                    {o.companyName ?? "—"}
                    {o.ico && <span className="block text-muted">{o.ico}</span>}
                  </td>
                  <td className="py-1.5 pr-3">{o.referrerName ? `${o.referrerName} (${o.refCode})` : "—"}</td>
                  <td className="py-1.5">
                    <OrderStatusEditor id={o.id} status={o.status} statuses={STATUSES} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
