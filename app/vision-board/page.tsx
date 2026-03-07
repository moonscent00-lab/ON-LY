"use client";
/* eslint-disable @next/next/no-img-element */

import {
  CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type MoodTheme = "neutral" | "coral" | "yellow" | "blue";
type AccentTone = "neutral" | "coral" | "yellow" | "blue";
type VisionMode = "collage" | "wheel";

type CollagePin = {
  id: string;
  month: string;
  image: string;
  createdAt: string;
  order?: number;
};

type WheelAreaKey =
  | "health"
  | "mind"
  | "work"
  | "finance"
  | "relationship"
  | "growth"
  | "fun"
  | "environment";

type WheelRecord = {
  id: string;
  month: string;
  scores: Record<WheelAreaKey, number>;
  details: Record<
    WheelAreaKey,
    { current: string; shortTerm: string; midTerm: string; longTerm: string }
  >;
  summary: string;
  nextAction: string;
  updatedAt: string;
};

const COLLAGE_STORAGE_KEY = "diary-os.vision.collage.v1";
const WHEEL_STORAGE_KEY = "diary-os.vision.wheel.v1";
const WHEEL_LABELS_STORAGE_KEY = "diary-os.vision.wheel.labels.v1";
const WHEEL_EMOJIS_STORAGE_KEY = "diary-os.vision.wheel.emojis.v1";
const THEME_STORAGE_KEY = "diary-os.theme.v1";
const ACCENT_STORAGE_KEY = "diary-os.accent.v1";
const CALLOUT_BG_STORAGE_KEY = "diary-os.callout-bg.v1";
const COLLAGE_TEMPLATE: Array<{ c: number; r: number; cs: number; rs: number }> = [
  { c: 1, r: 1, cs: 3, rs: 5 },
  { c: 1, r: 6, cs: 3, rs: 3 },
  { c: 4, r: 1, cs: 4, rs: 3 },
  { c: 4, r: 4, cs: 4, rs: 5 },
  { c: 8, r: 1, cs: 3, rs: 2 },
  { c: 8, r: 3, cs: 3, rs: 6 },
  { c: 11, r: 1, cs: 3, rs: 4 },
  { c: 14, r: 1, cs: 3, rs: 4 },
  { c: 11, r: 5, cs: 6, rs: 4 },
];
const MOBILE_COLLAGE_TEMPLATE: Array<{ c: number; r: number; cs: number; rs: number }> = [
  { c: 1, r: 1, cs: 3, rs: 4 },
  { c: 4, r: 1, cs: 3, rs: 4 },
  { c: 7, r: 1, cs: 2, rs: 3 },
  { c: 1, r: 5, cs: 3, rs: 4 },
  { c: 4, r: 5, cs: 3, rs: 5 },
  { c: 7, r: 4, cs: 2, rs: 6 },
  { c: 1, r: 9, cs: 2, rs: 3 },
  { c: 3, r: 10, cs: 2, rs: 3 },
  { c: 5, r: 10, cs: 4, rs: 4 },
];

const wheelAreas: Array<{ key: WheelAreaKey; label: string; emoji: string }> = [
  { key: "health", label: "건강", emoji: "💪" },
  { key: "mind", label: "정신", emoji: "🧠" },
  { key: "work", label: "일/커리어", emoji: "💼" },
  { key: "finance", label: "재정", emoji: "💰" },
  { key: "relationship", label: "관계", emoji: "🤝" },
  { key: "growth", label: "성장", emoji: "🌱" },
  { key: "fun", label: "즐거움", emoji: "🎉" },
  { key: "environment", label: "환경", emoji: "🏡" },
];

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

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (srcRatio > dstRatio) {
    sw = img.naturalHeight * dstRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / dstRatio;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    img.src = `/api/image-proxy?url=${encodeURIComponent(src)}`;
  });
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

function toMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, offset: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const next = new Date(y, m - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}년 ${String(m).padStart(2, "0")}월`;
}

function defaultScores() {
  return wheelAreas.reduce(
    (acc, area) => ({ ...acc, [area.key]: 5 }),
    {} as Record<WheelAreaKey, number>,
  );
}

function defaultWheelLabels() {
  return wheelAreas.reduce(
    (acc, area) => ({ ...acc, [area.key]: area.label }),
    {} as Record<WheelAreaKey, string>,
  );
}

function defaultWheelEmojis() {
  return wheelAreas.reduce(
    (acc, area) => ({ ...acc, [area.key]: area.emoji }),
    {} as Record<WheelAreaKey, string>,
  );
}

function defaultWheelDetails() {
  return wheelAreas.reduce(
    (acc, area) => ({
      ...acc,
      [area.key]: { current: "", shortTerm: "", midTerm: "", longTerm: "" },
    }),
    {} as WheelRecord["details"],
  );
}

function normalizeWheelRecords(input: unknown[]): WheelRecord[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Partial<WheelRecord> & {
        details?: Partial<Record<WheelAreaKey, Partial<WheelRecord["details"][WheelAreaKey]>>>;
      };
      if (typeof item.month !== "string" || item.month.length === 0) return null;

      const scores = wheelAreas.reduce(
        (acc, area) => ({
          ...acc,
          [area.key]:
            typeof item.scores?.[area.key] === "number"
              ? Math.max(1, Math.min(10, item.scores?.[area.key] ?? 5))
              : 5,
        }),
        {} as Record<WheelAreaKey, number>,
      );

      const details = wheelAreas.reduce(
        (acc, area) => ({
          ...acc,
          [area.key]: {
            current: item.details?.[area.key]?.current ?? "",
            shortTerm: item.details?.[area.key]?.shortTerm ?? "",
            midTerm: item.details?.[area.key]?.midTerm ?? "",
            longTerm: item.details?.[area.key]?.longTerm ?? "",
          },
        }),
        {} as WheelRecord["details"],
      );

      return {
        id: typeof item.id === "string" && item.id.length > 0 ? item.id : createId(),
        month: item.month,
        scores,
        details,
        summary: typeof item.summary === "string" ? item.summary : "",
        nextAction: typeof item.nextAction === "string" ? item.nextAction : "",
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
      } satisfies WheelRecord;
    })
    .filter((item): item is WheelRecord => item !== null);
}

function getCarryOverRecord(source: WheelRecord[], month: string) {
  const sorted = [...source].sort((a, b) => a.month.localeCompare(b.month));
  const older = sorted.filter((item) => item.month < month);
  if (older.length > 0) return older[older.length - 1];
  return sorted[sorted.length - 1] ?? null;
}

function getWheelSeed(source: WheelRecord[], month: string) {
  const current = source.find((item) => item.month === month) ?? getCarryOverRecord(source, month);
  return {
    scores: current?.scores ?? defaultScores(),
    details: current?.details ?? defaultWheelDetails(),
    summary: current?.summary ?? "",
    nextAction: current?.nextAction ?? "",
  };
}

function seedCollageMonthFromSource(targetMonth: string, source: CollagePin[]) {
  const hasCurrent = source.some((pin) => pin.month === targetMonth);
  if (hasCurrent) return source;
  const olderPins = source.filter((pin) => pin.month < targetMonth);
  if (olderPins.length === 0) return source;
  const latestMonth = olderPins.map((pin) => pin.month).sort((a, b) => b.localeCompare(a))[0];
  const basePins = olderPins.filter((pin) => pin.month === latestMonth);
  const clones: CollagePin[] = basePins.map((pin) => ({
    id: createId(),
    month: targetMonth,
    image: pin.image,
    createdAt: new Date().toISOString(),
    order: pin.order,
  }));
  return [...clones, ...source];
}

export default function VisionBoardPage() {
  const initialMonth = toMonthKey();
  const initialPins = seedCollageMonthFromSource(
    initialMonth,
    parseJson<CollagePin[]>(
      typeof window !== "undefined" ? localStorage.getItem(COLLAGE_STORAGE_KEY) : null,
      [],
    ),
  );
  const initialWheelRecords = normalizeWheelRecords(
    parseJson<unknown[]>(
      typeof window !== "undefined" ? localStorage.getItem(WHEEL_STORAGE_KEY) : null,
      [],
    ),
  );
  const initialSeed = getWheelSeed(initialWheelRecords, initialMonth);

  const [theme] = useState<MoodTheme>(getStoredTheme);
  const [accentTone] = useState<AccentTone>(getStoredAccent);
  const [calloutBackground] = useState(getStoredCalloutBackground);

  const [mode, setMode] = useState<VisionMode>("collage");
  const [month, setMonth] = useState(initialMonth);

  const [pins, setPins] = useState<CollagePin[]>(initialPins);
  const [wheelRecords, setWheelRecords] = useState<WheelRecord[]>(initialWheelRecords);

  const [wheelLabels, setWheelLabels] = useState<Record<WheelAreaKey, string>>({
    ...defaultWheelLabels(),
    ...parseJson<Partial<Record<WheelAreaKey, string>>>(
      typeof window !== "undefined" ? localStorage.getItem(WHEEL_LABELS_STORAGE_KEY) : null,
      {},
    ),
  });
  const [wheelEmojis, setWheelEmojis] = useState<Record<WheelAreaKey, string>>({
    ...defaultWheelEmojis(),
    ...parseJson<Partial<Record<WheelAreaKey, string>>>(
      typeof window !== "undefined" ? localStorage.getItem(WHEEL_EMOJIS_STORAGE_KEY) : null,
      {},
    ),
  });

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [isAddPinOpen, setIsAddPinOpen] = useState(false);
  const [isCollageEditMode, setIsCollageEditMode] = useState(false);
  const [pinImage, setPinImage] = useState("");
  const [isEditPinOpen, setIsEditPinOpen] = useState(false);
  const [editPinImage, setEditPinImage] = useState("");
  const [draggedPinId, setDraggedPinId] = useState<string | null>(null);
  const [isExportingWallpaper, setIsExportingWallpaper] = useState(false);

  const [wheelDraft, setWheelDraft] = useState<Record<WheelAreaKey, number>>(initialSeed.scores);
  const [wheelDetailsDraft, setWheelDetailsDraft] = useState<WheelRecord["details"]>(initialSeed.details);
  const [wheelSummary, setWheelSummary] = useState(initialSeed.summary);
  const [wheelNextAction, setWheelNextAction] = useState(initialSeed.nextAction);

  const [draggingArea, setDraggingArea] = useState<WheelAreaKey | null>(null);
  const wheelSvgRef = useRef<SVGSVGElement | null>(null);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isMobileCollage = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      window.addEventListener("resize", onStoreChange);
      return () => window.removeEventListener("resize", onStoreChange);
    },
    () => (typeof window !== "undefined" ? window.innerWidth < 900 : false),
    () => false,
  );

  const currentTheme = themePalette[theme];
  const currentAccent = accentPalette[accentTone];
  const primaryButtonStyle = { backgroundColor: currentAccent.accent, color: "#444444" };

  useEffect(() => {
    localStorage.setItem(COLLAGE_STORAGE_KEY, JSON.stringify(pins));
  }, [pins]);

  useEffect(() => {
    localStorage.setItem(WHEEL_STORAGE_KEY, JSON.stringify(wheelRecords));
  }, [wheelRecords]);

  useEffect(() => {
    localStorage.setItem(WHEEL_LABELS_STORAGE_KEY, JSON.stringify(wheelLabels));
  }, [wheelLabels]);

  useEffect(() => {
    localStorage.setItem(WHEEL_EMOJIS_STORAGE_KEY, JSON.stringify(wheelEmojis));
  }, [wheelEmojis]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isAddPinOpen) {
        setIsAddPinOpen(false);
      }
      if (event.key === "Escape" && isEditPinOpen) {
        setIsEditPinOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAddPinOpen, isEditPinOpen]);

  const monthlyPins = useMemo(() => {
    const monthPins = pins.filter((pin) => pin.month === month);
    return [...monthPins].sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [pins, month]);

  const monthlyWheelRecord = useMemo(
    () => wheelRecords.find((record) => record.month === month) ?? null,
    [wheelRecords, month],
  );
  const activeCollageTemplate = isMobileCollage ? MOBILE_COLLAGE_TEMPLATE : COLLAGE_TEMPLATE;
  const collagePinsForBoard = useMemo(
    () => (isMobileCollage ? monthlyPins : monthlyPins.slice(0, activeCollageTemplate.length)),
    [monthlyPins, isMobileCollage, activeCollageTemplate.length],
  );
  const hiddenPinCount = Math.max(
    0,
    monthlyPins.length - (isMobileCollage ? monthlyPins.length : activeCollageTemplate.length),
  );
  function seedCollageMonth(targetMonth: string, source = pins) {
    return seedCollageMonthFromSource(targetMonth, source);
  }

  function loadWheelInputs(nextMonth: string, source = wheelRecords) {
    const record = source.find((item) => item.month === nextMonth) ?? getCarryOverRecord(source, nextMonth);
    if (!record) {
      setWheelDraft(defaultScores());
      setWheelDetailsDraft(defaultWheelDetails());
      setWheelSummary("");
      setWheelNextAction("");
      return;
    }
    setWheelDraft(record.scores);
    setWheelDetailsDraft(record.details);
    setWheelSummary(record.summary);
    setWheelNextAction(record.nextAction);
  }

  function moveMonth(offset: number) {
    const nextMonth = shiftMonth(month, offset);
    setMonth(nextMonth);
    setPins((prev) => seedCollageMonth(nextMonth, prev));
    loadWheelInputs(nextMonth);
  }

  function addPin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pinImage.trim()) return;
    const maxOrder = pins
      .filter((pin) => pin.month === month)
      .reduce((acc, pin) => (typeof pin.order === "number" ? Math.max(acc, pin.order) : acc), -1);
    const next: CollagePin = {
      id: createId(),
      month,
      image: pinImage.trim(),
      createdAt: new Date().toISOString(),
      order: maxOrder + 1,
    };
    setPins((prev) => [next, ...prev]);
    setSelectedPinId(next.id);
    setPinImage("");
    setIsAddPinOpen(false);
  }

  async function exportWallpaperImage() {
    if (monthlyPins.length === 0 || isExportingWallpaper) return;
    setIsExportingWallpaper(true);
    try {
      const exportPins = monthlyPins.slice(0, 12);
      const canvas = document.createElement("canvas");
      const canvasWidth = 1080;
      const canvasHeight = 1920;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#f4f5f7";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const margin = 28;
      const gap = 14;
      const columns = 2;
      const rows = Math.max(1, Math.ceil(exportPins.length / columns));
      const tileWidth = (canvasWidth - margin * 2 - gap) / columns;
      const tileHeight = (canvasHeight - margin * 2 - gap * (rows - 1)) / rows;

      for (let index = 0; index < exportPins.length; index += 1) {
        const pin = exportPins[index];
        const row = Math.floor(index / columns);
        const col = index % columns;
        const x = margin + col * (tileWidth + gap);
        const y = margin + row * (tileHeight + gap);

        try {
          const img = await loadImage(pin.image);
          drawCoverImage(ctx, img, x, y, tileWidth, tileHeight);
        } catch {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, y, tileWidth, tileHeight);
          ctx.strokeStyle = "#dddddd";
          ctx.strokeRect(x, y, tileWidth, tileHeight);
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      if (!blob) {
        window.alert("이미지 저장에 실패했어요. 다른 이미지 URL로 다시 시도해 주세요.");
        return;
      }
      const filename = `vision-wallpaper-${month}.png`;
      const shareApi = navigator.share as
        | ((data: { files?: File[]; title?: string; text?: string }) => Promise<void>)
        | undefined;
      const canShareApi = navigator.canShare as
        | ((data: { files?: File[] }) => boolean)
        | undefined;
      const file = new File([blob], filename, { type: "image/png" });
      if (shareApi && canShareApi && canShareApi({ files: [file] })) {
        await shareApi({ files: [file], title: "비전보드 배경화면" });
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      window.alert("배경화면 생성에 실패했어요. 이미지 URL 권한(CORS)을 확인해 주세요.");
    } finally {
      setIsExportingWallpaper(false);
    }
  }

  function savePinEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPinId || !editPinImage.trim()) return;
    setPins((prev) =>
      prev.map((pin) => (pin.id === selectedPinId ? { ...pin, image: editPinImage.trim() } : pin)),
    );
    setIsEditPinOpen(false);
  }

  function openEditPin(pin: CollagePin) {
    setSelectedPinId(pin.id);
    setEditPinImage(pin.image);
    setIsEditPinOpen(true);
  }

  function deletePin(pinId: string) {
    setPins((prev) => prev.filter((pin) => pin.id !== pinId));
    if (selectedPinId === pinId) setSelectedPinId(null);
    setIsEditPinOpen(false);
  }

  function movePinOrder(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    setPins((prev) => {
      const monthPins = prev
        .filter((pin) => pin.month === month)
        .sort((a, b) => {
          const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
          const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return b.createdAt.localeCompare(a.createdAt);
        });
      const from = monthPins.findIndex((pin) => pin.id === dragId);
      const to = monthPins.findIndex((pin) => pin.id === targetId);
      if (from < 0 || to < 0) return prev;
      const reordered = [...monthPins];
      const [picked] = reordered.splice(from, 1);
      reordered.splice(to, 0, picked);
      const mapped = new Map(reordered.map((pin, index) => [pin.id, index]));
      return prev.map((pin) =>
        pin.month === month ? { ...pin, order: mapped.get(pin.id) ?? pin.order } : pin,
      );
    });
  }

  function saveWheel() {
    const payload: WheelRecord = {
      id: monthlyWheelRecord?.id ?? createId(),
      month,
      scores: wheelDraft,
      details: wheelDetailsDraft,
      summary: wheelSummary.trim(),
      nextAction: wheelNextAction.trim(),
      updatedAt: new Date().toISOString(),
    };
    setWheelRecords((prev) => {
      const exists = prev.some((item) => item.month === month);
      if (!exists) return [payload, ...prev];
      return prev.map((item) => (item.month === month ? payload : item));
    });
  }

  const polygonPoints = useMemo(() => {
    const cx = 150;
    const cy = 150;
    const r = 100;
    return wheelAreas
      .map((area, index) => {
        const angle = (Math.PI * 2 * index) / wheelAreas.length - Math.PI / 2;
        const score = Math.max(1, Math.min(10, wheelDraft[area.key] || 1));
        const radius = (r * score) / 10;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(" ");
  }, [wheelDraft]);

  const handlePoints = useMemo(() => {
    const cx = 150;
    const cy = 150;
    const r = 100;
    return wheelAreas.map((area, index) => {
      const angle = (Math.PI * 2 * index) / wheelAreas.length - Math.PI / 2;
      const score = Math.max(1, Math.min(10, wheelDraft[area.key] || 1));
      const radius = (r * score) / 10;
      return {
        key: area.key,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  }, [wheelDraft]);

  function updateScoreByPointer(clientX: number, clientY: number, areaKey: WheelAreaKey) {
    const svg = wheelSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 300;
    const y = ((clientY - rect.top) / rect.height) * 300;
    const cx = 150;
    const cy = 150;
    const idx = wheelAreas.findIndex((area) => area.key === areaKey);
    if (idx < 0) return;

    const axisAngle = (Math.PI * 2 * idx) / wheelAreas.length - Math.PI / 2;
    const dx = x - cx;
    const dy = y - cy;
    const axisX = Math.cos(axisAngle);
    const axisY = Math.sin(axisAngle);
    const projected = dx * axisX + dy * axisY;
    const clamped = Math.max(0, Math.min(100, projected));
    const nextScore = Math.max(1, Math.min(10, Math.round(clamped / 10)));

    setWheelDraft((prev) => ({ ...prev, [areaKey]: nextScore }));
  }

  useEffect(() => {
    if (!draggingArea) return;
    const activeArea = draggingArea;
    function onMove(event: PointerEvent) {
      updateScoreByPointer(event.clientX, event.clientY, activeArea);
    }
    function onUp() {
      setDraggingArea(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingArea]);

  const pageStyle: CSSProperties & Record<string, string> = {
    background: currentTheme.background,
    ...currentTheme.vars,
    "--accent": currentAccent.accent,
    "--accent-soft": currentAccent.soft,
  };

  return (
    <div className="min-h-screen px-3 py-4 md:px-5 md:py-8" style={pageStyle}>
      <main
        className="mx-auto flex min-h-[calc(100dvh-7.25rem)] max-w-6xl flex-col overflow-visible rounded-lg border border-line bg-surface/95 p-4 text-sm shadow-[0_18px_40px_rgba(20,19,17,0.08)] backdrop-blur-sm md:h-[calc(100dvh-7.25rem)] md:overflow-hidden md:p-5"
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
        {!isHydrated ? (
          <section className="h-full rounded-lg border border-[#eeeeee] bg-white/80 p-4" />
        ) : (
          <>
        <section className="rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-[#444444]">
              <span className="mr-1 text-2xl align-[-2px]">🏡</span>비전보드
            </h1>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md border border-[#dddddd] px-2 py-1 text-xs text-[#444444]"
                style={{ backgroundColor: mode === "collage" ? currentAccent.soft : "#fff" }}
                onClick={() => setMode("collage")}
              >
                🧩 콜라주 보드
              </button>
              <button
                type="button"
                className="rounded-md border border-[#dddddd] px-2 py-1 text-xs text-[#444444]"
                style={{ backgroundColor: mode === "wheel" ? currentAccent.soft : "#fff" }}
                onClick={() => setMode("wheel")}
              >
                🎡 인생 수레바퀴
              </button>
            </div>
          </div>
        </section>

        {mode === "collage" ? (
          <section className="mt-1 rounded-lg border border-[#eeeeee] bg-white/80 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => moveMonth(-1)}
                >
                  ◀
                </button>
                <p className="px-1 text-sm font-semibold text-[#444444]">{formatMonthLabel(month)}</p>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => moveMonth(1)}
                >
                  ▶
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setIsCollageEditMode((prev) => !prev)}
                >
                  {isCollageEditMode ? "편집 종료" : "편집"}
                </button>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => void exportWallpaperImage()}
                  disabled={monthlyPins.length === 0 || isExportingWallpaper}
                >
                  {isExportingWallpaper ? "저장중..." : "배경화면 저장"}
                </button>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                  style={primaryButtonStyle}
                  onClick={() => setIsAddPinOpen(true)}
                >
                  + 이미지 추가
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {mode === "collage" ? (
          <section className="mt-1 min-h-0 flex-1">
            <article className="h-full overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
              {monthlyPins.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-md border border-[#dddddd] bg-white text-sm text-[#666666]">
                  이 달의 비전 이미지를 추가해 보세요.
                </div>
              ) : (
                <>
                  {isMobileCollage ? (
                    <div className="collage-mobile-stack">
                      {collagePinsForBoard.map((pin) => (
                        <div
                          key={pin.id}
                          className="collage-item group relative overflow-hidden rounded-md border border-[#dddddd] bg-white"
                          draggable={isCollageEditMode}
                          onDragStart={() => setDraggedPinId(pin.id)}
                          onDragOver={(event) => {
                            if (!isCollageEditMode) return;
                            event.preventDefault();
                          }}
                          onDrop={() => {
                            if (!isCollageEditMode || !draggedPinId) return;
                            movePinOrder(draggedPinId, pin.id);
                            setDraggedPinId(null);
                          }}
                          onDragEnd={() => setDraggedPinId(null)}
                        >
                          {isCollageEditMode ? (
                            <div className="absolute right-1 top-1 z-10 flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded-md border border-[#dddddd] bg-white/95 px-1.5 py-0.5 text-xs text-[#444444]"
                                onClick={() => openEditPin(pin)}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-[#dddddd] bg-white/95 px-1.5 py-0.5 text-xs text-[#444444]"
                                onClick={() => deletePin(pin.id)}
                              >
                                ❌
                              </button>
                            </div>
                          ) : null}
                          <img src={pin.image} alt="vision-image" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="collage-grid-fill h-full desktop">
                      {activeCollageTemplate.map((slot, index) => {
                        const pin = collagePinsForBoard[index];
                        if (!pin) {
                          return (
                            <div
                              key={`slot-${index}`}
                              className="rounded-md border border-dashed border-[#1abc9c] bg-white/70"
                              style={{
                                gridColumn: `${slot.c} / span ${slot.cs}`,
                                gridRow: `${slot.r} / span ${slot.rs}`,
                              }}
                            />
                          );
                        }
                        return (
                          <div
                            key={pin.id}
                            className="collage-item group relative overflow-hidden rounded-md border border-[#dddddd] bg-white"
                            draggable={isCollageEditMode}
                            onDragStart={() => setDraggedPinId(pin.id)}
                            onDragOver={(event) => {
                              if (!isCollageEditMode) return;
                              event.preventDefault();
                            }}
                            onDrop={() => {
                              if (!isCollageEditMode || !draggedPinId) return;
                              movePinOrder(draggedPinId, pin.id);
                              setDraggedPinId(null);
                            }}
                            onDragEnd={() => setDraggedPinId(null)}
                            style={{
                              gridColumn: `${slot.c} / span ${slot.cs}`,
                              gridRow: `${slot.r} / span ${slot.rs}`,
                            }}
                          >
                            {isCollageEditMode ? (
                              <div className="absolute right-1 top-1 z-10 flex items-center gap-1">
                                <button
                                  type="button"
                                  className="rounded-md border border-[#dddddd] bg-white/95 px-1.5 py-0.5 text-xs text-[#444444]"
                                  onClick={() => openEditPin(pin)}
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-[#dddddd] bg-white/95 px-1.5 py-0.5 text-xs text-[#444444]"
                                  onClick={() => deletePin(pin.id)}
                                >
                                  ❌
                                </button>
                              </div>
                            ) : null}
                            <img src={pin.image} alt="vision-image" className="h-full w-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {hiddenPinCount > 0 ? (
                    <p className="mt-2 text-right text-[11px] text-[#666666]">
                      +{hiddenPinCount}장은 다음 순서로 이어져요.
                    </p>
                  ) : null}
                  {isCollageEditMode ? (
                    <p className="mt-1 text-right text-[11px] text-[#666666]">
                      카드를 다른 카드 위에 드래그하면 위치가 바뀝니다.
                    </p>
                  ) : null}
                </>
              )}
            </article>
          </section>
        ) : (
          <section className="mt-1 min-h-0 flex-1 grid gap-[5px] lg:grid-cols-[0.34fr_0.66fr]">
            <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-3">
              <h2 className="text-sm font-semibold text-[#444444]">월간 인생 수레바퀴</h2>
              <div className="mt-1 flex min-h-0 flex-1 items-center justify-center rounded-md border border-[#dddddd] bg-white p-1.5">
                <svg
                  ref={wheelSvgRef}
                  viewBox="0 0 300 300"
                  className="mx-auto h-full max-h-[360px] w-full max-w-[360px] touch-none"
                >
                  {[20, 40, 60, 80, 100].map((radius) => (
                    <circle key={radius} cx="150" cy="150" r={radius} fill="none" stroke="#eeeeee" strokeWidth="1" />
                  ))}
                  {wheelAreas.map((area, index) => {
                    const angle = (Math.PI * 2 * index) / wheelAreas.length - Math.PI / 2;
                    const x = 150 + 100 * Math.cos(angle);
                    const y = 150 + 100 * Math.sin(angle);
                    const lx = 150 + 122 * Math.cos(angle);
                    const ly = 150 + 122 * Math.sin(angle);
                    return (
                      <g key={area.key}>
                        <line x1="150" y1="150" x2={x} y2={y} stroke="#eeeeee" strokeWidth="1" />
                        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#666666">
                          {wheelEmojis[area.key] || "•"}
                        </text>
                      </g>
                    );
                  })}
                  <polygon points={polygonPoints} fill={currentAccent.soft} stroke={currentAccent.accent} strokeWidth="2" />
                  {handlePoints.map((point) => (
                    <circle
                      key={`handle-${point.key}`}
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill={currentAccent.accent}
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: "grab" }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        setDraggingArea(point.key);
                        updateScoreByPointer(event.clientX, event.clientY, point.key);
                      }}
                    />
                  ))}
                </svg>
              </div>

              <div className="mt-1 rounded-md border border-[#dddddd] bg-white p-2">
                <p className="mb-1 text-xs text-[#666666]">이번 달 한줄평</p>
                <textarea
                  className="h-14 w-full resize-none rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-sm outline-none"
                  placeholder="이번 달 핵심 문장 (2줄)"
                  value={wheelSummary}
                  onChange={(e) => setWheelSummary(e.target.value)}
                />
              </div>

              <div className="mt-1 rounded-md border border-[#dddddd] bg-white p-2">
                <p className="mb-1 text-xs text-[#666666]">다음 달 액션 플랜</p>
                <textarea
                  className="h-[90px] w-full resize-none rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs outline-none"
                  placeholder="다음 달에 반드시 실행할 액션"
                  value={wheelNextAction}
                  onChange={(e) => setWheelNextAction(e.target.value)}
                />
              </div>
            </article>

            <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#444444]">8개 영역 비전 시나리오</h2>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                    onClick={() => moveMonth(-1)}
                  >
                    ◀
                  </button>
                  <p className="px-1 text-xs font-semibold text-[#444444]">{formatMonthLabel(month)}</p>
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                    onClick={() => moveMonth(1)}
                  >
                    ▶
                  </button>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                  style={primaryButtonStyle}
                  onClick={saveWheel}
                >
                  월간 수레바퀴 저장
                </button>
              </div>
              <div className="vision-areas-grid mt-1 grid gap-1.5 md:grid-cols-2">
                {wheelAreas.map((area) => (
                  <div
                    key={`plan-${area.key}`}
                    className="flex min-h-0 flex-col rounded-md border border-[#dddddd] bg-white p-1.5"
                  >
                    <div className="mb-1 grid grid-cols-[auto_1fr_auto] items-center gap-1">
                      <input
                        className="w-9 rounded-md border border-[#dddddd] bg-white px-1 py-0.5 text-center text-xs text-[#444444] outline-none"
                        value={wheelEmojis[area.key] ?? ""}
                        onChange={(e) =>
                          setWheelEmojis((prev) => ({ ...prev, [area.key]: e.target.value.slice(0, 2) }))
                        }
                        placeholder="😀"
                      />
                      <input
                        className="min-w-0 flex-1 rounded-md border border-[#dddddd] bg-white px-1.5 py-0.5 text-xs text-[#444444] outline-none"
                        value={wheelLabels[area.key]}
                        onChange={(e) =>
                          setWheelLabels((prev) => ({ ...prev, [area.key]: e.target.value }))
                        }
                        placeholder="카테고리"
                      />
                      <span className="text-[10px] text-[#666666]">{wheelDraft[area.key]}점</span>
                    </div>
                    <div className="mt-1 grid min-h-0 flex-1 grid-cols-2 gap-1">
                      <textarea
                        className="h-full min-h-[36px] w-full resize-none rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs outline-none"
                        placeholder="현재"
                        value={wheelDetailsDraft[area.key].current}
                        onChange={(e) =>
                          setWheelDetailsDraft((prev) => ({
                            ...prev,
                            [area.key]: { ...prev[area.key], current: e.target.value },
                          }))
                        }
                      />
                      <textarea
                        className="h-full min-h-[36px] w-full resize-none rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs outline-none"
                        placeholder="단기 목표 (1년)"
                        value={wheelDetailsDraft[area.key].shortTerm}
                        onChange={(e) =>
                          setWheelDetailsDraft((prev) => ({
                            ...prev,
                            [area.key]: { ...prev[area.key], shortTerm: e.target.value },
                          }))
                        }
                      />
                      <textarea
                        className="h-full min-h-[36px] w-full resize-none rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs outline-none"
                        placeholder="중장기 (3~5년)"
                        value={wheelDetailsDraft[area.key].midTerm}
                        onChange={(e) =>
                          setWheelDetailsDraft((prev) => ({
                            ...prev,
                            [area.key]: { ...prev[area.key], midTerm: e.target.value },
                          }))
                        }
                      />
                      <textarea
                        className="h-full min-h-[36px] w-full resize-none rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs outline-none"
                        placeholder="장기 목표 (10년+)"
                        value={wheelDetailsDraft[area.key].longTerm}
                        onChange={(e) =>
                          setWheelDetailsDraft((prev) => ({
                            ...prev,
                            [area.key]: { ...prev[area.key], longTerm: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {isAddPinOpen ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-3">
            <div className="w-full max-w-lg rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#444444]">🧩 비전 이미지 추가</h3>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setIsAddPinOpen(false)}
                >
                  닫기
                </button>
              </div>
              <form className="mt-2 space-y-2" onSubmit={addPin}>
                <input
                  className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none"
                  placeholder="이미지 URL"
                  value={pinImage}
                  onChange={(e) => setPinImage(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                    style={primaryButtonStyle}
                  >
                    추가
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {isEditPinOpen ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-3">
            <div className="w-full max-w-md rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#444444]">🖼️ 이미지 수정</h3>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => setIsEditPinOpen(false)}
                >
                  닫기
                </button>
              </div>
              <form className="mt-2 space-y-2" onSubmit={savePinEdit}>
                <input
                  className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none"
                  placeholder="이미지 URL"
                  value={editPinImage}
                  onChange={(e) => setEditPinImage(e.target.value)}
                />
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                    onClick={() => setIsEditPinOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                    style={primaryButtonStyle}
                  >
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
          </>
        )}
        <style jsx>{`
          .collage-grid-fill {
            display: grid;
            gap: 8px;
            height: 100%;
          }

          .collage-grid-fill.desktop {
            grid-template-columns: repeat(16, minmax(0, 1fr));
            grid-template-rows: repeat(8, minmax(0, 1fr));
          }

          .collage-grid-fill.mobile {
            grid-template-columns: repeat(8, minmax(0, 1fr));
            grid-template-rows: repeat(14, minmax(0, 1fr));
          }

          .collage-mobile-stack {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            grid-auto-rows: auto;
            height: 100%;
          }

          .collage-mobile-stack .collage-item {
            aspect-ratio: 3 / 4;
          }

          .collage-item {
            position: relative;
            transition: filter 160ms ease, transform 160ms ease;
          }

          .collage-grid-fill:hover .collage-item {
            filter: brightness(0.66);
          }

          .collage-grid-fill:hover .collage-item:hover {
            filter: brightness(1);
            transform: translateY(-1px);
          }

          @media (max-width: 1100px) {
            .collage-grid-fill {
              gap: 6px;
            }
          }

          .vision-areas-grid {
            grid-auto-rows: minmax(0, 1fr);
            flex: 1;
            min-height: 0;
            align-content: stretch;
          }

          @media (max-width: 900px) {
            .collage-grid-fill {
              gap: 5px;
            }

            .vision-areas-grid {
              grid-auto-rows: auto;
              flex: 0 0 auto;
            }
          }

        `}</style>
      </main>
    </div>
  );
}
