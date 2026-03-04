"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Download, X, Share, PlusSquare } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PromptMode = "chrome" | "ios" | null;

const DISMISS_KEY = "kleen-pwa-dismiss";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function saveDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // storage unavailable
  }
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isInStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  );
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<PromptMode>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isInStandalone() || wasDismissedRecently()) return;

    // Chrome / Edge — catches the native install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("chrome");
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari — no event, detect manually after a short delay
    const iosTimer = setTimeout(() => {
      if (
        isIOS() &&
        !isInStandalone() &&
        !wasDismissedRecently() &&
        "serviceWorker" in navigator
      ) {
        setMode("ios");
        setShow(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(iosTimer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    saveDismiss();
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm sm:left-auto">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-600/25">
            <Image
              src="/images/kleen-logo.svg"
              alt="KLEEN"
              width={28}
              height={28}
              className="h-7 w-auto brightness-0 invert"
            />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Install KLEEN</p>
            <p className="text-xs text-slate-500">
              {mode === "ios"
                ? "Add to your home screen for the best experience"
                : "Get quick access from your home screen"}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chrome / Edge — single install button */}
        {mode === "chrome" && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
            <button
              onClick={handleInstall}
              className="btn-primary w-full gap-2 py-2.5 text-sm"
            >
              <Download className="h-4 w-4" />
              Install App
            </button>
          </div>
        )}

        {/* iOS Safari — step-by-step instructions */}
        {mode === "ios" && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                  1
                </div>
                <p className="text-sm text-slate-600">
                  Tap the{" "}
                  <Share className="inline h-4 w-4 text-blue-500" />{" "}
                  <span className="font-medium text-slate-900">Share</span> button
                  in Safari
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                  2
                </div>
                <p className="text-sm text-slate-600">
                  Scroll down and tap{" "}
                  <PlusSquare className="inline h-4 w-4 text-slate-700" />{" "}
                  <span className="font-medium text-slate-900">
                    Add to Home Screen
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                  3
                </div>
                <p className="text-sm text-slate-600">
                  Tap{" "}
                  <span className="font-medium text-slate-900">Add</span> to
                  install
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="mt-3 w-full rounded-xl py-2 text-center text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
            >
              Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
