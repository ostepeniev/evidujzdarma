import { ImageResponse } from "next/og";

export const alt = "EvidujZdarma – evidence tržeb EET 2.0 zdarma, i bez signálu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Výchozí obrázek pro sdílení (Facebook, LinkedIn, X, Slack, AI náhledy). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(160deg,#eaf7f1 0%,#ffffff 60%)", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#0b7a57", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="44" height="44" viewBox="0 0 24 24">
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#14211c" }}>
            Eviduj<span style={{ color: "#0b7a57" }}>Zdarma</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 78, fontWeight: 800, color: "#14211c", lineHeight: 1.05 }}>Evidence tržeb EET 2.0 zdarma</div>
          <div style={{ fontSize: 38, color: "#3d4b45" }}>Bezplatná pokladna pro EET 2.0 – i bez signálu.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: "#66756e" }}>
          <span>evidujzdarma.cz</span>
          <span>Nezávislá služba, není provozována Finanční správou</span>
        </div>
      </div>
    ),
    size,
  );
}
