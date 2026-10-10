import type { Metadata } from "next";
import Link from "next/link";
import { DemoPos } from "@/components/demo/demo-pos";
import { canonicalMeta } from "@/lib/metadata";
import { SERVICE_COPY } from "@/lib/site";

/** Ukázka pokladny bez registrace (R17.5) – dostupná hned, nečeká na otevření pokladny. Texty doslovně. */
export const metadata: Metadata = {
  title: { absolute: "Ukázka pokladny EvidujZdarma" },
  description: "Vyzkoušejte si pokladnu EvidujZdarma bez registrace: zboží, platba hotově nebo kartou a účtenka. Nic se neukládá ani neodesílá.",
  ...canonicalMeta("/ukazka"),
};

export default function DemoPage() {
  return (
    <>
      <div className="border-b border-sun-200 bg-sun-100 py-2 text-center text-[15px] font-semibold text-warn-700" role="note">
        Ukázka. Nic se neukládá ani neodesílá Finanční správě.
      </div>
      <div className="container-page py-8">
        <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">Vyzkoušejte si pokladnu bez registrace</h1>
        <DemoPos />
        <div className="mt-8 flex justify-center">
          <Link href={SERVICE_COPY.startCta.href} className="btn-primary px-6 py-3 text-lg">
            {SERVICE_COPY.startCta.label}
          </Link>
        </div>
      </div>
    </>
  );
}
