import { useSyncExternalStore } from "react";

/**
 * 화면 전체가 함께 쓰는 1초 시계. 매번 Date.now() 기준으로 다시 계산하고,
 * 탭이 다시 보이면 바로 갱신한다. 서버 렌더와 첫 하이드레이션에서는 null.
 *
 * 개발 서버에서만 ?now=2026-10-14T21:59:50 (시간대 생략 시 KST) 로 시각을 옮겨 볼 수 있다.
 */

let offsetMs: number | null = null;

function readOffset(): number {
  if (offsetMs !== null) return offsetMs;
  offsetMs = 0;
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    const raw = new URLSearchParams(window.location.search).get("now")?.trim();
    if (raw) {
      const iso = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}+09:00`;
      const target = Date.parse(iso);
      if (!Number.isNaN(target)) offsetMs = target - Date.now();
    }
  }
  return offsetMs;
}

export function clockNow(): number {
  return Date.now() + readOffset();
}

let snapshot: number | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function emit() {
  snapshot = clockNow();
  listeners.forEach((listener) => listener());
}

function scheduleNextSecond() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    emit();
    scheduleNextSecond();
  }, 1000 - (clockNow() % 1000) + 5);
}

function onVisibilityChange() {
  if (document.visibilityState !== "visible") return;
  emit();
  scheduleNextSecond();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    snapshot = clockNow();
    scheduleNextSecond();
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    snapshot = null;
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => null;

/** 현재 시각(ms). 마운트 전에는 null */
export function useClock(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
