/** O co může adresa v předregistraci požádat (R7.4) – pokladna, webináře, Účetní kabinet. */
export const INTERESTS = ["pokladna", "webinar", "kabinet"] as const;
export type Interest = (typeof INTERESTS)[number];

export const isInterest = (v: unknown): v is Interest => typeof v === "string" && (INTERESTS as readonly string[]).includes(v);

/** Co adresa žádá – do e-mailu s potvrzením a na stránku stavu. */
export const INTEREST_LABEL: Record<Interest, string> = {
  pokladna: "předregistrace k pokladně EvidujZdarma",
  webinar: "přihláška na webinář EET 2.0 pro účetní",
  kabinet: "zájem o Účetní kabinet",
};

/** Co adresa žádá, jako „žádost o …“ (4. pád) – e-mail s potvrzením a /registrace/zajem (R8.3). */
export const INTEREST_REQUEST: Record<Interest, string> = {
  pokladna: "o předregistraci k pokladně EvidujZdarma",
  webinar: "o přihlášení na webinář EET 2.0 pro účetní",
  kabinet: "o zprávu o spuštění Účetního kabinetu",
};

/** Předregistrace k pokladně (pořadí, odkaz pro pozvání kolegů) – i záznam bez zájmů ze starší verze formuláře (R7.4, R9.9). */
export const isForPos = (interests: readonly Interest[]): boolean => interests.length === 0 || interests.includes("pokladna");

/** Co pošleme po potvrzení. */
export const INTEREST_NEXT: Record<Interest, string> = {
  pokladna: "Až pokladnu spustíme, pošleme vám odkaz.",
  webinar: "Termín a odkaz na webinář vám pošleme, jakmile ho vypíšeme.",
  kabinet: "O spuštění Účetního kabinetu vám dáme vědět.",
};
