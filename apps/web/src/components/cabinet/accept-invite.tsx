"use client";

import Link from "next/link";
import { useState } from "react";
import { call } from "@/components/setup/api";

export function AcceptInvite({ token }: { token: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (done)
    return (
      <div className="mt-6 rounded-2xl bg-brand-50 p-4" role="status">
        <p className="font-semibold">Propojeno s {done}.</p>
        <Link href="/pokladna/nastaveni" className="mt-2 inline-block font-medium text-brand-700 underline">
          Pokračovat do nastavení pokladny
        </Link>
      </div>
    );
  return (
    <>
      <button
        type="button"
        className="btn-primary mt-6 w-full"
        onClick={async () => {
          setError(null);
          try {
            const r = await call<{ accountantName: string }>(`/api/pozvanka/${token}`, { method: "POST" });
            setDone(r.accountantName);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Nepodařilo se");
          }
        }}
      >
        Propojit s účetní
      </button>
      {error && <p className="mt-3 text-danger-600">{error}</p>}
    </>
  );
}
