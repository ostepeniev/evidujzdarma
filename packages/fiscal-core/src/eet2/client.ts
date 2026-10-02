/**
 * Eet2Transport — odeslání tržby Finanční správě (SOAP v4.1, WS-Security, server-only).
 *
 * Jeden pokus = jedna zpráva s novým uuid_zpravy a jeden HTTP POST bez přesměrování.
 * Opakování, lhůty a perzistenci řídí volající (fronta) podle queue.ts.
 */
import { createHash, randomUUID } from "node:crypto";
import type { Sale } from "../sale.ts";
import type { SendContext, SendResult, Transport } from "../transport.ts";
import { PemSigner } from "../signer.ts";
import {
  EET_ENDPOINTS,
  SOAP_ACTION,
  buildEetMessage,
  buildEetMessageFromSnapshot,
  buildEnvelope,
  canonicalBody,
  canonicalSignedInfo,
  type EetEnvironment,
  type EetMessage,
} from "./message.ts";
import { classifyChyba } from "./errors.ts";
import { defaultTrustPolicy, verifyResponse, type TrustPolicy } from "./response.ts";

export interface Eet2Credential {
  privateKeyPem: string;
  certificatePem: string;
  certificateDerBase64: string;
}

export interface PreparedRequest {
  messageUuid: string;
  message: EetMessage;
  xml: string;
  /** SHA-256 odeslaného XML (audit) */
  sha256: string;
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, "").toUpperCase()}`;
}

/** Sestaví a podepíše zprávu (bez síťové komunikace). */
export function prepareRequest(sale: Sale, ctx: SendContext, credential: Eet2Credential, now = new Date()): PreparedRequest {
  const messageUuid = ctx.messageUuid ?? randomUUID();
  const message = ctx.snapshot
    ? buildEetMessageFromSnapshot(ctx.snapshot, { messageUuid, sentAt: now, firstAttempt: ctx.firstAttempt, verifyOnly: ctx.verifyOnly })
    : buildEetMessage(sale, {
        eic: ctx.eic,
        delegatingEic: ctx.delegatingEic,
        messageUuid,
        sentAt: now,
        firstAttempt: ctx.firstAttempt,
        verifyOnly: ctx.verifyOnly,
      });
  const ids = { body: newId("id"), token: newId("X509"), signature: newId("SIG"), keyInfo: newId("KI"), str: newId("STR") };
  const digestB64 = createHash("sha256").update(canonicalBody(message, ids.body), "utf8").digest("base64");
  const signer = new PemSigner(credential.privateKeyPem, credential.certificatePem);
  const signatureB64 = signer.sign(canonicalSignedInfo(ids.body, digestB64)).toString("base64");
  const xml = buildEnvelope({ message, ids, certificateDerBase64: credential.certificateDerBase64, digestB64, signatureB64 });
  return { messageUuid, message, xml, sha256: createHash("sha256").update(xml).digest("hex") };
}

export interface Eet2TransportOptions {
  environment: EetEnvironment;
  /** vrátí přihlašovací údaje (certifikát) pro daného poplatníka */
  credential: (eic: string) => Promise<Eet2Credential>;
  endpoint?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  trust?: TrustPolicy;
  /** audit: zavolá se s připravenou zprávou PŘED odesláním */
  onPrepared?: (p: PreparedRequest) => Promise<void> | void;
}

/**
 * Kódy chyb: záporné = dočasná technická chyba (opakovat), kladné = chyba zprávy
 * (opravit, neopakovat beze změny), 0 = úspěšné ověření v ověřovacím režimu.
 * Konvence převzata z EET 1.0 — ověřit vůči EET_popis_rozhrani_v1.2.
 */
export class Eet2Transport implements Transport {
  readonly name: string;
  private readonly endpoint: string;
  private readonly trust: TrustPolicy;

  constructor(private readonly opts: Eet2TransportOptions) {
    this.name = `eet2-${opts.environment}`;
    this.endpoint = opts.endpoint ?? EET_ENDPOINTS[opts.environment];
    this.trust = opts.trust ?? defaultTrustPolicy(opts.environment);
  }

  async send(sale: Sale, ctx: SendContext): Promise<SendResult> {
    let prepared: PreparedRequest;
    try {
      prepared = prepareRequest(sale, ctx, await this.opts.credential(ctx.eic));
    } catch (e) {
      // Bez certifikátu/klíče nebo s neplatnými daty zprávu nelze sestavit. Tržba se NEZAHAZUJE:
      // fronta ji drží zablokovanou, dokud vlastník nenahraje certifikát nebo neopraví údaje (R1.3).
      return { ok: false, retryable: true, blocked: "PREPARE", code: "PREPARE", message: e instanceof Error ? e.message : String(e) };
    }
    await this.opts.onPrepared?.(prepared);
    const { messageUuid } = prepared;

    let res: Response;
    try {
      res = await (this.opts.fetch ?? fetch)(this.endpoint, {
        method: "POST",
        headers: { "content-type": "text/xml; charset=utf-8", soapaction: `"${SOAP_ACTION}"` },
        body: prepared.xml,
        redirect: "manual",
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
      });
    } catch (e) {
      // Zpráva mohla, ale nemusela dorazit → opakovat s prvni_zaslani=false.
      return { ok: false, retryable: true, code: "NETWORK", message: e instanceof Error ? e.message : String(e), messageUuid, audit: { requestSha256: prepared.sha256 } };
    }

    const text = await res.text();
    const audit = { requestSha256: prepared.sha256, httpStatus: res.status, responseBody: text.slice(0, 65_536) };
    if (!text.includes("Odpoved")) {
      // Bez odpovědi EET (výpadek, proxy, WAF, SOAP Fault) nevíme, že by FS zprávu odmítla →
      // tržbu zkoušíme dál v rámci 48h lhůty; o zaseknutých tržbách upozorní připomínky.
      return {
        ok: false,
        retryable: true,
        status: res.status,
        code: `HTTP_${res.status}`,
        message: res.status >= 500 ? "Služba EET je dočasně nedostupná" : text.slice(0, 300) || `HTTP ${res.status}`,
        messageUuid,
        audit,
      };
    }

    const v = verifyResponse(text, { expectedUuid: messageUuid, policy: this.trust });
    if (v.kind === "invalid") {
      // Neověřitelná odpověď: POK nepřijímáme, tržbu zkusíme odeslat znovu.
      return { ok: false, retryable: true, status: res.status, code: "INVALID_RESPONSE", message: v.reason, messageUuid, audit };
    }
    if (v.kind === "error") {
      const { code, text: msg } = v.parsed.error!;
      if (code === 0 && ctx.verifyOnly) {
        return { ok: true, confirmationCode: null, test: v.parsed.test, receivedAt: new Date().toISOString(), messageUuid, warnings: v.parsed.warnings, audit };
      }
      // klasifikace podle Popis v1.2, 3.5.4 (R5.3): kód 8 se opakuje omezeně, neznámé kódy nejsou tiché
      const errorClass = classifyChyba(code);
      return { ok: false, retryable: errorClass === "temporary" || errorClass === "ambiguous", errorClass, status: res.status, code: `EET_${code}`, message: msg, messageUuid, warnings: v.parsed.warnings, audit };
    }
    return {
      ok: true,
      confirmationCode: v.parsed.pok,
      test: v.parsed.test,
      receivedAt: v.parsed.receivedAt ?? new Date().toISOString(),
      messageUuid,
      warnings: v.parsed.warnings,
      audit,
    };
  }
}
