import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { ownerRoute } from "@/lib/server/route-helpers";

/** Odpojí zařízení (ztracený telefon apod.) — jeho token přestane platit. */
export const DELETE = ownerRoute<{ id: string }>(async ({ accountId, params }) => {
  await getDb()
    .update(schema.devices)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.devices.id, params.id), eq(schema.devices.accountId, accountId)));
  return Response.json({ ok: true });
});
