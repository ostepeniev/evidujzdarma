"use client";

import { useEffect, useState } from "react";
import { OPEN_SETTINGS_EVENT, PREVIEW_PARAM, PREVIEW_VALUE } from "@/lib/consent";
import { TRACKING, configuredTracking, type TrackingConfig } from "@/lib/tracking-config";

/**
 * S4-COOKIES: „Nastavení cookies“ v patičce – souhlas jde kdykoli změnit nebo odvolat (čl. 7 odst. 3 GDPR).
 * Jen když je zapnutá aspoň jedna značka (nebo v náhledu ?cookies=preview); jinak není co nastavovat.
 */
export function CookieSettingsButton({ config = TRACKING }: { config?: TrackingConfig }) {
  const [show, setShow] = useState(configuredTracking(config).any);
  useEffect(() => {
    if (!show && new URLSearchParams(window.location.search).get(PREVIEW_PARAM) === PREVIEW_VALUE) setShow(true);
  }, [show]);
  if (!show) return null;
  return (
    <li>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
        className="text-left text-sm text-ink-soft hover:text-brand-700"
        data-cookie-settings-button="true"
      >
        Nastavení cookies
      </button>
    </li>
  );
}
