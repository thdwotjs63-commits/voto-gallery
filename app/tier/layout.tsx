import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/seo-metadata";

export const metadata: Metadata = {
  title: "KOVO 취향표 | daeni.kr",
  description: "KOVO 여자배구 취향표 — 구단별 최애 선수를 골라 한 장으로 만들어 공유해요.",
  alternates: { canonical: `${SITE_URL}/tier` },
  openGraph: {
    title: "KOVO 취향표 | daeni.kr",
    description: "구단별 최애 선수를 골라 취향표로 만들어요.",
    url: `${SITE_URL}/tier`,
    type: "website",
  },
};

export default function TierLayout({ children }: { children: ReactNode }) {
  return children;
}
