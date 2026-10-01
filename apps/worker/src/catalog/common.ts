/**
 * Sdílené pomůcky pro skripty katalogu firem (import RES, obohacení z ARES, seed).
 */

export type Args = Record<string, string | boolean>;

/** `--key value`, `--key=value`, `--flag` → objekt. Pozice (bez --) se ignorují. */
export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--" || !a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

export function argString(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

export function argNumber(args: Args, key: string, fallback: number): number {
  const v = args[key];
  if (typeof v !== "string") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** "51,19" → [51, 19] */
export function argRegions(args: Args, key = "regions"): number[] | undefined {
  const v = argString(args, key);
  if (!v) return undefined;
  const list = v
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return list.length ? list : undefined;
}

export function log(...parts: unknown[]): void {
  console.log(new Date().toISOString().slice(11, 19), ...parts);
}

export function requireDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    console.error("Chybí DATABASE_URL (např. postgres://postgres@127.0.0.1:5432/evidujzdarma).");
    process.exit(2);
  }
}

/** Dnešní datum v Praze, YYYY-MM-DD. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date());
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Čisté ukončení: první Ctrl+C nastaví příznak (skript dokončí rozpracovanou dávku),
 * druhý ukončí proces okamžitě.
 */
export function stopSignal(): { readonly stopped: boolean } {
  const state = { stopped: false };
  const handler = () => {
    if (state.stopped) {
      console.error("\nVynucené ukončení.");
      process.exit(130);
    }
    state.stopped = true;
    console.error("\nUkončuji po dokončení rozpracované dávky… (znovu Ctrl+C = okamžitě)");
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  return state;
}
