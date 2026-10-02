/**
 * Společné formátování odpovědí MCP nástrojů: Markdown pro lidi, JSON pro programy,
 * vždy i `structuredContent`. Každá odpověď nese zdroj, datum stavu a upozornění na nezávislost.
 */
import { FACTS_UPDATED } from "@/content/facts";
import { SITE } from "@/lib/site";

export const CHARACTER_LIMIT = 25_000;

export type ResponseFormat = "markdown" | "json";

export const DISCLAIMER = `${SITE.name} (${SITE.domain}) je nezávislá služba, není provozována Finanční správou. Informace nejsou daňovým poradenstvím; oficiální zdroj je eet.gov.cz.`;

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/** Odpověď nástroje v požadovaném formátu, ořezaná na CHARACTER_LIMIT. */
export function respond(output: Record<string, unknown>, markdown: string, format: ResponseFormat): ToolResult {
  const meta = { facts_updated: FACTS_UPDATED, disclaimer: DISCLAIMER };
  const structured = { ...output, ...meta };
  let text = format === "json" ? JSON.stringify(structured, null, 2) : `${markdown.trim()}\n\n---\n_${DISCLAIMER} Fakta ověřena k ${FACTS_UPDATED}._`;
  if (text.length > CHARACTER_LIMIT) {
    text = `${text.slice(0, CHARACTER_LIMIT - 200)}\n\n[Odpověď zkrácena na ${CHARACTER_LIMIT} znaků. Zužte dotaz (např. parametr limit nebo konkrétní téma).]`;
  }
  return { content: [{ type: "text", text }], structuredContent: structured };
}

/** Chyba v rámci výsledku nástroje (ne chyba protokolu) – s radou, co udělat dál. */
export function toolError(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: `Chyba: ${message}` }] };
}

export function bulletList(items: readonly string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

export function sourcesMd(sources: readonly { label: string; url: string }[]): string {
  return sources.length ? `Zdroje: ${sources.map((s) => `[${s.label}](${s.url})`).join(" · ")}` : "";
}
