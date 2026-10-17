"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { isValidIco, normalizeIco } from "@ez/cz/ico";
import { formatIban } from "@ez/cz/bank";
import { InvoicePaper } from "@/components/invoice-paper";
import { ExternalLink } from "@/components/external-link";
import {
  INVOICE_KINDS,
  INVOICE_PAYMENTS,
  TRADE_REGISTER_LINE,
  UNITS,
  VAT_RATES,
  type Invoice,
  type InvoiceItem,
  type InvoiceKind,
  type InvoiceParty,
  type InvoicePayment,
  type VatRate,
  dueDateOf,
  icoOk,
  invoiceSpayd,
  invoiceTotals,
  isSimplified,
  missingInvoiceFields,
  parseFakturaFragment,
  variableSymbolFrom,
} from "@/lib/faktura";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const emptyItem = (): InvoiceItem => ({ name: "", qty: "1", unit: "ks", price: "", rate: 21 });
const emptyParty = (): InvoiceParty => ({ name: "", ico: "", dic: "", address: "" });

type Role = "supplier" | "customer";
type AresState = { loading: boolean; message: string | null };

interface AresSubject {
  name: string;
  dic: string | null;
  vatPayer: boolean;
  legalForm: string | null;
  address: { text?: string | null; street?: string | null };
}

/** Generátor faktury. Vše běží v prohlížeči a nic se neukládá; ARES jen na tlačítko nebo z odkazu #odberatel=IČO. */
export function InvoiceGenerator() {
  const [kind, setKind] = useState<InvoiceKind>("faktura");
  const [vatPayer, setVatPayer] = useState(false);
  const [supplier, setSupplier] = useState<InvoiceParty & { registry: string }>({ ...emptyParty(), registry: "" });
  const [customer, setCustomer] = useState<InvoiceParty>(emptyParty);
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [taxDate, setTaxDate] = useState(today);
  const [dueDays, setDueDays] = useState("14");
  const [payment, setPayment] = useState<InvoicePayment>("prevodem");
  const [account, setAccount] = useState("");
  const [vs, setVs] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [note, setNote] = useState("");
  const [ares, setAres] = useState<Record<Role, AresState>>({ supplier: { loading: false, message: null }, customer: { loading: false, message: null } });
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  const inv: Invoice = { kind, vatPayer, number, issueDate, taxDate, dueDays, payment, account, vs, supplier, customer, items, note };
  const totals = useMemo(() => invoiceTotals(items, vatPayer), [items, vatPayer]);
  const dueDate = dueDateOf(inv);
  const vsEff = vs.trim() || variableSymbolFrom(number);
  const missing = missingInvoiceFields(inv);
  const simplified = isSimplified(inv, totals);
  const qr = useMemo(
    () =>
      payment === "prevodem" && account.trim()
        ? invoiceSpayd({ account, amount: totals.total, vs: vsEff, dueDate, number, kind, recipient: supplier.name })
        : null,
    [payment, account, totals.total, vsEff, dueDate, number, kind, supplier.name],
  );

  useEffect(() => {
    let cancelled = false;
    if (!qr?.spayd) {
      setQrSvg(null);
      return;
    }
    QRCode.toString(qr.spayd, { type: "svg", errorCorrectionLevel: "M", margin: 0, width: 160 }).then((svg) => {
      if (!cancelled) setQrSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [qr?.spayd]);

  const setAresFor = (role: Role, state: AresState) => setAres((a) => ({ ...a, [role]: state }));

  async function loadAres(role: Role, raw: string) {
    const ico = normalizeIco(raw);
    if (!ico || !isValidIco(ico)) {
      setAresFor(role, { loading: false, message: "Zadejte platné IČO (8 číslic)." });
      return;
    }
    setAresFor(role, { loading: true, message: null });
    try {
      const res = await fetch(`/api/ico/${ico}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; subject?: AresSubject };
      if (!res.ok || !body.subject) {
        setAresFor(role, { loading: false, message: body.error ?? "Údaje se nepodařilo načíst." });
        return;
      }
      const s = body.subject;
      const full = s.address.street ? (s.address.text ?? null) : null;
      const msgs = [full ? "Načteno z ARES." : "Jméno načteno z ARES. Adresu fyzické osoby z ARES nepřebíráme – doplňte sídlo sami."];
      if (role === "supplier") {
        // OSVČ podle živnostenského zákona (101) je v živnostenském rejstříku; ostatní mají zápis ve veřejném rejstříku nebo jiné evidenci
        const trade = s.legalForm === "101";
        setSupplier((x) => ({ ...x, ico, name: s.name, dic: s.dic ?? x.dic, address: full ?? x.address, registry: x.registry || (trade ? TRADE_REGISTER_LINE : "") }));
        setVatPayer(s.vatPayer);
        if (!trade) msgs.push("Doplňte údaj o zápisu ve veřejném rejstříku – u obchodní společnosti včetně oddílu a vložky (najdete ho ve výpisu na or.justice.cz).");
      } else {
        setCustomer((x) => ({ ...x, ico, name: s.name, dic: s.dic ?? x.dic, address: full ?? x.address }));
      }
      setAresFor(role, { loading: false, message: msgs.join(" ") });
    } catch {
      setAresFor(role, { loading: false, message: "Registr ARES se nepodařilo načíst. Zkontrolujte připojení." });
    }
  }

  // odkaz /faktura-zdarma#odberatel=IČO (stránky firem): IČO z fragmentu, nikdy z query (COMMON 9)
  // loadAres používá jen settery (stabilní), první verze z prvního renderu proto stačí
  const loadRef = useRef(loadAres);
  useEffect(() => {
    const apply = () => {
      const { odberatel } = parseFakturaFragment(window.location.hash);
      if (!odberatel) return;
      setCustomer((c) => ({ ...c, ico: odberatel }));
      void loadRef.current("customer", odberatel);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const setS = (k: keyof typeof supplier, v: string) => setSupplier((s) => ({ ...s, [k]: v }));
  const setC = (k: keyof InvoiceParty, v: string) => setCustomer((c) => ({ ...c, [k]: v }));
  const setItem = <K extends keyof InvoiceItem>(i: number, k: K, v: InvoiceItem[K]) => setItems((list) => list.map((it, j) => (j === i ? { ...it, [k]: v } : it)));

  const partyFields = (role: Role, p: InvoiceParty, set: (k: keyof InvoiceParty, v: string) => void) => {
    const id = role === "supplier" ? "fa-s" : "fa-c";
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor={`${id}-ico`} className="label">
              IČO {role === "supplier" && <span className="text-danger-600">*</span>}
            </label>
            <input id={`${id}-ico`} className="input" inputMode="numeric" maxLength={10} placeholder="8 číslic" value={p.ico} onChange={(e) => set("ico", e.target.value)} />
          </div>
          <button type="button" className="btn-secondary" onClick={() => loadAres(role, p.ico)} disabled={ares[role].loading}>
            {ares[role].loading ? "Načítám…" : "Doplnit z ARES"}
          </button>
        </div>
        {!icoOk(p.ico) && <p className="text-sm text-danger-600">IČO nemá platný kontrolní součet.</p>}
        {ares[role].message && <p className="text-sm text-muted">{ares[role].message}</p>}
        <div>
          <label htmlFor={`${id}-name`} className="label">
            Jméno a příjmení nebo název {role === "supplier" && <span className="text-danger-600">*</span>}
          </label>
          <input id={`${id}-name`} className="input" value={p.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-addr`} className="label">
            Sídlo {role === "supplier" && <span className="text-danger-600">*</span>}
          </label>
          <textarea id={`${id}-addr`} className="input" rows={2} placeholder="Ulice a číslo, PSČ a obec" value={p.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-dic`} className="label">
            DIČ {role === "supplier" ? vatPayer && <span className="text-danger-600">*</span> : "(má-li ho)"}
          </label>
          <input id={`${id}-dic`} className="input" placeholder="začíná CZ" value={p.dic} onChange={(e) => set("dic", e.target.value)} />
        </div>
      </>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <form className="card no-print min-w-0 space-y-6" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="space-y-4">
          <legend className="mb-1 text-lg font-bold">Doklad</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fa-kind" className="label">
                Typ dokladu
              </label>
              <select id="fa-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as InvoiceKind)}>
                {Object.entries(INVOICE_KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div role="radiogroup" aria-label="Plátce DPH" className="flex flex-col justify-end gap-2 text-base">
              <label className="flex items-center gap-2">
                <input type="radio" name="fa-vat" checked={!vatPayer} onChange={() => setVatPayer(false)} />
                Nejsem plátce DPH
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="fa-vat" checked={vatPayer} onChange={() => setVatPayer(true)} />
                Jsem plátce DPH
              </label>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            <div>
              <label htmlFor="fa-num" className="label">
                Číslo faktury <span className="text-danger-600">*</span>
              </label>
              <input id="fa-num" className="input" placeholder="např. 2026015" maxLength={30} value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div>
              <label htmlFor="fa-issue" className="label">
                Datum vystavení <span className="text-danger-600">*</span>
              </label>
              <input id="fa-issue" type="date" className="input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            {vatPayer && kind === "faktura" && (
              <div>
                <label htmlFor="fa-duzp" className="label">
                  DUZP <span className="text-danger-600">*</span>
                </label>
                <input id="fa-duzp" type="date" className="input" value={taxDate} onChange={(e) => setTaxDate(e.target.value)} />
              </div>
            )}
          </div>
          {kind === "zalohova" && (
            <p className="text-sm text-muted">
              Zálohová faktura je výzvou k zaplacení předem. Není daňovým dokladem, proto nemá datum uskutečnění plnění.
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-lg font-bold">Dodavatel (vy)</legend>
          {partyFields("supplier", supplier, (k, v) => setS(k, v))}
          <div>
            <label htmlFor="fa-s-reg" className="label">
              Zápis v rejstříku nebo evidenci <span className="text-danger-600">*</span>
            </label>
            <input
              id="fa-s-reg"
              className="input"
              placeholder="např. Zapsáno v obchodním rejstříku vedeném Krajským soudem v Plzni, oddíl C, vložka 12345"
              maxLength={200}
              value={supplier.registry}
              onChange={(e) => setS("registry", e.target.value)}
            />
            <p className="mt-1 text-sm text-muted">
              Vyžaduje ho § 435 občanského zákoníku. Firma uvede soud, oddíl a vložku z obchodního rejstříku (
              <ExternalLink href="https://or.justice.cz" className="underline underline-offset-2">
                or.justice.cz
              </ExternalLink>
              ).
            </p>
            <button type="button" className="mt-1 text-sm font-medium text-brand-700 underline underline-offset-2" onClick={() => setS("registry", TRADE_REGISTER_LINE)}>
              Vyplnit pro OSVČ v živnostenském rejstříku
            </button>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-lg font-bold">Odběratel</legend>
          {partyFields("customer", customer, setC)}
          {vatPayer && kind === "faktura" && (
            <p className="text-sm text-muted">
              Do 10 000 Kč celkem můžete odběratele vynechat – vznikne zjednodušený daňový doklad (§ 30 a § 30a zákona o DPH).
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-lg font-bold">Platba</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fa-due" className="label">
                Splatnost (dní)
              </label>
              <input id="fa-due" className="input" inputMode="numeric" maxLength={3} value={dueDays} onChange={(e) => setDueDays(e.target.value)} />
            </div>
            <div>
              <label htmlFor="fa-pay" className="label">
                Způsob úhrady
              </label>
              <select id="fa-pay" className="input" value={payment} onChange={(e) => setPayment(e.target.value as InvoicePayment)}>
                {Object.entries(INVOICE_PAYMENTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {payment === "prevodem" && (
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div>
                <label htmlFor="fa-acc" className="label">
                  Číslo účtu nebo IBAN <span className="text-danger-600">*</span>
                </label>
                <input id="fa-acc" className="input" placeholder="např. 19-2000145399/0800" value={account} onChange={(e) => setAccount(e.target.value)} />
                {qr?.iban && <p className="mt-1 text-sm text-muted">IBAN: {formatIban(qr.iban)}</p>}
                {qr?.error && <p className="mt-1 text-sm text-danger-600">{qr.error}</p>}
              </div>
              <div>
                <label htmlFor="fa-vs" className="label">
                  Variabilní symbol
                </label>
                <input
                  id="fa-vs"
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder={variableSymbolFrom(number) || "z čísla faktury"}
                  value={vs}
                  onChange={(e) => setVs(e.target.value)}
                />
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-lg font-bold">Položky</legend>
          <datalist id="fa-units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          {items.map((it, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-line p-3">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`fa-in-${i}`} className="label">
                    Položka {i + 1}: co dodáváte
                  </label>
                  <button
                    type="button"
                    className="text-sm font-medium text-brand-700 underline underline-offset-2"
                    aria-label={`Odebrat položku ${i + 1}`}
                    onClick={() => setItems((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [emptyItem()]))}
                  >
                    Odebrat
                  </button>
                </div>
                <input id={`fa-in-${i}`} className="input" placeholder="např. Oprava vodovodní baterie" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} />
              </div>
              <div className={`grid grid-cols-2 items-end gap-2 ${vatPayer ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]"}`}>
                <div>
                  <label htmlFor={`fa-iq-${i}`} className="label">
                    Množství
                  </label>
                  <input id={`fa-iq-${i}`} className="input px-3" inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
                </div>
                <div>
                  <label htmlFor={`fa-iu-${i}`} className="label">
                    Jednotka
                  </label>
                  <input id={`fa-iu-${i}`} className="input px-3" list="fa-units" maxLength={10} value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} />
                </div>
                <div className={vatPayer ? "" : "col-span-2 sm:col-span-1"}>
                  <label htmlFor={`fa-ip-${i}`} className="label">
                    {vatPayer ? "Cena za MJ bez DPH" : "Cena za MJ (Kč)"}
                  </label>
                  <input id={`fa-ip-${i}`} className="input px-3" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, "price", e.target.value)} />
                </div>
                {vatPayer && (
                  <div>
                    <label htmlFor={`fa-ir-${i}`} className="label">
                      DPH
                    </label>
                    <select id={`fa-ir-${i}`} className="input px-2" value={it.rate} onChange={(e) => setItem(i, "rate", Number(e.target.value) as VatRate)}>
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r} %
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
          {items.length < 40 && (
            <button type="button" className="btn-secondary" onClick={() => setItems((list) => [...list, emptyItem()])}>
              + Přidat položku
            </button>
          )}
          {vatPayer && (
            <p className="text-sm text-muted">
              Ceny zadávejte bez DPH. Daň se počítá ze základu za každou sazbu a zaokrouhluje na haléře. Slevu zadáte jako položku se zápornou cenou.
            </p>
          )}
        </fieldset>

        <div>
          <label htmlFor="fa-note" className="label">
            Poznámka
          </label>
          <textarea
            id="fa-note"
            className="input"
            rows={2}
            maxLength={500}
            placeholder="např. Fakturujeme vám za práce podle objednávky č. 15."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </form>

      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <InvoicePaper inv={inv} totals={totals} dueDate={dueDate} vs={vsEff} iban={qr?.iban ?? null} qrSvg={qrSvg} />
        {missing.length > 0 ? (
          <ul className="no-print mx-auto max-w-[210mm] list-disc space-y-1 rounded-xl bg-warn-50 px-8 py-3 text-sm text-ink">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <div className="no-print mx-auto flex max-w-[210mm] flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              Tisk nebo uložit jako PDF
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setItems([emptyItem()]);
                setNumber("");
                setVs("");
                setNote("");
              }}
            >
              Další faktura
            </button>
          </div>
        )}
        {simplified && <p className="no-print mx-auto max-w-[210mm] text-sm text-muted">Bez odběratele a do 10 000 Kč jde o zjednodušený daňový doklad.</p>}
        <p className="no-print mx-auto max-w-[210mm] text-sm text-muted">
          PDF uložíte v okně tisku volbou „Uložit jako PDF“. Údaje zůstávají jen v této stránce – po zavření se neuloží. Přenesenou daňovou povinnost,
          osvobozená plnění ani faktury do zahraničí generátor neřeší.
        </p>
      </div>
    </div>
  );
}
