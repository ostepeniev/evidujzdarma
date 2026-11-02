/**
 * Formulář pro účetní (/ucetni): zpráva o spuštění Účetního kabinetu – zájem z lib/interests (R7.4).
 * S11 (3. 11. 2026): webinář nenabízíme (rozhodnutí majitele); zájem „webinar“ zůstává v lib/interests kvůli starším záznamům.
 * Formulář se ukazuje jen tehdy, když je kabinet za heslem (isClosed("/kabinet")).
 */
import type { Interest } from "@/lib/interests";

export interface WebinarOption {
  /** zájem posílaný do /api/preregistrace (pole interest) */
  value: Extract<Interest, "webinar" | "kabinet">;
  label: string;
  hint: string;
}

export const WEBINAR_OPTIONS: readonly WebinarOption[] = [{ value: "kabinet", label: "Dejte mi vědět o spuštění Účetního kabinetu", hint: "Jeden e-mail, až kabinet spustíme" }];
