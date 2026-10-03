import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Bezpečné vykreslení inline syntaxe: **tučně** a [text](url). Nic jiného (žádné HTML).
 * Interní odkazy (začínající "/") jdou přes next/link, externí dostanou rel="noopener".
 */
export function RichText({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={i++}>{m[1]}</strong>);
    } else {
      const label = m[2]!;
      const href = m[3]!;
      // „//host“ i „/\host“ (prohlížeč ho čte jako „//host“) je odkaz na cizí doménu, ne interní cesta (B Дрібне 16, Д3-3)
      if (href.startsWith("/") && !/^\/[\\/]/.test(href)) {
        out.push(
          <Link key={i++} href={href}>
            {label}
          </Link>,
        );
      } else if (/^https:\/\//.test(href)) {
        out.push(
          <a key={i++} href={href} rel="noopener" target="_blank">
            {label}
          </a>,
        );
      } else {
        out.push(label);
      }
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Prostý text bez syntaxe — pro meta a strukturovaná data. */
export function plainText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
