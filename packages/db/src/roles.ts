/**
 * R3.12: web a worker jedou pod rolí, která smí jen číst a zapisovat řádky (SELECT/INSERT/UPDATE/DELETE).
 * Schéma mění jen vlastník při migraci. Kdo ovládne runtime, nesmaže ani nezmění tabulky a nedostane se
 * k žurnálu migrací.
 *
 * Heslo role se do SQL posílá jako SCRAM-SHA-256 verifier (RFC 5802/7677, formát PostgreSQL),
 * takže se v otevřené podobě neobjeví ani v logu serveru (log_statement), ani v chybě.
 */
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

export const RUNTIME_ROLE = "evidujzdarma_app";

const ROLE_RE = /^[a-z_][a-z0-9_]{0,62}$/;
/** Bez znaků, které by v DATABASE_URL vyžadovaly escapování (/, @, :, +, =). */
const PASSWORD_RE = /^[A-Za-z0-9._~-]{24,128}$/;
const VERIFIER_RE = /^SCRAM-SHA-256\$\d+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

export function scramSha256Verifier(password: string, salt: Buffer = randomBytes(16), iterations = 4096): string {
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Příkazy pro roli `role` (název už ověřený) s právy na řádky v tabulkách, které vlastní `owner`. */
export function runtimeRoleStatements(role: string, owner: string, verifier: string): string[] {
  if (!ROLE_RE.test(role) || !VERIFIER_RE.test(verifier)) throw new Error("runtimeRoleStatements: neplatný vstup");
  const o = ident(owner);
  return [
    // nová role má výchozí NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${literal(role)}) THEN CREATE ROLE ${role}; END IF; END $$`,
    `ALTER ROLE ${role} WITH LOGIN PASSWORD ${literal(verifier)}`,
    `DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO ${role}', current_database()); END $$`,
    `REVOKE CREATE ON SCHEMA public FROM PUBLIC`,
    `REVOKE CREATE ON SCHEMA public FROM ${role}`,
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${o} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${o} IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${role}`,
  ];
}

export type SqlExec = (sql: string) => Promise<ReadonlyArray<Record<string, unknown>>>;

/**
 * Založí nebo aktualizuje runtime roli. Spouští se po migracích pod vlastníkem schématu; idempotentní.
 * Odmítne roli, která už má víc práv (superuser, CREATEDB…) nebo dědí práva vlastníka.
 */
export async function ensureRuntimeRole(exec: SqlExec, opts: { role?: string; password: string }): Promise<string> {
  const role = opts.role || RUNTIME_ROLE;
  if (!ROLE_RE.test(role)) throw new Error("APP_DB_USER: název role jen z a–z, 0–9 a _");
  if (!PASSWORD_RE.test(opts.password)) {
    throw new Error("APP_DB_PASSWORD: 24–128 znaků jen z A–Z a–z 0–9 . _ ~ - (vygenerujte: openssl rand -hex 32)");
  }
  const [me] = await exec("SELECT current_user AS owner");
  const owner = String(me?.owner ?? "");
  if (owner === role) throw new Error("APP_DB_USER: runtime role nesmí být vlastník schématu");

  for (const sql of runtimeRoleStatements(role, owner, scramSha256Verifier(opts.password))) await exec(sql);

  const [r] = await exec(
    `SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, pg_has_role(${literal(role)}, ${literal(owner)}, 'USAGE') AS inherits_owner FROM pg_roles WHERE rolname = ${literal(role)}`,
  );
  const elevated = [
    r?.rolsuper && "SUPERUSER",
    r?.rolcreatedb && "CREATEDB",
    r?.rolcreaterole && "CREATEROLE",
    r?.rolreplication && "REPLICATION",
    r?.rolbypassrls && "BYPASSRLS",
    r?.inherits_owner && `člen role ${owner}`,
  ].filter(Boolean);
  if (!r || elevated.length) throw new Error(`APP_DB_USER: role ${role} má příliš velká práva (${elevated.join(", ") || "nenalezena"}) – odeberte je`);
  return role;
}
