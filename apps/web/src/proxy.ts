import { NextResponse, type NextRequest } from "next/server";

/**
 * Přísná CSP s nonce pro citlivé stránky (R3.9): pokladna, účtenky, přihlášení, kabinet a pozvánky.
 * Bez 'unsafe-inline' ve script-src a bez možnosti vložit stránku do rámu. Ostatní stránky mají
 * globální CSP z next.config.ts (statické stránky nonce mít nemohou).
 */
export const STRICT_CSP_PATHS = ["/pokladna", "/u/", "/prihlaseni", "/kabinet", "/pozvanka/"] as const;

const isStrict = (path: string) => STRICT_CSP_PATHS.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)));

export function strictCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // atributy style= používá React; skripty jsou to, co nonce chrání
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  if (!isStrict(request.nextUrl.pathname)) return NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = strictCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js z hlavičky požadavku vyčte nonce a doplní ho ke svým skriptům
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/(pokladna|u|prihlaseni|kabinet|pozvanka)/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/(pokladna|prihlaseni|kabinet)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
