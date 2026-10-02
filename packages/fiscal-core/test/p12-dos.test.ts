/**
 * R3.1 – .p12 nesmí zablokovat server: počty iterací (MAC, PBE, PBES2) se kontrolují před dešifrováním,
 * parsování běží ve worker_threads s časovým limitem.
 */
import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { CertificateError, P12_LIMITS, createTestP12, inspectP12, parseP12Safe } from "../src/p12.ts";

const p12 = createTestP12({ commonName: "CZ00000019", password: "x" });

/** Přepíše všechny počty iterací v souboru (MAC i PBE) na `n` – bez přepočtu MAC, jen pro test odmítnutí. */
function withIterations(data: Buffer, n: number): Buffer {
  const big = forge.asn1.integerToDer(n).getBytes();
  const walk = (node: forge.asn1.Asn1, parentIsParams: boolean) => {
    if (!Array.isArray(node.value)) {
      if (node.type === forge.asn1.Type.OCTETSTRING && typeof node.value === "string") {
        try {
          const inner = forge.asn1.fromDer(node.value);
          walk(inner, false);
          node.value = forge.asn1.toDer(inner).getBytes();
        } catch {
          /* není DER */
        }
      }
      return;
    }
    const kids = node.value as forge.asn1.Asn1[];
    // SEQUENCE { OCTET STRING salt, INTEGER iterations } – PBE parametry i MacData
    kids.forEach((k, i) => {
      if (k.type === forge.asn1.Type.INTEGER && i > 0 && kids[i - 1]!.type === forge.asn1.Type.OCTETSTRING) k.value = big;
      walk(k, parentIsParams);
    });
  };
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(data.toString("binary")));
  walk(asn1, false);
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");
}

describe("R3.1 – .p12 DoS", () => {
  it("a normal certificate passes the pre-scan and parses in a worker", async () => {
    const scan = inspectP12(p12);
    expect(scan.maxIterations).toBeGreaterThan(0);
    expect(scan.maxIterations).toBeLessThanOrEqual(P12_LIMITS.maxIterations);
    const cert = await parseP12Safe(p12, "x");
    expect(cert.info.commonName).toBe("CZ00000019");
  });

  it("gate: 50 000 000 iterations are rejected before any key derivation (fast)", async () => {
    const evil = withIterations(p12, 50_000_000);
    expect(inspectP12(evil).maxIterations).toBe(50_000_000);
    const t0 = Date.now();
    await expect(parseP12Safe(evil, "x")).rejects.toBeInstanceOf(CertificateError);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it("too large files are rejected without parsing", async () => {
    await expect(parseP12Safe(Buffer.alloc(P12_LIMITS.maxBytes + 1), "x")).rejects.toBeInstanceOf(CertificateError);
  });

  it("the worker is killed after the time limit", async () => {
    await expect(parseP12Safe(p12, "x", { timeoutMs: 1 })).rejects.toThrow(/čas|time/i);
  });
});
