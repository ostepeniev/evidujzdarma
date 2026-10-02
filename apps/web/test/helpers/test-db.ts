/**
 * Integrační testy nad skutečným Postgresem v procesu (PGlite) se stejnými migracemi
 * jako produkce. Nepotřebuje běžící server, takže gate testy běží všude.
 */
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { __setDbForTests, schema } from "@ez/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const MIGRATIONS = fileURLToPath(new URL("../../../../packages/db/migrations", import.meta.url));

export interface TestDb {
  pg: PGlite;
  db: ReturnType<typeof drizzle<typeof schema>>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  process.env.DATABASE_URL ??= "pglite://memory";
  process.env.MASTER_KEY ??= Buffer.alloc(32, 7).toString("base64");
  process.env.APP_SECRET ??= "test-secret";
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  __setDbForTests(db);
  const tables = (await pg.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' and tablename not like '__drizzle%'")).rows.map((r) => `"${r.tablename}"`);
  return {
    pg,
    db,
    reset: async () => {
      await pg.exec(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
    },
    close: async () => {
      __setDbForTests(undefined);
      await pg.close();
    },
  };
}
