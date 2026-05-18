import type { Metadata } from "next";
import { VotoCategoryHome } from "@/components/voto-category-home";
import { DEFAULT_VOTO_CATEGORY } from "@/lib/voto-categories";
import { DEFAULT_OG_IMAGE_URL, SITE_URL } from "@/lib/seo-metadata";

export const metadata: Metadata = {
  title: "Voto Photo | DAENI.KR",
  description: "현대건설 · 팀코리아 · 여자배구 카테고리별 고화질 김다인 경기 사진 모음",
  alternates: {
    canonical: `${SITE_URL}/voto`,
  },
  openGraph: {
    title: "Voto Photo | DAENI.KR",
    description: "현대건설 · 팀코리아 · 여자배구 카테고리별 고화질 김다인 경기 사진 모음",
    url: `${SITE_URL}/voto`,
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE_URL }],
  },
};

export default function VotoPage() {
  return <VotoCategoryHome initialCategory={DEFAULT_VOTO_CATEGORY} />;
}
