"use client";

import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  ClipboardPaste,
  Copy,
  Download,
  Plus,
  Share2,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { PageShareButton } from "@/components/page-share-button";
import {
  PLAYERS_ROSTER,
  TIER_TEAMS,
  findRosterPlayer,
  getVisibleTierTeams,
  rosterPlayerLabel,
  rosterPlayerUrl,
  type TierTeam,
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
  tierSiteCredit,
  type TierParticipantDraft,
  type TierTitleKind,
} from "@/lib/tier-chart";
import {
  applyShareToParticipant,
  buildTierAddUrl,
  nicknamesEqual,
  parseTierShareInput,
  participantFromShare,
  sharePayloadFromParticipant,
} from "@/lib/tier-share";
import { upsertTierSubmissions } from "@/lib/tier-submissions";

function shortTeamLabel(label: string): string {
  if (label === "한국도로공사") return "도로공사";
  if (label === "IBK기업은행") return "IBK";
  if (label === "GS칼텍스") return "GS";
  if (label === "원더독스") return "원더독스";
  return label;
}

const WONDERDOGS_ID: TierTeamId = "원더독스";

function hasAnyPick(p: TierParticipantDraft): boolean {
  return TIER_TEAMS.some((t) => p.picks[t.id] != null);
}

function participantsFromAddParam(add: string | null): TierParticipantDraft[] {
  if (!add) return [createEmptyParticipant(1)];
  const payload = parseTierShareInput(add);
  if (!payload) return [createEmptyParticipant(1)];
  return [participantFromShare(payload, 1)];
}

function AvatarCircle({
  url,
  nickname,
  fanTeam,
  sizeClass = "h-12 w-12",
  textClass = "text-sm",
  ringWidth = 4,
}: {
  url: string | null;
  nickname: string;
  fanTeam: TierTeamId | null;
  sizeClass?: string;
  textClass?: string;
  ringWidth?: number;
}) {
  const ring = fanTeamColor(fanTeam);
  const initial = (nickname.trim() || "?").slice(0, 1);
  const style: CSSProperties = {
    borderWidth: ring ? ringWidth : 2,
    borderStyle: ring ? "solid" : "dashed",
    borderColor: ring ?? "#d4d4d8",
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

/** 행 왼쪽: 닉네임·응원팀·프로필 (저장 이미지에는 편집 UI 없음) */
function IdentityCell({
  participant,
  index,
  canRemove,
  fanTeams,
  onUpdate,
  onProfile,
  onCopy,
  onShare,
  onRemove,
}: {
  participant: TierParticipantDraft;
  index: number;
  canRemove: boolean;
  fanTeams: readonly TierTeam[];
  onUpdate: (patch: Partial<TierParticipantDraft>) => void;
  onProfile: (url: string | null) => void;
  onCopy: () => void;
  onShare: () => void;
  onRemove: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  const applyFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    onProfile(URL.createObjectURL(file));
  };

  return (
    <div className="flex h-full min-h-[9.5rem] flex-col gap-1 border-t border-zinc-100 bg-zinc-50 px-1.5 py-2">
      <p className="text-center text-[9px] font-medium text-zinc-400">
        {index + 1}
        {participant.fromLink ? " · 링크" : ""}
      </p>

      <label
        className={`relative mx-auto block h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full ${
          dragging ? "ring-2 ring-[#00287A]/40" : ""
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          applyFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <span className="pointer-events-none block h-full w-full">
          {participant.profileUrl || participant.fanTeam ? (
            <AvatarCircle
              url={participant.profileUrl}
              nickname={participant.nickname}
              fanTeam={participant.fanTeam}
            />
          ) : (
            <span className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-dashed border-zinc-300 bg-white text-zinc-400">
              <UserRound className="h-4 w-4" />
              <Upload className="h-2.5 w-2.5" />
            </span>
          )}
        </span>
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          aria-label={`참가자 ${index + 1} 프로필 사진`}
          onChange={(e) => {
            applyFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>

      <input
        type="text"
        value={participant.nickname}
        onChange={(e) => onUpdate({ nickname: e.target.value })}
        maxLength={20}
        placeholder="닉네임"
        className="min-h-9 w-full rounded border border-zinc-200 bg-white px-1 py-1 text-center text-[10px] font-medium outline-none focus:border-[#00287A]"
        aria-label={`참가자 ${index + 1} 닉네임`}
      />

      <select
        value={participant.fanTeam ?? ""}
        onChange={(e) =>
          onUpdate({
            fanTeam: e.target.value ? (e.target.value as TierTeamId) : null,
          })
        }
        className="min-h-9 w-full rounded border border-zinc-200 bg-white px-0.5 py-1 text-[9px] outline-none focus:border-[#00287A]"
        aria-label={`참가자 ${index + 1} 응원팀`}
      >
        <option value="">응원팀</option>
        {fanTeams.map((team) => (
          <option key={team.id} value={team.id}>
            {shortTeamLabel(team.label)}
          </option>
        ))}
      </select>

      <div className="mt-auto flex flex-wrap justify-center gap-0.5 pt-0.5">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-8 min-w-8 items-center justify-center gap-0.5 rounded px-1 text-[9px] font-medium text-[#00287A] hover:bg-[#00287A]/5"
          title="내 취향 링크 복사"
        >
          <Copy className="h-3 w-3" />
          복사
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex min-h-8 min-w-8 items-center justify-center gap-0.5 rounded px-1 text-[9px] font-medium text-[#00287A] hover:bg-[#00287A]/5"
          title="링크 공유"
        >
          <Share2 className="h-3 w-3" />
          공유
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="inline-flex min-h-8 min-w-8 items-center justify-center gap-0.5 rounded px-1 text-[9px] text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          title="참가자 삭제"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/** 공식/커스텀 선수 사진 — next/image 없이 <img>, 로드 실패 시 이름 fallback */
function PlayerPhoto({
  src,
  label,
  className = "h-full w-full object-cover object-top",
}: {
  src: string;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-zinc-200 px-1 text-center">
        <span className="text-[10px] font-semibold leading-tight text-zinc-600">{label}</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      loading="lazy"
      decoding="async"
      className={`pointer-events-none ${className}`}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/** 표 칸: 선수 선택 + 사진 교체 (저장 이미지에는 이 UI 없음) */
function EditablePickCell({
  teamId,
  jerseyNo,
  customUrl,
  onPick,
  onPhoto,
}: {
  teamId: TierTeamId;
  jerseyNo: number | null | undefined;
  customUrl: string | null;
  onPick: (value: string) => void;
  onPhoto: (url: string | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const roster = PLAYERS_ROSTER[teamId];
  const player = jerseyNo != null ? findRosterPlayer(teamId, jerseyNo) : null;
  const teamLabel = shortTeamLabel(TIER_TEAMS.find((t) => t.id === teamId)?.label ?? teamId);

  const applyFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    onPhoto(URL.createObjectURL(file));
  };

  if (!player) {
    return (
      <div className="relative flex h-full min-h-[7.5rem] flex-col items-center justify-center bg-zinc-100 active:bg-zinc-200/80">
        <span className="pointer-events-none text-sm font-semibold text-zinc-400">텅</span>
        <span className="pointer-events-none mt-0.5 text-[9px] text-zinc-400">탭해서 선택</span>
        <select
          value=""
          onChange={(e) => onPick(e.target.value)}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          aria-label={`${teamLabel} 선수 선택`}
        >
          <option value="">선택 안 함 (텅)</option>
          {roster.map((pl) => (
            <option key={pl.no} value={pl.no}>
              {rosterPlayerLabel(pl)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const src = customUrl || rosterPlayerUrl(teamId, player);
  const label = rosterPlayerLabel(player);

  return (
    <div
      className={`relative flex h-full min-h-[7.5rem] flex-col overflow-hidden bg-zinc-50 ${
        dragging ? "ring-2 ring-inset ring-[#00287A]/50" : ""
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        applyFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <button
        type="button"
        className="relative min-h-0 flex-1 touch-manipulation"
        title="사진 교체"
        aria-label={`${label} 사진 교체`}
        onClick={() => photoInputRef.current?.click()}
      >
        <PlayerPhoto key={src} src={src} label={label} />
        <span className="pointer-events-none absolute bottom-1 right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-sm">
          <Camera className="h-3.5 w-3.5" aria-hidden />
        </span>
      </button>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          applyFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <select
        value={String(jerseyNo)}
        onChange={(e) => onPick(e.target.value)}
        className="min-h-10 w-full shrink-0 touch-manipulation border-t border-zinc-100 bg-white px-0.5 py-1.5 text-center text-[9px] font-medium text-zinc-800 outline-none focus:bg-[#00287A]/5"
        aria-label={`${teamLabel} 선수 변경`}
      >
        <option value="">텅으로</option>
        {roster.map((pl) => (
          <option key={pl.no} value={pl.no}>
            {rosterPlayerLabel(pl)}
          </option>
        ))}
      </select>
      {customUrl ? (
        <button
          type="button"
          onClick={() => onPhoto(null)}
          className="absolute left-1 top-1 z-20 min-h-7 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-[#00287A] shadow-sm"
        >
          공식
        </button>
      ) : null}
    </div>
  );
}

function TierPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [titleKind, setTitleKind] = useState<TierTitleKind>("취향표");
  const [twitterId, setTwitterId] = useState("");
  const [includeWonderdogs, setIncludeWonderdogs] = useState(false);
  const [participants, setParticipants] = useState<TierParticipantDraft[]>(() =>
    participantsFromAddParam(searchParams.get("add"))
  );
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteErr, setPasteErr] = useState<string | null>(null);

  const title = useMemo(() => chartTitle(titleKind), [titleKind]);
  const siteCredit = useMemo(() => tierSiteCredit(), []);
  const visibleTeams = useMemo(
    () => getVisibleTierTeams(includeWonderdogs),
    [includeWonderdogs]
  );

  const setWonderdogsIncluded = (on: boolean) => {
    setIncludeWonderdogs(on);
    if (on) return;
    setParticipants((prev) =>
      prev.map((p) => {
        const nextPicks = { ...p.picks };
        const nextPhotos = { ...(p.pickPhotos ?? {}) };
        revokeBlobUrl(nextPhotos[WONDERDOGS_ID]);
        delete nextPicks[WONDERDOGS_ID];
        delete nextPhotos[WONDERDOGS_ID];
        return {
          ...p,
          picks: nextPicks,
          pickPhotos: nextPhotos,
          fanTeam: p.fanTeam === WONDERDOGS_ID ? null : p.fanTeam,
        };
      })
    );
  };

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

  const runPaste = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) {
        setPasteErr("링크를 확인해 주세요.");
        return;
      }
      const payload = parseTierShareInput(text);
      if (!payload) {
        setPasteErr("링크를 확인해 주세요.");
        return;
      }

      const conflict = participants.find((p) =>
        nicknamesEqual(p.nickname, payload.nickname)
      );
      if (conflict && hasAnyPick(conflict)) {
        const ok = window.confirm(
          `"${payload.nickname}"이(가) 이미 있어요. 그래도 추가할까요?`
        );
        if (!ok) {
          setPasteErr("추가를 취소했어요.");
          return;
        }
      }

      const emptyIdx = participants.findIndex((p) => !hasAnyPick(p) && !p.fromLink);
      if (emptyIdx >= 0) {
        const target = participants[emptyIdx]!;
        revokeParticipantBlobs(target);
        setParticipants((prev) =>
          prev.map((p, i) =>
            i === emptyIdx ? applyShareToParticipant(p, payload) : p
          )
        );
      } else if (participants.length >= TIER_PARTICIPANT_MAX) {
        setPasteErr("참가자가 가득 찼어요.");
        return;
      } else {
        setParticipants((prev) => [
          ...prev,
          participantFromShare(payload, prev.length + 1),
        ]);
      }

      setPasteErr(null);
      setPaste("");
      setCopyMsg("링크 취향을 표에 넣었어요.");
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
    void upsertTierSubmissions(titleKind, participants);
    try {
      const canvas = await renderTierChartCanvas({
        titleKind,
        twitterId,
        participants,
        teams: visibleTeams,
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
            표에서 바로 골라 한 장으로 만들고 공유해요
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

      <main className="mx-auto max-w-[1100px] space-y-3 px-4 pb-28 sm:px-8 sm:pb-12">
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0">
              <p className="mb-1.5 text-[11px] font-medium text-zinc-500">제목 종류</p>
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
            </div>

            <label className="block min-w-0 flex-1 basis-[14rem]">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                <ClipboardPaste className="h-3 w-3" aria-hidden />
                링크 붙여넣기
              </span>
              <input
                type="text"
                value={paste}
                onChange={(e) => {
                  setPaste(e.target.value);
                  if (pasteErr) setPasteErr(null);
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (!text.trim()) return;
                  e.preventDefault();
                  setPaste(text);
                  window.setTimeout(() => runPaste(text), 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runPaste(paste);
                  }
                }}
                placeholder="친구 취향 링크"
                className={`min-h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#00287A] ${
                  pasteErr ? "border-amber-500" : "border-zinc-200"
                }`}
                aria-label="친구 취향 링크 붙여넣기"
              />
            </label>

            <button
              type="button"
              onClick={addParticipant}
              disabled={participants.length >= TIER_PARTICIPANT_MAX}
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-[#00287A] disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              <Plus className="h-3.5 w-3.5" />
              참가자 추가
            </button>

            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800">
              <input
                type="checkbox"
                checked={includeWonderdogs}
                onChange={(e) => setWonderdogsIncluded(e.target.checked)}
                className="h-4 w-4 accent-[#D55329]"
              />
              <span aria-hidden>🧡</span>
              원더독스도 포함하기
            </label>
          </div>
          {pasteErr ? (
            <p className="mt-2 text-[11px] font-medium text-amber-700">{pasteErr}</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-zinc-900">
                취향표
                <span className="ml-1.5 text-xs font-normal text-zinc-400">
                  {participants.length}/{TIER_PARTICIPANT_MAX}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-500">
                칸 탭 → 선수 선택 · 사진/📷 → 교체 · 왼쪽에서 프로필
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
          {copyMsg ? <p className="mb-2 text-[11px] text-zinc-600">{copyMsg}</p> : null}
          {saveMsg ? <p className="mb-2 text-[11px] text-zinc-600">{saveMsg}</p> : null}

          <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [-webkit-overflow-scrolling:touch]">
            <div
              className="overflow-hidden rounded-lg border border-zinc-200"
              style={{
                minWidth: includeWonderdogs ? 940 : 820,
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-white px-3 py-2.5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-[#0B1F4D]">{title}</p>
                  <label className="inline-flex min-h-8 items-center gap-0.5 rounded border border-zinc-200 bg-zinc-50 px-1.5 text-[11px] text-zinc-600 focus-within:border-[#00287A]">
                    <span className="select-none font-medium text-zinc-500" aria-hidden>
                      @
                    </span>
                    <input
                      type="text"
                      value={twitterId}
                      onChange={(e) => setTwitterId(e.target.value.replace(/^@+/, ""))}
                      placeholder="트위터닉"
                      maxLength={30}
                      className="w-[7.5rem] bg-transparent py-1 outline-none placeholder:text-zinc-400"
                      aria-label="트위터 닉네임"
                    />
                  </label>
                </div>
                <p className="shrink-0 text-[11px] text-zinc-500">{siteCredit}</p>
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `8.75rem repeat(${visibleTeams.length}, minmax(5.25rem, 1fr))`,
                }}
              >
                <div className="flex items-center justify-center bg-zinc-100 px-1 py-2 text-[10px] text-zinc-500">
                  참가자
                </div>
                {visibleTeams.map((team) => (
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

                {participants.map((p, index) => (
                  <div key={p.id} className="contents">
                    <IdentityCell
                      participant={p}
                      index={index}
                      canRemove={participants.length > TIER_PARTICIPANT_MIN}
                      fanTeams={visibleTeams}
                      onUpdate={(patch) => updateParticipant(p.id, patch)}
                      onProfile={(profileUrl) => {
                        revokeBlobUrl(p.profileUrl);
                        updateParticipant(p.id, { profileUrl, fromLink: false });
                      }}
                      onCopy={() => void copyMyLink(p)}
                      onShare={() => void shareMyLink(p)}
                      onRemove={() => removeParticipant(p.id)}
                    />
                    {visibleTeams.map((team) => (
                      <div
                        key={`${p.id}-${team.id}`}
                        className="border-t border-l border-zinc-100"
                      >
                        <EditablePickCell
                          teamId={team.id}
                          jerseyNo={p.picks[team.id]}
                          customUrl={p.pickPhotos?.[team.id] ?? null}
                          onPick={(value) => setPick(p.id, team.id, value)}
                          onPhoto={(url) => setPickPhoto(p.id, team.id, url)}
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

export default function TierPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white text-zinc-900 [color-scheme:light]">
          <SiteNav />
          <p className="px-4 py-10 text-center text-sm text-zinc-500 sm:px-8">
            취향표 불러오는 중…
          </p>
        </div>
      }
    >
      <TierPageInner />
    </Suspense>
  );
}
