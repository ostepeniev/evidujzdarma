"use client";

import { useState } from "react";

const PLACEHOLDER_REF = "VAS-KOD";

/** HTML odznaku pro web účetní kanceláře. Inline styly, aby fungoval na libovolném webu. */
function partnerBadgeHtml(ref: string = PLACEHOLDER_REF): string {
  return [
    `<a href="https://evidujzdarma.cz/?ref=${encodeURIComponent(ref)}" title="EvidujZdarma – evidence tržeb EET 2.0 zdarma" target="_blank" rel="noopener"`,
    ` style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid #9edcc2;border-radius:12px;background:#eaf7f1;color:#075f44;font:600 14px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;text-decoration:none">`,
    `<span aria-hidden="true" style="display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;border-radius:999px;background:#0b7a57;color:#fff;font-size:12px">✓</span>`,
    `Partner EvidujZdarma</a>`,
  ].join("");
}

export function PartnerBadge() {
  const [copied, setCopied] = useState(false);
  const html = partnerBadgeHtml();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-line bg-white p-6">
        <p className="mb-3 text-sm font-medium text-muted">Náhled</p>
        {/* Statický vlastní HTML řetězec (bez vstupu uživatele) — náhled odpovídá kódu k vložení. */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <div>
        <label htmlFor="badge-code" className="label">
          Kód k vložení na web
        </label>
        <textarea
          id="badge-code"
          readOnly
          value={html}
          rows={5}
          className="input font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(html);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Zkopírováno" : "Kopírovat kód"}
          </button>
          <span className="text-sm text-muted" aria-live="polite">
            Text <code className="rounded bg-surface px-1">{PLACEHOLDER_REF}</code> nahraďte svým kódem, který dostanete po
            předregistraci.{" "}
            <a href="/pravidla-doporuceni" className="underline underline-offset-2">
              Pravidla akce
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
