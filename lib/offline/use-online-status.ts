"use client";

import { useEffect, useState } from "react";

// Starts true to match server-rendered markup (navigator doesn't exist
// during SSR) — corrected immediately on mount via the effect below, so the
// only inaccurate window is the instant before hydration.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
