/**
 * R3.13 – po upgradu nodemaileru (7 → 10) odchází e-mail přes skutečný SMTP dialog: outbox → nodemailer →
 * minimální SMTP server v testu. Hlídá hlavičky, na kterých závisí doručitelnost a odhlášení jedním klikem.
 */
import { createServer, type Server } from "node:net";
import type { AddressInfo } from "node:net";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enqueueEmail, processOutbox } from "@/lib/server/mail";
import { createTestDb, type TestDb } from "../helpers/test-db";

let t: TestDb;
let server: Server;
const messages: { from: string; to: string[]; data: string }[] = [];

/** SMTP bez TLS a AUTH: EHLO, MAIL, RCPT, DATA (s dot-stuffingem), QUIT. */
function smtpSink(): Server {
  return createServer((sock) => {
    let buf = "";
    let inData = false;
    let cur = { from: "", to: [] as string[], data: "" };
    sock.write("220 sink ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            messages.push(cur);
            cur = { from: "", to: [], data: "" };
            sock.write("250 2.0.0 queued\r\n");
          } else cur.data += `${line.startsWith("..") ? line.slice(1) : line}\r\n`;
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") sock.write("250-sink\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n");
        else if (cmd === "MAIL") {
          cur.from = line;
          sock.write("250 OK\r\n");
        } else if (cmd === "RCPT") {
          cur.to.push(line);
          sock.write("250 OK\r\n");
        } else if (cmd === "DATA") {
          inData = true;
          sock.write("354 end with .\r\n");
        } else if (cmd === "QUIT") {
          sock.end("221 bye\r\n");
        } else sock.write("250 OK\r\n");
      }
    });
  });
}

beforeAll(async () => {
  t = await createTestDb();
  server = smtpSink();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.SMTP_URL = `smtp://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.MAIL_FROM = "EvidujZdarma <ahoj@evidujzdarma.cz>";
});
afterAll(async () => {
  delete process.env.SMTP_URL;
  await new Promise((r) => server.close(r));
  await t.close();
});

describe("R3.13 – mail delivery with nodemailer 10", () => {
  it("delivers a queued e-mail over SMTP with From, encoded Czech subject and one-click unsubscribe headers", async () => {
    await enqueueEmail({
      to: "klient@example.cz",
      template: "prereg-confirm",
      payload: { confirmToken: "c0nf1rm", unsubscribeToken: "uns-tok", companyName: "Kadeřnictví Žofie" },
    });
    expect(await processOutbox()).toEqual({ sent: 1, failed: 0 });
    expect(messages).toHaveLength(1);
    const m = messages[0]!;
    expect(m.from).toMatch(/^MAIL FROM:<ahoj@evidujzdarma\.cz>/i);
    expect(m.to).toEqual([expect.stringMatching(/^RCPT TO:<klient@example\.cz>/i)]);
    const headers = m.data.split("\r\n\r\n")[0]!.replace(/\r\n[ \t]+/g, " ");
    expect(headers).toMatch(/^From: EvidujZdarma <ahoj@evidujzdarma\.cz>$/m);
    expect(headers).toMatch(/^Subject: =\?UTF-8\?[BQ]\?/m);
    expect(headers).toMatch(/^List-Unsubscribe: <https?:\/\/[^>]+\/api\/odhlasit\?token=uns-tok>$/m);
    expect(headers).toMatch(/^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m);
    expect(headers).toMatch(/^Content-Type: multipart\/alternative/m);
    const [row] = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "klient@example.cz"));
    expect(row!.status).toBe("sent");
  });
});
