"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon, MapPin, Clock, Search, X, CalendarPlus, ExternalLink, Calculator, Crown, Ticket } from "lucide-react";
import { groupByDate, buildTournamentICS, buildAllScheduleICS, buildTicketingICS, getTeamKoreaRecord, getTeamKoreaMedals, type Match, type DaySchedule } from "@/lib/schedule-data";
import { computeVLeagueStandings } from "@/lib/standings";
import { getHoliday, getDayType } from "@/lib/holidays";
import { SiteNav } from "@/components/site-nav";
import { PageShareButton } from "@/components/page-share-button";
import { TeamKoreaBadge } from "@/components/team-korea-badge";
import { MedalRecordList } from "@/components/medal-record";
import { VLeagueStandings } from "@/components/vleague-standings";
import { chipTextColor } from "@/lib/vleague-teams";
import {
  isEventOnlyMatch,
  resolveCalendarTeamMark,
  shortenEventLabel,
  type CalendarTeamMark,
} from "@/lib/calendar-team-mark";
import {
  TEAM_TICKET_CONFIGS,
  computeTicketOpenEvents,
  groupTicketEventsByMatch,
  type TicketMatchGroup,
} from "@/lib/ticketing-rules";

function formatMatchMd(matchDate: string): string {
  const [, mm, dd] = matchDate.split("-");
  return mm && dd ? `${Number(mm)}/${Number(dd)}` : matchDate;
}

function ticketMatchTitle(group: TicketMatchGroup): string {
  const md = formatMatchMd(group.matchDate);
  const vs =
    group.kind === "away"
      ? `${group.opponent} vs ${group.teamName}`
      : `${group.teamName} vs ${group.opponent}`;
  const venue = group.venue.trim();
  return venue ? `${md} ${vs} (${venue})` : `${md} ${vs}`;
}

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  "브이리그": { bg: "#E6F1FB", text: "#0C447C", label: "브이리그" },
  "국제경기": { bg: "#FAECE7", text: "#712B13", label: "국제경기" },
  "그 외 배구": { bg: "#E1F5EE", text: "#085041", label: "그 외 배구" },
};
const FALLBACK_STYLE = { bg: "#F1EFE8", text: "#2C2C2A", label: "기타" };
const HYUNDAI_STYLE = { bg: "#FEF3C7", text: "#92400E" };
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
  const holiday = getHoliday(dateStr);
  const dayType = getDayType(dateStr);
  if (holiday || dayType === "sun") return "text-red-600";
  if (dayType === "sat") return "text-blue-600";
  return "text-zinc-500";
}

function calendarDateClass(dateStr: string, inMonth: boolean): string {
  if (!inMonth) return "text-zinc-400";
  const holiday = getHoliday(dateStr);
  const dayType = getDayType(dateStr);
  if (holiday || dayType === "sun") return "text-red-500";
  if (dayType === "sat") return "text-blue-500";
  return "text-zinc-800";
}

function isHyundaiMatch(m: Match): boolean {
  return m.teamA.includes("현대건설") || m.teamB.includes("현대건설");
}

function isHyundaiHomeMatch(m: Match): boolean {
  return m.homeAway === "홈";
}

/** 브이리그 경기들의 round가 모두 같으면 그 값, 없거나 섞이면 null */
function calendarDayRoundLabel(matches: readonly Match[]): string | null {
  const rounds = [
    ...new Set(
      matches
        .filter((m) => (m.category ?? "").trim() === "브이리그")
        .map((m) => (m.round ?? "").trim())
        .filter(Boolean)
    ),
  ];
  return rounds.length === 1 ? rounds[0]! : null;
}

function matchBlockStyle(category: string, matches: Match[]) {
  const base = catStyle(category);
  if (matches.some(isHyundaiMatch)) {
    return { ...base, bg: HYUNDAI_STYLE.bg, text: HYUNDAI_STYLE.text };
  }
  return base;
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

function CalendarTeamMarkView({ mark }: { mark: CalendarTeamMark }) {
  if (mark.kind === "flag") {
    return (
      <span
        title={mark.title}
        aria-label={mark.title}
        className={`inline-flex shrink-0 items-center justify-center text-[11px] leading-none ${
          mark.korea ? "rounded-sm bg-blue-50 ring-1 ring-blue-200/80" : ""
        }`}
      >
        {mark.flag}
      </span>
    );
  }
  if (mark.kind === "club") {
    return (
      <span
        title={mark.title}
        className="inline-flex size-3 shrink-0 items-center justify-center rounded-[2px] text-[8px] font-bold leading-none"
        style={{ background: mark.color, color: chipTextColor(mark.color) }}
      >
        {mark.short}
      </span>
    );
  }
  return (
    <span
      title={mark.title || mark.short}
      className="inline-flex max-w-[2rem] shrink-0 truncate rounded-[2px] bg-zinc-200 px-0.5 text-[7px] font-bold leading-none text-zinc-700"
    >
      {mark.short}
    </span>
  );
}

/** 모바일 달력 전용: 국기/구단칩/이름 vs. 양팀 없으면 일정 이름. 왕관은 위쪽 */
function CalendarMatchShort({ m }: { m: Match }) {
  const showCrown = isHyundaiHomeMatch(m);

  if (isEventOnlyMatch(m)) {
    const label = shortenEventLabel(m.tournament);
    return (
      <div className="w-full min-w-0 overflow-hidden">
        {showCrown ? (
          <Crown className="mb-px h-2 w-2 shrink-0 text-amber-500" aria-hidden />
        ) : null}
        <span
          title={m.tournament || label}
          className="block truncate text-[7px] font-medium leading-tight text-zinc-500"
        >
          {label}
        </span>
      </div>
    );
  }

  const markA = resolveCalendarTeamMark(m.teamA);
  const markB = resolveCalendarTeamMark(m.teamB);
  const koreaMatch =
    (markA.kind === "flag" && markA.korea) || (markB.kind === "flag" && markB.korea);

  return (
    <div
      className={`flex w-full min-w-0 flex-col items-start gap-px overflow-hidden ${
        koreaMatch ? "rounded-sm bg-blue-50/70 px-px py-px" : ""
      }`}
    >
      {showCrown ? (
        <Crown className="h-2 w-2 shrink-0 text-amber-500" aria-hidden />
      ) : null}
      <div className="flex max-w-full items-center gap-px">
        <CalendarTeamMarkView mark={markA} />
        <span className="shrink-0 text-[6px] font-medium leading-none text-zinc-400">vs</span>
        <CalendarTeamMarkView mark={markB} />
      </div>
    </div>
  );
}

function MatchLine({ m, inheritColor = false, showCrown = false }: { m: Match; inheritColor?: boolean; showCrown?: boolean }) {
  const winnerClass = inheritColor ? "font-semibold" : "font-medium text-zinc-900";
  const mutedClass = inheritColor ? "opacity-65" : "text-zinc-500";

  return (
    <span>
      {showCrown && isHyundaiHomeMatch(m) ? (
        <Crown className="mr-0.5 inline h-3 w-3 text-amber-400" aria-hidden />
      ) : null}
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

function BroadcastLink({ url, compact = false }: { url: string; compact?: boolean }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-[#00287A] text-white transition hover:opacity-90 ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
    >
      <ExternalLink className={compact ? "h-3 w-3" : "h-3 w-3"} />
      {compact ? "중계" : "중계 바로가기"}
    </a>
  );
}

function MatchRow({ m, inheritColor = false, compact = false }: { m: Match; inheritColor?: boolean; compact?: boolean }) {
  const isHome = isHyundaiHomeMatch(m);
  const isHyundai = isHyundaiMatch(m);
  return (
    <div className={`flex items-start gap-2 rounded-md ${isHyundai ? "bg-amber-50 px-2 py-1.5 -mx-2" : ""} ${m.url ? "justify-between" : ""}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {isHome ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            <Crown className="h-4 w-4 text-amber-400" aria-hidden />
            홈경기
          </span>
        ) : null}
        <div className="flex items-start gap-1">
          <Clock className={`mt-0.5 shrink-0 text-zinc-500 ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
          <MatchLine m={m} inheritColor={inheritColor} />
        </div>
      </div>
      <BroadcastLink url={m.url} compact={compact} />
    </div>
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
  const [ticketTeam, setTicketTeam] = useState("현대건설");
  const [ticketSelectedLabels, setTicketSelectedLabels] = useState<string[]>(() =>
    TEAM_TICKET_CONFIGS.find((c) => c.match === "현대건설")?.rules.map((r) => r.label) ?? []
  );
  const [ticketIncludeAway, setTicketIncludeAway] = useState(false);
  const [ticketPanelOpen, setTicketPanelOpen] = useState(false);
  /** 체크 해제된 경기 키 — 기본은 전체 선택(이 목록에 없는 키 = 선택됨) */
  const [ticketDeselectedMatchKeys, setTicketDeselectedMatchKeys] = useState<string[]>([]);

  useEffect(() => {
    setShowIosSafariTip(needsIosSafariTip());
  }, []);

  useEffect(() => {
    setSelectedDate(null);
  }, [teamQuery, activeCategory]);

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
  const hasCalendarMatchesInMonth = useMemo(
    () => calendarCells.some(({ date, inMonth }) => inMonth && dayMap.has(ymd(date))),
    [calendarCells, dayMap]
  );
  const allDaySchedules = useMemo(() => groupByDate(matches), [matches]);

  const teamKoreaRecord = useMemo(() => getTeamKoreaRecord(matches), [matches]);
  const medals = useMemo(() => getTeamKoreaMedals(matches), [matches]);
  const vleagueStandings = useMemo(() => computeVLeagueStandings(matches), [matches]);
  /** 팀코리아 성과·승패는 2026년 4~9월 달력에서만 노출 */
  const showTeamKoreaAchievements = monthPrefix >= "2026-04" && monthPrefix <= "2026-09";
  /** 2026-27 V리그 순위는 시즌 기간(2026-11 ~ 2027-04) 달력에서만 노출 */
  const showVleagueStandings = monthPrefix >= "2026-11" && monthPrefix <= "2027-04";

  /** 현재 보고 있는 월(또는 리스트 검색 결과 기간)에 브이리그 경기가 있을 때만 티켓팅 섹션 표시 */
  const showTicketingSection = useMemo(() => {
    const isVleague = (m: Match) => (m.category ?? "").trim() === "브이리그";
    if (view === "list" && teamQuery.trim()) {
      return listDays.some((d) =>
        d.groups.some((g) => g.matches.some(isVleague))
      );
    }
    return matches.some((m) => m.date.startsWith(monthPrefix) && isVleague(m));
  }, [view, teamQuery, listDays, matches, monthPrefix]);

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

  const ticketTeamConfig = useMemo(
    () => TEAM_TICKET_CONFIGS.find((c) => c.match === ticketTeam),
    [ticketTeam]
  );

  const ticketPreview = useMemo(
    () =>
      computeTicketOpenEvents(matches, ticketTeam, {
        onlyUpcoming: true,
        labels: ticketSelectedLabels,
        includeAway: ticketIncludeAway,
      }),
    [matches, ticketTeam, ticketSelectedLabels, ticketIncludeAway]
  );

  const ticketMatchGroups = useMemo(
    () => groupTicketEventsByMatch(ticketPreview),
    [ticketPreview]
  );

  const ticketDeselectedSet = useMemo(
    () => new Set(ticketDeselectedMatchKeys),
    [ticketDeselectedMatchKeys]
  );

  const selectedTicketGroups = useMemo(
    () => ticketMatchGroups.filter((g) => !ticketDeselectedSet.has(g.key)),
    [ticketMatchGroups, ticketDeselectedSet]
  );

  const selectedTicketEvents = useMemo(
    () => selectedTicketGroups.flatMap((g) => g.events),
    [selectedTicketGroups]
  );

  const allTicketMatchesSelected =
    ticketMatchGroups.length > 0 && selectedTicketGroups.length === ticketMatchGroups.length;

  const clearTicketMatchSelection = () => setTicketDeselectedMatchKeys([]);

  const toggleAllTicketMatches = () => {
    if (allTicketMatchesSelected) {
      setTicketDeselectedMatchKeys(ticketMatchGroups.map((g) => g.key));
    } else {
      setTicketDeselectedMatchKeys([]);
    }
  };

  const toggleTicketMatch = (key: string) => {
    setTicketDeselectedMatchKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSaveTicketing = () => {
    if (selectedTicketEvents.length === 0) return;
    downloadICS(
      buildTicketingICS(selectedTicketEvents),
      `voto_ticketing_${ticketTeam}.ics`
    );
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
      <SiteNav />
      <header className="mx-auto flex max-w-[1100px] items-start justify-between gap-4 px-4 py-5 sm:items-center sm:px-8 sm:py-6">
        <div className="min-w-0">
          <p className="text-xs tracking-widest text-zinc-500 uppercase">voto gallery</p>
          <h1 className="mt-0.5 text-lg font-medium tracking-wide text-zinc-900">배구 일정</h1>
          <p className="mt-0.5 text-xs text-zinc-500">브이리그 · 국제경기 · 그 외 배구 일정</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PageShareButton shareTitle="voto gallery — 배구 일정" />
          <button type="button" onClick={() => router.push("/")} className="rounded-full border border-zinc-200 px-4 py-2 text-xs text-zinc-700 transition hover:bg-zinc-50">← Gallery</button>
        </div>
      </header>

      {showTeamKoreaAchievements ? (
        <div className="px-4 sm:px-8">
          <TeamKoreaBadge record={teamKoreaRecord} />
          <MedalRecordList medals={medals} />
        </div>
      ) : null}

      {showVleagueStandings ? (
        <div className="mx-auto max-w-[1100px] px-4 pb-4 sm:px-8">
          <VLeagueStandings standings={vleagueStandings} />
        </div>
      ) : null}

      <main className="mx-auto max-w-[1100px] px-4 pb-20 sm:px-8 sm:pb-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center justify-center gap-2 sm:justify-start sm:gap-3">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => {
                setTicketPanelOpen(false);
                setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
              }}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[7.5rem] text-center text-base font-medium text-zinc-900">{monthLabel}</span>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => {
                setTicketPanelOpen(false);
                setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
              }}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex justify-center gap-1.5 sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/calculator")}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-50"
            >
              <Calculator className="h-3.5 w-3.5" />
              랭킹 계산기
            </button>
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

        {!loading && !error && showTicketingSection ? (
          <section aria-label="티켓팅 알림" className="mb-4">
            <button
              type="button"
              aria-expanded={ticketPanelOpen}
              aria-controls="ticketing-panel"
              onClick={() => setTicketPanelOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#00287A]/20 bg-white px-3 py-2 text-left transition hover:bg-[#00287A]/[0.03]"
            >
              <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-[#00287A]">
                <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">🎟 티켓 오픈 알림 추가하기</span>
              </span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-[#00287A]/70 transition-transform duration-200 ${
                  ticketPanelOpen ? "rotate-90" : ""
                }`}
                aria-hidden
              />
            </button>

            <div
              id="ticketing-panel"
              role="region"
              aria-labelledby="ticketing-panel-title"
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                ticketPanelOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-2 rounded-xl border border-[#00287A]/15 bg-white px-4 py-3">
                  <h2 id="ticketing-panel-title" className="sr-only">
                    티켓팅 알림 설정
                  </h2>
                  <p className="mb-3 text-[11px] leading-relaxed text-zinc-600">
                    티켓 오픈 10분 전에 알림이 울려요 · 캘린더 앱에 추가하면 자동으로 알림됩니다
                  </p>

                  <div className="mb-3">
                    <p className="mb-1.5 text-[11px] font-medium text-zinc-500">구단</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEAM_TICKET_CONFIGS.map((cfg) => {
                        const active = ticketTeam === cfg.match;
                        return (
                          <button
                            key={cfg.match}
                            type="button"
                            disabled={!cfg.enabled}
                            onClick={() => {
                              if (!cfg.enabled) return;
                              setTicketTeam(cfg.match);
                              setTicketSelectedLabels(cfg.rules.map((r) => r.label));
                              clearTicketMatchSelection();
                            }}
                            className={`rounded-full px-3 py-1 text-[11px] transition ${
                              !cfg.enabled
                                ? "cursor-not-allowed border border-zinc-100 bg-zinc-50 text-zinc-400"
                                : active
                                  ? "bg-[#00287A] text-white"
                                  : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                            }`}
                            title={!cfg.enabled ? "준비 중" : undefined}
                          >
                            {cfg.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="mb-1.5 text-[11px] font-medium text-zinc-500">
                      예매 종류
                      {ticketTeamConfig ? (
                        <span className="ml-1 font-normal text-zinc-400">
                          · {ticketTeamConfig.name} 홈
                        </span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {(ticketTeamConfig?.rules ?? []).map((rule) => {
                        const checked = ticketSelectedLabels.includes(rule.label);
                        return (
                          <label
                            key={rule.label}
                            className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setTicketSelectedLabels((prev) =>
                                  e.target.checked
                                    ? [...prev, rule.label]
                                    : prev.filter((l) => l !== rule.label)
                                );
                                clearTicketMatchSelection();
                              }}
                              className="h-3.5 w-3.5 rounded border-zinc-300 text-[#00287A] focus:ring-[#00287A]"
                            />
                            <span>
                              {rule.label}
                              <span className="ml-1 text-[10px] text-zinc-400">
                                D-{rule.daysBefore} {rule.time}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-800">
                      <input
                        type="checkbox"
                        checked={ticketIncludeAway}
                        onChange={(e) => {
                          setTicketIncludeAway(e.target.checked);
                          clearTicketMatchSelection();
                        }}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-[#00287A] focus:ring-[#00287A]"
                      />
                      🚌 원정경기 티켓도 챙기기
                    </label>
                    <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                      원정은 상대 구단의 일반예매(5일 전) 시각으로 알림이 잡혀요.
                    </p>
                  </div>

                  <div className="mb-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-zinc-500">
                        갈 수 있는 경기 고르기
                        {ticketMatchGroups.length > 0 ? (
                          <span className="ml-1 text-zinc-400">
                            · {selectedTicketGroups.length}/{ticketMatchGroups.length}경기
                          </span>
                        ) : null}
                      </p>
                      {ticketMatchGroups.length > 0 ? (
                        <button
                          type="button"
                          onClick={toggleAllTicketMatches}
                          className="min-h-9 shrink-0 rounded-md px-2 text-[11px] font-medium text-[#00287A] hover:bg-[#00287A]/5"
                        >
                          {allTicketMatchesSelected ? "전체 해제" : "전체 선택"}
                        </button>
                      ) : null}
                    </div>
                    {ticketSelectedLabels.length === 0 && !ticketIncludeAway ? (
                      <p className="text-[11px] text-zinc-500">
                        예매 종류를 고르거나 원정경기를 체크해 주세요.
                      </p>
                    ) : ticketMatchGroups.length === 0 ? (
                      <p className="text-[11px] text-zinc-500">
                        앞으로 남은 티켓 오픈이 없어요.
                      </p>
                    ) : (
                      <ul className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
                        {ticketMatchGroups.map((group) => {
                          const checked = !ticketDeselectedSet.has(group.key);
                          return (
                            <li
                              key={group.key}
                              className="rounded-lg border border-zinc-100 bg-white px-2 py-1"
                            >
                              <label className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTicketMatch(group.key)}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-[#00287A] focus:ring-[#00287A]"
                                />
                                <span className="min-w-0 text-[12px] font-medium leading-snug text-zinc-900">
                                  {ticketMatchTitle(group)}
                                  {group.kind === "away" ? (
                                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-800">
                                      원정
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                              <ul className="mb-1 ml-7 space-y-0.5 text-[11px] text-zinc-600">
                                {group.events.map((ev) => {
                                  const isAway = ev.kind === "away";
                                  return (
                                    <li
                                      key={`${ev.kind}-${ev.date}-${ev.time}-${ev.label}`}
                                      className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
                                    >
                                      <span className="font-medium tabular-nums text-zinc-800">
                                        {ev.date} {ev.time}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-px text-[10px] font-medium ${
                                          isAway
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-[#00287A]/10 text-[#00287A]"
                                        }`}
                                      >
                                        {isAway ? "원정 · 일반예매" : ev.label}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <p className="mb-2 text-[11px] font-medium leading-snug text-[#00287A]">
                    저장하면 티켓 오픈 10분 전에 알림이 울려요 🔔
                  </p>
                  {ticketMatchGroups.length > 0 && selectedTicketGroups.length === 0 ? (
                    <p className="mb-2 text-[11px] text-amber-700">
                      저장할 경기를 선택해 주세요.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSaveTicketing}
                    disabled={selectedTicketEvents.length === 0}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#00287A] bg-[#00287A] px-3 py-2.5 text-xs font-medium text-white transition hover:bg-[#001f5c] disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-500 sm:w-auto sm:px-4"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    {selectedTicketGroups.length > 0
                      ? `선택한 ${selectedTicketGroups.length}경기 티켓 일정 저장`
                      : "티켓 오픈 알림 저장"}
                  </button>

                  <p className="mt-2.5 text-[10px] leading-relaxed text-zinc-500">
                    실제 티켓 오픈 시각은 구단 공지를 꼭 확인하세요. 공지 변경으로 알림 시각이 다를 수 있어요.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && !error ? (
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
              <span className="shrink-0 text-[11px] text-zinc-500">
                {view === "calendar" ? "전체 기간 · 달을 이동해 확인하세요" : "전체 기간 검색"}
              </span>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : view === "calendar" ? (
          <>
            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={`py-1 text-center text-[11px] ${
                    i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-zinc-500"
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map(({ date, inMonth }) => {
                const key = ymd(date);
                const day = dayMap.get(key);
                const isSelected = selectedDate === key;
                const holiday = inMonth ? getHoliday(key) : null;
                const dayMatches = day?.groups.flatMap((g) => g.matches) ?? [];
                const visibleMatches = dayMatches.slice(0, 2);
                const extraCount = Math.max(0, dayMatches.length - 2);
                const hasHyundai = day?.groups.some((g) => g.matches.some(isHyundaiMatch)) ?? false;
                const roundLabel = calendarDayRoundLabel(dayMatches);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => day && setSelectedDate(isSelected ? null : key)}
                    title={holiday ?? undefined}
                    className={`min-h-[3.75rem] rounded-md border p-0.5 text-left align-top text-xs text-zinc-900 sm:min-h-[100px] sm:p-1.5 ${hasHyundai ? "bg-amber-50" : "bg-white"} ${isSelected ? "border-[1.5px] border-[#00287A]" : hasHyundai ? "border-amber-200" : "border-zinc-200"} ${day ? `cursor-pointer ${hasHyundai ? "hover:bg-amber-100/80" : "hover:bg-zinc-50"}` : "cursor-default"}`}
                  >
                    <div className="flex items-start justify-between gap-0.5">
                      <span className={`text-[10px] font-medium leading-none sm:text-[11px] ${calendarDateClass(key, inMonth)}`}>
                        {date.getDate()}
                      </span>
                      {roundLabel ? (
                        <span className="shrink-0 text-[9px] font-medium leading-none text-zinc-400 sm:text-[10px]">
                          {roundLabel}
                        </span>
                      ) : null}
                    </div>
                    {holiday ? (
                      <span className="mt-0.5 hidden truncate text-[7px] leading-tight text-red-400 sm:block">
                        {holiday}
                      </span>
                    ) : null}
                    {/* 모바일: 짧은 팀칩 */}
                    {visibleMatches.length > 0 ? (
                      <div className="mt-0.5 flex flex-col gap-0.5 sm:hidden">
                        {visibleMatches.map((m, j) => (
                          <CalendarMatchShort key={j} m={m} />
                        ))}
                        {extraCount > 0 ? (
                          <span className="truncate text-[9px] font-semibold text-zinc-500">
                            +{extraCount}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {/* 데스크톱: 기존 대회명 + 상세 */}
                    {day?.groups.map((g, i) => {
                      const s = matchBlockStyle(g.category, g.matches);
                      const hasHome = g.matches.some(isHyundaiHomeMatch);
                      return (
                        <div
                          key={i}
                          className="mt-1 hidden rounded px-1 py-1 text-[9px] leading-snug sm:block"
                          style={{ background: s.bg, color: s.text }}
                        >
                          <div className="font-medium leading-tight">
                            {hasHome ? (
                              <Crown className="mr-0.5 inline h-3 w-3 text-amber-400" aria-hidden />
                            ) : null}
                            {g.tournament}
                          </div>
                          <div className="mt-0.5 flex flex-col gap-0.5">
                            {g.matches.map((m, j) => (
                              <div key={j} className="leading-tight">
                                <MatchLine m={m} inheritColor showCrown />
                                {m.url ? (
                                  <div className="mt-0.5">
                                    <BroadcastLink url={m.url} compact />
                                  </div>
                                ) : null}
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

            {!hasCalendarMatchesInMonth ? (
              <p className="mt-3 text-sm text-zinc-500">
                {teamQuery.trim()
                  ? `"${teamQuery.trim()}" 검색 결과가 이번 달에는 없습니다. 다른 달을 확인해 보세요.`
                  : "이번 달 일정이 없습니다."}
              </p>
            ) : null}

            {selectedDay ? (
              <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900">{selectedDay.date} · {selectedDay.totalMatches}경기</span>
                  <button type="button" aria-label="닫기" onClick={() => setSelectedDate(null)} className="text-zinc-500 hover:text-zinc-800"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-2">
                  {selectedDay.groups.map((g, i) => {
                    const s = matchBlockStyle(g.category, g.matches);
                    const hasHyundai = g.matches.some(isHyundaiMatch);
                    return (
                      <div key={i} className={`rounded-lg border px-4 py-3 ${hasHyundai ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
                        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="rounded-full px-2.5 py-0.5 text-[11px]" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                          <span className="text-sm font-medium text-zinc-900">{g.tournament}</span>
                          <span className="text-xs text-zinc-500">· {g.matches.length}경기</span>
                        </div>
                        <button type="button" onClick={() => handleSaveToCalendar(g, selectedDay.date)} className="mb-2 inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-700 transition hover:bg-zinc-100"><CalendarPlus className="h-3 w-3" /> 내 캘린더에 저장</button>
                        <div className="text-xs leading-relaxed text-zinc-700">
                          {g.venue ? (<div className="mb-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {g.venue}{g.matches[0]?.court ? ` ${g.matches[0].court}` : ""}</div>) : null}
                          {g.matches.map((m, j) => (<MatchRow key={j} m={m} />))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : (
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
                      const s = matchBlockStyle(g.category, g.matches);
                      const hasHyundai = g.matches.some(isHyundaiMatch);
                      return (
                        <div key={i} className={`rounded-lg border px-3 py-3 sm:px-4 ${hasHyundai ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
                          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="rounded-full px-2.5 py-0.5 text-[11px]" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                            <span className="text-sm font-medium text-zinc-900">{g.tournament}</span>
                            <span className="text-xs text-zinc-500">· {g.matches.length}경기</span>
                          </div>
                          <button type="button" onClick={() => handleSaveToCalendar(g, day.date)} className="mb-2 inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-700 transition hover:bg-zinc-100"><CalendarPlus className="h-3 w-3" /> 내 캘린더에 저장</button>
                          <div className="text-xs leading-relaxed text-zinc-700">
                            {g.venue ? (<div className="mb-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {g.venue}</div>) : null}
                            {g.matches.map((m, j) => (<MatchRow key={j} m={m} />))}
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
        )}
      </main>
    </div>
  );
}
