import { hasDatabase } from "@ez/db";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPoll } from "@/content/polls";
import { HttpError, errorResponse } from "@/lib/server/auth";
import { castVote, pollResults } from "@/lib/server/polls";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { parseJson } from "@/lib/server/route-helpers";
import { randomToken } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

const VOTER_COOKIE = "ez_voter";
const VoteSchema = z.object({ poll: z.string().max(32), choice: z.string().max(16) });

export async function GET(req: Request) {
  try {
    if (!hasDatabase()) throw new HttpError(503, "Služba je dočasně nedostupná");
    const poll = getPoll(new URL(req.url).searchParams.get("poll") ?? "");
    if (!poll) throw new HttpError(404, "Anketa neexistuje");
    const voterId = (await cookies()).get(VOTER_COOKIE)?.value ?? null;
    return Response.json(await pollResults(poll, voterId), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    if (!hasDatabase()) throw new HttpError(503, "Služba je dočasně nedostupná");
    if (!rateLimit(`poll:${clientIp(req)}`, 10, 3600)) throw new HttpError(429, "Příliš mnoho hlasů z jedné adresy. Zkuste to později.");
    const body = await parseJson(req, VoteSchema);
    const poll = getPoll(body.poll);
    if (!poll) throw new HttpError(404, "Anketa neexistuje");
    if (!poll.options.some((o) => o.id === body.choice)) throw new HttpError(400, "Neplatná odpověď");

    const jar = await cookies();
    let voterId = jar.get(VOTER_COOKIE)?.value;
    if (!voterId || !/^[A-Za-z0-9_-]{16,64}$/.test(voterId)) {
      voterId = randomToken(18);
      jar.set(VOTER_COOKIE, voterId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 365 * 86_400,
      });
    }
    await castVote(poll, voterId, body.choice);
    return Response.json(await pollResults(poll, voterId));
  } catch (e) {
    return errorResponse(e);
  }
}
