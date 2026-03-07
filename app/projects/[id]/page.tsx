"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CSSProperties, useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  title: string;
  goal: string;
  actionPlan: string;
  unit: "year" | "quarter" | "month" | "week" | "day";
  quarterPlan: string;
  monthPlan: string;
  weekPlan: string;
  dayPlan: string;
  startDate: string;
  endDate: string;
  status: "todo" | "doing" | "done";
};

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  kind: "date" | "someday" | "quick" | "project";
  dueDate: string | null;
  linkedToOneThing: boolean;
  projectId: string | null;
  projectStartDate: string | null;
  projectEndDate: string | null;
};

type ProjectStep = {
  id: string;
  projectId: string;
  title: string;
  targetDate: string;
  done: boolean;
};

const PROJECT_STORAGE_KEY = "diary-os.projects.v1";
const TODO_STORAGE_KEY = "diary-os.todos.v2";
const PROJECT_STEP_STORAGE_KEY = "diary-os.project-steps.v1";
const THEME_STORAGE_KEY = "diary-os.theme.v1";
const ACCENT_STORAGE_KEY = "diary-os.accent.v1";
const CALLOUT_BG_STORAGE_KEY = "diary-os.callout-bg.v1";

type MoodTheme = "neutral" | "coral" | "yellow" | "blue";
type AccentTone = "neutral" | "coral" | "yellow" | "blue";

const themePalette: Record<MoodTheme, { background: string; vars: Record<string, string> }> = {
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

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeProjects(input: unknown[]): Project[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const item = raw as Partial<Project>;
      if (!item || typeof item.id !== "string" || typeof item.title !== "string") return null;
      const unit =
        item.unit === "year" ||
        item.unit === "quarter" ||
        item.unit === "month" ||
        item.unit === "week" ||
        item.unit === "day"
          ? item.unit
          : "month";
      const legacyMilestone =
        typeof (item as { milestonePlan?: unknown }).milestonePlan === "string"
          ? (item as { milestonePlan: string }).milestonePlan
          : item.actionPlan ?? "";
      const legacyWeek =
        typeof (item as { weeklyPlan?: unknown }).weeklyPlan === "string"
          ? (item as { weeklyPlan: string }).weeklyPlan
          : "";
      const legacyDay =
        typeof (item as { dailyPlan?: unknown }).dailyPlan === "string"
          ? (item as { dailyPlan: string }).dailyPlan
          : "";
      return {
        id: item.id,
        title: item.title,
        goal: typeof item.goal === "string" ? item.goal : "",
        actionPlan: typeof item.actionPlan === "string" ? item.actionPlan : "",
        unit,
        quarterPlan:
          typeof (item as { quarterPlan?: unknown }).quarterPlan === "string"
            ? (item as { quarterPlan: string }).quarterPlan
            : unit === "year"
              ? legacyMilestone
              : "",
        monthPlan:
          typeof (item as { monthPlan?: unknown }).monthPlan === "string"
            ? (item as { monthPlan: string }).monthPlan
            : unit === "quarter" || unit === "month"
              ? legacyMilestone
              : "",
        weekPlan:
          typeof (item as { weekPlan?: unknown }).weekPlan === "string"
            ? (item as { weekPlan: string }).weekPlan
            : legacyWeek,
        dayPlan:
          typeof (item as { dayPlan?: unknown }).dayPlan === "string"
            ? (item as { dayPlan: string }).dayPlan
            : legacyDay,
        startDate: typeof item.startDate === "string" ? item.startDate : todayKey(),
        endDate: typeof item.endDate === "string" ? item.endDate : todayKey(),
        status: item.status === "doing" || item.status === "done" ? item.status : "todo",
      } satisfies Project;
    })
    .filter((item): item is Project => item !== null);
}

function daysLeft(toDate: string) {
  const now = new Date();
  const target = new Date(toDate);
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function splitPlan(text: string) {
  return text
    .split(/[\n,.;]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildWeeklySlots(startDate: string, endDate: string) {
  const slots: Array<{ start: string; end: string }> = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return slots;
  }
  const cursor = new Date(start);
  while (cursor <= end) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor);
    slotEnd.setDate(slotEnd.getDate() + 6);
    if (slotEnd > end) {
      slotEnd.setTime(end.getTime());
    }
    slots.push({
      start: slotStart.toISOString().slice(0, 10),
      end: slotEnd.toISOString().slice(0, 10),
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return slots;
}

function buildMonthlySlots(startDate: string, endDate: string) {
  const slots: Array<{ start: string; end: string }> = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return slots;
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const slotStart = new Date(Math.max(cursor.getTime(), start.getTime()));
    const slotEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    if (slotEnd > end) slotEnd.setTime(end.getTime());
    slots.push({
      start: slotStart.toISOString().slice(0, 10),
      end: slotEnd.toISOString().slice(0, 10),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return slots;
}

function buildQuarterSlots(startDate: string, endDate: string) {
  const slots: Array<{ start: string; end: string }> = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return slots;
  const cursor = new Date(start);
  while (cursor <= end) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor);
    slotEnd.setMonth(slotEnd.getMonth() + 3);
    slotEnd.setDate(slotEnd.getDate() - 1);
    if (slotEnd > end) slotEnd.setTime(end.getTime());
    slots.push({
      start: slotStart.toISOString().slice(0, 10),
      end: slotEnd.toISOString().slice(0, 10),
    });
    cursor.setMonth(cursor.getMonth() + 3);
  }
  return slots;
}

function buildDailySlots(startDate: string, endDate: string, limit = 31) {
  const out: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
  const cursor = new Date(start);
  while (cursor <= end && out.length < limit) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function startOfWeek(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeek(date: string) {
  const start = new Date(`${startOfWeek(date)}T00:00:00`);
  start.setDate(start.getDate() + 6);
  return start.toISOString().slice(0, 10);
}

function normalizeProjectTodoText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^오늘 실행:\s*/, "")
    .trim();
}

function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const today = todayKey();
  const [projects, setProjects] = useState<Project[]>(() =>
    normalizeProjects(parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), [])),
  );
  const [steps, setSteps] = useState<ProjectStep[]>(() =>
    parseJson<ProjectStep[]>(localStorage.getItem(PROJECT_STEP_STORAGE_KEY), []),
  );
  const [manualStep, setManualStep] = useState("");
  const [manualDate, setManualDate] = useState(today);
  const [editTitle, setEditTitle] = useState(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.title ?? "";
  });
  const [editGoal, setEditGoal] = useState(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.goal ?? "";
  });
  const [editUnit, setEditUnit] = useState<Project["unit"]>(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.unit ?? "month";
  });
  const [editQuarterPlan, setEditQuarterPlan] = useState(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.quarterPlan ?? "";
  });
  const [editMonthPlan, setEditMonthPlan] = useState(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.monthPlan ?? "";
  });
  const [editWeekPlan, setEditWeekPlan] = useState(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.weekPlan ?? "";
  });
  const [editDayPlan, setEditDayPlan] = useState(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.dayPlan ?? "";
  });
  const [editStartDate, setEditStartDate] = useState(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.startDate ?? today;
  });
  const [editEndDate, setEditEndDate] = useState(() => {
    const initial = normalizeProjects(
      parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), []),
    ).find(
      (item) => item.id === projectId,
    );
    return initial?.endDate ?? today;
  });
  const [theme] = useState<MoodTheme>(getStoredTheme);
  const [accentTone] = useState<AccentTone>(getStoredAccent);
  const [calloutBackground] = useState(getStoredCalloutBackground);

  useEffect(() => {
    localStorage.setItem(PROJECT_STEP_STORAGE_KEY, JSON.stringify(steps));
  }, [steps]);

  useEffect(() => {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const project = useMemo(
    () => projects.find((item) => item.id === projectId) ?? null,
    [projects, projectId],
  );

  const projectSteps = useMemo(
    () => steps.filter((item) => item.projectId === projectId),
    [steps, projectId],
  );

  const stepProgress = useMemo(() => {
    if (projectSteps.length === 0) return 0;
    const doneCount = projectSteps.filter((item) => item.done).length;
    return Math.round((doneCount / projectSteps.length) * 100);
  }, [projectSteps]);

  const displayProjectSteps = useMemo(() => {
    const weekRegex = /^\[w(\d+)\]/i;
    const dayRegex = /^\[d(\d+)\]/i;
    const getWeekNumber = (title: string) => Number(title.match(weekRegex)?.[1] ?? 0);
    const getDayNumber = (title: string) => Number(title.match(dayRegex)?.[1] ?? 0);

    const weekSteps = projectSteps
      .filter((step) => weekRegex.test(step.title))
      .sort((a, b) => getWeekNumber(a.title) - getWeekNumber(b.title));

    if (weekSteps.length === 0) return projectSteps;

    const daySteps = projectSteps
      .filter((step) => dayRegex.test(step.title))
      .sort((a, b) => getDayNumber(a.title) - getDayNumber(b.title));

    const others = projectSteps.filter(
      (step) => !weekRegex.test(step.title) && !dayRegex.test(step.title),
    );

    const daysByWeek = new Map<number, ProjectStep[]>();
    daySteps.forEach((step) => {
      const dayNum = getDayNumber(step.title);
      if (dayNum <= 0) return;
      const weekNum = Math.ceil(dayNum / 7);
      const bucket = daysByWeek.get(weekNum) ?? [];
      bucket.push(step);
      daysByWeek.set(weekNum, bucket);
    });

    const ordered: ProjectStep[] = [];
    const usedIds = new Set<string>();
    weekSteps.forEach((weekStep) => {
      ordered.push(weekStep);
      usedIds.add(weekStep.id);
      const weekNum = getWeekNumber(weekStep.title);
      const linkedDays = daysByWeek.get(weekNum) ?? [];
      linkedDays.forEach((dayStep) => {
        ordered.push(dayStep);
        usedIds.add(dayStep.id);
      });
    });

    daySteps.forEach((step) => {
      if (usedIds.has(step.id)) return;
      ordered.push(step);
      usedIds.add(step.id);
    });
    others.forEach((step) => {
      if (usedIds.has(step.id)) return;
      ordered.push(step);
      usedIds.add(step.id);
    });

    return ordered;
  }, [projectSteps]);

  const currentTheme = themePalette[theme];
  const currentAccent = accentPalette[accentTone];
  const primaryButtonStyle = {
    backgroundColor: currentAccent.accent,
    color: "#444444",
  };
  const pageStyle: CSSProperties & Record<string, string> = {
    background: currentTheme.background,
    ...currentTheme.vars,
    "--accent": currentAccent.accent,
    "--accent-soft": currentAccent.soft,
  };
  const softButtonStyle = {
    backgroundColor: currentAccent.soft,
    color: "#444444",
  };

  function syncProjectToRelatedTodos(updated: Project) {
    const todos = parseJson<Todo[]>(localStorage.getItem(TODO_STORAGE_KEY), []);
    const nextTodos = todos.map((item) =>
      item.projectId === updated.id
        ? {
            ...item,
            projectStartDate: updated.startDate,
            projectEndDate: updated.endDate,
          }
        : item,
    );
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(nextTodos));
  }

  function saveProjectEdit() {
    if (!project) return;
    if (!editTitle.trim() || !editGoal.trim()) return;
    setProjects((prev) =>
      prev.map((item) => {
        if (item.id !== project.id) return item;
        const updated = {
          ...item,
          title: editTitle.trim(),
          goal: editGoal.trim(),
          unit: editUnit,
          quarterPlan: editQuarterPlan.trim(),
          monthPlan: editMonthPlan.trim(),
          weekPlan: editWeekPlan.trim(),
          dayPlan: editDayPlan.trim(),
          actionPlan: editMonthPlan.trim() || editQuarterPlan.trim(),
          startDate: editStartDate,
          endDate: editEndDate,
        };
        syncProjectToRelatedTodos(updated);
        return updated;
      }),
    );
  }

  function addManualStep() {
    const value = manualStep.trim();
    if (!value || !project) return;
    setSteps((prev) => [
      ...prev,
      {
        id: createId(),
        projectId: project.id,
        title: value,
        targetDate: manualDate,
        done: false,
      },
    ]);
    setManualStep("");
  }

  type LevelKey = "quarter" | "month" | "week" | "day";

  const levelLabel: Record<LevelKey, string> = {
    quarter: "분기",
    month: "월간",
    week: "주간",
    day: "일간",
  };

  function supportsLevel(unit: Project["unit"], level: LevelKey) {
    if (unit === "year") return true;
    if (unit === "quarter") return level !== "quarter";
    if (unit === "month") return level === "week" || level === "day";
    if (unit === "week") return level === "day";
    return false;
  }

  function levelFlow(unit: Project["unit"]): LevelKey[] {
    if (unit === "year") return ["quarter", "month", "week", "day"];
    if (unit === "quarter") return ["month", "week", "day"];
    if (unit === "month") return ["week", "day"];
    if (unit === "week") return ["day"];
    return [];
  }

  function getPlanText(level: LevelKey) {
    if (level === "quarter") return editQuarterPlan.trim() || project?.quarterPlan || project?.goal || "";
    if (level === "month") return editMonthPlan.trim() || project?.monthPlan || project?.goal || "";
    if (level === "week") return editWeekPlan.trim() || project?.weekPlan || project?.goal || "";
    return editDayPlan.trim() || project?.dayPlan || project?.goal || "";
  }

  function generateLevelGoals(level: LevelKey) {
    if (!project) return;
    const parsed = splitPlan(getPlanText(level));
    const baseSteps = parsed.length > 0 ? parsed : [project.goal];

    setSteps((prev) => {
      const existingTitles = new Set(
        prev
          .filter((item) => item.projectId === project.id)
          .map((item) => item.title.toLowerCase()),
      );

      let additions: ProjectStep[] = [];
      if (level === "quarter") {
        const slots = buildQuarterSlots(project.startDate, project.endDate);
        const chunkSize = Math.max(1, Math.ceil(baseSteps.length / Math.max(1, slots.length)));
        additions = slots.map((slot, index) => ({
          id: createId(),
          projectId: project.id,
          title: `[Q${index + 1}] ${
            baseSteps.slice(index * chunkSize, (index + 1) * chunkSize).join(" · ") || project.goal
          }`,
          targetDate: slot.end,
          done: false,
        }));
      } else if (level === "month") {
        const slots = buildMonthlySlots(project.startDate, project.endDate);
        const chunkSize = Math.max(1, Math.ceil(baseSteps.length / Math.max(1, slots.length)));
        additions = slots.map((slot, index) => ({
          id: createId(),
          projectId: project.id,
          title: `[M${index + 1}] ${
            baseSteps.slice(index * chunkSize, (index + 1) * chunkSize).join(" · ") || project.goal
          }`,
          targetDate: slot.end,
          done: false,
        }));
      } else if (level === "week") {
        const slots = buildWeeklySlots(project.startDate, project.endDate);
        const chunkSize = Math.max(1, Math.ceil(baseSteps.length / Math.max(1, slots.length)));
        additions = slots.map((slot, index) => ({
          id: createId(),
          projectId: project.id,
          title: `[W${index + 1}] ${
            baseSteps.slice(index * chunkSize, (index + 1) * chunkSize).join(" · ") || project.goal
          }`,
          targetDate: slot.end,
          done: false,
        }));
      } else {
        const slots = buildDailySlots(project.startDate, project.endDate);
        additions = slots.map((date, index) => ({
          id: createId(),
          projectId: project.id,
          title: `[D${index + 1}] ${baseSteps[index % baseSteps.length]}`,
          targetDate: date,
          done: false,
        }));
      }

      return [
        ...prev,
        ...additions.filter((item) => !existingTitles.has(item.title.toLowerCase())),
      ];
    });
  }

  function pushStepsToTodos() {
    if (!project) return;
    const todos = parseJson<Todo[]>(localStorage.getItem(TODO_STORAGE_KEY), []);
    const existing = new Set(
      todos
        .filter((item) => item.projectId === project.id)
        .map((item) => normalizeProjectTodoText(item.text)),
    );
    const draft = projectSteps
      .filter((step) => !step.done)
      .map((step) => ({
        id: createId(),
        text: `[${project.title}] ${step.title}`,
        done: false,
        createdAt: new Date().toISOString(),
        kind: "project" as const,
        dueDate: step.targetDate,
        linkedToOneThing: true,
        projectId: project.id,
        projectStartDate: project.startDate,
        projectEndDate: project.endDate,
      }))
      .filter((todo) => {
        const key = normalizeProjectTodoText(todo.text);
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });

    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([...draft, ...todos]));
  }

  function pushThisWeekGoalsToTodos() {
    if (!project) return;
    const todos = parseJson<Todo[]>(localStorage.getItem(TODO_STORAGE_KEY), []);
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const thisWeekSteps = projectSteps
      .filter(
        (step) => !step.done && step.targetDate >= weekStart && step.targetDate <= weekEnd,
      )
      .slice(0, 3);
    const source = thisWeekSteps.length > 0
      ? thisWeekSteps
      : projectSteps.filter((step) => !step.done).slice(0, 1);
    const existingTexts = new Set(
      todos
        .filter((item) => item.projectId === project.id)
        .map((item) => normalizeProjectTodoText(item.text)),
    );
    const draft = source
      .map((step) => ({
        id: createId(),
        text: `[${project.title}] 오늘 실행: ${step.title}`,
        done: false,
        createdAt: new Date().toISOString(),
        kind: "project" as const,
        dueDate: today,
        linkedToOneThing: true,
        projectId: project.id,
        projectStartDate: project.startDate,
        projectEndDate: project.endDate,
      }))
      .filter((todo) => {
        const key = normalizeProjectTodoText(todo.text);
        if (existingTexts.has(key)) return false;
        existingTexts.add(key);
        return true;
      });
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([...draft, ...todos]));
  }

  if (!project) {
    return (
      <div
        className="min-h-screen px-3 py-4"
        style={{ background: currentTheme.background, ...currentTheme.vars }}
      >
        <main className="mx-auto max-w-6xl rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <p className="text-sm text-[#444444]">프로젝트를 찾을 수 없어요.</p>
          <Link
            href="/projects"
            scroll={false}
            className="mt-3 inline-flex rounded-md border border-transparent px-3 py-1.5 text-sm shadow-sm"
            style={primaryButtonStyle}
          >
            프로젝트 목록으로
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-4 md:px-5 md:py-8" style={pageStyle}>
      <main
        className="mx-auto max-w-6xl rounded-lg border border-[#eeeeee] bg-white/80 p-4 text-sm shadow-[0_18px_40px_rgba(20,19,17,0.08)] md:p-5"
        style={
          calloutBackground.trim().length > 0
            ? {
                backgroundImage: `linear-gradient(rgba(255,255,255,0.8), rgba(255,255,255,0.8)), url(${calloutBackground})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <section className="mb-4 rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                Project Detail
              </p>
              <h1 className="text-xl font-bold">{project.title}</h1>
            </div>
            <div className="flex gap-2">
              <Link
                href="/projects"
                scroll={false}
                className="rounded-md border border-transparent px-3 py-1.5 text-sm font-medium shadow-sm"
                style={primaryButtonStyle}
              >
                목록
              </Link>
              <Link
                href="/"
                scroll={false}
                className="rounded-md border border-transparent px-3 py-1.5 text-sm font-medium shadow-sm"
                style={primaryButtonStyle}
              >
                대시보드
              </Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-700">Goal: {project.goal}</p>
          {supportsLevel(project.unit, "quarter") ? (
            <p className="mt-1 text-sm text-stone-700">분기 계획: {project.quarterPlan || "-"}</p>
          ) : null}
          {supportsLevel(project.unit, "month") ? (
            <p className="mt-1 text-sm text-stone-700">월 계획: {project.monthPlan || "-"}</p>
          ) : null}
          {supportsLevel(project.unit, "week") ? (
            <p className="mt-1 text-sm text-stone-700">주 계획: {project.weekPlan || "-"}</p>
          ) : null}
          {supportsLevel(project.unit, "day") ? (
            <p className="mt-1 text-sm text-stone-700">일 계획: {project.dayPlan || "-"}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
              {project.startDate} ~ {project.endDate}
            </span>
            <span
              className={`rounded-full px-2 py-1 ${
                daysLeft(project.endDate) <= 3
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {daysLeft(project.endDate) >= 0
                ? `D-${daysLeft(project.endDate)}`
                : `D+${Math.abs(daysLeft(project.endDate))}`}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
              액션 진행률 {stepProgress}%
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-700">
              {project.unit === "year"
                ? "연간"
                : project.unit === "quarter"
                  ? "분기"
                  : project.unit === "month"
                    ? "월간"
                    : project.unit === "week"
                      ? "주간"
                      : "일간"}
            </span>
          </div>
        </section>

        <section className="mb-4 rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <h2 className="mb-2 text-base font-semibold">프로젝트 정보 수정</h2>
          <div className="grid gap-2 md:grid-cols-6">
            <input
              className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="프로젝트 이름"
            />
            <input
              className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              value={editGoal}
              onChange={(e) => setEditGoal(e.target.value)}
              placeholder="가장 큰 목표"
            />
            <select
              className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value as Project["unit"])}
            >
              <option value="day">일 단위</option>
              <option value="week">주 단위</option>
              <option value="month">월 단위</option>
              <option value="quarter">분기 단위</option>
              <option value="year">연 단위</option>
            </select>
            {supportsLevel(editUnit, "quarter") ? (
              <input
                className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                value={editQuarterPlan}
                onChange={(e) => setEditQuarterPlan(e.target.value)}
                placeholder="분기 계획"
              />
            ) : null}
            {supportsLevel(editUnit, "month") ? (
              <input
                className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                value={editMonthPlan}
                onChange={(e) => setEditMonthPlan(e.target.value)}
                placeholder="월 계획"
              />
            ) : null}
            {supportsLevel(editUnit, "week") ? (
              <input
                className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                value={editWeekPlan}
                onChange={(e) => setEditWeekPlan(e.target.value)}
                placeholder="주 계획"
              />
            ) : null}
            {supportsLevel(editUnit, "day") ? (
              <input
                className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                value={editDayPlan}
                onChange={(e) => setEditDayPlan(e.target.value)}
                placeholder="일 계획"
              />
            ) : null}
            <input
              type="date"
              className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
            />
            <input
              type="date"
              className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              value={editEndDate}
              onChange={(e) => setEditEndDate(e.target.value)}
            />
            <button
              type="button"
              onClick={saveProjectEdit}
              className="rounded-md border border-transparent px-2 py-1 text-xs font-semibold shadow-sm"
              style={primaryButtonStyle}
            >
              프로젝트 정보 저장
            </button>
          </div>
        </section>

        <section className="mb-4 rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <h2 className="mb-2 text-base font-semibold">액션 생성</h2>
          <details className="rounded-md border border-[#dddddd] bg-white p-2">
            <summary className="cursor-pointer text-sm font-semibold text-[#444444]">
              단계별 목표 생성 열기
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {levelFlow(project.unit).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => generateLevelGoals(level)}
                  className="rounded-md border border-transparent px-3 py-1.5 text-sm font-semibold shadow-sm"
                  style={primaryButtonStyle}
                >
                  {levelLabel[level]} 목표 생성
                </button>
              ))}
            </div>
          </details>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pushStepsToTodos}
              className="rounded-md border border-transparent px-3 py-1.5 text-sm font-semibold shadow-sm"
              style={softButtonStyle}
            >
              미완료 액션 투두로 내리기
            </button>
            <button
              type="button"
              onClick={pushThisWeekGoalsToTodos}
              className="rounded-md border border-transparent px-3 py-1.5 text-sm font-semibold shadow-sm"
              style={softButtonStyle}
            >
              이번 주 목표를 오늘 투두로
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <input
              className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm"
              placeholder="수동 액션 추가"
              value={manualStep}
              onChange={(e) => setManualStep(e.target.value)}
            />
            <input
              type="date"
              className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
            <button
              type="button"
              onClick={addManualStep}
              className="rounded-md border border-transparent px-3 py-1.5 text-sm font-semibold shadow-sm"
              style={softButtonStyle}
            >
              액션 추가
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <h2 className="mb-2 text-base font-semibold">프로젝트 액션 리스트</h2>
          <ul className="space-y-2">
            {displayProjectSteps.map((step) => (
              <li
                key={step.id}
                className="rounded-md border border-[#dddddd] bg-white px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-2"
                      checked={step.done}
                      onChange={() =>
                        setSteps((prev) =>
                          prev.map((item) =>
                            item.id === step.id ? { ...item, done: !item.done } : item,
                          ),
                        )
                      }
                    />
                    {(() => {
                      const matched = step.title.match(/^(\[[A-Z]\d+\])\s*(.*)$/);
                      const prefix = matched?.[1] ?? "";
                      const body = matched ? matched[2] : step.title;
                      return (
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                          {prefix ? (
                            <span className="shrink-0 rounded-md border border-[#dddddd] bg-stone-50 px-2 py-1 text-xs text-[#666666]">
                              {prefix}
                            </span>
                          ) : null}
                          <input
                            className={`min-w-0 flex-1 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-sm ${
                              step.done ? "text-stone-400 line-through" : "text-[#444444]"
                            }`}
                            value={body}
                            onChange={(e) => {
                              const nextBody = e.target.value;
                              setSteps((prev) =>
                                prev.map((item) =>
                                  item.id === step.id
                                    ? {
                                        ...item,
                                        title: prefix ? `${prefix} ${nextBody}` : nextBody,
                                      }
                                    : item,
                                ),
                              );
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-600">
                      {step.targetDate}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSteps((prev) => prev.filter((item) => item.id !== step.id))
                      }
                      className="rounded-md border border-transparent px-2 py-1 text-xs shadow-sm"
                      style={softButtonStyle}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

const Page = dynamic(() => Promise.resolve(ProjectDetailPage), {
  ssr: false,
});

export default Page;
