"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Instagram, Link2, Share2, Twitter } from "lucide-react";

type PageShareButtonProps = {
  shareTitle: string;
};

async function copyCurrentPageUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}

export function PageShareButton({ shareTitle }: PageShareButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3800);
  }, []);

  const handleCopyLink = async () => {
    const ok = await copyCurrentPageUrl();
    if (ok) {
      showToast("주소가 복사되었습니다. 원하는 곳에 붙여넣으세요!");
      setMenuOpen(false);
    } else {
      window.prompt("주소를 복사해 주세요:", window.location.href);
    }
  };

  const handleTwitterShare = () => {
    const href = window.location.href;
    const draft = `${shareTitle}\n\n${href}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(draft)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setMenuOpen(false);
  };

  const handleInstagramShare = async () => {
    const ok = await copyCurrentPageUrl();
    if (ok) {
      showToast("링크를 복사했습니다. 인스타 스토리나 프로필에 공유해 보세요!");
    } else {
      window.prompt("주소를 복사해 주세요:", window.location.href);
    }
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <>
      <div ref={wrapRef} className="relative">
        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              key="share-menu"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-full z-50 mt-2 flex w-[15.5rem] flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg"
              role="menu"
              aria-label="공유 메뉴"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleTwitterShare}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                <Twitter className="h-[18px] w-[18px] shrink-0" aria-hidden />
                트위터 / X
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCopyLink()}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                <Link2 className="h-[18px] w-[18px] shrink-0" aria-hidden />
                링크 복사
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleInstagramShare()}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                <Instagram className="h-[18px] w-[18px] shrink-0" aria-hidden />
                인스타그램
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="공유하기"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 py-2 text-xs text-zinc-700 transition hover:bg-zinc-50"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          공유
        </button>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast}
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[80] max-w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-zinc-950/90 px-4 py-3 text-center text-[13px] font-medium leading-snug text-white shadow-xl backdrop-blur-md sm:bottom-8"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
