/**
 * Р6: produkce nenastartuje bez konfigurace, bez které by tiše nefungovala (e-maily, šifrování klíčů,
 * cron). Vrací názvy chybějících nebo neplatných proměnných.
 */
export function checkProductionEnv(env: Record<string, string | undefined>): string[] {
  const bad: string[] = [];
  const has = (k: string) => typeof env[k] === "string" && env[k]!.trim() !== "";
  if (!has("DATABASE_URL") || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL!)) bad.push("DATABASE_URL");
  if (!has("SMTP_URL") || !/^smtps?:\/\//.test(env.SMTP_URL!)) bad.push("SMTP_URL");
  if (!has("MASTER_KEY") || Buffer.from(env.MASTER_KEY!, "base64").length !== 32) bad.push("MASTER_KEY");
  if (!has("CRON_SECRET") || env.CRON_SECRET!.length < 24) bad.push("CRON_SECRET");
  if (!has("APP_SECRET") || env.APP_SECRET!.length < 24) bad.push("APP_SECRET");
  return bad;
}
