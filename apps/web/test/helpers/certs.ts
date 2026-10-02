/** Testovací pokladní certifikáty (vlastní CA, nikdy skutečné certifikáty FS). */
import { createTestP12, parseP12 } from "@ez/fiscal-core/server";

/** Policy OID pokladních certifikátů EET 2.0 (R5.9) – testovací certifikát dostane OID podle vydavatele. */
export const TEST_POLICY = { production: "1.2.203.19122063.10.1.102.1.1", playground: "1.2.203.19122063.10.4.102.1.1" } as const;

export function testCert(opts: { eic?: string; days?: number; notBefore?: Date; notAfter?: Date; issuer?: string; policyOid?: string | null } = {}) {
  const p12 = createTestP12({
    commonName: opts.eic ?? "CZ12345679",
    password: "x",
    days: opts.days,
    notBefore: opts.notBefore,
    notAfter: opts.notAfter,
    issuerCommonName: opts.issuer,
    policyOid: opts.policyOid !== undefined ? opts.policyOid : /playground/i.test(opts.issuer ?? "") ? TEST_POLICY.playground : TEST_POLICY.production,
  });
  return { p12, cert: parseP12(p12, "x") };
}
