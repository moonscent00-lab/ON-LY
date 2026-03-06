"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useEffect, useState } from "react";

const ROUTINE_STORAGE_KEY = "diary-os.routines.v2";
const ARCHIVE_STORAGE_KEY = "diary-os.archive.v1";
const RESET_DONE_KEY = "diary-os.reset.keep-routine-book.v1";
const THEME_STORAGE_KEY = "diary-os.theme.v1";
const ACCENT_STORAGE_KEY = "diary-os.accent.v1";
const CALLOUT_BG_STORAGE_KEY = "diary-os.callout-bg.v1";

type MoodTheme = "neutral" | "coral" | "yellow" | "blue";
type AccentTone = "neutral" | "coral" | "yellow" | "blue";

const themePalette: Record<MoodTheme, { label: string; accent: string; soft: string }> = {
  neutral: { label: "뉴트럴", accent: "#9ca3af", soft: "#eceff3" },
  coral: { label: "코랄", accent: "#f29b8f", soft: "#fde8e4" },
  yellow: { label: "옐로우", accent: "#e7c97a", soft: "#f8efcf" },
  blue: { label: "블루", accent: "#8fb6e8", soft: "#e7f0fd" },
};

const accentPalette: Record<AccentTone, { label: string; accent: string; soft: string }> = {
  neutral: { label: "뉴트럴", accent: "#9ca3af", soft: "#eceff3" },
  coral: { label: "코랄", accent: "#f29b8f", soft: "#fde8e4" },
  yellow: { label: "옐로우", accent: "#e7c97a", soft: "#f8efcf" },
  blue: { label: "블루", accent: "#8fb6e8", soft: "#e7f0fd" },
};

function runOneTimeDataReset() {
  if (typeof window === "undefined") return;
  const { localStorage } = window;
  if (localStorage.getItem(RESET_DONE_KEY) === "done") return;

  const routineRaw = localStorage.getItem(ROUTINE_STORAGE_KEY);
  const archiveRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);

  let onlyBooks: any[] = [];
  if (archiveRaw) {
    try {
      const parsed = JSON.parse(archiveRaw);
      if (Array.isArray(parsed)) {
        onlyBooks = parsed.filter((item) => item && item.type === "book");
      }
    } catch {
      onlyBooks = [];
    }
  }

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }

  keys.forEach((key) => {
    if (!key.startsWith("diary-os.")) return;
    if (key === ROUTINE_STORAGE_KEY || key === ARCHIVE_STORAGE_KEY) return;
    localStorage.removeItem(key);
  });

  if (routineRaw) {
    localStorage.setItem(ROUTINE_STORAGE_KEY, routineRaw);
  } else {
    localStorage.removeItem(ROUTINE_STORAGE_KEY);
  }
  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(onlyBooks));
  localStorage.setItem(RESET_DONE_KEY, "done");
}

export default function TopNav() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<MoodTheme>("neutral");
  const [accentTone, setAccentTone] = useState<AccentTone>("neutral");
  const [calloutBackground, setCalloutBackground] = useState("");

  useEffect(() => {
    runOneTimeDataReset();
  }, []);

  function openSettings() {
    if (typeof window === "undefined") {
      setIsSettingsOpen(true);
      return;
    }
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const savedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    const savedCallout = window.localStorage.getItem(CALLOUT_BG_STORAGE_KEY) ?? "";
    setTheme(
      savedTheme === "neutral" || savedTheme === "coral" || savedTheme === "yellow" || savedTheme === "blue"
        ? savedTheme
        : "neutral",
    );
    setAccentTone(
      savedAccent === "neutral" || savedAccent === "coral" || savedAccent === "yellow" || savedAccent === "blue"
        ? savedAccent
        : "neutral",
    );
    setCalloutBackground(savedCallout);
    setIsSettingsOpen(true);
  }

  function applySettings() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accentTone);
    window.localStorage.setItem(CALLOUT_BG_STORAGE_KEY, calloutBackground);
    window.location.reload();
  }

  const items = [
    { href: "/", label: "오늘정리", emoji: "🧭" },
    { href: "/archive", label: "아카이브", emoji: "🗂️" },
    { href: "/vision-board", label: "비전보드", emoji: "🏡" },
    { href: "/weekly-review", label: "통계/회고", emoji: "📊" },
    { href: "/sync", label: "동기화", emoji: "🔄" },
  ] as const;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[#eeeeee] bg-white/85 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2 md:px-5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#dddddd] bg-white text-xs font-medium text-[#444444] shadow-sm transition hover:bg-[#f7f8fa] md:h-auto md:w-auto md:gap-1 md:px-2 md:py-1"
              aria-label={item.label}
              title={item.label}
            >
              <span className="text-sm">{item.emoji}</span>
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={openSettings}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#dddddd] bg-white text-xs font-medium text-[#444444] shadow-sm transition hover:bg-[#f7f8fa] md:h-auto md:w-auto md:gap-1 md:px-2 md:py-1"
              aria-label="설정"
              title="설정"
            >
              <span className="text-sm">⚙️</span>
              <span className="hidden md:inline">설정</span>
            </button>
            <Link
              href="/login"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#dddddd] bg-[#f4f7ff] text-xs font-medium text-[#444444] shadow-sm transition hover:bg-[#ebf1ff] md:h-auto md:w-auto md:gap-1 md:px-2 md:py-1"
              aria-label="로그인"
              title="로그인"
            >
              <span className="text-sm">🔐</span>
              <span className="hidden md:inline">로그인</span>
            </Link>
          </div>
        </nav>
      </header>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-[10010] overflow-y-auto bg-black/30 p-3">
          <div className="mx-auto mt-4 w-full max-w-xl">
            <div className="w-full rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#444444]">⚙ 설정</h3>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  닫기
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-[#444444]">콜아웃 배경 이미지 URL</p>
                  <input
                    value={calloutBackground}
                    onChange={(e) => setCalloutBackground(e.target.value)}
                    placeholder="https://... (비우면 기본)"
                    className="w-full rounded-md border border-[#dddddd] bg-white px-2 py-1 text-sm outline-none focus:border-[#9ca3af]"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-[#444444]">배경 컬러</p>
                  <div className="grid grid-cols-4 gap-1">
                    {(Object.keys(themePalette) as MoodTheme[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTheme(key)}
                        className="rounded-md border px-2 py-1 text-[11px] font-medium text-[#444444]"
                        style={{
                          borderColor: themePalette[key].accent,
                          backgroundColor: theme === key ? themePalette[key].soft : "#ffffff",
                        }}
                      >
                        {themePalette[key].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-[#444444]">포인트 컬러</p>
                  <div className="grid grid-cols-4 gap-1">
                    {(Object.keys(accentPalette) as AccentTone[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAccentTone(key)}
                        className="rounded-md border px-2 py-1 text-[11px] font-medium text-[#444444]"
                        style={{
                          borderColor: accentPalette[key].accent,
                          backgroundColor: accentTone === key ? accentPalette[key].soft : "#ffffff",
                        }}
                      >
                        {accentPalette[key].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-transparent bg-[#e5e7eb] px-2 py-1 text-xs font-medium text-[#444444]"
                    onClick={applySettings}
                  >
                    적용
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
