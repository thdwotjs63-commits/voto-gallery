"use client";

import "./daeni-4cut-home-popup.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

const POPUP_ENABLED = true;
const POPUP_ID = "daeni-4cut-asian-v2";
const POPUP_END_DATE = "2026-10-31";

const SESSION_DISMISS_KEY = `popup-dismiss-session-${POPUP_ID}`;
const HIDE_UNTIL_KEY = `popup-hide-until-${POPUP_ID}`;

function todayLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

function shouldDisplayPopup(): boolean {
  if (!POPUP_ENABLED) return false;
  if (todayLocalDateKey() > POPUP_END_DATE) return false;
  if (safeGetItem(sessionStorage, SESSION_DISMISS_KEY) === "1") return false;
  if (safeGetItem(localStorage, HIDE_UNTIL_KEY) === todayLocalDateKey()) return false;
  return true;
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function Daeni4CutHomePopup() {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const closeForSession = useCallback(() => {
    safeSetItem(sessionStorage, SESSION_DISMISS_KEY, "1");
    setOpen(false);
  }, []);

  const hideForToday = useCallback(() => {
    safeSetItem(localStorage, HIDE_UNTIL_KEY, todayLocalDateKey());
    setOpen(false);
  }, []);

  const goToPhoto = useCallback(() => {
    closeForSession();
    router.push("/photo?frame=daein-2");
  }, [closeForSession, router]);

  useEffect(() => {
    setPortalReady(true);
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!shouldDisplayPopup()) return;
    const t = window.setTimeout(() => setOpen(true), 300);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const focusT = window.setTimeout(() => primaryBtnRef.current?.focus(), 40);
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
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
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

  if (!portalReady || !open) return null;

  return createPortal(
    <div
      className={`daeni4cut-popup-root${open ? " daeni4cut-popup-root--visible" : ""}${
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
        <span className="daeni4cut-popup-new">NEW</span>
        <h2 id={titleId} className="daeni4cut-popup-title">
          다인네컷 아시안게임 버전 프레임 출시!
        </h2>
        <div className="daeni4cut-popup-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/frames/daein-2.png"
            alt=""
            className="daeni4cut-popup-previewImg"
          />
        </div>
        <button
          ref={primaryBtnRef}
          type="button"
          className="daeni4cut-popup-cta"
          onClick={goToPhoto}
        >
          사진 찍으러 가기
        </button>
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
