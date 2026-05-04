"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_VOTO_CATEGORY,
  VOTO_CATEGORIES,
  type VotoCategoryId,
} from "@/lib/voto-categories";
import type { VotoImage } from "@/lib/voto-gallery-data";
import {
  buildAggregatedTags,
  filterImagesByQuery,
  matchingTagsForQuery,
  type AggregatedSearchTag,
} from "@/lib/voto-search-index";

const BLUR_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjcyNzI3Ii8+PC9zdmc+";

export function VotoCategoryHome() {
  const [category, setCategory] = useState<VotoCategoryId>(DEFAULT_VOTO_CATEGORY);
  const [images, setImages] = useState<VotoImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<VotoImage | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const aggregatedTags = useMemo(() => buildAggregatedTags(images), [images]);
  const filteredImages = useMemo(
    () => filterImagesByQuery(images, searchQuery),
    [images, searchQuery]
  );
  const suggestions = useMemo(
    () => matchingTagsForQuery(aggregatedTags, searchQuery),
    [aggregatedTags, searchQuery]
  );

  const showDropdown =
    dropdownOpen && searchQuery.trim().length >= 1 && suggestions.length > 0;

  const loadCategory = useCallback(async (cat: VotoCategoryId, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/voto-gallery?category=${encodeURIComponent(cat)}`, {
        cache: "no-store",
        signal,
      });
      const payload = (await res.json()) as VotoImage[] | { error?: string };
      if (!res.ok) {
        const msg =
          typeof (payload as { error?: string }).error === "string"
            ? (payload as { error: string }).error
            : `Request failed (${res.status})`;
        throw new Error(msg);
      }
      setImages(payload as VotoImage[]);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setImages([]);
      setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadCategory(category, ac.signal);
    return () => ac.abort();
  }, [category, loadCategory]);

  useEffect(() => {
    setSearchQuery("");
    setHighlightIndex(-1);
    setDropdownOpen(false);
  }, [category]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const node = searchWrapRef.current;
      if (!node || node.contains(e.target as Node)) return;
      setDropdownOpen(false);
      setHighlightIndex(-1);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const applySuggestion = useCallback((tag: AggregatedSearchTag) => {
    setSearchQuery(tag.display);
    setDropdownOpen(false);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  }, []);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown && e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setDropdownOpen(true);
      setHighlightIndex(0);
      return;
    }
    if (!showDropdown) {
      if (e.key === "Escape") setDropdownOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        applySuggestion(suggestions[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDropdownOpen(false);
      setHighlightIndex(-1);
    }
  };

  useEffect(() => {
    if (highlightIndex >= suggestions.length) {
      setHighlightIndex(suggestions.length > 0 ? suggestions.length - 1 : -1);
    }
  }, [highlightIndex, suggestions.length]);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0c0c0e]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 transition hover:text-zinc-300"
            >
              ← daeni.kr 홈
            </Link>
            <div className="h-4 w-px bg-white/15" aria-hidden />
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Voto Photo
            </h1>
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
              4 categories
            </span>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="카테고리">
            {VOTO_CATEGORIES.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`min-h-9 touch-manipulation rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                  category === tab.id
                    ? "border-amber-400/80 bg-amber-400/15 text-amber-100"
                    : "border-white/15 bg-white/5 text-zinc-300 hover:border-white/25 hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-zinc-400">
          현대건설 · 팀코리아 · 브이리그 · 실업배구 — 각 드라이브 폴더와 그 안의 하위 폴더까지 사진을 모읍니다. 썸네일은 Google Drive에서 직접 제공되며
          Vercel 이미지 최적화는 사용하지 않습니다.
        </p>

        {!loading && !error && images.length > 0 ? (
          <div ref={searchWrapRef} className="relative z-30 mb-6 max-w-xl">
            <label htmlFor="voto-search" className="mb-1.5 block text-xs font-medium text-zinc-500">
              태그 · 파일명 검색
            </label>
            <input
              ref={inputRef}
              id="voto-search"
              type="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(ev) => {
                const v = ev.target.value;
                setSearchQuery(v);
                const next = matchingTagsForQuery(aggregatedTags, v);
                setDropdownOpen(v.trim().length >= 1);
                setHighlightIndex(v.trim().length >= 1 && next.length > 0 ? 0 : -1);
              }}
              onFocus={() => {
                const next = matchingTagsForQuery(aggregatedTags, searchQuery);
                if (searchQuery.trim().length >= 1 && next.length > 0) {
                  setDropdownOpen(true);
                  setHighlightIndex(0);
                }
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="태그·선수명·파일명 일부 입력…"
              className="w-full rounded-lg border border-white/15 bg-zinc-900/90 px-3 py-2.5 text-sm text-white outline-none ring-amber-400/0 placeholder:text-zinc-600 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/25"
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls="voto-search-suggestions"
              aria-autocomplete="list"
            />
            {showDropdown ? (
              <ul
                id="voto-search-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/15 bg-zinc-900 py-1 shadow-xl"
              >
                {suggestions.map((tag, idx) => (
                  <li key={tag.normalized} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={idx === highlightIndex}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                        idx === highlightIndex ? "bg-amber-400/15 text-amber-50" : "text-zinc-200 hover:bg-white/5"
                      }`}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        applySuggestion(tag);
                      }}
                      onMouseEnter={() => setHighlightIndex(idx)}
                    >
                      <span className="min-w-0 truncate font-medium">{tag.display}</span>
                      <span className="shrink-0 tabular-nums text-zinc-500">({tag.count})</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {searchQuery.trim().length >= 1 && !loading && suggestions.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">일치하는 태그·토큰이 없습니다. 파일명·설명으로는 아래 그리드가 필터됩니다.</p>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">불러오는 중…</p>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
            <p className="mt-2 text-xs text-rose-200/80">
              Vercel / 로컬 환경에 각 카테고리 폴더 ID(`VOTO_DRIVE_FOLDER_*`)와 Drive API 키가 설정돼 있는지 확인해 주세요.
            </p>
          </div>
        ) : images.length === 0 ? (
          <p className="text-sm text-zinc-500">이 폴더에 표시할 이미지가 없습니다.</p>
        ) : (
          <>
            {searchQuery.trim().length > 0 ? (
              <p className="mb-3 text-xs text-zinc-500">
                {filteredImages.length}장 표시 (전체 {images.length}장)
              </p>
            ) : null}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
              {filteredImages.map((img) => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => setPreview(img)}
                    className="relative block w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900 outline-none ring-amber-400/0 transition hover:border-amber-400/40 focus-visible:ring-2"
                    style={{
                      aspectRatio: `${img.width} / ${img.height}`,
                    }}
                  >
                    <Image
                      src={img.thumbSrc}
                      alt={img.name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                      placeholder="blur"
                      blurDataURL={BLUR_PLACEHOLDER}
                    />
                  </button>
                </li>
              ))}
            </ul>
            {filteredImages.length === 0 ? (
              <p className="mt-4 text-center text-sm text-zinc-500">검색 결과가 없습니다.</p>
            ) : null}
          </>
        )}
      </main>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/92 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="사진 크게 보기"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-zinc-400">{preview.name}</p>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={preview.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
              >
                다운로드
              </a>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
              >
                닫기
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            <Image
              src={preview.fullSrc}
              alt={preview.name}
              fill
              unoptimized
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 1100px"
              priority
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
