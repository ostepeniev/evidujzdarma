"use client";

import { useEffect, useState } from "react";
import { LETTERS, PLACEHOLDER_OFFICE, fillLetter, type LetterTemplate } from "@/content/letters";

const STORAGE_KEY = "ez_office_name";

/** Zvýrazní zbývající zástupné texty v hranatých závorkách. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <mark key={i} className="rounded bg-sun-100 px-0.5 text-ink">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary px-4 py-2 text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          setCopied(false);
        }
      }}
    >
      <span aria-live="polite">{copied ? "Zkopírováno ✓" : label}</span>
    </button>
  );
}

function LetterCard({ letter, office }: { letter: LetterTemplate; office: string }) {
  const subject = fillLetter(letter.subject, office);
  const body = fillLetter(letter.body, office);
  const headingId = `letter-${letter.id}`;
  return (
    <article aria-labelledby={headingId} className="card p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-brand-100 text-brand-700">{letter.when}</span>
        <span className="chip bg-surface text-muted">{letter.audience}</span>
      </div>
      <h2 id={headingId} className="mt-3 text-xl font-bold text-ink sm:text-2xl">
        {letter.title}
      </h2>
      <div className="mt-5 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-medium text-muted">Předmět</p>
        <p className="mt-1 font-semibold text-ink">
          <Highlighted text={subject} />
        </p>
      </div>
      <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border border-line bg-white p-4" tabIndex={0} aria-label={`Text dopisu: ${letter.title}`}>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
          <Highlighted text={body} />
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <CopyButton text={body} label="Kopírovat text" />
        <CopyButton text={subject} label="Kopírovat předmět" />
        <CopyButton text={`${subject}\n\n${body}`} label="Kopírovat vše" />
      </div>
    </article>
  );
}

export function LetterTemplates() {
  const [office, setOffice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOffice(saved);
    } catch {}
  }, []);

  function update(v: string) {
    setOffice(v);
    try {
      if (v.trim()) localStorage.setItem(STORAGE_KEY, v);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  return (
    <div className="space-y-8">
      <div className="card p-5 sm:p-6">
        <label htmlFor="office-name" className="label">
          Název vaší kanceláře
        </label>
        <input
          id="office-name"
          value={office}
          onChange={(e) => update(e.target.value)}
          maxLength={120}
          autoComplete="organization"
          className="input"
          placeholder="Např. Účetnictví Novák s.r.o."
          aria-describedby="office-hint"
        />
        <p id="office-hint" className="mt-2 text-sm text-muted">
          Doplní se místo <mark className="rounded bg-sun-100 px-0.5 text-ink">{PLACEHOLDER_OFFICE}</mark> ve všech šablonách. Ostatní
          žlutě zvýrazněné texty (například jméno klienta) doplňte ručně nebo hromadnou korespondencí. Název se uloží jen ve vašem
          prohlížeči.
        </p>
      </div>
      {LETTERS.map((l) => (
        <LetterCard key={l.id} letter={l} office={office} />
      ))}
    </div>
  );
}
