import type { Metadata } from "next";
import { fetchDriveGalleryImages } from "@/lib/drive-gallery-data";
import { buildPhotoMetadata } from "@/lib/seo-metadata";

type SharePageProps = {
  params: Promise<{ id: string }>;
};

function decodePhotoId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id: rawId } = await params;
  const photoId = decodePhotoId(rawId).trim();
  const safeId = encodeURIComponent(photoId);
  const images = await fetchDriveGalleryImages();
  const image = images.find((item) => item.id === photoId);
  const imageUrl = image?.originalUrl ?? `https://lh3.googleusercontent.com/d/${safeId}`;
  const title = image?.name || "Kim Dain | Voto Gallery";

  return buildPhotoMetadata({
    title,
    description: "김다인 갤러리 사진을 확인해보세요.",
    imageUrl,
    imageWidth: image?.width,
    imageHeight: image?.height,
    path: `/share/${safeId}`,
  });
}

export default async function SharePhotoPage({ params }: SharePageProps) {
  const { id: rawId } = await params;
  const photoId = decodePhotoId(rawId).trim();
  const target = `/?photo=${encodeURIComponent(photoId)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-zinc-700">
      <meta httpEquiv="refresh" content={`0;url=${target}`} />
      <p>
        사진 상세 페이지로 이동 중입니다.
        <br />
        <a href={target} className="text-blue-700 underline underline-offset-4">
          자동 이동이 안 되면 여기를 눌러주세요.
        </a>
      </p>
    </main>
  );
}
