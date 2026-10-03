import { HttpError, errorResponse, getCurrentUser } from "@/lib/server/auth";
import { acceptInvite } from "@/lib/server/cabinet";
import { requireSameOrigin } from "@/lib/server/route-helpers";

export async function POST(req: Request, ctx: RouteContext<"/api/pozvanka/[token]">) {
  try {
    requireSameOrigin(req); // i mimo proxy.ts (Д3-8)
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Nejste přihlášeni");
    const { token } = await ctx.params;
    return Response.json(await acceptInvite(user, token));
  } catch (e) {
    return errorResponse(e);
  }
}
