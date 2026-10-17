import { z } from "zod";
import { IMPORT_LIMITS } from "@/lib/pos/import-products";

export const UNIT_TYPES = ["stala_provozovna", "mobilni_provozovna", "automat", "internetova_stranka", "dopravni_prostredek", "osoba"] as const;

export const UnitInput = z.object({
  type: z.enum(UNIT_TYPES),
  label: z.string().trim().min(1).max(120),
  fsUnitId: z.coerce.number().int().min(1).max(999_999_999).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
});
export const UnitPatch = UnitInput.partial().extend({ active: z.boolean().optional() });

export const StaffInput = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(["owner", "cashier"]).default("cashier"),
  pin: z
    .string()
    .regex(/^\d{4,8}$/, "PIN musí mít 4–8 číslic")
    .optional(),
}).superRefine((v, ctx) => {
  // vlastník: PIN 6–8 číslic (R3.10)
  if (v.role === "owner" && v.pin && !/^\d{6,8}$/.test(v.pin)) ctx.addIssue({ code: "custom", path: ["pin"], message: "PIN vlastníka musí mít 6–8 číslic." });
});
export const StaffPatch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  pin: z
    .string()
    .regex(/^\d{4,8}$/, "PIN musí mít 4–8 číslic")
    .nullable()
    .optional(),
  active: z.boolean().optional(),
});

export const CatalogInput = z.object({
  name: z.string().trim().min(1).max(80),
  /** cena v haléřích */
  price: z.number().int().min(-10_000_000_00).max(10_000_000_00),
  vatRate: z.number().int().refine((v) => [0, 12, 21].includes(v), "Sazba DPH 0, 12 nebo 21 %"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  sort: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
});
export const CatalogPatch = CatalogInput.partial();

/** S2-E: import zboží ze souboru – jen název, cena s DPH (haléře, > 0) a sazba; limit řádků = IMPORT_LIMITS.maxRows. */
export const CatalogImportInput = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Položka bez názvu").max(IMPORT_LIMITS.nameMax, `Název má víc než ${IMPORT_LIMITS.nameMax} znaků`),
        price: z.number().int().min(1, "Cena musí být větší než 0 Kč").max(IMPORT_LIMITS.maxPrice, "Cena je vyšší než 10 milionů Kč"),
        vatRate: z.number().int().refine((v) => [0, 12, 21].includes(v), "Sazba DPH 0, 12 nebo 21 %"),
      }),
    )
    .min(1, "Soubor neobsahuje žádnou položku k importu")
    .max(IMPORT_LIMITS.maxRows, "Najednou lze naimportovat nejvýš 2 000 položek"),
});
/** Vrácení importu: smaže jen položky z tohoto importu (id vrátil POST). */
export const CatalogImportUndo = z.object({ ids: z.array(z.string().uuid()).min(1).max(IMPORT_LIMITS.maxRows) });

export const DeviceInput = z.object({
  name: z.string().trim().min(1).max(60),
  registerId: z.string().trim().min(1).max(20),
  unitId: z.string().uuid().nullable(),
});
