/** 생일 메시지 개수 · 이 기기에 남긴 내 메시지 사본 — 순수 함수 */

export type BirthdayMessageCounts = {
  total: number;
  publicCount: number;
  privateCount: number;
};

const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

/** birthday_message_counts() RPC 응답(행 배열 또는 단일 행)에서 숫자 세 개만 꺼낸다 */
export function parseBirthdayMessageCounts(data: unknown): BirthdayMessageCounts | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const { total, public_count, private_count } = row as Record<string, unknown>;
  const toNumber = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v);
  const t = toNumber(total);
  const pub = toNumber(public_count);
  const priv = toNumber(private_count);
  if (!isCount(t) || !isCount(pub) || !isCount(priv)) return null;
  return { total: t, publicCount: pub, privateCount: priv };
}

export const MY_BIRTHDAY_MESSAGES_KEY = "voto-birthday-my-messages";
const MY_MESSAGES_MAX = 20;

/** 이 기기에서 보낸 메시지 사본. DB 에서 다시 읽은 값이 아니다. */
export type MyBirthdayMessage = {
  localId: string;
  nickname: string;
  message: string;
  isPublic: boolean;
  createdAt: string;
};

function isMyMessage(v: unknown): v is MyBirthdayMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.localId === "string" &&
    typeof m.nickname === "string" &&
    typeof m.message === "string" &&
    typeof m.isPublic === "boolean" &&
    typeof m.createdAt === "string"
  );
}

export function parseMyBirthdayMessages(raw: string | null): MyBirthdayMessage[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMyMessage).slice(0, MY_MESSAGES_MAX) : [];
  } catch {
    return [];
  }
}

/** 최신 메시지를 앞에 두고 최대 개수만 남긴다 */
export function addMyBirthdayMessage(
  list: readonly MyBirthdayMessage[],
  next: MyBirthdayMessage
): MyBirthdayMessage[] {
  return [next, ...list.filter((m) => m.localId !== next.localId)].slice(0, MY_MESSAGES_MAX);
}

export function removeMyBirthdayMessage(
  list: readonly MyBirthdayMessage[],
  localId: string
): MyBirthdayMessage[] {
  return list.filter((m) => m.localId !== localId);
}
