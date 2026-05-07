"use client";

import Image from "next/image";
import { useState } from "react";
import type { DriveImage } from "@/lib/drive-gallery-data";
import { buildMatchPhotoAltFromFilename } from "@/lib/image-alt";

const PHOTO_GRID_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTBlMGUwIi8+PC9zdmc+";

export const PHOTO_GRID_THUMB_SIZES =
  "(max-width: 640px) 92vw, (max-width: 768px) 48vw, (max-width: 1024px) 31vw, (max-width: 1280px) 24vw, 20vw";

export const PHOTO_GRID_THUMB_SIZES_COMPACT =
  "(max-width: 640px) 28vw, (max-width: 1024px) 16vw, 11vw";

/**
 * Grid-only thumbnail: Drive thumbnail (see `DriveImage.thumbnailUrl`) + `unoptimized`
 * so requests skip Vercel Image Optimization quota.
 */
export function PhotoGridThumbnail({
  image,
  sizes = PHOTO_GRID_THUMB_SIZES,
}: {
  image: DriveImage;
  sizes?: string;
}) {
  const [sharp, setSharp] = useState(false);
  return (
    <div className="relative size-full">
      <Image
        src={image.thumbnailUrl}
        alt={buildMatchPhotoAltFromFilename(image.name)}
        fill
        sizes={sizes}
        quality={60}
        unoptimized
        placeholder="blur"
        blurDataURL={PHOTO_GRID_BLUR_DATA_URL}
        className={`object-cover transition-[opacity,filter] duration-700 ease-out ${
          sharp ? "opacity-100 [filter:blur(0px)]" : "opacity-90 [filter:blur(14px)]"
        }`}
        onLoadingComplete={() => setSharp(true)}
      />
    </div>
  );
}
