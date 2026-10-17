/**
 * S3-POKLADNA: automatické zamčení pokladny po 15 minutách nečinnosti – i když je aplikace pořád otevřená (dřív se
 * zamykala jen při novém otevření). Odemyká se PINem pokladní (PinLock). Čistá logika s injektovaným časem a časovačem,
 * aby šla testovat bez prohlížeče.
 */
export const AUTO_LOCK_MS = 15 * 60_000;
/** jak často se nečinnost kontroluje (zamkne se nejvýš o tolik později) */
export const IDLE_CHECK_MS = 15_000;
/** události, které znamenají práci obsluhy */
export const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function idleExpired(lastActivity: number, now: number, ms = AUTO_LOCK_MS): boolean {
  return now - lastActivity >= ms;
}

interface Target {
  addEventListener(type: string, fn: () => void, opts?: AddEventListenerOptions): void;
  removeEventListener(type: string, fn: () => void): void;
}

export interface IdleWatchOptions {
  ms?: number;
  checkMs?: number;
  now?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
  /** po každé aktivitě (např. prodloužení uloženého přihlášení) */
  onActivity?: (at: number) => void;
  /** dokument – návrat do aplikace (visibilitychange) zkontroluje nečinnost hned */
  doc?: Target & { visibilityState?: string };
}

/**
 * Hlídá nečinnost: aktivita na `target` posune čas poslední práce, po `ms` bez práce zavolá `onIdle` (jednou)
 * a hlídání skončí. Vrací funkci, která hlídání zruší.
 */
export function watchIdle(target: Target, onIdle: () => void, o: IdleWatchOptions = {}): () => void {
  const ms = o.ms ?? AUTO_LOCK_MS;
  const now = o.now ?? Date.now;
  const set = o.setInterval ?? ((fn: () => void, t: number) => setInterval(fn, t));
  const clear = o.clearInterval ?? ((id: unknown) => clearInterval(id as ReturnType<typeof setInterval>));
  let last = now();
  let done = false;
  const activity = () => {
    if (done) return;
    // aktivita po uplynutí lhůty už zámek neodvrátí (např. dotyk po návratu z jiné aplikace)
    if (idleExpired(last, now(), ms)) return check();
    last = now();
    o.onActivity?.(last);
  };
  const check = () => {
    if (done || !idleExpired(last, now(), ms)) return;
    stop();
    onIdle();
  };
  const onVisible = () => {
    if (o.doc?.visibilityState === undefined || o.doc.visibilityState === "visible") check();
  };
  for (const e of ACTIVITY_EVENTS) target.addEventListener(e, activity, { passive: true });
  o.doc?.addEventListener("visibilitychange", onVisible);
  const timer = set(check, o.checkMs ?? IDLE_CHECK_MS);
  function stop() {
    if (done) return;
    done = true;
    for (const e of ACTIVITY_EVENTS) target.removeEventListener(e, activity);
    o.doc?.removeEventListener("visibilitychange", onVisible);
    clear(timer);
  }
  return stop;
}
