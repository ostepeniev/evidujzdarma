/**
 * R3.12 – runtime (web, worker) jede pod rolí, která smí jen číst a zapisovat řádky.
 * Schéma mění jen vlastník při migraci; heslo role se ukládá jako SCRAM verifier.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureRuntimeRole } from "@ez/db/roles";
import { createTestDb, type TestDb } from "../helpers/test-db";

const ROLE = "ez_app_test";
const PASSWORD = "0123456789abcdef0123456789abcdef";

let t: TestDb;
const exec = async (sql: string) => (await t.pg.query<Record<string, unknown>>(sql)).rows;

async function asApp(sql: string) {
  await t.pg.exec(`SET ROLE ${ROLE}`);
  try {
    return await t.pg.query(sql);
  } finally {
    await t.pg.exec("RESET ROLE");
  }
}

beforeAll(async () => {
  t = await createTestDb();
  await ensureRuntimeRole(exec, { role: ROLE, password: PASSWORD });
});
afterAll(async () => {
  await t.close();
});

describe("R3.12 – runtime DB role", () => {
  it("can read, insert, update and delete rows of application tables", async () => {
    await expect(asApp("select count(*) from sales")).resolves.toBeTruthy();
    await expect(asApp("insert into accounts select * from accounts where false")).resolves.toBeTruthy();
    await expect(asApp("update sales set status = status where false")).resolves.toBeTruthy();
    await expect(asApp("delete from sale_attempts where false")).resolves.toBeTruthy();
  });

  it("cannot create, alter, drop or truncate anything", async () => {
    await expect(asApp("create table hack (id int)")).rejects.toThrow(/permission denied/);
    await expect(asApp("alter table sales add column hack int")).rejects.toThrow(/must be owner/);
    await expect(asApp("drop table sale_attempts")).rejects.toThrow(/must be owner/);
    await expect(asApp("truncate sales")).rejects.toThrow(/permission denied/);
    await expect(asApp("create index hack on sales (id)")).rejects.toThrow(/must be owner/);
  });

  it("cannot touch the migration journal", async () => {
    await expect(asApp("select * from drizzle.__drizzle_migrations")).rejects.toThrow(/permission denied/);
  });

  it("tables added by a later migration are granted automatically", async () => {
    await t.pg.exec("create table r312_later (id int)");
    await expect(asApp("insert into r312_later values (1)")).resolves.toBeTruthy();
    await t.pg.exec("drop table r312_later");
  });

  it("is not a superuser, cannot create roles or databases and does not inherit the owner", async () => {
    const [r] = await exec(
      `select rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin, pg_has_role('${ROLE}', current_user, 'USAGE') as inherits_owner from pg_roles where rolname = '${ROLE}'`,
    );
    expect(r).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolcanlogin: true, inherits_owner: false });
  });

  it("is idempotent and stores a SCRAM verifier, never the password itself", async () => {
    await ensureRuntimeRole(exec, { role: ROLE, password: PASSWORD });
    const [r] = await exec(`select rolpassword from pg_authid where rolname = '${ROLE}'`);
    expect(String(r!.rolpassword)).toMatch(/^SCRAM-SHA-256\$4096:/);
    expect(String(r!.rolpassword)).not.toContain(PASSWORD);
  });

  it("refuses a weak or URL-unsafe password and a pre-existing role with elevated rights", async () => {
    await expect(ensureRuntimeRole(exec, { role: ROLE, password: "short" })).rejects.toThrow(/APP_DB_PASSWORD/);
    await expect(ensureRuntimeRole(exec, { role: ROLE, password: "abc/def+ghi=jkl0123456789abcd" })).rejects.toThrow(/APP_DB_PASSWORD/);
    await expect(ensureRuntimeRole(exec, { role: "Bad-Name", password: PASSWORD })).rejects.toThrow(/APP_DB_USER/);
    await t.pg.exec("create role ez_too_strong createdb");
    await expect(ensureRuntimeRole(exec, { role: "ez_too_strong", password: PASSWORD })).rejects.toThrow(/CREATEDB/);
    await expect(ensureRuntimeRole(exec, { role: "postgres", password: PASSWORD })).rejects.toThrow(/vlastník/);
  });

  it("error messages never contain the password", async () => {
    const secret = "S3cretS3cretS3cretS3cret/"; // neplatné (lomítko) → chyba
    const err = await ensureRuntimeRole(exec, { role: ROLE, password: secret }).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain("S3cret");
  });
});
