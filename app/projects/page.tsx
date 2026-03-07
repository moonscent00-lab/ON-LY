"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";

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

const PROJECT_STORAGE_KEY = "diary-os.projects.v1";
const TODO_STORAGE_KEY = "diary-os.todos.v2";
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

function ProjectPage() {
  const today = todayKey();
  const [projects, setProjects] = useState<Project[]>(() =>
    normalizeProjects(parseJson<unknown[]>(localStorage.getItem(PROJECT_STORAGE_KEY), [])),
  );
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [unit, setUnit] = useState<Project["unit"]>("month");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [theme] = useState<MoodTheme>(getStoredTheme);
  const [accentTone] = useState<AccentTone>(getStoredAccent);
  const [calloutBackground] = useState(getStoredCalloutBackground);

  useEffect(() => {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  function applyProjectToRelatedTodos(updated: Project) {
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

  function editProject(project: Project) {
    setEditingProjectId(project.id);
    setTitle(project.title);
    setGoal(project.goal);
    setUnit(project.unit ?? "month");
    setStartDate(project.startDate);
    setEndDate(project.endDate);
  }

  function cancelEdit() {
    setEditingProjectId(null);
    setTitle("");
    setGoal("");
    setUnit("month");
    setStartDate(today);
    setEndDate(today);
  }

  function addProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !goal.trim()) return;
    if (editingProjectId) {
      setProjects((prev) =>
        prev.map((item) => {
          if (item.id !== editingProjectId) return item;
          const updated = {
            ...item,
            title: title.trim(),
            goal: goal.trim(),
            unit,
            actionPlan: item.actionPlan ?? "",
            startDate,
            endDate,
          };
          applyProjectToRelatedTodos(updated);
          return updated;
        }),
      );
      cancelEdit();
      return;
    }
    setProjects((prev) => {
      const nextProject = {
        id: createId(),
        title: title.trim(),
        goal: goal.trim(),
        unit,
        quarterPlan: "",
        monthPlan: "",
        weekPlan: "",
        dayPlan: "",
        actionPlan: "",
        startDate,
        endDate,
        status: "todo" as const,
      };
      return [nextProject, ...prev];
    });
    cancelEdit();
  }

  function addProjectTodo(project: Project) {
    const todos = parseJson<Todo[]>(localStorage.getItem(TODO_STORAGE_KEY), []);
    const next: Todo[] = [
      {
        id: createId(),
        text: `[${project.title}] ${project.dayPlan || project.weekPlan || project.monthPlan || project.quarterPlan || project.goal}`,
        done: false,
        createdAt: new Date().toISOString(),
        kind: "project",
        dueDate: null,
        linkedToOneThing: true,
        projectId: project.id,
        projectStartDate: project.startDate,
        projectEndDate: project.endDate,
      },
      ...todos,
    ];
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(next));
  }

  const statusCount = useMemo(
    () => ({
      todo: projects.filter((p) => p.status === "todo").length,
      doing: projects.filter((p) => p.status === "doing").length,
      done: projects.filter((p) => p.status === "done").length,
    }),
    [projects],
  );

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
                Project Hub
              </p>
              <h1 className="text-2xl font-bold">프로젝트 관리</h1>
            </div>
            <Link
              href="/"
              scroll={false}
              className="rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
              style={primaryButtonStyle}
            >
              대시보드로
            </Link>
          </div>
          <p className="mt-2 text-sm text-stone-700">
            생성에서는 프로젝트 단위만 정하고, 상세 페이지에서 단계별 목표를 쪼개세요.
          </p>
        </section>

        <section className="mb-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-[#444444]">
            대기: <span className="font-semibold">{statusCount.todo}</span>
          </div>
          <div className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-[#444444]">
            진행중: <span className="font-semibold">{statusCount.doing}</span>
          </div>
          <div className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-[#444444]">
            완료: <span className="font-semibold">{statusCount.done}</span>
          </div>
        </section>

        <section className="mb-4 rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <h2 className="mb-3 text-base font-semibold">
            {editingProjectId ? "프로젝트 수정" : "프로젝트 생성"}
          </h2>
          <form className="grid gap-2 md:grid-cols-6" onSubmit={addProject}>
            <input
              className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              placeholder="프로젝트 이름"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              placeholder="가장 큰 목표"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <select
              className="md:col-span-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              value={unit}
              onChange={(e) => setUnit(e.target.value as Project["unit"])}
            >
              <option value="day">일 단위</option>
              <option value="week">주 단위</option>
              <option value="month">월 단위</option>
              <option value="quarter">분기 단위</option>
              <option value="year">연 단위</option>
            </select>
            <input
              type="date"
              className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-md border border-transparent px-2 py-1 text-xs font-semibold shadow-sm"
              style={primaryButtonStyle}
            >
              {editingProjectId ? "수정 저장" : "프로젝트 추가"}
            </button>
            {editingProjectId ? (
              <button
                type="button"
                className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                onClick={cancelEdit}
              >
                취소
              </button>
            ) : null}
          </form>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => {
            const left = daysLeft(project.endDate);
            return (
              <article
                key={project.id}
                className="rounded-lg border border-[#eeeeee] bg-white/80 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{project.title}</h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      left <= 3 ? "bg-rose-100 text-rose-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {left >= 0 ? `D-${left}` : `D+${Math.abs(left)}`}
                  </span>
                </div>
                <p className="mt-2 text-sm text-stone-700">Goal: {project.goal}</p>
                <p className="mt-1 text-sm text-stone-700">단계 목표는 상세에서 설정</p>
                <p className="mt-1 text-xs text-stone-500">
                  {project.startDate} ~ {project.endDate}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  단위:{" "}
                  {project.unit === "year"
                    ? "연간"
                    : project.unit === "quarter"
                      ? "분기"
                      : project.unit === "month"
                        ? "월간"
                        : project.unit === "week"
                          ? "주간"
                          : "일간"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs"
                    value={project.status}
                    onChange={(e) =>
                      setProjects((prev) =>
                        prev.map((item) =>
                          item.id === project.id
                            ? {
                                ...item,
                                status: e.target.value as Project["status"],
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="todo">시작 전</option>
                    <option value="doing">진행 중</option>
                    <option value="done">완료</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => addProjectTodo(project)}
                    className="rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                    style={softButtonStyle}
                  >
                    오늘 투두로 내리기
                  </button>
                  <Link
                    href={`/projects/${project.id}`}
                    scroll={false}
                    className="rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                    style={softButtonStyle}
                  >
                    상세
                  </Link>
                  <button
                    type="button"
                    onClick={() => editProject(project)}
                    className="rounded-md border border-transparent px-2 py-1 text-xs shadow-sm"
                    style={softButtonStyle}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setProjects((prev) =>
                        prev.filter((item) => item.id !== project.id),
                      )
                    }
                    className="rounded-md border border-transparent px-2 py-1 text-xs shadow-sm"
                    style={softButtonStyle}
                  >
                    삭제
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

const Page = dynamic(() => Promise.resolve(ProjectPage), {
  ssr: false,
});

export default Page;
