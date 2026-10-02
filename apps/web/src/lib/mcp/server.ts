/**
 * Veřejný MCP server EvidujZdarma – nástroje k EET 2.0 pro AI asistenty (Claude, ChatGPT, Cursor…).
 * Jen čtení, bez přihlášení. Logika je sdílená s webem (posouzení IČO, kalkulačka, fakta, návody).
 */
import { isValidIco, legalFormName, isNaturalPerson, normalizeIco } from "@ez/cz";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FACTS, FACTS_UPDATED, formatKc } from "@/content/facts";
import { MYTHS, MYTHS_UPDATED } from "@/content/myths";
import { assess, type Answers } from "@/lib/eet-assessment";
import { calculateEetOff, DEFAULT_INPUT, type Band } from "@/lib/eet-off";
import { STATUS_LABEL, type FsEnvironment, type Incident, type ProbeStatus } from "@/lib/fs-status";
import { guideText } from "@/lib/llms";
import { SITE, absoluteUrl } from "@/lib/site";
import { factItem, FACT_TOPICS, type FactTopic } from "./facts";
import { bulletList, respond, sourcesMd, toolError, type ResponseFormat, type ToolResult } from "./format";
import { publicGuide, publicGuidePath, publicGuides, searchGuides, toHit } from "./guides";
import { classifyPayment, PAYMENT_KINDS, PAYMENT_KIND_LABEL } from "./payments";

export const MCP_SERVER_NAME = "evidujzdarma-mcp-server";
export const MCP_SERVER_VERSION = "1.0.0";

/** Závislosti s I/O – v testech se podstrkují. */
export interface McpDeps {
  lookupCompany: (ico: string) => Promise<import("@/lib/server/ares").CompanyLookup | null>;
  /** null = monitor není k dispozici (např. bez databáze) */
  fsStatus: () => Promise<
    | { environment: FsEnvironment; latest: { checkedAt: Date; status: string; latencyMs: number | null } | null; uptime: { h24: number | null; d7: number | null; d30: number | null }; incidents: Incident[] }[]
    | null
  >;
  /** limit dotazů na klienta; false = překročeno */
  allow: (bucket: string, limit: number, perSeconds: number) => boolean;
}

const INSTRUCTIONS = `Tools for the Czech electronic registration of sales EET 2.0 (evidence tržeb), mandatory from 1 January 2027.
Use them to answer questions of Czech businesses: does EET apply to a company (by IČO), is a payment evidenced, does EET OFF pay off, key dates, penalties, receipts, units, certificates, and the current availability of the Finanční správa EET interface.
Content is in Czech and comes from ${SITE.domain} with sources (eet.gov.cz, the law, Finanční správa) and a "facts updated" date — cite the returned URLs.
${SITE.name} is an independent service, not operated by Finanční správa; answers are general information, not tax advice.`;

const responseFormat = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format: 'markdown' (human-readable, default) or 'json' (machine-readable).");

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;

const answer = z.enum(["yes", "no", "unknown"]);

export function createEetMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION, title: `${SITE.name} – EET 2.0`, websiteUrl: SITE.url }, { instructions: INSTRUCTIONS });

  /* ───────────── eet_check_ico ───────────── */
  server.registerTool(
    "eet_check_ico",
    {
      title: "Check whether EET 2.0 applies to a company (by IČO)",
      description: `Look up a Czech business by IČO in the public ARES register and estimate whether EET 2.0 (mandatory sales registration from 1 Jan 2027) applies, whether EET OFF is available, and what to do next (personal checklist with dates).

The estimate uses legal form, CZ-NACE activities and trade licences (RŽP) from ARES. ARES does not show whether the business accepts payments in person or uses the flat-rate tax, so pass the optional answers when you know them — they override the heuristics.

Args:
  - ico (string): 8-digit Czech company ID, spaces allowed, e.g. "27082440".
  - accepts_in_person_payments ('yes'|'no'|'unknown'): cash/card/QR accepted in person or at premises?
  - flat_tax_band ('band1'|'band2'|'band3'|'no'|'unknown'): paušální daň band, 'no' = not in the flat-rate regime.
  - income_under_1m ('yes'|'no'|'unknown'): yearly self-employment income up to 1,000,000 CZK?
  - response_format ('markdown'|'json').

Returns: subject (name, legal form, VAT payer, municipality), verdict ('likely'|'possible'|'unlikely'|'dissolved'), headline, eet_off ('possible'|'not_available'|'check') with explanation, reasons, checklist [{date, title, text, url}], url of the full check on the website.

Don't use for: payment-type questions (use eet_classify_payment) or the EET OFF cost comparison (use eet_calculate_eet_off).`,
      inputSchema: z
        .object({
          ico: z.string().min(6).max(12).describe('Czech IČO (8 digits), e.g. "27082440"'),
          accepts_in_person_payments: answer.default("unknown").describe("Does the business accept payments in person (cash, card, QR at the premises)?"),
          flat_tax_band: z.enum(["band1", "band2", "band3", "no", "unknown"]).default("unknown").describe("Flat-rate tax (paušální daň) band, or 'no'."),
          income_under_1m: answer.default("unknown").describe("Yearly self-employment income up to 1,000,000 CZK?"),
          response_format: responseFormat,
        })
        .strict(),
      annotations: { ...READ_ONLY, openWorldHint: true },
    },
    async (args): Promise<ToolResult> => {
      const ico = normalizeIco(args.ico);
      if (!ico || !isValidIco(ico)) return toolError(`"${args.ico}" není platné IČO (8 číslic s kontrolním součtem). Zkontrolujte číslo, např. na faktuře nebo v ARES.`);
      if (!deps.allow("ico", 20, 60)) return toolError("Příliš mnoho dotazů na ARES z jednoho klienta. Zkuste to za minutu.");
      let found;
      try {
        found = await deps.lookupCompany(ico);
      } catch (e) {
        return toolError(e instanceof Error && e.name === "AresBusyError" ? "Registr ARES je právě vytížený. Zkuste to za minutu." : "Registr ARES je dočasně nedostupný. Zkuste to za chvíli.");
      }
      if (!found) return toolError(`Subjekt s IČO ${ico} v ARES není. Ověřte číslo; zaniklé subjekty ARES také vrací.`);

      const answers: Answers = { inPerson: args.accepts_in_person_payments, pausal: args.flat_tax_band, incomeUnder1M: args.income_under_1m };
      const a = assess(found.subject, found.rzp, answers);
      const s = found.subject;
      const natural = isNaturalPerson(s.legalForm);
      const output = {
        subject: {
          ico: s.ico,
          name: s.name,
          legal_form: legalFormName(s.legalForm),
          natural_person: natural,
          vat_payer: s.vatPayer,
          // u fyzických osob jen obec (soukromí), u firem celá adresa
          address: natural ? s.address.city : s.address.text,
          dissolved_at: s.dissolvedAt,
        },
        verdict: a.verdict,
        headline: a.headline,
        eet_off: a.eetOff,
        eet_off_text: a.eetOffText,
        reasons: a.reasons,
        active_establishments: a.activeEstablishments,
        checklist: a.checklist.map((c) => ({ date: c.date ?? null, title: c.title, text: c.text, url: c.href ? absoluteUrl(c.href) : null })),
        url: absoluteUrl(`/kontrola-ico?ico=${ico}`),
        data_source: "ARES (Ministerstvo financí)",
      };
      const md = [
        `# ${s.name} (IČO ${s.ico})`,
        `**${a.headline}**`,
        `${output.subject.legal_form}${s.vatPayer ? " · plátce DPH" : ""}${output.subject.address ? ` · ${output.subject.address}` : ""}`,
        "## Proč",
        bulletList(a.reasons),
        "## EET OFF",
        a.eetOffText,
        "## Co udělat",
        bulletList(output.checklist.map((c) => `${c.date ? `**${c.date}** – ` : ""}${c.title}: ${c.text}${c.url ? ` (${c.url})` : ""}`)),
        `Podrobná kontrola: ${output.url}`,
        "Odhad vychází z veřejných údajů ARES; neví, zda podnikatel přijímá platby osobně. Pro přesnější výsledek zadejte doplňující odpovědi.",
      ].join("\n\n");
      return respond(output, md, args.response_format as ResponseFormat);
    },
  );

  /* ───────────── eet_calculate_eet_off ───────────── */
  server.registerTool(
    "eet_calculate_eet_off",
    {
      title: "Calculate whether EET OFF pays off",
      description: `Compare the EET OFF surcharge (${formatKc(FACTS.eetOff.surchargeMonthly)}/month added to the flat-rate tax instead of registering sales) with the real cost of registering sales (time × hourly rate + POS cost + hardware spread over 3 years). Handles businesses that start mid-year (surcharge only from the start month).

EET OFF is only for natural persons in band 1 of the flat-rate tax with income up to 1,000,000 CZK; for others the tool returns eligible=false with the reason.

Args:
  - flat_tax_band (1|2|3|0): 0 = not in the flat-rate regime.
  - yearly_income_czk (number): self-employment income per year in CZK.
  - start_month (1-12, default 1): month the business starts in 2027; 1 = whole year.
  - minutes_per_day (default ${DEFAULT_INPUT.minutesPerDay}), work_days_per_month (default ${DEFAULT_INPUT.workDaysPerMonth}), hourly_rate_czk (default ${DEFAULT_INPUT.hourlyRate}), pos_cost_monthly_czk (default 0 – the EvidujZdarma POS is free), hardware_one_off_czk (default 0).
  - response_format ('markdown'|'json').

Returns: eligible, reason (if not), verdict ('eet-off'|'evidence'|'tie'), surcharge_czk, evidence_cost_czk, difference_czk (positive = evidence costs more), months, flat_tax_monthly_2027_czk, rules (deadline, binding year, exceeding 1M, exit).`,
      inputSchema: z
        .object({
          flat_tax_band: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).describe("Flat-rate tax band 1–3, or 0 if not in the regime"),
          yearly_income_czk: z.number().min(0).max(100_000_000).describe("Yearly self-employment income in CZK"),
          start_month: z.number().int().min(1).max(12).default(1).describe("Month of starting the business in 2027 (1 = whole year)"),
          minutes_per_day: z.number().min(0).max(600).default(DEFAULT_INPUT.minutesPerDay).describe("Minutes per working day spent on sales registration"),
          work_days_per_month: z.number().min(0).max(31).default(DEFAULT_INPUT.workDaysPerMonth),
          hourly_rate_czk: z.number().min(0).max(100_000).default(DEFAULT_INPUT.hourlyRate).describe("Value of one hour of your time in CZK"),
          pos_cost_monthly_czk: z.number().min(0).max(100_000).default(0).describe("Monthly POS/app cost in CZK (EvidujZdarma = 0)"),
          hardware_one_off_czk: z.number().min(0).max(1_000_000).default(0).describe("One-off hardware cost in CZK (spread over 3 years)"),
          response_format: responseFormat,
        })
        .strict(),
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    async (args): Promise<ToolResult> => {
      const r = calculateEetOff({
        band: args.flat_tax_band as Band,
        income: args.yearly_income_czk,
        startMonth: args.start_month,
        minutesPerDay: args.minutes_per_day,
        workDaysPerMonth: args.work_days_per_month,
        hourlyRate: args.hourly_rate_czk,
        toolsMonthly: args.pos_cost_monthly_czk,
        hardwareOneOff: args.hardware_one_off_czk,
      });
      const rules = { deadline: FACTS.eetOff.howTo, natural_persons_only: FACTS.eetOff.naturalOnly, binding: FACTS.eetOff.binding, mid_year: FACTS.eetOff.midYear, over_limit: FACTS.eetOff.overLimit, exit: FACTS.eetOff.exit };
      const url = absoluteUrl("/kalkulacka-eet-off");
      if (!r.eligible) {
        return respond({ eligible: false, reason: r.reason, rules, url }, `# EET OFF není možný\n\n${r.reason}\n\nTržby přijaté osobně se pak evidují. Kalkulačka: ${url}`, args.response_format as ResponseFormat);
      }
      const output = {
        eligible: true,
        verdict: r.verdict,
        months: r.months,
        surcharge_czk: r.surchargeYearly,
        evidence_cost_czk: r.evidenceYearly,
        evidence_hours: r.timeHoursYearly,
        difference_czk: r.difference,
        flat_tax_monthly_2027_czk: r.pausalMonthly,
        flat_tax_with_surcharge_monthly_czk: r.pausalWithSurchargeMonthly,
        flat_tax_2027_provisional: true,
        rules,
        url,
      };
      const period = r.months === 12 ? "za rok" : `za ${r.months} měs.`;
      const verdict =
        r.verdict === "eet-off" ? "EET OFF se pravděpodobně vyplatí." : r.verdict === "evidence" ? "Evidence vyjde levněji než EET OFF." : "Vychází to zhruba nastejno.";
      const md = [
        `# Kalkulačka EET OFF: ${verdict}`,
        `- Přirážka EET OFF ${period}: **${formatKc(r.surchargeYearly)}**`,
        `- Náklady evidence ${period}: **${formatKc(r.evidenceYearly)}** (z toho ${r.timeHoursYearly.toLocaleString("cs-CZ")} h času)`,
        `- Paušální záloha 2027 v 1. pásmu (předběžně): ${formatKc(r.pausalMonthly)}/měs., s přirážkou ${formatKc(r.pausalWithSurchargeMonthly)}/měs.`,
        "## Pravidla",
        bulletList(Object.values(rules)),
        `Kalkulačka na webu: ${url}`,
      ].join("\n\n");
      return respond(output, md, args.response_format as ResponseFormat);
    },
  );

  /* ───────────── eet_classify_payment ───────────── */
  server.registerTool(
    "eet_classify_payment",
    {
      title: "Is this payment registered in EET 2.0?",
      description: `Decide whether a payment is an evidenced sale ("kontaktní platba") under EET 2.0. Payments accepted in person or at the premises (cash, card, QR scanned on site, vouchers, virtual assets, cheques) are evidenced; remote payments (bank transfer for an invoice, e-shop payment gateway, QR on an invoice/website) are not.

Args:
  - payment (${PAYMENT_KINDS.map((k) => `'${k}'`).join("|")})
  - in_person (boolean): was the payment made during personal contact or at the business premises?
  - response_format ('markdown'|'json').

Returns: evidenced ('yes'|'no'|'uncertain'), explanation, note, sources, guide url. 'uncertain' marks cases that need confirmation by a tax adviser (bank transfer made on site, cash on delivery). Activity-level exemptions are not evaluated here (see eet_get_facts topic 'exemptions').`,
      inputSchema: z
        .object({
          payment: z.enum(PAYMENT_KINDS).describe("Payment instrument"),
          in_person: z.boolean().describe("Payment made during personal contact or at the premises"),
          response_format: responseFormat,
        })
        .strict(),
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    async (args): Promise<ToolResult> => {
      const c = classifyPayment(args.payment, args.in_person);
      // odkaz na návod jen po revizi daňovým poradcem (Ф9)
      const guidePath = publicGuidePath(c.guide_url_path.replace(/^\/navody\//, ""));
      const url = guidePath ? absoluteUrl(guidePath) : null;
      const label = c.evidenced === "yes" ? "Eviduje se" : c.evidenced === "no" ? "Neeviduje se" : "Nejisté – ověřte";
      const md = [
        `# ${label}: ${PAYMENT_KIND_LABEL[c.payment]}${c.in_person ? " (osobně / v provozovně)" : " (na dálku)"}`,
        c.explanation,
        c.note ?? "",
        sourcesMd(c.sources),
        url ? `Návod: ${url}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const { guide_url_path: _path, ...rest } = c;
      return respond({ ...rest, guide_url: url }, md, args.response_format as ResponseFormat);
    },
  );

  /* ───────────── eet_get_facts ───────────── */
  server.registerTool(
    "eet_get_facts",
    {
      title: "Get verified facts about EET 2.0",
      description: `Return short, sourced facts about EET 2.0 on chosen topics (Czech text, each with official/primary sources and the date the facts were verified).

Topics: ${FACT_TOPICS.join(", ")}. Omit 'topics' to get all of them.

Key corrections this tool reflects: January 2027 is NOT a statutory pilot/grace period (evidence is mandatory from 1 Jan 2027); there is NO "occasional sales up to 50,000 CZK" exemption in the adopted law; the tax credit is "up to" 5,000 CZK for self-employed persons only.

Args:
  - topics (array of topic names, optional)
  - response_format ('markdown'|'json').

Returns: facts [{topic, title, text, sources[{label,url}]}], facts_updated.`,
      inputSchema: z
        .object({
          topics: z.array(z.enum(FACT_TOPICS)).min(1).max(FACT_TOPICS.length).optional().describe("Topics to return; omit for all"),
          response_format: responseFormat,
        })
        .strict(),
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    async (args): Promise<ToolResult> => {
      const topics = (args.topics ?? FACT_TOPICS) as readonly FactTopic[];
      const facts = [...new Set(topics)].map(factItem);
      const md = [`# EET 2.0 – fakta (stav k ${FACTS_UPDATED})`, ...facts.map((f) => `## ${f.title}\n\n${f.text}\n\n${sourcesMd(f.sources)}`)].join("\n\n");
      const guide = publicGuidePath("eet-2-0-kompletni-pruvodce");
      return respond({ facts, url: guide ? absoluteUrl(guide) : null }, md, args.response_format as ResponseFormat);
    },
  );

  /* ───────────── eet_list_misconceptions ───────────── */
  server.registerTool(
    "eet_list_misconceptions",
    {
      title: "List common misconceptions about EET 2.0",
      description: `Return claims about EET 2.0 that circulate in media and on commercial websites but contradict the adopted law or official Finanční správa information — each with what actually applies, a dated "as of", our opinion (clearly labelled) and sources. Use it to fact-check a claim before answering.

Args:
  - query (string, optional): filter by words, e.g. "leden", "50 000", "POK", "karta".
  - response_format ('markdown'|'json').

Returns: items [{id, question, claim, truth, comment, as_of, sources, url}], page_url.`,
      inputSchema: z
        .object({
          query: z.string().max(100).optional().describe('Optional filter, e.g. "leden" or "POK"'),
          response_format: responseFormat,
        })
        .strict(),
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    async (args): Promise<ToolResult> => {
      const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
      const terms = args.query ? fold(args.query).split(" ").filter(Boolean) : [];
      const pageUrl = absoluteUrl("/co-se-o-eet-pise-spatne");
      const items = MYTHS.filter((m) => !terms.length || terms.every((t) => fold(`${m.question} ${m.claim} ${m.truth}`).replace(/\s/g, "").includes(t.replace(/\s/g, "")))).map((m) => ({
        id: m.id,
        question: m.question,
        claim: m.claim,
        truth: m.truth,
        comment: m.comment ?? null,
        as_of: m.asOf,
        sources: m.sources,
        url: `${pageUrl}#${m.id}`,
      }));
      if (!items.length) return toolError(`K dotazu „${args.query}“ jsme žádný omyl nenašli. Zkuste obecnější slovo, nebo vynechte query pro celý seznam.`);
      const md = [
        `# Co se o EET 2.0 píše špatně (aktualizováno ${MYTHS_UPDATED})`,
        ...items.map((i) => `## ${i.question}\n\n**Píše se:** ${i.claim}\n\n**Co platí (stav k ${i.as_of}):** ${i.truth}${i.comment ? `\n\n**Náš názor:** ${i.comment}` : ""}\n\n${sourcesMd(i.sources)} · ${i.url}`),
      ].join("\n\n");
      return respond({ items, page_url: pageUrl, updated: MYTHS_UPDATED }, md, args.response_format as ResponseFormat);
    },
  );

  /* ───────────── eet_search_guides / eet_get_guide ───────────── */
  server.registerTool(
    "eet_search_guides",
    {
      title: "Search EET 2.0 guides",
      description: `Full-text search in the EvidujZdarma guides about EET 2.0 (in Czech): who must register sales, contact payments, units, DIS+ and certificates, EET OFF, penalties, offline operation, receipts, accommodation, hairdressers, craftsmen, selling on behalf of another person, glossary.

Args:
  - query (string): Czech or English keywords, e.g. "ubytování kauce", "certifikát DIS+", "bez internetu".
  - limit (1-10, default 5).
  - response_format ('markdown'|'json').

Returns: results [{slug, title, description, updated, reviewed, url}]. Use eet_get_guide with the slug to read the full text. 'reviewed' = checked by a tax adviser.`,
      inputSchema: z
        .object({
          query: z.string().min(2).max(200).describe("Search keywords"),
          limit: z.number().int().min(1).max(10).default(5),
          response_format: responseFormat,
        })
        .strict(),
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    async (args): Promise<ToolResult> => {
      const hits = searchGuides(args.query, args.limit).map((h) => ({ ...h, url: absoluteUrl(`/navody/${h.slug}`) }));
      if (!hits.length) {
        const available = publicGuides().map((g) => g.slug);
        return toolError(
          available.length
            ? `Pro „${args.query}“ jsme nic nenašli. Zkuste jiná slova (česky), nebo rovnou eet_get_guide s jedním ze slugů: ${available.join(", ")}.`
            : `Návody zatím čekají na odbornou revizi daňovým poradcem a strojově je nevydáváme. Ověřená fakta s prameny vrací eet_get_facts.`,
        );
      }
      const md = [`# Návody k EET 2.0: „${args.query}“`, ...hits.map((h) => `- **${h.title}** (slug: \`${h.slug}\`) – ${h.description} ${h.url}`)].join("\n\n");
      return respond({ query: args.query, count: hits.length, results: hits }, md, args.response_format as ResponseFormat);
    },
  );

  server.registerTool(
    "eet_get_guide",
    {
      title: "Read an EET 2.0 guide",
      description: `Return the full text of one EvidujZdarma guide (Czech, Markdown) including FAQ and sources, by slug from eet_search_guides.

Args:
  - slug (string): a slug returned by eet_search_guides. Only guides reviewed by a tax adviser are available.
  - response_format ('markdown'|'json').

Returns: slug, title, url, updated, reviewed, text (truncated at 25,000 characters).`,
      inputSchema: z
        .object({
          slug: z.string().regex(/^[a-z0-9-]{2,80}$/).describe("Guide slug from eet_search_guides"),
          response_format: responseFormat,
        })
        .strict(),
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    async (args): Promise<ToolResult> => {
      const g = publicGuide(args.slug);
      if (!g) {
        const available = publicGuides().map((x) => x.slug);
        return toolError(
          // požadovaný slug neopakujeme – u nerevidovaného návodu by to byl odkaz na něj (Ф9)
          `Takový návod není k dispozici: neexistuje, nebo ještě čeká na odbornou revizi daňovým poradcem. ${available.length ? `Dostupné slugy: ${available.join(", ")}.` : "Ověřená fakta s prameny vrací eet_get_facts."}`,
        );
      }
      const text = guideText(g);
      const hit = toHit(g);
      const note = hit.reviewed ? "" : "\n\n_Návod zatím čeká na odbornou revizi daňovým poradcem._";
      return respond({ ...hit, url: absoluteUrl(`/navody/${g.slug}`), text }, `${text}${note}`, args.response_format as ResponseFormat);
    },
  );

  /* ───────────── eet_get_fs_status ───────────── */
  server.registerTool(
    "eet_get_fs_status",
    {
      title: "Is EET down? Availability of the Finanční správa interface",
      description: `Return the current availability of the Finanční správa EET 2.0 interface (production trzbyeet.gov.cz and the Playground test environment) as measured every 5 minutes by EvidujZdarma: status ('up'|'slow'|'down'), last check, latency, uptime for 24 h / 7 days / 30 days and recent outages.

It measures reachability of the server, not the processing of individual sales. Official outage notices are published on eet.gov.cz.

Args:
  - response_format ('markdown'|'json').`,
      inputSchema: z.object({ response_format: responseFormat }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args): Promise<ToolResult> => {
      let summary;
      try {
        summary = await deps.fsStatus();
      } catch {
        summary = null;
      }
      if (!summary) return toolError(`Měření dostupnosti teď není k dispozici. Zkuste to později nebo otevřete ${absoluteUrl("/stav-eet")}.`);
      const fmt = (d: Date) => d.toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
      const environments = summary.map((s) => ({
        environment: s.environment,
        status: s.latest?.status ?? null,
        checked_at: s.latest?.checkedAt.toISOString() ?? null,
        latency_ms: s.latest?.latencyMs ?? null,
        uptime_percent: s.uptime,
        incidents: s.incidents.slice(0, 5).map((i) => ({ start: i.start.toISOString(), end: i.end?.toISOString() ?? null, ongoing: !i.end })),
      }));
      const md = [
        "# Stav rozhraní EET",
        ...summary.map((s) => {
          const st = s.latest?.status as ProbeStatus | undefined;
          return `## ${s.environment === "production" ? "Ostrý provoz (trzbyeet.gov.cz)" : "Playground (pg.trzbyeet.gov.cz)"}\n\n${st ? `**${STATUS_LABEL[st]}**` : "Zatím neměřeno"}${s.latest ? ` · měřeno ${fmt(s.latest.checkedAt)}${s.latest.latencyMs !== null ? ` · ${s.latest.latencyMs} ms` : ""}` : ""}\n\nDostupnost: 24 h ${s.uptime.h24 ?? "—"} %, 7 dní ${s.uptime.d7 ?? "—"} %, 30 dní ${s.uptime.d30 ?? "—"} %${s.incidents.length ? `\n\nVýpadky: ${s.incidents.slice(0, 5).map((i) => `${fmt(i.start)}–${i.end ? fmt(i.end) : "trvá"}`).join(", ")}` : ""}`;
        }),
        FACTS.offline.summary,
        `Stránka: ${absoluteUrl("/stav-eet")}`,
      ].join("\n\n");
      return respond({ environments, url: absoluteUrl("/stav-eet") }, md, args.response_format as ResponseFormat);
    },
  );

  return server;
}
