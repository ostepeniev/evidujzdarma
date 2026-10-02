/**
 * Start serveru: v produkci ověří povinnou konfiguraci (Р6). Bez ní se server neukončí tiše
 * později – nenastartuje vůbec a Docker ho bude restartovat, dokud se konfigurace nedoplní.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { checkProductionEnv } = await import("./lib/server/env-check");
  const missing = checkProductionEnv(process.env);
  if (missing.length) {
    console.error(`[start] chybí nebo je neplatná konfigurace: ${missing.join(", ")} – server se nespustí (viz infra/.env.production.example)`);
    process.exit(1);
  }
}
