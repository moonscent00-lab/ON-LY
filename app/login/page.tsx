"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const SESSION_KEY = "diary-os.session.v1";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        email: email.trim(),
        signedAt: new Date().toISOString(),
      }),
    );
    setMessage("로그인 저장 완료. 스마트 동기화 화면으로 이동합니다.");
    router.push("/sync?auto=1");
  }

  return (
    <main className="mx-auto mt-10 w-full max-w-md rounded-lg border border-[#eeeeee] bg-white p-5 text-[#444444] shadow-sm">
      <h1 className="text-xl font-semibold">🔐 로그인</h1>
      <p className="mt-1 text-sm">기기 간 동기화를 위한 계정 연결 시작 화면입니다.</p>

      <form className="mt-4 space-y-2" onSubmit={onSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-md border border-[#dddddd] bg-[#8fb6e8] px-3 py-2 text-sm font-medium text-[#444444]"
        >
          로그인
        </button>
      </form>

      {message ? <p className="mt-3 text-sm">{message}</p> : null}

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/" className="rounded-md border border-[#dddddd] px-2 py-1">
          대시보드로
        </Link>
        <button
          type="button"
          className="rounded-md border border-[#dddddd] px-2 py-1"
          onClick={() => {
            localStorage.removeItem(SESSION_KEY);
            setMessage("저장된 로그인 상태를 삭제했어요.");
          }}
        >
          로그아웃(로컬)
        </button>
      </div>
    </main>
  );
}
