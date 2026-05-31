"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  averagePercent,
  displayRecordValue,
  formatRate,
  getLatestSetSuccessCountTotal,
  getRecordMoments,
  isPlayedRecord,
  parsePercent,
  type PlayerRecord,
  type RecordMoment,
  type RecordsSheet,
} from "@/lib/records-data";

const TABLE_COLUMNS = [
  { key: "date", label: "날짜", className: "whitespace-nowrap text-left" },
  { key: "opponent", label: "상대", className: "min-w-[4.5rem] text-left" },
  { key: "competition", label: "대회", className: "hidden min-w-[5rem] text-left sm:table-cell" },
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
    case "competition":
      return displayRecordValue(r.competition);
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

export default function RecordsPage() {
  const router = useRouter();
  const [sheets, setSheets] = useState<RecordsSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
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
  }, [activeSheetId]);

  const sheetRecords = useMemo(
    () => sheets.find((sheet) => sheet.id === activeSheetId)?.records ?? [],
    [sheets, activeSheetId]
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
  const chartSecondaryKey = isAllTeams ? "세트성공수" : "세트평균";

  const chartData = useMemo(
    () =>
      playedRecords.map((r) => ({
        date: r.date.slice(5),
        세트성공률: parsePercent(r.setSuccessRate),
        [chartSecondaryKey]: isAllTeams ? r.setSuccessCountTotal : r.setAvg,
      })),
    [playedRecords, isAllTeams, chartSecondaryKey]
  );

  const countAxis = useMemo(() => {
    const values = playedRecords.map((r) => (isAllTeams ? r.setSuccessCountTotal : r.setAvg));
    return buildCountAxis(
      values.filter((v): v is number => v !== null),
      isAllTeams
    );
  }, [playedRecords, isAllTeams]);

  const totals = useMemo(() => {
    const sum = (key: "points" | "serveAce" | "block" | "setSuccessCount") =>
      playedRecords.reduce((acc, r) => acc + (r[key] ?? 0), 0);
    return {
      games: playedRecords.length,
      points: sum("points"),
      serveAce: sum("serveAce"),
      block: sum("block"),
      setSuccessCount: sum("setSuccessCount"),
      setSuccessRate: averagePercent(playedRecords.map((r) => r.setSuccessRate)),
    };
  }, [playedRecords]);

  const summaryCards = useMemo(
    () =>
      isAllTeams
        ? [
            { label: "경기", value: totals.games },
            { label: "총 득점", value: totals.points },
            { label: "서브에이스", value: totals.serveAce },
            { label: "세트성공수", value: totals.setSuccessCount },
            { label: "세트성공률", value: totals.setSuccessRate },
          ]
        : [
            { label: "총 득점", value: totals.points },
            { label: "서브에이스", value: totals.serveAce },
            { label: "블로킹", value: totals.block },
            { label: "세트성공수", value: totals.setSuccessCount },
            { label: "세트성공률", value: totals.setSuccessRate },
          ],
    [isAllTeams, totals]
  );

  const rateTicks = isMobile ? [0, 30, 60] : [0, 15, 30, 45, 60];
  const countTicks = useMemo(() => {
    if (!isMobile) return countAxis.ticks;
    if (isAllTeams) return countAxis.ticks.filter((_, i) => i % 2 === 0 || i === countAxis.ticks.length - 1);
    const max = Math.max(...countAxis.ticks);
    if (max <= 20) return countAxis.ticks.filter((v) => v % 5 === 0 || v === max);
    return countAxis.ticks.filter((_, i) => i % 2 === 0 || i === countAxis.ticks.length - 1);
  }, [countAxis.ticks, isMobile, isAllTeams]);

  const formatCountTick = (v: number) => {
    if (isAllTeams && isMobile && v >= 1000) return `${Math.round(v / 1000)}k`;
    return Number(v).toLocaleString("ko-KR");
  };

  const currentSetSuccessCount = useMemo(
    () => getLatestSetSuccessCountTotal(sheetRecords),
    [sheetRecords]
  );

  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
      <header className="mx-auto flex max-w-[1100px] items-start justify-between gap-4 px-4 py-5 sm:items-center sm:px-8 sm:py-6">
        <div className="min-w-0">
          <p className="text-xs tracking-widest text-zinc-500 uppercase">voto gallery</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="text-lg font-medium tracking-wide text-zinc-900">경기 기록</h1>
            {!loading && currentSetSuccessCount != null ? (
              <span className="text-sm font-semibold text-[#00287A]">
                세트 성공수 {currentSetSuccessCount.toLocaleString("ko-KR")}
                <span className="ml-1 text-[11px] font-normal text-zinc-500">(현재 기준)</span>
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">No.3 김다인 · 경기별 기록 아카이브</p>
        </div>
        <button type="button" onClick={() => router.push("/")} className="shrink-0 rounded-full border border-zinc-200 px-4 py-2 text-xs text-zinc-700 transition hover:bg-zinc-50">← Gallery</button>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-8">
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
                    </div>
                  ))}
                </div>

                <div className="-mx-1 mb-8 rounded-xl border border-zinc-200 bg-white p-3 sm:mx-0 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">경기별 추이</p>
                    <div className="flex flex-wrap gap-3 text-[10px] text-zinc-600 sm:text-[11px]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-0.5 w-4 rounded bg-[#00287A] sm:h-1" aria-hidden />
                        세트성공률
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-0.5 w-4 rounded bg-[#0E7490] sm:h-1" aria-hidden />
                        {isAllTeams ? "세트성공수" : "세트평균"}
                      </span>
                    </div>
                  </div>
                  <div className="h-[min(72vw,22rem)] min-h-[17.5rem] sm:h-64 sm:min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={
                          isMobile
                            ? { top: 12, right: 4, left: -8, bottom: chartData.length > 6 ? 28 : 8 }
                            : { top: 5, right: 16, left: 4, bottom: 5 }
                        }
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: isMobile ? 10 : 11, fill: "#52525b" }}
                          interval={isMobile && chartData.length > 5 ? "preserveStartEnd" : 0}
                          angle={isMobile && chartData.length > 5 ? -35 : 0}
                          textAnchor={isMobile && chartData.length > 5 ? "end" : "middle"}
                          height={isMobile && chartData.length > 5 ? 48 : 30}
                        />
                        <YAxis
                          yAxisId="rate"
                          width={isMobile ? 36 : 44}
                          domain={[0, 60]}
                          ticks={rateTicks}
                          tick={{ fontSize: isMobile ? 10 : 11, fill: "#00287A" }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          yAxisId="count"
                          orientation="right"
                          width={isMobile ? 32 : 48}
                          domain={countAxis.domain}
                          ticks={countTicks}
                          tick={{ fontSize: isMobile ? 10 : 11, fill: "#0E7490" }}
                          tickFormatter={formatCountTick}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: isMobile ? 12 : 13, borderRadius: 8 }}
                          formatter={(value, name) => {
                            if (name === "세트성공률") return [`${value ?? "-"}%`, name];
                            if (name === "세트평균") return [value ?? "-", "세트당 평균"];
                            return [typeof value === "number" ? value.toLocaleString("ko-KR") : value ?? "-", name];
                          }}
                        />
                        <Line
                          yAxisId="rate"
                          type="monotone"
                          dataKey="세트성공률"
                          stroke="#00287A"
                          strokeWidth={isMobile ? 2.5 : 2}
                          dot={{ r: isMobile ? 4 : 3, strokeWidth: 1.5 }}
                          activeDot={{ r: isMobile ? 6 : 5 }}
                        />
                        <Line
                          yAxisId="count"
                          type="monotone"
                          dataKey={chartSecondaryKey}
                          stroke="#0E7490"
                          strokeWidth={isMobile ? 2.5 : 2}
                          dot={{ r: isMobile ? 4 : 3, strokeWidth: 1.5 }}
                          activeDot={{ r: isMobile ? 6 : 5 }}
                        />
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
                          const didNotPlay = !isPlayedRecord(r);
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
                                        <span className="font-medium text-zinc-900">{value}</span>
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
                                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${value === "홈" ? "bg-[#E6F1FB] text-[#0C447C]" : "bg-[#F1EFE8] text-zinc-700"}`}>
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
