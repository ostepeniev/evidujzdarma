"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function isValidIco(v: string): boolean {
  const d = v.replace(/\s+/g, "");
  if (!/^\d{1,8}$/.test(d)) return false;
  const ico = d.padStart(8, "0");
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(ico[i]) * (8 - i);
  const r = sum % 11;
  const check = r === 0 ? 1 : r === 1 ? 0 : 11 - r;
  return check === Number(ico[7]);
}

export function IcoQuickCheck({ size = "lg", initial = "" }: { size?: "lg" | "md"; initial?: string }) {
  const router = useRouter();
  const [ico, setIco] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action="/kontrola-ico"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const v = ico.replace(/\s+/g, "");
        if (!isValidIco(v)) {
          setError("Zadejte platné IČO (8 číslic).");
          return;
        }
        router.push(`/kontrola-ico?ico=${v.padStart(8, "0")}`);
      }}
      className="w-full"
    >
      <label htmlFor="hero-ico" className="sr-only">
        IČO
      </label>
      <div className={`flex flex-col gap-2 sm:flex-row ${size === "lg" ? "sm:gap-3" : ""}`}>
        <input
          id="hero-ico"
          name="ico"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Vaše IČO, např. 12345679"
          value={ico}
          onChange={(e) => {
            setIco(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "hero-ico-err" : undefined}
          className={`input ${size === "lg" ? "py-4 text-lg" : ""} sm:flex-1`}
        />
        <button type="submit" className={`btn-primary ${size === "lg" ? "py-4 text-lg" : ""}`}>
          Zkontrolovat, zda se mě EET týká
        </button>
      </div>
      {error && (
        <p id="hero-ico-err" role="alert" className="mt-2 text-sm text-danger-600">
          {error}
        </p>
      )}
    </form>
  );
}
