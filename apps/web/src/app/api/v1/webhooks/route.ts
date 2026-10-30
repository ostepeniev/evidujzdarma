import { z } from "zod";
import { apiRoute } from "@/lib/server/api/http";
import { ApiError } from "@/lib/server/api/errors";
import { WEBHOOK_EVENTS, createEndpoint, listEndpoints, urlRefusal } from "@/lib/server/webhooks";

export const WebhookCreateSchema = z.object({
  url: z.string().max(500),
  /** prázdné / chybí = všechny události */
  events: z.array(z.enum(WEBHOOK_EVENTS)).max(WEBHOOK_EVENTS.length).optional(),
});

/** POST /v1/webhooks – PMS si při připojení zaregistruje endpoint sám (S8, rozd. 8). Tajemství jen v této odpovědi. */
export const POST = apiRoute({ route: "/v1/webhooks", scope: "webhooks:manage" }, async (ctx) => {
  const parsed = WebhookCreateSchema.safeParse(await ctx.json());
  if (!parsed.success) throw new ApiError("invalid_request", parsed.error.issues[0]?.message ?? "Invalid webhook.", String(parsed.error.issues[0]?.path[0] ?? "url"));
  const refusal = await urlRefusal(parsed.data.url);
  if (refusal) throw new ApiError("invalid_request", refusal, "url");
  const { endpoint, secret } = await createEndpoint(ctx.integration.id, parsed.data.url, [...new Set(parsed.data.events ?? [])]);
  return { status: 201, body: { ...endpoint, secret } };
});

/** GET /v1/webhooks – endpointy této integrace (bez tajemství). */
export const GET = apiRoute({ route: "/v1/webhooks", scope: "webhooks:manage" }, async (ctx) => ({ body: { webhooks: await listEndpoints(ctx.integration.id) } }));
