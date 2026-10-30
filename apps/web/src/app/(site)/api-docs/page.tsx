import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "@/components/external-link";
import { PageHeader } from "@/components/page-header";
import { ApiReference } from "@/components/api-docs/api-reference";
import { HOTEL_EXAMPLE_DEPOSIT, HOTEL_EXAMPLE_DEPOSIT_KEPT, HOTEL_ROWS } from "@/content/api-hotel";
import { FACTS, SOURCES } from "@/content/facts";
import { ERROR_CATALOG } from "@/lib/server/api/errors";
import { API_LIMITS } from "@/lib/server/api/http";
import { openApiDocument } from "@/lib/server/api/openapi";
import { OFFLINE_NOTE, SEND_BUDGET_MS } from "@/lib/server/api/v1";
import { absoluteUrl } from "@/lib/site";
import { canonicalMeta } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "EET API pro vývojáře – dokumentace EET 2.0 Gateway",
  description:
    "REST API pro odesílání tržeb do EET 2.0 z rezervačního systému, hotelového PMS nebo fakturace: tržby, vratky, stav a POK, denní přehledy, Playground Finanční správy. Dokumentace, příklady v curl, JavaScriptu a PHP, OpenAPI 3.1.",
  ...canonicalMeta("/api-docs"),
};

const BASE = `${absoluteUrl("/")}api`;
const OPENAPI = absoluteUrl("/api/v1/openapi.json");

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="mt-3">
      {label && <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</figcaption>}
      <pre className="overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[13px] leading-relaxed text-white">{children}</pre>
    </figure>
  );
}

const SALE_JSON = `{
  "sales": [{
    "id": "6f1c2a9e-8b1d-4c33-9f0e-2a7b5d4c1e01",
    "externalRef": "ALI-2026-000123",
    "unitId": "<id jednotky z GET /v1/units>",
    "soldAt": "2027-01-02T08:10:00+01:00",
    "lines": [{ "name": "Ubytování 2 noci", "qty": 1, "unitPrice": 320000, "vatRate": 12 }],
    "payments": [{ "method": "card", "amount": 320000 }]
  }]
}`;

const CURL = `curl -X POST ${BASE}/v1/sales \\
  -H "Authorization: Bearer $EZ_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${SALE_JSON.replace(/\n\s*/g, " ")}'`;

const JS = `const res = await fetch("${BASE}/v1/sales", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.EZ_TOKEN}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ sales: [sale] }),
});
const { results } = await res.json();
// results[0].status: confirmed | queued | sending | rejected | quarantined | not_evidenced
// results[0].pok a results[0].receipt vytiskněte na svůj doklad`;

const PHP = `$ch = curl_init("${BASE}/v1/sales");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("EZ_TOKEN"), "Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode(["sales" => [$sale]]),
  CURLOPT_TIMEOUT => 10,
]);
$results = json_decode(curl_exec($ch), true)["results"];`;

const REFUND_CURL = `# celá vratka
curl -X POST ${BASE}/v1/sales/<id původní tržby>/refund \\
  -H "Authorization: Bearer $EZ_TOKEN" -H "Content-Type: application/json" \\
  -d '{ "id": "<nové uuid vratky>", "externalRef": "ALI-STORNO-17" }'

# částečná vratka – jen položky z původní tržby, kladné množství
  -d '{ "id": "<nové uuid>", "lines": [{ "name": "Minibar", "qty": 1, "unitPrice": 5000, "vatRate": 21 }] }'`;

const WEBHOOK_VERIFY_JS = `import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(rawBody, header, secret, toleranceSeconds = 300) {
  const t = /(?:^|,)t=(\\d+)/.exec(header)?.[1];
  const v1 = /(?:^|,)v1=([0-9a-f]{64})/.exec(header)?.[1];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}`;

const WEBHOOK_VERIFY_PHP = `function ez_verify(string $rawBody, string $header, string $secret): bool {
  if (!preg_match('/t=(\\d+)/', $header, $t) || !preg_match('/v1=([0-9a-f]{64})/', $header, $v)) return false;
  if (abs(time() - (int) $t[1]) > 300) return false;
  $expected = hash_hmac('sha256', $t[1] . '.' . $rawBody, $secret);
  return hash_equals($expected, $v[1]);
}`;

const SECTIONS = [
  ["zaciname", "Začínáme"],
  ["autentizace", "Autentizace"],
  ["pripojeni", "Připojení (OAuth)"],
  ["trzby", "Tržby"],
  ["vratky", "Vratky"],
  ["webhooky", "Webhooky"],
  ["chyby", "Chyby"],
  ["limity", "Limity"],
  ["playground", "Playground"],
  ["co-se-eviduje", "Co se eviduje"],
  ["hotel", "Hotel a PMS"],
  ["reference", "Reference (OpenAPI)"],
  ["changelog", "Changelog API"],
] as const;

export default function ApiDocsPage() {
  const doc = openApiDocument();
  return (
    <>
      <PageHeader
        title="EET API pro vývojáře"
        crumbs={[{ name: "EET API", path: "/api-docs" }]}
        lead={
          <>
            Odesílejte tržby do EET 2.0 z rezervačního systému, hotelového PMS nebo fakturace přes REST API. Podpis, certifikát, komunikaci s Finanční správou, frontu a
            opakované odeslání při výpadku řešíme my – na stejné evidenci, jakou používá naše pokladna. Tržba odchází s EIČ, evidenční jednotkou a certifikátem podnikatele;
            jsme technický zprostředkovatel, ne pověřený poplatník.
          </>
        }
      />
      <div className="container-page grid gap-12 py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Obsah dokumentace" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 text-sm lg:flex-col lg:gap-1">
            {SECTIONS.map(([id, name]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-brand-700 underline-offset-4 hover:underline">
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-3xl space-y-14 text-[15px] leading-relaxed">
          <section id="zaciname" aria-labelledby="zaciname-h">
            <h2 id="zaciname-h" className="text-2xl font-bold">
              Začínáme (5 kroků)
            </h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5">
              <li>Podnikatel (váš zákazník) si založí účet EvidujZdarma, přidá evidenční jednotky s číslem z DIS+ a nahraje pokladní certifikát – nejdřív testovací pro Playground.</li>
              <li>
                Ve svém účtu otevře stránku <strong>Integrace</strong> (<code>/pokladna/integrace</code>) → <strong>Nová integrace</strong>, zvolí prostředí, jednotky a oprávnění a
                token vám předá. Token se zobrazí jen jednou.
              </li>
              <li>
                Ověřte token: <code>GET /v1/account</code> a <code>GET /v1/units</code> (jednotky, u kterých je <code>ready: true</code>).
              </li>
              <li>
                Na každou platbu přijatou na místě pošlete <code>POST /v1/sales</code> s vaším uuid platby jako <code>id</code>. V odpovědi je stav, POK a data na doklad.
              </li>
              <li>
                Stav dohledejte <code>GET /v1/sales?ids=…</code> nebo <code>GET /v1/sales/&#123;id&#125;</code>; vratku pošlete na <code>/v1/sales/&#123;id&#125;/refund</code>.
              </li>
            </ol>
            <p className="mt-4">
              Specifikace OpenAPI 3.1: <ExternalLink href={OPENAPI} className="font-mono text-brand-700 underline underline-offset-4">/api/v1/openapi.json</ExternalLink>. Částky jsou v haléřích (celá čísla),
              čas ISO 8601 s posunem, např. <code>2027-01-02T08:10:00+01:00</code>.
            </p>
          </section>

          <section id="autentizace" aria-labelledby="autentizace-h">
            <h2 id="autentizace-h" className="text-2xl font-bold">
              Autentizace
            </h2>
            <p className="mt-3">
              Každý požadavek nese hlavičku <code>Authorization: Bearer ezk_…</code>. Token <code>ezk_test_…</code> odesílá do Playgroundu Finanční správy, token{" "}
              <code>ezk_live_…</code> do ostrého provozu. Prostředí určuje token, ne tělo požadavku. Token pokladny na API nefunguje a token API nefunguje v pokladně.
            </p>
            <p className="mt-3">Oprávnění tokenu volí vlastník účtu:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <code>sales:write</code> – odesílat tržby; <code>sales:read</code> – číst jejich stav;
              </li>
              <li>
                <code>refunds:write</code> – vracet tržby bez PINu vlastníka;
              </li>
              <li>
                <code>units:read</code>, <code>closings:read</code>, <code>webhooks:manage</code>.
              </li>
            </ul>
            <p className="mt-3">
              Token vidí jen jednotky, které mu vlastník přidělil, a jen tržby, které sám poslal. Cizí jednotka nebo tržba vrací <code>404</code>. Když vlastník integraci odpojí, další
              požadavek dostane <code>401 token_revoked</code>; tržby, které už API přijalo, se do EET odešlou.
            </p>
          </section>

          <section id="pripojeni" aria-labelledby="pripojeni-h">
            <h2 id="pripojeni-h" className="text-2xl font-bold">
              Připojení jedním klikem (OAuth)
            </h2>
            <p className="mt-3">
              Místo kopírování tokenu může váš systém použít OAuth 2.0 (authorization code + PKCE S256). Aplikaci partnera s adresami pro návrat (redirect_uri) u nás
              zaregistrujeme a dostanete <code>client_id</code> a <code>client_secret</code>.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>
                Přesměrujte vlastníka na <code>{absoluteUrl("/pripojit")}?client_id=…&amp;redirect_uri=…&amp;state=…&amp;code_challenge=…&amp;code_challenge_method=S256&amp;scope=sales:write sales:read&amp;environment=test</code>.
              </li>
              <li>Vlastník se přihlásí, vybere účet a jednotky a klikne „Povolit“. Vrátíme ho na redirect_uri s parametry code a state (při „Zrušit“ error=access_denied).</li>
              <li>
                Kód (platí 10 minut, jednou) vyměňte na serveru: <code>POST /api/v1/oauth/token</code> s grant_type=authorization_code, code, redirect_uri, client_id,
                client_secret a code_verifier. Odpověď: access_token (token integrace bez expirace), scope, unit_ids, environment, integration_id.
              </li>
            </ol>
            <p className="mt-3">redirect_uri musí přesně odpovídat registraci, jinak připojení zastavíme bez přesměrování. Opakované použití kódu vrátí invalid_grant a token vydaný tímto kódem odvoláme.</p>
          </section>

          <section id="trzby" aria-labelledby="trzby-h">
            <h2 id="trzby-h" className="text-2xl font-bold">
              Tržby
            </h2>
            <p className="mt-3">
              <code>POST /v1/sales</code> přijme 1–{API_LIMITS.salesPerBatch} tržeb. <code>id</code> je klíč idempotence: stejné <code>id</code> se stejným tělem vrátí stejný výsledek
              a do FS nejde dvakrát; jiné tělo vrátí <code>409 idempotency_conflict</code>. Pořadové číslo (<code>sequence</code>) můžete poslat vlastní (nejvýš 25 znaků), jinak ho
              přidělí server.
            </p>
            <p className="mt-3">
              Nové tržby odešleme do FS hned, nejvýš {SEND_BUDGET_MS / 1000} s na celý požadavek. Co se do té doby nestihne, má stav <code>queued</code> nebo <code>sending</code> a
              odešle se z fronty – výsledek zjistíte dotazem na stav. Bez POK vytiskněte na doklad poznámku z <code>receipt.note</code>: „{OFFLINE_NOTE}“
            </p>
            <p className="mt-3">
              Druh položky <code>kind</code>: <code>goods</code> (výchozí) nebo <code>credit_topup</code> – dobití kreditu či hotelové karty k pozdějšímu čerpání. Záloha na
              ubytování je běžná tržba (<code>goods</code>). Platba převodem (<code>transfer</code>) se neeviduje: tržba jen z převodu má stav <code>not_evidenced</code> a do FS nejde.
            </p>
            <Code label="curl">{CURL}</Code>
            <Code label="JavaScript (fetch)">{JS}</Code>
            <Code label="PHP">{PHP}</Code>
          </section>

          <section id="vratky" aria-labelledby="vratky-h">
            <h2 id="vratky-h" className="text-2xl font-bold">
              Vratky
            </h2>
            <p className="mt-3">
              <code>POST /v1/sales/&#123;id&#125;/refund</code> vytvoří zápornou tržbu na jednotce původní tržby. Bez <code>lines</code> vrátí vše, co z tržby zbývá; s <code>lines</code>{" "}
              jen uvedené položky (musí být v původní tržbě). Platby vratky odpovídají platbám původní tržby. Dohromady nelze vrátit víc, než se prodalo –{" "}
              <code>422 refund_exceeds_original</code>. Vratku lze poslat i k tržbě, která ještě čeká na POK; obě se odešlou z fronty.
            </p>
            <Code label="curl">{REFUND_CURL}</Code>
          </section>

          <section id="webhooky" aria-labelledby="webhooky-h">
            <h2 id="webhooky-h" className="text-2xl font-bold">
              Webhooky
            </h2>
            <p className="mt-3">
              Endpoint zaregistrujete přes <code>POST /v1/webhooks</code> (oprávnění <code>webhooks:manage</code>) – adresa jen https, ne privátní ani interní (ověřujeme po DNS
              a přesměrování nesledujeme). Tajemství pro podpis dostanete jen v odpovědi na registraci. Události:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <code>sale.confirmed</code> – přišel POK; <code>sale.rejected</code> – FS tržbu definitivně odmítla nebo skončila v karanténě vlastníka;
              </li>
              <li>
                <code>sale.deadline_soon</code> – tržba stále nemá POK a do lhůty 48 hodin zbývá nejvýš 24 hodin (jednou na tržbu);
              </li>
              <li>
                <code>certificate.expiring</code> (31, 14 a 3 dny před koncem platnosti), <code>certificate.expired</code>;
              </li>
              <li>
                <code>integration.revoked</code> – vlastník integraci odpojil; <code>webhook.test</code> z <code>POST /v1/webhooks/&#123;id&#125;/test</code>.
              </li>
            </ul>
            <p className="mt-3">
              Tělo: <code>{`{ "id", "type", "createdAt", "data" }`}</code>, u tržeb je <code>data</code> stejný objekt jako v odpovědi API. Pořadí událostí nezaručujeme a jednu
              událost můžete dostat víckrát – deduplikujte podle id. Odpovězte 2xx do 5 sekund; jinak zkusíme znovu po 1 min, 5 min, 30 min, 2 h, 6 h a 24 h. Když endpoint
              nefunguje 3 dny v kuse, vypneme ho a napíšeme vlastníkovi účtu; tržby se evidují dál.
            </p>
            <p className="mt-3">
              Každý požadavek nese hlavičku <code>EZ-Signature: t=&lt;unix čas&gt;,v1=&lt;hex HMAC-SHA256(tajemství, t + &quot;.&quot; + tělo)&gt;</code>. Počítejte z
              nezměněného těla a odmítněte podpis starší než 5 minut:
            </p>
            <Code label="Node.js">{WEBHOOK_VERIFY_JS}</Code>
            <Code label="PHP">{WEBHOOK_VERIFY_PHP}</Code>
          </section>

          <section id="chyby" aria-labelledby="chyby-h">
            <h2 id="chyby-h" className="text-2xl font-bold">
              Chyby
            </h2>
            <p className="mt-3">
              Chyba celého požadavku má tvar <code>{`{ "error": { "code", "message", "field", "requestId" } }`}</code>; <code>message</code> je anglicky. Chyba jedné tržby je v{" "}
              <code>results[].error</code> a požadavek sám je <code>200</code>. Kódy se bez nové verze API nemění.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted">
                    <th className="py-1 pr-3 font-medium">HTTP</th>
                    <th className="py-1 pr-3 font-medium">code</th>
                    <th className="py-1 font-medium">Kdy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {Object.entries(ERROR_CATALOG).map(([code, e]) => (
                    <tr key={code}>
                      <td className="py-1 pr-3 font-mono">{e.http}</td>
                      <td className="py-1 pr-3 font-mono">{code}</td>
                      <td className="py-1">{e.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="limity" aria-labelledby="limity-h">
            <h2 id="limity-h" className="text-2xl font-bold">
              Limity
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                {API_LIMITS.requestsPerMinute} požadavků za minutu na token; nad limit <code>429 rate_limited</code> s hlavičkou <code>Retry-After</code> (sekundy) a hlavičkami{" "}
                <code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code>, <code>RateLimit-Reset</code>.
              </li>
              <li>
                {API_LIMITS.salesPerBatch} tržeb v jednom požadavku, tělo nejvýš 1 MB (<code>413</code>).
              </li>
              <li>
                Každá odpověď má hlavičku <code>X-Request-Id</code> – uveďte ji, když nám píšete o problému.
              </li>
            </ul>
          </section>

          <section id="playground" aria-labelledby="playground-h">
            <h2 id="playground-h" className="text-2xl font-bold">
              Playground
            </h2>
            <p className="mt-3">
              Playground je testovací prostředí Finanční správy (
              <ExternalLink href={SOURCES.fsPlayground.url} className="text-brand-700 underline underline-offset-4">
                oznámení FS
              </ExternalLink>
              ,{" "}
              <ExternalLink href={SOURCES.vyvojari.url} className="text-brand-700 underline underline-offset-4">
                eet.gov.cz pro vývojáře
              </ExternalLink>
              ). Tržby z něj se nikam nezapočítávají. První POK:
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>V účtu EvidujZdarma nahrajte testovací certifikát pro Playground (Nastavení pokladny → Certifikát → Testovací certifikát (Playground)).</li>
              <li>Jednotka musí mít číslo evidenční jednotky.</li>
              <li>
                Vytvořte integraci s prostředím <strong>Testovací (Playground)</strong> a tokenem <code>ezk_test_…</code> pošlete tržbu podle příkladu výše.
              </li>
              <li>
                Potvrzená tržba má <code>status: &quot;confirmed&quot;</code> a POK z Playgroundu, který končí na „ff“ – podle toho poznáte testovací odpověď. Ostrý POK takto
                nekončí.
              </li>
              <li>Pošlete stejnou tržbu znovu: dostanete stejný výsledek. Pak zkuste vratku.</li>
            </ol>
          </section>

          <section id="co-se-eviduje" aria-labelledby="co-se-eviduje-h">
            <h2 id="co-se-eviduje-h" className="text-2xl font-bold">
              Co se eviduje
            </h2>
            <p className="mt-3">
              {FACTS.evidenced.summary} {FACTS.evidenced.notEvidenced} {FACTS.evidenced.prepayments} Podrobně v návodech:{" "}
              <Link href="/navody/kontaktni-platba" className="text-brand-700 underline underline-offset-4">
                Co je kontaktní platba
              </Link>
              ,{" "}
              <Link href="/navody/eet-ubytovani" className="text-brand-700 underline underline-offset-4">
                EET v ubytování
              </Link>
              ,{" "}
              <Link href="/navody/storno-a-vraceni-eet" className="text-brand-700 underline underline-offset-4">
                Storno a vrácení peněz
              </Link>
              ,{" "}
              <Link href="/navody/spropitne-a-eet" className="text-brand-700 underline underline-offset-4">
                Spropitné
              </Link>
              . Rozhodnutí, co evidovat, zůstává na podnikateli – API odešle to, co pošlete.
            </p>
          </section>

          <section id="hotel" aria-labelledby="hotel-h">
            <h2 id="hotel-h" className="text-2xl font-bold">
              Hotel a PMS
            </h2>
            <p className="mt-3">
              Které platby z hotelového PMS poslat do API – podle návodu{" "}
              <Link href="/navody/eet-ubytovani" className="text-brand-700 underline underline-offset-4">
                EET u ubytování
              </Link>
              . Co evidovat, rozhoduje podnikatel; API odešle to, co PMS pošle.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted">
                    <th className="py-1 pr-3 font-medium">Událost v PMS</th>
                    <th className="py-1 pr-3 font-medium">Volat API?</th>
                    <th className="py-1 font-medium">Jak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {HOTEL_ROWS.map((r) => (
                    <tr key={r.event}>
                      <td className="py-1.5 pr-3">{r.event}</td>
                      <td className="py-1.5 pr-3 font-semibold">{r.call}</td>
                      <td className="py-1.5">{r.how.replace(/`/g, "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Code label="Záloha na recepci a doplatek kartou při odjezdu (dvě tržby)">{JSON.stringify(HOTEL_EXAMPLE_DEPOSIT, null, 2)}</Code>
            <Code label="Kauce 3 000 Kč složená na recepci, ponecháno 300 Kč">{JSON.stringify(HOTEL_EXAMPLE_DEPOSIT_KEPT, null, 2)}</Code>
          </section>

          <section id="reference" aria-labelledby="reference-h">
            <h2 id="reference-h" className="text-2xl font-bold">
              Reference (OpenAPI)
            </h2>
            <p className="mb-4 mt-3">Vygenerováno ze stejných schémat, kterými API kontroluje požadavky. Kliknutím rozbalíte.</p>
            <ApiReference doc={doc as never} />
          </section>

          <section id="changelog" aria-labelledby="changelog-h">
            <h2 id="changelog-h" className="text-2xl font-bold">
              Changelog API
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                <strong>v1 (30. 10. 2026)</strong> – první verze: tržby, stav, vratky, jednotky, denní přehledy, webhooky, připojení přes OAuth, Playground.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
