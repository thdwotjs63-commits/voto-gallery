import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { VotoCategoryHome } from "@/components/voto-category-home";
import {
  getVotoCategoryLabel,
  getVotoCategoryUrl,
  parseVotoCategoryFromPathSegment,
  type VotoCategoryId,
} from "@/lib/voto-categories";
import { DEFAULT_OG_IMAGE_URL, SITE_URL } from "@/lib/seo-metadata";

type VotoCategoryPageProps = {
  params: Promise<{ category: string }>;
};

function resolveCategory(raw: string): VotoCategoryId | null {
  return parseVotoCategoryFromPathSegment(raw);
}

export async function generateMetadata({
  params,
}: VotoCategoryPageProps): Promise<Metadata> {
  const { category: raw } = await params;
  const categoryId = resolveCategory(raw);
  if (!categoryId) {
    return { title: "Voto Photo | DAENI.KR" };
  }

  const label = getVotoCategoryLabel(categoryId);
  const path = getVotoCategoryUrl(categoryId);
  const description = `${label} — Voto Photo 카테고리 고화질 김다인 경기 사진`;

  return {
    title: `${label} | Voto Photo`,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title: `${label} | Voto Photo`,
      description,
      url: `${SITE_URL}${path}`,
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE_URL }],
    },
  };
}

export default async function VotoCategoryPage({ params }: VotoCategoryPageProps) {
  const { category: raw } = await params;
  const categoryId = resolveCategory(raw);
  if (!categoryId) {
    notFound();
  }

  const canonicalPath = getVotoCategoryUrl(categoryId);
  const requestedPath = `/voto/${decodeURIComponent(raw.trim())}`;
  if (requestedPath !== canonicalPath) {
    redirect(canonicalPath);
  }

  return <VotoCategoryHome initialCategory={categoryId} />;
}
