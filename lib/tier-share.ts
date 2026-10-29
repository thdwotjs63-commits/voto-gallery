import { TIER_TEAMS, type TierTeamId } from "./players-roster";
import type { TierParticipantDraft, TierPickMap } from "./tier-chart";
import { createEmptyParticipant } from "./tier-chart";

/** 취향 링크/코드에 실리는 텍스트 전용 취향 (사진 제외) */
export type TierSharePayload = {
  nickname: string;
  fanTeam: TierTeamId | null;
  picks: TierPickMap;
};

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(s: string): Uint8Array | null {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    if (typeof atob === "function") {
      const bin = atob(padded);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(padded, "base64"));
  } catch {
    return null;
  }
}

function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function isTierTeamId(v: string): v is TierTeamId {
  return TIER_TEAMS.some((t) => t.id === v);
}

/**
 * 짧은 텍스트 포맷 → base64url
 * `1|<nick>|<fanIdx or ->|<no|no|... 7칸, 빈칸은 공백>`
 * 예: 1|다인팬|0|3|1|||5||
 */
export function encodeTierShare(payload: TierSharePayload): string {
  const nick = payload.nickname.trim().slice(0, 20).replace(/\|/g, " ");
  const fan =
    payload.fanTeam == null
      ? "-"
      : (() => {
          const i = TIER_TEAMS.findIndex((t) => t.id === payload.fanTeam);
          return i < 0 ? "-" : String(i);
        })();
  const picks = TIER_TEAMS.map((t) => {
    const n = payload.picks[t.id];
    return n == null || !Number.isFinite(n) ? "" : String(Math.trunc(n));
  }).join("|");
  const raw = `1|${nick}|${fan}|${picks}`;
  return toBase64Url(utf8Encode(raw));
}

export function decodeTierShare(encoded: string): TierSharePayload | null {
  const trimmed = (encoded ?? "").trim();
  if (!trimmed) return null;
  const bytes = fromBase64Url(trimmed);
  if (!bytes) return null;
  let raw: string;
  try {
    raw = utf8Decode(bytes);
  } catch {
    return null;
  }
  const parts = raw.split("|");
  if (parts.length < 3 || parts[0] !== "1") return null;

  const nickname = (parts[1] ?? "").trim().slice(0, 20);
  if (!nickname) return null;

  const fanRaw = parts[2] ?? "-";
  let fanTeam: TierTeamId | null = null;
  if (fanRaw !== "-" && fanRaw !== "") {
    const idx = Number(fanRaw);
    if (Number.isInteger(idx) && idx >= 0 && idx < TIER_TEAMS.length) {
      fanTeam = TIER_TEAMS[idx]!.id;
    } else if (isTierTeamId(fanRaw)) {
      fanTeam = fanRaw;
    }
  }

  const pickParts = parts.slice(3);
  const picks: TierPickMap = {};
  for (let i = 0; i < TIER_TEAMS.length; i++) {
    const team = TIER_TEAMS[i]!;
    const cell = (pickParts[i] ?? "").trim();
    if (!cell) {
      picks[team.id] = null;
      continue;
    }
    const no = Number(cell);
    if (!Number.isInteger(no) || no <= 0) {
      picks[team.id] = null;
      continue;
    }
    picks[team.id] = no;
  }

  return { nickname, fanTeam, picks };
}

export function buildTierAddPath(encoded: string): string {
  return `/tier?add=${encodeURIComponent(encoded)}`;
}

export function buildTierAddUrl(origin: string, payload: TierSharePayload): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildTierAddPath(encodeTierShare(payload))}`;
}

/**
 * 붙여넣기 입력용: 전체 URL(`/tier?add=...`) 또는 base64url 코드만 와도 파싱.
 */
export function extractTierShareToken(input: string): string | null {
  const trimmed = (input ?? "").trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return null;

  try {
    const asUrl = new URL(trimmed);
    const fromQuery = asUrl.searchParams.get("add");
    if (fromQuery) return fromQuery.trim() || null;
  } catch {
    // not a full URL — try relative /tier?add= or raw token
  }

  const relMatch = trimmed.match(/[?&]add=([^&\s#]+)/i);
  if (relMatch?.[1]) {
    try {
      return decodeURIComponent(relMatch[1]).trim() || null;
    } catch {
      return relMatch[1].trim() || null;
    }
  }

  // raw base64url token
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

/** 붙여넣은 링크/코드 → payload (실패 시 null) */
export function parseTierShareInput(input: string): TierSharePayload | null {
  const token = extractTierShareToken(input);
  if (!token) return null;
  return decodeTierShare(token);
}

export function sharePayloadFromParticipant(
  p: Pick<TierParticipantDraft, "nickname" | "fanTeam" | "picks">
): TierSharePayload {
  return {
    nickname: p.nickname.trim() || "참가자",
    fanTeam: p.fanTeam,
    picks: { ...p.picks },
  };
}

/** 링크로 들어온 취향 → 참가자 행 (사진 없음) */
export function participantFromShare(
  payload: TierSharePayload,
  index = 1
): TierParticipantDraft {
  const base = createEmptyParticipant(index);
  return applyShareToParticipant(base, payload);
}

/** 기존 행 id·사진은 유지하지 않고, 링크 내용으로 그 행만 채움 (사진 제외) */
export function applyShareToParticipant(
  existing: TierParticipantDraft,
  payload: TierSharePayload
): TierParticipantDraft {
  return {
    ...existing,
    nickname: payload.nickname,
    fanTeam: payload.fanTeam,
    profileUrl: null,
    fromLink: true,
    picks: { ...payload.picks },
    pickPhotos: {},
  };
}

export function nicknamesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
