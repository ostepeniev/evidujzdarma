import { notFound } from "next/navigation";
import { CrmEditor } from "@/components/admin/crm-editor";
import { INDUSTRIES } from "@/content/industries";
import { PREREG_STATUSES, auditView, currentAdmin, listPreregistrations, statusLabel } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

const NEEDS: Record<string, string> = { terminal: "термінал", printer: "принтер", dis_help: "допомога з DIS+" };
const date = (d: Date | null) => (d ? d.toLocaleDateString("uk-UA", { timeZone: "Europe/Prague" }) : "—");
const industryLabel = (slug: string | null) => (slug ? (INDUSTRIES.find((i) => i.slug === slug)?.label ?? slug) : "—");

/** Передреєстрації (R15.2): персональні дані – кожен перегляд пишеться в аудит. */
export default async function AdminPreregistrations() {
  const admin = await currentAdmin();
  if (!admin) notFound();
  await auditView(admin, "/admin/predregistrace");
  const rows = await listPreregistrations();
  const external = rows.filter((r) => !r.internal);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Передреєстрації: {external.length}</h1>
          <p className="mt-1 text-[15px] text-muted">
            Підтверджені: {external.filter((r) => r.confirmedAt).length}. Внутрішні адреси (@swipescape.eu і з «+») не враховано: {rows.length - external.length}.
          </p>
        </div>
        <a href="/admin/predregistrace/csv" className="btn-secondary">
          Експорт CSV
        </a>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              {["Дата", "E-mail", "IČO", "Фірма (ARES)", "Обор", "Provozovny", "Потреби", "Підтверджено", "Відписався", "Джерело (utm)", "Статус і нотатка"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-3 py-2 tabular-nums">{date(r.createdAt)}</td>
                <td className="px-3 py-2">
                  {r.email}
                  {r.internal && <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-xs text-muted">внутрішній</span>}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.ico ?? "—"}</td>
                <td className="px-3 py-2">{r.companyName ?? "—"}</td>
                <td className="px-3 py-2">{industryLabel(r.industry)}</td>
                <td className="px-3 py-2">{r.establishmentsCount ?? "—"}</td>
                <td className="px-3 py-2">{r.needs.length ? r.needs.map((n) => NEEDS[n] ?? n).join(", ") : "—"}</td>
                <td className="px-3 py-2">{date(r.confirmedAt)}</td>
                <td className="px-3 py-2">{date(r.unsubscribedAt)}</td>
                <td className="px-3 py-2">{r.source ?? "—"}</td>
                <td className="px-3 py-2">
                  <p className="sr-only">{statusLabel(r.crmStatus)}</p>
                  <CrmEditor id={r.id} status={r.crmStatus} note={r.crmNote ?? ""} statuses={PREREG_STATUSES} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-muted">
                  Ще немає передреєстрацій.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
