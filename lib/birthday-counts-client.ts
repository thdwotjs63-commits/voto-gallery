import { useSyncExternalStore } from "react";
import {
  MY_BIRTHDAY_MESSAGES_KEY,
  addMyBirthdayMessage,
  parseBirthdayMessageCounts,
  parseMyBirthdayMessages,
  removeMyBirthdayMessage,
  type BirthdayMessageCounts,
  type MyBirthdayMessage,
} from "./birthday-counts";
import { isSupabaseConfigured, supabase } from "./supabase-client";

/* ---------- 메시지 개수 (birthday_message_counts RPC) ---------- */

export type BirthdayCountsState =
  | { status: "loading" }
  | { status: "ready"; counts: BirthdayMessageCounts }
  | { status: "error" };

const LOADING: BirthdayCountsState = { status: "loading" };
let countsState: BirthdayCountsState = LOADING;
let countsRequest: Promise<void> | null = null;
let countsLoaded = false;
const countsListeners = new Set<() => void>();

function setCountsState(next: BirthdayCountsState) {
  countsState = next;
  countsListeners.forEach((listener) => listener());
}

/** 실패하면 error — 아직 SQL 을 실행하지 않았거나 네트워크 오류 */
export function refreshBirthdayMessageCounts(): Promise<void> {
  if (countsRequest) return countsRequest;
  countsLoaded = true;
  countsRequest = (async () => {
    if (!isSupabaseConfigured) {
      setCountsState({ status: "error" });
      return;
    }
    try {
      const { data, error } = await supabase.rpc("birthday_message_counts");
      const counts = error ? null : parseBirthdayMessageCounts(data);
      if (error) console.warn("[birthday] message counts unavailable:", error.code, error.message);
      setCountsState(counts ? { status: "ready", counts } : { status: "error" });
    } catch (error) {
      console.warn("[birthday] message counts threw:", error);
      setCountsState({ status: "error" });
    } finally {
      countsRequest = null;
    }
  })();
  return countsRequest;
}

function subscribeCounts(listener: () => void) {
  countsListeners.add(listener);
  if (!countsLoaded) void refreshBirthdayMessageCounts();
  return () => {
    countsListeners.delete(listener);
  };
}

export function useBirthdayMessageCounts(): BirthdayCountsState {
  return useSyncExternalStore(
    subscribeCounts,
    () => countsState,
    () => LOADING
  );
}

/* ---------- 이 기기에 남긴 내 메시지 사본 (localStorage) ---------- */

const MY_MESSAGES_EVENT = "voto-birthday-my-messages-change";
const EMPTY: MyBirthdayMessage[] = [];
let myRaw: string | null = null;
let myParsed: MyBirthdayMessage[] = EMPTY;

function readMyRaw(): string | null {
  try {
    return window.localStorage.getItem(MY_BIRTHDAY_MESSAGES_KEY);
  } catch {
    return null;
  }
}

function getMyMessages(): MyBirthdayMessage[] {
  const raw = readMyRaw();
  if (raw !== myRaw) {
    myRaw = raw;
    myParsed = parseMyBirthdayMessages(raw);
  }
  return myParsed;
}

function writeMyMessages(list: MyBirthdayMessage[]) {
  try {
    window.localStorage.setItem(MY_BIRTHDAY_MESSAGES_KEY, JSON.stringify(list));
  } catch {
    /* 저장 공간이 없거나 막혀 있으면 사본만 건너뛴다 */
  }
  window.dispatchEvent(new Event(MY_MESSAGES_EVENT));
}

function subscribeMyMessages(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === MY_BIRTHDAY_MESSAGES_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(MY_MESSAGES_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(MY_MESSAGES_EVENT, listener);
  };
}

export function useMyBirthdayMessages(): MyBirthdayMessage[] {
  return useSyncExternalStore(subscribeMyMessages, getMyMessages, () => EMPTY);
}

export function saveMyBirthdayMessage(message: MyBirthdayMessage) {
  writeMyMessages(addMyBirthdayMessage(getMyMessages(), message));
}

export function hideMyBirthdayMessage(localId: string) {
  writeMyMessages(removeMyBirthdayMessage(getMyMessages(), localId));
}

export function newLocalMessageId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
