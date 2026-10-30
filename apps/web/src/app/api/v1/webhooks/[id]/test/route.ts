import { apiRoute } from "@/lib/server/api/http";
import { ApiError } from "@/lib/server/api/errors";
import { emitTest } from "@/lib/server/webhooks";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /v1/webhooks/{id}/test – testovací událost webhook.test (doručí ji cron do minuty). */
export const POST = apiRoute({ route: "/v1/webhooks/{id}/test", scope: "webhooks:manage" }, async (ctx, params) => {
  if (!UUID_RE.test(params.id ?? "") || !(await emitTest(ctx.integration.id, params.id!))) throw new ApiError("webhook_not_found", "Webhook not found.");
  return { status: 202, body: { queued: true } };
});
