import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@ez/db";
import { HttpError, errorResponse, getCurrentUser } from "@/lib/server/auth";
import { requireAccountant } from "@/lib/server/cabinet";
import { assertUuidParam, parseJson } from "@/lib/server/route-helpers";

const Patch = z.object({
  label: z.string().trim().max(200).nullable().optional(),
  manualStatus: z
    .object({ disActivated: z.boolean().optional(), unitsAnnounced: z.boolean().optional(), certificate: z.boolean().optional(), firstSale: z.boolean().optional() })
    .optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/kabinet/klienti/[id]">) {
  try {
    const { id } = await ctx.params;
    assertUuidParam(id);
    const accountId = await requireAccountant(await getCurrentUser());
    const input = await parseJson(req, Patch);
    const [row] = await getDb()
      .update(schema.accountantClients)
      .set({ ...(input.label !== undefined ? { label: input.label } : {}), ...(input.manualStatus ? { manualStatus: input.manualStatus } : {}) })
      .where(and(eq(schema.accountantClients.id, id), eq(schema.accountantClients.accountantAccountId, accountId)))
      .returning({ id: schema.accountantClients.id });
    if (!row) throw new HttpError(404, "Klient nenalezen");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/kabinet/klienti/[id]">) {
  try {
    const { id } = await ctx.params;
    assertUuidParam(id);
    const accountId = await requireAccountant(await getCurrentUser());
    await getDb()
      .delete(schema.accountantClients)
      .where(and(eq(schema.accountantClients.id, id), eq(schema.accountantClients.accountantAccountId, accountId)));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
