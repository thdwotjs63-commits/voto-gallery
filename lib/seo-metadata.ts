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
  "https://lh3.googleusercontent.com/d/1K5fRZ0A8sJ4WQvW3V5Bq7h2oVgN4mNQw=w1600";

export const GALLERY_TITLE = "Voto Gallery | [Dain]";
export const GALLERY_DESCRIPTION =
  "현대건설 배구단 김다인을 기록하는 디지털 사진첩입니다.";

export function buildRootMetadata(): Metadata {
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
          url: DEFAULT_OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: GALLERY_TITLE,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: GALLERY_TITLE,
      description: GALLERY_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE_URL],
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
  path: string;
}): Metadata {
  const title = input.title || GALLERY_TITLE;
  const description = input.description || GALLERY_DESCRIPTION;
  const image = input.imageUrl || DEFAULT_OG_IMAGE_URL;
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
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

