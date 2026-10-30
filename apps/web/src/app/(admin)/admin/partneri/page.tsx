import { notFound } from "next/navigation";
import { PartnerForm } from "@/components/admin/partner-form";
import { currentAdmin } from "@/lib/server/admin";
import { listPartnerApps } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

/** Партнерські застосунки для «Připojit EvidujZdarma» (OAuth, S8 розд. 6). Перший партнер – ALiSiO. */
export default async function AdminPartners() {
  const admin = await currentAdmin();
  if (!admin) notFound();
  const apps = await listPartnerApps();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Партнери API (OAuth)</h1>
      <PartnerForm />
      <section className="card overflow-x-auto">
        {apps.length === 0 ? (
          <p>Партнерів поки немає.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Назва</th>
                <th className="py-1 pr-3 font-medium">client_id</th>
                <th className="py-1 pr-3 font-medium">redirect_uri</th>
                <th className="py-1 font-medium">Стан</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="py-1.5 pr-3">{a.name}</td>
                  <td className="py-1.5 pr-3 font-mono">{a.clientId}</td>
                  <td className="py-1.5 pr-3 break-all font-mono text-xs">{a.redirectUris.join(" ")}</td>
                  <td className="py-1.5">{a.active ? "активний" : "вимкнений"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
