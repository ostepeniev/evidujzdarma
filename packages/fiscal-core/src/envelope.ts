/**
 * Envelope encryption pro privátní klíče certifikátů.
 *
 *   data  --AES-256-GCM(DEK)-->  ciphertext            (uloženo v DB)
 *   DEK   --KeyEncryptor------>  encryptedDek          (uloženo v DB)
 *
 * KeyEncryptor je v MVP lokální master klíč (MASTER_KEY, mimo DB i zálohy). V produkci se čte ze souboru
 * MASTER_KEY_FILE (docker secret), ne ze sdíleného .env (R3.12).
 * Pro produkci lze zaměnit za KMS v EU (např. Scaleway Key Manager, OVHcloud KMS,
 * HashiCorp Vault Transit na vlastním serveru) bez změny datového formátu.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

export interface KeyEncryptor {
  readonly version: string;
  wrap(dek: Buffer): Promise<Buffer>;
  unwrap(wrapped: Buffer, version: string): Promise<Buffer>;
}

const IV_LEN = 12;
const TAG_LEN = 16;

function seal(key: Buffer, plaintext: Buffer, aad?: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(aad);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

function open(key: Buffer, sealed: Buffer, aad?: Buffer): Buffer {
  // plný 128bitový tag: Node bez authTagLength přijme i zkrácený (A Дрібне 3)
  if (sealed.length < IV_LEN + TAG_LEN) throw new Error("Poškozený šifrovaný záznam");
  const iv = sealed.subarray(0, IV_LEN);
  const tag = sealed.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = sealed.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LEN });
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Hodnota tajemství: obsah souboru z `<name>_FILE` (docker secret), jinak proměnná `<name>`.
 * Chyba čtení nese jen cestu, nikdy obsah.
 */
export function secretFromEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  const file = env[`${name}_FILE`];
  if (file) return readFileSync(file, "utf8").trim();
  return env[name];
}

/** Master klíč (base64, 32 bajtů) z MASTER_KEY_FILE nebo MASTER_KEY. Více verzí: MASTER_KEY_v2(_FILE) atd. pro rotaci. */
export class LocalKeyEncryptor implements KeyEncryptor {
  private readonly keys: Map<string, Buffer>;

  constructor(
    keys: Record<string, string>,
    readonly version: string,
  ) {
    this.keys = new Map(
      Object.entries(keys).map(([v, b64]) => {
        const k = Buffer.from(b64, "base64");
        if (k.length !== 32) throw new Error(`Master key ${v} musí mít 32 bajtů`);
        return [v, k];
      }),
    );
    if (!this.keys.has(version)) throw new Error(`Chybí master key verze ${version}`);
  }

  static fromEnv(env: Record<string, string | undefined> = process.env): LocalKeyEncryptor {
    const main = secretFromEnv(env, "MASTER_KEY");
    if (!main) throw new Error("MASTER_KEY není nastaven");
    const keys: Record<string, string> = { v1: main };
    for (const k of Object.keys(env)) {
      const m = k.match(/^MASTER_KEY_(v\d+)(?:_FILE)?$/);
      const v = m && secretFromEnv(env, `MASTER_KEY_${m[1]}`);
      if (m && v) keys[m[1]!] = v;
    }
    const current = env.MASTER_KEY_CURRENT ?? "v1";
    return new LocalKeyEncryptor(keys, current);
  }

  async wrap(dek: Buffer): Promise<Buffer> {
    return seal(this.keys.get(this.version)!, dek, Buffer.from(this.version));
  }

  async unwrap(wrapped: Buffer, version: string): Promise<Buffer> {
    const key = this.keys.get(version);
    if (!key) throw new Error(`Neznámá verze master klíče ${version}`);
    return open(key, wrapped, Buffer.from(version));
  }
}

export interface Sealed {
  ciphertext: Buffer;
  encryptedDek: Buffer;
  keyVersion: string;
}

/** `context` (např. account id) se váže jako AAD — ciphertext nelze přenést k jinému účtu. */
export async function encryptSecret(enc: KeyEncryptor, plaintext: Buffer, context: string): Promise<Sealed> {
  const dek = randomBytes(32);
  try {
    return {
      ciphertext: seal(dek, plaintext, Buffer.from(context)),
      encryptedDek: await enc.wrap(dek),
      keyVersion: enc.version,
    };
  } finally {
    dek.fill(0);
  }
}

export async function decryptSecret(enc: KeyEncryptor, sealed: Sealed, context: string): Promise<Buffer> {
  const dek = await enc.unwrap(sealed.encryptedDek, sealed.keyVersion);
  try {
    return open(dek, sealed.ciphertext, Buffer.from(context));
  } finally {
    dek.fill(0);
  }
}
