import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/seo-metadata";
import "./photo-page.css";

export const metadata: Metadata = {
  title: "다인네컷 | daeni.kr",
  description: "다인이와 인생네컷~ 김다인 프레임으로 네 장 찍고 저장·공유해 보세요.",
  alternates: { canonical: `${SITE_URL}/photo` },
  openGraph: {
    title: "다인네컷 | daeni.kr",
    description: "다인이와 인생네컷~",
    url: `${SITE_URL}/photo`,
    type: "website",
  },
};

export default function PhotoLayout({ children }: { children: ReactNode }) {
  return children;
}
