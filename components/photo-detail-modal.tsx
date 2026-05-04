"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { trackGaEvent } from "@/lib/analytics";
import { driveLh3FullDisplayUrl, type DriveImage } from "@/lib/drive-gallery-data";

const THUMB_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTBlMGUwIi8+PC9zdmc+";

type PhotoDetailModalProps = {
  image: DriveImage;
  onClose: () => void;
};

export function PhotoDetailModal({ image, onClose }: PhotoDetailModalProps) {
  const [shareHint, setShareHint] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    setShareHint(null);
    const shareData = {
      title: image.name,
      text: image.scheduleDisplay ?? image.name,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
      setShareHint("링크를 복사했어요.");
      window.setTimeout(() => setShareHint(null), 2000);
    } catch {
      setShareHint("복사에 실패했어요.");
      window.setTimeout(() => setShareHint(null), 2000);
    }
  }, [image.name, image.scheduleDisplay]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-detail-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-left text-sm font-medium tracking-wide text-white/90 underline-offset-4 hover:text-white hover:underline"
        >
          ← 갤러리
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="닫기"
        >
          ×
        </button>
      </header>

      <div className="relative min-h-0 flex-1 bg-black">
        <Image
          src={driveLh3FullDisplayUrl(image.id)}
          alt={image.name}
          fill
          priority
          unoptimized
          className="object-contain"
          sizes="(max-width: 768px) 100vw, min(96vw, 1100px)"
          placeholder="blur"
          blurDataURL={THUMB_BLUR_DATA_URL}
        />
      </div>

      <footer className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0 flex-1 space-y-1 text-left">
            <h1
              id="photo-detail-title"
              className="line-clamp-2 break-words text-sm font-medium text-white/95"
            >
              {image.name}
            </h1>
            {image.scheduleDisplay ? (
              <p className="line-clamp-2 break-words text-xs text-white/55">{image.scheduleDisplay}</p>
            ) : null}
            {image.tags.length > 0 ? (
              <p className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-white/45">
                {image.tags.map((tag) => (
                  <span key={tag} className="break-all">
                    {tag}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:pt-0.5">
            <a
              href={image.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/10 px-4 text-xs font-medium text-white transition hover:bg-white/20"
              onClick={() =>
                trackGaEvent("photo_download", {
                  location: "photo_detail_modal",
                  photo_id: image.id,
                })
              }
            >
              원본 다운로드
            </a>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#FFD200]/90 px-4 text-xs font-semibold text-[#00287A] transition hover:bg-[#FFD200]"
            >
              공유
            </button>
          </div>
        </div>
        {shareHint ? (
          <p className="mt-2 text-center text-[11px] text-white/60 md:text-right" role="status">
            {shareHint}
          </p>
        ) : null}
      </footer>
    </div>
  );
}
