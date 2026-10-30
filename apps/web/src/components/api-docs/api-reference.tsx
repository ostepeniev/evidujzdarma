/**
 * Referenční část /api-docs vykreslená na serveru přímo z openApiDocument() (S8, rozd. 5.2). Žádný skript třetí strany
 * ani CDN (CSP, invariant 6): cesty a schémata se rozbalují nativním <details>.
 */
type Doc = {
  paths: Record<string, Record<string, { operationId: string; summary: string; parameters?: { name: string; in: string; required?: boolean; description?: string }[]; requestBody?: unknown; responses: Record<string, { description: string }> }>>;
  components: { schemas: Record<string, unknown> };
};

const METHOD_CLASS: Record<string, string> = { get: "bg-brand-50 text-brand-700", post: "bg-sun-50 text-warn-700" };

export function ApiReference({ doc }: { doc: Doc }) {
  return (
    <div className="space-y-3">
      {Object.entries(doc.paths).flatMap(([path, item]) =>
        Object.entries(item).map(([method, op]) => (
          <details key={`${method} ${path}`} className="group rounded-2xl border border-line bg-white p-4" id={op.operationId}>
            <summary className="flex cursor-pointer flex-wrap items-baseline gap-3">
              <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold uppercase ${METHOD_CLASS[method] ?? "bg-surface"}`}>{method}</span>
              <code className="font-mono text-[15px] font-semibold">{path}</code>
              <span className="text-sm text-ink-soft">{op.summary}</span>
            </summary>
            <div className="mt-4 space-y-3 text-sm">
              {op.parameters?.length ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-muted">
                      <th className="py-1 font-medium">Parametr</th>
                      <th className="py-1 font-medium">Kde</th>
                      <th className="py-1 font-medium">Popis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {op.parameters.map((p) => (
                      <tr key={p.name}>
                        <td className="py-1 font-mono">
                          {p.name}
                          {p.required ? " *" : ""}
                        </td>
                        <td className="py-1">{p.in}</td>
                        <td className="py-1">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <ul className="space-y-1">
                {Object.entries(op.responses).map(([code, r]) => (
                  <li key={code}>
                    <span className="font-mono font-semibold">{code}</span> – {r.description}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )),
      )}
      <h3 className="pt-4 text-lg font-bold">Schémata</h3>
      {Object.entries(doc.components.schemas).map(([name, s]) => (
        <details key={name} className="rounded-2xl border border-line bg-white p-4" id={`schema-${name}`}>
          <summary className="cursor-pointer font-mono font-semibold">{name}</summary>
          <pre className="mt-3 max-h-[480px] overflow-auto rounded-xl bg-surface p-3 font-mono text-xs leading-relaxed">{JSON.stringify(s, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}
