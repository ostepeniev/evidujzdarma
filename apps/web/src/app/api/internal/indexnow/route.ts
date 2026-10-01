import sitemap from "@/app/sitemap";
import { submitToIndexNow } from "@/lib/server/indexnow";
import { safeEqual } from "@/lib/server/tokens";

/** Po nasazení: odešle URL z hlavní sitemapy přes IndexNow (POST, CRON_SECRET). */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  const urls = sitemap().map((e) => e.url);
  return Response.json(await submitToIndexNow(urls));
}
