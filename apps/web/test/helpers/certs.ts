/** Testovací pokladní certifikáty (vlastní CA, nikdy skutečné certifikáty FS). */
import { createTestP12, parseP12 } from "@ez/fiscal-core/server";

export function testCert(opts: { eic?: string; days?: number; notBefore?: Date; notAfter?: Date; issuer?: string } = {}) {
  const p12 = createTestP12({
    commonName: opts.eic ?? "CZ12345679",
    password: "x",
    days: opts.days,
    notBefore: opts.notBefore,
    notAfter: opts.notAfter,
    issuerCommonName: opts.issuer,
  });
  return { p12, cert: parseP12(p12, "x") };
}
