import {
  TIER_TEAMS,
  type TierTeamId,
  findRosterPlayer,
  rosterPlayerUrl,
} from "./players-roster";
import { chipTextColor } from "./vleague-teams";

export const TIER_TITLE_KINDS = ["취향표", "취향파괴범", "최애제외취향"] as const;
export type TierTitleKind = (typeof TIER_TITLE_KINDS)[number];

export const TIER_PARTICIPANT_MIN = 1;
export const TIER_PARTICIPANT_MAX = 10;

export type TierPickMap = Partial<Record<TierTeamId, number | null>>;

/** 구단별 커스텀 선수 사진 (blob/data URL, 브라우저 로컬만) */
export type TierPickPhotoMap = Partial<Record<TierTeamId, string | null>>;

export type TierParticipantDraft = {
  id: string;
  nickname: string;
  /** 내 응원팀 — 프로필 테두리·컬러 원 */
  fanTeam: TierTeamId | null;
  /** object URL or data URL — 브라우저 로컬만 (링크 취합에는 미포함) */
  profileUrl: string | null;
  /** URL ?add= 로 들어온 행 */
  fromLink?: boolean;
  picks: TierPickMap;
  /** 참가자×구단별 선수 사진 교체 (공식 사진 대신) */
  pickPhotos?: TierPickPhotoMap;
};

export function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

export function revokeParticipantBlobs(p: TierParticipantDraft) {
  revokeBlobUrl(p.profileUrl);
  if (!p.pickPhotos) return;
  for (const team of TIER_TEAMS) {
    revokeBlobUrl(p.pickPhotos[team.id]);
  }
}

export function chartTitle(kind: TierTitleKind): string {
  return `KOVO 여자배구 ${kind}`;
}

/** 표·저장 이미지 우측 상단 출처 (예: 출처는 @daeniorea) */
export function tierCreditLabel(twitterId: string): string {
  const handle = (twitterId || "daeniorea").replace(/^@/, "").trim() || "daeniorea";
  return `출처는 @${handle}`;
}

export function createEmptyParticipant(index: number): TierParticipantDraft {
  return {
    id: `p-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    nickname: `참가자${index}`,
    fanTeam: null,
    profileUrl: null,
    picks: {},
    pickPhotos: {},
  };
}

export function fanTeamColor(fanTeam: TierTeamId | null | undefined): string | null {
  if (!fanTeam) return null;
  return TIER_TEAMS.find((t) => t.id === fanTeam)?.color ?? null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > cr) {
    sw = img.naturalHeight * cr;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / cr;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawCircleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  r: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  drawCover(ctx, img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

export type TierChartRenderInput = {
  titleKind: TierTitleKind;
  twitterId: string;
  participants: readonly TierParticipantDraft[];
};

/** 7열 전부 한 장에 합성 (공유·저장용) */
export async function renderTierChartCanvas(
  input: TierChartRenderInput
): Promise<HTMLCanvasElement> {
  const participants = input.participants;
  const leftW = 140;
  const cellW = 118;
  const headerH = 44;
  const titleH = 78;
  const rowH = 152;
  const pad = 20;
  const width = pad * 2 + leftW + TIER_TEAMS.length * cellW;
  const height = pad * 2 + titleH + headerH + Math.max(participants.length, 1) * rowH;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // title (left) + credit (top-right)
  const title = chartTitle(input.titleKind);
  ctx.fillStyle = "#0B1F4D";
  ctx.font = "bold 28px Pretendard, Apple SD Gothic Neo, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, pad, pad + titleH / 2);

  ctx.fillStyle = "#71717A";
  ctx.font = "14px Pretendard, Apple SD Gothic Neo, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(tierCreditLabel(input.twitterId), width - pad, pad + titleH / 2);

  const gridTop = pad + titleH;
  const gridLeft = pad;

  // column headers
  ctx.font = "bold 12px Pretendard, Apple SD Gothic Neo, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < TIER_TEAMS.length; i++) {
    const team = TIER_TEAMS[i]!;
    const x = gridLeft + leftW + i * cellW;
    ctx.fillStyle = team.color;
    ctx.fillRect(x, gridTop, cellW, headerH);
    ctx.fillStyle = chipTextColor(team.color);
    const label =
      team.label.length > 6 ? team.label.replace("기업은행", "IBK").replace("한국", "") : team.label;
    ctx.fillText(label, x + cellW / 2, gridTop + headerH / 2);
  }

  // left header corner
  ctx.fillStyle = "#F4F4F5";
  ctx.fillRect(gridLeft, gridTop, leftW, headerH);
  ctx.fillStyle = "#52525B";
  ctx.font = "11px Pretendard, Apple SD Gothic Neo, sans-serif";
  ctx.fillText("참가자", gridLeft + leftW / 2, gridTop + headerH / 2);

  // preload images
  const profileImgs = await Promise.all(
    participants.map(async (p) => {
      if (!p.profileUrl) return null;
      try {
        return await loadImage(p.profileUrl);
      } catch {
        return null;
      }
    })
  );

  const pickImgs: (HTMLImageElement | null)[][] = [];
  for (const p of participants) {
    const row: (HTMLImageElement | null)[] = [];
    for (const team of TIER_TEAMS) {
      const no = p.picks[team.id];
      if (no == null) {
        row.push(null);
        continue;
      }
      const custom = p.pickPhotos?.[team.id] ?? null;
      if (custom) {
        try {
          row.push(await loadImage(custom));
          continue;
        } catch {
          // fall through to official
        }
      }
      const player = findRosterPlayer(team.id, no);
      if (!player) {
        row.push(null);
        continue;
      }
      try {
        row.push(await loadImage(rosterPlayerUrl(team.id, player)));
      } catch {
        row.push(null);
      }
    }
    pickImgs.push(row);
  }

  for (let r = 0; r < participants.length; r++) {
    const p = participants[r]!;
    const y = gridTop + headerH + r * rowH;

    // zebra
    ctx.fillStyle = r % 2 === 0 ? "#FAFAFA" : "#FFFFFF";
    ctx.fillRect(gridLeft, y, leftW + TIER_TEAMS.length * cellW, rowH);

    // left identity
    ctx.strokeStyle = "#E4E4E7";
    ctx.strokeRect(gridLeft, y, leftW, rowH);
    const cx = gridLeft + leftW / 2;
    const rAvatar = 42;
    const cy = y + 12 + rAvatar;
    const avatar = profileImgs[r];
    const ring = fanTeamColor(p.fanTeam);
    if (avatar) {
      drawCircleImage(ctx, avatar, cx, cy, rAvatar);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, rAvatar, 0, Math.PI * 2);
      ctx.fillStyle = ring ?? "#E4E4E7";
      ctx.fill();
      ctx.fillStyle = ring ? chipTextColor(ring) : "#71717A";
      ctx.font = "bold 20px Pretendard, Apple SD Gothic Neo, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initial = (p.nickname.trim() || "?").slice(0, 1);
      ctx.fillText(initial, cx, cy);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, rAvatar, 0, Math.PI * 2);
    ctx.strokeStyle = ring ?? "#D4D4D8";
    ctx.lineWidth = ring ? 8 : 2.5;
    ctx.stroke();
    ctx.fillStyle = "#18181B";
    ctx.font = "bold 13px Pretendard, Apple SD Gothic Neo, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const nick = p.nickname.trim() || `참가자${r + 1}`;
    const nickShown = nick.length > 9 ? `${nick.slice(0, 8)}…` : nick;
    ctx.fillText(nickShown, cx, cy + rAvatar + 8);

    for (let c = 0; c < TIER_TEAMS.length; c++) {
      const x = gridLeft + leftW + c * cellW;
      const inset = 6;
      ctx.strokeStyle = "#E4E4E7";
      ctx.strokeRect(x, y, cellW, rowH);
      const img = pickImgs[r]![c] ?? null;
      const pickNo = p.picks[TIER_TEAMS[c]!.id];
      if (img && pickNo != null) {
        drawCover(ctx, img, x + inset, y + inset, cellW - inset * 2, rowH - inset * 2 - 18);
        const player = findRosterPlayer(TIER_TEAMS[c]!.id, pickNo);
        ctx.fillStyle = "#27272A";
        ctx.font = "11px Pretendard, Apple SD Gothic Neo, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const name = player?.name ?? "";
        ctx.fillText(name.length > 5 ? `${name.slice(0, 4)}…` : name, x + cellW / 2, y + rowH - 12);
      } else {
        ctx.fillStyle = "#F4F4F5";
        ctx.fillRect(x + inset, y + inset, cellW - inset * 2, rowH - inset * 2);
        ctx.fillStyle = "#A1A1AA";
        ctx.font = "bold 22px Pretendard, Apple SD Gothic Neo, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("텅", x + cellW / 2, y + rowH / 2);
      }
    }
  }

  // outer border
  ctx.strokeStyle = "#D4D4D8";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    gridLeft,
    gridTop,
    leftW + TIER_TEAMS.length * cellW,
    headerH + participants.length * rowH
  );

  return canvas;
}

export async function downloadTierChartPng(
  canvas: HTMLCanvasElement,
  fileName: string
): Promise<"saved" | "opened" | "blocked" | "failed"> {
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const useSafariFlow = isSafari || isIOS;

  let safariWin: Window | null = null;
  if (useSafariFlow) {
    safariWin = window.open("", "_blank");
    if (safariWin) {
      safariWin.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>이미지 저장</title></head><body style="margin:0;background:#fff;display:flex;flex-direction:column;align-items:center;padding:16px;font-family:sans-serif;"><p>이미지 만드는 중...</p></body></html>`
      );
      safariWin.document.close();
    }
  }

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob failed"))), "image/png");
    });
    const url = URL.createObjectURL(blob);

    if (useSafariFlow) {
      if (!safariWin || safariWin.closed) {
        URL.revokeObjectURL(url);
        return "blocked";
      }
      safariWin.document.open();
      safariWin.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fileName}</title></head><body style="margin:0;background:#fff;display:flex;flex-direction:column;align-items:center;padding:16px;font-family:sans-serif;"><p style="font-size:14px;margin:0 0 12px;text-align:center;">이미지를 길게 눌러 「사진에 저장」을 선택해 주세요.</p><img src="${url}" alt="${fileName}" style="max-width:100%;height:auto;"/></body></html>`
      );
      safariWin.document.close();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return "opened";
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return "saved";
  } catch {
    if (safariWin && !safariWin.closed) safariWin.close();
    return "failed";
  }
}
