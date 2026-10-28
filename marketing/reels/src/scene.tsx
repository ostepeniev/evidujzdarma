import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Inter (OFL) – stejné písmo jako web evidujzdarma.cz
loadFont({ family: "Inter", url: staticFile("inter-latin-ext-wght-normal.woff2"), weight: "100 900" });
loadFont({ family: "Inter", url: staticFile("inter-latin-wght-normal.woff2"), weight: "100 900" });

export const C = {
  bgTop: "#053a2a",
  bgBottom: "#0b7a57",
  ink: "#14211c",
  white: "#ffffff",
  soft: "#cdeedf",
  sun: "#ffdf73",
  sunDeep: "#f2b705",
  red: "#ff6b5a",
  green: "#3ddc97",
};

type Item = { icon?: "yes" | "no" | "dot" | "warn"; text: string; sub?: string };
type Bar = { label: string; value: number; display: string; color?: string };
type TItem = { date: string; text: string };

export type SceneProps = {
  type: "title" | "number" | "list" | "bars" | "timeline" | "cta" | "photo";
  seconds: number;
  kicker?: string;
  lines?: string[]; // [[slovo]] = žlutý marker
  value?: string;
  countdown?: { fromSeconds: number; toSeconds: number };
  counter?: { from: number; to: number; suffix?: string; prefix?: string };
  caption?: string[];
  title?: string;
  items?: Item[];
  bars?: Bar[];
  timeline?: TItem[];
  url?: string;
  share?: string;
  tone?: "dark" | "sun" | "alarm";
  photo?: string; // soubor v public/, např. "ai/b_real.jpg"
  photoY?: string; // object-position Y, např. "0%" | "50%"
  ai?: boolean; // štítek „AI průvodkyně“
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const appear = (frame: number, start: number, dur = 12) => ({
  opacity: interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: ease }),
  translate: interpolate(frame, [start, start + dur], ["0px 60px", "0px 0px"], { ...clamp, easing: ease }),
});

/** Text s markerem: [[slovo]] → žlutý podklad, který se „domaluje“. */
const Marked: React.FC<{ text: string; frame: number; start: number; dark?: boolean }> = ({ text, frame, start, dark }) => {
  const parts = text.split(/(\[\[.*?\]\])/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[\[(.*)\]\]$/);
        if (!m) return <span key={i}>{p}</span>;
        const w = interpolate(frame, [start + 8, start + 20], [0, 100], { ...clamp, easing: ease });
        return (
          <span
            key={i}
            style={{
              backgroundImage: `linear-gradient(${C.sun}, ${C.sun})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${w}% 86%`,
              backgroundPosition: "0 55%",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
              borderRadius: 12,
              padding: "0 0.14em",
              color: w > 40 ? C.ink : C.white,
              whiteSpace: m[1].length <= 16 ? "nowrap" : "normal",
            }}
          >
            {m[1]}
          </span>
        );
      })}
    </>
  );
};

const Brand: React.FC = () => (
  <div style={{ position: "absolute", top: 90, left: 80, display: "flex", alignItems: "center", gap: 18 }}>
    <Img src={staticFile("icon.svg")} style={{ width: 64, height: 64, borderRadius: 16, boxShadow: "0 0 0 3px rgba(255,255,255,0.25)" }} />
    <div style={{ fontSize: 40, fontWeight: 800, color: C.white, letterSpacing: -0.5 }}>EvidujZdarma</div>
  </div>
);

const Kicker: React.FC<{ text: string; frame: number }> = ({ text, frame }) => (
  <div
    style={{
      ...appear(frame, 0, 10),
      alignSelf: "flex-start",
      background: "rgba(255,223,115,0.16)",
      border: `3px solid ${C.sun}`,
      color: C.sun,
      fontSize: 38,
      fontWeight: 800,
      padding: "12px 26px",
      borderRadius: 999,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 44,
    }}
  >
    {text}
  </div>
);

const Bg: React.FC<{ tone?: SceneProps["tone"] }> = ({ tone }) => {
  const frame = useCurrentFrame();
  const top = tone === "alarm" ? "#3a0d0a" : tone === "sun" ? "#3d3000" : C.bgTop;
  const bottom = tone === "alarm" ? "#8a2318" : tone === "sun" ? "#7a5f00" : C.bgBottom;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${top} 0%, ${bottom} 100%)` }}>
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: 450,
          left: interpolate(frame, [0, 600], [420, 160]),
          top: interpolate(frame, [0, 600], [-260, -120]),
          background: `radial-gradient(circle, ${tone === "alarm" ? "rgba(255,107,90,0.35)" : "rgba(255,223,115,0.22)"} 0%, rgba(255,223,115,0) 65%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.08,
          backgroundImage: "repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 46px)",
          translate: `${(frame * 0.6) % 46}px 0px`,
        }}
      />
    </AbsoluteFill>
  );
};

const Frame: React.FC<{ tone?: SceneProps["tone"]; children: React.ReactNode }> = ({ tone, children }) => (
  <AbsoluteFill style={{ fontFamily: "Inter, sans-serif", color: C.white }}>
    <Bg tone={tone} />
    <Brand />
    {/* obsah v horních ~2/3, spodek nechává místo titulkům */}
    <div
      style={{
        position: "absolute",
        top: 230,
        left: 80,
        right: 80,
        bottom: 700,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        scale: interpolate(useCurrentFrame(), [0, 300], [1, 1.035], { extrapolateRight: "clamp" }),
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

const fmtCountdown = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};
const fmtNum = (n: number) => new Intl.NumberFormat("cs-CZ").format(Math.round(n)).replace(/ /g, " ");

export const Scene: React.FC<SceneProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (p.type === "title") {
    const lines = p.lines ?? [];
    const size = lines.join(" ").length > 70 ? 84 : 104;
    return (
      <Frame tone={p.tone}>
        {p.kicker && <Kicker text={p.kicker} frame={frame} />}
        {lines.map((l, i) => (
          <div key={i} style={{ ...appear(frame, 4 + i * 5), fontSize: size, fontWeight: 900, lineHeight: 1.08, letterSpacing: -2, marginBottom: 10 }}>
            <Marked text={l} frame={frame} start={4 + i * 5} />
          </div>
        ))}
        {p.caption?.map((c, i) => (
          <div key={`c${i}`} style={{ ...appear(frame, 14 + lines.length * 5 + i * 5), fontSize: 48, fontWeight: 600, color: C.soft, marginTop: 28, lineHeight: 1.25 }}>
            <Marked text={c} frame={frame} start={14 + lines.length * 5 + i * 5} />
          </div>
        ))}
      </Frame>
    );
  }

  if (p.type === "number") {
    let shown = p.value ?? "";
    if (p.countdown) {
      const t = interpolate(frame, [0, p.seconds * fps], [p.countdown.fromSeconds, p.countdown.toSeconds], clamp);
      shown = fmtCountdown(t);
    } else if (p.counter) {
      const v = interpolate(frame, [4, 4 + 0.9 * fps], [p.counter.from, p.counter.to], { ...clamp, easing: ease });
      shown = `${p.counter.prefix ?? ""}${fmtNum(v)}${p.counter.suffix ?? ""}`;
    }
    const pulse = p.countdown ? interpolate(frame % fps, [0, 6, fps], [1.04, 1, 1], clamp) : 1;
    return (
      <Frame tone={p.tone}>
        {p.kicker && <Kicker text={p.kicker} frame={frame} />}
        <div
          style={{
            ...appear(frame, 2),
            scale: pulse,
            fontSize: shown.length > 9 ? 150 : shown.length > 7 ? 160 : 250,
            fontWeight: 900,
            letterSpacing: -6,
            lineHeight: 1,
            color: p.tone === "alarm" ? "#ffd6d0" : C.sun,
            fontVariantNumeric: "tabular-nums",
            marginBottom: 40,
          }}
        >
          {shown}
        </div>
        {p.caption?.map((c, i) => (
          <div key={i} style={{ ...appear(frame, 12 + i * 6), fontSize: 60, fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
            <Marked text={c} frame={frame} start={12 + i * 6} />
          </div>
        ))}
      </Frame>
    );
  }

  if (p.type === "list") {
    const items = p.items ?? [];
    const icon = (k?: Item["icon"]) => {
      const map = { yes: ["✓", C.green], no: ["✕", C.red], warn: ["!", C.sun], dot: ["•", C.soft] } as const;
      const [ch, col] = map[k ?? "dot"];
      return (
        <div style={{ width: 84, height: 84, borderRadius: 24, background: "rgba(255,255,255,0.1)", border: `4px solid ${col}`, color: col, fontSize: 52, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {ch}
        </div>
      );
    };
    const step = Math.max(6, Math.floor((p.seconds * fps * 0.55) / Math.max(1, items.length)));
    return (
      <Frame tone={p.tone}>
        {p.kicker && <Kicker text={p.kicker} frame={frame} />}
        {p.title && (
          <div style={{ ...appear(frame, 2), fontSize: 80, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1.5, marginBottom: 46 }}>
            <Marked text={p.title} frame={frame} start={2} />
          </div>
        )}
        {items.map((it, i) => (
          <div key={i} style={{ ...appear(frame, 8 + i * step), display: "flex", gap: 30, alignItems: "center", marginBottom: 30 }}>
            {icon(it.icon)}
            <div>
              <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.12 }}>{it.text}</div>
              {it.sub && <div style={{ fontSize: 40, fontWeight: 500, color: C.soft, marginTop: 6 }}>{it.sub}</div>}
            </div>
          </div>
        ))}
      </Frame>
    );
  }

  if (p.type === "bars") {
    const bars = p.bars ?? [];
    const max = Math.max(...bars.map((b) => b.value), 1);
    return (
      <Frame tone={p.tone}>
        {p.kicker && <Kicker text={p.kicker} frame={frame} />}
        {p.title && (
          <div style={{ ...appear(frame, 2), fontSize: 76, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1.5, marginBottom: 56 }}>
            <Marked text={p.title} frame={frame} start={2} />
          </div>
        )}
        {bars.map((b, i) => {
          const w = interpolate(frame, [10 + i * 10, 34 + i * 10], [0, (b.value / max) * 100], { ...clamp, easing: ease });
          return (
            <div key={i} style={{ marginBottom: 44 }}>
              <div style={{ ...appear(frame, 8 + i * 10), fontSize: 44, fontWeight: 700, color: C.soft, marginBottom: 14 }}>{b.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div style={{ height: 96, width: `${Math.max(w, 2.5)}%`, maxWidth: "72%", background: b.color ?? C.sun, borderRadius: 20 }} />
                <div style={{ ...appear(frame, 26 + i * 10), fontSize: 60, fontWeight: 900, whiteSpace: "nowrap" }}>{b.display}</div>
              </div>
            </div>
          );
        })}
        {p.caption?.map((c, i) => (
          <div key={i} style={{ ...appear(frame, 40 + i * 6), fontSize: 46, fontWeight: 600, color: C.soft, marginTop: 10 }}>
            <Marked text={c} frame={frame} start={40 + i * 6} />
          </div>
        ))}
      </Frame>
    );
  }

  if (p.type === "timeline") {
    const items = p.timeline ?? [];
    const step = Math.max(6, Math.floor((p.seconds * fps * 0.6) / Math.max(1, items.length)));
    const lineH = interpolate(frame, [4, 4 + step * items.length], [0, 100], { ...clamp, easing: ease });
    return (
      <Frame tone={p.tone}>
        {p.kicker && <Kicker text={p.kicker} frame={frame} />}
        {p.title && (
          <div style={{ ...appear(frame, 2), fontSize: 76, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1.5, marginBottom: 40 }}>
            <Marked text={p.title} frame={frame} start={2} />
          </div>
        )}
        <div style={{ position: "relative", paddingLeft: 70 }}>
          <div style={{ position: "absolute", left: 22, top: 10, width: 8, height: `${lineH}%`, background: C.sun, borderRadius: 4 }} />
          {items.map((t, i) => (
            <div key={i} style={{ ...appear(frame, 8 + i * step), position: "relative", marginBottom: 34 }}>
              <div style={{ position: "absolute", left: -66, top: 16, width: 44, height: 44, borderRadius: 22, background: C.sun, border: `8px solid ${C.bgTop}` }} />
              <div style={{ fontSize: 64, fontWeight: 900, color: C.sun, lineHeight: 1.05 }}>{t.date}</div>
              <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.18, marginTop: 4 }}>{t.text}</div>
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (p.type === "photo") {
    const PANEL = 400;
    const lines = p.lines ?? [];
    const longest = Math.max(0, ...lines.map((l) => l.replace(/\[\[|\]\]/g, "").length));
    const size = longest > 20 ? 64 : longest > 16 ? 72 : 80;
    const zoom = interpolate(frame, [0, p.seconds * fps], [1, 1.07], clamp);
    return (
      <AbsoluteFill style={{ fontFamily: "Inter, sans-serif", color: C.white, background: C.bgTop }}>
        <div style={{ position: "absolute", top: PANEL, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
          <Img
            src={staticFile(p.photo ?? "ai/b_real.jpg")}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `50% ${p.photoY ?? "0%"}`, scale: zoom, transformOrigin: "50% 30%" }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70, background: `linear-gradient(${C.bgTop}, rgba(5,58,42,0))` }} />
        </div>
        <AbsoluteFill style={{ clipPath: `inset(0 0 ${1920 - PANEL}px 0)` }}>
          <Bg tone={p.tone} />
        </AbsoluteFill>
        <Brand />
        {p.ai !== false && (
          <div
            style={{
              ...appear(frame, 6, 10),
              position: "absolute",
              top: PANEL + 26,
              right: 36,
              background: "rgba(0,0,0,0.5)",
              border: "2px solid rgba(255,255,255,0.7)",
              color: C.white,
              fontSize: 30,
              fontWeight: 700,
              padding: "8px 20px",
              borderRadius: 999,
            }}
          >
            ✦ AI průvodkyně
          </div>
        )}
        <div style={{ position: "absolute", top: 178, left: 80, right: 80 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ ...appear(frame, 3 + i * 5), fontSize: size, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1.5, marginBottom: 6 }}>
              <Marked text={l} frame={frame} start={3 + i * 5} />
            </div>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  // cta
  return (
    <Frame tone={p.tone}>
      {(p.lines ?? []).map((l, i) => (
        <div key={i} style={{ ...appear(frame, 2 + i * 5), fontSize: 84, fontWeight: 900, lineHeight: 1.08, letterSpacing: -2, marginBottom: 12 }}>
          <Marked text={l} frame={frame} start={2 + i * 5} />
        </div>
      ))}
      {p.share && (
        <div
          style={{
            ...appear(frame, 16),
            marginTop: 40,
            alignSelf: "flex-start",
            background: C.sun,
            color: C.ink,
            fontSize: 50,
            fontWeight: 900,
            padding: "26px 36px",
            borderRadius: 28,
            lineHeight: 1.15,
            rotate: interpolate(frame, [16, 26], ["-4deg", "-1.5deg"], { ...clamp, easing: ease }),
          }}
        >
          ➜ {p.share}
        </div>
      )}
      {p.url && <div style={{ ...appear(frame, 24), marginTop: 44, fontSize: 52, fontWeight: 800, color: C.soft }}>{p.url}</div>}
    </Frame>
  );
};
