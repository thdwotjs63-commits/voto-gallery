"use client";

import "./daeni-4cut-home-popup.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { clockNow } from "@/lib/clock";
import { seoulDateKey } from "@/lib/home-notice";
import { TIER_TEAMS_CORE } from "@/lib/players-roster";

const TIER_URL = "/tier";

const POPUP_ENABLED = true;
/** 취향표 홍보 — 생일/네컷 팝업과 별도 키 (최근 홍보 우선 교체) */
const POPUP_ID = "home-notice-tier";

const SESSION_DISMISS_KEY = `popup-dismiss-session-${POPUP_ID}`;
const HIDE_UNTIL_KEY = `popup-hide-until-${POPUP_ID}`;

function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function shouldShowPopup(): boolean {
  if (!POPUP_ENABLED) return false;
  const today = seoulDateKey(new Date(clockNow()));
  if (safeGetItem(sessionStorage, SESSION_DISMISS_KEY) === "1") return false;
  if (safeGetItem(localStorage, HIDE_UNTIL_KEY) === today) return false;
  return true;
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function TierHomePopup() {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const closeForSession = useCallback(() => {
    safeSetItem(sessionStorage, SESSION_DISMISS_KEY, "1");
    setOpen(false);
  }, []);

  const hideForToday = useCallback(() => {
    safeSetItem(localStorage, HIDE_UNTIL_KEY, seoulDateKey(new Date(clockNow())));
    setOpen(false);
  }, []);

  const goToTier = useCallback(() => {
    closeForSession();
    router.push(TIER_URL);
  }, [closeForSession, router]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!shouldShowPopup()) return;
      setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setOpen(true);
    }, 300);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const focusT = window.setTimeout(() => ctaRef.current?.focus(), 40);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(focusT);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeForSession();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = getFocusableElements(dialogRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeForSession]);

  if (!open) return null;

  return createPortal(
    <div
      className={`daeni4cut-popup-root daeni4cut-popup-root--visible${
        reduceMotion ? " daeni4cut-popup-root--reduce-motion" : ""
      }`}
    >
      <button
        type="button"
        className="daeni4cut-popup-backdrop"
        aria-label="공지 닫기"
        onClick={closeForSession}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="daeni4cut-popup-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="daeni4cut-popup-heading">
          daeni.kr 소식
        </h2>

        <div className="daeni4cut-popup-list">
          <section className="daeni4cut-popup-item">
            <span className="daeni4cut-popup-pill daeni4cut-popup-pill--navy">NEW</span>
            <h3 className="daeni4cut-popup-title">🏐 KOVO 여자배구 취향표 오픈!</h3>
            <p className="daeni4cut-popup-desc">
              7개 구단 최애를 골라 나만의 취향표를 만들어 보세요. 친구 링크를 모아 한 장으로 저장할 수
              있어요.
            </p>
            <div
              className="mt-2 flex overflow-hidden rounded-lg border border-zinc-200"
              aria-hidden
            >
              {TIER_TEAMS_CORE.map((team) => (
                <span
                  key={team.id}
                  className="h-8 flex-1"
                  style={{ background: team.color }}
                  title={team.label}
                />
              ))}
            </div>
            <button
              ref={ctaRef}
              type="button"
              className="daeni4cut-popup-cta daeni4cut-popup-cta--navy mt-3"
              onClick={goToTier}
            >
              취향표 만들러 가기
            </button>
          </section>
        </div>

        <div className="daeni4cut-popup-actions">
          <button type="button" className="daeni4cut-popup-linkBtn" onClick={hideForToday}>
            오늘 하루 보지 않기
          </button>
          <button type="button" className="daeni4cut-popup-linkBtn" onClick={closeForSession}>
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
