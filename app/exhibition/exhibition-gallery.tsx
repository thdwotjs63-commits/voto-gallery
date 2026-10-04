import Image from "next/image";
import type { ExhibitionPhoto } from "@/lib/exhibition";
import "./exhibition.css";

export default function ExhibitionGallery({ photos }: { photos: ExhibitionPhoto[] }) {
  return (
    <ol className="flex flex-col gap-8">
      {photos.map((photo, index) => (
        <li key={photo.photoId} className="exhibit-reveal">
          <div className="overflow-hidden rounded-3xl bg-[#F3EEDF] shadow-[0_12px_32px_-12px_rgba(30,58,158,0.28)]">
            <Image
              src={photo.src}
              alt={`김다인 선수 사진 ${index + 1}`}
              width={photo.width || 1200}
              height={photo.height || 1600}
              sizes="(max-width: 480px) 100vw, 448px"
              quality={60}
              className="block h-auto w-full"
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
