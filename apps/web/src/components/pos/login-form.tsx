"use client";

import { useState } from "react";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent")
    return (
      <div className="mt-6 rounded-2xl bg-brand-50 p-5" role="status">
        <p className="font-semibold">Zkontrolujte e-mail</p>
        <p className="mt-1 text-[15px] text-ink-soft">Na {email} jsme poslali odkaz pro přihlášení. Platí 15 minut.</p>
      </div>
    );

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError(null);
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, redirectTo }),
        }).catch(() => null);
        if (res?.ok) setState("sent");
        else {
          setState("error");
          setError((await res?.json().catch(() => null))?.error ?? "Nepodařilo se odeslat. Zkontrolujte připojení.");
        }
      }}
    >
      <div>
        <label htmlFor="login-email" className="label">
          E-mail
        </label>
        <input id="login-email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="text-[15px] text-danger-600">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={state === "sending"}>
        {state === "sending" ? "Odesílám…" : "Poslat odkaz"}
      </button>
    </form>
  );
}
