import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VotoCategoryHome } from "@/components/voto-category-home";
import { ALL_VOTO_CATEGORY } from "@/lib/voto-categories";
import { findStarPlayer } from "@/lib/star-players";
import { DEFAULT_OG_IMAGE_URL, SITE_URL } from "@/lib/seo-metadata";

type StarPhotosPageProps = {
  params: Promise<{ name: string }>;
};

export async function generateMetadata({ params }: StarPhotosPageProps): Promise<Metadata> {
  const { name: raw } = await params;
  const player = findStarPlayer(raw);
  if (!player) {
    return { title: "선수 사진 | DAENI.KR" };
  }
  const title = `${player.name} 사진 | DAENI.KR`;
  const description = `${player.name} 고화질 경기 사진 모음 — 언제든 구경하고 저장하세요.`;
  const path = `/star/${player.slug}/photos`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE_URL }],
    },
  };
}

export default async function StarPlayerPhotosPage({ params }: StarPhotosPageProps) {
  const { name: raw } = await params;
  const player = findStarPlayer(raw);
  if (!player) {
    notFound();
  }
  return (
    <VotoCategoryHome
      initialCategory={ALL_VOTO_CATEGORY}
      initialQuery={player.galleryQuery ?? player.name}
      hideChrome
      title={player.name}
      subtitle={player.team}
    />
  );
}
