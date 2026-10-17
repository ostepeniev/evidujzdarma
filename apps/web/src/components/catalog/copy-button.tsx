"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tlačítko „Kopírovat“ (S3, katalog firem): text do schránky přes Clipboard API, potvrzení na 2 s. Nic neukládá
 * (žádné cookies ani localStorage), text je jen v paměti stránky. Bez Clipboard API (starý prohlížeč, HTTP) nabídne
 * text k ručnímu zkopírování.
 */
export function CopyButton({
  text,
  label,
  copiedLabel = "Zkopírováno",
  className = "btn-secondary px-3 py-1.5 text-sm",
  icon,
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("manual");
    }
  }

  return (
    <>
      <button type="button" onClick={copy} className={className} aria-live="polite">
        {icon}
        {state === "copied" ? copiedLabel : label}
      </button>
      {state === "manual" && (
        <textarea
          readOnly
          value={text}
          rows={Math.min(6, text.split("\n").length)}
          className="input mt-2 font-mono text-sm"
          aria-label="Text ke zkopírování"
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
        />
      )}
    </>
  );
}
