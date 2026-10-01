import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "180" }];
}

/** PNG ikony pro PWA manifest a iOS (vykreslené z loga, bez externích souborů). */
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = [180, 192, 512].includes(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0b7a57", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={size * 0.78} height={size * 0.78} viewBox="6 5 20 22">
          <path d="M10 7.5h12a1.5 1.5 0 0 1 1.5 1.5v15.6l-2.25-1.4-2.25 1.4-2.25-1.4-2.25 1.4-2.25-1.4-2.25 1.4V9A1.5 1.5 0 0 1 10 7.5Z" fill="#fff" />
          <path d="m12.6 15.6 2.4 2.4 4.6-5" fill="none" stroke="#0b7a57" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=31536000, immutable" } },
  );
}
