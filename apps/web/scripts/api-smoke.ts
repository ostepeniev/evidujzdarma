/**
 * Kouřový test EET API v1 proti běžící instanci a Playgroundu Finanční správy (S8, rozd. 5.3 a 13 – přijetí).
 *
 *   EZ_API_BASE=https://evidujzdarma.cz/api EZ_TOKEN=ezk_test_… EZ_UNIT_ID=<uuid> pnpm --filter web api-smoke
 *
 * Kroky: účet a jednotky → tržba (čeká na POK končící „ff“) → opakování se stejným tělem (stejný výsledek) → čtení
 * podle id a externalRef → vratka (POK) → (volitelně) webhook sale.confirmed na místní přijímač s ověřením podpisu
 * (EZ_WEBHOOK_URL = veřejná https adresa tunelu na port EZ_WEBHOOK_PORT, výchozí 8787).
 * Do výstupu nikdy nejde token – jen jeho prefix.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const BASE = (process.env.EZ_API_BASE ?? "http://localhost:3000/api").replace(/\/$/, "");
const TOKEN = process.env.EZ_TOKEN ?? "";
const UNIT = process.env.EZ_UNIT_ID ?? "";
const WEBHOOK_URL = process.env.EZ_WEBHOOK_URL ?? "";
const WEBHOOK_PORT = Number(process.env.EZ_WEBHOOK_PORT ?? 8787);

if (!/^ezk_test_/.test(TOKEN)) {
  console.error("EZ_TOKEN musí být testovací token ezk_test_… (smoke test běží jen proti Playgroundu).");
  process.exit(2);
}

const log = (step: string, data: unknown) => console.log(`[${new Date().toISOString()}] ${step}: ${typeof data === "string" ? data : JSON.stringify(data)}`);

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as any;
  return { status: res.status, requestId: res.headers.get("x-request-id"), json };
}

function check(ok: unknown, what: string): asserts ok {
  if (!ok) {
    console.error(`✗ ${what}`);
    process.exit(1);
  }
  console.log(`✓ ${what}`);
}

async function waitConfirmed(id: string, seconds = 60) {
  for (let i = 0; i < seconds / 3; i++) {
    const r = await api("GET", `/v1/sales/${id}`);
    if (r.json?.status === "confirmed" || r.json?.status === "rejected") return r.json;
    await new Promise((res) => setTimeout(res, 3_000));
  }
  return (await api("GET", `/v1/sales/${id}`)).json;
}

/** Místní přijímač webhooků: ověří EZ-Signature (t=…,v1=hmac_sha256(secret, t + "." + body)) s tolerancí 5 min. */
function receiver(secret: () => string | null) {
  const events: { type: string; data: any; valid: boolean }[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const sig = String(req.headers["ez-signature"] ?? "");
      const t = /t=(\d+)/.exec(sig)?.[1];
      const v1 = /v1=([0-9a-f]+)/.exec(sig)?.[1] ?? "";
      const s = secret();
      const expected = s && t ? createHmac("sha256", s).update(`${t}.${raw}`).digest("hex") : "";
      const fresh = t ? Math.abs(Date.now() / 1000 - Number(t)) < 300 : false;
      const valid = !!expected && fresh && expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
      const body = JSON.parse(raw || "{}");
      events.push({ type: body.type, data: body.data, valid });
      res.writeHead(valid ? 200 : 400).end();
    });
  });
  server.listen(WEBHOOK_PORT);
  return { events, close: () => server.close() };
}

async function main() {
  log("base", BASE);
  log("token", `${TOKEN.slice(0, 12)}…`);
  const acc = await api("GET", "/v1/account");
  check(acc.status === 200 && acc.json.environment === "test", `GET /v1/account → test, certifikát ${acc.json?.certificate?.status}`);
  const units = await api("GET", "/v1/units");
  const unit = UNIT || units.json?.units?.find((u: any) => u.ready)?.id;
  check(unit, "jednotka připravená k evidenci");

  let secret: string | null = null;
  const rec = WEBHOOK_URL ? receiver(() => secret) : null;
  if (WEBHOOK_URL) {
    const wh = await api("POST", "/v1/webhooks", { url: WEBHOOK_URL, events: ["sale.confirmed"] });
    check(wh.status === 200 || wh.status === 201, `POST /v1/webhooks → ${wh.status}`);
    secret = wh.json.secret;
  }

  const sale = {
    id: randomUUID(),
    externalRef: `SMOKE-${Date.now()}`,
    unitId: unit,
    soldAt: new Date(Math.floor(Date.now() / 1000) * 1000).toISOString(),
    lines: [
      { name: "Ubytování 1 noc (smoke test)", qty: 1, unitPrice: 150000, vatRate: 12 },
      { name: "Minibar", qty: 2, unitPrice: 5000, vatRate: 21 },
    ],
    payments: [{ method: "card", amount: 160000 }],
  };
  const first = await api("POST", "/v1/sales", { sales: [sale] });
  log("POST /v1/sales", { status: first.status, requestId: first.requestId, result: first.json?.results?.[0]?.status });
  check(first.status === 200, "tržba přijata");
  const confirmed = first.json.results[0].status === "confirmed" ? first.json.results[0] : await waitConfirmed(sale.id);
  log("POK", confirmed.pok);
  check(confirmed.status === "confirmed" && /-ff$/i.test(confirmed.pok ?? ""), "POK z Playgroundu končí na „ff“");

  const again = await api("POST", "/v1/sales", { sales: [sale] });
  check(again.json?.results?.[0]?.pok === confirmed.pok, "opakování se stejným tělem → stejný výsledek");
  const byRef = await api("GET", `/v1/sales?externalRef=${encodeURIComponent(sale.externalRef)}`);
  check(byRef.json?.sales?.[0]?.id === sale.id, "dohledání podle externalRef");

  const refundId = randomUUID();
  const refund = await api("POST", `/v1/sales/${sale.id}/refund`, { id: refundId, lines: [{ name: "Minibar", qty: 1, unitPrice: 5000, vatRate: 21 }] });
  log("POST refund", { status: refund.status, requestId: refund.requestId, result: refund.json?.status });
  const refundDone = refund.json?.status === "confirmed" ? refund.json : await waitConfirmed(refundId);
  check(refundDone.status === "confirmed" && /-ff$/i.test(refundDone.pok ?? ""), "vratka potvrzena (POK)");

  if (rec) {
    for (let i = 0; i < 40 && !rec.events.some((e) => e.type === "sale.confirmed" && e.data?.id === sale.id); i++) await new Promise((r) => setTimeout(r, 3_000));
    const ev = rec.events.find((e) => e.type === "sale.confirmed" && e.data?.id === sale.id);
    check(ev?.valid, "webhook sale.confirmed přijat s platným podpisem");
    rec.close();
  }
  console.log("Hotovo.");
}

main().catch((e) => {
  console.error("Smoke test selhal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
