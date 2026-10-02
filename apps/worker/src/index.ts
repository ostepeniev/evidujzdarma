/**
 * Worker: plánované úlohy pro EvidujZdarma.
 *
 *  - každou minutu: opakované odeslání tržeb do EET + odeslání e-mailů (POST /api/internal/cron)
 *  - každou hodinu: připomínky (certifikát, neodeslané tržby, změny jednotek)
 *  - každou noc (CATALOG_ENRICH=1): obohacení katalogu firem z ARES s limitem dotazů
 *
 * Logika úloh žije ve web aplikaci (jeden zdroj pravdy); worker je jen spolehlivý časovač.
 */
import { spawn } from "node:child_process";
import { CronHealth } from "./alert.ts";

const APP_URL = (process.env.APP_INTERNAL_URL ?? "http://web:3000").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET;
const ENRICH_HOUR = Number(process.env.CATALOG_ENRICH_HOUR ?? 2);

if (!CRON_SECRET) {
  console.error("[worker] CRON_SECRET není nastaven");
  process.exit(1);
}

let stopping = false;
let lastReminderHour = -1;
let lastEnrichDay = "";
let enrichRunning = false;

function log(msg: string, extra?: unknown) {
  console.log(`[worker] ${new Date().toISOString()} ${msg}`, extra ?? "");
}

const health = new CronHealth(log);

async function runCron(reminders: boolean) {
  const res = await fetch(`${APP_URL}/api/internal/cron${reminders ? "?reminders=1" : ""}`, {
    method: "POST",
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    signal: AbortSignal.timeout(110_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`cron ${res.status} ${JSON.stringify(body)}`);
  const sales = (body as { sales?: { processed?: number } }).sales?.processed ?? 0;
  const emails = (body as { emails?: { sent?: number } }).emails?.sent ?? 0;
  if (sales || emails || reminders) log("cron", body);
}

function runEnrich() {
  if (enrichRunning) return;
  enrichRunning = true;
  log("spouštím obohacení katalogu z ARES");
  const child = spawn(process.execPath, ["--import", "tsx", "src/catalog/enrich-ares.ts"], { stdio: "inherit", env: process.env });
  child.on("exit", (code) => {
    enrichRunning = false;
    log(`obohacení katalogu skončilo (kód ${code})`);
  });
}

async function tick() {
  const now = new Date();
  const hour = now.getHours();
  const reminders = hour !== lastReminderHour;
  try {
    await runCron(reminders);
    if (reminders) lastReminderHour = hour;
    await health.succeeded(now);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("chyba cronu", message);
    // po 5 selháních po sobě alert provozovateli, pak 1× za hodinu, a zpráva o obnovení (R1.14)
    await health.failed(message, now);
  }
  const day = now.toISOString().slice(0, 10);
  if (process.env.CATALOG_ENRICH === "1" && hour === ENRICH_HOUR && lastEnrichDay !== day) {
    lastEnrichDay = day;
    runEnrich();
  }
}

async function main() {
  log(`start, app ${APP_URL}`);
  while (!stopping) {
    const started = Date.now();
    await tick();
    const wait = Math.max(5_000, 60_000 - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log(`${sig}, končím`);
    stopping = true;
    setTimeout(() => process.exit(0), 1_000);
  });
}

void main();
