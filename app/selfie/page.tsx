"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import {
  driveLh3FullDisplayUrl,
  type DriveImage,
} from "@/lib/drive-gallery-data";

const BLUR_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTBlMGUwIi8+PC9zdmc+";

type SelfieGalleryResponse = DriveImage[] | { error?: string };

export default function SelfiePage() {
  const router = useRouter();
  const [images, setImages] = useState<DriveImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/selfie-gallery");
        const payload = (await response.json()) as SelfieGalleryResponse;

        if (!response.ok) {
          const message =
            typeof (payload as { error?: string }).error === "string"
              ? (payload as { error: string }).error
              : `Selfie gallery request failed (${response.status})`;
          throw new Error(message);
        }

        if (mounted) {
          setImages(payload as DriveImage[]);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load selfies.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const sortedImages = useMemo(
    () => [...images].sort((a, b) => b.folderSortKey - a.folderSortKey),
    [images]
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-6 sm:px-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-400">voto gallery</p>
          <h1 className="mt-0.5 text-lg font-medium tracking-wide text-zinc-900">
            Selfie Archive
          </h1>
          <p className="mt-0.5 text-xs text-zinc-400">보토 셀카 모음</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full border border-zinc-200 px-4 py-2 text-xs text-zinc-600 transition hover:bg-zinc-50"
        >
          {"<-"} Gallery
        </button>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 pb-20 sm:px-8">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : sortedImages.length === 0 ? (
          <p className="text-sm text-zinc-400">아직 사진이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {sortedImages.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="group relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-100"
              >
                <Image
                  src={image.thumbnailUrl}
                  alt={image.name}
                  fill
                  sizes="(max-width: 640px) 48vw, (max-width: 1024px) 31vw, 20vw"
                  quality={70}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  placeholder="blur"
                  blurDataURL={BLUR_URL}
                />
                {image.scheduleDisplay || image.folderName ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6">
                    <p className="text-[10px] leading-tight text-white/90">
                      {image.scheduleDisplay || image.folderName}
                    </p>
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </main>

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        on={{
          view: ({ index }) => setLightboxIndex(index),
        }}
        plugins={[Zoom]}
        zoom={{ maxZoomPixelRatio: 3, zoomInMultiplier: 2 }}
        slides={sortedImages.map((image) => ({
          src: driveLh3FullDisplayUrl(image.id),
          alt: image.scheduleDisplay || image.name,
          width: image.width,
          height: image.height,
        }))}
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, 0.92)" },
        }}
        render={{
          slide: ({ slide }) => (
            <div className="relative h-full w-full">
              <Image
                src={slide.src}
                alt={slide.alt || "selfie"}
                fill
                unoptimized
                className="object-contain"
                sizes="100vw"
                priority
              />
              {slide.alt ? (
                <div className="absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
                  {slide.alt}
                </div>
              ) : null}
            </div>
          ),
        }}
      />
    </div>
  );
}
