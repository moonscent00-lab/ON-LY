"use client";

export const SESSION_KEY = "diary-os.session.v1";
const PREFIX = "diary-os.";
const SYNC_META_KEY = "diary-os.sync-meta.v1";
export const SYNC_EMAIL_KEY = "diary-os.sync-email.v1";
const SYNC_BACKUP_KEY = "diary-os.sync-backup.latest.v1";

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

type SmartSyncOptions = {
  userEmail: string;
  supabaseUrl: string;
  supabaseAnon: string;
};

type SmartSyncResult = {
  localCount: number;
  cloudUpdatedAt: string;
  localWins: number;
  cloudWins: number;
  initialized: boolean;
};

type BootstrapResult = {
  action: "none" | "pulled" | "pushed";
  localCount: number;
  cloudUpdatedAt: string;
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

export function getSessionEmail() {
  if (typeof window === "undefined") return "";
  const parsed = safeJson<{ email?: string }>(localStorage.getItem(SESSION_KEY), {});
  return (parsed.email ?? "").trim();
}

export function getSavedSyncEmail() {
  if (typeof window === "undefined") return "";
  return (localStorage.getItem(SYNC_EMAIL_KEY) ?? "").trim();
}

export function setSavedSyncEmail(email: string) {
  if (typeof window === "undefined") return;
  const next = email.trim();
  if (!next) {
    localStorage.removeItem(SYNC_EMAIL_KEY);
    return;
  }
  localStorage.setItem(SYNC_EMAIL_KEY, next);
}

export function getPreferredSyncEmail() {
  return getSessionEmail() || getSavedSyncEmail();
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

function isEmptyLikeValue(value: string) {
  const raw = value.trim();
  if (!raw || raw === "null" || raw === "undefined" || raw === '""' || raw === "[]" || raw === "{}") {
    return true;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string") return parsed.trim().length === 0;
    if (Array.isArray(parsed)) return parsed.length === 0;
    if (parsed && typeof parsed === "object") return Object.keys(parsed).length === 0;
  } catch {
    return false;
  }
  return false;
}

function saveSyncBackup(payload: Record<string, string>, meta: SyncMetaMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SYNC_BACKUP_KEY,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      payload,
      meta,
    }),
  );
}

function payloadMeaningfulCount(payload: Record<string, string>) {
  let count = 0;
  Object.values(payload).forEach((value) => {
    if (!isEmptyLikeValue(value)) count += 1;
  });
  return count;
}

function payloadSignature(payload: Record<string, string>) {
  const keys = Object.keys(payload).sort();
  const pairs = keys.map((key) => `${key}:${hashString(payload[key] ?? "")}`);
  return hashString(pairs.join("|"));
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
  const allKeys = new Set([...Object.keys(localPayload), ...Object.keys(cloudPayload)]);
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
      mergedPayload[key] = localValue;
      mergedMeta[key] =
        cloudAt > localAt ? cloudMeta[key] ?? localMeta[key] : localMeta[key] ?? cloudMeta[key];
      if (!mergedMeta[key]) {
        mergedMeta[key] = { updatedAt: new Date().toISOString(), hash: hashString(localValue) };
      }
      return;
    }

    const localEmpty = isEmptyLikeValue(localValue);
    const cloudEmpty = isEmptyLikeValue(cloudValue);
    if (localEmpty !== cloudEmpty) {
      if (cloudEmpty) {
        mergedPayload[key] = localValue;
        mergedMeta[key] = localMeta[key] ?? {
          updatedAt: new Date().toISOString(),
          hash: hashString(localValue),
        };
        localWins += 1;
      } else {
        mergedPayload[key] = cloudValue;
        mergedMeta[key] = cloudMeta[key] ?? {
          updatedAt: new Date().toISOString(),
          hash: hashString(cloudValue),
        };
        cloudWins += 1;
      }
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

async function fetchCloudRow(userEmail: string, supabaseUrl: string, supabaseAnon: string) {
  const query = `${supabaseUrl}/rest/v1/diary_sync?user_email=eq.${encodeURIComponent(
    userEmail,
  )}&select=payload,meta,updated_at&limit=1`;
  const res = await fetch(query, {
    headers: { apikey: supabaseAnon, Authorization: `Bearer ${supabaseAnon}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `cloud read failed: ${res.status}`);
  }
  const rows = (await res.json()) as SyncRow[];
  return rows[0] ?? null;
}

async function saveCloudRow(
  userEmail: string,
  row: SyncRow,
  supabaseUrl: string,
  supabaseAnon: string,
) {
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
}

export async function runSmartSync({
  userEmail,
  supabaseUrl,
  supabaseAnon,
}: SmartSyncOptions): Promise<SmartSyncResult> {
  const email = userEmail.trim();
  if (!email) throw new Error("이메일이 필요해요.");
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("Supabase 환경변수 설정이 필요해요.");
  }

  setSavedSyncEmail(email);
  const cloudRow = await fetchCloudRow(email, supabaseUrl, supabaseAnon);
  const local = normalizeLocalState();
  const now = new Date().toISOString();

  if (!cloudRow?.payload) {
    saveSyncBackup(local.payload, local.meta);
    await saveCloudRow(
      email,
      { payload: local.payload, meta: local.meta, updated_at: now },
      supabaseUrl,
      supabaseAnon,
    );
    return {
      localCount: Object.keys(local.payload).length,
      cloudUpdatedAt: now,
      localWins: Object.keys(local.payload).length,
      cloudWins: 0,
      initialized: true,
    };
  }

  const merged = mergeByLatest(local.payload, local.meta, cloudRow.payload ?? {}, cloudRow.meta ?? {});
  saveSyncBackup(local.payload, local.meta);
  applyPayloadToLocal(merged.payload);
  setLocalMeta(merged.meta);
  await saveCloudRow(
    email,
    { payload: merged.payload, meta: merged.meta, updated_at: now },
    supabaseUrl,
    supabaseAnon,
  );
  return {
    localCount: Object.keys(merged.payload).length,
    cloudUpdatedAt: now,
    localWins: merged.localWins,
    cloudWins: merged.cloudWins,
    initialized: false,
  };
}

export async function bootstrapCloudState({
  userEmail,
  supabaseUrl,
  supabaseAnon,
}: SmartSyncOptions): Promise<BootstrapResult> {
  const email = userEmail.trim();
  if (!email) throw new Error("이메일이 필요해요.");
  if (!supabaseUrl || !supabaseAnon) throw new Error("Supabase 환경변수 설정이 필요해요.");

  setSavedSyncEmail(email);
  const local = normalizeLocalState();
  const cloudRow = await fetchCloudRow(email, supabaseUrl, supabaseAnon);
  const now = new Date().toISOString();

  if (!cloudRow?.payload) {
    saveSyncBackup(local.payload, local.meta);
    await saveCloudRow(
      email,
      { payload: local.payload, meta: local.meta, updated_at: now },
      supabaseUrl,
      supabaseAnon,
    );
    return { action: "pushed", localCount: Object.keys(local.payload).length, cloudUpdatedAt: now };
  }

  const cloudPayload = cloudRow.payload ?? {};
  const cloudMeta = cloudRow.meta ?? {};
  const localMeaningful = payloadMeaningfulCount(local.payload);
  const cloudMeaningful = payloadMeaningfulCount(cloudPayload);

  if (cloudMeaningful === 0 && localMeaningful > 0) {
    saveSyncBackup(local.payload, local.meta);
    await saveCloudRow(
      email,
      { payload: local.payload, meta: local.meta, updated_at: now },
      supabaseUrl,
      supabaseAnon,
    );
    return { action: "pushed", localCount: Object.keys(local.payload).length, cloudUpdatedAt: now };
  }

  const localSig = payloadSignature(local.payload);
  const cloudSig = payloadSignature(cloudPayload);
  if (localSig === cloudSig) {
    return {
      action: "none",
      localCount: Object.keys(local.payload).length,
      cloudUpdatedAt: cloudRow.updated_at ?? now,
    };
  }

  saveSyncBackup(local.payload, local.meta);
  applyPayloadToLocal(cloudPayload);
  setLocalMeta(cloudMeta);
  return {
    action: "pulled",
    localCount: Object.keys(cloudPayload).length,
    cloudUpdatedAt: cloudRow.updated_at ?? now,
  };
}

export function getLocalPayloadCount() {
  if (typeof window === "undefined") return 0;
  return Object.keys(getLocalPayload()).length;
}
