"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import {
  displayRecordValue,
  formatPercentDisplay,
  formatRate,
  getLatestSetSuccessCountTotal,
  getLatestTotalPoints,
  getRecordMoments,
  isDidNotPlay,
  isPlayedRecord,
  isPostseasonRecord,
  isSeasonRecord,
  parsePercent,
  type PlayerRecord,
  type RecordMoment,
  type RecordsSheet,
} from "@/lib/records-data";
import { SiteNav } from "@/components/site-nav";
import { PageShareButton } from "@/components/page-share-button";
import { SEASON_STATS, CAREER_TOTAL } from "@/lib/season-summary";
import {
  buildGalleryLinkForRecordDate,
  hasGalleryPhotosForRecordDate,
} from "@/lib/gallery-date-link";

const TABLE_COLUMNS = [
  { key: "date", label: "날짜", className: "whitespace-nowrap text-left" },
  { key: "opponent", label: "상대", className: "min-w-[4.5rem] text-left" },
  { key: "round", label: "라운드", className: "text-center tabular-nums whitespace-nowrap" },
  { key: "points", label: "득점", className: "text-center tabular-nums" },
  { key: "attackSuccess", label: "공격성공", className: "text-center tabular-nums" },
  { key: "serveAce", label: "서브A", className: "text-center tabular-nums" },
  { key: "block", label: "블로킹", className: "text-center tabular-nums" },
  { key: "error", label: "범실", className: "text-center tabular-nums" },
  { key: "setSuccess", label: "세트성공", className: "text-center tabular-nums" },
  { key: "setSuccessRate", label: "세트성공률", className: "text-center tabular-nums whitespace-nowrap" },
  { key: "video", label: "영상", className: "text-center" },
  { key: "note", label: "비고", className: "hidden min-w-[4rem] text-left md:table-cell" },
  { key: "homeAway", label: "홈/원정", className: "text-center whitespace-nowrap" },
] as const;

function buildCountAxis(values: number[], isCumulative: boolean) {
  const nums = values.filter((v) => v !== null && Number.isFinite(v));
  if (!nums.length) {
    return isCumulative
      ? { domain: [7000, 9000] as [number, number], ticks: [7000, 8000, 9000] }
      : { domain: [0, 60] as [number, number], ticks: [0, 15, 30, 45, 60] };
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);

  if (isCumulative) {
    const start = Math.floor(min / 1000) * 1000;
    const end = Math.max(Math.ceil(max / 1000) * 1000, start + 1000);
    const ticks: number[] = [];
    for (let v = start; v <= end; v += 1000) ticks.push(v);
    return { domain: [start, end] as [number, number], ticks };
  }

  const paddedMax = Math.max(10, Math.ceil(max / 5) * 5);
  const step = paddedMax <= 20 ? 5 : paddedMax <= 60 ? 15 : Math.ceil(paddedMax / 4 / 5) * 5;
  const ticks: number[] = [];
  for (let v = 0; v <= paddedMax; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== paddedMax) ticks.push(paddedMax);
  return { domain: [0, paddedMax] as [number, number], ticks };
}

function cellValue(r: PlayerRecord, key: (typeof TABLE_COLUMNS)[number]["key"]): string {
  switch (key) {
    case "date":
      return r.date;
    case "opponent":
      return displayRecordValue(r.opponent);
    case "round":
      return displayRecordValue(r.round);
    case "points":
      return displayRecordValue(r.points);
    case "attackSuccess":
      return displayRecordValue(r.attackSuccess);
    case "serveAce":
      return displayRecordValue(r.serveAce);
    case "block":
      return displayRecordValue(r.block);
    case "error":
      return displayRecordValue(r.error);
    case "setSuccess":
      return displayRecordValue(r.setSuccess);
    case "setSuccessRate":
      return formatRate(r.setSuccessRate);
    case "note":
      return displayRecordValue(r.note);
    case "homeAway":
      return displayRecordValue(r.homeAway);
    default:
      return "-";
  }
}

function momentRowClass(tone: RecordMoment["tone"]): string {
  if (tone === "rose") return "bg-rose-50/80 text-rose-950";
  if (tone === "sky") return "bg-sky-50/80 text-sky-950";
  if (tone === "violet") return "bg-violet-50/80 text-violet-950";
  return "bg-amber-50/80 text-amber-950";
}

function momentBadgeClass(tone: RecordMoment["tone"]): string {
  if (tone === "rose") return "bg-rose-100 text-rose-900 ring-rose-200/80";
  if (tone === "sky") return "bg-sky-100 text-sky-900 ring-sky-200/80";
  if (tone === "violet") return "bg-violet-100 text-violet-900 ring-violet-200/80";
  return "bg-amber-100 text-amber-900 ring-amber-200/80";
}

const SET_AVG_AXIS = {
  domain: [0, 20] as [number, number],
  ticks: [5, 10, 15, 20],
};

type ChartSeriesKey = "rate" | "count" | "avg";

const DEFAULT_CHART_VISIBLE: Record<ChartSeriesKey, boolean> = {
  rate: true,
  count: false,
  avg: true,
};

function ChartLegendToggle({
  label,
  color,
  active,
  onToggle,
}: {
  label: string;
  color: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] transition sm:text-[11px] ${
        active ? "text-zinc-700 hover:bg-zinc-100" : "text-zinc-300 line-through opacity-70 hover:bg-zinc-50"
      }`}
    >
      <span
        className="h-0.5 w-4 rounded sm:h-1"
        style={{ backgroundColor: active ? color : "#d4d4d8" }}
        aria-hidden
      />
      {label}
    </button>
  );
}

export default function RecordsPage() {
  const router = useRouter();
  const [sheets, setSheets] = useState<RecordsSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [recordScope, setRecordScope] = useState<"season" | "postseason">("season");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [seasonDetailsOpen, setSeasonDetailsOpen] = useState(false);
  const [chartVisible, setChartVisible] = useState(DEFAULT_CHART_VISIBLE);
  const [galleryDateKeys, setGalleryDateKeys] = useState<Set<number>>(() => new Set());

  const toggleChartSeries = (key: ChartSeriesKey) => {
    setChartVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/gallery-date-keys")
      .then((res) => res.json())
      .then((data: { dateKeys?: number[] }) => {
        if (!mounted || !Array.isArray(data.dateKeys)) return;
        setGalleryDateKeys(new Set(data.dateKeys));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/records")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data?.sheets)) {
          setSheets(data.sheets);
          setActiveSheetId(data.sheets[0]?.id ?? "");
        } else if (Array.isArray(data)) {
          setSheets([{ id: "default", name: "전체", records: data }]);
          setActiveSheetId("default");
        } else {
          setError(data?.error ?? "불러오기 실패");
        }
      })
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setTeamFilter("all");
  }, [activeSheetId, recordScope]);

  const rawSheetRecords = useMemo(
    () => sheets.find((sheet) => sheet.id === activeSheetId)?.records ?? [],
    [sheets, activeSheetId]
  );

  const sheetRecords = useMemo(() => {
    if (recordScope === "postseason") {
      return rawSheetRecords.filter(isPostseasonRecord);
    }
    return rawSheetRecords.filter(isSeasonRecord);
  }, [rawSheetRecords, recordScope]);

  /** RECORDS_SHEETS 첫 탭 = 현재 시즌. 헤더 누적 수치는 탭과 무관하게 항상 정규시즌 기준 */
  const currentSeasonRecords = useMemo(
    () => (sheets[0]?.records ?? []).filter(isSeasonRecord),
    [sheets]
  );

  const teamOptions = useMemo(() => {
    const teams = new Set<string>();
    for (const r of sheetRecords) {
      if (r.opponent.trim()) teams.add(r.opponent.trim());
    }
    return Array.from(teams).sort((a, b) => a.localeCompare(b, "ko"));
  }, [sheetRecords]);

  const filteredRecords = useMemo(() => {
    if (teamFilter === "all") return sheetRecords;
    return sheetRecords.filter((r) => r.opponent === teamFilter);
  }, [sheetRecords, teamFilter]);

  const playedRecords = useMemo(() => filteredRecords.filter(isPlayedRecord), [filteredRecords]);

  const isAllTeams = teamFilter === "all";
  const showCountAxis = isAllTeams && chartVisible.count;
  const showAvgAxis = chartVisible.avg;
  const showRateAxis = chartVisible.rate;

  const chartData = useMemo(
    () =>
      playedRecords.map((r) => ({
        date: r.date.slice(5),
        세트성공률: parsePercent(r.setSuccessRate),
        세트당평균: r.setAvg,
        ...(isAllTeams ? { 세트성공수: r.setSuccessCountTotal } : {}),
      })),
    [playedRecords, isAllTeams]
  );

  const countAxis = useMemo(() => {
    if (!isAllTeams) return null;
    const values = playedRecords
      .map((r) => r.setSuccessCountTotal)
      .filter((v): v is number => v !== null);
    return buildCountAxis(values, true);
  }, [playedRecords, isAllTeams]);

  const totals = useMemo(() => {
    const sum = (key: "points" | "serveAce" | "block" | "setSuccessCount") =>
      playedRecords.reduce((acc, r) => acc + (r[key] ?? 0), 0);

    let madeSum = 0;
    let attemptsSum = 0;
    for (const r of playedRecords) {
      const made = r.setSuccessCount ?? 0;
      const att = r.setAttempts ?? 0;
      if (att > 0) {
        madeSum += made;
        attemptsSum += att;
      }
    }
    const weightedRate = attemptsSum > 0 ? (madeSum / attemptsSum) * 100 : null;

    return {
      games: playedRecords.length,
      points: sum("points"),
      serveAce: sum("serveAce"),
      block: sum("block"),
      setSuccessCount: sum("setSuccessCount"),
      setSuccessRate: weightedRate,
      setMadeSum: madeSum,
      setAttemptsSum: attemptsSum,
    };
  }, [playedRecords]);

  const summaryCards = useMemo(() => {
    const rateDisplay =
      totals.setSuccessRate == null ? "-" : formatPercentDisplay(totals.setSuccessRate);
    const rateSubLabel =
      totals.setAttemptsSum > 0
        ? `성공 ${totals.setMadeSum.toLocaleString("ko-KR")} / 시도 ${totals.setAttemptsSum.toLocaleString("ko-KR")}`
        : undefined;

    return isAllTeams
      ? [
          { label: "경기", value: totals.games },
          { label: "총 득점", value: totals.points },
          { label: "서브에이스", value: totals.serveAce },
          { label: "세트성공수", value: totals.setSuccessCount },
          { label: "세트성공률", value: rateDisplay, subLabel: rateSubLabel },
        ]
      : [
          { label: "총 득점", value: totals.points },
          { label: "서브에이스", value: totals.serveAce },
          { label: "블로킹", value: totals.block },
          { label: "세트성공수", value: totals.setSuccessCount },
          { label: "세트성공률", value: rateDisplay, subLabel: rateSubLabel },
        ];
  }, [isAllTeams, totals]);

  const xAxisInterval = useMemo(() => {
    if (chartData.length <= 6) return 0;
    if (isMobile) return "preserveStartEnd" as const;
    if (chartData.length <= 12) return 0;
    return Math.ceil(chartData.length / 8) - 1;
  }, [chartData.length, isMobile]);

  const chartAxisTick = {
    fontSize: isMobile ? 11 : 12,
    fill: "#18181b",
    fontWeight: 500,
  } as const;

  const rateTicks = isMobile ? [0, 30, 60] : [0, 15, 30, 45, 60];
  const countTicks = useMemo(() => {
    if (!countAxis) return [];
    if (!isMobile) return countAxis.ticks;
    return countAxis.ticks.filter((_, i) => i % 2 === 0 || i === countAxis.ticks.length - 1);
  }, [countAxis, isMobile]);

  const formatCountTick = (v: number) => {
    if (isMobile && v >= 1000) return `${Math.round(v / 1000)}k`;
    return Number(v).toLocaleString("ko-KR");
  };

  const formatAvgTick = (v: number) => {
    const n = Number(v);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };

  const currentSetSuccessCount = useMemo(
    () => getLatestSetSuccessCountTotal(currentSeasonRecords),
    [currentSeasonRecords]
  );

  const currentTotalPoints = useMemo(
    () => getLatestTotalPoints(currentSeasonRecords),
    [currentSeasonRecords]
  );

  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
      <SiteNav />
      <header className="mx-auto flex max-w-[1100px] items-start justify-between gap-4 px-4 py-5 sm:items-center sm:px-8 sm:py-6">
        <div className="min-w-0">
          <p className="text-xs tracking-widest text-zinc-500 uppercase">voto gallery</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="text-lg font-medium tracking-wide text-zinc-900">경기 기록</h1>
            {!loading && (currentSetSuccessCount != null || currentTotalPoints != null) ? (
              <span className="text-sm font-semibold text-[#00287A]">
                {currentSetSuccessCount != null ? (
                  <>세트 성공수 {currentSetSuccessCount.toLocaleString("ko-KR")}</>
                ) : null}
                {currentSetSuccessCount != null && currentTotalPoints != null ? (
                  <span className="mx-1.5 font-normal text-zinc-300">·</span>
                ) : null}
                {currentTotalPoints != null ? (
                  <>총 득점 {currentTotalPoints.toLocaleString("ko-KR")}</>
                ) : null}
                <span className="ml-1 text-[11px] font-normal text-zinc-500">(현재 기준)</span>
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">No.3 김다인 · 경기별 기록 아카이브</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PageShareButton shareTitle="voto gallery — 김다인 경기 기록" />
          <button type="button" onClick={() => router.push("/")} className="rounded-full border border-zinc-200 px-4 py-2 text-xs text-zinc-700 transition hover:bg-zinc-50">← Gallery</button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 pb-20 sm:px-8 sm:pb-0">
        <section className="mb-10">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">통산 누적</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "경기", value: CAREER_TOTAL.games },
                  { label: "득점", value: CAREER_TOTAL.points },
                  { label: "세트당 평균", value: CAREER_TOTAL.set.toFixed(2) },
                  { label: "세트 성공률", value: `${CAREER_TOTAL.setSuccessRate}%` },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-xl font-semibold text-[#00287A]">{s.value}</div>
                    <div className="text-[11px] text-zinc-400">{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-zinc-400">
                세트 성공 {CAREER_TOTAL.setSuccess} / 시도 {CAREER_TOTAL.setAttempts} · 디그 성공률 {CAREER_TOTAL.digSuccessRate}%
              </p>
              <button
                type="button"
                onClick={() => setSeasonDetailsOpen((open) => !open)}
                aria-expanded={seasonDetailsOpen}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                {seasonDetailsOpen ? "접기" : "자세히 보기"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${seasonDetailsOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                seasonDetailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-4 border-t border-zinc-200 p-4">
                  <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">시즌별 추이</p>
                    {seasonDetailsOpen ? (
                      <div style={{ width: "100%", height: 260 }}>
                        <ResponsiveContainer>
                          <LineChart data={[...SEASON_STATS].reverse()} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="season" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(2)} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="set" name="세트당 평균" stroke="#00287A" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="points" name="득점" stroke="#C2410C" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : null}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                    <table className="w-full min-w-[560px] text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                          <th className="px-3 py-2 text-left font-medium">시즌</th>
                          <th className="px-3 py-2 text-right font-medium">경기</th>
                          <th className="px-3 py-2 text-right font-medium">득점</th>
                          <th className="px-3 py-2 text-right font-medium">공격성공률</th>
                          <th className="px-3 py-2 text-right font-medium">세트당</th>
                          <th className="px-3 py-2 text-right font-medium">디그</th>
                          <th className="px-3 py-2 text-right font-medium">범실</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SEASON_STATS.map((s) => (
                          <tr key={s.season} className="border-b border-zinc-100 last:border-0">
                            <td className="px-3 py-2 text-left font-medium text-zinc-800">{s.season}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.games}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.points}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.attackSuccess ? `${s.attackSuccess}%` : "-"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.set.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.dig.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.errors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : sheets.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 기록이 없습니다.</p>
        ) : (
          <>
            {sheets.length > 1 ? (
              <div className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {sheets.map((sheet) => {
                  const active = activeSheetId === sheet.id;
                  return (
                    <button
                      key={sheet.id}
                      type="button"
                      onClick={() => setActiveSheetId(sheet.id)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${active ? "bg-[#00287A] text-white" : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}
                    >
                      {sheet.name}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {filteredRecords.length === 0 ? (
              <p className="text-sm text-zinc-500">선택한 조건의 기록이 없습니다.</p>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {summaryCards.map((s) => (
                    <div key={s.label} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-center">
                      <div className="text-lg font-semibold text-[#00287A]">{s.value}</div>
                      <div className="text-[11px] text-zinc-500">{s.label}</div>
                      {"subLabel" in s && s.subLabel ? (
                        <p className="mt-0.5 text-[10px] tabular-nums text-zinc-400">{s.subLabel}</p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="-mx-1 mb-8 rounded-xl border border-zinc-200 bg-white p-3 sm:mx-0 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">경기별 추이</p>
                    <div className="flex flex-wrap justify-end gap-1 sm:gap-2">
                      <ChartLegendToggle
                        label="세트성공률"
                        color="#00287A"
                        active={chartVisible.rate}
                        onToggle={() => toggleChartSeries("rate")}
                      />
                      {isAllTeams ? (
                        <ChartLegendToggle
                          label="세트성공수"
                          color="#0E7490"
                          active={chartVisible.count}
                          onToggle={() => toggleChartSeries("count")}
                        />
                      ) : null}
                      <ChartLegendToggle
                        label="세트당 평균"
                        color="#9333EA"
                        active={chartVisible.avg}
                        onToggle={() => toggleChartSeries("avg")}
                      />
                    </div>
                  </div>
                  <div className="h-[min(72vw,22rem)] min-h-[17.5rem] sm:h-64 sm:min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={
                          isMobile
                            ? {
                                top: 12,
                                right: showCountAxis ? 8 : 4,
                                left: -4,
                                bottom: chartData.length > 6 ? 36 : 16,
                              }
                            : {
                                top: 8,
                                right: showCountAxis ? 20 : 16,
                                left: 8,
                                bottom: chartData.length > 10 ? 24 : 12,
                              }
                        }
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={chartAxisTick}
                          axisLine={{ stroke: "#d4d4d8" }}
                          tickLine={{ stroke: "#a1a1aa" }}
                          interval={xAxisInterval}
                          minTickGap={isMobile ? 14 : 10}
                          angle={isMobile && chartData.length > 6 ? -40 : chartData.length > 12 ? -35 : 0}
                          textAnchor={isMobile && chartData.length > 6 ? "end" : chartData.length > 12 ? "end" : "middle"}
                          height={isMobile && chartData.length > 6 ? 52 : chartData.length > 12 ? 48 : 32}
                          dy={isMobile && chartData.length > 6 ? 2 : 0}
                        />
                        <YAxis
                          yAxisId="rate"
                          hide={!showRateAxis}
                          width={isMobile ? 40 : 48}
                          domain={[0, 60]}
                          ticks={rateTicks}
                          tick={chartAxisTick}
                          axisLine={{ stroke: "#d4d4d8" }}
                          tickLine={{ stroke: "#a1a1aa" }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          yAxisId="count"
                          orientation="right"
                          hide={!showCountAxis}
                          width={isMobile ? 40 : 48}
                          domain={countAxis?.domain ?? [0, 1]}
                          ticks={countTicks}
                          tick={chartAxisTick}
                          axisLine={{ stroke: "#d4d4d8" }}
                          tickLine={{ stroke: "#a1a1aa" }}
                          tickFormatter={formatCountTick}
                        />
                        <YAxis
                          yAxisId="avg"
                          orientation="right"
                          hide={!showAvgAxis}
                          width={isMobile ? 36 : 44}
                          domain={SET_AVG_AXIS.domain}
                          ticks={SET_AVG_AXIS.ticks}
                          tick={{ ...chartAxisTick, fill: "#7E22CE" }}
                          axisLine={{ stroke: "#d4d4d8" }}
                          tickLine={{ stroke: "#a1a1aa" }}
                          tickFormatter={formatAvgTick}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: isMobile ? 12 : 13, borderRadius: 8 }}
                          formatter={(value, name) => {
                            if (name === "세트성공률") {
                              return [
                                typeof value === "number" ? formatPercentDisplay(value) : "-",
                                name,
                              ];
                            }
                            if (name === "세트당평균") {
                              return [
                                typeof value === "number" ? value.toFixed(2) : "-",
                                "세트당 평균",
                              ];
                            }
                            if (name === "세트평균") return [value ?? "-", "세트당 평균"];
                            return [typeof value === "number" ? value.toLocaleString("ko-KR") : value ?? "-", name];
                          }}
                        />
                        {chartVisible.rate ? (
                          <Line
                            yAxisId="rate"
                            type="monotone"
                            dataKey="세트성공률"
                            stroke="#00287A"
                            strokeWidth={isMobile ? 2.5 : 2}
                            dot={{ r: isMobile ? 4 : 3, strokeWidth: 1.5 }}
                            activeDot={{ r: isMobile ? 6 : 5 }}
                          />
                        ) : null}
                        {isAllTeams && chartVisible.count ? (
                          <Line
                            yAxisId="count"
                            type="monotone"
                            dataKey="세트성공수"
                            stroke="#0E7490"
                            strokeWidth={isMobile ? 2.5 : 2}
                            dot={{ r: isMobile ? 4 : 3, strokeWidth: 1.5 }}
                            activeDot={{ r: isMobile ? 6 : 5 }}
                          />
                        ) : null}
                        {chartVisible.avg ? (
                          <Line
                            yAxisId="avg"
                            type="monotone"
                            dataKey="세트당평균"
                            name="세트당 평균"
                            stroke="#9333EA"
                            strokeWidth={isMobile ? 2.5 : 2}
                            dot={{ r: isMobile ? 4 : 3, strokeWidth: 1.5, fill: "#9333EA" }}
                            activeDot={{ r: isMobile ? 6 : 5 }}
                          />
                        ) : null}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-zinc-500">팀 필터</span>
                  <button
                    type="button"
                    onClick={() => setTeamFilter("all")}
                    className={`rounded-full px-3 py-1 text-xs transition ${teamFilter === "all" ? "bg-[#00287A] text-white" : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}
                  >
                    전체
                  </button>
                  {teamOptions.map((team) => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setTeamFilter(team)}
                      className={`rounded-full px-3 py-1 text-xs transition ${teamFilter === team ? "bg-[#00287A] text-white" : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}
                    >
                      {team}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRecordScope((s) => (s === "postseason" ? "season" : "postseason"))}
                    className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                      recordScope === "postseason"
                        ? "bg-[#C2410C] text-white"
                        : "border border-[#C2410C]/35 bg-[#FFF7ED] text-[#C2410C] hover:bg-[#FFEDD5]"
                    }`}
                  >
                    포스트시즌
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[54rem] border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                          {TABLE_COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              scope="col"
                              className={`px-2.5 py-2.5 font-medium first:pl-3 last:pr-3 ${col.className}`}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredRecords].reverse().map((r, i) => {
                          const didNotPlay = isDidNotPlay(r);
                          const moments = getRecordMoments(r);
                          return (
                            <tr
                              key={`${r.date}-${r.opponent}-${i}`}
                              className={`border-b border-zinc-100 last:border-b-0 ${
                                moments.length > 0
                                  ? momentRowClass(moments[0].tone)
                                  : didNotPlay
                                    ? "bg-zinc-50/80 text-zinc-500"
                                    : "text-zinc-800"
                              }`}
                            >
                              {TABLE_COLUMNS.map((col) => {
                                if (col.key === "video") {
                                  return (
                                    <td key={col.key} className={`px-2.5 py-2 align-middle ${col.className}`}>
                                      {r.videoUrl ? (
                                        <a
                                          href={r.videoUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-0.5 rounded-full bg-[#00287A] px-2 py-0.5 text-[10px] text-white transition hover:opacity-90"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          <span className="hidden sm:inline">보기</span>
                                        </a>
                                      ) : (
                                        <span className="text-zinc-400">-</span>
                                      )}
                                    </td>
                                  );
                                }

                                const value = cellValue(r, col.key);
                                return (
                                  <td
                                    key={col.key}
                                    className={`px-2.5 py-2 align-middle first:pl-3 last:pr-3 ${col.className}`}
                                  >
                                    {col.key === "date" ? (
                                      <div className="space-y-1">
                                        {hasGalleryPhotosForRecordDate(galleryDateKeys, r.date) ? (
                                          <Link
                                            href={buildGalleryLinkForRecordDate(r.date)}
                                            className="font-medium text-[#00287A] underline-offset-2 hover:underline"
                                            title="갤러리에서 이 날짜 사진 보기"
                                          >
                                            {value}
                                          </Link>
                                        ) : (
                                          <span className="font-medium">{value}</span>
                                        )}
                                        {moments.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {moments.map((moment) => (
                                              <span
                                                key={moment.label}
                                                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${momentBadgeClass(moment.tone)}`}
                                              >
                                                <span aria-hidden>{moment.emoji}</span>
                                                {moment.label}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : col.key === "homeAway" && value !== "-" ? (
                                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${value === "홈" ? "bg-[#E6F1FB] text-[#0C447C]" : value === "원정" ? "bg-[#F1EFE8] text-zinc-700" : "bg-zinc-100 text-zinc-600"}`}>
                                        {value}
                                      </span>
                                    ) : (
                                      value
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
