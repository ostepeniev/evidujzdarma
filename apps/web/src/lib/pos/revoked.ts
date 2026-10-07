/**
 * Co pokladna řekne, když ji server odmítne (401). Zrušený účet po 30 dnech: text serveru – znovu zaregistrovat
 * zařízení k zrušenému účtu nejde (R7.15 N9). Jinak vlastník zařízení odpojil a lze ho zaregistrovat znovu.
 */
export function revokedNotice(serverMessage: string | null | undefined): { text: string; canRegister: boolean } {
  if (serverMessage?.startsWith("Účet je zrušený")) {
    return { text: `${serverMessage} Tržby, které v zařízení zůstaly, už do účtu předat nejde.`, canRegister: false };
  }
  return { text: "Vlastník účtu zařízení odpojil v nastavení. Přihlaste se a zaregistrujte ho znovu.", canRegister: true };
}

/**
 * Potvrzení „Odebrat registraci z tohoto zařízení“, když v něm zůstaly neodeslané tržby (R8.3 N17, R9.11): číslo
 * 1 / 2–4 / 5+ a shoda. Odpojené zařízení je odešle po nové registraci; ze zrušeného účtu je už předat nejde.
 */
export function removeRegistrationPrompt(n: number, canRegister: boolean): string {
  const count = n === 1 ? "V zařízení je 1 neodeslaná tržba." : n >= 2 && n <= 4 ? `V zařízení jsou ${n} neodeslané tržby.` : `V zařízení je ${n} neodeslaných tržeb.`;
  const after = canRegister
    ? n === 1
      ? "Zůstane uložená, ale Finanční správě se odešle až po nové registraci pokladny."
      : "Zůstanou uložené, ale Finanční správě se odešlou až po nové registraci pokladny."
    : n === 1
      ? "Zůstane v něm uložená, ale do zrušeného účtu ji už předat nejde."
      : "Zůstanou v něm uložené, ale do zrušeného účtu je už předat nejde.";
  return `${count} ${after} Pokračovat?`;
}
