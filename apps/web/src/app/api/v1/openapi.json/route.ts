import { openApiDocument } from "@/lib/server/api/openapi";

/** GET /api/v1/openapi.json – specifikace EET API v1 (S8, rozd. 5.1), veřejná, bez tokenu. */
export function GET() {
  return Response.json(openApiDocument(), { headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
}
