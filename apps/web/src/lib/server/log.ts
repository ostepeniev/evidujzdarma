/**
 * Bezpečný popis chyby do logu (R3.6 / Р6): typ, SQLSTATE a zkrácená zpráva bez textu SQL dotazu,
 * jeho parametrů a tokenů. Chyby drizzle mají ve zprávě „Failed query: … params: …“ – to do logu nesmí.
 */
export function safeError(e: unknown): { name: string; code?: string; message: string } {
  if (!(e instanceof Error)) return { name: typeof e, message: "" };
  const cause = (e as Error & { cause?: unknown }).cause;
  const code = (e as { code?: unknown }).code ?? (cause as { code?: unknown } | undefined)?.code;
  let message = e.message;
  if (/^Failed query:/i.test(message)) message = cause instanceof Error ? cause.message : "SQL dotaz selhal";
  message = message
    .replace(/params:[\s\S]*$/i, "")
    .replace(/(token|secret|password|heslo|key)=?[^\s&"']*/gi, "$1=[skryto]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[skryto]")
    .slice(0, 300);
  return { name: e.name, ...(typeof code === "string" ? { code } : {}), message };
}
