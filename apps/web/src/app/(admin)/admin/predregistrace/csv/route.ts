import { auditView, currentAdmin, listPreregistrations, preregCsv } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** Експорт передреєстрацій у CSV (R15.2) – лише для адміна, кожне завантаження пишеться в аудит. */
export async function GET(_req: Request) {
  const admin = await currentAdmin();
  if (!admin) return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  await auditView(admin, "/admin/predregistrace/csv");
  const body = preregCsv(await listPreregistrations());
  const day = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${body}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="predregistrace-${day}.csv"`,
      "cache-control": "no-store, private",
    },
  });
}
