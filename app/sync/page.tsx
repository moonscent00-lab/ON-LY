"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  getLocalPayloadCount,
  getPreferredSyncEmail,
  runSmartSync,
  setSavedSyncEmail,
} from "@/lib/cloud-sync";

function SyncPageInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [lastCloudUpdatedAt, setLastCloudUpdatedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const hasAutoSyncedRef = useRef(false);
  const autoLoopRef = useRef<number | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const canUseCloud = Boolean(supabaseUrl && supabaseAnon);

  useEffect(() => {
    const initialEmail = getPreferredSyncEmail();
    setEmail(initialEmail);
    setLocalCount(getLocalPayloadCount());
  }, []);

  const smartSync = useCallback(
    async (silent = false) => {
      const userEmail = email.trim();
      if (!userEmail) {
        if (!silent) setStatus("이메일이 필요해요.");
        return;
      }
      if (!canUseCloud) {
        if (!silent) {
          setStatus(
            "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 필요해요.",
          );
        }
        return;
      }

      setBusy(true);
      try {
        const result = await runSmartSync({
          userEmail,
          supabaseUrl,
          supabaseAnon,
        });
        setSavedSyncEmail(userEmail);
        setLocalCount(result.localCount);
        setLastCloudUpdatedAt(result.cloudUpdatedAt);
        if (!silent) {
          if (result.initialized) {
            setStatus(
              `초기 동기화 완료: 로컬 ${result.localCount}개를 클라우드에 저장했어요.`,
            );
          } else {
            setStatus(
              `스마트 동기화 완료: 총 ${result.localCount}개, 로컬 반영 ${result.localWins}개 / 클라우드 반영 ${result.cloudWins}개`,
            );
          }
        }
      } catch (e) {
        if (!silent) setStatus(e instanceof Error ? e.message : "동기화 실패");
      } finally {
        setBusy(false);
      }
    },
    [email, canUseCloud, supabaseUrl, supabaseAnon],
  );

  useEffect(() => {
    if (hasAutoSyncedRef.current) return;
    if (searchParams.get("auto") !== "1") return;
    if (!email.trim()) return;
    hasAutoSyncedRef.current = true;
    void smartSync(false);
  }, [email, searchParams, smartSync]);

  useEffect(() => {
    if (!email.trim() || !canUseCloud) return;
    void smartSync(true);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void smartSync(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    autoLoopRef.current = window.setInterval(() => {
      void smartSync(true);
    }, 1000 * 60 * 5);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (autoLoopRef.current !== null) {
        window.clearInterval(autoLoopRef.current);
      }
      autoLoopRef.current = null;
    };
  }, [email, canUseCloud, smartSync]);

  return (
    <main className="mx-auto mt-4 w-full max-w-3xl rounded-lg border border-[#eeeeee] bg-white/80 p-4 text-[#444444]">
      <h1 className="text-xl font-semibold">🔄 동기화 센터</h1>
      <p className="mt-2 text-sm">
        자동 동기화가 켜져 있어요. 페이지 진입/탭 복귀/5분마다 백그라운드로 동기화합니다.
      </p>

      <div className="mt-3 rounded-md border border-[#dddddd] bg-white p-3 text-sm">
        <p>로컬 데이터 키 수: {localCount}</p>
        <p className="mt-1">
          클라우드 마지막 업데이트:{" "}
          {lastCloudUpdatedAt ? new Date(lastCloudUpdatedAt).toLocaleString("ko-KR") : "-"}
        </p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            const next = e.target.value;
            setEmail(next);
            setSavedSyncEmail(next);
          }}
          placeholder="동기화용 이메일 (한 번 입력하면 기억)"
          className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => void smartSync(false)}
          disabled={busy}
          className="rounded-md border border-transparent bg-[#8fb6e8] px-3 py-2 text-sm font-medium text-[#444444] shadow-sm"
        >
          {busy ? "동기화중..." : "지금 동기화"}
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
