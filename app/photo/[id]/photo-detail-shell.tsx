"use client";

import { useEffect, useState } from "react";
import type { DriveImage } from "@/lib/drive-gallery-data";
import { PhotoDetailView } from "./photo-detail-view";

export function PhotoDetailShell({
  photoId,
  initialImage,
}: {
  photoId: string;
  initialImage: DriveImage | null;
}) {
  const [image, setImage] = useState<DriveImage | null>(initialImage);
  const [phase, setPhase] = useState<"ready" | "loading" | "error">(() =>
    initialImage ? "ready" : "loading"
  );

  useEffect(() => {
    if (initialImage) return undefined;

    let cancelled = false;
    const url = `/api/drive-photo/${encodeURIComponent(photoId)}`;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<DriveImage>;
      })
      .then((data) => {
        if (!cancelled) {
          setImage(data);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [photoId, initialImage]);

  if (phase === "loading" && !image) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-white">
        <p className="text-sm text-zinc-400">사진을 불러오는 중…</p>
      </div>
    );
  }

  if (phase === "error" && !image) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-white">
        <p className="max-w-md text-sm text-zinc-300">
          이 링크로는 사진을 열 수 없습니다. 잠시 후 다시 시도하거나 아래로 이동해 주세요.
        </p>
        <a
          href={`/?photo=${encodeURIComponent(photoId)}`}
          className="rounded-full bg-[#FFD200] px-4 py-2 text-sm font-semibold text-[#00287A] transition hover:opacity-90"
        >
          갤러리에서 이 사진으로 이동
        </a>
        <a
          href={`https://drive.google.com/file/d/${encodeURIComponent(photoId)}/view`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
        >
          Google Drive에서 열기
        </a>
      </div>
    );
  }

  if (image) {
    return <PhotoDetailView image={image} />;
  }

  return null;
}
