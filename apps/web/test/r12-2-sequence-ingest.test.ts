/**
 * R12.2 (рецензія №9) – porad_cis 1–25 znaků i na vstupu: tržba z pokladny s pořadovým číslem delším než 25 znaků
 * neprojde schématem příjmu (DeviceSaleSchema), aby nevznikla zpráva, kterou FS odmítne.
 */
import { describe, expect, it } from "vitest";
import { DeviceSaleSchema } from "@/lib/server/sales";

describe("R12.2 – sequence length on ingest", () => {
  it("gate: 25 characters pass, 26 and an empty one fail", () => {
    const seq = DeviceSaleSchema.shape.sequence;
    const s25 = "P1-" + "0".repeat(22);
    expect(seq.safeParse(s25).success).toBe(true);
    expect(seq.safeParse(`${s25}1`).success).toBe(false);
    expect(seq.safeParse("").success).toBe(false);
  });
});
