import type { Metadata } from "next";

/** 환경 변수 누락·오타 시에도 절대 URL 메타가 깨지지 않도록 */
const FALLBACK_SITE_URL = "https://daeni.kr";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return FALLBACK_SITE_URL;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return FALLBACK_SITE_URL;
    }
    return parsed.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = resolveSiteUrl();

export const DEFAULT_OG_IMAGE_URL =
  process.env.NEXT_PUBLIC_DEFAULT_OG_IMAGE_URL?.trim() ||
  `${SITE_URL}/og-default.jpg`;

export const GALLERY_TITLE = "Voto Gallery | [Dain]";
export const GALLERY_DESCRIPTION =
  "Team korea & Hyundai 주전세터 김다인의 디지털 사진첩";

export function buildRootMetadata(input?: {
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
}): Metadata {
  const image = input?.imageUrl || DEFAULT_OG_IMAGE_URL;
  const imageWidth = input?.imageWidth && input.imageWidth > 0 ? input.imageWidth : 1200;
  const imageHeight = input?.imageHeight && input.imageHeight > 0 ? input.imageHeight : 630;
  const imageAlt = input?.imageAlt || GALLERY_TITLE;

  return {
    metadataBase: new URL(SITE_URL),
    title: GALLERY_TITLE,
    description: GALLERY_DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: {
      title: GALLERY_TITLE,
      description: GALLERY_DESCRIPTION,
      url: "/",
      siteName: "Voto Gallery",
      type: "website",
      locale: "ko_KR",
      images: [
        {
          url: image,
          width: imageWidth,
          height: imageHeight,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: GALLERY_TITLE,
      description: GALLERY_DESCRIPTION,
      images: [image],
    },
  };
}

/**
 * Future detail route scaffold:
 * export async function generateMetadata(...) {
 *   return buildPhotoMetadata({ ... });
 * }
 */
export function buildPhotoMetadata(input: {
  title: string;
  description?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  path: string;
}): Metadata {
  const title = input.title || GALLERY_TITLE;
  const description = input.description || GALLERY_DESCRIPTION;
  const image = input.imageUrl || DEFAULT_OG_IMAGE_URL;
  const imageWidth = input.imageWidth && input.imageWidth > 0 ? input.imageWidth : 1200;
  const imageHeight = input.imageHeight && input.imageHeight > 0 ? input.imageHeight : 630;
  const canonicalPath = input.path.startsWith("/") ? input.path : `/${input.path}`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "article",
      images: [{ url: image, width: imageWidth, height: imageHeight, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

