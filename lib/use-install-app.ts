"use client";

import { useSyncExternalStore } from "react";

// Chrome/Edge fire `beforeinstallprompt` once, early, and only if it's
// captured then can the page offer its own "Instalar" button later — so the
// listener lives at module level (loaded with the NavBar on every page)
// instead of inside whichever component wants the button, which may mount
// long after the event fired. Safari never fires it (macOS installs via
// Compartir → Añadir al Dock), so there canInstall stays false and the
// settings guide covers that path in words instead.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let started = false;

function emit() {
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

start();

function subscribePrompt(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribeStandalone(listener: () => void) {
  const mq = window.matchMedia(STANDALONE_QUERY);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

function getStandalone() {
  // navigator.standalone is iOS Safari's own flag for a home-screen web app.
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstallApp() {
  const prompt = useSyncExternalStore(
    subscribePrompt,
    () => deferredPrompt,
    () => null
  );
  const isInstalled = useSyncExternalStore(subscribeStandalone, getStandalone, () => false);

  async function install() {
    if (!deferredPrompt) return;
    const event = deferredPrompt;
    await event.prompt();
    await event.userChoice;
    // The browser only lets a captured prompt be used once.
    deferredPrompt = null;
    emit();
  }

  return { canInstall: prompt != null && !isInstalled, isInstalled, install };
}
