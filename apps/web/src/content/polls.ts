/** Ankety na webu – anonymní, výsledky jen souhrnně (pro PR: „X % podnikatelů…“). */
export interface Poll {
  id: string;
  question: string;
  options: readonly { id: string; label: string }[];
  /** výsledky zobrazíme až od tohoto počtu hlasů (malý vzorek by byl zavádějící) */
  minVotesToShow: number;
}

export const POLLS = {
  "eet2-souhlas": {
    id: "eet2-souhlas",
    question: "Souhlasíte se zavedením EET 2.0?",
    options: [
      { id: "ano", label: "Ano" },
      { id: "spis-ano", label: "Spíš ano" },
      { id: "spis-ne", label: "Spíš ne" },
      { id: "ne", label: "Ne" },
    ],
    minVotesToShow: 20,
  },
} as const satisfies Record<string, Poll>;

export type PollId = keyof typeof POLLS;

export function getPoll(id: string): Poll | null {
  return (POLLS as Record<string, Poll>)[id] ?? null;
}
