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
  "meal_voucher",
  "credit",
  "gift_voucher",
  "deposit",
  // starší obecná hodnota – odpověď „záleží na druhu“ (R6.6)
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
  meal_voucher: "stravenka nebo poukázka vydaná jinou firmou",
  credit: "čerpání dříve nabitého kreditu (čip, předplacená karta)",
  gift_voucher: "uplatnění dárkového poukazu na konkrétní zboží nebo službu",
  deposit: "záloha nebo doplatek",
  voucher: "poukaz (druh neuveden)",
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

const CONTACT: readonly PaymentKind[] = ["cash", "card", "qr_code", "meal_voucher", "credit", "deposit", "virtual_assets", "cheque"];

/** Poznámky k druhům, které rozlišuje seminář FS (Ф11) – stejně jako pokladna. */
const KIND_NOTE: Partial<Record<PaymentKind, string>> = {
  meal_voucher: "Platba stravenkou nebo poukázkou vydanou jinou firmou je běžná evidovaná platba.",
  credit:
    "Dobití kreditu i jeho pozdější čerpání se evidují obě – datová zpráva obsahuje částku určenou k následnému čerpání (urceno_cerp_zuct), resp. částku čerpání (cerp_zuct).",
  deposit: "Záloha i doplatek zaplacené při osobním kontaktu se evidují jako dvě samostatné běžné platby (nejsou spolu provázané).",
};

export function classifyPayment(payment: PaymentKind, inPerson: boolean): PaymentClassification {
  const base = { payment, in_person: inPerson, guide_url_path: "/navody/kontaktni-platba", sources: [SOURCES.kdoMusi, SOURCES.danovkyKontaktni] };
  const exemptNote = "Platí, pokud vaše činnost není ze zákona vyjmutá z evidence.";
  const seminar = [SOURCES.kdoMusi, SOURCES.seminarVyvojari];

  if (payment === "gift_voucher") {
    return {
      ...base,
      evidenced: "no",
      explanation: "Uplatnění dárkového poukazu na konkrétní zboží nebo službu není platbou a neeviduje se – evidoval se už prodej poukazu.",
      note: "Doplatek, který zákazník k poukazu zaplatí (hotově, kartou), se eviduje jako běžná platba.",
      sources: seminar,
    };
  }
  if (payment === "voucher") {
    return {
      ...base,
      evidenced: "uncertain",
      explanation:
        "Záleží na druhu poukazu: stravenka nebo poukázka jiné firmy se eviduje (meal_voucher), čerpání nabitého kreditu se eviduje jako čerpání (credit), uplatnění dárkového poukazu na konkrétní zboží nebo službu se neeviduje (gift_voucher).",
      note: FACTS.evidenced.prepayments,
      sources: seminar,
    };
  }

  if (CONTACT.includes(payment)) {
    if (inPerson) {
      return {
        ...base,
        evidenced: "yes",
        explanation: KIND_NOTE[payment] ?? `${PAYMENT_KIND_LABEL[payment]} přijatá při osobním kontaktu nebo v provozovně je kontaktní platba – eviduje se. ${FACTS.evidenced.summary}`,
        note: exemptNote,
        ...(KIND_NOTE[payment] ? { sources: seminar } : {}),
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
