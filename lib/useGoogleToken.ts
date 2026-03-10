"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TokenState = {
  accessToken: string;
  expiresAt: number;
  needsLogin: boolean;
  loading: boolean;
  error: string | null;
};

/**
 * 서버사이드 쿠키 기반 구글 토큰 훅
 * - 앱 시작 시 자동으로 /api/auth/refresh 호출
 * - 만료 5분 전 자동 갱신
 * - needsLogin=true면 /api/auth/google 로 보내면 됨
 */
export function useGoogleToken() {
  const [state, setState] = useState<TokenState>({
    accessToken: "",
    expiresAt: 0,
    needsLogin: false,
    loading: true,
    error: null,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/refresh");
      const data = (await res.json()) as {
        access_token?: string;
        expiresAt?: number;
        needsLogin?: boolean;
        error?: string;
      };

      if (data.needsLogin || !data.access_token) {
        setState({ accessToken: "", expiresAt: 0, needsLogin: true, loading: false, error: null });
        return;
      }

      setState({
        accessToken: data.access_token,
        expiresAt: data.expiresAt ?? 0,
        needsLogin: false,
        loading: false,
        error: null,
      });

      // 만료 4분 전에 자동 갱신 예약
      if (data.expiresAt) {
        const msUntilRefresh = data.expiresAt - Date.now() - 4 * 60 * 1000;
        if (msUntilRefresh > 0) {
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(() => {
            void fetchToken();
          }, msUntilRefresh);
        }
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: "토큰 확인 실패" }));
    }
  }, []);

  // 앱 시작 시 토큰 확인
  useEffect(() => {
    void fetchToken();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [fetchToken]);

  // 탭 복귀 시 토큰 재확인
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchToken();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchToken]);

  const login = useCallback(() => {
    window.location.href = "/api/auth/google";
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/refresh", { method: "DELETE" });
    setState({ accessToken: "", expiresAt: 0, needsLogin: true, loading: false, error: null });
  }, []);

  return { ...state, login, logout, refetch: fetchToken };
}
