"use client";
/* eslint-disable @next/next/no-img-element */

import dynamic from "next/dynamic";
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";

type ArchiveType = "book" | "scrap" | "place" | "wish";
type SortMode = "updated_desc" | "created_desc" | "favorite_first";
type MoodTheme = "neutral" | "coral" | "yellow" | "blue";
type AccentTone = "neutral" | "coral" | "yellow" | "blue";
type BookStatusFilter = "all" | "reading" | "paused" | "done";
type BookRunStatus = "reading" | "paused" | "done";
type PlaceStatus = "wishlist" | "visited" | "pass";
type WishStatus = "wishlist" | "planned" | "bought";
type NaverMapsApi = {
  LatLng: new (lat: number, lng: number) => unknown;
  Map: new (el: HTMLElement, options: { center: unknown; zoom: number }) => {
    setCenter: (point: unknown) => void;
  };
  Marker: new (options: { map: unknown; position: unknown }) => unknown;
  Service?: {
    geocode: (
      params: { query: string },
      cb: (status: string, response: { v2?: { addresses?: Array<{ y: string; x: string }> } }) => void,
    ) => void;
    Status?: { OK?: string };
  };
};

type ArchiveItem = {
  id: string;
  type: ArchiveType;
  title: string;
  note: string;
  tags: string[];
  link: string;
  images: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  author?: string;
  startDate?: string;
  endDate?: string;
  bookStatus?: BookRunStatus;
  readingLogDates?: string[];
  totalPages?: number;
  readPages?: number;
  scrapText?: string;
  coverImage?: string;
  genre?: string;
  scrapCategory?: string;
  placeCategory?: string;
  placeAddress?: string;
  placeStatus?: PlaceStatus;
  wishCategory?: string;
  wishStatus?: WishStatus;
  wishPrice?: string;
};

const ARCHIVE_STORAGE_KEY = "diary-os.archive.v1";
const THEME_STORAGE_KEY = "diary-os.theme.v1";
const ACCENT_STORAGE_KEY = "diary-os.accent.v1";
const CALLOUT_BG_STORAGE_KEY = "diary-os.callout-bg.v1";

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

const typeMeta: Record<ArchiveType, { label: string; emoji: string }> = {
  book: { label: "독서노트", emoji: "📚" },
  scrap: { label: "스크랩", emoji: "📰" },
  place: { label: "장소", emoji: "📍" },
  wish: { label: "위시리스트", emoji: "🛍️" },
};

const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];
const placeStatusMeta: Record<PlaceStatus, { label: string; emoji: string }> = {
  wishlist: { label: "방문전", emoji: "🔖" },
  visited: { label: "방문", emoji: "♥️" },
  pass: { label: "방문", emoji: "❌" },
};
const wishStatusMeta: Record<WishStatus, { label: string; emoji: string }> = {
  wishlist: { label: "위시", emoji: "💫" },
  planned: { label: "구매 예정", emoji: "🛒" },
  bought: { label: "구매 완료", emoji: "✅" },
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

function monthRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end };
}

function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}년 ${String(m).padStart(2, "0")}월`;
}

function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getYoutubeEmbedUrl(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isLikelyImageUrl(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value) return false;
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/.test(value);
}

function buildNaverMapSearchUrl(query: string) {
  const encoded = encodeURIComponent(query.trim());
  return `https://map.naver.com/v5/search/${encoded}`;
}

function getStoredArchive() {
  if (typeof window === "undefined") return [];
  const parsed = parseJson<unknown[]>(window.localStorage.getItem(ARCHIVE_STORAGE_KEY), []);
  return parsed
    .map((entry): ArchiveItem | null => {
      const item = entry as Partial<ArchiveItem>;
      if (!item || typeof item.title !== "string" || typeof item.type !== "string") {
        return null;
      }
      if (!["book", "scrap", "place", "wish"].includes(item.type)) return null;
      const images = Array.isArray(item.images)
        ? item.images.filter((img): img is string => typeof img === "string").slice(0, 3)
        : [];
      const coverImage =
        typeof item.coverImage === "string"
          ? item.coverImage
          : images[0] ?? "";
      return {
        id: typeof item.id === "string" ? item.id : createId(),
        type: item.type as ArchiveType,
        title: item.title,
        note: typeof item.note === "string" ? item.note : "",
        tags: Array.isArray(item.tags)
          ? item.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        link: typeof item.link === "string" ? item.link : "",
        images,
        favorite: Boolean(item.favorite),
        createdAt:
          typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        updatedAt:
          typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
        author: typeof item.author === "string" ? item.author : "",
        genre: typeof item.genre === "string" ? item.genre : "",
        startDate: typeof item.startDate === "string" ? item.startDate : "",
        endDate: typeof item.endDate === "string" ? item.endDate : "",
        bookStatus:
          item.bookStatus === "reading" || item.bookStatus === "paused" || item.bookStatus === "done"
            ? item.bookStatus
            : undefined,
        readingLogDates: Array.isArray(item.readingLogDates)
          ? item.readingLogDates.filter((date): date is string => typeof date === "string")
          : [],
        totalPages:
          typeof item.totalPages === "number" && Number.isFinite(item.totalPages)
            ? item.totalPages
            : undefined,
        readPages:
          typeof item.readPages === "number" && Number.isFinite(item.readPages)
            ? item.readPages
            : undefined,
        scrapText: typeof item.scrapText === "string" ? item.scrapText : "",
        scrapCategory: typeof item.scrapCategory === "string" ? item.scrapCategory : "",
        placeCategory: typeof item.placeCategory === "string" ? item.placeCategory : "",
        placeAddress: typeof item.placeAddress === "string" ? item.placeAddress : "",
        placeStatus:
          item.placeStatus === "wishlist" || item.placeStatus === "visited" || item.placeStatus === "pass"
            ? item.placeStatus
            : undefined,
        wishCategory: typeof item.wishCategory === "string" ? item.wishCategory : "",
        wishStatus:
          item.wishStatus === "wishlist" || item.wishStatus === "planned" || item.wishStatus === "bought"
            ? item.wishStatus
            : undefined,
        wishPrice: typeof item.wishPrice === "string" ? item.wishPrice : "",
        coverImage,
      } satisfies ArchiveItem;
    })
    .filter((item): item is ArchiveItem => item !== null);
}

function isBookDone(item: ArchiveItem) {
  if (item.type !== "book") return false;
  if (item.bookStatus === "done") return true;
  if (item.endDate) return true;
  if (item.totalPages && item.readPages && item.readPages >= item.totalPages) return true;
  return false;
}

function getBookStatus(item: ArchiveItem): BookRunStatus {
  if (item.type !== "book") return "reading";
  if (item.bookStatus === "paused" || item.bookStatus === "reading" || item.bookStatus === "done") {
    return item.bookStatus;
  }
  return isBookDone(item) ? "done" : "reading";
}

function getReadingLogDates(item: ArchiveItem) {
  if (item.type !== "book") return [];
  return Array.from(new Set((item.readingLogDates ?? []).filter(Boolean))).sort();
}

function progressPercent(item: ArchiveItem) {
  if (item.type !== "book") return 0;
  const total = item.totalPages ?? 0;
  const read = item.readPages ?? 0;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((read / total) * 100)));
}

function ArchivePageInner() {
  const [theme] = useState<MoodTheme>(getStoredTheme);
  const [accentTone] = useState<AccentTone>(getStoredAccent);
  const [calloutBackground] = useState(getStoredCalloutBackground);
  const [items, setItems] = useState<ArchiveItem[]>(getStoredArchive);

  const [typeInput, setTypeInput] = useState<ArchiveType>("book");
  const [titleInput, setTitleInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [genreInput, setGenreInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [totalPagesInput, setTotalPagesInput] = useState("");
  const [readPagesInput, setReadPagesInput] = useState("");
  const [bookCoverInput, setBookCoverInput] = useState("");
  const [bookScrapInput, setBookScrapInput] = useState("");
  const [scrapCategoryInput, setScrapCategoryInput] = useState("");
  const [placeCategoryInput, setPlaceCategoryInput] = useState("");
  const [placeAddressInput, setPlaceAddressInput] = useState("");
  const [placeStatusInput, setPlaceStatusInput] = useState<PlaceStatus>("wishlist");
  const [wishCategoryInput, setWishCategoryInput] = useState("");
  const [wishStatusInput, setWishStatusInput] = useState<WishStatus>("wishlist");
  const [wishPriceInput, setWishPriceInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [image1Input, setImage1Input] = useState("");
  const [image2Input, setImage2Input] = useState("");
  const [image3Input, setImage3Input] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState<ArchiveType>("book");
  const [searchInput, setSearchInput] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");

  const [bookMonth, setBookMonth] = useState(toMonthKey());
  const [bookStatusFilter, setBookStatusFilter] = useState<BookStatusFilter>("all");
  const [openBookCellDate, setOpenBookCellDate] = useState<string | null>(null);
  const [quoteSeed, setQuoteSeed] = useState(0);
  const [selectedScrapCategory, setSelectedScrapCategory] = useState("all");
  const [selectedScrapId, setSelectedScrapId] = useState<string | null>(null);
  const [selectedPlaceCategory, setSelectedPlaceCategory] = useState("all");
  const [selectedPlaceStatus, setSelectedPlaceStatus] = useState<"all" | PlaceStatus>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedWishCategory, setSelectedWishCategory] = useState("all");
  const [selectedWishStatus, setSelectedWishStatus] = useState<"all" | WishStatus>("all");
  const [selectedWishId, setSelectedWishId] = useState<string | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  const naverMapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";

  useEffect(() => {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (zoomedImageUrl) {
        setZoomedImageUrl(null);
        return;
      }
      if (isAddModalOpen) {
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAddModalOpen, zoomedImageUrl]);

  function resetForm() {
    setTypeInput(typeFilter);
    setTitleInput("");
    setAuthorInput("");
    setGenreInput("");
    setStartDateInput("");
    setEndDateInput("");
    setTotalPagesInput("");
    setReadPagesInput("");
    setBookCoverInput("");
    setBookScrapInput("");
    setScrapCategoryInput("");
    setPlaceCategoryInput("");
    setPlaceAddressInput("");
    setPlaceStatusInput("wishlist");
    setWishCategoryInput("");
    setWishStatusInput("wishlist");
    setWishPriceInput("");
    setLinkInput("");
    setTagsInput("");
    setImage1Input("");
    setImage2Input("");
    setImage3Input("");
    setNoteInput("");
    setEditingId(null);
  }

  function startEdit(item: ArchiveItem) {
    setIsAddModalOpen(true);
    setEditingId(item.id);
    setTypeInput(item.type);
    setTitleInput(item.title);
    setAuthorInput(item.author ?? "");
    setGenreInput(item.genre ?? "");
    setStartDateInput(item.startDate ?? "");
    setEndDateInput(item.endDate ?? "");
    setTotalPagesInput(item.totalPages ? String(item.totalPages) : "");
    setReadPagesInput(item.readPages ? String(item.readPages) : "");
    setBookCoverInput(item.coverImage ?? item.images[0] ?? "");
    setBookScrapInput(item.scrapText ?? "");
    setScrapCategoryInput(item.scrapCategory ?? "");
    setPlaceCategoryInput(item.placeCategory ?? "");
    setPlaceAddressInput(item.placeAddress ?? "");
    setPlaceStatusInput(item.placeStatus ?? "wishlist");
    setWishCategoryInput(item.wishCategory ?? "");
    setWishStatusInput(item.wishStatus ?? "wishlist");
    setWishPriceInput(item.wishPrice ?? "");
    setLinkInput(item.link);
    setTagsInput(item.tags.join(", "));
    setImage1Input(item.images[0] ?? "");
    setImage2Input(item.images[1] ?? "");
    setImage3Input(item.images[2] ?? "");
    setNoteInput(item.note);
  }

  function updateBookItem(id: string, updater: (item: ArchiveItem) => ArchiveItem) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.type !== "book") return item;
        return updater(item);
      }),
    );
  }

  function markReadToday(id: string) {
    const today = toDateKey();
    updateBookItem(id, (item) => {
      const nextLogs = Array.from(new Set([...getReadingLogDates(item), today])).sort();
      return {
        ...item,
        readingLogDates: nextLogs,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function setBookRunStatus(id: string, status: BookRunStatus) {
    updateBookItem(id, (item) => {
      const base: ArchiveItem = {
        ...item,
        bookStatus: status,
        updatedAt: new Date().toISOString(),
      };
      if (status === "done") {
        return {
          ...base,
          endDate: item.endDate || toDateKey(),
        };
      }
      return base;
    });
  }

  function upsertItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = titleInput.trim();
    if (!title) return;

    const now = new Date().toISOString();
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const parsedTotal = totalPagesInput.trim() ? Number(totalPagesInput) : undefined;
    const parsedReadRaw = readPagesInput.trim() ? Number(readPagesInput) : undefined;
    const parsedRead =
      typeof parsedReadRaw === "number" && Number.isFinite(parsedReadRaw)
        ? parsedTotal && Number.isFinite(parsedTotal)
          ? Math.min(parsedReadRaw, parsedTotal)
          : parsedReadRaw
        : undefined;

    const isBook = typeInput === "book";
    const editingItem = editingId ? items.find((item) => item.id === editingId) : null;

    const payloadBase = {
      type: typeInput,
      title,
      note: noteInput.trim(),
      tags,
      updatedAt: now,
    } as const;

    const payloadForBook = {
      ...payloadBase,
      link: "",
      images: bookCoverInput.trim() ? [bookCoverInput.trim()] : [],
      coverImage: bookCoverInput.trim(),
      author: authorInput.trim(),
      genre: genreInput.trim(),
      startDate: startDateInput,
      endDate: endDateInput,
      bookStatus:
        endDateInput || (parsedTotal && parsedRead && parsedRead >= parsedTotal)
          ? ("done" as BookRunStatus)
          : editingItem?.type === "book"
            ? getBookStatus(editingItem)
            : ("reading" as BookRunStatus),
      readingLogDates:
        editingItem?.type === "book" ? getReadingLogDates(editingItem) : [],
      totalPages:
        typeof parsedTotal === "number" && Number.isFinite(parsedTotal)
          ? parsedTotal
          : undefined,
      readPages: parsedRead,
      scrapText: bookScrapInput.trim(),
    };

    const payloadForOther = {
      ...payloadBase,
      link: linkInput.trim(),
      images: [image1Input.trim(), image2Input.trim(), image3Input.trim()]
        .filter(Boolean)
        .slice(0, 3),
      coverImage: "",
      author: "",
      genre: "",
      startDate: "",
      endDate: "",
      bookStatus: undefined,
      readingLogDates: undefined,
      totalPages: undefined,
      readPages: undefined,
      scrapText: "",
      scrapCategory: typeInput === "scrap" ? scrapCategoryInput.trim() : "",
      placeCategory: typeInput === "place" ? placeCategoryInput.trim() : "",
      placeAddress: typeInput === "place" ? placeAddressInput.trim() : "",
      placeStatus: typeInput === "place" ? placeStatusInput : undefined,
      wishCategory: typeInput === "wish" ? wishCategoryInput.trim() : "",
      wishStatus: typeInput === "wish" ? wishStatusInput : undefined,
      wishPrice: typeInput === "wish" ? wishPriceInput.trim() : "",
    };

    if (editingId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...(isBook ? payloadForBook : payloadForOther),
              }
            : item,
        ),
      );
      resetForm();
      setIsAddModalOpen(false);
      return;
    }

    const next: ArchiveItem = {
      id: createId(),
      favorite: false,
      createdAt: now,
      ...(isBook ? payloadForBook : payloadForOther),
    };
    setItems((prev) => [next, ...prev]);
    resetForm();
    setIsAddModalOpen(false);
  }

  const filteredItems = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase();
    let next = items.filter((item) => {
      if (item.type !== typeFilter) return false;
      if (genreFilter !== "all" && item.type === "book" && (item.genre || "") !== genreFilter) {
        return false;
      }
      if (!keyword) return true;
      const haystack = `${item.title} ${item.note} ${item.tags.join(" ")} ${item.link} ${item.author ?? ""} ${item.genre ?? ""} ${item.scrapText ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });

    if (sortMode === "favorite_first") {
      next = [...next].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    } else if (sortMode === "created_desc") {
      next = [...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      next = [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return next;
  }, [items, typeFilter, genreFilter, searchInput, sortMode]);

  const scrapItems = useMemo(
    () =>
      items
        .filter((item) => item.type === "scrap")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  );
  const scrapCategories = useMemo(() => {
    const set = new Set<string>();
    scrapItems.forEach((item) => {
      const category = (item.scrapCategory || "").trim();
      if (category) set.add(category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scrapItems]);
  const filteredScraps = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase();
    return scrapItems.filter((item) => {
      if (
        selectedScrapCategory !== "all" &&
        (item.scrapCategory || "").trim() !== selectedScrapCategory
      ) {
        return false;
      }
      if (!keyword) return true;
      const haystack =
        `${item.title} ${item.note} ${(item.scrapText ?? "").trim()} ${(item.tags ?? []).join(" ")} ${(item.link ?? "").trim()}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [scrapItems, searchInput, selectedScrapCategory]);
  const selectedScrap = useMemo(
    () => filteredScraps.find((item) => item.id === selectedScrapId) ?? filteredScraps[0] ?? null,
    [filteredScraps, selectedScrapId],
  );
  const placeItems = useMemo(
    () =>
      items
        .filter((item) => item.type === "place")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  );
  const placeCategories = useMemo(() => {
    const set = new Set<string>();
    placeItems.forEach((item) => {
      const category = (item.placeCategory || "").trim();
      if (category) set.add(category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [placeItems]);
  const filteredPlaces = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase();
    return placeItems.filter((item) => {
      if (selectedPlaceStatus !== "all" && (item.placeStatus ?? "wishlist") !== selectedPlaceStatus) {
        return false;
      }
      if (
        selectedPlaceCategory !== "all" &&
        (item.placeCategory || "").trim() !== selectedPlaceCategory
      ) {
        return false;
      }
      if (!keyword) return true;
      const haystack = `${item.title} ${item.note} ${(item.tags ?? []).join(" ")} ${(item.link ?? "").trim()}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [placeItems, searchInput, selectedPlaceCategory, selectedPlaceStatus]);
  const selectedPlace = useMemo(
    () => filteredPlaces.find((item) => item.id === selectedPlaceId) ?? filteredPlaces[0] ?? null,
    [filteredPlaces, selectedPlaceId],
  );
  const wishItems = useMemo(
    () =>
      items
        .filter((item) => item.type === "wish")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  );
  const wishCategories = useMemo(() => {
    const set = new Set<string>();
    wishItems.forEach((item) => {
      const category = (item.wishCategory || "").trim();
      if (category) set.add(category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [wishItems]);
  const filteredWishes = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase();
    return wishItems.filter((item) => {
      if (selectedWishStatus !== "all" && (item.wishStatus ?? "wishlist") !== selectedWishStatus) {
        return false;
      }
      if (selectedWishCategory !== "all" && (item.wishCategory || "").trim() !== selectedWishCategory) {
        return false;
      }
      if (!keyword) return true;
      const haystack = `${item.title} ${item.note} ${(item.tags ?? []).join(" ")} ${(item.link ?? "").trim()} ${(item.wishPrice ?? "").trim()}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [wishItems, searchInput, selectedWishCategory, selectedWishStatus]);
  const selectedWish = useMemo(
    () => filteredWishes.find((item) => item.id === selectedWishId) ?? filteredWishes[0] ?? null,
    [filteredWishes, selectedWishId],
  );

  useEffect(() => {
    if (!naverMapClientId) return;
    const mapSdkId = "naver-map-sdk";
    let script = document.getElementById(mapSdkId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = mapSdkId;
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${naverMapClientId}&submodules=geocoder`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [naverMapClientId]);

  useEffect(() => {
    if (typeFilter !== "place") return;
    if (!selectedPlace?.title) return;
    const mapEl = document.getElementById("naver-place-map");
    if (!mapEl) return;

    const renderMap = () => {
      try {
        const maps = (window as typeof window & { naver?: { maps?: NaverMapsApi } }).naver?.maps;
        if (!maps || typeof maps.LatLng !== "function" || typeof maps.Map !== "function") return;
        const fallbackCenter = new maps.LatLng(37.5665, 126.978);
        const map = new maps.Map(mapEl, {
          center: fallbackCenter,
          zoom: 14,
        });

        const geocode = maps.Service?.geocode;
        if (typeof geocode !== "function") return;

        const addressQuery = (selectedPlace.placeAddress || "").trim();
        const titleQuery = selectedPlace.title.trim();
        const queries = addressQuery ? [addressQuery] : titleQuery ? [titleQuery] : [];
        if (queries.length === 0) return;

        const fallbackWithOpenStreetMap = async () => {
          for (const query of queries) {
            try {
              const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
              if (!res.ok) continue;
              const row = (await res.json()) as { lat?: number | null; lng?: number | null };
              const lat = Number(row.lat);
              const lng = Number(row.lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
              const point = new maps.LatLng(lat, lng);
              map.setCenter(point);
              if (typeof maps.Marker === "function") {
                new maps.Marker({ map, position: point });
              }
              return;
            } catch {
              // ignore and try next query
            }
          }
        };

        const tryGeocode = (index: number) => {
          if (index >= queries.length) {
            void fallbackWithOpenStreetMap();
            return;
          }
          geocode({ query: queries[index] }, (_status, response) => {
            try {
              const address = response?.v2?.addresses?.[0];
              if (!address) {
                tryGeocode(index + 1);
                return;
              }
              const lat = Number(address.y);
              const lng = Number(address.x);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                tryGeocode(index + 1);
                return;
              }
              const point = new maps.LatLng(lat, lng);
              map.setCenter(point);
              if (typeof maps.Marker === "function") {
                new maps.Marker({ map, position: point });
              }
            } catch {
              tryGeocode(index + 1);
            }
          });
        };

        tryGeocode(0);
      } catch {
        // swallow map render errors to prevent page crash
      }
    };

    const mapsLoaded = (window as typeof window & { naver?: { maps?: unknown } }).naver?.maps;
    if (mapsLoaded) {
      renderMap();
      return;
    }

    const script = document.getElementById("naver-map-sdk") as HTMLScriptElement | null;
    if (!script) return;
    script.addEventListener("load", renderMap);
    return () => script.removeEventListener("load", renderMap);
  }, [typeFilter, selectedPlace, naverMapClientId]);

  const bookItems = useMemo(() => items.filter((item) => item.type === "book"), [items]);
  const bookGenres = useMemo(() => {
    const set = new Set<string>();
    bookItems.forEach((item) => {
      const value = (item.genre || "").trim();
      if (value) set.add(value);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [bookItems]);

  const calendarBooks = useMemo(() => {
    return bookItems.filter((item) => {
      const status = getBookStatus(item);
      if (bookStatusFilter === "reading" && status !== "reading") return false;
      if (bookStatusFilter === "paused" && status !== "paused") return false;
      if (bookStatusFilter === "done" && status !== "done") return false;
      return true;
    });
  }, [bookItems, bookStatusFilter]);

  const monthInfo = useMemo(() => monthRange(bookMonth), [bookMonth]);

  const monthBookCount = useMemo(() => {
    const activeIds = new Set<string>();
    calendarBooks.forEach((item) => {
      const hasLogInMonth = getReadingLogDates(item).some((date) => {
        const dateObj = new Date(`${date}T12:00:00`);
        return dateObj >= monthInfo.start && dateObj <= monthInfo.end;
      });
      if (hasLogInMonth) activeIds.add(item.id);
    });
    return activeIds.size;
  }, [calendarBooks, monthInfo.start, monthInfo.end]);

  const monthlyReadingCount = useMemo(
    () =>
      calendarBooks.filter((item) => {
        const status = getBookStatus(item);
        return status === "reading";
      }).length,
    [calendarBooks],
  );

  const monthlyDoneCount = useMemo(
    () =>
      calendarBooks.filter((item) => {
        const status = getBookStatus(item);
        return status === "done";
      }).length,
    [calendarBooks],
  );

  const monthlyPausedCount = useMemo(
    () =>
      calendarBooks.filter((item) => {
        const status = getBookStatus(item);
        return status === "paused";
      }).length,
    [calendarBooks],
  );

  const monthlyAvgProgress = useMemo(() => {
    if (calendarBooks.length === 0) return 0;
    const sum = calendarBooks.reduce((acc, item) => acc + progressPercent(item), 0);
    return Math.round(sum / calendarBooks.length);
  }, [calendarBooks]);

  const monthlyTopGenre = useMemo(() => {
    const counter = new Map<string, number>();
    calendarBooks.forEach((item) => {
      const genre = (item.genre || "").trim() || "미입력";
      counter.set(genre, (counter.get(genre) ?? 0) + 1);
    });
    const sorted = Array.from(counter.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "-";
  }, [calendarBooks]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(monthInfo.start.getFullYear(), monthInfo.start.getMonth(), 1).getDay();
    const daysInMonth = monthInfo.end.getDate();
    const total = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    return Array.from({ length: total }, (_, i) => {
      const day = i - firstDay + 1;
      if (day < 1 || day > daysInMonth) {
        return { date: null as string | null, day: null as number | null, books: [] as ArchiveItem[] };
      }
      const date = `${bookMonth}-${String(day).padStart(2, "0")}`;
      const books = calendarBooks.filter((item) => {
        return getReadingLogDates(item).includes(date);
      });
      return { date, day, books };
    });
  }, [monthInfo.start, monthInfo.end, bookMonth, calendarBooks]);

  const mobileBookCalendarRows = useMemo(() => {
    return calendarCells
      .filter((cell) => Boolean(cell.date) && cell.books.length > 0)
      .map((cell) => {
        const date = cell.date as string;
        const weekday = weekLabels[new Date(`${date}T00:00:00`).getDay()];
        return { date, day: cell.day as number, weekday, books: cell.books };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [calendarCells]);

  const quoteCandidates = useMemo(() => {
    const fromBooks = items
      .filter((item) => item.type === "book")
      .flatMap((item) =>
        (item.scrapText ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ text: line, source: item.title })),
      );
    const fromScraps = items
      .filter((item) => item.type === "scrap")
      .flatMap((item) =>
        item.note
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ text: line, source: item.title })),
      );

    const fallback = [
      { text: "작은 진전이 결국 큰 변화를 만든다.", source: "Daily Quote" },
      { text: "읽은 한 페이지가 생각의 방향을 바꾼다.", source: "Daily Quote" },
      { text: "꾸준함은 재능을 이긴다.", source: "Daily Quote" },
    ];

    const merged = [...fromBooks, ...fromScraps];
    return merged.length > 0 ? merged : fallback;
  }, [items]);

  const randomQuote = useMemo(() => {
    const index = Math.abs(quoteSeed) % quoteCandidates.length;
    return quoteCandidates[index];
  }, [quoteCandidates, quoteSeed]);

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
        <section className="rounded-lg border border-[#eeeeee] bg-white/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-[#444444]">
              <span className="mr-1 text-2xl align-[-2px]">🗂️</span>아카이브
            </h1>
            <div className="flex flex-wrap items-center gap-1">
              {(["book", "scrap", "place", "wish"] as ArchiveType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className="rounded-md border border-[#dddddd] px-2 py-1 text-xs text-[#444444]"
                  style={{ backgroundColor: typeFilter === type ? currentAccent.soft : "#fff" }}
                  onClick={() => {
                    setTypeFilter(type);
                    if (!editingId) setTypeInput(type);
                    if (type === "scrap") {
                      setSelectedScrapCategory("all");
                    }
                    if (type === "place") {
                      setSelectedPlaceCategory("all");
                      setSelectedPlaceStatus("all");
                    }
                    if (type === "wish") {
                      setSelectedWishCategory("all");
                      setSelectedWishStatus("all");
                    }
                  }}
                >
                  {typeMeta[type].emoji} {typeMeta[type].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-1 min-h-0 flex-1">
        {typeFilter === "wish" ? (
          <section className="grid h-full gap-[5px] lg:grid-cols-[0.42fr_0.58fr] lg:items-stretch">
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#444444]">
                  <span className="mr-1 text-lg">🛍️</span>위시리스트
                </h2>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                  style={primaryButtonStyle}
                  onClick={() => {
                    if (!editingId) setTypeInput("wish");
                    setIsAddModalOpen(true);
                  }}
                >
                  + 추가
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-1.5">
                <input
                  className="min-w-0 rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="검색(상품명/태그/메모/가격)"
                />
                <span className="whitespace-nowrap text-xs text-[#777777]">{filteredWishes.length}개</span>
              </div>
              <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                  style={{ backgroundColor: selectedWishStatus === "all" ? currentAccent.soft : "#fff" }}
                  onClick={() => setSelectedWishStatus("all")}
                >
                  상태 전체
                </button>
                {(Object.keys(wishStatusMeta) as WishStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                    style={{
                      backgroundColor: selectedWishStatus === status ? currentAccent.soft : "#fff",
                    }}
                    onClick={() => setSelectedWishStatus(status)}
                  >
                    {wishStatusMeta[status].emoji} {wishStatusMeta[status].label}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                  style={{ backgroundColor: selectedWishCategory === "all" ? currentAccent.soft : "#fff" }}
                  onClick={() => setSelectedWishCategory("all")}
                >
                  전체
                </button>
                {wishCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                    style={{
                      backgroundColor: selectedWishCategory === category ? currentAccent.soft : "#fff",
                    }}
                    onClick={() => setSelectedWishCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {filteredWishes.length === 0 ? (
                  <div className="rounded-md border border-[#dddddd] bg-white px-3 py-4 text-xs text-[#666666]">
                    위시 항목이 없어요.
                  </div>
                ) : (
                  filteredWishes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-2 text-left"
                      style={{
                        borderColor: selectedWish?.id === item.id ? currentAccent.accent : "#dddddd",
                        backgroundColor: selectedWish?.id === item.id ? currentAccent.soft : "#fff",
                      }}
                      onClick={() => setSelectedWishId(item.id)}
                    >
                      <p className="truncate text-sm font-semibold text-[#444444]">{item.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#777777]">
                        {(item.wishCategory || "미분류")} · {new Date(item.updatedAt).toLocaleDateString("ko-KR")}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#777777]">
                        {wishStatusMeta[item.wishStatus ?? "wishlist"].emoji}{" "}
                        {wishStatusMeta[item.wishStatus ?? "wishlist"].label}
                        {(item.wishPrice || "").trim() ? ` · ${item.wishPrice}` : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </article>
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
              {selectedWish ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <h3 className="whitespace-normal break-words text-base font-semibold text-[#444444]">🛍️ {selectedWish.title}</h3>
                        <span className="rounded-full border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#666666]">
                          {wishStatusMeta[selectedWish.wishStatus ?? "wishlist"].emoji}{" "}
                          {wishStatusMeta[selectedWish.wishStatus ?? "wishlist"].label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#777777]">
                        {(selectedWish.wishCategory || "미분류")}
                        {(selectedWish.wishPrice || "").trim() ? ` · ${selectedWish.wishPrice}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        className="rounded-md border border-transparent px-2 py-1 text-[11px] font-medium shadow-sm"
                        style={softButtonStyle}
                        onClick={() => startEdit(selectedWish)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-transparent px-2 py-1 text-[11px] font-medium shadow-sm"
                        style={softButtonStyle}
                        onClick={() =>
                          setItems((prev) => prev.filter((target) => target.id !== selectedWish.id))
                        }
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  {selectedWish.link ? (
                    <a
                      href={selectedWish.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex w-fit rounded-md border border-[#dddddd] bg-white px-2 py-1 text-[11px] text-[#444444]"
                    >
                      상품 링크 열기
                    </a>
                  ) : null}
                  <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-[#dddddd] bg-white p-2">
                    {selectedWish.images.length > 0 ? (
                      <div
                        className={`grid gap-2 ${
                          selectedWish.images.length === 1
                            ? "grid-cols-1"
                            : selectedWish.images.length === 2
                              ? "grid-cols-2"
                              : "grid-cols-3"
                        }`}
                      >
                        {selectedWish.images.map((url) => (
                          <button
                            type="button"
                            key={`${selectedWish.id}-img-${url}`}
                            className="aspect-square w-full overflow-hidden rounded-md border border-[#dddddd] bg-[#f6f6f6]"
                            onClick={() => setZoomedImageUrl(url)}
                          >
                            <img
                              src={url}
                              alt={selectedWish.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-md border border-[#eeeeee] text-sm text-[#777777]">
                        이미지가 없습니다.
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {(selectedWish.tags || []).map((tag) => (
                        <span
                          key={`${selectedWish.id}-detail-tag-${tag}`}
                          className="rounded-full border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {(selectedWish.note || "").trim() ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-[#666666]">메모</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[#444444]">{selectedWish.note}</p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-[#dddddd] bg-white text-sm text-[#666666]">
                  왼쪽 목록에서 위시 항목을 선택해 주세요.
                </div>
              )}
            </article>
          </section>
        ) : typeFilter === "place" ? (
          <section className="grid h-full gap-[5px] lg:grid-cols-[0.42fr_0.58fr] lg:items-stretch">
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#444444]">
                  <span className="mr-1 text-lg">📍</span>장소 목록
                </h2>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                  style={primaryButtonStyle}
                  onClick={() => {
                    if (!editingId) setTypeInput("place");
                    setIsAddModalOpen(true);
                  }}
                >
                  + 추가
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-1.5">
                <input
                  className="min-w-0 rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="검색(장소명/태그/메모)"
                />
                <span className="whitespace-nowrap text-xs text-[#777777]">{filteredPlaces.length}개</span>
              </div>
              <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                  style={{ backgroundColor: selectedPlaceStatus === "all" ? currentAccent.soft : "#fff" }}
                  onClick={() => setSelectedPlaceStatus("all")}
                >
                  상태 전체
                </button>
                {(Object.keys(placeStatusMeta) as PlaceStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                    style={{
                      backgroundColor:
                        selectedPlaceStatus === status ? currentAccent.soft : "#fff",
                    }}
                    onClick={() => setSelectedPlaceStatus(status)}
                  >
                    {placeStatusMeta[status].emoji} {placeStatusMeta[status].label}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                  style={{ backgroundColor: selectedPlaceCategory === "all" ? currentAccent.soft : "#fff" }}
                  onClick={() => setSelectedPlaceCategory("all")}
                >
                  전체
                </button>
                {placeCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                    style={{
                      backgroundColor:
                        selectedPlaceCategory === category ? currentAccent.soft : "#fff",
                    }}
                    onClick={() => setSelectedPlaceCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {filteredPlaces.length === 0 ? (
                  <div className="rounded-md border border-[#dddddd] bg-white px-3 py-4 text-xs text-[#666666]">
                    장소가 없어요.
                  </div>
                ) : (
                  filteredPlaces.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-2 text-left"
                      style={{
                        borderColor: selectedPlace?.id === item.id ? currentAccent.accent : "#dddddd",
                        backgroundColor: selectedPlace?.id === item.id ? currentAccent.soft : "#fff",
                      }}
                      onClick={() => setSelectedPlaceId(item.id)}
                    >
                      <p className="truncate text-sm font-semibold text-[#444444]">{item.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#777777]">
                        {(item.placeCategory || "미분류")} · {new Date(item.updatedAt).toLocaleDateString("ko-KR")}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#777777]">
                        {placeStatusMeta[item.placeStatus ?? "wishlist"].emoji}{" "}
                        {placeStatusMeta[item.placeStatus ?? "wishlist"].label}
                      </p>
                      {(item.placeAddress || "").trim() ? (
                        <p className="mt-0.5 truncate text-[11px] text-[#777777]">
                          {(item.placeAddress || "").trim()}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(item.tags || []).slice(0, 3).map((tag) => (
                          <span
                            key={`${item.id}-tag-${tag}`}
                            className="rounded-full border border-[#dddddd] bg-white px-2 py-0.5 text-[10px] text-[#666666]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </article>
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
              {selectedPlace ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <h3 className="whitespace-normal break-words text-base font-semibold text-[#444444]">🧭 {selectedPlace.title}</h3>
                        <span className="rounded-full border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#666666]">
                          {placeStatusMeta[selectedPlace.placeStatus ?? "wishlist"].emoji}{" "}
                          {placeStatusMeta[selectedPlace.placeStatus ?? "wishlist"].label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#777777]">
                        {(selectedPlace.placeCategory || "미분류")} · {new Date(selectedPlace.updatedAt).toLocaleString("ko-KR")}
                      </p>
                      {(selectedPlace.placeAddress || "").trim() ? (
                        <p className="mt-0.5 text-xs text-[#777777]">
                          {(selectedPlace.placeAddress || "").trim()}
                        </p>
                      ) : null}
                      {selectedPlace.link ? (
                        <a
                          href={selectedPlace.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                        >
                          리뷰 링크 열기
                        </a>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        className="rounded-md border border-transparent px-2 py-1 text-[11px] font-medium shadow-sm"
                        style={softButtonStyle}
                        onClick={() => startEdit(selectedPlace)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-transparent px-2 py-1 text-[11px] font-medium shadow-sm"
                        style={softButtonStyle}
                        onClick={() =>
                          setItems((prev) => prev.filter((target) => target.id !== selectedPlace.id))
                        }
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="relative mt-2 rounded-md border border-[#dddddd] bg-white p-2">
                    {naverMapClientId ? (
                      <div
                        id="naver-place-map"
                        className="h-[170px] w-full rounded-md border border-[#eeeeee]"
                      />
                    ) : (
                      <div className="flex h-[170px] items-center justify-center rounded-md border border-[#eeeeee] bg-white text-center text-xs text-[#666666]">
                        NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 설정 후
                        <br />
                        네이버 지도를 바로 볼 수 있어요.
                      </div>
                    )}
                    <a
                      href={buildNaverMapSearchUrl(
                        (selectedPlace.placeAddress || "").trim() || selectedPlace.title,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute right-3 top-3 rounded-md border border-[#dddddd] bg-white/95 px-2 py-1 text-[11px] text-[#444444] shadow-sm"
                    >
                      네이버 지도 열기
                    </a>
                  </div>
                  <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-[#dddddd] bg-white p-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {(selectedPlace.tags || []).map((tag) => (
                        <span
                          key={`${selectedPlace.id}-detail-tag-${tag}`}
                          className="rounded-full border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {selectedPlace.images.length > 0 ? (
                      <div
                        className={`mt-2 grid gap-2 ${
                          selectedPlace.images.length === 1
                            ? "grid-cols-1"
                            : selectedPlace.images.length === 2
                              ? "grid-cols-2"
                              : "grid-cols-3"
                        }`}
                      >
                        {selectedPlace.images.map((url) => (
                          <button
                            type="button"
                            key={`${selectedPlace.id}-img-${url}`}
                            className="aspect-square w-full overflow-hidden rounded-md border border-[#dddddd] bg-[#f6f6f6]"
                            onClick={() => setZoomedImageUrl(url)}
                          >
                            <img
                              src={url}
                              alt={selectedPlace.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {(selectedPlace.note || "").trim() ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-[#666666]">메모</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[#444444]">{selectedPlace.note}</p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-[#dddddd] bg-white text-sm text-[#666666]">
                  왼쪽 목록에서 장소를 선택해 주세요.
                </div>
              )}
            </article>
          </section>
        ) : typeFilter === "scrap" ? (
          <section className="grid h-full gap-[5px] lg:grid-cols-[0.42fr_0.58fr] lg:items-stretch">
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#444444]">
                  <span className="mr-1 text-lg">📰</span>스크랩 목록
                </h2>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                  style={primaryButtonStyle}
                  onClick={() => {
                    if (!editingId) setTypeInput("scrap");
                    setIsAddModalOpen(true);
                  }}
                >
                  + 추가
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-1.5">
                <input
                  className="min-w-0 rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="검색(제목/태그/요약/메모)"
                />
                <span className="whitespace-nowrap text-xs text-[#777777]">{filteredScraps.length}개</span>
              </div>
              <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                  style={{ backgroundColor: selectedScrapCategory === "all" ? currentAccent.soft : "#fff" }}
                  onClick={() => setSelectedScrapCategory("all")}
                >
                  전체
                </button>
                {scrapCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="shrink-0 rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                    style={{
                      backgroundColor:
                        selectedScrapCategory === category ? currentAccent.soft : "#fff",
                    }}
                    onClick={() => setSelectedScrapCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {filteredScraps.length === 0 ? (
                  <div className="rounded-md border border-[#dddddd] bg-white px-3 py-4 text-xs text-[#666666]">
                    스크랩이 없어요.
                  </div>
                ) : (
                  filteredScraps.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-2 text-left"
                      style={{
                        borderColor: selectedScrap?.id === item.id ? currentAccent.accent : "#dddddd",
                        backgroundColor: selectedScrap?.id === item.id ? currentAccent.soft : "#fff",
                      }}
                      onClick={() => setSelectedScrapId(item.id)}
                    >
                      <p className="truncate text-sm font-semibold text-[#444444]">{item.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#777777]">
                        {(item.scrapCategory || "미분류")} · {new Date(item.updatedAt).toLocaleDateString("ko-KR")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(item.tags || []).slice(0, 3).map((tag) => (
                          <span
                            key={`${item.id}-tag-${tag}`}
                            className="rounded-full border border-[#dddddd] bg-white px-2 py-0.5 text-[10px] text-[#666666]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </article>
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
              {selectedScrap ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="whitespace-normal break-words text-base font-semibold text-[#444444]">📄 {selectedScrap.title}</h3>
                      <p className="mt-0.5 text-xs text-[#777777]">
                        {(selectedScrap.scrapCategory || "미분류")} · {new Date(selectedScrap.updatedAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        className="rounded-md border border-transparent px-2 py-1 text-[11px] font-medium shadow-sm"
                        style={softButtonStyle}
                        onClick={() => startEdit(selectedScrap)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-transparent px-2 py-1 text-[11px] font-medium shadow-sm"
                        style={softButtonStyle}
                        onClick={() =>
                          setItems((prev) => prev.filter((target) => target.id !== selectedScrap.id))
                        }
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  {selectedScrap.link ? (
                    <a
                      href={/^https?:\/\//i.test(selectedScrap.link) ? selectedScrap.link : `https://${selectedScrap.link}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex w-fit rounded-md border border-[#dddddd] bg-white px-2 py-1 text-[11px] text-[#444444]"
                    >
                      원본 링크 열기
                    </a>
                  ) : null}
                  <div className="mt-2 rounded-md border border-[#dddddd] bg-white p-2">
                    {selectedScrap.link ? (
                      getYoutubeEmbedUrl(selectedScrap.link) ? (
                        <iframe
                          src={getYoutubeEmbedUrl(selectedScrap.link) ?? undefined}
                          title={selectedScrap.title}
                          className="h-[360px] w-full rounded-md border border-[#eeeeee]"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : isLikelyImageUrl(selectedScrap.link) ? (
                        <div className="h-[360px] w-full overflow-hidden rounded-md border border-[#eeeeee] bg-[#f6f6f6]">
                          <img
                            src={selectedScrap.link}
                            alt={selectedScrap.title}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <iframe
                          src={/^https?:\/\//i.test(selectedScrap.link) ? selectedScrap.link : `https://${selectedScrap.link}`}
                          title={selectedScrap.title}
                          className="h-[360px] w-full rounded-md border border-[#eeeeee]"
                          referrerPolicy="no-referrer"
                        />
                      )
                    ) : selectedScrap.images.length === 0 ? (
                      <div className="flex h-[360px] items-center justify-center rounded-md border border-[#eeeeee] text-sm text-[#777777]">
                        링크/이미지 미리보기가 없습니다.
                      </div>
                    ) : null}
                    {selectedScrap.images.length > 0 ? (
                      <div
                        className={`${
                          selectedScrap.link ? "mt-2" : ""
                        } grid gap-2 ${
                          selectedScrap.images.length === 1
                            ? "grid-cols-1"
                            : selectedScrap.images.length === 2
                              ? "grid-cols-2"
                              : "grid-cols-3"
                        }`}
                      >
                        {selectedScrap.images.map((url) => (
                          <button
                            type="button"
                            key={`${selectedScrap.id}-img-${url}`}
                            className="aspect-square w-full overflow-hidden rounded-md border border-[#dddddd] bg-[#f6f6f6]"
                            onClick={() => setZoomedImageUrl(url)}
                          >
                            <img
                              src={url}
                              alt={selectedScrap.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 min-h-0 h-[220px] overflow-y-auto rounded-md border border-[#dddddd] bg-white p-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {(selectedScrap.tags || []).map((tag) => (
                        <span
                          key={`${selectedScrap.id}-detail-tag-${tag}`}
                          className="rounded-full border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {(selectedScrap.note || "").trim() ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-[#666666]">요약/메모</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[#444444]">{selectedScrap.note}</p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-[#dddddd] bg-white text-sm text-[#666666]">
                  왼쪽 목록에서 스크랩을 선택해 주세요.
                </div>
              )}
            </article>
          </section>
        ) : (
        <section className="grid h-full gap-[5px] lg:grid-cols-[1.05fr_1.15fr] lg:items-stretch">
          <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#444444]">
                <span className="mr-1 text-lg">📅</span>독서 캘린더
              </h2>
              <button
                type="button"
                className="whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                style={primaryButtonStyle}
                onClick={() => {
                  if (!editingId) setTypeInput("book");
                  setIsAddModalOpen(true);
                }}
              >
                + 추가
              </button>
            </div>

            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-2xl font-bold text-[#444444]">
                  <span className="mr-1">📚</span>
                  {monthBookCount}권
                </p>
                <div className="ml-auto flex items-center gap-1 text-xs md:ml-0">
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-[#444444]"
                    onClick={() => {
                      setBookMonth((prev) => shiftMonth(prev, -1));
                      setOpenBookCellDate(null);
                    }}
                  >
                    ◀
                  </button>
                  <span className="px-1 font-semibold">{formatMonthLabel(bookMonth)}</span>
                  <button
                    type="button"
                    className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-[#444444]"
                    onClick={() => {
                      setBookMonth((prev) => shiftMonth(prev, 1));
                      setOpenBookCellDate(null);
                    }}
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 md:justify-end">
                  {([
                    ["all", "전체"],
                    ["reading", "읽는 중"],
                    ["paused", "중단"],
                    ["done", "완독"],
                  ] as [BookStatusFilter, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className="rounded-full border border-[#dddddd] px-2 py-1 text-[11px] text-[#444444]"
                      style={{ backgroundColor: bookStatusFilter === key ? currentAccent.soft : "#fff" }}
                      onClick={() => {
                        setBookStatusFilter(key);
                        setOpenBookCellDate(null);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
            </div>

            <div className="mt-3 md:hidden">
              {mobileBookCalendarRows.length === 0 ? (
                <div className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-xs text-[#666666]">
                  이번 달 독서 기록이 없습니다.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {mobileBookCalendarRows.map((row) => (
                    <li
                      key={`mobile-book-row-${row.date}`}
                      className="rounded-md border border-[#dddddd] bg-white px-2 py-1.5"
                    >
                      <p className="text-xs font-semibold text-[#444444]">
                        {row.day}일({row.weekday}) · {row.books.length}권
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#666666]">
                        {row.books.map((book) => book.title).join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 hidden overflow-hidden md:block" onClick={() => setOpenBookCellDate(null)}>
              <div className="w-full">
                <div className="grid grid-cols-7 gap-1">
                  {weekLabels.map((day) => (
                    <div
                      key={day}
                      className="rounded-md border border-[#eeeeee] bg-white px-2 py-1 text-center text-xs text-[#777777]"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1.5">
                  {calendarCells.map((cell, idx) => (
                    <div
                      key={`${cell.date ?? "empty"}-${idx}`}
                      className="relative min-h-[56px] rounded-md border border-[#eeeeee] bg-white p-1 md:h-[78px] md:min-h-0"
                    >
                      {cell.day ? (
                        <>
                          <p className="text-[10px] text-[#888888]">{cell.day}</p>
                          {cell.books.length > 0 ? (
                            <button
                              type="button"
                              className="absolute bottom-1 left-1 right-1 top-4 overflow-hidden rounded-md border border-[#dddddd] bg-[#fafafa]"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!cell.date) return;
                                setOpenBookCellDate((prev) =>
                                  prev === cell.date ? null : cell.date,
                                );
                              }}
                              title={`${cell.books.length}권`}
                            >
                              {cell.books[0]?.coverImage ? (
                                <img
                                  src={cell.books[0].coverImage}
                                  alt={cell.books[0].title}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : null}
                              <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-black/5" />
                              <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 py-0.5 text-[10px] font-semibold text-white">
                                {cell.books.length}권
                              </span>
                            </button>
                          ) : null}

                          {openBookCellDate === cell.date && cell.books.length > 0 ? (
                            <div
                              className="absolute left-1 top-14 z-50 w-40 rounded-md border border-[#dddddd] bg-white p-2 text-xs shadow-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="mb-1 font-semibold text-[#444444]">
                                {cell.day}일 · {cell.books.length}권
                              </p>
                              <ul className="space-y-1">
                                {cell.books.map((book) => (
                                  <li key={`${cell.date}-popup-${book.id}`} className="truncate text-[#444444]">
                                    • {book.title}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 rounded-md border border-[#dddddd] bg-white px-2 py-1 text-[11px] text-[#444444]">
              <div className="flex flex-wrap items-center md:hidden">
                <span>
                  <span className="font-semibold">읽는 중</span> {monthlyReadingCount}권
                </span>
                <span className="mx-2 text-[#bbbbbb]">|</span>
                <span>
                  <span className="font-semibold">중단</span> {monthlyPausedCount}권
                </span>
                <span className="mx-2 text-[#bbbbbb]">|</span>
                <span>
                  <span className="font-semibold">완독</span> {monthlyDoneCount}권
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center md:hidden">
                <span>
                  <span className="font-semibold">많이 읽은 장르</span> {monthlyTopGenre}
                </span>
                <span className="mx-2 text-[#bbbbbb]">|</span>
                <span>
                  <span className="font-semibold">평균 진행률</span> {monthlyAvgProgress}%
                </span>
              </div>
              <div className="hidden flex-wrap items-center md:flex">
                <span>
                  <span className="font-semibold">읽는 중</span> {monthlyReadingCount}권
                </span>
                <span className="mx-2 text-[#bbbbbb]">|</span>
                <span>
                  <span className="font-semibold">중단</span> {monthlyPausedCount}권
                </span>
                <span className="mx-2 text-[#bbbbbb]">|</span>
                <span>
                  <span className="font-semibold">완독</span> {monthlyDoneCount}권
                </span>
                <span className="mx-2 text-[#bbbbbb]">|</span>
                <span>
                  <span className="font-semibold">많이 읽은 장르</span> {monthlyTopGenre}
                </span>
                <span className="mx-2 text-[#bbbbbb]">|</span>
                <span>
                  <span className="font-semibold">평균 진행률</span> {monthlyAvgProgress}%
                </span>
              </div>
            </div>
            <div className="mt-1 rounded-md border border-[#dddddd] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[#666666]">
                  ✨ <span className="font-semibold">오늘의 문장</span>
                </p>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                  onClick={() => setQuoteSeed(Date.now())}
                >
                  바꾸기
                </button>
              </div>
              <p className="mt-2 min-h-[44px] whitespace-pre-line text-xs leading-5 text-[#444444]">
                “{randomQuote.text}”
              </p>
              <p className="mt-1 text-[11px] text-[#777777]">— {randomQuote.source}</p>
            </div>
          </article>
          <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#eeeeee] bg-white/80 p-4">
            <div className="grid gap-2 md:grid-cols-[1fr_170px_180px]">
            <input
              className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="검색(제목/작가/장르/스크랩/태그/메모)"
            />
            <select
              className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              disabled={typeFilter !== "book"}
            >
              <option value="all">장르 전체</option>
              {bookGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="updated_desc">최신 수정순</option>
              <option value="created_desc">최신 추가순</option>
              <option value="favorite_first">즐겨찾기 우선</option>
            </select>
            </div>

            <div className="mt-3 min-h-0 w-full flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="rounded-md border border-[#dddddd] bg-white px-3 py-4 text-sm text-[#666666]">
                조건에 맞는 항목이 없어요.
              </div>
            ) : (
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => {
                const percent = progressPercent(item);
                const bookStatus = getBookStatus(item);
                const lastReadDate = item.type === "book" ? getReadingLogDates(item).slice(-1)[0] : "";
                return (
                  <article
                    key={item.id}
                    className="w-full min-w-0 overflow-hidden rounded-md border border-[#dddddd] bg-white px-3 py-2"
                  >
                    <div className="flex w-full flex-wrap items-center justify-start gap-1 sm:justify-end">
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                          onClick={() =>
                            setItems((prev) =>
                              prev.map((target) =>
                                target.id === item.id
                                  ? {
                                      ...target,
                                      favorite: !target.favorite,
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : target,
                              ),
                            )
                          }
                        >
                          {item.favorite ? "⭐" : "☆"}
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-transparent px-2 py-0.5 text-[11px] font-medium shadow-sm"
                          style={softButtonStyle}
                          onClick={() => startEdit(item)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-transparent px-2 py-0.5 text-[11px] font-medium shadow-sm"
                          style={softButtonStyle}
                          onClick={() =>
                            setItems((prev) => prev.filter((target) => target.id !== item.id))
                          }
                        >
                          삭제
                        </button>
                    </div>
                    <div className="mt-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-[#444444]">
                        <span className="mr-1">{typeMeta[item.type].emoji}</span>
                        {item.title}
                      </p>
                      {item.type === "book" ? (
                        <p className="mt-0.5 text-xs text-[#666666]">
                          {item.author || "작가 미입력"} · {item.genre || "장르 미입력"} · 상태{" "}
                          {bookStatus === "done" ? "완독" : bookStatus === "paused" ? "중단" : "읽는 중"}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-[#777777]">
                        {new Date(item.updatedAt).toLocaleString("ko-KR")}
                      </p>
                      {item.type === "book" ? (
                        <p className="mt-0.5 text-[11px] text-[#777777]">
                          최근 읽은 날: {lastReadDate || "-"}
                        </p>
                      ) : null}
                    </div>

                    {item.type === "book" ? (
                      <div className="mt-2 flex items-start gap-2">
                        <div className="h-20 w-[56px] shrink-0 overflow-hidden rounded-md border border-[#dddddd] bg-[#f6f6f6]">
                          {item.coverImage ? (
                            <img
                              src={item.coverImage}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-[#999999]">책 표지</div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                          <div className="text-[11px] text-[#666666]">
                          </div>
                          <div className="flex shrink-0 flex-col items-center">
                            <div
                              className="relative h-14 w-14 rounded-full"
                              style={{
                                background: `conic-gradient(${currentAccent.accent} ${percent}%, #eeeeee ${percent}% 100%)`,
                              }}
                              aria-label={`독서 진행률 ${percent}%`}
                              title={`독서 진행률 ${percent}%`}
                            >
                              <div
                                className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#444444]"
                                style={{ border: "1px solid #dddddd" }}
                              >
                                {percent}%
                              </div>
                            </div>
                            <p className="mt-1 text-[11px] text-[#666666]">
                              {item.readPages ?? 0}/{item.totalPages ?? 0}p
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {item.note ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-[#444444]">{item.note}</p>
                        ) : null}
                        {item.link ? (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block truncate text-xs text-blue-700 underline"
                          >
                            {item.link}
                          </a>
                        ) : null}
                        {item.images.length > 0 ? (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {item.images.map((url) => (
                              <img
                                key={url}
                                src={url}
                                alt={item.title}
                                className="h-20 w-full rounded-md border border-[#dddddd] object-cover"
                                loading="lazy"
                              />
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}

                    {item.type === "book" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                          onClick={() => markReadToday(item.id)}
                        >
                          오늘 읽음
                        </button>
                        {bookStatus !== "paused" ? (
                          <button
                            type="button"
                            className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                            onClick={() => setBookRunStatus(item.id, "paused")}
                          >
                            중단
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                            onClick={() => setBookRunStatus(item.id, "reading")}
                          >
                            재개
                          </button>
                        )}
                        {bookStatus !== "done" ? (
                          <button
                            type="button"
                            className="rounded-md border border-[#dddddd] bg-white px-2 py-0.5 text-[11px] text-[#444444]"
                            onClick={() => setBookRunStatus(item.id, "done")}
                          >
                            완독
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {item.tags.map((tag) => (
                        <span
                          key={`${item.id}-${tag}`}
                          className="rounded-full border border-[#dddddd] bg-white px-2 py-0.5 text-[10px] text-[#444444]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })
              }
              </div>
            )}
            </div>
          </article>
        </section>
        )}
        </div>

        {zoomedImageUrl ? (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setZoomedImageUrl(null)}
          >
            <div
              className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg border border-[#eeeeee] bg-white p-2 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={zoomedImageUrl}
                alt="확대 이미지"
                className="max-h-[86vh] max-w-[86vw] rounded-md object-contain"
              />
            </div>
          </div>
        ) : null}

        {isAddModalOpen ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-3">
            <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#eeeeee] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#444444]">
                  <span className="mr-1 text-lg">✍️</span>
                  {editingId ? `${typeMeta[typeInput].label} 수정` : `${typeMeta[typeInput].label} 추가`}
                </h3>
                <button
                  type="button"
                  className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                >
                  닫기
                </button>
              </div>
              <form className="mt-2 space-y-2" onSubmit={upsertItem}>
                <input
                  className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={typeInput === "book" ? "책 제목" : "제목"}
                />

                {typeInput === "book" ? (
                  <>
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={authorInput}
                      onChange={(e) => setAuthorInput(e.target.value)}
                      placeholder="작가 이름"
                    />
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={genreInput}
                      onChange={(e) => setGenreInput(e.target.value)}
                      placeholder="장르 (예: 자기계발, 소설)"
                    />
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={bookCoverInput}
                      onChange={(e) => setBookCoverInput(e.target.value)}
                      placeholder="책 표지 이미지 URL (1개)"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
                        value={startDateInput}
                        onChange={(e) => setStartDateInput(e.target.value)}
                      />
                      <input
                        type="date"
                        className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
                        value={endDateInput}
                        onChange={(e) => setEndDateInput(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
                        value={totalPagesInput}
                        onChange={(e) => setTotalPagesInput(e.target.value)}
                        placeholder="전체 페이지"
                      />
                      <input
                        type="number"
                        min={0}
                        className="rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
                        value={readPagesInput}
                        onChange={(e) => setReadPagesInput(e.target.value)}
                        placeholder="읽은 페이지"
                      />
                    </div>
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="태그(쉼표로 구분)"
                    />
                    <textarea
                      className="h-20 w-full resize-none rounded-md border border-[#dddddd] bg-white px-3 py-2 text-xs outline-none focus:border-accent"
                      value={bookScrapInput}
                      onChange={(e) => setBookScrapInput(e.target.value)}
                      placeholder="문장 스크랩 (한 줄에 하나씩)"
                    />
                    <textarea
                      className="h-16 w-full resize-none rounded-md border border-[#dddddd] bg-white px-3 py-2 text-xs outline-none focus:border-accent"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="코멘트"
                    />
                  </>
                ) : (
                  <>
                    {typeInput === "scrap" ? (
                      <input
                        className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                        value={scrapCategoryInput}
                        onChange={(e) => setScrapCategoryInput(e.target.value)}
                        placeholder="스크랩 카테고리 (예: 유튜브, 기사, SNS)"
                      />
                    ) : null}
                    {typeInput === "place" ? (
                      <>
                        <select
                          className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
                          value={placeStatusInput}
                          onChange={(e) => setPlaceStatusInput(e.target.value as PlaceStatus)}
                        >
                          <option value="wishlist">🔖 방문전</option>
                          <option value="visited">♥️ 방문</option>
                          <option value="pass">❌ 방문</option>
                        </select>
                        <input
                          className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                          value={placeCategoryInput}
                          onChange={(e) => setPlaceCategoryInput(e.target.value)}
                          placeholder="장소 카테고리 (예: 카페, 맛집, 여행지)"
                        />
                        <input
                          className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                          value={placeAddressInput}
                          onChange={(e) => setPlaceAddressInput(e.target.value)}
                          placeholder="장소 주소 (예: 부산 해운대구 ...)"
                        />
                      </>
                    ) : null}
                    {typeInput === "wish" ? (
                      <>
                        <select
                          className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs"
                          value={wishStatusInput}
                          onChange={(e) => setWishStatusInput(e.target.value as WishStatus)}
                        >
                          <option value="wishlist">💫 위시</option>
                          <option value="planned">🛒 구매 예정</option>
                          <option value="bought">✅ 구매 완료</option>
                        </select>
                        <input
                          className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                          value={wishCategoryInput}
                          onChange={(e) => setWishCategoryInput(e.target.value)}
                          placeholder="위시 카테고리 (예: 가전, 패션, 홈)"
                        />
                        <input
                          className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                          value={wishPriceInput}
                          onChange={(e) => setWishPriceInput(e.target.value)}
                          placeholder="예산/가격 (예: 32만원)"
                        />
                      </>
                    ) : null}
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder="링크(URL)"
                    />
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="태그(쉼표로 구분)"
                    />
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={image1Input}
                      onChange={(e) => setImage1Input(e.target.value)}
                      placeholder="이미지 URL 1"
                    />
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={image2Input}
                      onChange={(e) => setImage2Input(e.target.value)}
                      placeholder="이미지 URL 2"
                    />
                    <input
                      className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
                      value={image3Input}
                      onChange={(e) => setImage3Input(e.target.value)}
                      placeholder="이미지 URL 3"
                    />
                    <textarea
                      className="h-20 w-full resize-none rounded-md border border-[#dddddd] bg-white px-3 py-2 text-xs outline-none focus:border-accent"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="메모"
                    />
                  </>
                )}
                <div className="flex items-center justify-end gap-1">
                  {editingId ? (
                    <button
                      type="button"
                      className="rounded-md border border-[#dddddd] bg-white px-2 py-1 text-xs text-[#444444]"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        resetForm();
                      }}
                    >
                      취소
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="rounded-md border border-transparent px-2 py-1 text-xs font-medium shadow-sm"
                    style={primaryButtonStyle}
                  >
                    {editingId ? "수정 저장" : "추가"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

const Page = dynamic(() => Promise.resolve(ArchivePageInner), {
  ssr: false,
});

export default Page;
