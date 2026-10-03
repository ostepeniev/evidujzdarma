/** Režim evidence v 6. pádě – „Tržba je v ostrém provozu“, „prodej proběhl v ukázkovém režimu“ (R8.3). */
export const MODE_IN: Record<"mock" | "playground" | "production", string> = {
  mock: "v ukázkovém režimu",
  playground: "v režimu Playground",
  production: "v ostrém provozu",
};

/** Režim v 6. pádě; neznámý režim jeho kódem. */
export const modeIn = (mode: string): string => MODE_IN[mode as keyof typeof MODE_IN] ?? `v režimu ${mode}`;
