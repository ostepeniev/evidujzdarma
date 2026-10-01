import type { Metadata } from "next";
import { PosApp } from "@/components/pos/pos-app";

export const metadata: Metadata = { title: "Pokladna" };

/** Statická stránka: veškerá data čte pokladna z IndexedDB, takže funguje i offline. */
export default function PosPage() {
  return <PosApp />;
}
