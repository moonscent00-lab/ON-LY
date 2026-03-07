"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

const SESSION_KEY = "diary-os.session.v1";
const PREFIX = "diary-os.";
const SYNC_META_KEY = "diary-os.sync-meta.v1";

type KeyMeta = {
  updatedAt: string;
  hash: string;
};

type SyncMetaMap = Record<string, KeyMeta>;

type SyncRow = {
  payload?: Record<string, string>;
  meta?: SyncMetaMap;
  updated_at?: string;
};

type MergeResult = {
  payload: Record<string, string>;
  meta: SyncMetaMap;
  localWins: number;
  cloudWins: number;
};

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function getSessionEmail() {
  if (typeof window === "undefined") return "";
  const parsed = safeJson<{ email?: string }>(
    localStorage.getItem(SESSION_KEY),
    {},
  );
  return parsed.email ?? "";
}

function isSyncTargetKey(key: string) {
  if (!key.startsWith(PREFIX)) return false;
  if (key === SESSION_KEY) return false;
  if (key === SYNC_META_KEY) return false;
  return true;
}

function getLocalPayload() {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !isSyncTargetKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

function getLocalMeta() {
  return safeJson<SyncMetaMap>(localStorage.getItem(SYNC_META_KEY), {});
}

function setLocalMeta(meta: SyncMetaMap) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

function dateToMs(value?: string) {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeLocalState() {
  const payload = getLocalPayload();
  const prevMeta = getLocalMeta();
  const nextMeta: SyncMetaMap = {};
  const now = new Date().toISOString();

  Object.entries(payload).forEach(([key, value]) => {
    const hash = hashString(value);
    const prev = prevMeta[key];
    if (!prev || prev.hash !== hash) {
      nextMeta[key] = { hash, updatedAt: now };
      return;
    }
    nextMeta[key] = prev;
  });

  setLocalMeta(nextMeta);
  return { payload, meta: nextMeta };
}

function mergeByLatest(
  localPayload: Record<string, string>,
  localMeta: SyncMetaMap,
  cloudPayload: Record<string, string>,
  cloudMeta: SyncMetaMap,
): MergeResult {
  const mergedPayload: Record<string, string> = {};
  const mergedMeta: SyncMetaMap = {};
  const allKeys = new Set([
    ...Object.keys(localPayload),
    ...Object.keys(cloudPayload),
  ]);
  let localWins = 0;
  let cloudWins = 0;

  allKeys.forEach((key) => {
    const localValue = localPayload[key];
    const cloudValue = cloudPayload[key];

    if (localValue === undefined && cloudValue !== undefined) {
      mergedPayload[key] = cloudValue;
      mergedMeta[key] = cloudMeta[key] ?? {
        updatedAt: new Date().toISOString(),
        hash: hashString(cloudValue),
      };
      cloudWins += 1;
      return;
    }

    if (cloudValue === undefined && localValue !== undefined) {
      mergedPayload[key] = localValue;
      mergedMeta[key] = localMeta[key] ?? {
        updatedAt: new Date().toISOString(),
        hash: hashString(localValue),
      };
      localWins += 1;
      return;
    }

    if (localValue === undefined || cloudValue === undefined) return;

    if (localValue === cloudValue) {
      const localAt = dateToMs(localMeta[key]?.updatedAt);
      const cloudAt = dateToMs(cloudMeta[key]?.updatedAt);
      const winner = cloudAt > localAt ? cloudMeta[key] : localMeta[key];
      mergedPayload[key] = localValue;
      mergedMeta[key] = winner ?? {
        updatedAt: new Date().toISOString(),
        hash: hashString(localValue),
      };
      return;
    }

    const localAt = dateToMs(localMeta[key]?.updatedAt);
    const cloudAt = dateToMs(cloudMeta[key]?.updatedAt);
    const chooseCloud = cloudAt > localAt;

    if (chooseCloud) {
      mergedPayload[key] = cloudValue;
      mergedMeta[key] = cloudMeta[key] ?? {
        updatedAt: new Date().toISOString(),
        hash: hashString(cloudValue),
      };
      cloudWins += 1;
      return;
    }

    mergedPayload[key] = localValue;
    mergedMeta[key] = localMeta[key] ?? {
      updatedAt: new Date().toISOString(),
      hash: hashString(localValue),
    };
    localWins += 1;
  });

  return { payload: mergedPayload, meta: mergedMeta, localWins, cloudWins };
}

function applyPayloadToLocal(payload: Record<string, string>) {
  const currentKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !isSyncTargetKey(key)) continue;
    currentKeys.push(key);
  }
  currentKeys.forEach((key) => {
    if (!(key in payload)) localStorage.removeItem(key);
  });
  Object.entries(payload).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
}

function SyncPageInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [lastCloudUpdatedAt, setLastCloudUpdatedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const hasAutoSyncedRef = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const canUseCloud = Boolean(supabaseUrl && supabaseAnon);

  useEffect(() => {
    setEmail(getSessionEmail());
    setLocalCount(Object.keys(getLocalPayload()).length);
  }, []);

  const fetchCloudRow = useCallback(async (userEmail: string) => {
    const query = `${supabaseUrl}/rest/v1/diary_sync?user_email=eq.${encodeURIComponent(
      userEmail,
    )}&select=payload,meta,updated_at&limit=1`;
    const res = await fetch(query, {
      headers: {
        apikey: supabaseAnon,
        Authorization: `Bearer ${supabaseAnon}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `cloud read failed: ${res.status}`);
    }
    const rows = (await res.json()) as SyncRow[];
    return rows[0] ?? null;
  }, [supabaseUrl, supabaseAnon]);

  const saveCloudRow = useCallback(async (userEmail: string, row: SyncRow) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/diary_sync?on_conflict=user_email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnon,
        Authorization: `Bearer ${supabaseAnon}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([
        {
          user_email: userEmail,
          payload: row.payload ?? {},
          meta: row.meta ?? {},
          updated_at: row.updated_at ?? new Date().toISOString(),
        },
      ]),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `cloud write failed: ${res.status}`);
    }
  }, [supabaseUrl, supabaseAnon]);

  const smartSync = useCallback(async () => {
    const userEmail = email.trim();
    if (!userEmail) {
      setStatus("이메일이 필요해요.");
      return;
    }
    if (!canUseCloud) {
      setStatus(
        "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 필요해요.",
      );
      return;
    }
    setBusy(true);
    try {
      const cloudRow = await fetchCloudRow(userEmail);
      const local = normalizeLocalState();

      if (!cloudRow?.payload) {
        const now = new Date().toISOString();
        await saveCloudRow(userEmail, {
          payload: local.payload,
          meta: local.meta,
          updated_at: now,
        });
        setLocalCount(Object.keys(local.payload).length);
        setLastCloudUpdatedAt(now);
        setStatus(
          `초기 동기화 완료: 로컬 ${Object.keys(local.payload).length}개를 클라우드에 저장했어요.`,
        );
        return;
      }

      const cloudPayload = cloudRow.payload ?? {};
      const cloudMeta = cloudRow.meta ?? {};
      const merged = mergeByLatest(
        local.payload,
        local.meta,
        cloudPayload,
        cloudMeta,
      );

      applyPayloadToLocal(merged.payload);
      setLocalMeta(merged.meta);
      setLocalCount(Object.keys(merged.payload).length);

      const now = new Date().toISOString();
      await saveCloudRow(userEmail, {
        payload: merged.payload,
        meta: merged.meta,
        updated_at: now,
      });

      setLastCloudUpdatedAt(now);
      setStatus(
        `스마트 동기화 완료: 총 ${Object.keys(merged.payload).length}개, 로컬 반영 ${merged.localWins}개 / 클라우드 반영 ${merged.cloudWins}개 (최근 수정 우선)`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "동기화 실패");
    } finally {
      setBusy(false);
    }
  }, [email, canUseCloud, fetchCloudRow, saveCloudRow]);

  async function pushToCloudOnly() {
    const userEmail = email.trim();
    if (!userEmail) {
      setStatus("이메일이 필요해요.");
      return;
    }
    if (!canUseCloud) {
      setStatus(
        "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 필요해요.",
      );
      return;
    }
    setBusy(true);
    try {
      const local = normalizeLocalState();
      setLocalCount(Object.keys(local.payload).length);
      const now = new Date().toISOString();
      await saveCloudRow(userEmail, {
        payload: local.payload,
        meta: local.meta,
        updated_at: now,
      });
      setLastCloudUpdatedAt(now);
      setStatus(`클라우드 저장 완료: ${Object.keys(local.payload).length}개`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "클라우드 저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function pullFromCloudOnly() {
    const userEmail = email.trim();
    if (!userEmail) {
      setStatus("이메일이 필요해요.");
      return;
    }
    if (!canUseCloud) {
      setStatus(
        "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 필요해요.",
      );
      return;
    }
    setBusy(true);
    try {
      const cloudRow = await fetchCloudRow(userEmail);
      if (!cloudRow?.payload) {
        setStatus("클라우드에 저장된 데이터가 없어요.");
        return;
      }
      applyPayloadToLocal(cloudRow.payload);
      setLocalMeta(cloudRow.meta ?? {});
      setLocalCount(Object.keys(cloudRow.payload).length);
      if (cloudRow.updated_at) setLastCloudUpdatedAt(cloudRow.updated_at);
      setStatus(
        `클라우드 불러오기 완료: ${Object.keys(cloudRow.payload).length}개 적용 (새로고침하면 전체 반영돼요).`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "클라우드 불러오기 실패");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (hasAutoSyncedRef.current) return;
    if (searchParams.get("auto") !== "1") return;
    if (!email.trim()) return;
    hasAutoSyncedRef.current = true;
    void smartSync();
  }, [email, searchParams, smartSync]);

  return (
    <main className="mx-auto mt-4 w-full max-w-3xl rounded-lg border border-[#eeeeee] bg-white/80 p-4 text-[#444444]">
      <h1 className="text-xl font-semibold">🔄 동기화 센터</h1>
      <p className="mt-2 text-sm">
        같은 이메일로 기기 간 동기화할 때, 키 단위로 최근 수정값이 우선 반영됩니다.
      </p>

      <div className="mt-3 rounded-md border border-[#dddddd] bg-white p-3 text-sm">
        <p>로컬 데이터 키 수: {localCount}</p>
        <p className="mt-1">
          클라우드 마지막 업데이트:{" "}
          {lastCloudUpdatedAt
            ? new Date(lastCloudUpdatedAt).toLocaleString("ko-KR")
            : "-"}
        </p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="동기화용 이메일 (로그인과 동일)"
          className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={smartSync}
          disabled={busy}
          className="rounded-md border border-transparent bg-[#8fb6e8] px-3 py-2 text-sm font-medium text-[#444444] shadow-sm"
        >
          스마트 동기화
        </button>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <button
          type="button"
          onClick={pushToCloudOnly}
          disabled={busy}
          className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm"
        >
          클라우드 저장만
        </button>
        <button
          type="button"
          onClick={pullFromCloudOnly}
          disabled={busy}
          className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm"
        >
          클라우드 불러오기만
        </button>
      </div>

      {status ? <p className="mt-3 text-sm">{status}</p> : null}

      <div className="mt-4 rounded-md border border-[#dddddd] bg-white p-3 text-xs">
        <p className="font-semibold">Supabase 준비</p>
        <p className="mt-1">1) 테이블 `diary_sync` 생성</p>
        <p>
          2) 컬럼: `user_email`(text, PK), `payload`(jsonb), `meta`(jsonb), `updated_at`(timestamptz)
        </p>
        <p>
          3) `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 입력
        </p>
      </div>
    </main>
  );
}

export default function SyncPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto mt-4 w-full max-w-3xl rounded-lg border border-[#eeeeee] bg-white/80 p-4 text-[#444444]">
          <h1 className="text-xl font-semibold">🔄 동기화 센터</h1>
          <p className="mt-2 text-sm">동기화 화면을 불러오는 중...</p>
        </main>
      }
    >
      <SyncPageInner />
    </Suspense>
  );
}
