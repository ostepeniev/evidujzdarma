import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ověření webhooku EvidujZdarma (S8, rozd. 8) – stejný kód je jako příklad v /api-docs.
 * Hlavička `EZ-Signature: t=<unix>,v1=<hex hmac_sha256(secret, t + "." + rawBody)>`; podpis starší než 5 minut se odmítá.
 * `rawBody` musí být přesně tělo požadavku, jak přišlo (ne znovu serializovaný JSON).
 */
export function verifyWebhookSignature(rawBody: string, header: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): boolean {
  const t = /(?:^|,)t=(\d+)/.exec(header)?.[1];
  const v1 = /(?:^|,)v1=([0-9a-f]{64})/.exec(header)?.[1];
  if (!t || !v1) return false;
  if (Math.abs(nowSeconds - Number(t)) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
