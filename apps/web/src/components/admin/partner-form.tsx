"use client";

import { useState } from "react";

/** Форма нового партнера (OAuth): client_secret показується один раз. */
export function PartnerForm() {
  const [name, setName] = useState("");
  const [uris, setUris] = useState("");
  const [logo, setLogo] = useState("");
  const [result, setResult] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/partneri", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, redirectUris: uris, logoUrl: logo }) });
    const data = (await res.json().catch(() => ({}))) as { clientId?: string; clientSecret?: string; error?: string };
    if (!res.ok || !data.clientId) return setError(data.error ?? `Помилка ${res.status}`);
    setResult({ clientId: data.clientId, clientSecret: data.clientSecret! });
  }
  if (result)
    return (
      <div className="card space-y-2">
        <p className="font-semibold">Партнера створено. Секрет показується лише зараз – передайте його партнеру захищеним каналом.</p>
        <p className="font-mono text-sm">client_id: {result.clientId}</p>
        <p className="break-all font-mono text-sm">client_secret: {result.clientSecret}</p>
      </div>
    );
  return (
    <form className="card space-y-3" onSubmit={(e) => void submit(e)}>
      <label className="block">
        <span className="label">Назва</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ALiSiO" required />
      </label>
      <label className="block">
        <span className="label">redirect_uri (кожна з нового рядка, лише https)</span>
        <textarea className="input min-h-24 font-mono text-sm" value={uris} onChange={(e) => setUris(e.target.value)} required />
      </label>
      <label className="block">
        <span className="label">Логотип (https, необов'язково)</span>
        <input className="input" value={logo} onChange={(e) => setLogo(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-danger-600">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary">
        Створити партнера
      </button>
    </form>
  );
}
