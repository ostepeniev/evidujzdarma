import { registerDevice } from "@/lib/server/account";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";
import { DeviceInput } from "@/lib/server/schemas";

/** Zaregistruje toto zařízení jako pokladnu. Token vracíme jen jednou — uloží se v zařízení. */
export const POST = ownerRoute(async ({ req, accountId }) => {
  const input = await parseJson(req, DeviceInput);
  const { deviceId, token } = await registerDevice(accountId, input);
  return Response.json({ deviceId, token });
});
