/**
 * Ilustrace pokladny v hero sekci — čisté HTML/CSS (žádný obrázek ke stažení, ostré na všech displejích).
 * Ukazuje průběh: položky → platba → zaevidování, i offline. Viditelný štítek „Ukázka“ – nejde o snímek běžící pokladny (R14.4).
 */
export function PosPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm select-none">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-brand-100/60 blur-2xl" />
      <div className="relative rounded-[2rem] border border-line bg-white p-4 shadow-xl">
        <p className="mb-3 inline-block rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Ukázka</p>
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-semibold text-ink">Kadeřnictví Šárka</span>
          <span className="flex items-center gap-1.5 rounded-full bg-sun-100 px-2 py-0.5 font-medium text-warn-700">
            <span className="h-1.5 w-1.5 rounded-full bg-muted" /> Offline · 1 čeká
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Střih", "450"],
            ["Barvení", "850"],
            ["Foukaná", "250"],
          ].map(([n, p]) => (
            <div key={n} className="rounded-xl border border-line p-2">
              <p className="text-xs font-semibold text-ink">{n}</p>
              <p className="text-[11px] text-muted">{p} Kč</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5 rounded-2xl bg-surface p-3 text-sm">
          <div className="flex justify-between">
            <span>Střih dámský</span>
            <span className="tabular-nums">450 Kč</span>
          </div>
          <div className="flex justify-between">
            <span>Barvení</span>
            <span className="tabular-nums">850 Kč</span>
          </div>
          <div className="flex justify-between border-t border-line pt-1.5 font-bold">
            <span>Celkem</span>
            <span className="tabular-nums">1 300 Kč</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[11px] font-semibold">
          <span className="rounded-lg bg-brand-600 py-1.5 text-white">Hotově</span>
          <span className="rounded-lg border border-line py-1.5">Karta</span>
          <span className="rounded-lg border border-line py-1.5">QR</span>
          <span className="rounded-lg border border-line py-1.5">Poukaz</span>
        </div>
        <div className="mt-3 rounded-xl bg-brand-600 py-3 text-center font-semibold text-white">Zaplaceno – 1 300 Kč</div>
      </div>
      <div className="relative -mt-6 ml-auto mr-[-1rem] w-56 rounded-2xl border border-brand-200 bg-white p-3 shadow-lg">
        <p className="text-xs font-semibold text-brand-700">✓ Tržba zaevidována</p>
        <p className="mt-1 font-mono text-[10px] text-muted">POK 91616ac4-83ae-4cca…</p>
        <p className="mt-1 text-[11px] text-ink-soft">Odesláno automaticky po návratu signálu</p>
      </div>
    </div>
  );
}
