/**
 * Co pokladna řekne, když ji server odmítne (401). Zrušený účet po 30 dnech: text serveru – znovu zaregistrovat
 * zařízení k zrušenému účtu nejde (R7.15 N9). Jinak vlastník zařízení odpojil a lze ho zaregistrovat znovu.
 */
export function revokedNotice(serverMessage: string | null | undefined): { text: string; canRegister: boolean } {
  if (serverMessage?.startsWith("Účet je zrušený")) {
    return { text: `${serverMessage} Tržby zůstanou uložené v zařízení. Do zrušeného účtu je už předat nejde.`, canRegister: false };
  }
  return { text: "Vlastník účtu zařízení odpojil v nastavení. Přihlaste se a zaregistrujte ho znovu.", canRegister: true };
}
