/**
 * Pokladní certifikát EET 2.0 a jeho prostředí podle Policy OID (R5.9):
 *   produkce:   1.2.203.19122063.10.1.102.x.y  (Přístupové a provozní informace – produkční prostředí v1.1, 3.1.2)
 *   Playground: 1.2.203.19122063.10.4.102.x.y  (totéž pro Playground, 3.1.5)
 * Název vydavatele („playground EETv2 NCA SubCA RSA …“) je jen popisek, rozhoduje OID.
 */
export const EET_CERT_POLICY_PREFIX = {
  production: "1.2.203.19122063.10.1.102.",
  playground: "1.2.203.19122063.10.4.102.",
} as const;

export function certificateEnvironment(policies: readonly string[]): "production" | "playground" | null {
  if (policies.some((p) => p.startsWith(EET_CERT_POLICY_PREFIX.production))) return "production";
  if (policies.some((p) => p.startsWith(EET_CERT_POLICY_PREFIX.playground))) return "playground";
  return null;
}

/**
 * Produkce přijímá tržby od 1. 1. 2027 0:00, „před tímto datem v přechodném režimu od 01.11.2026“
 * (Přístupové a provozní informace – produkční prostředí v1.1, 4.1). Dřívější produkční tržbu FS nepřijme.
 */
export const EET_PRODUCTION_ACCEPTS_FROM = "2026-11-01T00:00:00+01:00";
