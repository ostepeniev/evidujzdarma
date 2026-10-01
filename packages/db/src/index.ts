import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export * as schema from "./schema.ts";
export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __ezDb?: Db; __ezSql?: postgres.Sql };

/** Lazily created singleton (survives Next.js dev hot reloads). */
export function getDb(): Db {
  if (globalForDb.__ezDb) return globalForDb.__ezDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 30,
    prepare: true,
  });
  globalForDb.__ezSql = client;
  globalForDb.__ezDb = drizzle(client, { schema });
  return globalForDb.__ezDb;
}

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__ezSql?.end({ timeout: 5 });
  globalForDb.__ezDb = undefined;
  globalForDb.__ezSql = undefined;
}
