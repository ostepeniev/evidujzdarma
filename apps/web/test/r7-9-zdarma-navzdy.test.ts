/**
 * R7.9 (рецензія №4; rozhodnutí Ц2) – „zdarma navždy“ s definicí v podmínkách (čl. 6.2, 11.2). Texty doslovně.
 */
import { describe, expect, it } from "vitest";
import { pageText } from "./helpers/render-text";

const { default: Podminky } = await import("@/app/(site)/podminky/page");
const podminky = pageText(Podminky);

describe("R7.9 – 'zdarma navždy' is defined in the terms", () => {
  it("gate: 6.2 and 11.2 verbatim; no 60-day notice for the free plan", () => {
    expect(podminky).toContain(
      "6.2 Tarif Zdarma je zdarma navždy: nemá časové omezení a provozovatel se zavazuje, že funkce, které ceník ke dni registrace uživatele uvádí jako součást tarifu Zdarma (evidence tržeb, práce bez signálu, až 5 uživatelů, až 3 evidenční jednotky, doklad e-mailem, denní přehled, export CSV, QR platba), nezpoplatní ani je nepřesune do placeného tarifu.",
    );
    expect(podminky).toContain(
      "11.2 Provozovatel neukončí tarif Zdarma samostatně, dokud službu EvidujZdarma provozuje. Celou službu může ukončit jen pro všechny uživatele současně, s výpovědní dobou nejméně 6 měsíců oznámenou e-mailem; po tuto dobu půjde pokladna dál používat a data vyexportovat. Při závažném porušení podmínek uživatelem (např. zneužití služby) může provozovatel přístup omezit nebo účet zrušit s okamžitou účinností.",
    );
    expect(podminky).not.toMatch(/výpovědní dobou 60 dnů/);
    expect(podminky).toContain("Tarif Zdarma je zdarma navždy (čl. 6.2), ale bez garancí");
  });

  it("gate: the pricing notice links to čl. 6.2 of the terms", async () => {
    const { PRICING_NOTICE } = await import("@/content/pricing");
    expect(PRICING_NOTICE).toContain("zdarma navždy ([čl. 6.2 podmínek](/podminky#zdarma))");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: Cenik } = await import("@/app/(site)/cenik/page");
    expect(renderToStaticMarkup(createElement(Cenik))).toContain('href="/podminky#zdarma"');
  });
});
