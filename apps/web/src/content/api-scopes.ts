/** Oprávnění tokenu EET API a jejich české popisky (S8, rozd. 7) – sdílí obrazovka Integrace i souhlas /pripojit. */
export const SCOPES: { id: string; label: string; hint?: string }[] = [
  { id: "sales:write", label: "Odesílat tržby" },
  { id: "sales:read", label: "Číst stav tržeb" },
  { id: "refunds:write", label: "Vracet tržby (bez PINu vlastníka)", hint: "Systém bude moct vracet peníze za tržby, které sám poslal, bez vašeho PINu." },
  { id: "units:read", label: "Číst jednotky" },
  { id: "closings:read", label: "Číst denní přehledy" },
  { id: "webhooks:manage", label: "Spravovat webhooky" },
];

export const ENV_LABEL = { test: "Testovací (Playground)", live: "Ostré (produkce)" } as const;
