"use client";

import "./daeni-4cut-home-popup.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BIRTHDAY_DEADLINE } from "@/lib/birthday";
import { birthdayCardPill, isOnOrBeforeDate, seoulDateKey } from "@/lib/home-notice";

const BIRTHDAY_DATE = "2026-10-15"; // 생일 날짜
const BIRTHDAY_SHOW_FROM = "2026-10-04"; // 이 날부터 카드 노출 (마감 시각 BIRTHDAY_DEADLINE 에 숨김)
const PHOTO_END_DATE = "2026-10-31";

const BIRTHDAY_URL = "/birthday";
const PHOTO_URL = "/photo?frame=daein-2";

const POPUP_ENABLED = true;
const POPUP_ID = "home-notice-birthday-4cut";

const SESSION_DISMISS_KEY = `popup-dismiss-session-${POPUP_ID}`;
const HIDE_UNTIL_KEY = `popup-hide-until-${POPUP_ID}`;

type NoticeCards = {
  /** 생일 카드 pill 문구, 카드 숨김이면 null */
  birthdayPill: string | null;
  showPhoto: boolean;
};

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

function resolveNoticeCards(): NoticeCards | null {
  if (!POPUP_ENABLED) return null;
  const now = new Date();
  const today = seoulDateKey(now);
  if (safeGetItem(sessionStorage, SESSION_DISMISS_KEY) === "1") return null;
  if (safeGetItem(localStorage, HIDE_UNTIL_KEY) === today) return null;

  const cards: NoticeCards = {
    birthdayPill: birthdayCardPill(now, BIRTHDAY_SHOW_FROM, BIRTHDAY_DATE, BIRTHDAY_DEADLINE),
    showPhoto: isOnOrBeforeDate(today, PHOTO_END_DATE),
  };
  if (cards.birthdayPill === null && !cards.showPhoto) return null;
  return cards;
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
  const birthdayBtnRef = useRef<HTMLButtonElement>(null);
  const photoBtnRef = useRef<HTMLButtonElement>(null);
  const [cards, setCards] = useState<NoticeCards | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const open = cards !== null;

  const closeForSession = useCallback(() => {
    safeSetItem(sessionStorage, SESSION_DISMISS_KEY, "1");
    setCards(null);
  }, []);

  const hideForToday = useCallback(() => {
    safeSetItem(localStorage, HIDE_UNTIL_KEY, seoulDateKey());
    setCards(null);
  }, []);

  const goTo = useCallback(
    (href: string) => {
      closeForSession();
      router.push(href);
    },
    [closeForSession, router]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = resolveNoticeCards();
      if (!next) return;
      setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setCards(next);
    }, 300);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const focusT = window.setTimeout(
      () => (birthdayBtnRef.current ?? photoBtnRef.current)?.focus(),
      40
    );
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

  if (!cards) return null;

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
          {cards.birthdayPill !== null ? (
            <section className="daeni4cut-popup-item">
              <span className="daeni4cut-popup-pill daeni4cut-popup-pill--red">
                {cards.birthdayPill}
              </span>
              <h3 className="daeni4cut-popup-title">봉탄신일이 다가옵니다! 🎂</h3>
              <p className="daeni4cut-popup-desc">
                다인 선수에게 생일 축하 메시지를 남겨주세요
              </p>
              <button
                ref={birthdayBtnRef}
                type="button"
                className="daeni4cut-popup-cta daeni4cut-popup-cta--red"
                onClick={() => goTo(BIRTHDAY_URL)}
              >
                💌 생일 메시지 쓰러 가기
              </button>
            </section>
          ) : null}

          {cards.showPhoto ? (
            <section className="daeni4cut-popup-item">
              <span className="daeni4cut-popup-pill daeni4cut-popup-pill--navy">NEW</span>
              <h3 className="daeni4cut-popup-title">
                다인네컷 아시안게임 버전 프레임 출시!
              </h3>
              <div className="daeni4cut-popup-photoRow">
                <div className="daeni4cut-popup-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/frames/daein-2.png"
                    alt=""
                    className="daeni4cut-popup-thumbImg"
                  />
                </div>
                <div className="daeni4cut-popup-photoBody">
                  <p className="daeni4cut-popup-desc">다인이랑 같이 네 컷 찍어봐요</p>
                  <button
                    ref={photoBtnRef}
                    type="button"
                    className="daeni4cut-popup-cta daeni4cut-popup-cta--navy"
                    onClick={() => goTo(PHOTO_URL)}
                  >
                    📸 사진 찍으러 가기
                  </button>
                </div>
              </div>
            </section>
          ) : null}
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
