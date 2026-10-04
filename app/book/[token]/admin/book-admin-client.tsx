"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatBookDate } from "@/lib/book-pages";

const ADMIN_KEY_STORAGE_KEY = "voto-book-admin-key";
const ADMIN_KEY_EVENT = "voto-book-admin-key-change";

type AdminMessage = {
  id: string;
  nickname: string;
  message: string;
  created_at: string;
  is_public: boolean;
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; messages: AdminMessage[] };

function readStoredKey(): string {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredKey(value: string) {
  try {
    if (value) localStorage.setItem(ADMIN_KEY_STORAGE_KEY, value);
    else localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(ADMIN_KEY_EVENT));
}

function subscribeStoredKey(onChange: () => void) {
  window.addEventListener(ADMIN_KEY_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ADMIN_KEY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function authHeaders(token: string, adminKey: string): HeadersInit {
  return {
    "x-book-token": encodeURIComponent(token),
    "x-book-admin-key": encodeURIComponent(adminKey),
  };
}

function failureMessage(status: number, serverError?: string): string {
  if (status === 401) return "검토 키가 맞지 않아요";
  if (status === 404) return "주소가 올바르지 않아요";
  const detail = (serverError ?? "").trim().slice(0, 120);
  return detail ? `서버 오류 · ${detail}` : `서버 오류 (${status})`;
}

type LoadResult =
  | { ok: true; messages: AdminMessage[]; hiddenIds: string[] }
  | { ok: false; message: string };

async function fetchAdminData(token: string, adminKey: string): Promise<LoadResult> {
  try {
    const res = await fetch("/api/book/admin", {
      headers: authHeaders(token, adminKey),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      messages?: AdminMessage[];
      hiddenIds?: string[];
      error?: string;
    };
    if (!res.ok) return { ok: false, message: failureMessage(res.status, body.error) };
    return { ok: true, messages: body.messages ?? [], hiddenIds: body.hiddenIds ?? [] };
  } catch {
    return { ok: false, message: "인터넷 연결을 확인해 주세요" };
  }
}

export function BookAdminClient({ token }: { token: string }) {
  const storedKey = useSyncExternalStore(subscribeStoredKey, readStoredKey, () => "");
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const keyInput = draftKey ?? storedKey;

  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [savedHidden, setSavedHidden] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const applyLoad = useCallback((result: LoadResult) => {
    if (!result.ok) {
      setLoad({ status: "error", message: result.message });
      return;
    }
    const ids = new Set(result.hiddenIds);
    setLoad({ status: "ready", messages: result.messages });
    setHidden(ids);
    setSavedHidden(new Set(ids));
  }, []);

  useEffect(() => {
    if (!storedKey) return;
    let cancelled = false;
    void fetchAdminData(token, storedKey).then((result) => {
      if (!cancelled) applyLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token, storedKey, applyLoad]);

  const handleOpen = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setLoad({ status: "loading" });
    setNotice(null);
    const result = await fetchAdminData(token, key);
    if (result.ok) {
      writeStoredKey(key);
      setDraftKey(null);
    }
    applyLoad(result);
  };

  const toggle = (id: string) => {
    setNotice(null);
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dirty = useMemo(
    () => hidden.size !== savedHidden.size || [...hidden].some((id) => !savedHidden.has(id)),
    [hidden, savedHidden]
  );

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/book/admin", {
        method: "PUT",
        headers: { ...authHeaders(token, storedKey), "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenIds: [...hidden] }),
      });
      const body = (await res.json().catch(() => ({}))) as { hiddenIds?: string[]; error?: string };
      if (!res.ok) {
        setNotice(`저장하지 못했어요 · ${failureMessage(res.status, body.error)}`);
        return;
      }
      const ids = new Set(body.hiddenIds ?? []);
      setHidden(ids);
      setSavedHidden(new Set(ids));
      setNotice("저장했어요");
    } catch {
      setNotice("저장하지 못했어요 · 인터넷 연결을 확인해 주세요");
    } finally {
      setSaving(false);
    }
  };

  const handleForgetKey = () => {
    writeStoredKey("");
    setDraftKey("");
    setLoad({ status: "idle" });
  };

  if (load.status !== "ready") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 text-[#1c1c24]">
        <h1 className="text-lg font-bold">메시지북 검토</h1>
        <label htmlFor="book-admin-key" className="mt-5 text-sm font-semibold">
          검토 키
        </label>
        <input
          id="book-admin-key"
          type="password"
          autoComplete="off"
          value={keyInput}
          onChange={(e) => setDraftKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleOpen();
          }}
          className="mt-1.5 h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none focus:border-[#1e3e96]"
        />
        <button
          type="button"
          onClick={() => void handleOpen()}
          disabled={!keyInput.trim() || load.status === "loading"}
          className="mt-3 h-12 rounded-xl bg-[#1e3e96] text-base font-bold text-white disabled:opacity-50"
        >
          {load.status === "loading" ? "불러오는 중…" : "열기"}
        </button>
        {load.status === "error" ? (
          <p role="alert" className="mt-3 text-sm text-[#c8202c]">
            {load.message}
          </p>
        ) : null}
      </main>
    );
  }

  const { messages } = load;
  const visibleCount = messages.filter((m) => !hidden.has(m.id)).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 text-[#1c1c24]">
      <header className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-bold">메시지북 검토</h1>
          <a
            href={`/book/${encodeURIComponent(token)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-[#1e3e96] underline underline-offset-2"
          >
            책 보기 ↗
          </a>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          책에 실림 <b className="text-[#1c1c24]">{visibleCount}</b> / 전체 {messages.length} · 작성
          시간순
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
            className="h-10 rounded-lg bg-[#1e3e96] px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setHidden(new Set());
            }}
            disabled={hidden.size === 0}
            className="h-10 rounded-lg border border-zinc-300 px-4 text-sm font-semibold disabled:opacity-40"
          >
            모두 보이기
          </button>
          {dirty ? <span className="text-xs text-[#c8202c]">저장하지 않은 변경이 있어요</span> : null}
          {notice ? <span className="text-xs text-zinc-600">{notice}</span> : null}
          <button
            type="button"
            onClick={handleForgetKey}
            className="ml-auto text-xs text-zinc-500 underline underline-offset-2"
          >
            키 지우기
          </button>
        </div>
      </header>

      {messages.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">아직 메시지가 없어요</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {messages.map((m, i) => {
            const shown = !hidden.has(m.id);
            return (
              <li key={m.id}>
                <label
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                    shown ? "border-zinc-200 bg-white" : "border-dashed border-zinc-300 bg-zinc-50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={shown}
                    onChange={() => toggle(m.id)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[#1e3e96]"
                    aria-label={`${m.nickname} 메시지 책에 싣기`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <span className="text-xs text-zinc-400">#{i + 1}</span>
                      <b className="break-all">{m.nickname}</b>
                      <span className="text-xs text-zinc-500">{formatBookDate(m.created_at)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          m.is_public ? "bg-[#e8edfa] text-[#1e3e96]" : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {m.is_public ? "공개" : "비공개"}
                      </span>
                      {!shown ? <span className="text-xs font-semibold text-[#c8202c]">숨김</span> : null}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
                      {m.message}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
