import { errorResponse, getCurrentUser } from "@/lib/server/auth";
import { createInvite, requireAccountant } from "@/lib/server/cabinet";
import { SITE_URL } from "@/lib/site";

/** Vytvoří osobní odkaz pro klienta. Klient se přes něj propojí s účetní. */
export async function POST(_req: Request, ctx: RouteContext<"/api/kabinet/klienti/[id]/pozvanka">) {
  try {
    const accountId = await requireAccountant(await getCurrentUser());
    const { id } = await ctx.params;
    const token = await createInvite(accountId, id);
    return Response.json({ url: `${SITE_URL}/pozvanka/${token}` });
  } catch (e) {
    return errorResponse(e);
  }
}
