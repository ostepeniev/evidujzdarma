/**
 * S8 rozd. 1 / 13 – migrace 0040 na databázi ve stavu před ní (migrace 0000–0039 s daty): zařízení, která už jsou,
 * dostanou kind = 'pos', tržby integration_id = null; nic dalšího se nemění.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, describe, expect, it } from "vitest";

const MIGRATIONS = fileURLToPath(new URL("../../../../packages/db/migrations", import.meta.url));
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Kopie složky migrací jen do daného indexu (včetně). */
function migrationsUpTo(idx: number): string {
  const dir = mkdtempSync(join(tmpdir(), "ez-mig-"));
  dirs.push(dir);
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journalPath = join(dir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { idx: number }[] };
  journal.entries = journal.entries.filter((e) => e.idx <= idx);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe("S8 – migration 0040 on an existing database", () => {
  it("gate: existing devices become kind = pos, existing sales keep integration_id null", async () => {
    const pg = new PGlite({ extensions: { pg_trgm } });
    await pg.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    const db = drizzle(pg);
    await migrate(db, { migrationsFolder: migrationsUpTo(39) });
    const acc = (await pg.query<{ id: string }>("insert into accounts (name) values ('Před S8') returning id")).rows[0]!.id;
    const unit = (await pg.query<{ id: string }>(`insert into evidence_units (account_id, type, label, fs_unit_id) values ('${acc}', 'stala_provozovna', 'Salon', 1) returning id`)).rows[0]!.id;
    const dev = (await pg.query<{ id: string }>(`insert into devices (account_id, unit_id, name, register_id, token_hash) values ('${acc}', '${unit}', 'Tablet', 'P1', 'x') returning id`)).rows[0]!.id;
    await pg.exec(
      `insert into sales (id, account_id, device_id, unit_id, register_id, fs_unit_id, sequence, sold_at, total, payments, evidenced_total, mode, deadline_at)
       values ('11111111-1111-4111-8111-111111111111', '${acc}', '${dev}', '${unit}', 'P1', 1, 'P1-1', now(), 100, '[]', 100, 'mock', now())`,
    );
    await migrate(db, { migrationsFolder: MIGRATIONS });
    const d = (await pg.query<{ kind: string; name: string; token_hash: string }>("select kind, name, token_hash from devices")).rows;
    expect(d).toEqual([{ kind: "pos", name: "Tablet", token_hash: "x" }]);
    const s = (await pg.query<{ integration_id: string | null; external_ref: string | null; total: string }>("select integration_id, external_ref, total::text as total from sales")).rows;
    expect(s).toEqual([{ integration_id: null, external_ref: null, total: "100" }]);
    for (const table of ["integrations", "api_sale_keys", "api_requests", "api_usage_daily", "api_rate_windows", "webhook_endpoints", "webhook_deliveries", "partner_apps", "oauth_codes"]) {
      expect((await pg.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n, table).toBe(0);
    }
    await pg.close();
  }, 60_000);
});
