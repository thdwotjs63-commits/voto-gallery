"use client";

import "./book.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from "react";
import { BOOK_DATE_LABEL, BOOK_EDITOR_LETTER, BOOK_TITLE_LINES } from "@/lib/book-content";
import {
  findMessagePagesByNickname,
  formatBookDate,
  isLongBookItem,
  isLongBookMessage,
  parseBookPageInput,
  type BookMessage,
  type BookPage,
} from "@/lib/book-pages";
import type { SourceLanguage } from "@/lib/translate";

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

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
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

  const jumpTo = useCallback(
    (target: number) => {
      const next = Math.min(Math.max(target, 0), total - 1);
      if (next === index) return;
      setDirection(next > index ? "next" : "prev");
      setIndex(next);
    },
    [index, total]
  );

  const go = useCallback((delta: 1 | -1) => jumpTo(index + delta), [index, jumpTo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

  const [searchOpen, setSearchOpen] = useState(false);
  const searchToggleRef = useRef<HTMLButtonElement>(null);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    searchToggleRef.current?.focus({ preventScroll: true });
  }, []);

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
        <PageNumberField index={index} total={total} onJump={jumpTo} />
        <button
          type="button"
          className="book-arrow"
          onClick={() => go(1)}
          disabled={index === total - 1}
          aria-label="다음 페이지"
        >
          ›
        </button>
        <button
          ref={searchToggleRef}
          type="button"
          className="book-search-toggle"
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          aria-label="닉네임으로 메시지 찾기"
          aria-expanded={searchOpen}
          aria-controls="book-search"
        >
          <SearchIcon />
        </button>
      </nav>

      <p className="book-visually-hidden" aria-live="polite">
        {index + 1} / {total} 페이지
      </p>

      {searchOpen ? (
        <NicknameSearch
          pages={pages}
          currentIndex={index}
          onPick={(pageIndex) => {
            jumpTo(pageIndex);
            closeSearch();
          }}
          onClose={closeSearch}
        />
      ) : null}
    </div>
  );
}

/** 하단 "현재 / 전체" 의 현재 숫자 — 직접 쳐서 엔터·포커스 아웃 하면 그 페이지로 */
function PageNumberField({
  index,
  total,
  onJump,
}: {
  index: number;
  total: number;
  onJump: (pageIndex: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const handleBlur = () => {
    const cancelled = cancelRef.current;
    cancelRef.current = false;
    setDraft(null);
    if (cancelled || draft === null) return;
    const target = parseBookPageInput(draft, total);
    if (target !== null) onJump(target);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      cancelRef.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <form className="book-counter" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="book-counter-input"
        style={{ width: `calc(${String(total).length}ch + 14px)` }}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="go"
        autoComplete="off"
        aria-label={`페이지 번호 (1–${total})`}
        value={draft ?? String(index + 1)}
        onFocus={(event) => {
          const input = event.currentTarget;
          setDraft(String(index + 1));
          requestAnimationFrame(() => input.select());
        }}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <span className="book-counter-total" aria-hidden>
        / {total}
      </span>
    </form>
  );
}

function NicknameSearch({
  pages,
  currentIndex,
  onPick,
  onClose,
}: {
  pages: BookPage[];
  currentIndex: number;
  onPick: (pageIndex: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const hits = useMemo(() => findMessagePagesByNickname(pages, query), [pages, query]);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="book-search-layer">
      <button type="button" className="book-search-scrim" onClick={onClose} aria-label="검색 닫기" tabIndex={-1} />
      <div
        id="book-search"
        className="book-search"
        role="dialog"
        aria-label="닉네임으로 메시지 찾기"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <form className="book-search-bar" role="search" onSubmit={(event) => event.preventDefault()}>
          <SearchIcon />
          <input
            className="book-search-input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
            placeholder="닉네임으로 찾기"
            aria-label="닉네임 검색어"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="book-search-close" onClick={onClose}>
            닫기
          </button>
        </form>

        {hasQuery ? (
          hits.length > 0 ? (
            <>
              <p className="book-search-count">{hits.length}개 찾았어요</p>
              <ul className="book-search-results">
                {hits.map((hit) => (
                  <li key={`${hit.pageIndex}-${hit.nickname}`}>
                    <button
                      type="button"
                      className="book-search-result"
                      aria-current={hit.pageIndex === currentIndex ? "page" : undefined}
                      onClick={() => onPick(hit.pageIndex)}
                    >
                      <span className="book-search-name">{hit.nickname}</span>
                      <span className="book-search-page">· {hit.pageIndex + 1}페이지</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="book-search-empty">검색 결과가 없어요</p>
          )
        ) : (
          <p className="book-search-hint">닉네임 일부만 써도 찾아드려요</p>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="book-search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BookPageContent({ page }: { page: BookPage }) {
  switch (page.kind) {
    case "cover":
      return (
        <div className="book-cover">
          <span className="book-cover-photo" aria-hidden />
          <span className="book-cover-veil" aria-hidden />
          <p className="book-cover-eyebrow">BIRTHDAY MESSAGE BOOK</p>
          <h1 className="book-cover-title">
            {BOOK_TITLE_LINES.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p className="book-cover-date">{BOOK_DATE_LABEL}</p>
          <p className="book-cover-number">#3</p>
          {page.count > 0 ? <p className="book-cover-count">{page.count}명이 참여해 주었어요</p> : null}
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
    case "foreign-intro":
      return (
        <div className="book-sheet book-center book-foreign-intro">
          <p className="book-foreign-intro-emoji" aria-hidden>
            🌏
          </p>
          <h2 className="book-foreign-intro-title">해외 팬들의 메시지</h2>
          <p className="book-foreign-intro-desc">
            다른 나라 팬들이 보내준 축하예요.
            <br />
            원문과 번역을 함께 담았어요.
          </p>
        </div>
      );
    case "foreign":
      return (
        <div className="book-sheet book-messages">
          {page.items.map((item) => (
            <ForeignMessageCard key={item.id} item={item} />
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

const LANGUAGE_LABEL: Record<SourceLanguage, string> = {
  id: "인도네시아어",
  en: "영어",
  ja: "일본어",
};

function ForeignMessageCard({ item }: { item: BookMessage }) {
  const language = item.sourceLang ? LANGUAGE_LABEL[item.sourceLang] : "외국어";
  return (
    <article className={`book-message${isLongBookItem(item) ? " book-message--long" : ""}`}>
      <p className="book-message-from">
        <span>From.</span> {item.nickname}
      </p>
      <p className="book-message-text">{item.message}</p>
      <p className="book-message-lang">({language})</p>
      {item.translation ? (
        <div className="book-message-translation" lang="ko">
          <span className="book-translation-badge">번역</span>
          <p>{item.translation}</p>
        </div>
      ) : null}
      <p className="book-message-date">{formatBookDate(item.created_at)}</p>
    </article>
  );
}
