import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { max: 1 });
await client`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
await migrate(drizzle(client), {
  migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
});
await client.end();
console.log("migrations applied");
