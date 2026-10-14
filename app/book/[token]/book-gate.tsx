"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

/** 링크를 실수로 연 사람을 막는 화면 잠금. 진짜 보호는 토큰 URL 이다 */
const PASSCODE = process.env.NEXT_PUBLIC_BOOK_PASSCODE || "10151205";
const UNLOCK_KEY = "book-unlocked";
const UNLOCK_EVENT = "book-unlock-change";

function readUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function writeUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(UNLOCK_EVENT));
}

function subscribeUnlocked(onChange: () => void) {
  window.addEventListener(UNLOCK_EVENT, onChange);
  return () => window.removeEventListener(UNLOCK_EVENT, onChange);
}

export function BookGate({ children }: { children: ReactNode }) {
  /** 서버 렌더에선 아직 모르니 null — 잠금 화면이 잠깐 번쩍이지 않게 빈 화면 */
  const stored = useSyncExternalStore<boolean | null>(subscribeUnlocked, readUnlocked, () => null);
  const [unlockedNow, setUnlockedNow] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlockedNow || stored) return <>{children}</>;
  if (stored === null) return <div className="min-h-dvh bg-[#f6f3ee]" />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim() === PASSCODE) {
      setUnlockedNow(true);
      writeUnlocked();
      return;
    }
    setError(true);
    setValue("");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f3ee] px-6 text-[#1c1c24] [color-scheme:light]">
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col items-center text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-[#c8202c]">DAENI.KR · BIRTHDAY BOOK</p>
        <h1 className="mt-3 break-keep text-2xl font-extrabold leading-snug text-[#1e3e96]">
          🎂 다인이에게 보내는 메시지북
        </h1>
        <label htmlFor="book-passcode" className="mt-6 text-sm font-semibold text-[#55524b]">
          비밀번호를 입력해 주세요
        </label>
        <input
          id="book-passcode"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          aria-invalid={error}
          aria-describedby={error ? "book-passcode-error" : undefined}
          className={`mt-3 h-14 w-full rounded-2xl border-2 bg-white px-4 text-center text-xl tracking-[0.4em] outline-none transition-colors focus:border-[#1e3e96] ${
            error ? "border-[#c8202c]" : "border-[#1e3e96]/25"
          }`}
        />
        <p id="book-passcode-error" role="alert" className="mt-2 min-h-5 text-sm font-semibold text-[#c8202c]">
          {error ? "비밀번호가 맞지 않아요" : ""}
        </p>
        <button
          type="submit"
          disabled={!value.trim()}
          className="mt-2 h-12 w-full rounded-2xl bg-[#1e3e96] text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          열기
        </button>
      </form>
    </main>
  );
}
