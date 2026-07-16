"use client";

import { useMemo, useState } from "react";
import type { Mbti } from "@/lib/saju-mbti";
import type { BirthInput } from "@/lib/saju-compat";

export type SajuFormValues = {
  birth: BirthInput;
  nickname: string;
  mbti: Mbti | null;
};

type Axis = "EI" | "NS" | "TF" | "JP";

const AXIS_OPTIONS: Record<Axis, [string, string]> = {
  EI: ["E", "I"],
  NS: ["N", "S"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

type Props = {
  onSubmit: (values: SajuFormValues) => void;
};

export function SajuForm({ onSubmit }: Props) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [timeUnknown, setTimeUnknown] = useState(true);
  const [nickname, setNickname] = useState("");
  const [ei, setEi] = useState<string | null>(null);
  const [ns, setNs] = useState<string | null>(null);
  const [tf, setTf] = useState<string | null>(null);
  const [jp, setJp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mbtiHint, setMbtiHint] = useState(false);

  const mbtiPartial = useMemo(() => {
    const picked = [ei, ns, tf, jp].filter(Boolean).length;
    return picked > 0 && picked < 4;
  }, [ei, ns, tf, jp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMbtiHint(false);

    if (!date) {
      setError("생년월일을 입력해 주세요.");
      return;
    }
    const [ys, ms, ds] = date.split("-").map(Number);
    if (!ys || !ms || !ds) {
      setError("생년월일을 확인해 주세요.");
      return;
    }
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (ys < 1900 || date > todayStr) {
      setError("1900년~오늘 사이의 날짜만 가능해요.");
      return;
    }

    let hour: number | null = null;
    if (!timeUnknown) {
      const [hh] = time.split(":").map(Number);
      if (!Number.isFinite(hh) || hh < 0 || hh > 23) {
        setError("태어난 시간을 확인해 주세요.");
        return;
      }
      hour = hh;
    }

    const axes = [ei, ns, tf, jp];
    const filled = axes.filter(Boolean).length;
    if (filled > 0 && filled < 4) {
      setMbtiHint(true);
      return;
    }
    const mbti = filled === 4 ? (`${ei}${ns}${tf}${jp}` as Mbti) : null;

    onSubmit({
      birth: { year: ys, month: ms, day: ds, hour },
      nickname: nickname.trim(),
      mbti,
    });
  };

  const clearMbti = () => {
    setEi(null);
    setNs(null);
    setTf(null);
    setJp(null);
    setMbtiHint(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#D9C48A]">
          생년월일 (양력)
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min="1900-01-01"
          max={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-xl border border-[#2A2520] bg-[#1A1714] px-3 py-3 text-sm text-[#E9E3D6] outline-none focus:border-[#D9C48A]/60 [color-scheme:dark]"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="text-[11px] font-semibold tracking-[0.12em] text-[#D9C48A]">
            태어난 시간
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[#8A8172]">
            <input
              type="checkbox"
              checked={timeUnknown}
              onChange={(e) => setTimeUnknown(e.target.checked)}
              className="accent-[#D9C48A]"
            />
            몰라요
          </label>
        </div>
        <input
          type="time"
          value={time}
          disabled={timeUnknown}
          onChange={(e) => setTime(e.target.value)}
          className="w-full rounded-xl border border-[#2A2520] bg-[#1A1714] px-3 py-3 text-sm text-[#E9E3D6] outline-none focus:border-[#D9C48A]/60 disabled:opacity-40 [color-scheme:dark]"
        />
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#D9C48A]">
          닉네임 <span className="font-normal text-[#8A8172]">(선택)</span>
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={12}
          placeholder="결과 카드에 표시"
          className="w-full rounded-xl border border-[#2A2520] bg-[#1A1714] px-3 py-3 text-sm text-[#E9E3D6] outline-none placeholder:text-[#6B645A] focus:border-[#D9C48A]/60"
        />
      </div>

      <div className="rounded-2xl border border-dashed border-[#D9C48A]/35 bg-[#1A1714]/60 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#D9C48A]">
              MBTI도 알려주면 케미까지 (선택)
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#8A8172]">
              건너뛰어도 사주 궁합은 그대로 나옵니다.
            </p>
          </div>
          <button
            type="button"
            onClick={clearMbti}
            className="shrink-0 rounded-full border border-[#3A342C] px-2.5 py-1 text-[10px] text-[#8A8172] transition hover:border-[#D9C48A]/40 hover:text-[#D9C48A]"
          >
            건너뛰기
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(AXIS_OPTIONS) as Axis[]).map((axis) => {
            const [a, b] = AXIS_OPTIONS[axis];
            const value =
              axis === "EI" ? ei : axis === "NS" ? ns : axis === "TF" ? tf : jp;
            const set =
              axis === "EI"
                ? setEi
                : axis === "NS"
                  ? setNs
                  : axis === "TF"
                    ? setTf
                    : setJp;
            return (
              <div key={axis} className="flex overflow-hidden rounded-xl border border-[#2A2520]">
                {[a, b].map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => set(letter)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition ${
                      value === letter
                        ? "bg-[#D9C48A] text-[#131110]"
                        : "bg-transparent text-[#A89F90] hover:bg-[#2A2520]"
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {(mbtiHint || mbtiPartial) && (
          <p className="mt-2 text-[11px] text-[#E8B86D]">네 글자를 모두 골라주세요</p>
        )}
      </div>

      {error ? <p className="text-sm text-[#E07A5F]">{error}</p> : null}

      <button
        type="submit"
        className="w-full rounded-full bg-[#D9C48A] py-3.5 text-sm font-bold text-[#131110] transition hover:bg-[#E3D09A]"
      >
        다인이와 궁합 보기
      </button>

      <p className="text-center text-[11px] leading-relaxed text-[#6B645A]">
        입력한 정보는 저장되지 않아요. 모든 계산은 내 브라우저 안에서만 이루어집니다.
      </p>
    </form>
  );
}
