import { errorResponse, getCurrentUser, HttpError } from "@/lib/server/auth";
import { AccountInput, accountState, upsertAccount } from "@/lib/server/account";
import { parseJson, requireSameOrigin } from "@/lib/server/route-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Nejste přihlášeni");
    return Response.json(await accountState(user));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req); // i mimo proxy.ts (Д3-8)
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Nejste přihlášeni");
    const input = await parseJson(req, AccountInput);
    await upsertAccount(user, input);
    return Response.json(await accountState((await getCurrentUser())!));
  } catch (e) {
    return errorResponse(e);
  }
}
