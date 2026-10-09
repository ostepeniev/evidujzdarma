import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_API, guardApiRequest } from "@/lib/server/request-guard";

/**
 * Přísná CSP s nonce pro citlivé stránky (R3.9): pokladna, účtenky, přihlášení, kabinet, pozvánky a adminský kabinet (R15.2).
 * Bez 'unsafe-inline' ve script-src a bez možnosti vložit stránku do rámu. Ostatní stránky mají
 * globální CSP z next.config.ts (statické stránky nonce mít nemohou).
 */
export const STRICT_CSP_PATHS = ["/pokladna", "/u/", "/prihlaseni", "/kabinet", "/pozvanka/", "/admin"] as const;

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

/** API: limit těla, původ a formát u session API (Н2-2, B Дрібне 1); účetní data se nekešují (B Дрібне 13). */
function apiProxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const refused = guardApiRequest(request, path);
  if (refused) return refused;
  const response = NextResponse.next();
  if (COOKIE_API.test(path)) response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return apiProxy(request);
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
    "/api/:path*",
    {
      source: "/(pokladna|u|prihlaseni|kabinet|pozvanka|admin)/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/(pokladna|prihlaseni|kabinet|admin)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
