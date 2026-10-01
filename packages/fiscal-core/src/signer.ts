/**
 * Kryptografické primitivy pro podpis tržeb (Node.js).
 * Konkrétní skladba podepisovaného řetězce je v protocol.ts — zde jen obecné funkce.
 */
import { createHash, createPrivateKey, createSign, createVerify, type KeyObject } from "node:crypto";

export interface Signer {
  /** RSA-SHA256 (PKCS#1 v1.5) podpis UTF-8 řetězce → raw bytes */
  sign(data: string): Buffer;
  readonly certificatePem: string;
}

export class PemSigner implements Signer {
  private readonly key: KeyObject;
  constructor(
    privateKeyPem: string,
    readonly certificatePem: string,
  ) {
    this.key = createPrivateKey(privateKeyPem);
  }

  sign(data: string): Buffer {
    const s = createSign("RSA-SHA256");
    s.update(data, "utf8");
    s.end();
    return s.sign(this.key);
  }
}

export function verifySignature(data: string, signature: Buffer, certificatePem: string): boolean {
  const v = createVerify("RSA-SHA256");
  v.update(data, "utf8");
  v.end();
  return v.verify(certificatePem, signature);
}

/** SHA-1 otisk podpisu formátovaný jako 5 bloků po 8 hex znacích (formát BKP z EET 1.0). */
export function sha1Blocks(signature: Buffer): string {
  const hex = createHash("sha1").update(signature).digest("hex").toUpperCase();
  return hex.match(/.{8}/g)!.join("-");
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
