"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const COOKIE_CONSENT_KEY = "kleen_cookie_consent";
export type CookieConsentValue = "essential" | "all";

export function getStoredCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (v === "essential" || v === "all") return v;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(/(?:^|;\s*)kleen_cookie_consent=(essential|all)/);
  return (match?.[1] as CookieConsentValue) || null;
}

export function analyticsAllowed(): boolean {
  return getStoredCookieConsent() === "all";
}

function persistConsent(value: CookieConsentValue) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `kleen_cookie_consent=${value};path=/;max-age=${maxAge};SameSite=Lax`;
  window.dispatchEvent(new CustomEvent("kleen-cookie-consent", { detail: value }));
}

/**
 * PECR-style banner. Essential cookies always on; analytics only if user accepts.
 * Hook future analytics SDKs to `analyticsAllowed()` / the custom event.
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getStoredCookieConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (value: CookieConsentValue) => {
    persistConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur sm:p-5"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Cookies</p>
          <p className="mt-1 leading-relaxed">
            We use essential cookies to keep you signed in and secure. Optional analytics help us improve
            Kleen and are used only if you accept.{" "}
            <Link href="/cookies" className="font-medium text-brand-600 underline">
              Cookie policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => choose("essential")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
