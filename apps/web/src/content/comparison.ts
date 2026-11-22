import { SOURCES } from "./facts";

/** Datum, ke kterému údaje o MOJE eet ověřujeme (zobrazí se v tabulce a na /srovnani/moje-eet). */
export const COMPARISON_AS_OF = "22. 11. 2026";

/**
 * Srovnání s MOJE eet — údaje o státní aplikaci podle Finanční správy (dotazy veřejnosti z 18. 11. 2026, eet.gov.cz)
 * a odborného tisku (viz zdroje). Co FS nezveřejnila, píšeme jako „nezveřejněno“, nikdy „Ne“ (R2.3).
 * S12 (22. 11. 2026): účty, katalog, DPH, export a online provoz podle dotazů č. 5756 a 5734 a Praktických informací.
 */
export const COMPARISON_ROWS: readonly { feature: string; state: string; ours: string; oursHighlight?: boolean }[] = [
  { feature: "Kdy", state: "Spuštění se předpokládá od 1. 12. 2026", ours: "Spuštěno 2. 11. 2026, vyzkoušet lze v testovacím režimu" },
  { feature: "Cena", state: "Zdarma", ours: "Zdarma navždy; placené doplňky volitelně" },
  { feature: "Evidenční jednotky", state: "Nejvýš 2", ours: "Až 3 zdarma; bez limitu v tarifu Firma (spustíme později)", oursHighlight: true },
  { feature: "Uživatelé", state: "Až 4 zaměstnanecké účty", ours: "Až 5 zdarma, každý s vlastním PINem", oursHighlight: true },
  { feature: "Katalog zboží a služeb", state: "Nejvýš 42 položek", ours: "Katalog s rychlými tlačítky a importem z tabulky", oursHighlight: true },
  {
    feature: "DPH",
    state: "Rozpis sazeb a částek DPH neumožňuje – podle FS nevhodná např. pro plátce DPH",
    ours: "Sazba DPH u každé položky; rozpad DPH v exportu pro účetní",
    oursHighlight: true,
  },
  {
    feature: "Práce bez signálu + dodatečné odeslání do 48 h",
    state: "Běží na zařízení připojeném k internetu, zprávu umí odeslat znovu; samostatný režim bez připojení nezveřejněn",
    ours: "Ano – prodej bez signálu, pokladna sama odešle a hlídá lhůtu",
    oursHighlight: true,
  },
  { feature: "Doklad pro zákazníka", state: "PDF doklad – vytisknout, poslat e-mailem nebo sdílet; aplikace ho zákazníkovi sama nepošle", ours: "E-mail, odkaz a QR kód z pokladny, tisk na Bluetooth tiskárně; PDF připravujeme" },
  { feature: "Tiskárna účtenek, čtečka kódů", state: "Nezveřejněno", ours: "Bluetooth tiskárna ano; USB a čtečka kódů – připravujeme", oursHighlight: true },
  { feature: "Platební terminál", state: "Nezveřejněno", ours: "Připravujeme (placený doplněk Tap to Pay / SoftPOS)" },
  {
    feature: "Export pro účetní",
    state: "Export vystavených dokladů v PDF; soubor tržeb v CSV nabízí až DIS+",
    ours: "CSV zdarma; Pohoda XML (beta); Money a ABRA připravujeme (Premium)",
    oursHighlight: true,
  },
  { feature: "Napojení e-shopu, rezervací, hotelového systému (API)", state: "Nezveřejněno", ours: "EET API (placené, od 990 Kč měsíčně)", oursHighlight: true },
  {
    feature: "Účetní kabinet",
    state: "Nezveřejněno",
    ours: "Ano – připravenost klientů, exporty a CSV pro hromadný import jednotek do DIS+",
    oursHighlight: true,
  },
  { feature: "Přihlášení", state: "Dvoufázové ověření při každém přihlášení", ours: "Klíč uložený v zařízení + PIN pro každou pokladní" },
];

export const COMPARISON_SOURCES = [SOURCES.fsDotazMojeEet, SOURCES.fsDotazMojeEetExport, SOURCES.prakticke, SOURCES.mojeEet, SOURCES.mojeEet2fa, SOURCES.harmonogram];
