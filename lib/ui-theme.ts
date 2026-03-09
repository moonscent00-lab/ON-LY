"use client";

import { useEffect, useState } from "react";

export type MoodTheme = "neutral" | "coral" | "yellow" | "blue";
export type AccentTone = "neutral" | "coral" | "yellow" | "blue";

export const THEME_STORAGE_KEY = "diary-os.theme.v1";
export const ACCENT_STORAGE_KEY = "diary-os.accent.v1";
export const CALLOUT_BG_STORAGE_KEY = "diary-os.callout-bg.v1";
export const UI_THEME_CHANGED_EVENT = "diary-os:theme-changed";

type UiThemeSettings = {
  theme: MoodTheme;
  accentTone: AccentTone;
  calloutBackground: string;
};

function parseTheme(value: string | null): MoodTheme {
  return value === "neutral" || value === "coral" || value === "yellow" || value === "blue"
    ? value
    : "neutral";
}

function parseAccent(value: string | null): AccentTone {
  return value === "neutral" || value === "coral" || value === "yellow" || value === "blue"
    ? value
    : "neutral";
}

export function readUiThemeSettings(): UiThemeSettings {
  if (typeof window === "undefined") {
    return { theme: "neutral", accentTone: "neutral", calloutBackground: "" };
  }
  return {
    theme: parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY)),
    accentTone: parseAccent(window.localStorage.getItem(ACCENT_STORAGE_KEY)),
    calloutBackground: window.localStorage.getItem(CALLOUT_BG_STORAGE_KEY) ?? "",
  };
}

export function writeUiThemeSettings(next: Partial<UiThemeSettings>) {
  if (typeof window === "undefined") return;
  const current = readUiThemeSettings();
  const merged: UiThemeSettings = {
    theme: next.theme ?? current.theme,
    accentTone: next.accentTone ?? current.accentTone,
    calloutBackground: next.calloutBackground ?? current.calloutBackground,
  };
  window.localStorage.setItem(THEME_STORAGE_KEY, merged.theme);
  window.localStorage.setItem(ACCENT_STORAGE_KEY, merged.accentTone);
  window.localStorage.setItem(CALLOUT_BG_STORAGE_KEY, merged.calloutBackground);
  window.dispatchEvent(new Event(UI_THEME_CHANGED_EVENT));
}

export function useUiThemeSettings() {
  const [settings, setSettings] = useState<UiThemeSettings>(() => readUiThemeSettings());

  useEffect(() => {
    const sync = () => setSettings(readUiThemeSettings());
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (
        event.key === THEME_STORAGE_KEY ||
        event.key === ACCENT_STORAGE_KEY ||
        event.key === CALLOUT_BG_STORAGE_KEY
      ) {
        sync();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(UI_THEME_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(UI_THEME_CHANGED_EVENT, sync);
    };
  }, []);

  return {
    ...settings,
    setTheme: (theme: MoodTheme) => writeUiThemeSettings({ theme }),
    setAccentTone: (accentTone: AccentTone) => writeUiThemeSettings({ accentTone }),
    setCalloutBackground: (calloutBackground: string) => writeUiThemeSettings({ calloutBackground }),
  };
}
