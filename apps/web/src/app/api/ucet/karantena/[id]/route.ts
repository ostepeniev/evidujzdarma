import { z } from "zod";
import { resolveQuarantine } from "@/lib/server/quarantine";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

const Body = z.object({ action: z.enum(["retry", "retry_with_received_time", "dismiss"]), note: z.string().max(500).optional() });

export const POST = ownerRoute<{ id: string }>(async ({ req, accountId, params }) => {
  const body = await parseJson(req, Body);
  if (body.action === "dismiss" && !body.note?.trim()) return Response.json({ error: "Napište, jak jste tržbu vyřídili (např. evidována ručně v MOJE eet)." }, { status: 400 });
  return Response.json(await resolveQuarantine(accountId, params.id, body));
});
