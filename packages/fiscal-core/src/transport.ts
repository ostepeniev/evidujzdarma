/**
 * Transport = jak se tržba dostane k Finanční správě. Implementace:
 *   - MockTransport: deterministická simulace (vývoj, demo, testy)
 *   - Eet2Transport (server.ts): skutečné rozhraní EET 2.0, SOAP v4.1 — Playground / produkce
 */
import type { Sale } from "./sale.ts";
import type { EetErrorClass } from "./eet2/errors.ts";

export interface SendContext {
  /** true = první pokus o odeslání; false = opakované/dodatečné odeslání */
  firstAttempt: boolean;
  /** ověřovací režim — FS zprávu zkontroluje, ale neeviduje (vrací kód 0, ne POK) */
  verifyOnly: boolean;
  /** EIČ poplatníka (CZ + 8–10 číslic, obvykle DIČ) */
  eic: string;
  /** EIČ pověřujícího poplatníka (tržba za jiného), jinak null */
  delegatingEic?: string | null;
  /** UUID datové zprávy; každý pokus má nové */
  messageUuid?: string;
  /** uložený snímek dat zprávy (Р4) – pokud je, zpráva se sestaví z něj, ne z tržby */
  snapshot?: import("./eet2/message.ts").EetData;
}

/** Pro audit: co přesně odešlo a co přišlo zpět. */
export interface SendAudit {
  requestSha256?: string;
  httpStatus?: number;
  /** syrová (podepsaná) odpověď FS, zkrácená na 64 kB */
  responseBody?: string;
}

export interface EetWarning {
  code: number;
  text: string;
}

export type SendResult =
  | {
      ok: true;
      /** POK — potvrzovací kód; null v ověřovacím režimu */
      confirmationCode: string | null;
      /** odpověď z testovacího prostředí (Playground) */
      test: boolean;
      receivedAt: string;
      messageUuid: string;
      warnings: EetWarning[];
      audit?: SendAudit;
    }
  | {
      ok: false;
      /** dočasná chyba → opakovat se stejnou identitou tržby */
      retryable: boolean;
      code: string;
      message: string;
      status?: number;
      messageUuid?: string;
      warnings?: EetWarning[];
      /** tržbu nelze odeslat, dokud se nezmění nastavení (certifikát, EIČ, klíč) – fronta ji drží */
      blocked?: string;
      /** třída chybového kódu FS (Popis v1.2, 3.5.4) – jen u odpovědi s Chyba (R5.3) */
      errorClass?: EetErrorClass;
      audit?: SendAudit;
    };

export interface Transport {
  readonly name: string;
  send(sale: Sale, ctx: SendContext): Promise<SendResult>;
}

function uuid(): string {
  return crypto.randomUUID();
}

/** Deterministický POK pro testy: stejná tržba → stejný kód (formát UUIDv4 + "-ff" jako Playground). */
async function fakePok(seed: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  const h = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  const variant = "89ab"[parseInt(h[16]!, 16) % 4];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}-ff`;
}

export interface MockOptions {
  /** pravděpodobnost simulovaného výpadku sítě 0–1 */
  failureRate?: number;
  latencyMs?: number;
  random?: () => number;
}

export class MockTransport implements Transport {
  readonly name = "mock";
  constructor(private readonly opts: MockOptions = {}) {}

  async send(sale: Sale, ctx: SendContext): Promise<SendResult> {
    const messageUuid = ctx.messageUuid ?? uuid();
    const rnd = this.opts.random ?? Math.random;
    if (this.opts.latencyMs) await new Promise((r) => setTimeout(r, this.opts.latencyMs));
    if (rnd() < (this.opts.failureRate ?? 0)) {
      return { ok: false, retryable: true, code: "NETWORK", message: "Simulovaný výpadek spojení", messageUuid };
    }
    if (!/^CZ\d{8,10}$/.test(ctx.eic)) {
      return { ok: false, retryable: false, errorClass: "permanent", code: "EET_6", message: "Neplatné EIČ poplatníka", messageUuid };
    }
    const warnings: EetWarning[] = [];
    if (!ctx.firstAttempt) warnings.push({ code: 0, text: "Dodatečně odeslaná tržba (simulace)" });
    return {
      ok: true,
      confirmationCode: ctx.verifyOnly ? null : await fakePok(`${sale.id}|${ctx.eic}|${sale.total}`),
      test: true,
      receivedAt: new Date().toISOString(),
      messageUuid,
      warnings,
    };
  }
}
