import "server-only";
import { getDb, schema } from "@ez/db";
import { and, eq, sql } from "drizzle-orm";
import type { Poll } from "@/content/polls";
import { hmac } from "./tokens";

export interface PollResults {
  poll: string;
  total: number;
  /** null, dokud není dost hlasů */
  percentages: Record<string, number> | null;
  myChoice: string | null;
}

export function voterHash(pollId: string, voterId: string): string {
  return hmac(`poll:${pollId}:${voterId}`);
}

export async function pollResults(poll: Poll, voterId?: string | null): Promise<PollResults> {
  const rows = await getDb()
    .select({ choice: schema.pollVotes.choice, n: sql<number>`count(*)::int` })
    .from(schema.pollVotes)
    .where(eq(schema.pollVotes.poll, poll.id))
    .groupBy(schema.pollVotes.choice);
  const total = rows.reduce((s, r) => s + r.n, 0);
  let percentages: Record<string, number> | null = null;
  if (total >= poll.minVotesToShow) {
    percentages = Object.fromEntries(poll.options.map((o) => [o.id, Math.round(((rows.find((r) => r.choice === o.id)?.n ?? 0) / total) * 100)]));
  }
  let myChoice: string | null = null;
  if (voterId) {
    const [mine] = await getDb()
      .select({ choice: schema.pollVotes.choice })
      .from(schema.pollVotes)
      .where(and(eq(schema.pollVotes.poll, poll.id), eq(schema.pollVotes.voterHash, voterHash(poll.id, voterId))))
      .limit(1);
    myChoice = mine?.choice ?? null;
  }
  return { poll: poll.id, total, percentages, myChoice };
}

/** Jeden hlas na prohlížeč; opakované hlasování hlas změní. */
export async function castVote(poll: Poll, voterId: string, choice: string): Promise<void> {
  await getDb()
    .insert(schema.pollVotes)
    .values({ poll: poll.id, choice, voterHash: voterHash(poll.id, voterId) })
    .onConflictDoUpdate({ target: [schema.pollVotes.poll, schema.pollVotes.voterHash], set: { choice } });
}
