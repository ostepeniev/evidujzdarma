/**
 * R3.6 / Р6 – v logu nejsou tokeny ani parametry SQL; produkce bez SMTP_URL, MASTER_KEY, CRON_SECRET
 * nenastartuje; docker logy mají limit.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorResponse } from "@/lib/server/auth";
import { checkProductionEnv } from "@/lib/server/env-check";
import { safeError } from "@/lib/server/log";

const SECRET = "tok_9f8e7d6c5b4a39281706f5e4d3c2b1a0";
const sqlError = () => {
  const e = new Error(`Failed query: insert into "sessions" ("token_hash", "user_id") values ($1, $2)\nparams: ${SECRET},user-1`);
  (e as Error & { cause?: unknown }).cause = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
  return e;
};

afterEach(() => vi.restoreAllMocks());

describe("R3.6 – no secrets in logs", () => {
  it("safeError keeps the type and SQLSTATE but drops the query and its parameters", () => {
    const s = safeError(sqlError());
    expect(JSON.stringify(s)).not.toContain(SECRET);
    expect(JSON.stringify(s)).not.toContain("insert into");
    expect(s).toMatchObject({ name: "Error", code: "23505" });
  });

  it("errorResponse logs no SQL parameters and returns a generic 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(sqlError());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain(SECRET);
    expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
  });
});

describe("Р6 – production refuses to start without its configuration", () => {
  // MASTER_KEY je od R3.12 jen soubor (docker secret 0400)
  const keyDir = mkdtempSync(join(tmpdir(), "ez-r36-"));
  const keyFile = (name: string, value: string) => {
    const p = join(keyDir, name);
    writeFileSync(p, value, { mode: 0o400 });
    return p;
  };
  const ok = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://u:p@db/x",
    SMTP_URL: "smtp://u:p@smtp.example.cz:587",
    MASTER_KEY_FILE: keyFile("ok", Buffer.alloc(32, 1).toString("base64")),
    CRON_SECRET: "x".repeat(32),
    APP_SECRET: "y".repeat(32),
  };
  it("lists every missing variable", () => {
    expect(checkProductionEnv({ NODE_ENV: "production" })).toEqual(expect.arrayContaining(["DATABASE_URL", "SMTP_URL", "MASTER_KEY_FILE", "CRON_SECRET", "APP_SECRET"]));
  });
  it("accepts a complete configuration and rejects a malformed MASTER_KEY or a short CRON_SECRET", () => {
    expect(checkProductionEnv(ok)).toEqual([]);
    expect(checkProductionEnv({ ...ok, MASTER_KEY_FILE: keyFile("bad", "abc") })).toEqual([expect.stringMatching(/^MASTER_KEY_FILE /)]);
    expect(checkProductionEnv({ ...ok, CRON_SECRET: "short" })).toEqual(["CRON_SECRET"]);
  });
  it("instrumentation runs the check at server start", () => {
    expect(readFileSync(join(__dirname, "../src/instrumentation.ts"), "utf8")).toMatch(/checkProductionEnv/);
  });
});

describe("R3.6 – docker logs are bounded", () => {
  it("every service in docker-compose uses the size-limited logging config", () => {
    const compose = readFileSync(join(__dirname, "../../../infra/docker-compose.yml"), "utf8");
    expect(compose).toMatch(/x-logging: &logging\s+driver: json-file\s+options:\s+max-size: "?\d+m"?\s+max-file: "?\d+"?/);
    const services = compose.split(/\nservices:\n/)[1]!.split(/\nvolumes:/)[0]!;
    const names = [...services.matchAll(/^ {2}([a-z]+):$/gm)].map((m) => m[1]!);
    expect(names.length).toBeGreaterThan(3);
    for (const n of names) {
      const block = services.split(new RegExp(`^ {2}${n}:$`, "m"))[1]!.split(/^ {2}[a-z]+:$/m)[0]!;
      expect(block, n).toMatch(/logging: \*logging/);
    }
  });
});
