/**
 * R3 – infrastrukturní pojistky, které se nesmí ztratit při úpravách konfigurace.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const infra = (f: string) => readFileSync(join(__dirname, "../../../infra", f), "utf8");

describe("R3.2 – Caddy request body limits", () => {
  it("certificate upload ≤ 128 KB, everything else ≤ 1 MB", () => {
    const c = infra("Caddyfile");
    expect(c).toMatch(/@certificate path \/api\/ucet\/certifikat\s+request_body @certificate \{\s+max_size 128KB/);
    expect(c).toMatch(/request_body \{\s+max_size 1MB/);
  });
});

describe("R5.11 – typecheck needs no manual step", () => {
  it("apps/web typecheck generates the Next.js route types first", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts.typecheck).toBe("next typegen && tsc --noEmit");
  });
});
