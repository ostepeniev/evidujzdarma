import "server-only";
import { getDb, schema } from "@ez/db";
import { and, eq } from "drizzle-orm";

/** E-maily vlastníků účtu (pro upozornění). */
export async function ownerEmails(accountId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ email: schema.users.email })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.accountId, accountId), eq(schema.memberships.role, "owner")));
  return rows.map((r) => r.email);
}
