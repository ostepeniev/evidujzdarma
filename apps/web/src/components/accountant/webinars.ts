/** Formulář pro účetní (/ucetni): webináře EET 2.0 a zpráva o spuštění Účetního kabinetu – zájem z lib/interests (R7.4). */
import type { Interest } from "@/lib/interests";

export interface WebinarOption {
  /** zájem posílaný do /api/preregistrace (pole interest) */
  value: Extract<Interest, "webinar" | "kabinet">;
  label: string;
  hint: string;
}

// Konkrétní termíny a JSON-LD Event až s rozesíláním odkazů (R7.4); do té doby jen zájem
export const WEBINAR_OPTIONS: readonly WebinarOption[] = [
  { value: "webinar", label: "Webinář EET 2.0 pro účetní", hint: "Termín i odkaz pošleme, jakmile ho vypíšeme" },
  { value: "kabinet", label: "Jen mi dejte vědět o spuštění Účetního kabinetu", hint: "Bez webináře" },
];
