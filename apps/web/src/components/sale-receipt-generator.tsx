"use client";

import { useMemo, useState } from "react";
import { isValidIco, normalizeIco } from "@ez/cz/ico";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type SaleItem,
  filledItems,
  formatCzDate,
  formatCzk,
  lineTotal,
  missingSaleFields,
  saleTotal,
} from "@/lib/doc-tools";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const emptyItem = (): SaleItem => ({ name: "", qty: "1", price: "" });

interface Seller {
  name: string;
  ico: string;
  dic: string;
  address: string;
}

/** Generátor dokladu o prodeji (§ 16 zákona o ochraně spotřebitele). Vše běží v prohlížeči; ARES jen na tlačítko. */
export function SaleReceiptGenerator() {
  const [seller, setSeller] = useState<Seller>({ name: "", ico: "", dic: "", address: "" });
  const [vatPayer, setVatPayer] = useState(false);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today);
  const [payment, setPayment] = useState<PaymentMethod>("hotove");
  const [items, setItems] = useState<SaleItem[]>([emptyItem()]);
  const [note, setNote] = useState("");
  const [ares, setAres] = useState<{ loading: boolean; message: string | null }>({ loading: false, message: null });

  const setS = (k: keyof Seller, v: string) => setSeller((s) => ({ ...s, [k]: v }));
  const setItem = (i: number, k: keyof SaleItem, v: string) => setItems((list) => list.map((it, j) => (j === i ? { ...it, [k]: v } : it)));

  const icoNorm = normalizeIco(seller.ico);
  const icoOk = !seller.ico.trim() || (!!icoNorm && isValidIco(icoNorm));
  const total = useMemo(() => saleTotal(items), [items]);
  const missing = missingSaleFields({ sellerName: seller.name, ico: seller.ico, date, items });
  const rows = filledItems(items);

  async function fromAres() {
    if (!icoNorm || !isValidIco(icoNorm)) {
      setAres({ loading: false, message: "Zadejte platné IČO (8 číslic)." });
      return;
    }
    setAres({ loading: true, message: null });
    try {
      const res = await fetch(`/api/ico/${icoNorm}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        subject?: { name: string; dic: string | null; vatPayer: boolean; address: { text?: string | null; street?: string | null; city?: string | null } };
      };
      if (!res.ok || !body.subject) {
        setAres({ loading: false, message: body.error ?? "Údaje se nepodařilo načíst." });
        return;
      }
      const s = body.subject;
      const full = s.address.street ? s.address.text : null;
      setSeller((x) => ({ ...x, ico: icoNorm, name: s.name, dic: s.dic ?? x.dic, address: full ?? x.address }));
      setVatPayer(s.vatPayer);
      setAres({
        loading: false,
        message: full ? "Načteno z ARES." : "Jméno načteno z ARES. Adresu fyzické osoby ARES veřejně neukazuje – doplňte ji sami.",
      });
    } catch {
      setAres({ loading: false, message: "Registr ARES se nepodařilo načíst. Zkontrolujte připojení." });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <form className="card space-y-5 no-print" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="space-y-4">
          <legend className="mb-1 text-lg font-bold">Prodávající</legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label htmlFor="dk-ico" className="label">
                IČO <span className="text-danger-600">*</span>
              </label>
              <input id="dk-ico" className="input" inputMode="numeric" maxLength={10} placeholder="např. 12345678" value={seller.ico} onChange={(e) => setS("ico", e.target.value)} />
            </div>
            <button type="button" className="btn-secondary" onClick={fromAres} disabled={ares.loading}>
              {ares.loading ? "Načítám…" : "Doplnit z ARES"}
            </button>
          </div>
          {!icoOk && <p className="text-sm text-danger-600">IČO nemá platný kontrolní součet.</p>}
          {ares.message && <p className="text-sm text-muted">{ares.message}</p>}
          <div>
            <label htmlFor="dk-name" className="label">
              Jméno a příjmení nebo název <span className="text-danger-600">*</span>
            </label>
            <input id="dk-name" className="input" value={seller.name} onChange={(e) => setS("name", e.target.value)} />
          </div>
          <div>
            <label htmlFor="dk-addr" className="label">
              Sídlo nebo místo podnikání
            </label>
            <input id="dk-addr" className="input" value={seller.address} onChange={(e) => setS("address", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dk-dic" className="label">
                DIČ (nepovinné)
              </label>
              <input id="dk-dic" className="input" value={seller.dic} onChange={(e) => setS("dic", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-base sm:pt-7">
              <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
              Jsem plátce DPH
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-lg font-bold">Prodej</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="dk-date" className="label">
                Datum prodeje <span className="text-danger-600">*</span>
              </label>
              <input id="dk-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="dk-num" className="label">
                Číslo dokladu
              </label>
              <input id="dk-num" className="input" placeholder="např. 2026-015" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div>
              <label htmlFor="dk-pay" className="label">
                Zaplaceno
              </label>
              <select id="dk-pay" className="input" value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[4.5rem_1fr_auto] items-end gap-2 sm:grid-cols-[1fr_4.5rem_6.5rem_auto]">
                <div className="col-span-3 sm:col-span-1">
                  <label htmlFor={`dk-in-${i}`} className={i === 0 ? "label" : "sr-only"}>
                    Zboží nebo služba
                  </label>
                  <input id={`dk-in-${i}`} className="input" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} />
                </div>
                <div>
                  <label htmlFor={`dk-iq-${i}`} className={i === 0 ? "label" : "sr-only"}>
                    Množství
                  </label>
                  <input id={`dk-iq-${i}`} className="input" inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
                </div>
                <div>
                  <label htmlFor={`dk-ip-${i}`} className={i === 0 ? "label" : "sr-only"}>
                    Cena za kus (Kč)
                  </label>
                  <input id={`dk-ip-${i}`} className="input" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, "price", e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn-secondary px-3"
                  aria-label={`Odebrat položku ${i + 1}`}
                  onClick={() => setItems((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [emptyItem()]))}
                >
                  ×
                </button>
              </div>
            ))}
            {items.length < 30 && (
              <button type="button" className="btn-secondary" onClick={() => setItems((list) => [...list, emptyItem()])}>
                + Přidat položku
              </button>
            )}
          </div>

          <div>
            <label htmlFor="dk-note" className="label">
              Poznámka
            </label>
            <input
              id="dk-note"
              className="input"
              placeholder="např. použité zboží, zboží s vadou, termín dodání"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="mt-1 text-sm text-muted">Použité zboží, zboží s vadou nebo s omezenou funkcí musí být na dokladu výslovně označené (§ 16 odst. 3).</p>
          </div>
        </fieldset>
      </form>

      <div className="space-y-4">
        <div className="doc-paper doc-narrow card mx-auto w-full max-w-md bg-white font-mono text-sm leading-relaxed text-ink">
          <p className="text-center text-base font-bold">DOKLAD O PRODEJI{number.trim() ? ` č. ${number.trim()}` : ""}</p>
          <div className="mt-3 border-b border-dashed border-line pb-3">
            <p className="font-bold">{seller.name.trim() || "Jméno nebo název prodávajícího"}</p>
            {seller.address.trim() && <p>{seller.address.trim()}</p>}
            <p>IČO: {seller.ico.trim() || "—"}</p>
            {seller.dic.trim() && <p>DIČ: {seller.dic.trim()}</p>}
          </div>
          <table className="mt-3 w-full">
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="py-1 text-muted">Položky se zobrazí tady.</td>
                </tr>
              )}
              {rows.map((it, i) => {
                const t = lineTotal(it);
                const qty = it.qty.trim() || "1";
                return (
                  <tr key={i} className="align-top">
                    <td className="py-1 pr-2">
                      {it.name.trim() || "—"}
                      {qty !== "1" && t !== null && (
                        <span className="block text-xs text-muted">
                          {qty} × {it.price.trim()} Kč
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-1 text-right">{t === null ? "?" : formatCzk(t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2 flex justify-between border-t border-dashed border-line pt-2 text-base font-bold">
            <span>Celkem</span>
            <span>{formatCzk(total)}</span>
          </div>
          <p className="mt-2">Zaplaceno {PAYMENT_METHODS[payment]}</p>
          <p>Datum prodeje: {date ? formatCzDate(date) : "—"}</p>
          {note.trim() && <p className="mt-2">Poznámka: {note.trim()}</p>}
        </div>

        {missing.length > 0 ? (
          <ul className="no-print mx-auto max-w-md list-disc space-y-1 rounded-xl bg-warn-50 px-8 py-3 text-sm text-ink">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <div className="no-print mx-auto flex max-w-md flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              Tisk nebo uložit jako PDF
            </button>
            <button type="button" className="btn-secondary" onClick={() => setItems([emptyItem()])}>
              Nový doklad
            </button>
          </div>
        )}
        {vatPayer && (
          <p className="no-print mx-auto max-w-md text-sm text-muted">
            Jste plátce DPH: tento doklad splňuje § 16 zákona o ochraně spotřebitele, ale není daňovým dokladem podle zákona o DPH.
          </p>
        )}
        <p className="no-print mx-auto max-w-md text-sm text-muted">
          PDF uložíte v okně tisku volbou „Uložit jako PDF“ a zákazníkovi ho můžete poslat e-mailem. Údaje zůstávají ve vašem prohlížeči.
        </p>
      </div>
    </div>
  );
}
