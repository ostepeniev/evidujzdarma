import { z } from "zod";

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

export const DeviceInput = z.object({
  name: z.string().trim().min(1).max(60),
  registerId: z.string().trim().min(1).max(20),
  unitId: z.string().uuid().nullable(),
});
