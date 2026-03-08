"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getPreferredSyncEmail, runSmartSync } from "@/lib/cloud-sync";

type TodoKind = "date" | "someday" | "quick" | "project";
type RoutineGroup = "morning" | "day" | "night";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  kind: TodoKind;
  dueDate: string | null;
  linkedToOneThing: boolean;
  projectId: string | null;
  projectStartDate: string | null;
  projectEndDate: string | null;
};

type Routine = {
  id: string;
  text: string;
  completedOn: string | null;
  createdAt: string;
  group: RoutineGroup;
};

type OneThing = {
  title: string;
  next: string;
  keepGoing: string;
};

type Project = {
  id: string;
  title: string;
  goal: string;
  actionPlan: string;
  startDate: string;
  endDate: string;
  status: "todo" | "doing" | "done";
};

type ScheduleItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  location?: string;
  note?: string;
  googleCalendarId?: string;
  googleEventId?: string;
};

type ScheduleViewItem = ScheduleItem & {
  source: "local" | "google" | "apple";
  calendarName?: string;
  calendarColor?: string;
};
type TrackingSession = {
  startedAt: string;
  title: string;
  location: string;
  note: string;
};
type CalendarViewMode = "day" | "week" | "month";
type ScheduleAddTarget = "local" | "google" | "both";

type DailyStat = {
  date: string;
  percent: number;
  momentum: number;
};

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
  routineRecords: RoutineRecord[];
};

type OneThingProjectFilter = "all" | "none" | string;
type MoodTheme = "neutral" | "coral" | "yellow" | "blue";
type AccentTone = "neutral" | "coral" | "yellow" | "blue";

const TODO_STORAGE_KEY = "diary-os.todos.v2";
const ROUTINE_STORAGE_KEY = "diary-os.routines.v2";
const ONETHING_STORAGE_KEY = "diary-os.onething.v1";
const MOMENTUM_STORAGE_PREFIX = "diary-os.momentum";
const SCHEDULE_STORAGE_KEY = "diary-os.schedule.v1";
const PROJECT_STORAGE_KEY = "diary-os.projects.v1";
const DAILY_STATS_STORAGE_KEY = "diary-os.daily-stats.v1";
const THEME_STORAGE_KEY = "diary-os.theme.v1";
const ACCENT_STORAGE_KEY = "diary-os.accent.v1";
const CALLOUT_BG_STORAGE_KEY = "diary-os.callout-bg.v1";
const REPORT_STORAGE_KEY = "diary-os.daily-reports.v1";
const GOOGLE_CAL_TOKEN_STORAGE_KEY = "diary-os.google-calendar-token.v1";
const GOOGLE_CAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_CAL_LIST_STORAGE_KEY = "diary-os.google-calendars.v1";
const GOOGLE_CAL_FILTER_STORAGE_KEY = "diary-os.google-calendar-filter.v1";
const GOOGLE_CAL_AUTO_SYNC_STORAGE_KEY = "diary-os.google-calendar-autosync.v1";
const APPLE_ICS_URL_STORAGE_KEY = "diary-os.apple-ics-url.v1";
const APPLE_ICS_URLS_STORAGE_KEY = "diary-os.apple-ics-urls.v2";

const defaultRoutines: Routine[] = [
  {
    id: "routine-stretching",
    text: "10-minute stretching",
    completedOn: null,
    createdAt: "default",
    group: "morning",
  },
  {
    id: "routine-vitamin",
    text: "Take vitamins",
    completedOn: null,
    createdAt: "default",
    group: "morning",
  },
];

const todoKindLabel: Record<TodoKind, string> = {
  date: "날짜 지정",
  someday: "언젠가",
  quick: "3분컷",
  project: "프로젝트",
};


const themePalette: Record<
  MoodTheme,
  {
    label: string;
    background: string;
    vars: Record<string, string>;
  }
> = {
  neutral: {
    label: "무채색",
    background:
      "linear-gradient(180deg,#f4f5f7 0%,#eceff2 100%), radial-gradient(circle at 20% 0%,#ffffff 0%,transparent 50%)",
    vars: {
      "--background": "#f1f3f5",
      "--foreground": "#444444",
      "--surface": "#ffffff",
      "--surface-strong": "#f7f8fa",
      "--line": "#eeeeee",
      "--accent": "#9ca3af",
      "--accent-soft": "#eceff3",
    },
  },
  coral: {
    label: "코랄",
    background:
      "linear-gradient(180deg,#fff5f3 0%,#fbe9e5 100%), radial-gradient(circle at 80% 0%,#fffaf7 0%,transparent 45%)",
    vars: {
      "--background": "#fdf1ee",
      "--foreground": "#444444",
      "--surface": "#ffffff",
      "--surface-strong": "#fdf5f3",
      "--line": "#eeeeee",
      "--accent": "#f29b8f",
      "--accent-soft": "#fde8e4",
    },
  },
  yellow: {
    label: "옐로우",
    background:
      "linear-gradient(180deg,#fff9ec 0%,#f6f0de 100%), radial-gradient(circle at 10% 0%,#fffdf5 0%,transparent 48%)",
    vars: {
      "--background": "#faf4e6",
      "--foreground": "#444444",
      "--surface": "#ffffff",
      "--surface-strong": "#fbf7ec",
      "--line": "#eeeeee",
      "--accent": "#e7c97a",
      "--accent-soft": "#f8efcf",
    },
  },
  blue: {
    label: "블루",
    background:
      "linear-gradient(180deg,#f2f7ff 0%,#e6eef9 100%), radial-gradient(circle at 80% 0%,#f8fbff 0%,transparent 46%)",
    vars: {
      "--background": "#edf3fb",
      "--foreground": "#444444",
      "--surface": "#ffffff",
      "--surface-strong": "#f3f7fd",
      "--line": "#eeeeee",
      "--accent": "#8fb6e8",
      "--accent-soft": "#e7f0fd",
    },
  },
};

const accentPalette: Record<AccentTone, { label: string; accent: string; soft: string }> = {
  neutral: { label: "무채색", accent: "#9ca3af", soft: "#eceff3" },
  coral: { label: "코랄", accent: "#f29b8f", soft: "#fde8e4" },
  yellow: { label: "옐로우", accent: "#e7c97a", soft: "#f8efcf" },
  blue: { label: "블루", accent: "#8fb6e8", soft: "#e7f0fd" },
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentTimeHHmm() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function addMinutesToHHmm(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "10:00";
  const dt = new Date();
  dt.setHours(h, m, 0, 0);
  dt.setMinutes(dt.getMinutes() + minutes);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function toLocalDateKey(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toHHmm(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}


function datePart(dateTime: string) {
  return dateTime.slice(0, 10);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getStoredTodos() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(TODO_STORAGE_KEY);
  const parsed = parseJson<unknown[]>(raw, []);
  return parsed
    .map((item): Todo | null => {
      const old = item as Partial<Todo> & {
        text?: unknown;
        done?: unknown;
        createdAt?: unknown;
        kind?: unknown;
        dueDate?: unknown;
        linkedToOneThing?: unknown;
        projectId?: unknown;
        projectStartDate?: unknown;
        projectEndDate?: unknown;
      };
      if (typeof old.text !== "string") return null;
      return {
        id: typeof old.id === "string" ? old.id : createId(),
        text: old.text,
        done: Boolean(old.done),
        createdAt:
          typeof old.createdAt === "string"
            ? old.createdAt
            : new Date().toISOString(),
        kind:
          old.kind === "date" ||
          old.kind === "someday" ||
          old.kind === "quick" ||
          old.kind === "project"
            ? old.kind
            : "quick",
        dueDate: typeof old.dueDate === "string" ? old.dueDate : null,
        linkedToOneThing: Boolean(old.linkedToOneThing),
        projectId: typeof old.projectId === "string" ? old.projectId : null,
        projectStartDate:
          typeof old.projectStartDate === "string" ? old.projectStartDate : null,
        projectEndDate:
          typeof old.projectEndDate === "string" ? old.projectEndDate : null,
      } satisfies Todo;
    })
    .filter((item): item is Todo => item !== null);
}

function getStoredRoutines() {
  if (typeof window === "undefined") return defaultRoutines;
  const raw = window.localStorage.getItem(ROUTINE_STORAGE_KEY);
  const parsed = parseJson<unknown[]>(raw, []);
  if (parsed.length === 0) return defaultRoutines;

  return parsed
    .map((item): Routine | null => {
      const old = item as Partial<Routine> & {
        text?: unknown;
        completedOn?: unknown;
        createdAt?: unknown;
        group?: unknown;
      };
      if (typeof old.text !== "string") return null;
      return {
        id: typeof old.id === "string" ? old.id : createId(),
        text: old.text,
        completedOn: typeof old.completedOn === "string" ? old.completedOn : null,
        createdAt:
          typeof old.createdAt === "string"
            ? old.createdAt
            : new Date().toISOString(),
        group:
          old.group === "morning" || old.group === "day" || old.group === "night"
            ? old.group
            : "morning",
      } satisfies Routine;
    })
    .filter((item): item is Routine => item !== null);
}

function getStoredOneThing() {
  if (typeof window === "undefined") {
    return { title: "", next: "", keepGoing: "" };
  }
  return parseJson<OneThing>(window.localStorage.getItem(ONETHING_STORAGE_KEY), {
    title: "",
    next: "",
    keepGoing: "",
  });
}

function getStoredSchedule() {
  if (typeof window === "undefined") return [];
  const parsed = parseJson<unknown[]>(
    window.localStorage.getItem(SCHEDULE_STORAGE_KEY),
    [],
  );
  return parsed
    .map((item): ScheduleItem | null => {
      const old = item as Partial<ScheduleItem> & {
        title?: unknown;
        date?: unknown;
        time?: unknown;
        endTime?: unknown;
        location?: unknown;
        note?: unknown;
        googleCalendarId?: unknown;
        googleEventId?: unknown;
      };
      if (
        typeof old.title !== "string" ||
        typeof old.date !== "string" ||
        typeof old.time !== "string"
      ) {
        return null;
      }
      return {
        id: typeof old.id === "string" ? old.id : createId(),
        title: old.title,
        date: old.date,
        time: old.time,
        endTime: typeof old.endTime === "string" ? old.endTime : undefined,
        location: typeof old.location === "string" ? old.location : "",
        note: typeof old.note === "string" ? old.note : "",
        googleCalendarId:
          typeof old.googleCalendarId === "string" ? old.googleCalendarId : undefined,
        googleEventId:
          typeof old.googleEventId === "string" ? old.googleEventId : undefined,
      } satisfies ScheduleItem;
    })
    .filter((item): item is ScheduleItem => item !== null);
}

function getStoredProjects() {
  if (typeof window === "undefined") return [];
  const parsed = parseJson<unknown[]>(
    window.localStorage.getItem(PROJECT_STORAGE_KEY),
    [],
  );
  return parsed
    .map((item): Project | null => {
      const old = item as Partial<Project> & {
        title?: unknown;
        goal?: unknown;
        actionPlan?: unknown;
        startDate?: unknown;
        endDate?: unknown;
        status?: unknown;
      };
      if (
        typeof old.title !== "string" ||
        typeof old.goal !== "string" ||
        typeof old.actionPlan !== "string" ||
        typeof old.startDate !== "string" ||
        typeof old.endDate !== "string"
      ) {
        return null;
      }
      return {
        id: typeof old.id === "string" ? old.id : createId(),
        title: old.title,
        goal: old.goal,
        actionPlan: old.actionPlan,
        startDate: old.startDate,
        endDate: old.endDate,
        status:
          old.status === "todo" || old.status === "doing" || old.status === "done"
            ? old.status
            : "todo",
      } satisfies Project;
    })
    .filter((item): item is Project => item !== null);
}

function getStoredDailyStats() {
  if (typeof window === "undefined") return [];
  return parseJson<DailyStat[]>(
    window.localStorage.getItem(DAILY_STATS_STORAGE_KEY),
    [],
  );
}

function getStoredReports() {
  if (typeof window === "undefined") return [];
  return parseJson<DailyReport[]>(
    window.localStorage.getItem(REPORT_STORAGE_KEY),
    [],
  );
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
  return saved === "neutral" || saved === "blue" || saved === "coral" || saved === "yellow"
    ? saved
    : "neutral";
}

function getStoredCalloutBackground() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CALLOUT_BG_STORAGE_KEY) ?? "";
}

function getStoredAppleIcsUrl() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(APPLE_ICS_URL_STORAGE_KEY) ?? "";
}

function getStoredAppleIcsUrls() {
  if (typeof window === "undefined") return [] as string[];
  const saved = parseJson<string[]>(
    window.localStorage.getItem(APPLE_ICS_URLS_STORAGE_KEY),
    [],
  )
    .map((url) => normalizeIcsUrl(url))
    .filter((url) => /^https?:\/\//i.test(url));
  if (saved.length > 0) return Array.from(new Set(saved));
  const legacy = normalizeIcsUrl(getStoredAppleIcsUrl());
  if (!legacy || !/^https?:\/\//i.test(legacy)) return [];
  return [legacy];
}

function normalizeIcsUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (/^webcal:\/\//i.test(value)) return value.replace(/^webcal:\/\//i, "https://");
  return value;
}

function getStoredGoogleCalendarFilterIds() {
  if (typeof window === "undefined") return [] as string[];
  return parseJson<string[]>(
    window.localStorage.getItem(GOOGLE_CAL_FILTER_STORAGE_KEY),
    [],
  );
}

function getStoredGoogleCalendarAutoSync() {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(GOOGLE_CAL_AUTO_SYNC_STORAGE_KEY);
  if (raw === null) return true;
  return raw === "true";
}

function momentumKey(date: string) {
  return `${MOMENTUM_STORAGE_PREFIX}.${date}`;
}

function getStoredMomentum(date: string) {
  if (typeof window === "undefined") return 0;
  const saved = window.localStorage.getItem(momentumKey(date));
  return saved ? Number(saved) : 0;
}

function getPlantStage(progressPercent: number) {
  if (progressPercent >= 100) return { emoji: "🍎", label: "열매" };
  if (progressPercent >= 70) return { emoji: "🌳", label: "나무" };
  if (progressPercent >= 35) return { emoji: "🌿", label: "풀잎" };
  if (progressPercent > 0) return { emoji: "🌱", label: "새싹" };
  return { emoji: "🌰", label: "씨앗" };
}

function toKoreanDate(date: string) {
  return new Date(date).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function toTimeLabel(value: string) {
  if (!value) return "종일";
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "종일";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getViewDateRange(date: string, mode: CalendarViewMode) {
  const base = new Date(`${date}T00:00:00`);
  if (mode === "day") {
    return { start: date, end: date, label: "일간" };
  }
  if (mode === "week") {
    const day = base.getDay();
    const mondayDiff = day === 0 ? -6 : 1 - day;
    const startDate = new Date(base);
    startDate.setDate(base.getDate() + mondayDiff);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return {
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
      label: "주간",
    };
  }
  const startDate = new Date(base.getFullYear(), base.getMonth(), 1);
  const endDate = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
    label: "월간",
  };
}

type GoogleCalendarMeta = {
  id: string;
  summary: string;
  backgroundColor?: string;
};

function daysLeft(toDate: string) {
  const now = new Date();
  const target = new Date(toDate);
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}


function HomePage() {
  const searchParams = useSearchParams();
  const today = todayKey();
  const [todos, setTodos] = useState<Todo[]>(getStoredTodos);
  const [routines, setRoutines] = useState<Routine[]>(getStoredRoutines);
  const [oneThing, setOneThing] = useState<OneThing>(getStoredOneThing);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(
    getStoredSchedule,
  );
  const [projects] = useState<Project[]>(getStoredProjects);
  const [dailyStatsBase] = useState<DailyStat[]>(getStoredDailyStats);
  const [reports, setReports] = useState<DailyReport[]>(getStoredReports);
  const [momentum, setMomentum] = useState<number>(() => getStoredMomentum(today));

  const [todoInput, setTodoInput] = useState("");
  const [todoKindInput, setTodoKindInput] = useState<TodoKind>("quick");
  const [todoDueDateInput, setTodoDueDateInput] = useState(today);
  const [todoLinkInput, setTodoLinkInput] = useState(true);
  const [todoProjectIdInput] = useState("");
  const [todoProjectStartInput] = useState(today);
  const [todoProjectEndInput] = useState(today);

  const [routineInput, setRoutineInput] = useState("");
  const [routineGroupInput, setRoutineGroupInput] =
    useState<RoutineGroup>("morning");
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [editingRoutineText, setEditingRoutineText] = useState("");
  const [editingRoutineGroup, setEditingRoutineGroup] =
    useState<RoutineGroup>("morning");

  const [oneThingInput, setOneThingInput] = useState("");
  const [nextInput, setNextInput] = useState("");
  const [keepGoingInput, setKeepGoingInput] = useState("");

  const [scheduleTitleInput, setScheduleTitleInput] = useState("");
  const [scheduleDateInput, setScheduleDateInput] = useState(today);
  const [scheduleTimeInput, setScheduleTimeInput] = useState(() => currentTimeHHmm());
  const [scheduleEndTimeInput, setScheduleEndTimeInput] = useState(() =>
    addMinutesToHHmm(currentTimeHHmm(), 60),
  );
  const [scheduleLocationInput, setScheduleLocationInput] = useState("");
  const [scheduleNoteInput, setScheduleNoteInput] = useState("");
  const [scheduleViewMode, setScheduleViewMode] = useState<CalendarViewMode>("day");
  const [scheduleAddTarget, setScheduleAddTarget] =
    useState<ScheduleAddTarget>("both");
  const [googleTargetCalendarId, setGoogleTargetCalendarId] = useState("primary");
  const [scheduleDeletingId, setScheduleDeletingId] = useState<string | null>(null);
  const [scheduleEditingId, setScheduleEditingId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleViewItem | null>(null);
  const [scheduleEditTitleInput, setScheduleEditTitleInput] = useState("");
  const [scheduleEditDateInput, setScheduleEditDateInput] = useState(today);
  const [scheduleEditTimeInput, setScheduleEditTimeInput] = useState("09:00");
  const [scheduleEditEndTimeInput, setScheduleEditEndTimeInput] = useState("10:00");
  const [scheduleEditLocationInput, setScheduleEditLocationInput] = useState("");
  const [scheduleEditNoteInput, setScheduleEditNoteInput] = useState("");
  const [activeTracking, setActiveTracking] = useState<TrackingSession | null>(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);

  const [theme, setTheme] = useState<MoodTheme>(getStoredTheme);
  const [accentTone, setAccentTone] = useState<AccentTone>(getStoredAccent);
  const [calloutBackground, setCalloutBackground] = useState(
    getStoredCalloutBackground,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSchedulePanelOpen, setIsSchedulePanelOpen] = useState(false);
  const [isRoutineInputOpen, setIsRoutineInputOpen] = useState(false);
  const [isTodoInputOpen, setIsTodoInputOpen] = useState(false);
  const [todoExpandedMap, setTodoExpandedMap] = useState<Record<string, boolean>>(
    {},
  );
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoText, setEditingTodoText] = useState("");
  const [editingTodoDueDate, setEditingTodoDueDate] = useState("");
  const [doneTodoModal, setDoneTodoModal] = useState<{
    title: string;
    items: Todo[];
  } | null>(null);
  const [routinePanelTab, setRoutinePanelTab] = useState<RoutineGroup>("morning");
  const [oneThingProjectFilter, setOneThingProjectFilter] =
    useState<OneThingProjectFilter>("all");
  const [reportGoodInput, setReportGoodInput] = useState("");
  const [reportProblemInput, setReportProblemInput] = useState("");
  const [reportTryInput, setReportTryInput] = useState("");
  const [googleAccessToken, setGoogleAccessToken] = useState("");
  const [googleTokenExpiresAt, setGoogleTokenExpiresAt] = useState<number>(0);
  const [googleCalendarReady, setGoogleCalendarReady] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleTodaySchedules, setGoogleTodaySchedules] = useState<ScheduleViewItem[]>([]);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarMeta[]>([]);
  const [googleCalendarFilterIds, setGoogleCalendarFilterIds] = useState<string[]>(
    getStoredGoogleCalendarFilterIds,
  );
  const [googleAutoSyncEnabled, setGoogleAutoSyncEnabled] = useState<boolean>(
    getStoredGoogleCalendarAutoSync,
  );
  const [appleIcsUrls, setAppleIcsUrls] = useState<string[]>(getStoredAppleIcsUrls);
  const [appleIcsInput, setAppleIcsInput] = useState("");
  const [appleSyncing, setAppleSyncing] = useState(false);
  const [appleError, setAppleError] = useState<string | null>(null);
  const [appleSyncInfo, setAppleSyncInfo] = useState<string | null>(null);
  const [appleSchedules, setAppleSchedules] = useState<ScheduleViewItem[]>([]);
  const [googleSyncInfo, setGoogleSyncInfo] = useState<string | null>(null);
  const hasAutoSyncedOnEntryRef = useRef(false);
  const wasSchedulePanelOpenRef = useRef(false);
  const cloudAutoSyncBootedRef = useRef(false);
  const cloudAutoSyncBusyRef = useRef(false);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  useEffect(() => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(routines));
  }, [routines]);

  useEffect(() => {
    localStorage.setItem(ONETHING_STORAGE_KEY, JSON.stringify(oneThing));
  }, [oneThing]);

  useEffect(() => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(scheduleItems));
  }, [scheduleItems]);

  useEffect(() => {
    localStorage.setItem(momentumKey(today), String(momentum));
  }, [today, momentum]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(ACCENT_STORAGE_KEY, accentTone);
  }, [accentTone]);

  useEffect(() => {
    localStorage.setItem(CALLOUT_BG_STORAGE_KEY, calloutBackground);
  }, [calloutBackground]);

  useEffect(() => {
    localStorage.setItem(APPLE_ICS_URLS_STORAGE_KEY, JSON.stringify(appleIcsUrls));
    if (appleIcsUrls.length > 0) {
      localStorage.setItem(APPLE_ICS_URL_STORAGE_KEY, appleIcsUrls[0]);
    } else {
      localStorage.removeItem(APPLE_ICS_URL_STORAGE_KEY);
    }
  }, [appleIcsUrls]);

  useEffect(() => {
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    if (cloudAutoSyncBootedRef.current) return;
    if (!supabaseUrl || !supabaseAnon) return;
    const email = getPreferredSyncEmail();
    if (!email) return;
    cloudAutoSyncBootedRef.current = true;

    const runSilentSync = async () => {
      if (cloudAutoSyncBusyRef.current) return;
      cloudAutoSyncBusyRef.current = true;
      try {
        await runSmartSync({
          userEmail: email,
          supabaseUrl,
          supabaseAnon,
        });
      } catch {
        // Silent background sync: keep UI uninterrupted on temporary network failures.
      } finally {
        cloudAutoSyncBusyRef.current = false;
      }
    };

    void runSilentSync();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void runSilentSync();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      void runSilentSync();
    }, 1000 * 60 * 5);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [supabaseUrl, supabaseAnon]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(GOOGLE_CAL_TOKEN_STORAGE_KEY);
    if (!raw) return;
    const saved = parseJson<{ token: string; expiresAt: number } | null>(raw, null);
    if (!saved || !saved.token || !saved.expiresAt) return;
    if (saved.expiresAt <= Date.now()) {
      window.localStorage.removeItem(GOOGLE_CAL_TOKEN_STORAGE_KEY);
      return;
    }
    setGoogleAccessToken(saved.token);
    setGoogleTokenExpiresAt(saved.expiresAt);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!googleAccessToken) {
      window.localStorage.removeItem(GOOGLE_CAL_TOKEN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      GOOGLE_CAL_TOKEN_STORAGE_KEY,
      JSON.stringify({ token: googleAccessToken, expiresAt: googleTokenExpiresAt }),
    );
  }, [googleAccessToken, googleTokenExpiresAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(GOOGLE_CAL_LIST_STORAGE_KEY);
    if (!raw) return;
    const saved = parseJson<GoogleCalendarMeta[]>(raw, []);
    setGoogleCalendars(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GOOGLE_CAL_LIST_STORAGE_KEY, JSON.stringify(googleCalendars));
  }, [googleCalendars]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      GOOGLE_CAL_FILTER_STORAGE_KEY,
      JSON.stringify(googleCalendarFilterIds),
    );
  }, [googleCalendarFilterIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      GOOGLE_CAL_AUTO_SYNC_STORAGE_KEY,
      String(googleAutoSyncEnabled),
    );
  }, [googleAutoSyncEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = document.getElementById("google-gsi-client");
    if (existing) {
      setGoogleCalendarReady(Boolean((window as { google?: unknown }).google));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () =>
      setGoogleCalendarReady(Boolean((window as { google?: unknown }).google));
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const hasOpenModal =
      isSettingsOpen || isRoutineInputOpen || isSchedulePanelOpen || isTodoInputOpen;
    if (!hasOpenModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isSettingsOpen) setIsSettingsOpen(false);
      if (isRoutineInputOpen) setIsRoutineInputOpen(false);
      if (isSchedulePanelOpen) setIsSchedulePanelOpen(false);
      if (isTodoInputOpen) setIsTodoInputOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSettingsOpen, isRoutineInputOpen, isSchedulePanelOpen, isTodoInputOpen]);

  useEffect(() => {
    if (searchParams.get("settings") === "1") {
      setIsSettingsOpen(true);
    }
  }, [searchParams]);

  const currentRange = useMemo(
    () => getViewDateRange(scheduleDateInput, scheduleViewMode),
    [scheduleDateInput, scheduleViewMode],
  );
  const compactScheduleLabel = useMemo(() => {
    if (scheduleViewMode === "month") {
      const dt = new Date(`${scheduleDateInput}T00:00:00`);
      return `${dt.getFullYear()}.${dt.toLocaleString("en-US", { month: "short" })}`;
    }
    if (scheduleViewMode === "week") {
      const s = currentRange.start.slice(5);
      const e = currentRange.end.slice(5);
      return `${s}~${e}`;
    }
    return currentRange.start;
  }, [scheduleViewMode, scheduleDateInput, currentRange.start, currentRange.end]);

  const selectedDateSchedules = useMemo(
    () =>
      scheduleItems
        .filter((item) => item.date >= currentRange.start && item.date <= currentRange.end)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [scheduleItems, currentRange],
  );
  const mergedSelectedDateSchedules = useMemo<ScheduleViewItem[]>(
    () => {
      const googleEventIds = new Set(
        googleTodaySchedules
          .map((item) => item.googleEventId)
          .filter((id): id is string => Boolean(id)),
      );
      const localVisible = selectedDateSchedules.filter(
        (item) => !(item.googleEventId && googleEventIds.has(item.googleEventId)),
      );
      return [
        ...localVisible.map((item) => ({ ...item, source: "local" as const })),
        ...googleTodaySchedules.map((item) => ({ ...item, source: "google" as const })),
        ...appleSchedules.map((item) => ({ ...item, source: "apple" as const })),
      ].sort((a, b) => a.time.localeCompare(b.time));
    },
    [selectedDateSchedules, googleTodaySchedules, appleSchedules],
  );

  const oneThingTodos = useMemo(
    () => todos.filter((item) => item.linkedToOneThing),
    [todos],
  );
  const otherTodos = useMemo(
    () => todos.filter((item) => !item.linkedToOneThing),
    [todos],
  );
  const recentTodoInputs = useMemo(
    () =>
      [...todos]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
    [todos],
  );
  const actionableTodos = useMemo(
    () =>
      todos.filter((item) => {
        if (item.kind === "date") return item.dueDate === today;
        if (item.kind === "project") {
          if (item.projectStartDate && item.projectEndDate) {
            return today >= item.projectStartDate && today <= item.projectEndDate;
          }
          if (item.projectEndDate) return today <= item.projectEndDate;
          if (item.projectStartDate) return today >= item.projectStartDate;
          return datePart(item.createdAt) === today;
        }
        if (item.kind === "quick") return datePart(item.createdAt) === today;
        return false;
      }),
    [todos, today],
  );

  const todoStats = useMemo(() => {
    const done = actionableTodos.filter((item) => item.done).length;
    return { done, total: actionableTodos.length };
  }, [actionableTodos]);

  const routineStats = useMemo(() => {
    const done = routines.filter((item) => item.completedOn === today).length;
    return { done, total: routines.length };
  }, [routines, today]);

  const totalCount = todoStats.total + routineStats.total;
  const doneCount = todoStats.done + routineStats.done;
  const progressPercent =
    routineStats.total === 0
      ? 0
      : Math.round((routineStats.done / routineStats.total) * 100);
  const plant = getPlantStage(progressPercent);
  const dailyStats = useMemo(() => {
    const next = [...dailyStatsBase];
    const index = next.findIndex((item) => item.date === today);
    const entry: DailyStat = {
      date: today,
      percent: progressPercent,
      momentum,
    };
    if (index >= 0) {
      next[index] = entry;
    } else {
      next.push(entry);
    }
    return next.slice(-120);
  }, [dailyStatsBase, today, progressPercent, momentum]);

  useEffect(() => {
    localStorage.setItem(DAILY_STATS_STORAGE_KEY, JSON.stringify(dailyStats));
  }, [dailyStats]);

  const recentWeek = useMemo(() => dailyStats.slice(-7), [dailyStats]);
  const recentMonth = useMemo(() => dailyStats.slice(-30), [dailyStats]);
  const weeklyAvg = useMemo(() => {
    if (recentWeek.length === 0) return 0;
    return Math.round(
      recentWeek.reduce((sum, item) => sum + item.percent, 0) / recentWeek.length,
    );
  }, [recentWeek]);
  const monthlyAvg = useMemo(() => {
    if (recentMonth.length === 0) return 0;
    return Math.round(
      recentMonth.reduce((sum, item) => sum + item.percent, 0) / recentMonth.length,
    );
  }, [recentMonth]);
  const sevenDayHeatCells = useMemo(() => {
    const statsByDate = new Map(dailyStats.map((item) => [item.date, item.percent]));
    const base = new Date(`${today}T00:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const target = new Date(base);
      target.setDate(base.getDate() - (6 - index));
      const y = target.getFullYear();
      const m = String(target.getMonth() + 1).padStart(2, "0");
      const d = String(target.getDate()).padStart(2, "0");
      const date = `${y}-${m}-${d}`;
      const percent = statsByDate.get(date) ?? 0;
      return {
        date,
        label: `${target.getMonth() + 1}/${target.getDate()}`,
        percent,
      };
    });
  }, [dailyStats, today]);

  const mtsFeedback = useMemo(() => {
    const doneOneThing = oneThingTodos.filter((item) => item.done).length;
    const oneThingTotal = oneThingTodos.length;
    const hasMainTarget = oneThing.title.trim().length > 0;
    const allDone = totalCount > 0 && doneCount === totalCount;
    const hasLooseEnds = oneThingTotal > 0 && doneOneThing < oneThingTotal;

    const good = allDone
      ? "오늘 루틴/투두를 모두 끝냈어요."
      : momentum >= 3
        ? "체크 리듬이 살아있어요."
        : "작게라도 계속 완료하고 있어요.";

    const problem = !hasMainTarget
      ? "OneThing이 비어 있어서 우선순위가 흐려졌어요."
      : hasLooseEnds
        ? "OneThing 연결 투두가 아직 남아 있어요."
        : "큰 막힘은 없고 리듬 유지가 관건이에요.";

    const nextTry = hasMainTarget
      ? hasLooseEnds
        ? "OneThing 연결 투두 1개만 지금 바로 처리하세요."
        : "Next OneThing을 1줄로 더 구체화해 보세요."
      : "오늘의 핵심 1개를 먼저 저장해 보세요.";

    return { good, problem, nextTry };
  }, [doneCount, momentum, oneThing.title, oneThingTodos, totalCount]);

  const oneThingProjectOptions = useMemo(() => {
    const ids = new Set<string>();
    oneThingTodos.forEach((todo) => {
      if (todo.projectId) ids.add(todo.projectId);
    });
    return projects.filter((project) => ids.has(project.id));
  }, [oneThingTodos, projects]);

  const filteredOneThingTodos = useMemo(() => {
    if (oneThingProjectFilter === "all") return oneThingTodos;
    if (oneThingProjectFilter === "none") {
      return oneThingTodos.filter((todo) => !todo.projectId);
    }
    return oneThingTodos.filter((todo) => todo.projectId === oneThingProjectFilter);
  }, [oneThingTodos, oneThingProjectFilter]);

  const todayReport = useMemo(
    () => reports.find((item) => item.date === today) ?? null,
    [reports, today],
  );

  useEffect(() => {
    if (todayReport) {
      setReportGoodInput(todayReport.good);
      setReportProblemInput(todayReport.problem);
      setReportTryInput(todayReport.tryNext);
    } else if (
      reportGoodInput.trim().length === 0 &&
      reportProblemInput.trim().length === 0 &&
      reportTryInput.trim().length === 0
    ) {
      setReportGoodInput(mtsFeedback.good);
      setReportProblemInput(mtsFeedback.problem);
      setReportTryInput(mtsFeedback.nextTry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayReport, today]);

  function celebrate() {
    setMomentum((prev) => prev + 1);
  }

  function addTodo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = todoInput.trim();
    if (!value) return;

    setTodos((prev) => [
      {
        id: createId(),
        text: value,
        done: false,
        createdAt: new Date().toISOString(),
        kind: todoKindInput,
        dueDate: todoKindInput === "date" ? todoDueDateInput : null,
        linkedToOneThing: todoLinkInput,
        projectId:
          todoKindInput === "project" && todoProjectIdInput
            ? todoProjectIdInput
            : null,
        projectStartDate:
          todoKindInput === "project" ? todoProjectStartInput : null,
        projectEndDate: todoKindInput === "project" ? todoProjectEndInput : null,
      },
      ...prev,
    ]);
    setTodoInput("");
  }

  function addRoutine(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = routineInput.trim();
    if (!value) return;

    setRoutines((prev) => [
      {
        id: createId(),
        text: value,
        completedOn: null,
        createdAt: new Date().toISOString(),
        group: routineGroupInput,
      },
      ...prev,
    ]);
    setRoutineInput("");
    setIsRoutineInputOpen(false);
  }

  function startRoutineEdit(routine: Routine) {
    setEditingRoutineId(routine.id);
    setEditingRoutineText(routine.text);
    setEditingRoutineGroup(routine.group);
  }

  function cancelRoutineEdit() {
    setEditingRoutineId(null);
    setEditingRoutineText("");
    setEditingRoutineGroup("morning");
  }

  function saveRoutineEdit() {
    if (!editingRoutineId) return;
    const text = editingRoutineText.trim();
    if (!text) return;
    setRoutines((prev) =>
      prev.map((item) =>
        item.id === editingRoutineId
          ? { ...item, text, group: editingRoutineGroup }
          : item,
      ),
    );
    cancelRoutineEdit();
  }

  function parseIcsDateTime(raw: string) {
    const value = raw.trim();
    if (/^\d{8}$/.test(value)) {
      const y = Number(value.slice(0, 4));
      const m = Number(value.slice(4, 6));
      const d = Number(value.slice(6, 8));
      return new Date(y, m - 1, d, 9, 0, 0);
    }
    if (/^\d{8}T\d{6}Z$/.test(value)) {
      const y = Number(value.slice(0, 4));
      const m = Number(value.slice(4, 6));
      const d = Number(value.slice(6, 8));
      const h = Number(value.slice(9, 11));
      const min = Number(value.slice(11, 13));
      const s = Number(value.slice(13, 15));
      return new Date(Date.UTC(y, m - 1, d, h, min, s));
    }
    if (/^\d{8}T\d{6}$/.test(value)) {
      const y = Number(value.slice(0, 4));
      const m = Number(value.slice(4, 6));
      const d = Number(value.slice(6, 8));
      const h = Number(value.slice(9, 11));
      const min = Number(value.slice(11, 13));
      const s = Number(value.slice(13, 15));
      return new Date(y, m - 1, d, h, min, s);
    }
    return null;
  }

  function parseIcsEvents(icsText: string) {
    const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
    const lines = unfolded.split(/\r?\n/);
    const events: Array<{ id: string; title: string; start: Date; allDay: boolean }> = [];
    let inEvent = false;
    let uid = "";
    let summary = "";
    let dtStart = "";
    let dtStartAllDay = false;

    for (const line of lines) {
      if (line === "BEGIN:VEVENT") {
        inEvent = true;
        uid = "";
        summary = "";
        dtStart = "";
        dtStartAllDay = false;
        continue;
      }
      if (line === "END:VEVENT") {
        if (inEvent && dtStart) {
          const parsed = parseIcsDateTime(dtStart);
          if (parsed) {
            events.push({
              id: uid || createId(),
              title: summary || "(제목 없음)",
              start: parsed,
              allDay: dtStartAllDay,
            });
          }
        }
        inEvent = false;
        continue;
      }
      if (!inEvent) continue;
      if (line.startsWith("UID:")) {
        uid = line.slice(4).trim();
      } else if (line.startsWith("SUMMARY:")) {
        summary = line.slice(8).trim();
      } else if (line.startsWith("DTSTART")) {
        const [, raw = ""] = line.split(":");
        dtStart = raw.trim();
        dtStartAllDay = line.includes("VALUE=DATE");
      }
    }
    return events;
  }

  function extractIcsCalendarName(icsText: string) {
    const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
    const line = unfolded
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("X-WR-CALNAME:"));
    if (!line) return null;
    return line.slice("X-WR-CALNAME:".length).trim() || null;
  }

  function getAppleCalendarFallbackName(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return "Apple";
    }
  }

  function addAppleIcsUrl() {
    const normalized = normalizeIcsUrl(appleIcsInput);
    if (!normalized) {
      setAppleError("Apple 캘린더 ICS URL을 입력해 주세요.");
      return;
    }
    if (!/^https?:\/\//i.test(normalized)) {
      setAppleError("ICS URL은 webcal:// 또는 http(s):// 형식이어야 해요.");
      return;
    }
    setAppleIcsUrls((prev) => {
      if (prev.includes(normalized)) return prev;
      return [...prev, normalized];
    });
    setAppleIcsInput("");
    setAppleError(null);
  }

  function removeAppleIcsUrl(targetUrl: string) {
    setAppleIcsUrls((prev) => prev.filter((url) => url !== targetUrl));
  }

  async function fetchSingleAppleIcsEvents(url: string, startDate: string, endDate: string) {
    const res = await fetch(`/api/ics?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Apple 캘린더 동기화 실패(${res.status}): ${detail.slice(0, 120)}`);
    }
    const data = (await res.json()) as { text?: string };
    const icsText = data.text ?? "";
    const calendarName = extractIcsCalendarName(icsText) ?? getAppleCalendarFallbackName(url);
    const sourceKey = Math.abs(
      Array.from(url).reduce((acc, char) => acc * 31 + char.charCodeAt(0), 7),
    )
      .toString(36)
      .slice(0, 8);
    return parseIcsEvents(icsText)
      .filter((event) => {
        const dateKey = event.start.toISOString().slice(0, 10);
        return dateKey >= startDate && dateKey <= endDate;
      })
      .map((event) => {
        const date = event.start.toISOString().slice(0, 10);
        return {
          id: `apple-${sourceKey}-${event.id}`,
          title: event.title,
          date,
          time: event.allDay ? "종일" : toTimeLabel(event.start.toISOString()),
          source: "apple" as const,
          calendarName,
          calendarColor: "#a3a3a3",
        } satisfies ScheduleViewItem;
      });
  }

  async function syncAppleIcsEvents(
    startDate: string,
    endDate: string,
    rangeLabel: string,
    targetUrls?: string[],
  ) {
    const urls =
      (targetUrls ?? appleIcsUrls)
        .map((url) => normalizeIcsUrl(url))
        .filter((url) => /^https?:\/\//i.test(url)) ?? [];
    if (urls.length === 0) {
      setAppleError("Apple 캘린더 ICS URL을 먼저 추가해 주세요.");
      setAppleSchedules([]);
      setAppleSyncInfo(null);
      return;
    }
    setAppleSyncing(true);
    setAppleError(null);
    try {
      const settled = await Promise.allSettled(
        urls.map((url) => fetchSingleAppleIcsEvents(url, startDate, endDate)),
      );
      const successItems: ScheduleViewItem[] = settled.flatMap((entry) =>
        entry.status === "fulfilled" ? entry.value : [],
      );
      const failedItems = settled.filter((entry) => entry.status === "rejected");

      const sortedItems = successItems.sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
      );
      setAppleSchedules(sortedItems);
      setAppleSyncInfo(
        `Apple ${urls.length}개 캘린더 · ${rangeLabel}(${startDate}~${endDate}) 일정 ${sortedItems.length}개`,
      );
      if (failedItems.length > 0) {
        const firstError = failedItems[0].reason;
        const firstMessage =
          firstError instanceof Error ? firstError.message : "일부 캘린더 동기화에 실패했어요.";
        setAppleError(
          `Apple ${failedItems.length}개 캘린더 동기화 실패: ${firstMessage}`,
        );
      }
    } catch (error) {
      setAppleSchedules([]);
      setAppleSyncInfo(null);
      setAppleError(error instanceof Error ? error.message : "Apple 캘린더 동기화에 실패했어요.");
    } finally {
      setAppleSyncing(false);
    }
  }

  async function createGoogleEvent(
    token: string,
    calendarId: string,
    title: string,
    date: string,
    startTime: string,
    endTime: string,
    location?: string,
    note?: string,
  ) {
    const [hour, minute] = startTime.split(":");
    const [endHour, endMinute] = endTime.split(":");
    const startAt = new Date(`${date}T${hour}:${minute}:00`);
    const endAt = new Date(`${date}T${endHour}:${endMinute}:00`);
    const safeEndAt = endAt > startAt ? endAt : new Date(startAt.getTime() + 60 * 60 * 1000);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: title,
          location: location?.trim() || undefined,
          description: note?.trim() || undefined,
          start: { dateTime: startAt.toISOString(), timeZone },
          end: { dateTime: safeEndAt.toISOString(), timeZone },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Google 일정 추가 실패(${res.status}): ${detail.slice(0, 100)}`);
    }
    const created = (await res.json()) as { id?: string };
    return { eventId: created.id ?? "", calendarId };
  }

  async function deleteGoogleEvent(token: string, calendarId: string, eventId: string) {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!res.ok && res.status !== 404) {
      const detail = await res.text();
      throw new Error(`Google 일정 삭제 실패(${res.status}): ${detail.slice(0, 100)}`);
    }
  }

  async function updateGoogleEvent(
    token: string,
    calendarId: string,
    eventId: string,
    title: string,
    date: string,
    startTime: string,
    endTime: string,
    location?: string,
    note?: string,
  ) {
    const [hour, minute] = startTime.split(":");
    const [endHour, endMinute] = endTime.split(":");
    const startAt = new Date(`${date}T${hour}:${minute}:00`);
    const endAt = new Date(`${date}T${endHour}:${endMinute}:00`);
    const safeEndAt = endAt > startAt ? endAt : new Date(startAt.getTime() + 60 * 60 * 1000);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: title,
          location: location?.trim() || undefined,
          description: note?.trim() || undefined,
          start: { dateTime: startAt.toISOString(), timeZone },
          end: { dateTime: safeEndAt.toISOString(), timeZone },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Google 일정 수정 실패(${res.status}): ${detail.slice(0, 120)}`);
    }
  }

  async function saveScheduleEntry(payload: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    note: string;
  }) {
    const value = payload.title.trim();
    if (!value) return;
    let createdGoogle: { eventId: string; calendarId: string } | null = null;
    if (scheduleAddTarget === "google" || scheduleAddTarget === "both") {
      if (!googleAccessToken) {
        setGoogleError("Google에 저장하려면 먼저 Google 연결이 필요해요.");
      } else {
        try {
          createdGoogle = await createGoogleEvent(
            googleAccessToken,
            googleTargetCalendarId || "primary",
            value,
            payload.date,
            payload.startTime,
            payload.endTime,
            payload.location,
            payload.note,
          );
          await syncGoogleTodayEvents(
            googleAccessToken,
            undefined,
            currentRange.start,
            currentRange.end,
            currentRange.label,
            googleCalendarFilterIds,
          );
        } catch (error) {
          setGoogleError(
            error instanceof Error ? error.message : "Google 일정 추가에 실패했어요.",
          );
        }
      }
    }
    if (scheduleAddTarget === "local" || scheduleAddTarget === "both") {
      setScheduleItems((prev) => [
        ...prev,
        {
          id: createId(),
          title: value,
          date: payload.date,
          time: payload.startTime,
          endTime: payload.endTime,
          location: payload.location.trim(),
          note: payload.note.trim(),
          googleCalendarId: createdGoogle?.calendarId || undefined,
          googleEventId: createdGoogle?.eventId || undefined,
        },
      ]);
    }
  }

  async function addSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = scheduleTitleInput.trim();
    if (!value) return;
    setScheduleSubmitting(true);
    try {
      await saveScheduleEntry({
        title: value,
        date: scheduleDateInput,
        startTime: scheduleTimeInput,
        endTime: scheduleEndTimeInput,
        location: scheduleLocationInput,
        note: scheduleNoteInput,
      });
    } finally {
      setScheduleSubmitting(false);
    }
    setScheduleTitleInput("");
    setScheduleLocationInput("");
    setScheduleNoteInput("");
  }

  async function fetchGoogleCalendarList(token: string) {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new Error(`캘린더 목록 조회 실패(${res.status})`);
    }
    const data = (await res.json()) as {
      items?: Array<{ id?: string; summary?: string; backgroundColor?: string; accessRole?: string }>;
    };
    const calendars =
      data.items
        ?.filter((item) => item.id && item.summary)
        .map((item) => ({
          id: item.id!,
          summary: item.summary!,
          backgroundColor: item.backgroundColor,
        })) ?? [];
    if (calendars.length > 0 && !calendars.find((item) => item.id === googleTargetCalendarId)) {
      const primary = calendars.find((item) => item.id === "primary");
      setGoogleTargetCalendarId((primary ?? calendars[0]).id);
    }
    setGoogleCalendarFilterIds((prev) => {
      if (calendars.length === 0) return [];
      if (prev.length === 0) return calendars.map((item) => item.id);
      const filtered = prev.filter((id) => calendars.some((cal) => cal.id === id));
      return filtered.length > 0 ? filtered : calendars.map((item) => item.id);
    });
    setGoogleCalendars(calendars);
    return calendars;
  }

  async function syncGoogleTodayEvents(
    token: string,
    calendars?: GoogleCalendarMeta[],
    targetStartDate?: string,
    targetEndDate?: string,
    rangeLabel?: string,
    selectedCalendarIds?: string[],
  ) {
    setGoogleSyncing(true);
    setGoogleError(null);
    try {
      const targetCalendars =
        calendars && calendars.length > 0
          ? calendars
          : googleCalendars.length > 0
            ? googleCalendars
            : await fetchGoogleCalendarList(token);
      const activeIds =
        selectedCalendarIds && selectedCalendarIds.length > 0
          ? selectedCalendarIds
          : googleCalendarFilterIds;
      const visibleCalendars =
        activeIds.length === 0
          ? targetCalendars
          : targetCalendars.filter((cal) => activeIds.includes(cal.id));

      if (visibleCalendars.length === 0) {
        setGoogleTodaySchedules([]);
        setGoogleSyncInfo("표시할 Google 캘린더가 선택되지 않았습니다.");
        return;
      }
      const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
      const startDate = targetStartDate ?? range.start;
      const endDate = targetEndDate ?? range.end;
      const label = rangeLabel ?? range.label;
      const dayStart = new Date(`${startDate}T00:00:00`);
      const dayEnd = new Date(`${endDate}T23:59:59.999`);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const timeMin = dayStart.toISOString();
      const timeMax = dayEnd.toISOString();
      const calendarCounts: Array<{ name: string; count: number }> = [];
      const eventLists = await Promise.all(
        visibleCalendars.map(async (cal) => {
          const url =
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events` +
            `?timeMin=${encodeURIComponent(timeMin)}` +
            `&timeMax=${encodeURIComponent(timeMax)}` +
            `&timeZone=${encodeURIComponent(timeZone)}` +
            "&singleEvents=true&orderBy=startTime";
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const detail = await res.text();
            if (res.status === 401) {
              throw new Error("Google 연결이 만료됐어요. 다시 연결해 주세요.");
            }
            if (res.status === 403) {
              throw new Error("Google Calendar 권한이 없어요. OAuth 범위/테스트사용자를 확인해 주세요.");
            }
            throw new Error(`Google API 오류(${res.status}): ${detail.slice(0, 120)}`);
          }
          const data = (await res.json()) as {
            items?: Array<{
              id?: string;
              summary?: string;
              location?: string;
              description?: string;
              start?: { date?: string; dateTime?: string };
              end?: { date?: string; dateTime?: string };
            }>;
          };
          const items =
            data.items?.map((event): ScheduleViewItem => {
              const startDate =
                event.start?.date ?? event.start?.dateTime?.slice(0, 10) ?? scheduleDateInput;
              const startTime = event.start?.dateTime
                ? toTimeLabel(event.start.dateTime)
                : "종일";
              const endTime = event.end?.dateTime ? toTimeLabel(event.end.dateTime) : undefined;
              return {
                id: `google-${cal.id}-${event.id ?? createId()}`,
                title: event.summary?.trim() || "(제목 없음)",
                date: startDate,
                time: startTime,
                endTime,
                location: event.location ?? "",
                note: event.description ?? "",
                source: "google",
                calendarName: cal.summary,
                calendarColor: cal.backgroundColor,
                googleCalendarId: cal.id,
                googleEventId: event.id,
              };
            }) ?? [];
          calendarCounts.push({ name: cal.summary, count: items.length });
          return items;
        }),
      );
      const mapped = eventLists.flat();
      setGoogleTodaySchedules(mapped);
      const topCalendars = calendarCounts
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((item) => `${item.name} ${item.count}개`)
        .join(" · ");
      setGoogleSyncInfo(
        `Google ${visibleCalendars.length}개 캘린더 · ${label}(${startDate}~${endDate}) 일정 ${mapped.length}개${topCalendars ? ` (${topCalendars})` : ""}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google 일정 동기화에 실패했어요.";
      setGoogleError(message);
      setGoogleTodaySchedules([]);
      setGoogleSyncInfo(null);
    } finally {
      setGoogleSyncing(false);
    }
  }

  function requestGoogleAccessToken(prompt: "" | "consent") {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setGoogleError("환경변수 NEXT_PUBLIC_GOOGLE_CLIENT_ID가 필요해요.");
      return;
    }
    const googleObj = (window as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
            }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          };
        };
      };
    }).google;
    if (!googleObj?.accounts?.oauth2?.initTokenClient) {
      setGoogleError("Google 인증 모듈이 아직 로드되지 않았어요. 잠시 후 다시 눌러주세요.");
      return;
    }
    const tokenClient = googleObj.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CAL_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          setGoogleError("Google 계정 연결에 실패했어요.");
          return;
        }
        const accessToken = resp.access_token;
        const expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000;
        setGoogleAccessToken(accessToken);
        setGoogleTokenExpiresAt(expiresAt);
        void (async () => {
          const calendars = await fetchGoogleCalendarList(accessToken);
          const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
          await syncGoogleTodayEvents(
            accessToken,
            calendars,
            range.start,
            range.end,
            range.label,
            googleCalendarFilterIds,
          );
        })();
      },
    });
    tokenClient.requestAccessToken({ prompt });
  }

  async function connectGoogleCalendar() {
    requestGoogleAccessToken(googleAccessToken ? "" : "consent");
  }

  function disconnectGoogleCalendar() {
    setGoogleAccessToken("");
    setGoogleTokenExpiresAt(0);
    setGoogleTodaySchedules([]);
    setGoogleCalendars([]);
    setGoogleError(null);
    setGoogleSyncInfo(null);
  }

  function toggleGoogleCalendarFilter(calendarId: string) {
    setGoogleCalendarFilterIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId],
    );
  }

  function openGoogleCalendarWeb() {
    const [y, m, d] = scheduleDateInput.split("-").map(Number);
    const modePath =
      scheduleViewMode === "day"
        ? "day"
        : scheduleViewMode === "week"
          ? "week"
          : "month";
    const url = `https://calendar.google.com/calendar/u/0/r/${modePath}/${y}/${m}/${d}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openPhoneCalendarApp() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) {
      const target = new Date(`${scheduleDateInput}T00:00:00`);
      const appleEpoch = new Date("2001-01-01T00:00:00Z");
      const days = Math.floor((target.getTime() - appleEpoch.getTime()) / 86400000);
      window.location.href = `calshow:${days}`;
      return;
    }
    if (/Android/i.test(ua)) {
      // Best effort deep-link for Android calendar apps; fallback to web calendar.
      window.location.href = "content://com.android.calendar/time/";
      window.setTimeout(() => openGoogleCalendarWeb(), 250);
      return;
    }
    openGoogleCalendarWeb();
  }

  async function handleDeleteSchedule(item: ScheduleViewItem) {
    if (item.source === "apple") return;
    setScheduleDeletingId(item.id);
    try {
      if (item.source === "google") {
        if (!googleAccessToken) {
          setGoogleError("Google 삭제를 하려면 먼저 Google 연결이 필요해요.");
          return;
        }
        if (item.googleCalendarId && item.googleEventId) {
          await deleteGoogleEvent(
            googleAccessToken,
            item.googleCalendarId,
            item.googleEventId,
          );
        }
        const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
        await syncGoogleTodayEvents(
          googleAccessToken,
          undefined,
          range.start,
          range.end,
          range.label,
          googleCalendarFilterIds,
        );
        return;
      }

      if (item.googleCalendarId && item.googleEventId && googleAccessToken) {
        await deleteGoogleEvent(
          googleAccessToken,
          item.googleCalendarId,
          item.googleEventId,
        );
      }
      setScheduleItems((prev) => prev.filter((entry) => entry.id !== item.id));
      if (googleAccessToken) {
        const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
        await syncGoogleTodayEvents(
          googleAccessToken,
          undefined,
          range.start,
          range.end,
          range.label,
          googleCalendarFilterIds,
        );
      }
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : "일정 삭제에 실패했어요.");
    } finally {
      setScheduleDeletingId(null);
    }
  }

  function openScheduleEdit(item: ScheduleViewItem) {
    if (item.source === "apple") return;
    setEditingSchedule(item);
    setScheduleEditTitleInput(item.title);
    setScheduleEditDateInput(item.date);
    setScheduleEditTimeInput(item.time === "종일" ? "09:00" : item.time);
    setScheduleEditEndTimeInput(item.endTime && item.endTime !== "종일" ? item.endTime : "10:00");
    setScheduleEditLocationInput(item.location ?? "");
    setScheduleEditNoteInput(item.note ?? "");
  }

  function closeScheduleEdit() {
    setEditingSchedule(null);
    setScheduleEditingId(null);
  }

  async function saveScheduleEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSchedule) return;
    const title = scheduleEditTitleInput.trim();
    if (!title) return;
    setScheduleEditingId(editingSchedule.id);
    try {
      const nextDate = scheduleEditDateInput;
      const nextTime = scheduleEditTimeInput;
      const nextEndTime = scheduleEditEndTimeInput;
      const googleCalendarId = editingSchedule.googleCalendarId;
      const googleEventId = editingSchedule.googleEventId;

      if (googleCalendarId && googleEventId) {
        if (!googleAccessToken) {
          setGoogleError("Google 일정을 수정하려면 먼저 Google 연결이 필요해요.");
          return;
        }
        await updateGoogleEvent(
          googleAccessToken,
          googleCalendarId,
          googleEventId,
          title,
          nextDate,
          nextTime,
          nextEndTime,
          scheduleEditLocationInput,
          scheduleEditNoteInput,
        );
      }

      if (editingSchedule.source === "local") {
        setScheduleItems((prev) =>
          prev.map((item) =>
            item.id === editingSchedule.id
              ? {
                  ...item,
                  title,
                  date: nextDate,
                  time: nextTime,
                  endTime: nextEndTime,
                  location: scheduleEditLocationInput.trim(),
                  note: scheduleEditNoteInput.trim(),
                }
              : item,
          ),
        );
      } else {
        setScheduleItems((prev) =>
          prev.map((item) =>
            item.googleEventId === googleEventId
              ? {
                  ...item,
                  title,
                  date: nextDate,
                  time: nextTime,
                  endTime: nextEndTime,
                  location: scheduleEditLocationInput.trim(),
                  note: scheduleEditNoteInput.trim(),
                }
              : item,
          ),
        );
      }

      if (googleAccessToken) {
        const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
        await syncGoogleTodayEvents(
          googleAccessToken,
          undefined,
          range.start,
          range.end,
          range.label,
          googleCalendarFilterIds,
        );
      }

      closeScheduleEdit();
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : "일정 수정에 실패했어요.");
    } finally {
      setScheduleEditingId(null);
    }
  }

  useEffect(() => {
    if (!googleAccessToken) return;
    if (googleTokenExpiresAt && googleTokenExpiresAt <= Date.now()) {
      setGoogleAccessToken("");
      setGoogleTokenExpiresAt(0);
      return;
    }
    const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
    void syncGoogleTodayEvents(
      googleAccessToken,
      undefined,
      range.start,
      range.end,
      range.label,
      googleCalendarFilterIds,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, googleAccessToken, scheduleDateInput, scheduleViewMode, googleCalendarFilterIds]);

  useEffect(() => {
    if (!googleCalendarReady) return;
    if (googleAccessToken) return;
    if (!googleAutoSyncEnabled && !isSchedulePanelOpen) return;
    requestGoogleAccessToken("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleCalendarReady, googleAccessToken, googleAutoSyncEnabled, isSchedulePanelOpen]);

  useEffect(() => {
    if (!googleAccessToken) return;
    if (hasAutoSyncedOnEntryRef.current) return;
    if (googleTokenExpiresAt && googleTokenExpiresAt <= Date.now()) return;
    hasAutoSyncedOnEntryRef.current = true;
    const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
    void syncGoogleTodayEvents(
      googleAccessToken,
      undefined,
      range.start,
      range.end,
      range.label,
      googleCalendarFilterIds,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleAccessToken, googleTokenExpiresAt]);

  useEffect(() => {
    if (!isSchedulePanelOpen) {
      wasSchedulePanelOpenRef.current = false;
      return;
    }
    if (wasSchedulePanelOpenRef.current) return;
    wasSchedulePanelOpenRef.current = true;
    const now = currentTimeHHmm();
    setScheduleTimeInput(now);
    setScheduleEndTimeInput(addMinutesToHHmm(now, 60));
    if (!googleAccessToken) return;
    if (googleTokenExpiresAt && googleTokenExpiresAt <= Date.now()) return;
    const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
    void syncGoogleTodayEvents(
      googleAccessToken,
      undefined,
      range.start,
      range.end,
      range.label,
      googleCalendarFilterIds,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSchedulePanelOpen, googleAccessToken, googleTokenExpiresAt, scheduleDateInput, scheduleViewMode, googleCalendarFilterIds]);

  async function startTimeTracking() {
    if (activeTracking) return;
    const now = new Date();
    const nowTime = toHHmm(now);
    setScheduleDateInput(toLocalDateKey(now));
    setScheduleTimeInput(nowTime);
    setScheduleEndTimeInput(addMinutesToHHmm(nowTime, 60));
    setActiveTracking({
      startedAt: now.toISOString(),
      title: scheduleTitleInput.trim() || "타임트래킹",
      location: scheduleLocationInput.trim(),
      note: scheduleNoteInput.trim(),
    });
  }

  async function stopTimeTrackingAndSave() {
    if (!activeTracking) return;
    setScheduleSubmitting(true);
    try {
      const start = new Date(activeTracking.startedAt);
      const end = new Date();
      const startDate = toLocalDateKey(start);
      const startTime = toHHmm(start);
      const endTime = toHHmm(end);
      setScheduleDateInput(startDate);
      setScheduleTimeInput(startTime);
      setScheduleEndTimeInput(endTime);
      await saveScheduleEntry({
        title: activeTracking.title,
        date: startDate,
        startTime,
        endTime,
        location: activeTracking.location,
        note: activeTracking.note,
      });
      setScheduleTitleInput("");
      setScheduleLocationInput("");
      setScheduleNoteInput("");
      setActiveTracking(null);
    } finally {
      setScheduleSubmitting(false);
    }
  }

  useEffect(() => {
    if (appleIcsUrls.length === 0) {
      setAppleSchedules([]);
      setAppleSyncInfo(null);
      return;
    }
    const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
    void syncAppleIcsEvents(range.start, range.end, range.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, appleIcsUrls, scheduleDateInput, scheduleViewMode]);

  useEffect(() => {
    if (!googleAccessToken || !googleAutoSyncEnabled) return;
    const interval = window.setInterval(() => {
      const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
      void syncGoogleTodayEvents(
        googleAccessToken,
        undefined,
        range.start,
        range.end,
        range.label,
        googleCalendarFilterIds,
      );
    }, 120000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleAccessToken, googleAutoSyncEnabled, scheduleDateInput, scheduleViewMode, googleCalendarFilterIds]);

  function saveOneThing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOneThing({
      title: oneThingInput.trim(),
      next: nextInput.trim(),
      keepGoing: keepGoingInput.trim(),
    });
    setOneThingInput("");
    setNextInput("");
    setKeepGoingInput("");
  }

  function toggleTodo(id: string) {
    let checked = false;
    setTodos((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextDone = !item.done;
        if (nextDone && !item.done) checked = true;
        return { ...item, done: nextDone };
      }),
    );
    if (checked) celebrate();
  }

  function toggleRoutine(id: string) {
    let checked = false;
    setRoutines((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextDate = item.completedOn === today ? null : today;
        if (nextDate === today && item.completedOn !== today) checked = true;
        return { ...item, completedOn: nextDate };
      }),
    );
    if (checked) celebrate();
  }

  function moveRoutine(id: string, direction: "up" | "down") {
    setRoutines((prev) => {
      const currentIndex = prev.findIndex((item) => item.id === id);
      if (currentIndex < 0) return prev;
      const group = prev[currentIndex].group;
      const groupIndexes = prev
        .map((item, index) => ({ group: item.group, index }))
        .filter((entry) => entry.group === group)
        .map((entry) => entry.index);
      const positionInGroup = groupIndexes.indexOf(currentIndex);
      if (positionInGroup < 0) return prev;
      const nextPosition =
        direction === "up" ? positionInGroup - 1 : positionInGroup + 1;
      if (nextPosition < 0 || nextPosition >= groupIndexes.length) return prev;
      const targetIndex = groupIndexes[nextPosition];
      const next = [...prev];
      const temp = next[currentIndex];
      next[currentIndex] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  }

  function moveTodoGroup(id: string, linkedToOneThing: boolean) {
    setTodos((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, linkedToOneThing: !linkedToOneThing } : item,
      ),
    );
  }

  function startTodoEdit(todo: Todo) {
    setEditingTodoId(todo.id);
    setEditingTodoText(todo.text);
    setEditingTodoDueDate(todo.dueDate ?? "");
  }

  function cancelTodoEdit() {
    setEditingTodoId(null);
    setEditingTodoText("");
    setEditingTodoDueDate("");
  }

  function saveTodoEdit() {
    if (!editingTodoId) return;
    const nextText = editingTodoText.trim();
    if (!nextText) return;
    setTodos((prev) =>
      prev.map((item) =>
        item.id === editingTodoId
          ? {
              ...item,
              text: nextText,
              dueDate: editingTodoDueDate.trim() ? editingTodoDueDate : null,
            }
          : item,
      ),
    );
    cancelTodoEdit();
  }

  function toggleTodoExpanded(id: string) {
    setTodoExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function saveDailyReport() {
    const payload: DailyReport = {
      date: today,
      createdAt: new Date().toISOString(),
      oneThing,
      good: reportGoodInput.trim() || mtsFeedback.good,
      problem: reportProblemInput.trim() || mtsFeedback.problem,
      tryNext: reportTryInput.trim() || mtsFeedback.nextTry,
      todoDone: todoStats.done,
      todoTotal: todoStats.total,
      routineDone: routineStats.done,
      routineTotal: routineStats.total,
      progressPercent,
      momentum,
      routineRecords: routines.map((routine) => ({
        id: routine.id,
        text: routine.text,
        group: routine.group,
        completed: routine.completedOn === today,
      })),
    };
    setReports((prev) => {
      const next = [...prev];
      const index = next.findIndex((item) => item.date === today);
      if (index >= 0) {
        next[index] = payload;
      } else {
        next.unshift(payload);
      }
      return next.slice(0, 730);
    });
  }

  function renderTodoCard(
    title: string,
    list: Todo[],
    linkedToOneThing: boolean,
    emoji: string,
    embedded = false,
  ) {
    const getDeadlineDays = (todo: Todo) => {
      if (todo.kind === "project" && todo.projectEndDate) return daysLeft(todo.projectEndDate);
      if (todo.kind === "date" && todo.dueDate) return daysLeft(todo.dueDate);
      return null;
    };

    const sortedList = [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const aDeadline = getDeadlineDays(a);
      const bDeadline = getDeadlineDays(b);
      if (aDeadline !== null && bDeadline !== null) return aDeadline - bDeadline;
      if (aDeadline !== null) return -1;
      if (bDeadline !== null) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    const activeList = sortedList.filter((todo) => !todo.done);
    const doneList = sortedList.filter((todo) => todo.done);

    return (
      <article
        className={`flex w-full min-w-0 flex-col rounded-lg border border-[#eeeeee] bg-white/80 ${
          embedded ? "h-full p-2" : "p-4"
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className={`${embedded ? "text-sm" : "text-base"} font-semibold`}>
            <span className="mr-1 text-lg">{emoji}</span>
            {title}
          </h3>
          <button
            type="button"
            className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
            onClick={() => setDoneTodoModal({ title, items: doneList })}
          >
            완료 {doneList.length}
          </button>
        </div>
        {linkedToOneThing ? (
          <div className="mb-2 flex w-full min-w-0 max-w-full flex-col gap-1 rounded-md border border-[#dddddd] bg-white px-2 py-1.5 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-1.5">
            <p className="text-xs font-medium text-[#444444]">OneThing 프로젝트 필터</p>
            <select
              className="h-8 w-full min-w-0 max-w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm"
              value={oneThingProjectFilter}
              onChange={(e) =>
                setOneThingProjectFilter(e.target.value as OneThingProjectFilter)
              }
            >
              <option value="all">전체</option>
              <option value="none">프로젝트 없음</option>
              {oneThingProjectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <ul
          className={`${
            embedded ? "min-h-0 flex-1" : "h-[170px]"
          } min-w-0 space-y-2 overflow-y-auto rounded-md border border-[#dddddd] bg-white p-2`}
        >
          {activeList.length === 0 ? (
            <li className="rounded-md border border-[#eeeeee] bg-white px-2 py-2 text-xs text-[#777777]">
              진행중 할 일이 없습니다.
            </li>
          ) : null}
          {activeList.map((todo) => {
            const linkedProject =
              todo.projectId &&
              projects.find((project) => project.id === todo.projectId);
            const deadlineDays =
              todo.kind === "project" && todo.projectEndDate
                ? daysLeft(todo.projectEndDate)
                : todo.kind === "date" && todo.dueDate
                  ? daysLeft(todo.dueDate)
                : null;
            const isUrgentDeadline =
              deadlineDays !== null && (deadlineDays === 0 || deadlineDays === 1);
            const isExpanded = Boolean(todoExpandedMap[todo.id]);
            return (
              <li
                key={todo.id}
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <label className="flex min-w-0 items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span
                      className={`block min-w-0 flex-1 truncate whitespace-nowrap ${
                        todo.done
                          ? "text-stone-400 line-through"
                          : isUrgentDeadline
                            ? "font-semibold text-red-600"
                            : ""
                      }`}
                    >
                      {todo.text}
                    </span>
                  </label>
                  <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                    <button
                      type="button"
                      className="rounded-md border border-[#dddddd] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#444444]"
                      onClick={() => toggleTodoExpanded(todo.id)}
                      title={isExpanded ? "접기" : "펼치기"}
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-[#dddddd] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#444444]"
                      onClick={() => {
                        startTodoEdit(todo);
                        if (!isExpanded) toggleTodoExpanded(todo.id);
                      }}
                      title="수정"
                    >
                      수정
                    </button>
                  </div>
                </div>
                {isExpanded ? (
                  <div className="mt-2 space-y-1.5">
                    {editingTodoId === todo.id ? (
                      <div className="space-y-1">
                        <input
                          className="w-full rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                          value={editingTodoText}
                          onChange={(e) => setEditingTodoText(e.target.value)}
                        />
                        <input
                          type="date"
                          className="w-full rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                          value={editingTodoDueDate}
                          onChange={(e) => setEditingTodoDueDate(e.target.value)}
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                            onClick={saveTodoEdit}
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                            onClick={cancelTodoEdit}
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                            onClick={() => moveTodoGroup(todo.id, linkedToOneThing)}
                          >
                            이동
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                            onClick={() =>
                              setTodos((prev) => prev.filter((item) => item.id !== todo.id))
                            }
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[#444444]">
                        {todoKindLabel[todo.kind]}
                      </span>
                      {todo.dueDate ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[#444444]">
                          {toKoreanDate(todo.dueDate)}
                        </span>
                      ) : null}
                      {todo.kind === "project" &&
                      todo.projectStartDate &&
                      todo.projectEndDate ? (
                        <span className="rounded-full bg-sky-50 px-2 py-1 text-[#444444]">
                          {toKoreanDate(todo.projectStartDate)} ~{" "}
                          {toKoreanDate(todo.projectEndDate)}
                        </span>
                      ) : null}
                      {linkedProject ? (
                        <span className="rounded-full bg-purple-50 px-2 py-1 text-[#444444]">
                          {linkedProject.title}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </article>
    );
  }

  const currentTheme = themePalette[theme];
  const currentAccent = accentPalette[accentTone];
  const primaryButtonStyle = {
    backgroundColor: currentAccent.accent,
    color: "#444444",
  };
  const softButtonStyle = {
    backgroundColor: currentAccent.soft,
    color: "#444444",
  };
  const pageStyle: CSSProperties & Record<string, string> = {
    background: currentTheme.background,
    ...currentTheme.vars,
    "--accent": currentAccent.accent,
    "--accent-soft": currentAccent.soft,
  };
  const allGoogleCalendarsSelected =
    googleCalendars.length > 0 &&
    googleCalendarFilterIds.length === googleCalendars.length;
  const calloutBackdropStyle =
    calloutBackground.trim().length > 0
      ? {
          backgroundImage: `linear-gradient(rgba(255,255,255,0.86), rgba(255,255,255,0.86)), url(${calloutBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined;

  return (
    <div className="min-h-screen px-3 py-4 md:px-5 md:py-8" style={pageStyle}>
      <main
        className="mx-auto min-h-[calc(100dvh-7.25rem)] max-w-6xl overflow-visible rounded-lg border border-line bg-surface/95 p-4 text-sm shadow-[0_18px_40px_rgba(20,19,17,0.08)] backdrop-blur-sm md:h-[calc(100dvh-7.25rem)] md:overflow-hidden md:p-5"
        style={
          calloutBackdropStyle ?? {
            backgroundImage:
              "radial-gradient(circle at 10% 10%, rgba(255,255,255,0.8), transparent 35%), radial-gradient(circle at 90% 0%, rgba(255,255,255,0.6), transparent 40%), linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))",
          }
        }
      >
        <section className="relative mb-1 rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                ON:LY DASHBOARD
              </p>
              <h1 className="text-lg font-bold md:text-xl">
                <span className="mr-1 text-2xl align-[-2px]">🧭</span>오늘 정리
              </h1>
            </div>
          </div>
        </section>

        <section className="mb-1 grid gap-[5px] lg:grid-cols-3 lg:items-stretch">
          <article className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4 lg:h-[500px]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                <span className="mr-1 text-lg">🎯</span>오늘의 원씽 / 일정
              </h2>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-[#444444]">
                MTS Focus
              </span>
            </div>
            <div className="rounded-md border border-[#dddddd] bg-white p-2 text-xs text-[#444444]">
              <p>
                <span className="mr-1 text-[11px] text-rose-600">🔴</span>
                {oneThing.title || "-"}
              </p>
              <p className="mt-0.5">
                <span className="mr-1 text-[11px] text-blue-600">🔵</span>
                Next OneThing: {oneThing.next || "-"}
              </p>
              <p className="mt-0.5">
                <span className="mr-1 text-[11px] text-emerald-600">🟢</span>
                Keep Going: {oneThing.keepGoing || "-"}
              </p>
            </div>
            <form onSubmit={saveOneThing} className="space-y-1.5">
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <div className="space-y-1.5">
                  <input
                    className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1 text-xs outline-none focus:border-accent"
                    placeholder="오늘 반드시 끝낼 핵심 1개"
                    value={oneThingInput}
                    onChange={(e) => setOneThingInput(e.target.value)}
                  />
                  <input
                    className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1 text-xs outline-none focus:border-accent"
                    placeholder="다음 원씽"
                    value={nextInput}
                    onChange={(e) => setNextInput(e.target.value)}
                  />
                  <input
                    className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1 text-xs outline-none focus:border-accent"
                    placeholder="Keep Going"
                    value={keepGoingInput}
                    onChange={(e) => setKeepGoingInput(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="h-full rounded-md border border-transparent bg-accent px-2 py-1 text-xs font-medium text-[#444444] shadow-sm"
                  style={primaryButtonStyle}
                >
                  포커스 저장
                </button>
              </div>
            </form>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-[#444444]">
                🗓️ 오늘 일정 ({compactScheduleLabel})
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setIsSchedulePanelOpen(true)}
                  title="일정 입력/연동"
                  aria-label="일정 입력/연동"
                >
                  ✍🏻
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={openGoogleCalendarWeb}
                  title="Google 캘린더 열기"
                  aria-label="Google 캘린더 열기"
                >
                  💻
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={openPhoneCalendarApp}
                  title="핸드폰 캘린더 열기"
                  aria-label="핸드폰 캘린더 열기"
                >
                  📱
                </button>
              </div>
            </div>
            <ul className="mt-2 min-h-0 flex-1 divide-y divide-[#eeeeee] overflow-y-auto pr-1">
              {mergedSelectedDateSchedules.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-1 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                    {(scheduleViewMode === "day" ? "" : `${item.date} `) +
                      `${item.time} ${item.title}`}
                  </span>
                  {item.source === "apple" ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[10px] text-[#444444]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.calendarColor ?? "#9ca3af" }}
                      />
                      {item.calendarName ?? (item.source === "apple" ? "Apple" : "Google")}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      {item.source === "google" ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[10px] text-[#444444]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.calendarColor ?? "#9ca3af" }}
                          />
                          {item.calendarName ?? "Google"}
                        </span>
                      ) : null}
                      <button
                        className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] font-medium text-[#444444]"
                        onClick={() => openScheduleEdit(item)}
                        type="button"
                        disabled={scheduleEditingId === item.id}
                      >
                        수정
                      </button>
                      <button
                        className="rounded-md border border-transparent bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-[#444444]"
                        style={softButtonStyle}
                        onClick={() => void handleDeleteSchedule(item)}
                        type="button"
                        disabled={scheduleDeletingId === item.id}
                      >
                        {scheduleDeletingId === item.id ? "삭제중" : "삭제"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </article>

          <article className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4 lg:h-[500px]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                <span className="mr-1 text-lg">✅</span>투두 리스트
              </h2>
              <div className="flex items-center gap-1">
                <Link
                  href="/projects"
                  className="rounded-md border border-transparent bg-accent px-2 py-1 text-xs font-medium text-[#444444] shadow-sm"
                  style={primaryButtonStyle}
                >
                  프로젝트
                </Link>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setIsTodoInputOpen(true)}
                >
                  투두 입력
                </button>
              </div>
            </div>
            <div className="mt-1 flex flex-col gap-1 md:min-h-0 md:flex-1 md:grid md:grid-rows-[6fr_4fr] md:overflow-hidden">
              <div className="min-h-0">
                {renderTodoCard("OneThing Todo List", filteredOneThingTodos, true, "🎯", true)}
              </div>
              <div className="min-h-0">
                {renderTodoCard("Todo List", otherTodos, false, "🧩", true)}
              </div>
            </div>
          </article>

          <article className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4 lg:h-[500px]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                <span className="mr-1 text-lg">🔁</span>루틴 체크
              </h2>
              <button
                type="button"
                className="rounded-md border border-transparent bg-accent px-2 py-1 text-xs font-medium text-[#444444] shadow-sm"
                style={primaryButtonStyle}
                onClick={() => setIsRoutineInputOpen((prev) => !prev)}
                >
                  루틴 입력
                </button>
            </div>
            {isRoutineInputOpen ? (
              <div className="mb-2 rounded-md border border-[#dddddd] bg-white p-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#444444]">🔁 루틴 입력</h3>
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-xs text-[#444444]"
                    onClick={() => setIsRoutineInputOpen(false)}
                  >
                    닫기
                  </button>
                </div>
                <form className="mt-2 grid gap-2" onSubmit={addRoutine}>
                  <input
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="반복할 루틴 입력"
                    value={routineInput}
                    onChange={(e) => setRoutineInput(e.target.value)}
                  />
                  <select
                    className="h-9 rounded-md border border-[#dddddd] bg-white px-3 text-sm"
                    value={routineGroupInput}
                    onChange={(e) => setRoutineGroupInput(e.target.value as RoutineGroup)}
                  >
                    <option value="morning">Morning Routine</option>
                    <option value="day">Day Routine</option>
                    <option value="night">Night Routine</option>
                  </select>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-md border border-transparent bg-accent px-3 py-1 text-xs font-medium text-[#444444] shadow-sm"
                      style={primaryButtonStyle}
                    >
                      추가
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
            <div className="mb-2 rounded-md border border-[#dddddd] bg-white p-2 text-xs leading-[1.2] text-[#444444]">
              <p className="text-sm font-semibold">
                <span className="mr-1">🌱</span>성장 게이지
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="flex shrink-0 items-center gap-1">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-[#ebe7de]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${progressPercent}%`, backgroundColor: currentAccent.accent }}
                    />
                  </div>
                  <span className="text-xs text-[#666666]">{progressPercent}%</span>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-md border border-[#dddddd] bg-white px-1.5 py-0.5">
                  <div className="text-xs">{plant.emoji}</div>
                  <div className="text-xs font-semibold">{plant.label}</div>
                </div>
                <div className="ml-auto whitespace-nowrap text-xs text-[#666666]">
                  모멘텀 <span className="font-semibold text-[#444444]">{momentum}점</span>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <p className="text-xs text-[#666666]">7일 히트맵</p>
                <div className="flex items-center gap-1">
                  {sevenDayHeatCells.map((cell) => (
                    <div key={cell.date} className="flex items-center">
                      <div
                        className="h-2 w-2 rounded-full border border-[#dddddd]"
                        style={{
                          backgroundColor:
                            cell.percent >= 80
                              ? "#d9f8e8"
                              : cell.percent >= 60
                                ? "#e4f9d6"
                                : cell.percent >= 40
                                  ? "#f9f2cc"
                                  : cell.percent >= 20
                                    ? "#f6e8d6"
                                    : "#eeeeee",
                        }}
                        title={`${cell.date} ${cell.percent}%`}
                      />
                    </div>
                  ))}
                </div>
                <span className="ml-auto text-xs text-[#666666]">
                  주 {weeklyAvg}% · 월 {monthlyAvg}%
                </span>
              </div>
            </div>
            <div className="mb-2 grid grid-cols-3 gap-1">
              {(["morning", "day", "night"] as RoutineGroup[]).map((group) => (
                <button
                  key={group}
                  type="button"
                  className="rounded-md border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                  style={{
                    backgroundColor:
                      routinePanelTab === group ? currentAccent.soft : "#ffffff",
                  }}
                  onClick={() => setRoutinePanelTab(group)}
                >
                  {group === "morning" ? "모닝" : group === "day" ? "데이" : "나이트"}
                </button>
              ))}
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {routines
                .filter((routine) => routine.group === routinePanelTab)
                .map((routine) => {
                  const completedToday = routine.completedOn === today;
                  const isEditing = editingRoutineId === routine.id;
                  return (
                    <li
                      key={routine.id}
                      className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                    >
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            value={editingRoutineText}
                            onChange={(e) => setEditingRoutineText(e.target.value)}
                            className="w-full rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                          />
                          <div className="flex items-center gap-1">
                            <select
                              value={editingRoutineGroup}
                              onChange={(e) => setEditingRoutineGroup(e.target.value as RoutineGroup)}
                              className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                            >
                              <option value="morning">Morning</option>
                              <option value="day">Day</option>
                              <option value="night">Night</option>
                            </select>
                            <button
                              type="button"
                              className="rounded-md border border-transparent bg-accent px-2 py-1 text-xs font-medium text-[#444444]"
                              style={primaryButtonStyle}
                              onClick={saveRoutineEdit}
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                              onClick={cancelRoutineEdit}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-[#444444]">
                            <input
                              type="checkbox"
                              checked={completedToday}
                              onChange={() => toggleRoutine(routine.id)}
                            />
                            <span className={completedToday ? "line-through text-stone-400" : ""}>
                              {routine.text}
                            </span>
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                              onClick={() => moveRoutine(routine.id, "up")}
                              type="button"
                              title="위로 이동"
                            >
                              ↑
                            </button>
                            <button
                              className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                              onClick={() => moveRoutine(routine.id, "down")}
                              type="button"
                              title="아래로 이동"
                            >
                              ↓
                            </button>
                            <button
                              className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                              onClick={() => startRoutineEdit(routine)}
                              type="button"
                            >
                              수정
                            </button>
                            <button
                              className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-[#444444]"
                              style={softButtonStyle}
                              onClick={() =>
                                setRoutines((prev) =>
                                  prev.filter((item) => item.id !== routine.id),
                                )
                              }
                              type="button"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </article>
        </section>

        {isTodoInputOpen ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-3">
            <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#444444]">✅ 투두 입력</h3>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setIsTodoInputOpen(false)}
                >
                  닫기
                </button>
              </div>
              <form className="mt-3 space-y-1.5" onSubmit={addTodo}>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="rounded-md border border-[#dddddd] bg-white px-3 py-1 text-xs outline-none focus:border-accent"
                        placeholder="할 일 입력"
                        value={todoInput}
                        onChange={(e) => setTodoInput(e.target.value)}
                      />
                      <select
                        className="rounded-md border border-[#dddddd] bg-white px-3 py-1 text-xs"
                        value={todoKindInput}
                        onChange={(e) => setTodoKindInput(e.target.value as TodoKind)}
                      >
                        <option value="quick">3분컷</option>
                        <option value="date">날짜 지정</option>
                        <option value="project">프로젝트</option>
                        <option value="someday">언젠가</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {todoKindInput === "date" ? (
                        <input
                          type="date"
                          className="rounded-md border border-[#dddddd] bg-white px-3 py-1 text-xs"
                          value={todoDueDateInput}
                          onChange={(e) => setTodoDueDateInput(e.target.value)}
                        />
                      ) : (
                        <div />
                      )}
                      <label className="flex items-center gap-2 rounded-md border border-[#dddddd] bg-white px-3 py-1 text-xs">
                        <input
                          type="checkbox"
                          checked={todoLinkInput}
                          onChange={(e) => setTodoLinkInput(e.target.checked)}
                        />
                        OneThing
                      </label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="h-full rounded-md border border-transparent bg-accent px-3 py-1 text-xs font-medium text-[#444444] shadow-sm"
                    style={primaryButtonStyle}
                  >
                    추가
                  </button>
                </div>
              </form>
              <div className="mt-3 rounded-md border border-[#dddddd] bg-white p-2">
                <p className="text-xs font-semibold text-[#444444]">최근 입력</p>
                <ul className="mt-1 max-h-44 space-y-1 overflow-y-auto pr-1">
                  {recentTodoInputs.map((todo) => (
                    <li key={`todo-input-${todo.id}`} className="rounded-md border border-[#eeeeee] bg-white px-2 py-1 text-xs">
                      {todo.text}
                    </li>
                  ))}
                  {recentTodoInputs.length === 0 ? (
                    <li className="rounded-md border border-[#eeeeee] bg-white px-2 py-1 text-xs text-[#777777]">
                      입력된 투두가 없습니다.
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {doneTodoModal ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-3">
            <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#444444]">✅ {doneTodoModal.title} 완료 목록</h3>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setDoneTodoModal(null)}
                >
                  닫기
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {doneTodoModal.items.length === 0 ? (
                  <li className="rounded-md border border-[#eeeeee] bg-white px-2 py-2 text-xs text-[#777777]">
                    완료된 항목이 없습니다.
                  </li>
                ) : (
                  doneTodoModal.items.map((todo) => (
                    <li key={`done-${todo.id}`} className="rounded-md border border-[#dddddd] bg-white px-2 py-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="line-through text-stone-400">{todo.text}</span>
                        <button
                          type="button"
                          className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                          onClick={() =>
                            setTodos((prev) =>
                              prev.map((item) =>
                                item.id === todo.id ? { ...item, done: false } : item,
                              ),
                            )
                          }
                        >
                          복원
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : null}

        {isSchedulePanelOpen ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-3">
            <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#444444]">🗓️ 일정 입력/연동</h3>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setIsSchedulePanelOpen(false)}
                >
                  닫기
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1">
                {(["day", "week", "month"] as CalendarViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className="rounded-md border border-[#dddddd] px-2 py-1 text-xs text-[#444444]"
                    style={{
                      backgroundColor:
                        scheduleViewMode === mode ? currentAccent.soft : "#ffffff",
                    }}
                    onClick={() => setScheduleViewMode(mode)}
                  >
                    {mode === "day" ? "Day" : mode === "week" ? "Week" : "Month"}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
                {googleAccessToken ? (
                  <>
                    <button
                      type="button"
                      className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                      onClick={() =>
                        void syncGoogleTodayEvents(
                          googleAccessToken,
                          undefined,
                          currentRange.start,
                          currentRange.end,
                          currentRange.label,
                          googleCalendarFilterIds,
                        )
                      }
                      disabled={googleSyncing}
                    >
                      {googleSyncing ? "동기화중..." : "Google 동기화"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                      onClick={disconnectGoogleCalendar}
                    >
                      연결해제
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                    onClick={connectGoogleCalendar}
                    disabled={!googleCalendarReady}
                  >
                    Google 연결
                  </button>
                )}
              </div>
              {googleError ? <p className="mt-2 text-xs text-rose-600">{googleError}</p> : null}
              {googleSyncInfo ? <p className="mt-2 text-xs text-[#444444]">{googleSyncInfo}</p> : null}
              {googleAccessToken && googleCalendars.length > 0 ? (
                <div className="mt-2 rounded-md border border-[#dddddd] bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-[#444444]">표시할 Google 캘린더</p>
                    <label className="flex items-center gap-1 text-[11px] text-[#444444]">
                      <input
                        type="checkbox"
                        checked={googleAutoSyncEnabled}
                        onChange={(e) => setGoogleAutoSyncEnabled(e.target.checked)}
                      />
                      자동 갱신(2분)
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded-md border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                      style={{
                        backgroundColor: allGoogleCalendarsSelected
                          ? currentAccent.soft
                          : "#ffffff",
                      }}
                      onClick={() =>
                        setGoogleCalendarFilterIds(
                          allGoogleCalendarsSelected
                            ? []
                            : googleCalendars.map((calendar) => calendar.id),
                        )
                      }
                    >
                      전체
                    </button>
                    {googleCalendars.map((calendar) => {
                      const selected = googleCalendarFilterIds.includes(calendar.id);
                      return (
                        <button
                          key={calendar.id}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                          style={{ backgroundColor: selected ? currentAccent.soft : "#ffffff" }}
                          onClick={() => toggleGoogleCalendarFilter(calendar.id)}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: calendar.backgroundColor ?? "#9ca3af" }}
                          />
                          {calendar.summary}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="mt-2 rounded-md border border-[#dddddd] bg-white p-2">
                <p className="text-xs font-medium text-[#444444]">Apple 캘린더(ICS 공유 링크)</p>
                <div className="mt-1 flex gap-1">
                  <input
                    value={appleIcsInput}
                    onChange={(e) => setAppleIcsInput(e.target.value)}
                    placeholder="https://... .ics"
                    className="flex-1 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                    onClick={addAppleIcsUrl}
                  >
                    링크 추가
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-[#444444]">등록된 링크 {appleIcsUrls.length}개</p>
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-[11px] text-[#444444]"
                    disabled={appleSyncing || appleIcsUrls.length === 0}
                    onClick={() => {
                      const range = getViewDateRange(scheduleDateInput, scheduleViewMode);
                      void syncAppleIcsEvents(range.start, range.end, range.label);
                    }}
                  >
                    {appleSyncing ? "동기화중..." : "전체 동기화"}
                  </button>
                </div>
                {appleIcsUrls.length > 0 ? (
                  <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto pr-1">
                    {appleIcsUrls.map((url) => (
                      <li
                        key={url}
                        className="flex items-center justify-between gap-2 rounded-md border border-[#dddddd] bg-white px-2 py-1"
                      >
                        <span className="truncate text-[11px] text-[#444444]" title={url}>
                          {url}
                        </span>
                        <button
                          type="button"
                          className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[10px] text-[#444444]"
                          onClick={() => removeAppleIcsUrl(url)}
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11px] text-[#777777]">
                    링크를 추가하면 Apple 일정이 한 번에 동기화됩니다.
                  </p>
                )}
                {appleError ? <p className="mt-1 text-xs text-rose-600">{appleError}</p> : null}
                {appleSyncInfo ? <p className="mt-1 text-xs text-[#444444]">{appleSyncInfo}</p> : null}
              </div>
              <form className="mt-3 space-y-2" onSubmit={addSchedule}>
                <input
                  className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                  placeholder="일정 이름"
                  value={scheduleTitleInput}
                  onChange={(e) => setScheduleTitleInput(e.target.value)}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                    value={scheduleDateInput}
                    onChange={(e) => setScheduleDateInput(e.target.value)}
                  />
                  <input
                    type="time"
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                    value={scheduleTimeInput}
                    onChange={(e) => setScheduleTimeInput(e.target.value)}
                  />
                  <input
                    type="time"
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                    value={scheduleEndTimeInput}
                    onChange={(e) => setScheduleEndTimeInput(e.target.value)}
                  />
                </div>
                <input
                  className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                  placeholder="위치 (선택)"
                  value={scheduleLocationInput}
                  onChange={(e) => setScheduleLocationInput(e.target.value)}
                />
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                  placeholder="메모 (선택)"
                  value={scheduleNoteInput}
                  onChange={(e) => setScheduleNoteInput(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {activeTracking ? (
                    <>
                      <span className="text-xs text-[#666666]">
                        추적중: {new Date(activeTracking.startedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })} 시작
                      </span>
                      <button
                        type="button"
                        className="rounded-md border border-transparent bg-accent px-2 py-1 text-xs font-medium text-[#444444] shadow-sm"
                        style={primaryButtonStyle}
                        onClick={() => void stopTimeTrackingAndSave()}
                        disabled={scheduleSubmitting}
                      >
                        종료 후 저장
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                      onClick={() => void startTimeTracking()}
                      disabled={scheduleSubmitting}
                    >
                      타임트래커 시작
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
                    value={scheduleAddTarget}
                    onChange={(e) =>
                      setScheduleAddTarget(e.target.value as ScheduleAddTarget)
                    }
                  >
                    <option value="both">저장: 로컬 + Google</option>
                    <option value="local">저장: 로컬만</option>
                    <option value="google">저장: Google만</option>
                  </select>
                  <select
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
                    value={googleTargetCalendarId}
                    onChange={(e) => setGoogleTargetCalendarId(e.target.value)}
                    disabled={!googleAccessToken}
                  >
                    {googleCalendars.length === 0 ? (
                      <option value="primary">Google 캘린더 선택</option>
                    ) : (
                      googleCalendars.map((calendar) => (
                        <option key={calendar.id} value={calendar.id}>
                          {calendar.summary}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-md border border-transparent bg-accent px-2 py-1 text-xs font-medium text-[#444444] shadow-sm"
                    style={primaryButtonStyle}
                    disabled={scheduleSubmitting}
                  >
                    {scheduleSubmitting ? "저장중..." : "일정 추가"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {editingSchedule ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-3">
            <div className="w-full max-w-md rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#444444]">📝 일정 수정</h3>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={closeScheduleEdit}
                >
                  닫기
                </button>
              </div>
              <form className="mt-3 space-y-2" onSubmit={saveScheduleEdit}>
                <input
                  className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                  value={scheduleEditTitleInput}
                  onChange={(e) => setScheduleEditTitleInput(e.target.value)}
                  placeholder="일정 이름"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                    value={scheduleEditDateInput}
                    onChange={(e) => setScheduleEditDateInput(e.target.value)}
                  />
                  <input
                    type="time"
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                    value={scheduleEditTimeInput}
                    onChange={(e) => setScheduleEditTimeInput(e.target.value)}
                  />
                  <input
                    type="time"
                    className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                    value={scheduleEditEndTimeInput}
                    onChange={(e) => setScheduleEditEndTimeInput(e.target.value)}
                  />
                </div>
                <input
                  className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                  value={scheduleEditLocationInput}
                  onChange={(e) => setScheduleEditLocationInput(e.target.value)}
                  placeholder="위치 (선택)"
                />
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
                  value={scheduleEditNoteInput}
                  onChange={(e) => setScheduleEditNoteInput(e.target.value)}
                  placeholder="메모 (선택)"
                />
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                    onClick={closeScheduleEdit}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-md border border-transparent bg-accent px-2 py-1 text-xs font-medium text-[#444444] shadow-sm"
                    style={primaryButtonStyle}
                    disabled={scheduleEditingId === editingSchedule.id}
                  >
                    {scheduleEditingId === editingSchedule.id ? "저장중..." : "저장"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <section className="mt-auto rounded-lg border border-[#eeeeee] bg-white/80 p-2.5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">
                  <span className="mr-1 text-lg">📘</span>하루 마감 리포트
                </h2>
                {todayReport ? (
                  <p className="text-xs text-[#444444]">
                    마지막 저장:{" "}
                    {new Date(todayReport.createdAt).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </p>
                ) : (
                  <p className="text-xs text-[#444444]">마지막 저장: -</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 self-end">
              <button
                type="button"
                className="whitespace-nowrap rounded-md border border-[#dddddd] bg-white px-2 py-1 text-[11px] font-medium text-[#444444] shadow-sm md:text-xs"
                onClick={() => {
                  setReportGoodInput(mtsFeedback.good);
                  setReportProblemInput(mtsFeedback.problem);
                  setReportTryInput(mtsFeedback.nextTry);
                }}
              >
                자동피드백
              </button>
              <button
                type="button"
                onClick={saveDailyReport}
                className="whitespace-nowrap rounded-md border border-transparent bg-accent px-2 py-1 text-[11px] font-medium text-[#444444] shadow-sm md:text-xs"
                style={primaryButtonStyle}
              >
                오늘 리포트 저장
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <label className="rounded-md border border-[#dddddd] bg-white p-2 text-sm text-[#444444]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
                Good
              </p>
              <input
                value={reportGoodInput}
                onChange={(e) => setReportGoodInput(e.target.value)}
                placeholder="오늘 잘한 점"
                className="mt-1 h-8 w-full rounded-md border border-[#dddddd] px-2 py-1 text-xs outline-none focus:border-accent"
              />
            </label>
            <label className="rounded-md border border-[#dddddd] bg-white p-2 text-sm text-[#444444]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
                Problem
              </p>
              <input
                value={reportProblemInput}
                onChange={(e) => setReportProblemInput(e.target.value)}
                placeholder="오늘 막힌 점"
                className="mt-1 h-8 w-full rounded-md border border-[#dddddd] px-2 py-1 text-xs outline-none focus:border-accent"
              />
            </label>
            <label className="rounded-md border border-[#dddddd] bg-white p-2 text-sm text-[#444444]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-700">
                Try
              </p>
              <input
                value={reportTryInput}
                onChange={(e) => setReportTryInput(e.target.value)}
                placeholder="내일 시도할 점"
                className="mt-1 h-8 w-full rounded-md border border-[#dddddd] px-2 py-1 text-xs outline-none focus:border-accent"
              />
            </label>
          </div>
        </section>

        {isSettingsOpen ? (
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/30 p-3">
            <div className="mx-auto mt-4 w-full max-w-xl">
              <div className="w-full max-w-xl rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
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
                    <p className="mb-1 text-xs font-medium text-[#444444]">
                      콜아웃 배경 이미지 URL
                    </p>
                    <input
                      value={calloutBackground}
                      onChange={(e) => setCalloutBackground(e.target.value)}
                      placeholder="https://... (비우면 기본)"
                      className="w-full rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs outline-none focus:border-accent"
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
                            borderColor: themePalette[key].vars["--accent"],
                            backgroundColor:
                              theme === key ? themePalette[key].vars["--accent-soft"] : "#ffffff",
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
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

const Home = dynamic(() => Promise.resolve(HomePage), {
  ssr: false,
});

export default Home;
