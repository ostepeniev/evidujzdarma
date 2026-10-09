/**
 * Z jakého prostředí CA EET pokladní certifikát pochází (R12.2): ověří se podpis řetězce list → SubCA → Root, ne jen
 * jméno vydavatele. Server-only (node:crypto).
 */
import { X509Certificate } from "node:crypto";
import { CA_EET_ANCHORS, type CaEetAnchors, type CaEetEnvironment } from "./ca-eet-anchors.ts";

export interface CaEetMatch {
  /** prostředí, jehož SubCA certifikát podepsala (a SubCA podepsal jeho Root); null = řetězec neověřen */
  environment: CaEetEnvironment | null;
  /** prostředí, jehož SubCA se jménem shoduje s vydavatelem certifikátu – i když podpis nesedí */
  nameMatch: CaEetEnvironment | null;
}

interface LoadedCa {
  env: CaEetEnvironment;
  sub: X509Certificate;
  /** SubCA podepsal Root téhož prostředí a Root je self-signed */
  chainOk: boolean;
}

const cache = new WeakMap<CaEetAnchors, LoadedCa[]>();

function load(anchors: CaEetAnchors): LoadedCa[] {
  const hit = cache.get(anchors);
  if (hit) return hit;
  const out: LoadedCa[] = [];
  for (const [env, pems] of Object.entries(anchors) as [CaEetEnvironment, { root: string; sub: string } | undefined][]) {
    if (!pems) continue;
    const root = new X509Certificate(pems.root);
    const sub = new X509Certificate(pems.sub);
    out.push({ env, sub, chainOk: root.verify(root.publicKey) && sub.checkIssued(root) && sub.verify(root.publicKey) });
  }
  cache.set(anchors, out);
  return out;
}

/**
 * Prostředí CA EET pro certifikát (PEM). `environment` jen při ověřeném podpisu; vydavatel mimo CA EET → obě null.
 * `anchors` jen pro testy (syntetický řetězec), jinak oficiální official/ca-eet/*.
 */
export function caEetIssuer(certificatePem: string, anchors: CaEetAnchors = CA_EET_ANCHORS): CaEetMatch {
  let leaf: X509Certificate;
  try {
    leaf = new X509Certificate(certificatePem);
  } catch {
    return { environment: null, nameMatch: null };
  }
  let nameMatch: CaEetEnvironment | null = null;
  for (const ca of load(anchors)) {
    // jméno vydavatele: textově, nebo kanonicky přes OpenSSL (checkIssued) – různé kódování DN nesmí řetězec skrýt
    const issued = leaf.checkIssued(ca.sub);
    if (!issued && leaf.issuer !== ca.sub.subject) continue;
    nameMatch ??= ca.env;
    if (ca.chainOk && issued && leaf.verify(ca.sub.publicKey)) return { environment: ca.env, nameMatch: ca.env };
  }
  return { environment: null, nameMatch };
}
