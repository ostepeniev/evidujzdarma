"use client";

import { useState } from "react";

/** S11: стан замовлення послуги в адмін-кабінеті – зберігається через /api/admin/nastaveni/[id]. */
export function OrderStatusEditor({ id, status, statuses }: { id: string; status: string; statuses: readonly { value: string; label: string }[] }) {
  const [s, setS] = useState(status);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save(next: string) {
    setS(next);
    setState("saving");
    const res = await fetch(`/api/admin/nastaveni/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  }
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Стан" className="input py-1 text-sm" value={s} disabled={state === "saving"} onChange={(e) => void save(e.target.value)}>
        {statuses.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
      <span role="status" className="text-xs text-muted">
        {state === "saved" ? "Збережено" : state === "error" ? "Не вдалося" : ""}
      </span>
    </div>
  );
}
