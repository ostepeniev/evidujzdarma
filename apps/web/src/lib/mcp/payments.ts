/**
 * Orientační klasifikace platby: eviduje se v EET 2.0, nebo ne?
 * Pravidla vycházejí z FACTS (kontaktní platba = při osobním kontaktu nebo v provozovně).
 * Nejisté případy (převod zadaný na místě, dobírka) vrací "uncertain" – jsou na seznamu k ověření.
 */
import { FACTS, SOURCES, type Source } from "@/content/facts";

export const PAYMENT_KINDS = [
  "cash",
  "card",
  "qr_code",
  "voucher",
  "virtual_assets",
  "cheque",
  "bank_transfer",
  "online_gateway",
  "cash_on_delivery",
] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  cash: "hotovost",
  card: "platební karta",
  qr_code: "QR platba",
  voucher: "poukaz, dárková karta, stravenka",
  virtual_assets: "virtuální aktiva (kryptoměny)",
  cheque: "šek",
  bank_transfer: "bankovní převod",
  online_gateway: "platební brána e-shopu",
  cash_on_delivery: "dobírka přes dopravce",
};

export interface PaymentClassification {
  payment: PaymentKind;
  in_person: boolean;
  evidenced: "yes" | "no" | "uncertain";
  explanation: string;
  note: string | null;
  sources: Source[];
  guide_url_path: string;
}

const CONTACT: readonly PaymentKind[] = ["cash", "card", "qr_code", "voucher", "virtual_assets", "cheque"];

export function classifyPayment(payment: PaymentKind, inPerson: boolean): PaymentClassification {
  const base = { payment, in_person: inPerson, guide_url_path: "/navody/kontaktni-platba", sources: [SOURCES.kdoMusi, SOURCES.danovkyKontaktni] };
  const exemptNote = "Platí, pokud vaše činnost není ze zákona vyjmutá z evidence.";

  if (CONTACT.includes(payment)) {
    if (inPerson) {
      return {
        ...base,
        evidenced: "yes",
        explanation: `${PAYMENT_KIND_LABEL[payment]} přijatá při osobním kontaktu nebo v provozovně je kontaktní platba – eviduje se. ${FACTS.evidenced.summary}`,
        note: payment === "voucher" ? `${FACTS.evidenced.prepayments} ${exemptNote}` : exemptNote,
      };
    }
    return {
      ...base,
      evidenced: "no",
      explanation: `${PAYMENT_KIND_LABEL[payment]} bez osobního kontaktu (na dálku) se neeviduje. ${FACTS.evidenced.notEvidenced}`,
      note: payment === "qr_code" ? "QR kód na faktuře nebo na webu je platba na dálku; QR kód naskenovaný na místě se eviduje." : null,
    };
  }
  if (payment === "online_gateway") {
    return { ...base, evidenced: "no", explanation: `Platba přes platební bránu e-shopu bez osobního kontaktu se neeviduje. ${FACTS.evidenced.notEvidenced}`, note: null };
  }
  if (payment === "bank_transfer") {
    return inPerson
      ? {
          ...base,
          evidenced: "uncertain",
          explanation: "Bankovní převod se podle dostupných rozborů neeviduje ani tehdy, když ho zákazník zadá v provozovně (např. platba faktury z mobilu).",
          note: "Převod zadaný na místě je na seznamu věcí k ověření s daňovým poradcem. QR platba naskenovaná na místě se naopak eviduje.",
          sources: [SOURCES.kdoMusi, SOURCES.podnikatelDetail],
        }
      : { ...base, evidenced: "no", explanation: `Bankovní převod na základě faktury se neeviduje. ${FACTS.evidenced.notEvidenced}`, note: null };
  }
  // cash_on_delivery
  return {
    ...base,
    evidenced: "uncertain",
    explanation: "Dobírku vybírá dopravce a peníze obchodníkovi zpravidla posílá převodem – podle dostupných rozborů ji obchodník neeviduje.",
    note: "Ověřte s daňovým poradcem; jiné je to u osobního odběru na výdejním místě obchodníka, kde se platba na místě eviduje.",
    sources: [SOURCES.podnikatelDetail],
  };
}
