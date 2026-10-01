export async function GET(_req: Request, ctx: RouteContext<"/api/indexnow/key/[key]">) {
  const { key } = await ctx.params;
  const expected = process.env.INDEXNOW_KEY;
  if (!expected || key !== expected) return new Response("Not found", { status: 404 });
  return new Response(expected, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
