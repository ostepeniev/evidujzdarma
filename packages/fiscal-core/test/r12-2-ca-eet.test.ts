/**
 * R12.2 (рецензія №9, доповнення №10) – CA EET, vydavatel pokladních certifikátů. Z jakého prostředí certifikát je,
 * se pozná ověřením podpisu řetězce list → SubCA → Root (ne jen podle jména vydavatele).
 *  - oficiální soubory official/ca-eet/*: všech 8 se načte, SHA-256 = official/README.md, vložené konstanty = soubory,
 *    Root je self-signed a SubCA každého prostředí podepsala jeho Root;
 *  - syntetický řetězec Root → SubCA → list vytvořený v testu (žádné privátní klíče v repozitáři).
 */
import { createHash, X509Certificate } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CA_EET_ANCHORS, CA_EET_FILES, type CaEetAnchors, type CaEetEnvironment } from "../src/eet2/ca-eet-anchors.ts";
import { caEetIssuer } from "../src/eet2/ca-eet.ts";
import { createTestCa, createTestP12, parseP12 } from "../src/p12.ts";

const DIR = new URL("../official/ca-eet/", import.meta.url);
const README = readFileSync(new URL("../official/README.md", import.meta.url), "utf8");
const ENVS: CaEetEnvironment[] = ["prod", "zkus", "test", "playground"];

describe("R12.2 – official CA EET files", () => {
  it("gate: all 8 files parse, their SHA-256 is in official/README.md and the embedded constants equal them", () => {
    const files = readdirSync(DIR).sort();
    expect(files).toHaveLength(8);
    expect([...Object.values(CA_EET_FILES).flatMap((f) => [f.root, f.sub])].sort()).toEqual(files);
    for (const f of files) {
      const bytes = readFileSync(new URL(f, DIR));
      expect(README, f).toContain(`\`ca-eet/${f}\``);
      expect(README, f).toContain(createHash("sha256").update(bytes).digest("hex"));
      expect(() => new X509Certificate(bytes)).not.toThrow();
    }
    // soubory FS mají konce řádků CRLF, konstanty LF – PEM je tentýž
    const norm = (s: string) => s.replace(/\r\n/g, "\n").trim();
    for (const env of ENVS) {
      expect(norm(CA_EET_ANCHORS[env].root), env).toBe(norm(readFileSync(new URL(CA_EET_FILES[env].root, DIR), "utf8")));
      expect(norm(CA_EET_ANCHORS[env].sub), env).toBe(norm(readFileSync(new URL(CA_EET_FILES[env].sub, DIR), "utf8")));
    }
  });

  it("gate: every Root is self-signed and every SubCA is signed by the Root of its own environment (and no other)", () => {
    for (const env of ENVS) {
      const root = new X509Certificate(CA_EET_ANCHORS[env].root);
      const sub = new X509Certificate(CA_EET_ANCHORS[env].sub);
      expect(root.verify(root.publicKey), `${env} root self-signed`).toBe(true);
      expect(sub.checkIssued(root) && sub.verify(root.publicKey), `${env} sub ← root`).toBe(true);
      for (const other of ENVS.filter((e) => e !== env)) {
        expect(sub.verify(new X509Certificate(CA_EET_ANCHORS[other].root).publicKey), `${env} sub ← ${other} root`).toBe(false);
      }
    }
  });
});

describe("R12.2 – chain classification on a synthetic chain", () => {
  // syntetické CA pro dvě prostředí a cizí CA se stejným jménem jako testovací SubCA (padělek)
  const prod = createTestCa({ rootName: "SYNTH prod Root", subName: "SYNTH prod SubCA" });
  const test = createTestCa({ rootName: "SYNTH test Root", subName: "SYNTH test SubCA" });
  const forger = createTestCa({ rootName: "SYNTH forger Root", subName: "SYNTH test SubCA" });
  const anchors: CaEetAnchors = {
    prod: { root: prod.root.certPem, sub: prod.sub.certPem },
    test: { root: test.root.certPem, sub: test.sub.certPem },
  };
  const leaf = (signer?: { certPem: string; keyPem: string }) => parseP12(createTestP12({ commonName: "CZ12345679", password: "x", signer }), "x").certificatePem;

  it("gate: a certificate signed by an environment's SubCA is classified by that environment", () => {
    expect(caEetIssuer(leaf(prod.sub), anchors)).toEqual({ environment: "prod", nameMatch: "prod" });
    expect(caEetIssuer(leaf(test.sub), anchors)).toEqual({ environment: "test", nameMatch: "test" });
  });

  it("gate: the issuer name alone is not enough – same name, different key → not verified, only a name match", () => {
    expect(caEetIssuer(leaf(forger.sub), anchors)).toEqual({ environment: null, nameMatch: "test" });
  });

  it("gate: a SubCA not signed by its Root does not count", () => {
    const broken: CaEetAnchors = { test: { root: prod.root.certPem, sub: test.sub.certPem } };
    expect(caEetIssuer(leaf(test.sub), broken)).toEqual({ environment: null, nameMatch: "test" });
  });

  it("an unknown issuer → no environment, no name match (current behaviour stays)", () => {
    expect(caEetIssuer(leaf(), anchors)).toEqual({ environment: null, nameMatch: null });
    expect(caEetIssuer("not a certificate", anchors)).toEqual({ environment: null, nameMatch: null });
  });
});
