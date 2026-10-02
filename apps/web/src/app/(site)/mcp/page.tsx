import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { PageHeader } from "@/components/page-header";
import { ToolCta } from "@/components/tool-cta";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "EET 2.0 pro AI asistenty – MCP server zdarma",
  description:
    "Připojte Claude, ChatGPT, Cursor nebo VS Code k nástrojům EvidujZdarma: kontrola IČO, kalkulačka EET OFF, které platby se evidují, ověřená fakta, návody a stav EET. Veřejný MCP server zdarma, bez registrace.",
  alternates: { canonical: "/mcp" },
};

const ENDPOINT = absoluteUrl("/api/mcp");

const TOOLS = [
  ["eet_check_ico", "Týká se firmy EET? Posouzení podle IČO z registru ARES, možnost EET OFF a osobní checklist s termíny."],
  ["eet_calculate_eet_off", "Vyplatí se EET OFF? Přirážka proti nákladům evidence, i při zahájení podnikání v průběhu roku."],
  ["eet_classify_payment", "Eviduje se tahle platba? Hotovost, karta, QR, poukaz, převod, platební brána, dobírka."],
  ["eet_get_facts", "Ověřená fakta se zdroji: termíny, leden 2027, výjimky, účtenka a POK, jednotky, certifikát, pokuty, sleva na dani."],
  ["eet_list_misconceptions", "Co se o EET 2.0 píše špatně – tvrzení porovnaná se schváleným zákonem."],
  ["eet_search_guides", "Vyhledávání v návodech k EET 2.0."],
  ["eet_get_guide", "Celý text návodu včetně častých otázek a zdrojů."],
  ["eet_get_fs_status", "Je EET dole? Aktuální dostupnost rozhraní Finanční správy a historie výpadků."],
] as const;

const EXAMPLES = [
  "Jsem kadeřnice, moje IČO je … Týká se mě EET 2.0 a co mám udělat do konce roku?",
  "Začínám podnikat v červenci, mám paušál v 1. pásmu a čekám 400 000 Kč příjmů. Vyplatí se mi EET OFF?",
  "Host mi doplatí ubytování kartou na recepci a zálohu poslal převodem. Co z toho eviduji?",
  "Je pravda, že v lednu 2027 se za EET ještě nepokutuje?",
  "Funguje teď EET? Pokladna mi hlásí chybu spojení.",
];

const FAQ = [
  {
    q: "Kolik to stojí a potřebuji registraci?",
    a: "Nic a ne. MCP server je veřejný a zdarma, nástroje jen čtou veřejné informace. Limit je 120 požadavků za minutu a 20 kontrol IČO za minutu na jednoho klienta.",
  },
  {
    q: "Ukládáte, na co se asistent ptá?",
    a: "Obsah dotazů neukládáme. Pro ochranu před zneužitím počítáme jen počet požadavků z jedné IP adresy v paměti serveru. Kontrola IČO se ptá veřejného registru ARES.",
  },
  {
    q: "Je to oficiální nástroj Finanční správy?",
    a: "Ne. EvidujZdarma je nezávislá služba, není provozována Finanční správou. Odpovědi jsou obecné informace se zdroji, nejde o daňové poradenství. Oficiální informace najdete na eet.gov.cz.",
  },
  {
    q: "Umí asistent přes MCP evidovat tržby nebo vidět moje data?",
    a: "Ne. Veřejný server nemá přístup k žádnému účtu ani k pokladně. Přístup k vlastním tržbám a uzávěrkám (jen pro čtení, s přihlášením) chystáme pro účetní.",
  },
];

function Code({ children }: { children: string }) {
  return <pre className="mt-2 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-sm leading-relaxed text-white">{children}</pre>;
}

export default function McpPage() {
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHeader
        title="EET 2.0 pro AI asistenty"
        crumbs={[
          { name: "Nástroje", path: "/nastroje" },
          { name: "MCP server", path: "/mcp" },
        ]}
        lead={
          <>
            Připojte svého AI asistenta k nástrojům EvidujZdarma přes <strong>MCP</strong> (Model Context Protocol). Asistent pak odpovídá na otázky k EET 2.0
            z ověřených faktů se zdroji, zkontroluje firmu podle IČO a spočítá EET OFF. Zdarma a bez registrace.
          </>
        }
      />
      <div className="container-page grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 max-w-3xl space-y-12">
          <section aria-labelledby="url">
            <h2 id="url" className="text-2xl font-bold">
              Adresa serveru
            </h2>
            <Code>{ENDPOINT}</Code>
            <p className="mt-2 text-[15px] text-ink-soft">Streamable HTTP, bez přihlášení, jen pro čtení.</p>
          </section>

          <section aria-labelledby="pripojeni" className="space-y-6">
            <h2 id="pripojeni" className="text-2xl font-bold">
              Jak připojit
            </h2>
            <div>
              <h3 className="text-lg font-semibold">Claude (web a aplikace)</h3>
              <p className="mt-1 text-ink-soft">
                Nastavení → Konektory → Přidat vlastní konektor. Jako název zadejte „EvidujZdarma – EET 2.0“ a jako URL adresu serveru výše.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Claude Code</h3>
              <Code>{`claude mcp add --transport http evidujzdarma ${ENDPOINT}`}</Code>
            </div>
            <div>
              <h3 className="text-lg font-semibold">ChatGPT</h3>
              <p className="mt-1 text-ink-soft">
                V nastavení konektorů zapněte režim pro vývojáře a přidejte vlastní MCP konektor s adresou serveru. Dostupnost závisí na vašem tarifu.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Cursor</h3>
              <p className="mt-1 text-ink-soft">
                Soubor <code>~/.cursor/mcp.json</code>:
              </p>
              <Code>{JSON.stringify({ mcpServers: { evidujzdarma: { url: ENDPOINT } } }, null, 2)}</Code>
            </div>
            <div>
              <h3 className="text-lg font-semibold">VS Code</h3>
              <p className="mt-1 text-ink-soft">
                Soubor <code>.vscode/mcp.json</code>:
              </p>
              <Code>{JSON.stringify({ servers: { evidujzdarma: { type: "http", url: ENDPOINT } } }, null, 2)}</Code>
            </div>
          </section>

          <section aria-labelledby="nastroje">
            <h2 id="nastroje" className="text-2xl font-bold">
              Nástroje
            </h2>
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
              {TOOLS.map(([name, text]) => (
                <li key={name} className="px-5 py-3">
                  <code className="font-semibold text-brand-700">{name}</code>
                  <p className="mt-0.5 text-[15px] text-ink-soft">{text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">
              Odpovědi jsou česky, s odkazy na zdroje (eet.gov.cz, zákon, Finanční správa) a s datem, ke kterému jsme fakta ověřili. Stejná data jako na webu – při změně
              zákona se opraví všude najednou.
            </p>
          </section>

          <section aria-labelledby="priklady">
            <h2 id="priklady" className="text-2xl font-bold">
              Na co se můžete asistenta zeptat
            </h2>
            <ul className="mt-4 space-y-2">
              {EXAMPLES.map((e) => (
                <li key={e} className="rounded-xl bg-surface px-4 py-3 text-[15px] text-ink">
                  „{e}“
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="faq">
            <h2 id="faq" className="mb-6 text-2xl font-bold">
              Časté otázky
            </h2>
            <Faq items={FAQ} />
          </section>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-line p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Pro vývojáře</p>
            <ul className="mt-3 space-y-2 text-[15px] text-ink-soft">
              <li>Transport: Streamable HTTP, bezstavový, odpovědi JSON</li>
              <li>Server: evidujzdarma-mcp-server 1.0</li>
              <li>CORS povolen, metody POST a OPTIONS</li>
              <li>
                Stav EET strojově i bez MCP:{" "}
                <a href="/api/stav-eet" className="underline">
                  /api/stav-eet
                </a>
              </li>
              <li>
                Texty pro jazykové modely:{" "}
                <a href="/llms.txt" className="underline">
                  llms.txt
                </a>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl bg-brand-50 p-5 text-[15px] text-ink-soft">
            Raději bez asistenta? Všechno je i na webu:{" "}
            <Link href="/kontrola-ico" className="font-medium text-brand-700 underline">
              kontrola IČO
            </Link>
            ,{" "}
            <Link href="/kalkulacka-eet-off" className="font-medium text-brand-700 underline">
              kalkulačka EET OFF
            </Link>{" "}
            a{" "}
            <Link href="/navody" className="font-medium text-brand-700 underline">
              návody
            </Link>
            .
          </div>
        </aside>
      </div>
      <div className="container-page">
        <ToolCta />
      </div>
    </>
  );
}
