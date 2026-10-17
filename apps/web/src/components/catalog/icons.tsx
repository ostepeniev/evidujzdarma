import type { ReactNode } from "react";

/**
 * Ikony katalogu firem (S3) – vlastní jednoduché inline SVG (obrysy 24×24, barva z currentColor), žádná knihovna ani
 * externí soubor. Dekorativní: aria-hidden, význam nese text vedle.
 */
function Svg({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

type P = { className?: string };

export const IconBuilding = ({ className }: P) => (
  <Svg className={className}>
    <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
    <path d="M15 9h4a1 1 0 0 1 1 1v11" />
    <path d="M3 21h18M8 8h3M8 12h3M8 16h3" />
  </Svg>
);

export const IconId = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 10h4M7 14h6M15.5 10.5h2" />
  </Svg>
);

export const IconPin = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);

export const IconCalendar = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const IconScale = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 4v16M7 20h10M5 8h14" />
    <path d="M5 8l-2.5 6a3 3 0 0 0 5 0L5 8zM19 8l-2.5 6a3 3 0 0 0 5 0L19 8z" />
  </Svg>
);

export const IconPercent = ({ className }: P) => (
  <Svg className={className}>
    <path d="M19 5L5 19" />
    <circle cx="7" cy="7" r="2.2" />
    <circle cx="17" cy="17" r="2.2" />
  </Svg>
);

export const IconInvoice = ({ className }: P) => (
  <Svg className={className}>
    <path d="M6 3h9l4 4v14l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V4a1 1 0 0 1 1-1z" />
    <path d="M9 9h6M9 13h6M9 17h3" />
  </Svg>
);

export const IconCopy = ({ className }: P) => (
  <Svg className={className}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </Svg>
);

export const IconCheck = ({ className }: P) => (
  <Svg className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const IconQr = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
    <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" />
  </Svg>
);

export const IconShield = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);

export const IconReceipt = ({ className }: P) => (
  <Svg className={className}>
    <path d="M7 3h10v18l-2-1.3-1.5 1.3-1.5-1.3-1.5 1.3L9 19.7 7 21V3z" />
    <path d="M10 8h4M10 12h4" />
  </Svg>
);

export const IconSearch = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
);

export const IconStore = ({ className }: P) => (
  <Svg className={className}>
    <path d="M4 9.5V20h16V9.5" />
    <path d="M3 9.5l2-5.5h14l2 5.5a2.5 2.5 0 0 1-4.5 1.2 2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0A2.5 2.5 0 0 1 3 9.5z" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const IconUser = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);

export const IconSparkle = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </Svg>
);

export const IconArrow = ({ className = "h-4 w-4" }: P) => (
  <Svg className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const IconExternal = ({ className = "h-4 w-4" }: P) => (
  <Svg className={className}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);
