export const BOOTH_SEQ_STORAGE_KEY = "voto-photo-booth-seq";

export function readBoothSequence(): number {
  try {
    const raw = localStorage.getItem(BOOTH_SEQ_STORAGE_KEY);
    const n = parseInt(raw ?? "0", 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  } catch {
    return 0;
  }
}

export function writeBoothSequence(value: number) {
  try {
    localStorage.setItem(BOOTH_SEQ_STORAGE_KEY, String(Math.max(0, Math.floor(value))));
  } catch {
    /* ignore */
  }
}

export function resetBoothSequence() {
  writeBoothSequence(0);
}

/** 다음 저장에 쓸 순번 (1부터)을 반환하고 localStorage 를 갱신 */
export function allocateNextBoothSequence(): number {
  const next = readBoothSequence() + 1;
  writeBoothSequence(next);
  return next;
}

export function formatBoothSequenceLabel(seq: number): string {
  return String(seq).padStart(3, "0");
}

function formatBoothDateYmd(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${mo}${d}`;
}

export function buildBoothCompositeFileName(
  frameId: string,
  seq: number,
  date = new Date()
): string {
  const safeId = frameId.replace(/[^a-z0-9-]/gi, "") || "frame";
  return `daeni-4cut-${safeId}-${formatBoothDateYmd(date)}-${formatBoothSequenceLabel(seq)}.jpg`;
}

export function buildBoothOriginalFileName(
  frameId: string,
  seq: number,
  slotIndex: number,
  date = new Date()
): string {
  const base = buildBoothCompositeFileName(frameId, seq, date).replace(/\.jpg$/i, "");
  return `${base}-${slotIndex + 1}.jpg`;
}

export function isPhotoBoothMode(searchParams: URLSearchParams): boolean {
  return searchParams.get("booth") === "1";
}

type BoothVisibleFrame = { id: string; boothOnly?: boolean };

/** 일반 모드: boothOnly 제외 / 행사 모드: boothOnly 를 맨 앞에 */
export function listFramesForMode<T extends BoothVisibleFrame>(
  frames: readonly T[],
  booth: boolean
): T[] {
  const regular = frames.filter((f) => !f.boothOnly);
  if (!booth) return regular;
  return [...frames.filter((f) => f.boothOnly), ...regular];
}

/** 현재 모드에서 보이지 않는 프레임 id 는 무시하고 목록 첫 프레임으로 */
export function resolveInitialFrame<T extends BoothVisibleFrame>(
  frames: readonly T[],
  booth: boolean,
  requestedId?: string | null
): T {
  const visible = listFramesForMode(frames, booth);
  return visible.find((f) => f.id === requestedId) ?? visible[0];
}
