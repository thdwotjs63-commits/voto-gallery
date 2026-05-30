"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon, MapPin, Clock, Search, X, CalendarPlus } from "lucide-react";
import { groupByDate, buildTournamentICS, buildAllScheduleICS, type Match, type DaySchedule } from "@/lib/schedule-data";

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  "브이리그": { bg: "#E6F1FB", text: "#0C447C", label: "브이리그" },
  "국제경기": { bg: "#FAECE7", text: "#712B13", label: "국제경기" },
  "그 외 배구": { bg: "#E1F5EE", text: "#085041", label: "그 외 배구" },
};
const FALLBACK_STYLE = { bg: "#F1EFE8", text: "#2C2C2A", label: "기타" };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function catStyle(category: string) {
  return CATEGORY_STYLE[category] ?? { ...FALLBACK_STYLE, label: category || "기타" };
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function weekdayLabel(dateStr: string): string {
  return WEEKDAYS[parseDateString(dateStr).getDay()];
}
function weekdayClass(dateStr: string): string {
  const day = parseDateString(dateStr).getDay();
  if (day === 0) return "text-red-600";
  if (day === 6) return "text-blue-600";
  return "text-zinc-500";
}

function needsIosSafariTip(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const isInAppBrowser =
    /(KAKAOTALK|Instagram|FBAN|FBAV|Line\/|Twitter|DaumApps|NAVER)/i.test(ua);
  const isSafari = /Safari/.test(ua) && !isOtherBrowser && !isInAppBrowser;
  return !isSafari;
}

function MatchLine({ m, inheritColor = false }: { m: Match; inheritColor?: boolean }) {
  const winnerClass = inheritColor ? "font-semibold" : "font-medium text-zinc-900";
  const mutedClass = inheritColor ? "opacity-65" : "text-zinc-500";

  return (
    <span>
      {m.startTime}{" "}
      {m.scoreA && m.scoreB ? (
        <>
          <span className={Number(m.scoreA) > Number(m.scoreB) ? winnerClass : ""}>{m.teamA}</span>
          <span className="mx-1 font-medium">{m.scoreA}:{m.scoreB}</span>
          <span className={Number(m.scoreB) > Number(m.scoreA) ? winnerClass : ""}>{m.teamB}</span>
        </>
      ) : (
        <>
          {m.teamA} <span className={mutedClass}>vs</span> {m.teamB}
        </>
      )}
      {m.round ? <span className={mutedClass}> ({m.round})</span> : null}
    </span>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [teamQuery, setTeamQuery] = useState("");
  const [showIosSafariTip, setShowIosSafariTip] = useState(false);

  useEffect(() => {
    setShowIosSafariTip(needsIosSafariTip());
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/schedule")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data)) setMatches(data);
        else setError(data?.error ?? "불러오기 실패");
      })
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    let result = activeCategory === "all" ? matches : matches.filter((m) => m.category === activeCategory);
    const q = teamQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (m) => m.teamA.toLowerCase().includes(q) || m.teamB.toLowerCase().includes(q)
      );
    }
    return result;
  }, [matches, activeCategory, teamQuery]);
  const daySchedules = useMemo(() => groupByDate(filtered), [filtered]);
  const dayMap = useMemo(() => {
    const map = new Map<string, DaySchedule>();
    for (const d of daySchedules) map.set(d.date, d);
    return map;
  }, [daySchedules]);

  const calendarCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ date: new Date(year, month, i - startOffset + 1), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }
    return cells;
  }, [cursor]);

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
  const selectedDay = selectedDate ? dayMap.get(selectedDate) : null;
  const monthPrefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const categories = ["all", "브이리그", "국제경기", "그 외 배구"];
  const listDays = useMemo(
    () =>
      teamQuery.trim()
        ? daySchedules
        : daySchedules.filter((d) => d.date.startsWith(monthPrefix)),
    [daySchedules, teamQuery, monthPrefix]
  );
  const allDaySchedules = useMemo(() => groupByDate(matches), [matches]);

  const downloadICS = (ics: string, filename: string) => {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSaveToCalendar = (group: typeof daySchedules[number]["groups"][number], date: string) => {
    downloadICS(buildTournamentICS(group, date), `${group.tournament}_${date}.ics`);
  };

  const handleSaveAllToCalendar = () => {
    downloadICS(buildAllScheduleICS(allDaySchedules), "voto_volleyball_schedule.ics");
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
      <header className="mx-auto flex max-w-[1100px] items-start justify-between gap-4 px-4 py-5 sm:items-center sm:px-8 sm:py-6">
        <div className="min-w-0">
          <p className="text-xs tracking-widest text-zinc-500 uppercase">voto gallery</p>
          <h1 className="mt-0.5 text-lg font-medium tracking-wide text-zinc-900">배구 일정</h1>
          <p className="mt-0.5 text-xs text-zinc-500">브이리그 · 국제경기 · 그 외 배구 일정</p>
        </div>
        <button type="button" onClick={() => router.push("/")} className="shrink-0 rounded-full border border-zinc-200 px-4 py-2 text-xs text-zinc-700 transition hover:bg-zinc-50">← Gallery</button>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center justify-center gap-2 sm:justify-start sm:gap-3">
            <button type="button" aria-label="이전 달" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[7.5rem] text-center text-base font-medium text-zinc-900">{monthLabel}</span>
            <button type="button" aria-label="다음 달" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex justify-center gap-1.5 sm:justify-end">
            <button type="button" onClick={() => setView("calendar")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${view === "calendar" ? "bg-[#00287A] text-white" : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}><CalendarIcon className="h-3.5 w-3.5" /> 달력</button>
            <button type="button" onClick={() => setView("list")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${view === "list" ? "bg-[#00287A] text-white" : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}><ListIcon className="h-3.5 w-3.5" /> 리스트</button>
          </div>
        </div>

        <div className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {categories.map((cat) => {
            const active = activeCategory === cat;
            const s = cat === "all" ? null : catStyle(cat);
            return (
              <button key={cat} type="button" onClick={() => setActiveCategory(cat)} className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${active ? "ring-1 ring-zinc-400" : ""}`} style={s ? { background: s.bg, color: s.text } : { background: active ? "#00287A" : "#F1EFE8", color: active ? "#fff" : "#444" }}>
                {cat === "all" ? "전체" : s!.label}
              </button>
            );
          })}
        </div>

        {!loading && !error && matches.length > 0 ? (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-700">모든 배구 일정을 캘린더 앱에 한 번에 추가할 수 있어요.</p>
              {showIosSafariTip ? (
                <p className="text-[11px] leading-relaxed text-zinc-600">
                  아이폰에서는 <span className="font-medium text-zinc-800">Safari</span>로 이 페이지에 접속하면 캘린더 추가가 더 쉬워요.
                  카카오톡·인스타 등 앱 안에서 열면 저장이 잘 안 될 수 있어요.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleSaveAllToCalendar}
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#00287A] bg-[#00287A] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#001f5c] sm:w-auto sm:py-1.5"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              전체 일정 저장
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : view === "calendar" ? (
          <>
            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (<div key={w} className="py-1 text-center text-[11px] text-zinc-500">{w}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map(({ date, inMonth }) => {
                const key = ymd(date);
                const day = dayMap.get(key);
                const isSelected = selectedDate === key;
                return (
                  <button key={key} type="button" onClick={() => day && setSelectedDate(isSelected ? null : key)} className={`min-h-[4.5rem] rounded-md border bg-white p-1 text-left align-top text-xs text-zinc-900 sm:min-h-[100px] sm:p-1.5 ${isSelected ? "border-[1.5px] border-[#00287A]" : "border-zinc-200"} ${day ? "cursor-pointer hover:bg-zinc-50" : "cursor-default"}`}>
                    <span className={`block text-[10px] font-medium sm:text-[11px] ${inMonth ? "text-zinc-800" : "text-zinc-400"}`}>{date.getDate()}</span>
                    {day?.groups.map((g, i) => {
                      const s = catStyle(g.category);
                      return (
                        <div key={i} className="mt-0.5 rounded px-0.5 py-0.5 text-[8px] leading-snug sm:mt-1 sm:px-1 sm:py-1 sm:text-[9px]" style={{ background: s.bg, color: s.text }}>
                          <div className="line-clamp-2 font-medium leading-tight sm:line-clamp-none">{g.tournament}</div>
                          <div className="mt-0.5 hidden flex-col gap-0.5 sm:flex">
                            {g.matches.map((m, j) => (
                              <div key={j} className="leading-tight">
                                <MatchLine m={m} inheritColor />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </button>
                );
              })}
            </div>

            {selectedDay ? (
              <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900">{selectedDay.date} · {selectedDay.totalMatches}경기</span>
                  <button type="button" aria-label="닫기" onClick={() => setSelectedDate(null)} className="text-zinc-500 hover:text-zinc-800"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-2">
                  {selectedDay.groups.map((g, i) => {
                    const s = catStyle(g.category);
                    return (
                      <div key={i} className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="rounded-full px-2.5 py-0.5 text-[11px]" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                          <span className="text-sm font-medium text-zinc-900">{g.tournament}</span>
                          <span className="text-xs text-zinc-500">· {g.matches.length}경기</span>
                        </div>
                        <button type="button" onClick={() => handleSaveToCalendar(g, selectedDay.date)} className="mb-2 inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-700 transition hover:bg-zinc-100"><CalendarPlus className="h-3 w-3" /> 내 캘린더에 저장</button>
                        <div className="text-xs leading-relaxed text-zinc-700">
                          {g.venue ? (<div className="mb-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {g.venue}{g.matches[0]?.court ? ` ${g.matches[0].court}` : ""}</div>) : null}
                          {g.matches.map((m, j) => (<div key={j} className="flex items-start gap-1"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /><MatchLine m={m} /></div>))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="search"
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                  placeholder="팀명 검색 (예: 현대)"
                  className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pr-8 pl-9 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-[#00287A] focus:outline-none"
                />
                {teamQuery ? (
                  <button
                    type="button"
                    aria-label="검색어 지우기"
                    onClick={() => setTeamQuery("")}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-500 hover:text-zinc-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {teamQuery.trim() ? (
                <span className="shrink-0 text-[11px] text-zinc-500">전체 기간 검색</span>
              ) : null}
            </div>
            <div className="space-y-6 sm:space-y-8">
              {listDays.map((day) => (
                <section key={day.date}>
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-base font-medium text-zinc-900">{day.date}</span>
                    <span className={`text-sm font-medium ${weekdayClass(day.date)}`}>({weekdayLabel(day.date)})</span>
                    <span className="text-xs text-zinc-500">{day.totalMatches}경기</span>
                  </div>
                  <div className="space-y-2">
                    {day.groups.map((g, i) => {
                      const s = catStyle(g.category);
                      return (
                        <div key={i} className="rounded-lg border border-zinc-200 bg-white px-3 py-3 sm:px-4">
                          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="rounded-full px-2.5 py-0.5 text-[11px]" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                            <span className="text-sm font-medium text-zinc-900">{g.tournament}</span>
                            <span className="text-xs text-zinc-500">· {g.matches.length}경기</span>
                          </div>
                          <button type="button" onClick={() => handleSaveToCalendar(g, day.date)} className="mb-2 inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-700 transition hover:bg-zinc-100"><CalendarPlus className="h-3 w-3" /> 내 캘린더에 저장</button>
                          <div className="text-xs leading-relaxed text-zinc-700">
                            {g.venue ? (<div className="mb-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {g.venue}</div>) : null}
                            {g.matches.map((m, j) => (<div key={j} className="flex items-start gap-1"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /><MatchLine m={m} /></div>))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
              {listDays.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {teamQuery.trim() ? `"${teamQuery.trim()}" 검색 결과가 없습니다.` : "이번 달 일정이 없습니다."}
                </p>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
