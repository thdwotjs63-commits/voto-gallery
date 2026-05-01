"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import placeholder from "@/lib/changelog.placeholder.json";

export type ChangelogEntry = {
  version: string;
  isoDate: string;
  subject: string;
};

const PANEL_INITIAL = 6;

function formatCommitWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function GalleryChangelog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>(
    placeholder as unknown as ChangelogEntry[]
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/changelog.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : placeholder))
      .then((data: ChangelogEntry[]) => {
        if (!cancelled && Array.isArray(data)) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setEntries(placeholder as unknown as ChangelogEntry[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      setPanelOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [panelOpen]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setListExpanded(false);
  }, []);

  if (entries.length === 0) {
    return null;
  }

  const shownInPanel = listExpanded ? entries : entries.slice(0, PANEL_INITIAL);
  const hasMoreInPanel = entries.length > PANEL_INITIAL;

  return (
    <div ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => {
          setPanelOpen((o) => !o);
          if (panelOpen) setListExpanded(false);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#00287A]/40 bg-white px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#00287A] shadow-sm transition hover:border-[#00287A] hover:bg-[#00287A]/5 active:scale-[0.98]"
        aria-expanded={panelOpen}
        aria-controls="gallery-changelog-panel"
        id="gallery-changelog-trigger"
      >
        <History className="h-3.5 w-3.5 shrink-0 text-[#00287A]" aria-hidden />
        <span>업데이트</span>
        <span className="rounded-full bg-[#FFD200] px-1.5 py-px font-mono text-[10px] font-bold tabular-nums text-[#00287A]">
          {entries.length}
        </span>
      </button>

      {panelOpen ? (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/20 sm:hidden"
            aria-hidden
            onClick={closePanel}
          />
          <div
            ref={panelRef}
            id="gallery-changelog-panel"
            role="region"
            aria-labelledby="gallery-changelog-trigger"
            className="fixed left-3 right-3 top-[max(5rem,env(safe-area-inset-top,0px)+4rem)] z-[80] max-h-[min(70vh,28rem)] overflow-hidden rounded-2xl border border-[#00287A]/20 bg-white shadow-[0_20px_50px_rgba(0,40,122,0.18)] sm:absolute sm:inset-auto sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-[min(22rem,calc(100vw-3rem))] sm:max-h-[min(70vh,26rem)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#00287A]/10 bg-[#00287A]/5 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#00287A]">
                업데이트 내역
              </p>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-full px-2 py-1 text-xs text-zinc-500 transition hover:bg-black/5 hover:text-zinc-800"
                aria-label="닫기"
              >
                닫기
              </button>
            </div>
            <ul className="max-h-[min(58vh,22rem)] space-y-2 overflow-y-auto overscroll-contain px-3 py-2.5 sm:max-h-[min(52vh,20rem)]">
              {shownInPanel.map((row, index) => (
                <li
                  key={`${row.version}-${row.isoDate}-${index}`}
                  className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-2.5 py-2 text-left"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 gap-y-0.5">
                    <span className="inline-flex shrink-0 items-center rounded border border-[#FFD200]/90 bg-[#FFD200] px-1 py-px font-mono text-[10px] font-bold tabular-nums text-[#00287A]">
                      {row.version}
                    </span>
                    <time
                      dateTime={row.isoDate}
                      className="text-[10px] tabular-nums text-zinc-500"
                    >
                      {formatCommitWhen(row.isoDate)}
                    </time>
                  </div>
                  <p className="text-[11px] leading-snug text-zinc-700">{row.subject}</p>
                </li>
              ))}
            </ul>
            {hasMoreInPanel ? (
              <div className="border-t border-[#00287A]/10 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setListExpanded((v) => !v)}
                  className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-[#00287A] transition hover:text-[#00287A]/80"
                >
                  {listExpanded ? (
                    <>
                      접기 <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                    </>
                  ) : (
                    <>
                      더 보기 ({entries.length - PANEL_INITIAL}){" "}
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
