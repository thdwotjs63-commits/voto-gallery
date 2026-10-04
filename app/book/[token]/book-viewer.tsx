"use client";

import "./book.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { BOOK_DATE_LABEL, BOOK_EDITOR_LETTER, BOOK_TITLE_LINES } from "@/lib/book-content";
import { formatBookDate, isLongBookMessage, type BookMessage, type BookPage } from "@/lib/book-pages";

const SWIPE_MIN_PX = 48;
const FIT_MIN = 0.75;
const FIT_STEP = 0.04;

/** 펼친 페이지 글이 넘치면 글자 크기를 조금씩 줄여 한 화면에 맞춘다 (모자라면 페이지 안 스크롤) */
function fitSheet(sheet: HTMLElement) {
  let fit = 1;
  sheet.style.setProperty("--book-fit", "1");
  while (sheet.scrollHeight > sheet.clientHeight + 1 && fit > FIT_MIN) {
    fit = Math.max(FIT_MIN, fit - FIT_STEP);
    sheet.style.setProperty("--book-fit", fit.toFixed(2));
  }
}

type Direction = "next" | "prev" | null;

export function BookViewer({ pages }: { pages: BookPage[] }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<Direction>(null);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const total = pages.length;

  const fitActivePage = useCallback(() => {
    const sheet = stageRef.current?.querySelector<HTMLElement>(
      '.book-page[data-active="true"] .book-sheet'
    );
    if (sheet) fitSheet(sheet);
  }, []);

  useLayoutEffect(() => {
    fitActivePage();
  }, [index, fitActivePage]);

  useEffect(() => {
    window.addEventListener("resize", fitActivePage);
    return () => window.removeEventListener("resize", fitActivePage);
  }, [fitActivePage]);

  const go = useCallback(
    (delta: 1 | -1) => {
      const next = Math.min(Math.max(index + delta, 0), total - 1);
      if (next === index) return;
      setDirection(delta === 1 ? "next" : "prev");
      setIndex(next);
    },
    [index, total]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    go(dx < 0 ? 1 : -1);
  };

  return (
    <div className="book-root">
      <div
        ref={stageRef}
        className="book-stage"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => (pointerStart.current = null)}
      >
        {pages.map((page, i) => (
          <section
            key={i === index ? `active-${index}` : `page-${i}`}
            className={`book-page book-page--${page.kind}${
              i === index && direction ? ` book-page--enter-${direction}` : ""
            }`}
            data-active={i === index}
            aria-hidden={i !== index}
            aria-label={`${i + 1} / ${total} 페이지`}
          >
            <BookPageContent page={page} />
          </section>
        ))}
      </div>

      <nav className="book-controls" aria-label="페이지 넘기기">
        <button
          type="button"
          className="book-arrow"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="이전 페이지"
        >
          ‹
        </button>
        <p className="book-counter" aria-live="polite">
          {index + 1} / {total}
        </p>
        <button
          type="button"
          className="book-arrow"
          onClick={() => go(1)}
          disabled={index === total - 1}
          aria-label="다음 페이지"
        >
          ›
        </button>
      </nav>
    </div>
  );
}

function BookPageContent({ page }: { page: BookPage }) {
  switch (page.kind) {
    case "cover":
      return (
        <div className="book-cover">
          <span className="book-brush book-brush--red-1" aria-hidden />
          <span className="book-brush book-brush--red-2" aria-hidden />
          <span className="book-brush book-brush--red-3" aria-hidden />
          <span className="book-brush book-brush--navy-1" aria-hidden />
          <span className="book-brush book-brush--navy-2" aria-hidden />
          <span className="book-brush book-brush--navy-3" aria-hidden />
          <p className="book-cover-eyebrow">DAENI.KR · BIRTHDAY BOOK</p>
          <h1 className="book-cover-title">
            {BOOK_TITLE_LINES.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p className="book-cover-date">{BOOK_DATE_LABEL}</p>
          <p className="book-cover-number">#3</p>
        </div>
      );
    case "letter":
      return (
        <div className="book-sheet book-letter">
          <h2 className="book-sheet-title">{BOOK_EDITOR_LETTER.title}</h2>
          <div className="book-letter-body">
            {BOOK_EDITOR_LETTER.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="book-letter-sign">{BOOK_EDITOR_LETTER.signature}</p>
        </div>
      );
    case "messages":
      return (
        <div className="book-sheet book-messages">
          {page.items.map((item) => (
            <BookMessageCard key={item.id} item={item} />
          ))}
        </div>
      );
    case "empty":
      return (
        <div className="book-sheet book-center">
          <p className="book-empty">아직 실린 메시지가 없어요</p>
        </div>
      );
    case "end":
      return (
        <div className="book-sheet book-center book-end">
          <p className="book-end-count">
            총 {page.count}명의 팬이
            <br />
            마음을 보냈어요 💌
          </p>
          <p className="book-end-site">daeni.kr</p>
          <button type="button" className="book-print" onClick={() => window.print()}>
            PDF로 저장
          </button>
        </div>
      );
  }
}

function BookMessageCard({ item }: { item: BookMessage }) {
  return (
    <article className={`book-message${isLongBookMessage(item.message) ? " book-message--long" : ""}`}>
      <p className="book-message-from">
        <span>From.</span> {item.nickname}
      </p>
      <p className="book-message-text">{item.message}</p>
      <p className="book-message-date">{formatBookDate(item.created_at)}</p>
    </article>
  );
}
