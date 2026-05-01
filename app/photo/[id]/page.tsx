import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchDriveGalleryImages,
  fetchDriveImageById,
  type DriveImage,
} from "@/lib/drive-gallery-data";
import { buildPhotoMetadata } from "@/lib/seo-metadata";
import { PhotoDetailView } from "./photo-detail-view";

const getGalleryImages = cache(fetchDriveGalleryImages);

/** 갤러리 목록 캐시/순회와 무관하게 최신 공유 링크가 열리도록 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function decodePhotoIdParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = decodePhotoIdParam(rawId);
  const images = await getGalleryImages();
  let image: DriveImage | undefined = images.find((img) => img.id === id);
  if (!image) {
    image = (await fetchDriveImageById(id)) ?? undefined;
  }
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
}

export default async function PhotoPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = decodePhotoIdParam(rawId);
  const images = await getGalleryImages();
  let image: DriveImage | undefined = images.find((img) => img.id === id);
  if (!image) {
    image = (await fetchDriveImageById(id)) ?? undefined;
  }
  if (!image) {
    notFound();
  }
  return <PhotoDetailView image={image} />;
}
