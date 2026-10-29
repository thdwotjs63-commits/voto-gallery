"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Camera, ClipboardPaste, Copy, Download, Plus, Share2, Trash2, Upload, UserRound } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { PageShareButton } from "@/components/page-share-button";
import {
  PLAYERS_ROSTER,
  TIER_TEAMS,
  findRosterPlayer,
  rosterPlayerUrl,
  type TierTeamId,
} from "@/lib/players-roster";
import { chipTextColor } from "@/lib/vleague-teams";
import {
  TIER_PARTICIPANT_MAX,
  TIER_PARTICIPANT_MIN,
  TIER_TITLE_KINDS,
  chartTitle,
  createEmptyParticipant,
  downloadTierChartPng,
  fanTeamColor,
  renderTierChartCanvas,
  revokeBlobUrl,
  revokeParticipantBlobs,
  tierCreditLabel,
  type TierParticipantDraft,
  type TierTitleKind,
} from "@/lib/tier-chart";
import {
  applyShareToParticipant,
  buildTierAddUrl,
  nicknamesEqual,
  parseTierShareInput,
  sharePayloadFromParticipant,
} from "@/lib/tier-share";
import { upsertTierSubmissions } from "@/lib/tier-submissions";

function shortTeamLabel(label: string): string {
  if (label === "한국도로공사") return "도로공사";
  if (label === "IBK기업은행") return "IBK";
  if (label === "GS칼텍스") return "GS";
  return label;
}

function AvatarCircle({
  url,
  nickname,
  fanTeam,
  sizeClass = "h-20 w-20",
  textClass = "text-base",
  ringWidth = 5,
  dashed,
}: {
  url: string | null;
  nickname: string;
  fanTeam: TierTeamId | null;
  sizeClass?: string;
  textClass?: string;
  ringWidth?: number;
  dashed?: boolean;
}) {
  const ring = fanTeamColor(fanTeam);
  const initial = (nickname.trim() || "?").slice(0, 1);
  const borderWidth = ring ? ringWidth : dashed ? 2 : 2;
  const style: CSSProperties = {
    borderWidth,
    borderStyle: ring ? "solid" : dashed ? "dashed" : "solid",
    borderColor: ring ?? (dashed ? "#d4d4d8" : "#e4e4e7"),
    background: !url && ring ? ring : undefined,
    color: !url && ring ? chipTextColor(ring) : undefined,
  };

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ${sizeClass} ${
        !url && !ring ? "bg-zinc-200 text-zinc-500" : ""
      }`}
      style={style}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`font-semibold ${textClass}`}>{initial}</span>
      )}
    </div>
  );
}

function ProfilePicker({
  url,
  nickname,
  fanTeam,
  onChange,
}: {
  url: string | null;
  nickname: string;
  fanTeam: TierTeamId | null;
  onChange: (nextUrl: string | null) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const applyFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const objectUrl = URL.createObjectURL(file);
    onChange(objectUrl);
  };

  return (
    <div className="flex items-center gap-3">
      {/* label + 투명 file input이 원 전체를 히트박스로 덮음 (display:none 프로그래밍 클릭 회피) */}
      <label
        className={`relative block h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full transition ${
          dragging ? "ring-2 ring-[#00287A]/40 ring-offset-2" : ""
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          applyFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <span className="pointer-events-none block h-full w-full" aria-hidden>
          {url || fanTeam ? (
            <AvatarCircle url={url} nickname={nickname} fanTeam={fanTeam} />
          ) : (
            <span className="flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-400">
              <UserRound className="h-6 w-6" />
              <Upload className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          aria-label="프로필 사진 업로드"
          onChange={(e) => {
            applyFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-zinc-500">
          {nickname.trim() || "닉네임"} · 탭하거나 사진을 끌어다 놓아요
        </p>
        {url ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mt-1 text-[11px] text-zinc-500 underline-offset-2 hover:underline"
          >
            사진 지우기
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 각 참가자 행 전용 링크 붙여넣기 — 그 행만 채움 */
function RowLinkPaste({
  participantId,
  onFill,
}: {
  participantId: string;
  onFill: (participantId: string, raw: string) => string | null;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const run = (raw: string) => {
    const msg = onFill(participantId, raw);
    if (msg) {
      setError(msg);
      setOkMsg(null);
      return;
    }
    setError(null);
    setOkMsg("이 칸에 반영했어요.");
    setValue("");
  };

  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-2.5 py-2">
      <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-zinc-500">
        <ClipboardPaste className="h-3 w-3" aria-hidden />
        링크 붙여넣기
      </p>
      <p className="mb-1.5 text-[10px] leading-relaxed text-zinc-400">
        친구 링크를 넣으면 이 칸만 채워져요 (사진은 응원팀 색)
      </p>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
            if (okMsg) setOkMsg(null);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!text.trim()) return;
            e.preventDefault();
            setValue(text);
            window.setTimeout(() => run(text), 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run(value);
            }
          }}
          placeholder="링크 또는 코드"
          className={`min-h-9 min-w-0 flex-1 rounded-md border bg-white px-2 py-1.5 text-[11px] outline-none focus:border-[#00287A] ${
            error ? "border-amber-500" : "border-zinc-200"
          }`}
          aria-label="이 참가자에 친구 취향 링크 붙여넣기"
        />
        <button
          type="button"
          onClick={() => run(value)}
          className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-zinc-200 bg-white px-2.5 text-[11px] font-medium text-[#00287A] hover:bg-[#00287A]/5"
        >
          적용
        </button>
      </div>
      {error ? <p className="mt-1 text-[10px] font-medium text-amber-700">{error}</p> : null}
      {okMsg ? <p className="mt-1 text-[10px] font-medium text-[#00287A]">{okMsg}</p> : null}
    </div>
  );
}

/** 선수 선택 후 공식 사진 → 직찍/셀카 교체 (참가자×구단 독립) */
function PickPhotoSlot({
  officialUrl,
  customUrl,
  playerLabel,
  onChange,
}: {
  officialUrl: string;
  customUrl: string | null;
  playerLabel: string;
  onChange: (nextUrl: string | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const src = customUrl || officialUrl;

  const applyFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    onChange(URL.createObjectURL(file));
  };

  return (
    <div className="mt-1.5">
      <label
        className={`relative block aspect-[3/4] w-full max-w-[7.5rem] cursor-pointer overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition ${
          dragging ? "ring-2 ring-[#00287A]/40" : ""
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          applyFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={playerLabel}
          className="pointer-events-none h-full w-full object-cover object-top"
          draggable={false}
        />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-sm">
          <Camera className="h-3.5 w-3.5" aria-hidden />
        </span>
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          aria-label={`${playerLabel} 사진 교체`}
          onChange={(e) => {
            applyFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
        사진 교체
      </p>
      {customUrl ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-0.5 text-[10px] font-medium text-[#00287A] underline-offset-2 hover:underline"
        >
          공식 사진으로 되돌리기
        </button>
      ) : null}
    </div>
  );
}

function PreviewCell({
  teamId,
  jerseyNo,
  customUrl,
}: {
  teamId: TierTeamId;
  jerseyNo: number | null | undefined;
  customUrl?: string | null;
}) {
  if (jerseyNo == null) {
    return (
      <div className="flex h-full min-h-[6.5rem] items-center justify-center bg-zinc-100 text-sm font-semibold text-zinc-400">
        텅
      </div>
    );
  }
  const player = findRosterPlayer(teamId, jerseyNo);
  if (!player) {
    return (
      <div className="flex h-full min-h-[6.5rem] items-center justify-center bg-zinc-100 text-sm font-semibold text-zinc-400">
        텅
      </div>
    );
  }
  return (
    <div className="relative flex h-full min-h-[6.5rem] flex-col overflow-hidden bg-zinc-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={customUrl || rosterPlayerUrl(teamId, player)}
        alt={`${player.no} ${player.name}`}
        loading="lazy"
        decoding="async"
        className="aspect-[3/4] w-full flex-1 object-cover object-top"
      />
      {customUrl ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white">
          <Camera className="h-2.5 w-2.5" aria-hidden />
        </span>
      ) : null}
      <p className="truncate px-0.5 py-0.5 text-center text-[9px] text-zinc-700">
        {player.name}
      </p>
    </div>
  );
}

export default function TierPage() {
  const router = useRouter();
  const [titleKind, setTitleKind] = useState<TierTitleKind>("취향표");
  const [twitterId, setTwitterId] = useState("");
  const [participants, setParticipants] = useState<TierParticipantDraft[]>(() => [
    createEmptyParticipant(1),
  ]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const title = useMemo(() => chartTitle(titleKind), [titleKind]);
  const handleLabel = useMemo(() => tierCreditLabel(twitterId), [twitterId]);

  const updateParticipant = useCallback(
    (id: string, patch: Partial<TierParticipantDraft>) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const setPick = useCallback((id: string, teamId: TierTeamId, value: string) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p.picks };
        const nextPhotos = { ...(p.pickPhotos ?? {}) };
        revokeBlobUrl(nextPhotos[teamId]);
        delete nextPhotos[teamId];
        if (value === "") next[teamId] = null;
        else next[teamId] = Number(value);
        return { ...p, picks: next, pickPhotos: nextPhotos };
      })
    );
  }, []);

  const setPickPhoto = useCallback((id: string, teamId: TierTeamId, url: string | null) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nextPhotos = { ...(p.pickPhotos ?? {}) };
        revokeBlobUrl(nextPhotos[teamId]);
        if (url == null) delete nextPhotos[teamId];
        else nextPhotos[teamId] = url;
        return { ...p, pickPhotos: nextPhotos };
      })
    );
  }, []);

  const addParticipant = () => {
    setParticipants((prev) => {
      if (prev.length >= TIER_PARTICIPANT_MAX) return prev;
      return [...prev, createEmptyParticipant(prev.length + 1)];
    });
  };

  const removeParticipant = (id: string) => {
    setParticipants((prev) => {
      if (prev.length <= TIER_PARTICIPANT_MIN) return prev;
      const target = prev.find((p) => p.id === id);
      if (target) revokeParticipantBlobs(target);
      return prev.filter((p) => p.id !== id);
    });
  };

  /** 지정한 참가자 행만 링크 내용으로 채움. 실패 시 에러 문구 반환 */
  const fillParticipantFromLink = useCallback(
    (participantId: string, raw: string): string | null => {
      const text = raw.trim();
      if (!text) return "링크를 확인해 주세요.";
      const payload = parseTierShareInput(text);
      if (!payload) return "링크를 확인해 주세요.";

      const target = participants.find((p) => p.id === participantId);
      if (!target) return "링크를 확인해 주세요.";

      const conflict = participants.find(
        (p) => p.id !== participantId && nicknamesEqual(p.nickname, payload.nickname)
      );
      if (conflict) {
        const ok = window.confirm(
          `"${payload.nickname}"이(가) 다른 참가자에 있어요. 이 칸에 그래도 넣을까요?`
        );
        if (!ok) return "추가를 취소했어요.";
      }

      setParticipants((prev) =>
        prev.map((p) => {
          if (p.id !== participantId) return p;
          revokeParticipantBlobs(p);
          return applyShareToParticipant(p, payload);
        })
      );
      return null;
    },
    [participants]
  );

  const buildMyLink = (p: TierParticipantDraft) =>
    buildTierAddUrl(window.location.origin, sharePayloadFromParticipant(p));

  const copyMyLink = async (p: TierParticipantDraft) => {
    setCopyMsg(null);
    try {
      await navigator.clipboard.writeText(buildMyLink(p));
      setCopyMsg(`"${p.nickname.trim() || "참가자"}" 취향 링크를 복사했어요.`);
    } catch {
      setCopyMsg("클립보드 복사에 실패했어요.");
    }
  };

  const shareMyLink = async (p: TierParticipantDraft) => {
    setCopyMsg(null);
    const url = buildMyLink(p);
    const shareData: ShareData = {
      title: "KOVO 여자배구 취향표",
      text: "내 KOVO 여자배구 취향표 링크야!",
      url,
    };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // 미지원·실패 시 클립보드로 폴백
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopyMsg("복사됐어요.");
    } catch {
      setCopyMsg("클립보드 복사에 실패했어요.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    // 집계는 백그라운드(실패해도 이미지 저장에 영향 없음 · UI 에러 없음)
    void upsertTierSubmissions(titleKind, participants);
    try {
      const canvas = await renderTierChartCanvas({
        titleKind,
        twitterId,
        participants,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const result = await downloadTierChartPng(
        canvas,
        `kovo-${titleKind}-${stamp}.png`
      );
      if (result === "saved") setSaveMsg("이미지를 저장했어요.");
      else if (result === "opened") setSaveMsg("새 탭에서 이미지를 길게 눌러 저장해 주세요.");
      else if (result === "blocked") setSaveMsg("팝업이 차단됐어요. 허용 후 다시 시도해 주세요.");
      else setSaveMsg("저장에 실패했어요. 다시 시도해 주세요.");
    } catch {
      setSaveMsg("이미지 만들기에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
      <SiteNav />
      <header className="mx-auto flex max-w-[1100px] items-start justify-between gap-4 px-4 py-5 sm:items-center sm:px-8 sm:py-6">
        <div className="min-w-0">
          <p className="text-xs tracking-widest text-zinc-500 uppercase">voto gallery</p>
          <h1 className="mt-0.5 text-lg font-medium tracking-wide text-zinc-900">
            KOVO 취향표
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            구단별 최애를 골라 한 장으로 만들고 공유해요
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PageShareButton shareTitle="voto gallery — KOVO 취향표" />
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs text-zinc-700 transition hover:bg-zinc-50"
          >
            ← Gallery
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 pb-28 sm:px-8 sm:pb-12">
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3">
          <p className="mb-2 text-[11px] font-medium text-zinc-500">제목 종류</p>
          <div className="flex flex-wrap gap-1.5">
            {TIER_TITLE_KINDS.map((kind) => {
              const active = titleKind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setTitleKind(kind)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    active
                      ? "bg-[#00287A] text-white"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {kind}
                </button>
              );
            })}
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">
              트위터 아이디 (선택)
            </span>
            <input
              type="text"
              value={twitterId}
              onChange={(e) => setTwitterId(e.target.value)}
              placeholder="daeni.kr"
              className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#00287A]"
            />
          </label>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-900">
              참가자
              <span className="ml-1.5 text-xs font-normal text-zinc-400">
                {participants.length}/{TIER_PARTICIPANT_MAX}
              </span>
            </h2>
            <button
              type="button"
              onClick={addParticipant}
              disabled={participants.length >= TIER_PARTICIPANT_MAX}
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[#00287A] bg-[#00287A] px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              <Plus className="h-3.5 w-3.5" />
              참가자 추가
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            빈 칸을 늘린 뒤, 각 칸에서 직접 입력하거나 친구 링크를 붙여넣어 채우세요.
          </p>
          {copyMsg ? <p className="text-[11px] text-zinc-600">{copyMsg}</p> : null}

          {participants.map((p, index) => (
            <div
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-3 sm:px-4"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-medium text-zinc-500">
                  참가자 {index + 1}
                  {p.fromLink ? (
                    <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-px text-[10px] font-normal text-zinc-500">
                      링크
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void copyMyLink(p)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[#00287A] hover:bg-[#00287A]/5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    내 취향 링크 복사
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareMyLink(p)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[#00287A] hover:bg-[#00287A]/5"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    복사한 링크 공유하기
                  </button>
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.id)}
                    disabled={participants.length <= TIER_PARTICIPANT_MIN}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <RowLinkPaste participantId={p.id} onFill={fillParticipantFromLink} />
              </div>

              <div className="mb-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
                <ProfilePicker
                  url={p.profileUrl}
                  nickname={p.nickname}
                  fanTeam={p.fanTeam}
                  onChange={(profileUrl) => {
                    revokeBlobUrl(p.profileUrl);
                    updateParticipant(p.id, { profileUrl, fromLink: false });
                  }}
                />
                <div className="grid gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-zinc-500">닉네임</span>
                    <input
                      type="text"
                      value={p.nickname}
                      onChange={(e) => updateParticipant(p.id, { nickname: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#00287A]"
                      maxLength={20}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-zinc-500">
                      내 응원팀 (프로필 테두리)
                    </span>
                    <select
                      value={p.fanTeam ?? ""}
                      onChange={(e) =>
                        updateParticipant(p.id, {
                          fanTeam: e.target.value ? (e.target.value as TierTeamId) : null,
                        })
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs outline-none focus:border-[#00287A]"
                    >
                      <option value="">선택 안 함</option>
                      {TIER_TEAMS.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <p className="mb-1.5 text-[11px] font-medium text-zinc-500">구단별 최애</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TIER_TEAMS.map((team) => {
                  const value = p.picks[team.id];
                  const roster = PLAYERS_ROSTER[team.id];
                  const player = value != null ? findRosterPlayer(team.id, value) : null;
                  const customUrl = p.pickPhotos?.[team.id] ?? null;
                  return (
                    <div key={team.id} className="block">
                      <span
                        className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          background: team.color,
                          color: chipTextColor(team.color),
                        }}
                      >
                        {shortTeamLabel(team.label)}
                      </span>
                      <select
                        value={value == null ? "" : String(value)}
                        onChange={(e) => setPick(p.id, team.id, e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs outline-none focus:border-[#00287A]"
                        aria-label={`${shortTeamLabel(team.label)} 최애 선수`}
                      >
                        <option value="">선택 안 함 (텅)</option>
                        {roster.map((pl) => (
                          <option key={pl.no} value={pl.no}>
                            {pl.no} {pl.name}
                          </option>
                        ))}
                      </select>
                      {player ? (
                        <PickPhotoSlot
                          officialUrl={rosterPlayerUrl(team.id, player)}
                          customUrl={customUrl}
                          playerLabel={`${player.no} ${player.name}`}
                          onChange={(url) => setPickPhoto(p.id, team.id, url)}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-zinc-900">미리보기</h2>
              <p className="text-[11px] text-zinc-500">
                모바일에서는 옆으로 밀어 보세요 · 저장 이미지는 7열 전부 포함
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#00287A] bg-[#00287A] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#001f5c] disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {saving ? "만드는 중…" : "이미지로 저장"}
            </button>
          </div>
          {saveMsg ? <p className="mb-2 text-[11px] text-zinc-600">{saveMsg}</p> : null}

          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="min-w-[720px] overflow-hidden rounded-lg border border-zinc-200">
              <div className="border-b border-zinc-100 bg-white px-3 py-2.5">
                <p className="text-sm font-semibold text-[#0B1F4D]">{title}</p>
                <p className="text-[11px] text-zinc-500">{handleLabel}</p>
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `7rem repeat(${TIER_TEAMS.length}, minmax(5rem, 1fr))`,
                }}
              >
                <div className="flex items-center justify-center bg-zinc-100 px-1 py-2 text-[10px] text-zinc-500">
                  참가자
                </div>
                {TIER_TEAMS.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-center px-1 py-2 text-center text-[10px] font-semibold leading-tight"
                    style={{
                      background: team.color,
                      color: chipTextColor(team.color),
                    }}
                  >
                    {shortTeamLabel(team.label)}
                  </div>
                ))}

                {participants.map((p) => (
                  <div key={p.id} className="contents">
                    <div className="flex flex-col items-center justify-center gap-1.5 border-t border-zinc-100 bg-zinc-50 px-1.5 py-2.5">
                      <AvatarCircle
                        url={p.profileUrl}
                        nickname={p.nickname}
                        fanTeam={p.fanTeam}
                        sizeClass="h-14 w-14"
                        textClass="text-sm"
                        ringWidth={5}
                      />
                      <p className="max-w-full truncate text-center text-[10px] font-medium text-zinc-800">
                        {p.nickname.trim() || "참가자"}
                      </p>
                    </div>
                    {TIER_TEAMS.map((team) => (
                      <div
                        key={`${p.id}-${team.id}`}
                        className="border-t border-l border-zinc-100"
                      >
                        <PreviewCell
                          teamId={team.id}
                          jerseyNo={p.picks[team.id]}
                          customUrl={p.pickPhotos?.[team.id] ?? null}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
