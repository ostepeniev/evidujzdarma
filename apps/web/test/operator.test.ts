/**
 * R2.4 / Р9 – údaje provozovatele (§ 435 OZ) jsou v kódu, ne v env, a jsou všude, kde mají být.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderEmail } from "@/lib/emails";
import { OPERATOR, operatorLine } from "@/lib/site";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("R2.4 – operator identification", () => {
  it("is hardcoded with the verified registry data", () => {
    expect(OPERATOR).toEqual({
      name: "Swipe Scape s.r.o.",
      ico: "22269134",
      dic: "CZ22269134",
      address: "Chebská 38/5, Dvory, 360 06 Karlovy Vary",
      registry: "zapsaná v obchodním rejstříku vedeném Krajským soudem v Plzni, oddíl C, vložka 47634",
    });
    expect(operatorLine()).toBe(
      "Swipe Scape s.r.o., IČO 22269134, DIČ CZ22269134, se sídlem Chebská 38/5, Dvory, 360 06 Karlovy Vary, zapsaná v obchodním rejstříku vedeném Krajským soudem v Plzni, oddíl C, vložka 47634",
    );
    expect(read("src/lib/site.ts")).not.toMatch(/NEXT_PUBLIC_OPERATOR/);
  });

  it("appears in the footer, About, terms, privacy policy and every e-mail", () => {
    for (const f of ["src/components/site-footer.tsx", "src/app/(site)/o-nas/page.tsx", "src/app/(site)/podminky/page.tsx", "src/app/(site)/ochrana-osobnich-udaju/page.tsx"]) {
      expect(read(f), f).toMatch(/operatorLine\(\)|OPERATOR\.ico/);
    }
    for (const t of ["notice", "login-link"] as const) {
      const e = renderEmail(t, { subject: "x", text: "x", url: "https://evidujzdarma.cz" });
      expect(e.html, t).toContain("IČO 22269134");
      expect(e.text, t).toContain("IČO 22269134");
    }
  });
});
