import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/seo-metadata";
import "./photo-page.css";

export const metadata: Metadata = {
  title: "네컷 프레임 | daeni.kr",
  description:
    "국가대표 선발 기념 네컷 프레임으로 사진을 찍고 저장·공유하세요. 촬영본은 기기에만 저장됩니다.",
  alternates: { canonical: `${SITE_URL}/photo` },
  openGraph: {
    title: "네컷 프레임 | daeni.kr",
    description: "국가대표 선발 기념 네컷 프레임 — daeni.kr",
    url: `${SITE_URL}/photo`,
    type: "website",
  },
};

export default function PhotoLayout({ children }: { children: ReactNode }) {
  return children;
}
