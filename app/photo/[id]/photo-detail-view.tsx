"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { DriveImage } from "@/lib/drive-gallery-data";

const THUMB_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTBlMGUwIi8+PC9zdmc+";

export function PhotoDetailView({ image }: { image: DriveImage }) {
  const router = useRouter();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-detail-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-medium tracking-wide text-white/90 underline-offset-4 hover:text-white hover:underline"
        >
          ← 갤러리
        </Link>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="닫기"
        >
          ×
        </button>
      </header>

      <div className="relative min-h-0 flex-1 bg-black">
        <Image
          src={image.originalUrl}
          alt={image.name}
          fill
          priority
          className="object-contain"
          sizes="100vw"
          quality={90}
          placeholder="blur"
          blurDataURL={THUMB_BLUR_DATA_URL}
        />
      </div>

      <footer className="shrink-0 space-y-1 border-t border-white/10 px-4 py-3">
        <h1 id="photo-detail-title" className="line-clamp-2 text-sm font-medium text-white/95">
          {image.name}
        </h1>
        {image.scheduleDisplay ? (
          <p className="text-xs text-white/55">{image.scheduleDisplay}</p>
        ) : null}
        <a
          href={image.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-10 items-center rounded-full bg-white/10 px-4 text-xs font-medium text-white transition hover:bg-white/20"
        >
          원본 다운로드
        </a>
      </footer>
    </div>
  );
}
