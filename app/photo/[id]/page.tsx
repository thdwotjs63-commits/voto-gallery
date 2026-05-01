import { cache } from "react";
import type { Metadata } from "next";
import {
  fetchDriveGalleryImages,
  resolveGalleryPhotoForPage,
  type DriveImage,
} from "@/lib/drive-gallery-data";
import { buildPhotoMetadata } from "@/lib/seo-metadata";
import { PhotoDetailShell } from "./photo-detail-shell";

const getGalleryImages = cache(fetchDriveGalleryImages);

/** 갤러리 목록 캐시/순회와 무관하게 최신 공유 링크가 열리도록 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id: rawId } = await params;
    const images = await getGalleryImages();
    const image = await resolveGalleryPhotoForPage(rawId, images);
    if (!image) {
      return { title: "Photo | Voto Gallery" };
    }
    const path = `/photo/${encodeURIComponent(image.id)}`;
    return buildPhotoMetadata({
      title: `${image.name} | Voto Gallery`,
      description: image.scheduleDisplay || image.name,
      imageUrl: image.originalUrl,
      path,
    });
  } catch {
    return { title: "Photo | Voto Gallery" };
  }
}

export default async function PhotoPage({ params }: PageProps) {
  const { id: rawId } = await params;
  let initialImage: DriveImage | null = null;
  try {
    const images = await getGalleryImages();
    initialImage = await resolveGalleryPhotoForPage(rawId, images);
  } catch {
    initialImage = null;
  }
  return <PhotoDetailShell photoId={rawId} initialImage={initialImage} />;
}
