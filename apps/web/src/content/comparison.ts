import { SOURCES } from "./facts";

/** Srovnání s MOJE eet — údaje o státní aplikaci podle zveřejněných informací (viz zdroje). */
export const COMPARISON_ROWS: readonly { feature: string; state: string; ours: string; oursHighlight?: boolean }[] = [
  { feature: "Evidence tržeb, elektronický doklad", state: "Ano (PDF doklad)", ours: "Ano (e-mail, odkaz, QR); PDF připravujeme" },
  { feature: "Uživatelé", state: "Vlastník + 2 zaměstnanci", ours: "Až 5 zdarma", oursHighlight: true },
  { feature: "Evidenční jednotky", state: "Až 2", ours: "Až 3 zdarma, více v Premium", oursHighlight: true },
  { feature: "Práce bez signálu + dodatečné odeslání do 48 h", state: "Nezveřejněno – podle dostupných informací vyžaduje připojení", ours: "Ano", oursHighlight: true },
  { feature: "Katalog zboží a služeb", state: "Ano", ours: "Ano + rychlá tlačítka" },
  { feature: "Platební terminál", state: "Nezveřejněno", ours: "Připravujeme (placený doplněk Tap to Pay / SoftPOS)" },
  { feature: "Tiskárna účtenek, čtečka kódů", state: "Nezveřejněno", ours: "Bluetooth tiskárna ano; USB a čtečka kódů – připravujeme", oursHighlight: true },
  { feature: "Účtenka e-mailem / SMS / QR", state: "Nezveřejněno (PDF doklad ano)", ours: "E-mail a QR ano, SMS připravujeme", oursHighlight: true },
  { feature: "Přehledy a export pro účetní", state: "Nezveřejněno", ours: "CSV zdarma; Pohoda / Money připravujeme (Premium)", oursHighlight: true },
  { feature: "Přihlášení", state: "Dvoufázové ověření při každém přihlášení", ours: "Klíč v zařízení + PIN pokladní" },
];

export const COMPARISON_SOURCES = [SOURCES.mojeEet, SOURCES.mojeEet2fa, SOURCES.harmonogram];
