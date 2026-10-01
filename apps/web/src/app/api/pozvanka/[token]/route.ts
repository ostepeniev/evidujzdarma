import { HttpError, errorResponse, getCurrentUser } from "@/lib/server/auth";
import { acceptInvite } from "@/lib/server/cabinet";

export async function POST(_req: Request, ctx: RouteContext<"/api/pozvanka/[token]">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Nejste přihlášeni");
    const { token } = await ctx.params;
    return Response.json(await acceptInvite(user, token));
  } catch (e) {
    return errorResponse(e);
  }
}
