/**
 * R3.13 – závislosti bez známých zranitelností v produkční cestě.
 * nodemailer ≥ 10.0.6 (13 advisories v `pnpm audit --prod`, poslední opravené v 10.0.6).
 * node-forge zatím opravenou verzi nemá (≤ 1.4.0, RSA PKCS#1 v1.5 verify): podpisy a řetězce proto ověřuje
 * jen node:crypto a forge slouží výhradně k parsování – tripwire níže hlídá, aby to tak zůstalo.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../..");
const json = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

function atLeast(version: string, min: string): boolean {
  const a = version.split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("R3.13 – nodemailer ≥ 10.0.6", () => {
  for (const app of ["apps/web", "apps/worker"]) {
    it(`${app}: declared range and installed version`, () => {
      const range: string = json(`${app}/package.json`).dependencies.nodemailer;
      expect(range).toMatch(/^\^?\d+\.\d+\.\d+$/);
      expect(atLeast(range.replace("^", ""), "10.0.6"), range).toBe(true);
      const installed: string = json(`${app}/node_modules/nodemailer/package.json`).version;
      expect(atLeast(installed, "10.0.6"), installed).toBe(true);
    });
  }
});

describe("R3.13 – node-forge only parses, never verifies signatures", () => {
  it("no forge signature / chain verification in fiscal-core", () => {
    const offenders = files(join(ROOT, "packages/fiscal-core/src"))
      .filter((f) => /from "node-forge"/.test(readFileSync(f, "utf8")))
      .filter((f) => /verifyCertificateChain|\.publicKey\.verify\(|createCaStore|\.md\.\w+\.create\(\)[\s\S]{0,80}\.verify\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
