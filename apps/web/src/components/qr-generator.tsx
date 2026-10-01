"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { buildSpayd, SpaydError } from "@ez/cz/spayd";
import { formatIban, toIban } from "@ez/cz/bank";

export function QrGenerator() {
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [vs, setVs] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [svg, setSvg] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!account.trim()) return { spayd: null, error: null, iban: null };
    try {
      const amt = amount.trim() ? Number(amount.replace(/\s+/g, "").replace(",", ".")) : undefined;
      const spayd = buildSpayd({
        account,
        amount: amt,
        variableSymbol: vs || undefined,
        message: message || undefined,
        recipientName: name || undefined,
      });
      return { spayd, error: null, iban: toIban(account) };
    } catch (e) {
      return { spayd: null, error: e instanceof SpaydError ? e.message : "Neplatné údaje", iban: null };
    }
  }, [account, amount, vs, message, name]);

  useEffect(() => {
    let cancelled = false;
    if (!result.spayd) {
      setSvg(null);
      return;
    }
    QRCode.toString(result.spayd, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 280 }).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [result.spayd]);

  async function download() {
    if (!result.spayd) return;
    const url = await QRCode.toDataURL(result.spayd, { errorCorrectionLevel: "M", margin: 2, width: 800 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-platba${amount ? `-${amount}` : ""}.png`;
    a.click();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <form className="card space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="qr-acc" className="label">
            Číslo účtu nebo IBAN <span className="text-danger-600">*</span>
          </label>
          <input id="qr-acc" className="input" placeholder="např. 19-2000145399/0800" value={account} onChange={(e) => setAccount(e.target.value)} />
          {result.iban && <p className="mt-1 text-sm text-muted">IBAN: {formatIban(result.iban)}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="qr-am" className="label">
              Částka (Kč)
            </label>
            <input id="qr-am" className="input" inputMode="decimal" placeholder="např. 450" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="qr-vs" className="label">
              Variabilní symbol
            </label>
            <input id="qr-vs" className="input" inputMode="numeric" maxLength={10} value={vs} onChange={(e) => setVs(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="qr-msg" className="label">
            Zpráva pro příjemce
          </label>
          <input id="qr-msg" className="input" maxLength={60} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div>
          <label htmlFor="qr-rn" className="label">
            Jméno příjemce
          </label>
          <input id="qr-rn" className="input" maxLength={35} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {result.error && (
          <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-danger-600">
            {result.error}
          </p>
        )}
      </form>

      <div className="card flex flex-col items-center justify-center text-center">
        {svg ? (
          <>
            <div className="w-full max-w-[280px]" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR kód pro platbu" role="img" />
            <p className="mt-2 text-sm font-semibold text-ink">QR Platba</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={download} className="btn-primary">
                Stáhnout PNG
              </button>
              <button type="button" onClick={() => window.print()} className="btn-secondary">
                Tisk
              </button>
            </div>
            <details className="mt-4 w-full text-left">
              <summary className="cursor-pointer text-sm text-muted">Zobrazit řetězec SPAYD</summary>
              <code className="mt-2 block break-all rounded-lg bg-surface p-3 text-xs">{result.spayd}</code>
            </details>
          </>
        ) : (
          <p className="text-muted">Vyplňte číslo účtu a QR kód se zobrazí tady.</p>
        )}
      </div>
    </div>
  );
}
