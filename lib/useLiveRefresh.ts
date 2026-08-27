"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Subscribes to a Supabase Realtime broadcast channel and calls
// router.refresh() whenever a ping arrives — keeps the agenda in sync with
// appointments booked from the public booking page (or from another open
// tab) without polling. Pass channel=null to skip subscribing (e.g. before
// the tenant id is known yet).
export function useLiveRefresh(channel: string | null, event: string) {
  const router = useRouter();

  useEffect(() => {
    if (!channel) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);
    const ch = supabase.channel(channel);
    ch.on("broadcast", { event }, () => router.refresh()).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, event]);
}
