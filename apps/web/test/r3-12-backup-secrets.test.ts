/**
 * R3.12 – zálohy vznikají jen zašifrované (age, soukromý klíč mimo server), MASTER_KEY se čte jen
 * ze souboru (docker secret 0400) a není ve sdíleném .env, runtime jede pod rolí DB bez DDL.
 */
import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scramSha256Verifier } from "@ez/db/roles";
import { LocalKeyEncryptor } from "@ez/fiscal-core/server";
import { checkProductionEnv } from "@/lib/server/env-check";

const INFRA = join(__dirname, "../../../infra");
const infra = (f: string) => readFileSync(join(INFRA, f), "utf8");
const tmp = () => mkdtempSync(join(tmpdir(), "ez-r312-"));

/** Blok služby z docker-compose.yml (od `  name:` po další službu na stejné úrovni). */
function service(compose: string, name: string): string {
  const start = compose.indexOf(`\n  ${name}:\n`);
  expect(start, `služba ${name}`).toBeGreaterThan(-1);
  const rest = compose.slice(start + 1);
  const end = rest.slice(1).search(/\n(?: {2}[a-z][\w-]*:\n|\S)/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

/* ───────────── zálohy ───────────── */

const FAKE_AGE = `#!/bin/sh
# zástupce age pro test zapojení: hlavička + vstup do souboru z -o
out=""
while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2 ;; -r) shift 2 ;; *) shift ;; esac; done
{ printf 'age-encryption.org/v1\\n'; cat; } > "$out"
`;
const RECIPIENT = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p";
const hasRealAge = spawnSync("age", ["--version"]).status === 0 && spawnSync("age-keygen", ["--version"]).status === 0;

function sandbox(opts: { dumpFails?: boolean; realAge?: boolean } = {}) {
  const root = tmp();
  const bin = join(root, "bin");
  const dir = join(root, "backups");
  mkdirSync(bin);
  mkdirSync(dir);
  writeFileSync(
    join(bin, "pg_dump"),
    opts.dumpFails ? "#!/bin/sh\necho 'pg_dump: connection refused' >&2\nprintf 'PGDMP-partial'\nexit 1\n" : "#!/bin/sh\nprintf 'PGDMP-fake-dump%s' \"$1\"\n",
    { mode: 0o755 },
  );
  if (!opts.realAge) writeFileSync(join(bin, "age"), FAKE_AGE, { mode: 0o755 });
  const run = (env: Record<string, string>) =>
    spawnSync("sh", [join(INFRA, "backup.sh")], {
      env: { NODE_ENV: "test", PATH: `${bin}:${process.env.PATH}`, BACKUP_DIR: dir, BACKUP_ONCE: "1", ...env },
      encoding: "utf8",
      timeout: 20_000,
    });
  return { root, dir, run, files: () => readdirSync(dir).filter((f) => !f.startsWith(".")).sort() };
}

function age(path: string, days: number) {
  const t = Date.now() / 1000 - days * 86400;
  utimesSync(path, t, t);
}

describe("R3.12 – backups are encrypted with age, the private key is not on the server", () => {
  it("refuses to run without a recipient – an unencrypted dump is never written", () => {
    const s = sandbox();
    const r = s.run({});
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/BACKUP_AGE_RECIPIENT/);
    expect(s.files()).toEqual([]);
  });

  it("rejects anything that is not an age public key (a pasted private key included)", () => {
    const s = sandbox();
    const r = s.run({ BACKUP_AGE_RECIPIENT: "AGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/age1/);
    expect(s.files()).toEqual([]);
  });

  it("writes only <timestamp>.dump.age with the age header, readable by the owner only", () => {
    const s = sandbox();
    const r = s.run({ BACKUP_AGE_RECIPIENT: RECIPIENT });
    expect(r.status, r.stderr).toBe(0);
    const files = s.files();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^evidujzdarma-\d{8}-\d{6}\.dump\.age$/);
    const path = join(s.dir, files[0]!);
    expect(readFileSync(path, "utf8").startsWith("age-encryption.org/v1")).toBe(true);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("a failed pg_dump leaves no file and does not prune the old backups", () => {
    const s = sandbox({ dumpFails: true });
    const old = join(s.dir, "evidujzdarma-20260801-0300.dump.age");
    writeFileSync(old, "age-encryption.org/v1\nold");
    age(old, 30);
    const r = s.run({ BACKUP_AGE_RECIPIENT: RECIPIENT, BACKUP_KEEP_DAYS: "14" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/CHYBA/);
    expect(s.files()).toEqual(["evidujzdarma-20260801-0300.dump.age"]);
  });

  it("after a successful backup prunes copies older than BACKUP_KEEP_DAYS (old plaintext dumps too) and warns about plaintext ones left", () => {
    const s = sandbox();
    const oldEnc = join(s.dir, "evidujzdarma-20260801-0300.dump.age");
    const oldPlain = join(s.dir, "evidujzdarma-20260802-0300.dump");
    const recentPlain = join(s.dir, "evidujzdarma-20260930-0300.dump");
    for (const f of [oldEnc, oldPlain, recentPlain]) writeFileSync(f, "x");
    age(oldEnc, 30);
    age(oldPlain, 30);
    age(recentPlain, 1);
    const r = s.run({ BACKUP_AGE_RECIPIENT: RECIPIENT, BACKUP_KEEP_DAYS: "14" });
    expect(r.status, r.stderr).toBe(0);
    const files = s.files();
    expect(files).not.toContain("evidujzdarma-20260801-0300.dump.age");
    expect(files).not.toContain("evidujzdarma-20260802-0300.dump");
    expect(files).toContain("evidujzdarma-20260930-0300.dump");
    expect(r.stderr).toMatch(/nešifrovan/);
  });

  it.skipIf(!hasRealAge)("with the real age: the file decrypts only with the offline identity and contains no plaintext", () => {
    const s = sandbox({ realAge: true });
    const key = join(s.root, "offline-key.txt");
    expect(spawnSync("age-keygen", ["-o", key]).status).toBe(0);
    const recipient = readFileSync(key, "utf8").match(/public key: (age1\w+)/)![1]!;
    const r = s.run({ BACKUP_AGE_RECIPIENT: `${RECIPIENT},${recipient}` });
    expect(r.status, r.stderr).toBe(0);
    const path = join(s.dir, s.files()[0]!);
    expect(readFileSync(path).includes("PGDMP")).toBe(false);
    const d = spawnSync("age", ["-d", "-i", key, path], { encoding: "utf8" });
    expect(d.status, d.stderr).toBe(0);
    expect(d.stdout).toBe("PGDMP-fake-dump-Fc");
  });

  it("the backup service is built with age and needs the recipient to start", () => {
    const backup = service(infra("docker-compose.yml"), "backup");
    expect(backup).toMatch(/dockerfile: backup\.Dockerfile/);
    expect(backup).toMatch(/BACKUP_AGE_RECIPIENT: "?\$\{BACKUP_AGE_RECIPIENT:\?/);
    expect(infra("backup.Dockerfile")).toMatch(/apk add --no-cache age/);
    expect(infra("backup.sh")).not.toMatch(/pg_dump -Fc -f/);
  });
});

/* ───────────── MASTER_KEY ───────────── */

function keyFile(dir: string, name: string, key: string, mode = 0o400) {
  const p = join(dir, name);
  writeFileSync(p, `${key}\n`, { mode });
  return p;
}

describe("R3.12 – MASTER_KEY only from a secret file, not from the shared .env", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://u:p@db/x",
    SMTP_URL: "smtp://u:p@smtp.example.cz:587",
    CRON_SECRET: "x".repeat(32),
    APP_SECRET: "y".repeat(32),
  };
  const k1 = Buffer.alloc(32, 1).toString("base64");

  it("production refuses MASTER_KEY (or a rotation key) passed directly in the environment", () => {
    const dir = tmp();
    const file = keyFile(dir, "master_key", k1);
    expect(checkProductionEnv({ ...base, MASTER_KEY: k1 })).toEqual(expect.arrayContaining([expect.stringMatching(/^MASTER_KEY /)]));
    expect(checkProductionEnv({ ...base, MASTER_KEY_FILE: file, MASTER_KEY_v2: k1 })).toEqual([expect.stringMatching(/^MASTER_KEY_v2 /)]);
    expect(checkProductionEnv(base)).toEqual(["MASTER_KEY_FILE"]);
  });

  it("accepts a 0400 file with a 32-byte key; refuses a group/world-readable, short or missing file", () => {
    const dir = tmp();
    expect(checkProductionEnv({ ...base, MASTER_KEY_FILE: keyFile(dir, "ok", k1) })).toEqual([]);
    expect(checkProductionEnv({ ...base, MASTER_KEY_FILE: keyFile(dir, "open", k1, 0o644) })).toEqual([expect.stringMatching(/^MASTER_KEY_FILE .*0400/)]);
    expect(checkProductionEnv({ ...base, MASTER_KEY_FILE: keyFile(dir, "short", "abc") })).toEqual([expect.stringMatching(/^MASTER_KEY_FILE /)]);
    expect(checkProductionEnv({ ...base, MASTER_KEY_FILE: join(dir, "missing") })).toEqual([expect.stringMatching(/^MASTER_KEY_FILE /)]);
    const v2 = keyFile(dir, "v2", Buffer.alloc(32, 2).toString("base64"));
    expect(checkProductionEnv({ ...base, MASTER_KEY_FILE: keyFile(dir, "ok2", k1), MASTER_KEY_v2_FILE: v2, MASTER_KEY_CURRENT: "v2" })).toEqual([]);
  });

  it("a key moved from the environment to a file still decrypts existing certificates; rotation keys work the same way", async () => {
    const dir = tmp();
    const k2 = Buffer.alloc(32, 2).toString("base64");
    const fromEnv = LocalKeyEncryptor.fromEnv({ MASTER_KEY: k1 });
    const wrapped = await fromEnv.wrap(Buffer.alloc(32, 5));
    const fromFile = LocalKeyEncryptor.fromEnv({ MASTER_KEY_FILE: keyFile(dir, "k1", k1) });
    expect((await fromFile.unwrap(wrapped, "v1")).equals(Buffer.alloc(32, 5))).toBe(true);
    const rotated = LocalKeyEncryptor.fromEnv({ MASTER_KEY_FILE: keyFile(dir, "k1b", k1), MASTER_KEY_v2_FILE: keyFile(dir, "k2", k2), MASTER_KEY_CURRENT: "v2" });
    expect(rotated.version).toBe("v2");
    expect((await rotated.unwrap(wrapped, "v1")).equals(Buffer.alloc(32, 5))).toBe(true);
    expect((await rotated.unwrap(await rotated.wrap(Buffer.alloc(32, 6)), "v2")).equals(Buffer.alloc(32, 6))).toBe(true);
  });

  it("compose: web gets the key as a docker secret, the worker not at all, .env has no MASTER_KEY", () => {
    const compose = infra("docker-compose.yml");
    expect(compose).not.toMatch(/\$\{MASTER_KEY/);
    expect(compose).toMatch(/\nsecrets:\n {2}master_key:\n {4}file: \.\/secrets\/master_key\n/);
    const web = service(compose, "web");
    expect(web).toMatch(/MASTER_KEY_FILE: \/run\/secrets\/master_key/);
    expect(web).toMatch(/secrets: \[master_key\]/);
    const worker = service(compose, "worker");
    expect(worker).not.toMatch(/MASTER_KEY|secrets/);
    expect(infra(".env.production.example")).not.toMatch(/^MASTER_KEY=/m);
    const gitignore = readFileSync(join(__dirname, "../../../.gitignore"), "utf8");
    expect(gitignore).toMatch(/^infra\/secrets\/$/m);
    expect(gitignore).toMatch(/^infra\/backups\/$/m);
  });
});

/* ───────────── role DB ───────────── */

describe("R3.12 – runtime connects with a role without DDL", () => {
  it("compose: web and worker use evidujzdarma_app, only migrate uses the schema owner", () => {
    const compose = infra("docker-compose.yml");
    expect(compose).toMatch(/DATABASE_URL: "?postgres:\/\/evidujzdarma_app:\$\{APP_DB_PASSWORD:\?/);
    const migrate = service(compose, "migrate");
    expect(migrate).toMatch(/DATABASE_URL: postgres:\/\/evidujzdarma:\$\{POSTGRES_PASSWORD\}@/);
    expect(migrate).toMatch(/APP_DB_PASSWORD: "?\$\{APP_DB_PASSWORD:\?/);
    for (const name of ["web", "worker"]) expect(service(compose, name)).not.toMatch(/evidujzdarma:\$\{POSTGRES_PASSWORD\}/);
    expect(infra(".env.production.example")).toMatch(/^APP_DB_PASSWORD=$/m);
  });

  it("the role password is stored as a SCRAM-SHA-256 verifier (RFC 7677 test vector)", () => {
    // RFC 7677, kap. 3: user "user", heslo "pencil", sůl W22ZaJ0SNY7soEsUEjb6gQ==, 4096 iterací
    const v = scramSha256Verifier("pencil", Buffer.from("W22ZaJ0SNY7soEsUEjb6gQ==", "base64"), 4096);
    const m = v.match(/^SCRAM-SHA-256\$4096:W22ZaJ0SNY7soEsUEjb6gQ==\$([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)$/);
    expect(m, v).not.toBeNull();
    const storedKey = Buffer.from(m![1]!, "base64");
    const serverKey = Buffer.from(m![2]!, "base64");
    const nonce = "rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0";
    const authMessage = `n=user,r=rOprNGfwEbeRWgbNEkqO,r=${nonce},s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096,c=biws,r=${nonce}`;
    expect(createHmac("sha256", serverKey).update(authMessage).digest("base64")).toBe("6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4=");
    const proof = Buffer.from("dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=", "base64");
    const clientSignature = createHmac("sha256", storedKey).update(authMessage).digest();
    const clientKey = Buffer.from(proof.map((b, i) => b ^ clientSignature[i]!));
    expect(createHash("sha256").update(clientKey).digest().equals(storedKey)).toBe(true);
  });
});
