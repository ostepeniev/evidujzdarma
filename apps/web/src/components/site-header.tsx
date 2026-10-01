import Link from "next/link";
import { NAV, SITE } from "@/lib/site";
import { Logo } from "./logo";

export function IndependenceBar() {
  return (
    <div className="border-b border-line bg-surface text-center text-xs text-ink-soft sm:text-sm">
      <p className="container-page py-1.5">
        <strong className="font-semibold">{SITE.independenceNotice}</strong>{" "}
        <span className="hidden sm:inline">
          Oficiální informace najdete na{" "}
          <a className="underline underline-offset-2" href="https://eet.gov.cz" rel="noopener">
            eet.gov.cz
          </a>
          .
        </span>
      </p>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="no-print">
      <IndependenceBar />
      <div className="border-b border-line bg-white/90 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label={`${SITE.name} – úvod`}>
            <Logo />
          </Link>
          <nav aria-label="Hlavní navigace" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-[15px] font-medium text-ink-soft hover:bg-surface hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/pokladna" className="hidden rounded-lg px-3 py-2 text-[15px] font-medium text-ink-soft hover:bg-surface sm:inline-flex">
              Pokladna
            </Link>
            <Link href="/#registrace" className="btn-primary px-4 py-2 text-[15px]">
              Chci zdarma
            </Link>
          </div>
        </div>
        <nav aria-label="Navigace" className="container-page -mt-1 flex gap-1 overflow-x-auto pb-2 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:bg-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
