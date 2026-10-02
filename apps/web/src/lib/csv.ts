/**
 * Buňka CSV pro český Excel (středník). Text začínající = + - @ (nebo tabulátorem / CR) by Excel spustil
 * jako vzorec – dostane apostrof (B Дрібне 4). Čísla a číselné řetězce („-350,00“) zůstávají čísly.
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(?:[.,]\d+)?$/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
