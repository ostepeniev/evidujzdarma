/**
 * Hotel a PMS: které platby poslat do EET API (S8, rozd. 10). Jen pravidla z recenzovaného návodu eet-ubytovani
 * a FACTS.evidenced – žádná nová daňová tvrzení (Ф9, Ф14). Stejné řádky jsou v docs/integrations/hotel-pms.md (test).
 */
export interface HotelRow {
  event: string;
  call: "Ano" | "Ne" | "Otevřené";
  how: string;
}

export const HOTEL_ROWS: readonly HotelRow[] = [
  { event: "Záloha převodem / platební bránou / přes Booking, Airbnb online", call: "Ne", how: "Vzdálená platba – neeviduje se." },
  { event: "Záloha zaplacená na recepci (hotovost, karta, QR)", call: "Ano", how: "Běžná tržba, `kind: goods`, řádek např. „Záloha – rezervace …“." },
  { event: "Doplatek na recepci", call: "Ano", how: "Samostatná tržba; záloha a doplatek se v datové zprávě nepropojují." },
  { event: "Doplatek převodem na fakturu", call: "Ne", how: "Neeviduje se. Chce-li PMS mít vše na jednom místě, může poslat `transfer` – tržba bude `not_evidenced` a do FS nepůjde." },
  { event: "Minibar, wellness, parkování placené na místě", call: "Ano", how: "Běžná tržba." },
  { event: "Vratná kauce – složení / vrácení", call: "Ne", how: "Při složení ani při vrácení se neeviduje (ani stornem)." },
  { event: "Část kauce složené na místě, kterou si ponecháte", call: "Ano", how: "Tržba jen na ponechanou (použitou) částku." },
  { event: "Kauce poslaná převodem, část ponechána", call: "Ne", how: "Nejde o kontaktní platbu." },
  { event: "Storno / vrácení peněz na místě", call: "Ano", how: "`POST /v1/sales/{id}/refund`." },
  {
    event: "Místní poplatek z pobytu",
    call: "Otevřené",
    how: "Finanční správa zatím nezveřejnila, zda se zahrnuje do evidované tržby (návod, oddíl „Místní poplatek“). V PMS jako nastavení na úrovni hotelu – rozhodnutí podnikatele a jeho účetní, bez výchozí hodnoty.",
  },
  { event: "Dobití kreditu / hotelové karty k pozdějšímu čerpání", call: "Ano", how: "`kind: credit_topup`; čerpání kreditu `method: credit`." },
];

/** Příklad 1: záloha kartou na recepci při příjezdu a doplatek kartou při odjezdu – dvě samostatné tržby. */
export const HOTEL_EXAMPLE_DEPOSIT = {
  sales: [
    {
      id: "0b6f3f1e-2a51-4c8e-9a4e-6a1d2f0c7a11",
      externalRef: "ALI-PAY-1001",
      unitId: "3f2a9c7e-5b1d-4e8f-a2c4-9d6e1b0f3a22",
      soldAt: "2027-01-05T15:20:00+01:00",
      lines: [{ name: "Záloha – rezervace R-2027-0042", qty: 1, unitPrice: 200000, vatRate: 12, kind: "goods" }],
      payments: [{ method: "card", amount: 200000 }],
    },
    {
      id: "6c1d8a42-9e3b-4f70-b5a1-2e8c7d4f9b33",
      externalRef: "ALI-PAY-1002",
      unitId: "3f2a9c7e-5b1d-4e8f-a2c4-9d6e1b0f3a22",
      soldAt: "2027-01-08T10:05:00+01:00",
      lines: [
        { name: "Doplatek – rezervace R-2027-0042", qty: 1, unitPrice: 340000, vatRate: 12, kind: "goods" },
        { name: "Minibar", qty: 2, unitPrice: 6000, vatRate: 21, kind: "goods" },
      ],
      payments: [{ method: "card", amount: 352000 }],
    },
  ],
};

/** Příklad 2: kauce 3 000 Kč složená v hotovosti na recepci, ponecháno 300 Kč na škodu – tržba jen na 300 Kč. */
export const HOTEL_EXAMPLE_DEPOSIT_KEPT = {
  sales: [
    {
      id: "9a4e2b17-3c6d-4f8a-8b1e-5d2c7f0a6e44",
      externalRef: "ALI-KAUCE-77",
      unitId: "3f2a9c7e-5b1d-4e8f-a2c4-9d6e1b0f3a22",
      soldAt: "2027-01-08T10:10:00+01:00",
      lines: [{ name: "Úhrada škody z kauce (poškozené povlečení)", qty: 1, unitPrice: 30000, vatRate: 21, kind: "goods" }],
      payments: [{ method: "cash", amount: 30000 }],
    },
  ],
};
