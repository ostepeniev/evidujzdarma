import { apiRoute } from "@/lib/server/api/http";
import { ApiError } from "@/lib/server/api/errors";
import { deleteEndpoint } from "@/lib/server/webhooks";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DELETE /v1/webhooks/{id} – smaže endpoint této integrace. */
export const DELETE = apiRoute({ route: "/v1/webhooks/{id}", scope: "webhooks:manage" }, async (ctx, params) => {
  if (!UUID_RE.test(params.id ?? "") || !(await deleteEndpoint(ctx.integration.id, params.id!))) throw new ApiError("webhook_not_found", "Webhook not found.");
  return { body: { ok: true } };
});
