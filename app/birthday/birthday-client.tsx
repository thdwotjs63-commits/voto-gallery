"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  BIRTHDAY_CLOSED_MESSAGE,
  BIRTHDAY_DEADLINE,
  BIRTHDAY_MESSAGE_MAX,
  BIRTHDAY_NICKNAME_MAX,
  birthdaySubmitErrorMessage,
  formatBirthdayMessageDate,
  isBirthdayClosed,
  type BirthdayMessage,
} from "@/lib/birthday";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-client";

const YELLOW = "#F7C331";
const NAVY = "#1E3A9E";
const MAX_TIMEOUT_MS = 2_147_483_647;

/** 마감 시각이 되면 열려 있던 화면도 바로 잠기도록 타이머로 갱신한다. */
function subscribeDeadline(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    const remaining = BIRTHDAY_DEADLINE.getTime() - Date.now();
    if (remaining <= 0) return;
    timer = setTimeout(() => {
      onChange();
      schedule();
    }, Math.min(remaining + 50, MAX_TIMEOUT_MS));
  };
  schedule();
  return () => clearTimeout(timer);
}

function useBirthdayClosed(): boolean {
  return useSyncExternalStore(
    subscribeDeadline,
    () => isBirthdayClosed(),
    () => false
  );
}

type Toast = { kind: "success" | "error"; text: string };

type PublicMessagesResult =
  | { ok: true; messages: BirthdayMessage[] }
  | { ok: false };

/** 비공개 메시지는 RLS와 별개로 쿼리에서도 is_public=true만 조회한다. */
async function fetchPublicMessages(): Promise<PublicMessagesResult> {
  if (!isSupabaseConfigured) return { ok: false };
  const { data, error } = await supabase
    .from("birthday_messages")
    .select("nickname, message, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[birthday] failed to load messages:", error.message);
    return { ok: false };
  }
  return { ok: true, messages: (data ?? []) as BirthdayMessage[] };
}

export default function BirthdayClient() {
  const isClosed = useBirthdayClosed();

  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const [messages, setMessages] = useState<BirthdayMessage[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const showToast = useCallback((next: Toast) => {
    clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const applyMessages = useCallback((result: PublicMessagesResult) => {
    if (result.ok) {
      setMessages(result.messages);
      setListError(null);
    } else {
      setListError("메시지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요");
    }
    setListLoading(false);
  }, []);

  const loadMessages = useCallback(async () => {
    applyMessages(await fetchPublicMessages());
  }, [applyMessages]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicMessages().then((result) => {
      if (!cancelled) applyMessages(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyMessages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || isClosed) return;

    const trimmedNickname = nickname.trim();
    const trimmedMessage = message.trim();
    if (!trimmedNickname) {
      setFormError("닉네임을 입력해 주세요");
      return;
    }
    if (!trimmedMessage) {
      setFormError("축하 메시지를 입력해 주세요");
      return;
    }
    if (
      trimmedNickname.length > BIRTHDAY_NICKNAME_MAX ||
      trimmedMessage.length > BIRTHDAY_MESSAGE_MAX
    ) {
      setFormError("글자 수를 확인해 주세요");
      return;
    }
    if (!isSupabaseConfigured) {
      setFormError("지금은 메시지를 보낼 수 없어요");
      return;
    }

    setFormError(null);
    setSubmitting(true);
    const submittedPublic = isPublic;
    try {
      const { error } = await supabase.from("birthday_messages").insert({
        nickname: trimmedNickname,
        message: trimmedMessage,
        is_public: submittedPublic,
      });
      if (error) {
        console.error("[birthday] insert failed:", error.code, error.message);
        const text = birthdaySubmitErrorMessage(error);
        setFormError(text);
        showToast({ kind: "error", text });
        return;
      }

      setNickname("");
      setMessage("");
      setIsPublic(true);
      showToast({ kind: "success", text: "축하 메시지가 전달되었어요!" });
      if (submittedPublic) void loadMessages();
    } catch (error) {
      console.error("[birthday] insert threw:", error);
      const text = birthdaySubmitErrorMessage(
        error instanceof Error ? { message: error.message } : null
      );
      setFormError(text);
      showToast({ kind: "error", text });
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = BIRTHDAY_MESSAGE_MAX - message.length;

  return (
    <div className="min-h-dvh bg-[#FFF8E6] text-[#1E3A9E]">
      <main className="mx-auto w-full max-w-md pb-16">
        <header
          className="rounded-b-[2.5rem] px-6 pb-10 pt-12 text-center shadow-[0_8px_24px_rgba(30,58,158,0.15)]"
          style={{ backgroundColor: YELLOW }}
        >
          <p className="text-xs font-bold tracking-[0.3em] opacity-80">
            DAENI.KR · BIRTHDAY
          </p>
          <h1 className="mt-3 text-[2.6rem] font-black leading-[1.05] tracking-tight">
            HAPPY
            <br />
            BONG&apos;S DAY
          </h1>
          <p className="mx-auto mt-4 max-w-[17rem] text-[15px] font-semibold leading-relaxed">
            김다인 선수의 생일을 함께 축하해요
          </p>
        </header>

        <section className="px-5 pt-8" aria-labelledby="birthday-write-title">
          <div className="rounded-3xl border-2 border-[#1E3A9E]/10 bg-white p-5 shadow-[0_4px_16px_rgba(30,58,158,0.08)]">
            <h2
              id="birthday-write-title"
              className="text-lg font-extrabold"
            >
              축하 메시지 남기기
            </h2>

            {isClosed ? (
              <p className="mt-4 rounded-2xl bg-[#FFF3CC] px-4 py-5 text-center text-[15px] font-semibold leading-relaxed">
                {BIRTHDAY_CLOSED_MESSAGE}
              </p>
            ) : (
              <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <label
                    htmlFor="birthday-nickname"
                    className="mb-1.5 block text-sm font-bold"
                  >
                    닉네임
                  </label>
                  <input
                    id="birthday-nickname"
                    type="text"
                    value={nickname}
                    maxLength={BIRTHDAY_NICKNAME_MAX}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="최대 20자"
                    autoComplete="nickname"
                    disabled={submitting}
                    className="h-12 w-full rounded-xl border-2 border-[#1E3A9E]/15 bg-[#FFFDF6] px-4 text-base text-[#1E3A9E] outline-none placeholder:text-[#1E3A9E]/35 focus:border-[#F7C331] disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="birthday-message"
                    className="mb-1.5 block text-sm font-bold"
                  >
                    메시지
                  </label>
                  <textarea
                    id="birthday-message"
                    value={message}
                    maxLength={BIRTHDAY_MESSAGE_MAX}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="다인 선수에게 전하고 싶은 축하를 적어주세요"
                    rows={6}
                    disabled={submitting}
                    className="w-full resize-none rounded-xl border-2 border-[#1E3A9E]/15 bg-[#FFFDF6] px-4 py-3 text-base leading-relaxed text-[#1E3A9E] outline-none placeholder:text-[#1E3A9E]/35 focus:border-[#F7C331] disabled:opacity-60"
                  />
                  <p
                    className={`mt-1 text-right text-xs font-semibold ${
                      remaining <= 30 ? "text-[#D2683C]" : "text-[#1E3A9E]/50"
                    }`}
                    aria-live="polite"
                  >
                    {remaining}자 남음
                  </p>
                </div>

                <fieldset>
                  <legend className="mb-1.5 text-sm font-bold">공개 여부</legend>
                  <div className="grid gap-2">
                    <VisibilityOption
                      checked={isPublic}
                      disabled={submitting}
                      onSelect={() => setIsPublic(true)}
                      title="전시에 공개"
                      hint="아래 메시지 전시에 함께 보여요"
                    />
                    <VisibilityOption
                      checked={!isPublic}
                      disabled={submitting}
                      onSelect={() => setIsPublic(false)}
                      title="비공개 — 다인이에게만 전달"
                      hint="전시에는 보이지 않아요"
                    />
                  </div>
                </fieldset>

                <p className="text-xs leading-relaxed text-[#1E3A9E]/60">
                  남겨주신 모든 메시지는 eBook으로 엮어 생일 당일 다인이에게 직접
                  전달됩니다 💛 비공개 메시지도 eBook에는 담겨요.
                </p>

                {formError ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-[#FDECE4] px-4 py-3 text-sm font-semibold text-[#A8431F]"
                  >
                    {formError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-14 w-full rounded-2xl text-base font-extrabold shadow-[0_4px_0_rgba(15,30,90,0.35)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                  style={{ backgroundColor: NAVY, color: YELLOW }}
                >
                  {submitting ? "보내는 중…" : "축하 메시지 보내기"}
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="px-5 pt-10" aria-labelledby="birthday-list-title">
          <h2 id="birthday-list-title" className="text-xl font-extrabold">
            팬들의 축하 메시지
          </h2>
          {!listLoading && !listError ? (
            <p className="mt-1.5 text-sm font-semibold text-[#1E3A9E]/70">
              지금까지 {messages.length}개의 축하가 모였어요
            </p>
          ) : null}

          <div className="mt-4">
            {listLoading ? (
              <p className="rounded-2xl bg-white/70 px-4 py-8 text-center text-sm text-[#1E3A9E]/60">
                메시지를 불러오는 중…
              </p>
            ) : listError ? (
              <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm">
                <p className="text-[#A8431F]">{listError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setListLoading(true);
                    void loadMessages();
                  }}
                  className="mt-3 min-h-11 rounded-full border-2 border-[#1E3A9E]/20 px-5 font-bold"
                >
                  다시 불러오기
                </button>
              </div>
            ) : messages.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-[#F7C331] bg-white/70 px-4 py-10 text-center text-[15px] font-semibold">
                첫 번째 축하 메시지를 남겨주세요!
              </p>
            ) : (
              <ul className="space-y-3">
                {messages.map((item, index) => (
                  <li
                    key={`${item.created_at}-${index}`}
                    className="rounded-2xl border-l-[6px] border-[#F7C331] bg-white px-4 py-4 shadow-[0_2px_10px_rgba(30,58,158,0.06)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-[15px] font-extrabold">
                        {item.nickname}
                      </p>
                      <time
                        dateTime={item.created_at}
                        className="shrink-0 text-xs text-[#1E3A9E]/45"
                      >
                        {formatBirthdayMessageDate(item.created_at)}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1E2A55]">
                      {item.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <footer className="px-5 pt-12 text-center">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center rounded-full px-6 text-sm font-bold text-[#1E3A9E]/75 underline-offset-4 hover:underline"
          >
            ← 다른 기록 보러가기
          </Link>
        </footer>
      </main>

      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-5"
        >
          <p
            className={`rounded-full px-5 py-3 text-sm font-bold shadow-lg ${
              toast.kind === "success"
                ? "bg-[#1E3A9E] text-[#F7C331]"
                : "bg-[#A8431F] text-white"
            }`}
          >
            {toast.text}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function VisibilityOption({
  checked,
  disabled,
  onSelect,
  title,
  hint,
}: {
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition ${
        checked
          ? "border-[#F7C331] bg-[#FFF6D6]"
          : "border-[#1E3A9E]/12 bg-white"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="radio"
        name="birthday-visibility"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="h-5 w-5 shrink-0 accent-[#1E3A9E]"
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-bold">{title}</span>
        <span className="block text-xs text-[#1E3A9E]/55">{hint}</span>
      </span>
    </label>
  );
}
