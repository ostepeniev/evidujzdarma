import { readFileSync, statSync } from "node:fs";

/**
 * Р6: produkce nenastartuje bez konfigurace, bez které by tiše nefungovala (e-maily, šifrování klíčů,
 * cron). Vrací názvy chybějících nebo neplatných proměnných (u MASTER_KEY i důvod).
 */
export function checkProductionEnv(env: Record<string, string | undefined>): string[] {
  const bad: string[] = [];
  const has = (k: string) => typeof env[k] === "string" && env[k]!.trim() !== "";
  if (!has("DATABASE_URL") || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL!)) bad.push("DATABASE_URL");
  if (!has("SMTP_URL") || !/^smtps?:\/\//.test(env.SMTP_URL!)) bad.push("SMTP_URL");
  bad.push(...masterKeyProblems(env));
  if (!has("CRON_SECRET") || env.CRON_SECRET!.length < 24) bad.push("CRON_SECRET");
  if (!has("APP_SECRET") || env.APP_SECRET!.length < 24) bad.push("APP_SECRET");
  return bad;
}

/**
 * R3.12: master klíč (i klíče pro rotaci) v produkci jen ze souboru – docker secret s právy 0400.
 * V proměnné prostředí by byl vidět v `docker inspect`, v /proc/<pid>/environ a ve sdíleném .env.
 */
function masterKeyProblems(env: Record<string, string | undefined>): string[] {
  const names = Object.keys(env).filter((k) => env[k]);
  const direct = names.filter((k) => /^MASTER_KEY(_v\d+)?$/.test(k));
  if (direct.length) return direct.map((k) => `${k} (v produkci jen jako soubor v ${k}_FILE)`);
  const files = names.filter((k) => /^MASTER_KEY(_v\d+)?_FILE$/.test(k));
  if (!files.includes("MASTER_KEY_FILE")) return ["MASTER_KEY_FILE"];
  const bad: string[] = [];
  for (const k of files) {
    try {
      const mode = statSync(env[k]!).mode & 0o777;
      if (mode & 0o077) {
        bad.push(`${k} (práva ${mode.toString(8).padStart(4, "0")}, nastavte 0400)`);
        continue;
      }
      if (Buffer.from(readFileSync(env[k]!, "utf8").trim(), "base64").length !== 32) bad.push(`${k} (klíč musí mít 32 bajtů v base64)`);
    } catch {
      bad.push(`${k} (soubor nelze přečíst)`);
    }
  }
  return bad;
}
