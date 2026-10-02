import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { ensureRuntimeRole } from "./roles.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await client`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  console.log("migrations applied");
  // R3.12: web a worker se připojují rolí bez DDL; vlastník schématu ji tu založí a nastaví jí práva
  if (process.env.APP_DB_PASSWORD) {
    const role = await ensureRuntimeRole((sql) => client.unsafe(sql), {
      role: process.env.APP_DB_USER,
      password: process.env.APP_DB_PASSWORD,
    });
    console.log(`runtime role ${role}: SELECT/INSERT/UPDATE/DELETE, bez DDL`);
  } else {
    console.log("APP_DB_PASSWORD není nastaven – runtime role se nezakládá (vývoj)");
  }
} catch (e) {
  // jen zpráva: chyba postgres.js nese i text dotazu (u ALTER ROLE verifier hesla)
  console.error(`[migrate] ${e instanceof Error ? e.message : "chyba"}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
