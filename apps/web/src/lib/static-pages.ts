/** Statické stránky pro sitemap a llms.txt. */
export const STATIC_PAGES: readonly { path: string; title: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", title: "EvidujZdarma – evidence tržeb EET 2.0 zdarma", priority: 1, changeFrequency: "daily" },
  { path: "/kontrola-ico", title: "EET kontrola podle IČO", priority: 0.9, changeFrequency: "weekly" },
  { path: "/musim-evidovat", title: "Kvíz: Musím evidovat tržby?", priority: 0.8, changeFrequency: "weekly" },
  { path: "/kalkulacka-eet-off", title: "Kalkulačka EET OFF", priority: 0.9, changeFrequency: "weekly" },
  { path: "/evidencni-jednotky", title: "Průvodce evidenčními jednotkami", priority: 0.8, changeFrequency: "weekly" },
  { path: "/qr-platba", title: "Generátor QR platby", priority: 0.7, changeFrequency: "monthly" },
  { path: "/nastroje", title: "Nástroje k EET 2.0", priority: 0.6, changeFrequency: "monthly" },
  { path: "/navody", title: "Návody k EET 2.0", priority: 0.8, changeFrequency: "weekly" },
  { path: "/srovnani/moje-eet", title: "Srovnání EvidujZdarma a MOJE eet", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ucetni", title: "EvidujZdarma pro účetní", priority: 0.7, changeFrequency: "monthly" },
  { path: "/ucetni/hromadna-kontrola", title: "Hromadná kontrola IČO pro účetní", priority: 0.7, changeFrequency: "monthly" },
  { path: "/cenik", title: "Ceník", priority: 0.6, changeFrequency: "monthly" },
  { path: "/o-nas", title: "O nás a kontakt", priority: 0.4, changeFrequency: "monthly" },
  { path: "/podminky", title: "Obchodní podmínky", priority: 0.2, changeFrequency: "monthly" },
  { path: "/ochrana-osobnich-udaju", title: "Ochrana osobních údajů", priority: 0.2, changeFrequency: "monthly" },
];
