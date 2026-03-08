"use client";

import { useEffect, useRef } from "react";
import {
  bootstrapCloudState,
  getPreferredSyncEmail,
  runSmartSync,
} from "@/lib/cloud-sync";

const RELOAD_ONCE_KEY = "diary-os.cloud-boot.reloaded.v1";

export default function CloudAutoSyncGate() {
  const bootedRef = useRef(false);
  const syncingRef = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  useEffect(() => {
    if (bootedRef.current) return;
    if (!supabaseUrl || !supabaseAnon) return;
    const email = getPreferredSyncEmail();
    if (!email) return;
    bootedRef.current = true;

    const silentSync = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        await runSmartSync({ userEmail: email, supabaseUrl, supabaseAnon });
      } catch {
        // keep background sync silent
      } finally {
        syncingRef.current = false;
      }
    };

    const bootstrap = async () => {
      try {
        const result = await bootstrapCloudState({ userEmail: email, supabaseUrl, supabaseAnon });
        if (
          result.action === "pulled" &&
          typeof window !== "undefined" &&
          !sessionStorage.getItem(RELOAD_ONCE_KEY)
        ) {
          sessionStorage.setItem(RELOAD_ONCE_KEY, "1");
          window.location.reload();
          return;
        }
      } catch {
        // ignore bootstrap errors and continue with background sync
      }
      void silentSync();
    };

    void bootstrap();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void silentSync();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const timer = window.setInterval(() => {
      void silentSync();
    }, 1000 * 60 * 5);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [supabaseUrl, supabaseAnon]);

  return null;
}
