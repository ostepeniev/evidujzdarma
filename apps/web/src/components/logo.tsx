export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  // Účtenka s fajfkou — vlastní symbol, žádná státní symbolika.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0b7a57" />
      <path
        d="M10 7.5h12a1.5 1.5 0 0 1 1.5 1.5v15.6l-2.25-1.4-2.25 1.4-2.25-1.4-2.25 1.4-2.25-1.4-2.25 1.4V9A1.5 1.5 0 0 1 10 7.5Z"
        fill="#fff"
      />
      <path d="m12.6 15.6 2.4 2.4 4.6-5" fill="none" stroke="#0b7a57" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-ink">
        Eviduj<span className="text-brand-600">Zdarma</span>
      </span>
    </span>
  );
}
