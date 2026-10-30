import { z } from "zod";
import { schema } from "@ez/db";
import { createIntegration, integrationDto, integrationsState } from "@/lib/server/integrations";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

const CreateInput = z.object({
  name: z.string().trim().min(1, "Vyplňte název.").max(60),
  environment: z.enum(["test", "live"]),
  unitIds: z.array(z.string().uuid()).max(100),
  scopes: z.array(z.enum(schema.API_SCOPES)).min(1, "Vyberte alespoň jedno oprávnění."),
});

/** Integrace EET API účtu (S8, rozd. 7) – bez tokenů. */
export const GET = ownerRoute(async ({ accountId }) => Response.json(await integrationsState(accountId), { headers: { "cache-control": "no-store" } }));

/** Nová integrace. Token se vrací jen tady a jen jednou. */
export const POST = ownerRoute(async ({ req, user, accountId }) => {
  const input = await parseJson(req, CreateInput);
  const { integration, token } = await createIntegration(accountId, user.id, input);
  return Response.json({ integration: integrationDto(integration), token }, { headers: { "cache-control": "no-store" } });
});
