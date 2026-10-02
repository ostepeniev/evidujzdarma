import type { Metadata } from "next";
import { PosApp } from "@/components/pos/pos-app";

export const metadata: Metadata = { title: "Pokladna" };
// Renderuje se pro každý požadavek kvůli CSP s nonce (R3.9). Offline ji vrací service worker
// z cache i s hlavičkami, takže nonce v HTML a v CSP k sobě pořád sedí.
export const dynamic = "force-dynamic";

/** Veškerá data čte pokladna z IndexedDB, takže funguje i offline. */
export default function PosPage() {
  return <PosApp />;
}
