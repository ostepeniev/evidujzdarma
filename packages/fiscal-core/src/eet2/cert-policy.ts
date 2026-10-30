/**
 * Pokladní certifikát EET 2.0 a jeho prostředí podle Policy OID (R5.9):
 *   produkce:   1.2.203.19122063.10.1.102.x.y  (Přístupové a provozní informace – produkční prostředí v1.1, 3.1.2)
 *   Playground: 1.2.203.19122063.10.4.102.x.y  (totéž pro Playground, 3.1.5)
 * Název vydavatele („playground EETv2 NCA SubCA RSA …“) je jen popisek, rozhoduje OID.
 *
 * Výjimka podle skutečných souborů FS: sdílené testovací certifikáty Playgroundu z archivu
 * CAEET_Playground_2026_v1.zip (eet.gov.cz, Dokumenty ke stažení; CZ8551015704, CZ00000019, CZ683555118) nesou OID
 * 1.2.203.19122063.10.2.102.0.1 s userNotice „Toto je cert pouze pro testování EET2“, ne 10.4.102 z dokumentu.
 * Jiné certifikáty pro Playground FS nevydává (CA EET pro Playground není v provozu, 3.1.4), proto je 10.2.102 také
 * Playground. Nikdy ne produkce – ta je jen 10.1.102.
 */
export const EET_CERT_POLICY_PREFIX = {
  production: "1.2.203.19122063.10.1.102.",
  playground: "1.2.203.19122063.10.4.102.",
} as const;

/** OID sdílených testovacích certifikátů Playgroundu v archivu FS 2026 (viz výše). */
export const EET_PLAYGROUND_TEST_ARCHIVE_POLICY_PREFIX = "1.2.203.19122063.10.2.102.";

export function certificateEnvironment(policies: readonly string[]): "production" | "playground" | null {
  if (policies.some((p) => p.startsWith(EET_CERT_POLICY_PREFIX.production))) return "production";
  if (policies.some((p) => p.startsWith(EET_CERT_POLICY_PREFIX.playground) || p.startsWith(EET_PLAYGROUND_TEST_ARCHIVE_POLICY_PREFIX))) return "playground";
  return null;
}

/**
 * Produkce přijímá tržby od 1. 1. 2027 0:00, „před tímto datem v přechodném režimu od 01.11.2026“
 * (Přístupové a provozní informace – produkční prostředí v1.1, 4.1). Dřívější produkční tržbu FS nepřijme.
 */
export const EET_PRODUCTION_ACCEPTS_FROM = "2026-11-01T00:00:00+01:00";
