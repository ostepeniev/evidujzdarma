"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="input bg-white text-sm" aria-label="Odkaz" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? "Zkopírováno" : "Kopírovat"}
      </button>
    </div>
  );
}
