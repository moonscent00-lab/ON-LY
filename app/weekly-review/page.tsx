"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

type OneThing = {
  title: string;
  next: string;
  keepGoing: string;
};

type RoutineGroup = "morning" | "day" | "night";
type RoutineRecord = {
  id: string;
  text: string;
  group: RoutineGroup;
  completed: boolean;
};

type DailyReport = {
  date: string;
  createdAt: string;
  oneThing: OneThing;
  good: string;
  problem: string;
  tryNext: string;
  todoDone: number;
  todoTotal: number;
  routineDone: number;
  routineTotal: number;
  progressPercent: number;
  momentum: number;
  routineRecords?: RoutineRecord[];
};

type PeriodType = "week" | "month" | "year";
type PeriodReflection = {
  periodType: PeriodType;
  periodKey: string;
  good: string;
  problem: string;
  tryNext: string;
  summary: string;
  nextActions: string;
  updatedAt: string;
};

type MoodTheme = "neutral" | "coral" | "yellow" | "blue";
type AccentTone = "neutral" | "coral" | "yellow" | "blue";

const REPORT_STORAGE_KEY = "diary-os.daily-reports.v1";
const PERIOD_REFLECTION_STORAGE_KEY = "diary-os.period-reflections.v1";
const THEME_STORAGE_KEY = "diary-os.theme.v1";
const ACCENT_STORAGE_KEY = "diary-os.accent.v1";
const CALLOUT_BG_STORAGE_KEY = "diary-os.callout-bg.v1";

const themePalette: Record<
  MoodTheme,
  {
    background: string;
    vars: Record<string, string>;
  }
> = {
  neutral: {
    background:
      "linear-gradient(180deg,#f4f5f7 0%,#eceff2 100%), radial-gradient(circle at 20% 0%,#ffffff 0%,transparent 50%)",
    vars: { "--line": "#eeeeee" },
  },
  coral: {
    background:
      "linear-gradient(180deg,#fff5f3 0%,#fbe9e5 100%), radial-gradient(circle at 80% 0%,#fffaf7 0%,transparent 45%)",
    vars: { "--line": "#eeeeee" },
  },
  yellow: {
    background:
      "linear-gradient(180deg,#fff9ec 0%,#f6f0de 100%), radial-gradient(circle at 10% 0%,#fffdf5 0%,transparent 48%)",
    vars: { "--line": "#eeeeee" },
  },
  blue: {
    background:
      "linear-gradient(180deg,#f2f7ff 0%,#e6eef9 100%), radial-gradient(circle at 80% 0%,#f8fbff 0%,transparent 46%)",
    vars: { "--line": "#eeeeee" },
  },
};

const accentPalette: Record<AccentTone, { accent: string; soft: string }> = {
  neutral: { accent: "#9ca3af", soft: "#eceff3" },
  coral: { accent: "#f29b8f", soft: "#fde8e4" },
  yellow: { accent: "#e7c97a", soft: "#f8efcf" },
  blue: { accent: "#8fb6e8", soft: "#e7f0fd" },
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getStoredReports() {
  if (typeof window === "undefined") return [];
  return parseJson<DailyReport[]>(window.localStorage.getItem(REPORT_STORAGE_KEY), []);
}

function getStoredReflections() {
  if (typeof window === "undefined") return [];
  return parseJson<PeriodReflection[]>(window.localStorage.getItem(PERIOD_REFLECTION_STORAGE_KEY), []);
}

function getStoredTheme() {
  if (typeof window === "undefined") return "neutral";
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "neutral" || saved === "coral" || saved === "yellow" || saved === "blue"
    ? saved
    : "neutral";
}

function getStoredAccent() {
  if (typeof window === "undefined") return "neutral";
  const saved = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return saved === "neutral" || saved === "coral" || saved === "yellow" || saved === "blue"
    ? saved
    : "neutral";
}

function getStoredCalloutBackground() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CALLOUT_BG_STORAGE_KEY) ?? "";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(date: string, amount: number) {
  const target = new Date(`${date}T00:00:00`);
  target.setDate(target.getDate() + amount);
  return target.toISOString().slice(0, 10);
}

function shiftMonth(date: string, amount: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setMonth(d.getMonth() + amount);
  return d.toISOString().slice(0, 10);
}

function shiftYear(date: string, amount: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setFullYear(d.getFullYear() + amount);
  return d.toISOString().slice(0, 10);
}

function toKoreanDate(date: string) {
  return new Date(date).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

function toKoreanDateTime(dateTime: string) {
  return new Date(dateTime).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getWeekStart(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function monthRange(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function yearRange(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const start = new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10);
  return { start, end };
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function yearKey(date: string) {
  return date.slice(0, 4);
}

function WeeklyReviewPage() {
  const today = todayKey();
  const [reports] = useState<DailyReport[]>(getStoredReports);
  const [periodTab, setPeriodTab] = useState<PeriodType>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [periodReflections, setPeriodReflections] = useState<PeriodReflection[]>(getStoredReflections);
  const [periodDrafts, setPeriodDrafts] = useState<
    Record<string, { good: string; problem: string; tryNext: string; summary: string; nextActions: string }>
  >({});

  const [theme] = useState<MoodTheme>(getStoredTheme);
  const [accentTone] = useState<AccentTone>(getStoredAccent);
  const [calloutBackground] = useState(getStoredCalloutBackground);

  useEffect(() => {
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);
  useEffect(() => {
    localStorage.setItem(PERIOD_REFLECTION_STORAGE_KEY, JSON.stringify(periodReflections));
  }, [periodReflections]);

  const weekBaseDate = useMemo(() => shiftDate(today, -weekOffset * 7), [today, weekOffset]);
  const activeWeekStart = useMemo(() => getWeekStart(weekBaseDate), [weekBaseDate]);
  const monthBaseDate = useMemo(() => shiftMonth(today, -monthOffset), [today, monthOffset]);
  const yearBaseDate = useMemo(() => shiftYear(today, -yearOffset), [today, yearOffset]);
  const activeMonthRange = useMemo(() => monthRange(monthBaseDate), [monthBaseDate]);
  const activeYearRange = useMemo(() => yearRange(yearBaseDate), [yearBaseDate]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDate(activeWeekStart, index)),
    [activeWeekStart],
  );

  const reportByDate = useMemo(() => {
    const map = new Map<string, DailyReport>();
    reports.forEach((item) => map.set(item.date, item));
    return map;
  }, [reports]);

  const weeklyReports = useMemo(
    () => weekDates.map((date) => reportByDate.get(date) ?? null),
    [weekDates, reportByDate],
  );

  const currentPeriodReports = useMemo(() => {
    if (periodTab === "week") {
      return weeklyReports.filter((item): item is DailyReport => item !== null);
    }
    if (periodTab === "month") {
      return reports.filter(
        (item) => item.date >= activeMonthRange.start && item.date <= activeMonthRange.end,
      );
    }
    return reports.filter(
      (item) => item.date >= activeYearRange.start && item.date <= activeYearRange.end,
    );
  }, [periodTab, weeklyReports, reports, activeMonthRange, activeYearRange]);

  const periodSummary = useMemo(() => {
    if (currentPeriodReports.length === 0) {
      return { savedDays: 0, avgProgress: 0, avgMomentum: 0, todoRate: 0, routineRate: 0 };
    }
    const todoDone = currentPeriodReports.reduce((sum, item) => sum + item.todoDone, 0);
    const todoTotal = currentPeriodReports.reduce((sum, item) => sum + item.todoTotal, 0);
    const routineDone = currentPeriodReports.reduce((sum, item) => sum + item.routineDone, 0);
    const routineTotal = currentPeriodReports.reduce((sum, item) => sum + item.routineTotal, 0);
    return {
      savedDays: currentPeriodReports.length,
      avgProgress: Math.round(
        currentPeriodReports.reduce((sum, item) => sum + item.progressPercent, 0) /
          currentPeriodReports.length,
      ),
      avgMomentum: Math.round(
        (currentPeriodReports.reduce((sum, item) => sum + item.momentum, 0) /
          currentPeriodReports.length) *
          10,
      ) / 10,
      todoRate: todoTotal > 0 ? Math.round((todoDone / todoTotal) * 100) : 0,
      routineRate: routineTotal > 0 ? Math.round((routineDone / routineTotal) * 100) : 0,
    };
  }, [currentPeriodReports]);

  const weeklyAdvice = useMemo(() => {
    if (periodTab !== "week") return "";
    if (periodSummary.savedDays <= 2) {
      return "저장일이 적어요. 오늘부터 3일 연속으로 리포트 저장부터 다시 시작하세요.";
    }
    if (periodSummary.avgProgress < 40) {
      return "진행률이 낮아요. 내일은 OneThing 1개만 완료하는 미니 승리로 리듬부터 살리세요.";
    }
    if (periodSummary.todoRate < periodSummary.routineRate) {
      return "투두 완료율이 루틴보다 낮아요. 아침 1시간에 투두 1개를 먼저 끝내고 루틴으로 넘어가세요.";
    }
    if (periodSummary.routineRate < 50) {
      return "루틴 유지가 흔들려요. 모닝 루틴 1개만 고정해서 연속 체크를 먼저 만드세요.";
    }
    return "좋아요. 지금 페이스 유지하면서 다음 주 목표를 1단계만 상향해 보세요.";
  }, [periodSummary, periodTab]);

  const monthlyAdvice = useMemo(() => {
    if (periodTab !== "month") return "";
    if (periodSummary.savedDays < 10) {
      return "저장일이 적어요. 다음 달은 주 3회 이상 리포트 저장을 먼저 고정하세요.";
    }
    if (periodSummary.avgProgress < 50) {
      return "진행률이 낮아요. 월 목표를 2개 줄이고 핵심 루틴 1개를 우선 고정하세요.";
    }
    if (periodSummary.todoRate < periodSummary.routineRate) {
      return "투두 완료율이 낮아요. 매일 아침 첫 30분을 투두 1개 전용 블록으로 고정하세요.";
    }
    return "좋아요. 다음 달은 유지 루틴 1개 + 도전 루틴 1개만 추가해 밀도를 높이세요.";
  }, [periodSummary, periodTab]);

  const routineWeeklyRows = useMemo(() => {
    const map = new Map<string, { name: string; group: RoutineGroup; days: number[]; rate: number }>();
    weekDates.forEach((date, dayIndex) => {
      const report = reportByDate.get(date);
      (report?.routineRecords ?? []).forEach((record) => {
        const key = `${record.group}::${record.text}`;
        if (!map.has(key)) {
          map.set(key, {
            name: record.text,
            group: record.group,
            days: Array(7).fill(-1),
            rate: 0,
          });
        }
        const row = map.get(key);
        if (row) row.days[dayIndex] = record.completed ? 1 : 0;
      });
    });

    return [...map.values()]
      .map((item) => {
        const hasData = item.days.filter((v) => v !== -1);
        const done = item.days.filter((v) => v === 1).length;
        return {
          ...item,
          rate: hasData.length > 0 ? Math.round((done / hasData.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  }, [weekDates, reportByDate]);

  const routineSummaryByGroup = useMemo(() => {
    const grouped: Record<RoutineGroup, typeof routineWeeklyRows> = {
      morning: [],
      day: [],
      night: [],
    };
    routineWeeklyRows.forEach((item) => grouped[item.group].push(item));
    return grouped;
  }, [routineWeeklyRows]);

  const monthlyWeekBars = useMemo(() => {
    const buckets = new Map<number, { sum: number; count: number }>();
    currentPeriodReports.forEach((item) => {
      if (periodTab !== "month") return;
      const day = Number(item.date.slice(8, 10));
      const weekIndex = Math.floor((day - 1) / 7) + 1;
      const prev = buckets.get(weekIndex) ?? { sum: 0, count: 0 };
      buckets.set(weekIndex, { sum: prev.sum + item.progressPercent, count: prev.count + 1 });
    });
    return [1, 2, 3, 4, 5].map((weekIndex) => {
      const b = buckets.get(weekIndex);
      const value = b && b.count > 0 ? Math.round(b.sum / b.count) : 0;
      return { label: `${weekIndex}주`, value };
    });
  }, [currentPeriodReports, periodTab]);

  const monthlyRoutineRanking = useMemo(() => {
    if (periodTab !== "month") return { top: [] as Array<{ name: string; rate: number }>, bottom: [] as Array<{ name: string; rate: number }> };
    const map = new Map<string, { done: number; total: number }>();
    currentPeriodReports.forEach((report) => {
      (report.routineRecords ?? []).forEach((record) => {
        const prev = map.get(record.text) ?? { done: 0, total: 0 };
        map.set(record.text, {
          done: prev.done + (record.completed ? 1 : 0),
          total: prev.total + 1,
        });
      });
    });
    const list = [...map.entries()].map(([name, value]) => ({
      name,
      rate: value.total > 0 ? Math.round((value.done / value.total) * 100) : 0,
    }));
    list.sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
    return {
      top: list.slice(0, 3),
      bottom: [...list].reverse().slice(0, 3),
    };
  }, [currentPeriodReports, periodTab]);

  const yearlyMonthBars = useMemo(() => {
    const buckets = new Map<number, { sum: number; count: number }>();
    currentPeriodReports.forEach((item) => {
      if (periodTab !== "year") return;
      const m = Number(item.date.slice(5, 7));
      const prev = buckets.get(m) ?? { sum: 0, count: 0 };
      buckets.set(m, { sum: prev.sum + item.progressPercent, count: prev.count + 1 });
    });
    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const b = buckets.get(month);
      const value = b && b.count > 0 ? Math.round(b.sum / b.count) : 0;
      return { label: `${month}월`, value };
    });
  }, [currentPeriodReports, periodTab]);

  const yearlyScore = useMemo(() => {
    return Math.round((periodSummary.avgProgress + periodSummary.todoRate + periodSummary.routineRate) / 3);
  }, [periodSummary]);

  const yearlyQuarterInsights = useMemo(() => {
    const quarterLabels = ["1분기", "2분기", "3분기", "4분기"];
    const quarterMaps = Array.from({ length: 4 }, () => new Map<string, { done: number; total: number }>());

    currentPeriodReports.forEach((report) => {
      if (periodTab !== "year") return;
      const month = Number(report.date.slice(5, 7));
      const quarterIndex = Math.min(3, Math.floor((month - 1) / 3));
      (report.routineRecords ?? []).forEach((record) => {
        const prev = quarterMaps[quarterIndex].get(record.text) ?? { done: 0, total: 0 };
        quarterMaps[quarterIndex].set(record.text, {
          done: prev.done + (record.completed ? 1 : 0),
          total: prev.total + 1,
        });
      });
    });

    return quarterMaps.map((qMap, idx) => {
      const ranked = [...qMap.entries()]
        .map(([name, val]) => ({
          name,
          rate: val.total > 0 ? Math.round((val.done / val.total) * 100) : 0,
        }))
        .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
      return {
        quarter: quarterLabels[idx],
        best: ranked[0] ? `${ranked[0].name} (${ranked[0].rate}%)` : "-",
        worst: ranked.length > 0 ? `${ranked[ranked.length - 1].name} (${ranked[ranked.length - 1].rate}%)` : "-",
      };
    });
  }, [currentPeriodReports, periodTab]);

  const periodLabel = useMemo(() => {
    if (periodTab === "week") {
      const start = activeWeekStart;
      const end = shiftDate(activeWeekStart, 6);
      return `${start} ~ ${end}`;
    }
    if (periodTab === "month") {
      const d = new Date(`${monthBaseDate}T00:00:00`);
      return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월`;
    }
    return `${yearKey(yearBaseDate)}년`;
  }, [periodTab, activeWeekStart, monthBaseDate, yearBaseDate]);

  const periodKey = useMemo(() => {
    if (periodTab === "week") return activeWeekStart;
    if (periodTab === "month") return monthKey(monthBaseDate);
    return yearKey(yearBaseDate);
  }, [periodTab, activeWeekStart, monthBaseDate, yearBaseDate]);

  const periodDraftKey = `${periodTab}:${periodKey}`;
  const savedPeriodReflection = useMemo(
    () => periodReflections.find((item) => item.periodType === periodTab && item.periodKey === periodKey) ?? null,
    [periodReflections, periodTab, periodKey],
  );

  const activePeriodDraft =
    periodDrafts[periodDraftKey] ?? {
      good: savedPeriodReflection?.good ?? "",
      problem: savedPeriodReflection?.problem ?? "",
      tryNext: savedPeriodReflection?.tryNext ?? "",
      summary: savedPeriodReflection?.summary ?? "",
      nextActions: savedPeriodReflection?.nextActions ?? "",
    };

  function updatePeriodDraft(
    key: "good" | "problem" | "tryNext" | "summary" | "nextActions",
    value: string,
  ) {
    setPeriodDrafts((prev) => ({
      ...prev,
      [periodDraftKey]: {
        good: prev[periodDraftKey]?.good ?? savedPeriodReflection?.good ?? "",
        problem: prev[periodDraftKey]?.problem ?? savedPeriodReflection?.problem ?? "",
        tryNext: prev[periodDraftKey]?.tryNext ?? savedPeriodReflection?.tryNext ?? "",
        summary: prev[periodDraftKey]?.summary ?? savedPeriodReflection?.summary ?? "",
        nextActions: prev[periodDraftKey]?.nextActions ?? savedPeriodReflection?.nextActions ?? "",
        [key]: value,
      },
    }));
  }

  function savePeriodReflection() {
    setPeriodReflections((prev) => {
      const next = prev.filter(
        (item) => !(item.periodType === periodTab && item.periodKey === periodKey),
      );
      next.unshift({
        periodType: periodTab,
        periodKey,
        good: activePeriodDraft.good.trim(),
        problem: activePeriodDraft.problem.trim(),
        tryNext: activePeriodDraft.tryNext.trim(),
        summary: activePeriodDraft.summary.trim(),
        nextActions: activePeriodDraft.nextActions.trim(),
        updatedAt: new Date().toISOString(),
      });
      return next.slice(0, 300);
    });
  }

  const currentTheme = themePalette[theme];
  const currentAccent = accentPalette[accentTone];
  const primaryButtonStyle = { backgroundColor: currentAccent.accent, color: "#444444" };

  const calloutBackdropStyle =
    calloutBackground.trim().length > 0
      ? {
          backgroundImage: `linear-gradient(rgba(255,255,255,0.8), rgba(255,255,255,0.8)), url(${calloutBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined;

  return (
    <div
      className="min-h-screen px-3 py-4 md:px-5 md:py-8"
      style={{
        background: currentTheme.background,
        ...currentTheme.vars,
        "--accent": currentAccent.accent,
        "--accent-soft": currentAccent.soft,
      }}
    >
      <main
        className="mx-auto flex min-h-[calc(100dvh-7.25rem)] max-w-6xl flex-col overflow-visible rounded-lg border border-line bg-surface/95 p-4 text-sm shadow-[0_18px_40px_rgba(20,19,17,0.08)] backdrop-blur-sm md:h-[calc(100dvh-7.25rem)] md:overflow-hidden md:p-5"
        style={
          calloutBackdropStyle ?? {
            backgroundImage:
              "radial-gradient(circle at 10% 10%, rgba(255,255,255,0.8), transparent 35%), radial-gradient(circle at 90% 0%, rgba(255,255,255,0.6), transparent 40%), linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))",
          }
        }
      >
        <section className="rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Review & Analytics</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold md:text-2xl">
                <span className="mr-1 text-2xl align-[-2px]">📊</span>통계/회고
              </h1>
              <p className="text-sm text-[#444444]">하루 마감 리포트를 주/월/연 단위로 누적 확인합니다.</p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
            <div className="flex flex-wrap items-center gap-1">
              {([
                { id: "week", label: "주간" },
                { id: "month", label: "월간" },
                { id: "year", label: "연간" },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriodTab(item.id)}
                  className="rounded-md border border-[#dddddd] px-2 py-1 text-xs text-[#444444]"
                  style={periodTab === item.id ? primaryButtonStyle : { backgroundColor: "#fff" }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                onClick={() => {
                  if (periodTab === "week") setWeekOffset((prev) => prev + 1);
                  if (periodTab === "month") setMonthOffset((prev) => prev + 1);
                  if (periodTab === "year") setYearOffset((prev) => prev + 1);
                }}
              >
                이전
              </button>
              <span className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]">
                {periodLabel}
              </span>
              <button
                type="button"
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                onClick={() => {
                  if (periodTab === "week") setWeekOffset(0);
                  if (periodTab === "month") setMonthOffset(0);
                  if (periodTab === "year") setYearOffset(0);
                }}
              >
                현재
              </button>
            </div>
          </div>

          {reports.length === 0 ? (
            <p className="mt-2 rounded-md border border-[#dddddd] bg-white px-3 py-2 text-xs text-[#444444]">
              저장된 리포트가 없습니다. 오늘정리에서 리포트를 저장하면 통계가 집계됩니다.
            </p>
          ) : null}
        </section>

        <div className={`mt-3 flex flex-1 min-h-0 flex-col gap-3 pr-1 ${periodTab === "year" ? "overflow-hidden" : "overflow-auto"}`}>
        <section className="grid items-stretch gap-2.5 md:grid-cols-2">
          <article className="h-full rounded-lg border border-[#eeeeee] bg-white/80 p-3.5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#444444]">
                <span className="mr-1 text-lg">✍️</span>
                {periodTab === "week" ? "주간" : periodTab === "month" ? "월간" : "연간"} 총평
              </h2>
              <button
                type="button"
                onClick={savePeriodReflection}
                className="rounded-md border border-transparent px-2 py-1 text-xs font-semibold shadow-sm"
                style={primaryButtonStyle}
              >
                회고 저장
              </button>
            </div>
            <div className="grid gap-1.5 md:grid-cols-3">
              <input
                value={activePeriodDraft.good}
                onChange={(e) => updatePeriodDraft("good", e.target.value)}
                placeholder="Good"
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1.5 text-xs"
              />
              <input
                value={activePeriodDraft.problem}
                onChange={(e) => updatePeriodDraft("problem", e.target.value)}
                placeholder="Problem"
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1.5 text-xs"
              />
              <input
                value={activePeriodDraft.tryNext}
                onChange={(e) => updatePeriodDraft("tryNext", e.target.value)}
                placeholder="Try"
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
              <input
                value={activePeriodDraft.summary}
                onChange={(e) => updatePeriodDraft("summary", e.target.value)}
                placeholder="한줄 총평"
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1.5 text-xs"
              />
              <input
                value={activePeriodDraft.nextActions}
                onChange={(e) => updatePeriodDraft("nextActions", e.target.value)}
                placeholder="다음 기간 핵심 액션 3개 (쉼표로 구분)"
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1.5 text-xs"
              />
            </div>
          </article>

          <article className="h-full rounded-lg border border-[#eeeeee] bg-white/80 p-3.5">
            <div className="grid gap-1.5 sm:grid-cols-3">
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#444444]">
                  {periodTab === "week"
                    ? weekOffset === 0
                      ? "이번 주 저장일"
                      : `${weekOffset}주 전 저장일`
                    : periodTab === "month"
                      ? monthOffset === 0
                        ? "이번 달 저장일"
                        : `${monthOffset}개월 전 저장일`
                      : yearOffset === 0
                        ? "올해 저장일"
                        : `${yearOffset}년 전 저장일`}
                </p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.savedDays}일</p>
              </div>
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#444444]">평균 진행률 / 모멘텀</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">
                  {periodSummary.avgProgress}% / {periodSummary.avgMomentum}점
                </p>
              </div>
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#444444]">투두 / 루틴 완료율</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">
                  {periodSummary.todoRate}% / {periodSummary.routineRate}%
                </p>
              </div>
            </div>
            {periodTab === "week" ? (
              <div className="mt-1.5 rounded-md border border-[#dddddd] bg-white p-2">
                <p className="text-xs font-semibold text-rose-600">⚠ {weeklyAdvice}</p>
              </div>
            ) : null}
            {periodTab === "month" ? (
              <div className="mt-1.5 rounded-md border border-[#dddddd] bg-white p-2">
                <p className="text-xs font-semibold text-rose-600">⚠ {monthlyAdvice}</p>
              </div>
            ) : null}
            {periodTab === "year" ? (
              <div className="mt-1.5 rounded-md border border-[#dddddd] bg-white p-2">
                <p className="text-xs font-semibold text-rose-600">⚠ {yearlyScore >= 70 ? "좋은 흐름입니다. 내년은 강점 루틴 1개를 확장하세요." : "핵심 루틴 1개만 정해 90일 연속으로 리듬부터 회복하세요."}</p>
              </div>
            ) : null}
          </article>
        </section>

        {periodTab === "month" ? (
          <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-[#eeeeee] bg-white/80 p-3.5">
            <h2 className="mb-3 text-base font-semibold text-[#444444]">
              <span className="mr-1 text-lg">🧭</span>월간 요약 대시보드
            </h2>

            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#666666]">저장일수</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.savedDays}일</p>
              </div>
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#666666]">평균 진행률</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.avgProgress}%</p>
              </div>
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#666666]">평균 모멘텀</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.avgMomentum}점</p>
              </div>
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#666666]">투두 완료율</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.todoRate}%</p>
              </div>
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#666666]">루틴 완료율</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.routineRate}%</p>
              </div>
            </div>

            <div className="mt-2 grid items-stretch gap-2 md:grid-cols-3">
              <article className="rounded-md border border-[#dddddd] bg-white p-3 md:col-span-2">
                <p className="mb-2 text-sm font-semibold text-[#444444]">주차별 진행률</p>
                <div className="grid grid-cols-5 gap-2">
                  {monthlyWeekBars.map((item) => (
                    <div key={item.label} className="rounded-md border border-[#eeeeee] p-2 text-center">
                      <div
                        className="mx-auto h-10 w-10 rounded-full border border-[#dddddd]"
                        style={{
                          background: `conic-gradient(${currentAccent.accent} ${item.value * 3.6}deg, #eeeeee 0deg)`,
                        }}
                      >
                        <div className="m-[4px] flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#444444]">
                          {item.value}%
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-[#444444]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="flex h-full flex-col rounded-md border border-[#dddddd] bg-white p-2">
                <p className="mb-1 text-sm font-semibold text-[#444444]">다음달 액션 3개</p>
                <div className="flex flex-1 flex-col gap-1 text-[11px] text-[#444444]">
                  {activePeriodDraft.nextActions
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((action, index) => (
                      <p key={`next-action-${index}`} className="line-clamp-2 rounded-md border border-[#eeeeee] bg-[#fafafa] px-2 py-1.5">
                        {index + 1}. {action}
                      </p>
                    ))}
                  {activePeriodDraft.nextActions.trim().length === 0 ? (
                    <>
                      <p className="line-clamp-2 rounded-md border border-[#eeeeee] bg-[#fff4f4] px-2 py-1.5 text-rose-700">
                        1. (예시) 월요일 아침 30분 계획 블록 고정
                      </p>
                      <p className="line-clamp-2 rounded-md border border-[#eeeeee] bg-[#fff4f4] px-2 py-1.5 text-rose-700">
                        2. (예시) 흔들린 루틴 1개만 14일 연속 체크
                      </p>
                      <p className="line-clamp-2 rounded-md border border-[#eeeeee] bg-[#fff4f4] px-2 py-1.5 text-rose-700">
                        3. (예시) 주간 회고를 금요일 밤 고정
                      </p>
                    </>
                  ) : null}
                </div>
              </article>
            </div>

            <div className="mt-1.5 grid gap-2 md:grid-cols-2">
              <article className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="mb-2 text-sm font-semibold text-[#444444]">가장 잘한 루틴 TOP 3</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-[#444444]">
                  {monthlyRoutineRanking.top.length === 0 ? (
                    <p className="col-span-3 rounded-md border border-[#eeeeee] bg-[#fafafa] px-2 py-1.5 text-[#666666]">데이터 없음</p>
                  ) : (
                    monthlyRoutineRanking.top.map((item, idx) => (
                      <div
                        key={`top-routine-${idx}`}
                        className="flex min-h-[92px] flex-col justify-center rounded-md border border-[#eeeeee] bg-[#fafafa] px-2 py-2 text-center"
                      >
                        <p className="text-[11px] font-semibold leading-snug">{item.name}</p>
                        <p className="mt-1 text-[11px]">{item.rate}%</p>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="mb-2 text-sm font-semibold text-[#444444]">가장 흔들린 루틴 TOP 3</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-[#444444]">
                  {monthlyRoutineRanking.bottom.length === 0 ? (
                    <p className="col-span-3 rounded-md border border-[#eeeeee] bg-[#fafafa] px-2 py-1.5 text-[#666666]">데이터 없음</p>
                  ) : (
                    monthlyRoutineRanking.bottom.map((item, idx) => (
                      <div
                        key={`bottom-routine-${idx}`}
                        className="flex min-h-[92px] flex-col justify-center rounded-md border border-[#eeeeee] bg-[#fafafa] px-2 py-2 text-center"
                      >
                        <p className="text-[11px] font-semibold leading-snug">{item.name}</p>
                        <p className="mt-1 text-[11px]">{item.rate}%</p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {periodTab === "week" ? (
          <section className="grid min-h-0 flex-1 gap-2.5 md:grid-cols-10">
            <article className="flex min-h-0 flex-col rounded-lg border border-[#eeeeee] bg-white/80 p-3.5 md:col-span-3">
              <div className="mb-1">
                <h2 className="text-base font-semibold text-[#444444]">
                  <span className="mr-1 text-lg">📚</span>주간 마감 리포트
                </h2>
              </div>
              <div className="mb-2 flex items-center justify-end gap-1">
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                >
                  저번주
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setWeekOffset(0)}
                >
                  이번주
                </button>
              </div>
              <div className="grid h-full min-h-0 flex-1 grid-rows-7 gap-1.5">
                {weekDates
                  .slice()
                  .reverse()
                  .map((date) => {
                    const report = reportByDate.get(date);
                    const percent = report?.progressPercent ?? 0;
                    const percentLabel = report ? `${report.progressPercent}%` : "-";
                    return (
                  <details
                    key={`weekly-row-${date}`}
                    className="h-full min-h-[42px] rounded-md border border-[#dddddd] bg-white p-2 [&_summary::-webkit-details-marker]:hidden"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${currentAccent.soft} ${percent}%, #ffffff ${percent}%)`,
                    }}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-[#444444]">
                      <span>{toKoreanDate(date)}</span>
                      <span>{percentLabel}</span>
                    </summary>
                    <div className="mt-2 border-t border-[#eeeeee] pt-2 text-xs text-[#444444]">
                      {report ? (
                        <>
                          <p>저장 {toKoreanDateTime(report.createdAt)}</p>
                          <p className="mt-1">🎯 {report.oneThing.title || "OneThing 미입력"}</p>
                          <p className="mt-1 text-emerald-700">Good: {report.good}</p>
                          <p className="mt-1 text-blue-700">Problem: {report.problem}</p>
                          <p className="mt-1 text-rose-700">Try: {report.tryNext}</p>
                        </>
                      ) : (
                        <p>아직 저장된 리포트가 없습니다.</p>
                      )}
                    </div>
                  </details>
                    );
                  })}
              </div>
            </article>

            <article className="flex min-h-0 flex-col rounded-lg border border-[#eeeeee] bg-white/80 p-3.5 md:col-span-7">
              <h2 className="mb-2 text-base font-semibold text-[#444444]">
                <span className="mr-1 text-lg">🔁</span>주간 루틴 수행 통계
              </h2>
              {routineWeeklyRows.length === 0 ? (
                <div className="rounded-md border border-[#dddddd] bg-white p-3 text-sm text-[#444444]">
                  루틴 상세가 저장된 리포트가 없습니다. 오늘 리포트 저장 후 확인해 주세요.
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 items-stretch gap-1.5 md:grid-cols-3">
                  {(["morning", "day", "night"] as RoutineGroup[]).map((group) => (
                    <div key={`routine-group-${group}`} className="flex min-h-0 flex-col rounded-md border border-[#dddddd] bg-white p-2.5">
                      <p className="mb-1 font-semibold text-[#444444]">
                        {group === "morning" ? "Morning" : group === "day" ? "Day" : "Night"}
                      </p>
                      <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[10px] text-[#888888]">
                        <span>루틴</span>
                        <div className="grid grid-cols-7 gap-1">
                          {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
                            <span key={`group-head-${group}-${d}`} className="w-3.5 text-center leading-none">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 space-y-1 pr-1">
                        {routineSummaryByGroup[group].length === 0 ? (
                          <p className="text-xs text-[#444444]">데이터 없음</p>
                        ) : (
                          routineSummaryByGroup[group].map((item, rowIndex) => {
                            const rowColor = ["#9bbcf2", "#f4cf6e", "#f0a0a0", "#88d8a8", "#a7b7f7", "#b4e0cc"][
                              rowIndex % 6
                            ];
                            return (
                              <div
                                key={`group-line-${item.group}-${item.name}`}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                              >
                                <span className="truncate text-[11px] text-[#444444]">{item.name}</span>
                                <div className="grid grid-cols-7 gap-1">
                                  {item.days.map((state, dayIdx) => (
                                    <div
                                      key={`group-cell-${item.group}-${item.name}-${dayIdx}`}
                                      className="h-3.5 w-3.5 rounded-[4px] border border-[#dddddd]"
                                      style={{
                                        backgroundColor: state === 1 ? rowColor : "#eeeeee",
                                        opacity: state === -1 ? 0.5 : 1,
                                      }}
                                      title={`${toKoreanDate(weekDates[dayIdx])} ${state === 1 ? "완료" : state === 0 ? "미완료" : "기록 없음"}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        ) : periodTab === "year" ? (
          <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-[#eeeeee] bg-white/80 p-3">
            <h2 className="mb-2 text-base font-semibold text-[#444444]">
              <span className="mr-1 text-lg">🧭</span>연간 한눈판
            </h2>

            <div className="grid gap-1.5 sm:grid-cols-3">
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#666666]">올해 저장일</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.savedDays}일</p>
              </div>
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#666666]">평균 진행률</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.avgProgress}%</p>
              </div>
              <div className="rounded-md border border-[#dddddd] bg-white p-2.5">
                <p className="text-xs text-[#666666]">투두 완료율</p>
                <p className="mt-1 text-lg font-bold text-[#444444]">{periodSummary.todoRate}%</p>
              </div>
            </div>

            <article className="mt-1.5 rounded-md border border-[#dddddd] bg-white p-2">
              <p className="mb-1.5 text-sm font-semibold text-[#444444]">월별 진행률 추이</p>
              <div className="grid grid-cols-6 gap-1.5 md:grid-cols-12">
                {yearlyMonthBars.map((item) => (
                  <div key={item.label} className="rounded-md border border-[#eeeeee] p-1.5 text-center">
                    <div
                      className="mx-auto h-8 w-8 rounded-full border border-[#dddddd]"
                      style={{
                        background: `conic-gradient(${currentAccent.accent} ${item.value * 3.6}deg, #eeeeee 0deg)`,
                      }}
                    >
                      <div
                        className="m-[3px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-white text-[9px] font-semibold text-[#444444]"
                      >{item.value}</div>
                    </div>
                    <p className="mt-1 text-[10px] text-[#444444]">{item.label}</p>
                  </div>
                ))}
              </div>
            </article>

            <div className="mt-1.5 grid items-stretch gap-1.5 md:grid-cols-3">
              <article className="flex h-full min-h-0 flex-col rounded-md border border-[#dddddd] bg-white p-2 md:col-span-2">
                <p className="mb-1.5 text-sm font-semibold text-[#444444]">분기별 Best / Worst 루틴</p>
                <div className="grid flex-1 grid-cols-4 gap-1.5">
                  {yearlyQuarterInsights.map((quarter) => (
                    <div key={`quarter-insight-${quarter.quarter}`} className="flex min-h-[112px] flex-col rounded-md border border-[#eeeeee] bg-[#fafafa] p-2">
                      <p className="text-xs font-semibold text-[#444444]">{quarter.quarter}</p>
                      <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-emerald-700">Best: {quarter.best}</p>
                      <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-rose-700">Worst: {quarter.worst}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="flex h-full min-h-0 flex-col rounded-md border border-[#dddddd] bg-white p-2">
                <p className="mb-1.5 text-sm font-semibold text-[#444444]">내년 핵심 액션 3개</p>
                <div className="flex flex-1 flex-col gap-1 text-xs text-[#444444]">
                  {(activePeriodDraft.nextActions
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 3).length > 0
                    ? activePeriodDraft.nextActions
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 3)
                    : [
                        "핵심 프로젝트 1개를 분기 로드맵으로 고정",
                        "흔들린 루틴 1개를 30일 집중 개선",
                        "월말 회고를 12회 연속 실행",
                      ]
                  ).map((action, index) => (
                    <p key={`year-action-${index}`} className="flex-1 rounded-md border border-[#eeeeee] bg-[#fafafa] px-2 py-1.5">
                      {index + 1}. {action}
                    </p>
                  ))}
                </div>
              </article>
            </div>
          </section>
        ) : null}
        </div>
      </main>
    </div>
  );
}

const WeeklyReview = dynamic(() => Promise.resolve(WeeklyReviewPage), {
  ssr: false,
});

export default WeeklyReview;
