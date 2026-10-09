"use client";

import { useState } from "react";

/** Статус і нотатка передреєстрації в адмін-кабінеті (R15.2) – зберігається через /api/admin/predregistrace/[id]. */
export function CrmEditor({ id, status, note, statuses }: { id: string; status: string; note: string; statuses: readonly { value: string; label: string }[] }) {
  const [s, setS] = useState(status);
  const [n, setN] = useState(note);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    const res = await fetch(`/api/admin/predregistrace/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: s, note: n }),
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={save} className="flex min-w-[220px] flex-col gap-1.5">
      <select aria-label="Статус" className="input py-1 text-sm" value={s} onChange={(e) => setS(e.target.value)}>
        {statuses.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
      <textarea aria-label="Нотатка" className="input py-1 text-sm" rows={2} maxLength={2000} value={n} onChange={(e) => setN(e.target.value)} />
      <div className="flex items-center gap-2">
        <button type="submit" className="btn-secondary px-2 py-1 text-sm" disabled={state === "saving"}>
          Зберегти
        </button>
        <span role="status" className="text-xs text-muted">
          {state === "saved" ? "Збережено" : state === "error" ? "Не вдалося зберегти" : ""}
        </span>
      </div>
    </form>
  );
}
