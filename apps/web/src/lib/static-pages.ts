/**
 * Statické stránky pro sitemap a llms.txt. `modified` = datum poslední změny obsahu stránky (lastmod v sitemap, R14.7) –
 * při změně textu stránky ho posuňte. Ne datum sestavení; změny jen v metadatech nebo v atributech odkazů se nepočítají.
 * Některé stránky mají datum odvozené z obsahu (sitemap.ts): /navody, /co-se-o-eet-pise-spatne a právní dokumenty.
 */
export const STATIC_PAGES: readonly { path: string; title: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly"; modified?: string }[] = [
  { path: "/", title: "EvidujZdarma – evidence tržeb EET 2.0 zdarma", priority: 1, changeFrequency: "daily", modified: "2026-10-09" },
  { path: "/kontrola-ico", title: "EET kontrola podle IČO", priority: 0.9, changeFrequency: "weekly", modified: "2026-10-09" },
  { path: "/musim-evidovat", title: "Kvíz: Musím evidovat tržby?", priority: 0.8, changeFrequency: "weekly", modified: "2026-10-02" },
  { path: "/kalkulacka-eet-off", title: "Kalkulačka EET OFF", priority: 0.9, changeFrequency: "weekly", modified: "2026-10-07" },
  { path: "/evidencni-jednotky", title: "Průvodce evidenčními jednotkami", priority: 0.8, changeFrequency: "weekly", modified: "2026-10-02" },
  { path: "/qr-platba", title: "Generátor QR platby", priority: 0.7, changeFrequency: "monthly", modified: "2026-10-02" },
  { path: "/stav-eet", title: "Je EET dole? Stav systému evidence tržeb", priority: 0.7, changeFrequency: "daily", modified: "2026-10-01" },
  { path: "/nastroje", title: "Nástroje k EET 2.0", priority: 0.6, changeFrequency: "monthly", modified: "2026-10-02" },
  { path: "/mcp", title: "EET 2.0 pro AI asistenty (MCP server)", priority: 0.6, changeFrequency: "monthly", modified: "2026-10-02" },
  { path: "/navody", title: "Návody k EET 2.0", priority: 0.8, changeFrequency: "weekly" },
  { path: "/co-se-o-eet-pise-spatne", title: "Co se o EET 2.0 píše špatně", priority: 0.8, changeFrequency: "weekly" },
  { path: "/srovnani/moje-eet", title: "Srovnání EvidujZdarma a MOJE eet", priority: 0.8, changeFrequency: "weekly", modified: "2026-10-07" },
  { path: "/ucetni", title: "EvidujZdarma pro účetní", priority: 0.7, changeFrequency: "monthly", modified: "2026-10-03" },
  { path: "/ucetni/hromadna-kontrola", title: "Hromadná kontrola IČO pro účetní", priority: 0.7, changeFrequency: "monthly", modified: "2026-10-01" },
  { path: "/ucetni/sablony", title: "Šablony dopisů klientům k EET 2.0", priority: 0.5, changeFrequency: "monthly", modified: "2026-10-01" },
  { path: "/cenik", title: "Ceník", priority: 0.6, changeFrequency: "monthly", modified: "2026-10-09" },
  { path: "/o-nas", title: "O nás a kontakt", priority: 0.4, changeFrequency: "monthly", modified: "2026-10-07" },
  { path: "/podminky", title: "Obchodní podmínky", priority: 0.2, changeFrequency: "monthly" },
  { path: "/ochrana-osobnich-udaju", title: "Ochrana osobních údajů", priority: 0.2, changeFrequency: "monthly" },
  { path: "/pravidla-doporuceni", title: "Pravidla akce Doporučte kolegu", priority: 0.2, changeFrequency: "monthly", modified: "2026-10-07" },
];
