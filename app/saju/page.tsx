import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { SajuClient } from "@/components/saju/saju-client";
import { SITE_URL } from "@/lib/seo-metadata";

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-saju-sans",
  display: "swap",
});

const notoSerif = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-saju-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "다인이와 궁합테스트 | daeni.kr",
  description: "생년월일로 보는 다인이와 나의 사주 궁합. 입력 정보는 저장되지 않아요.",
  alternates: {
    canonical: `${SITE_URL}/saju`,
  },
  openGraph: {
    title: "다인이와 궁합테스트 | daeni.kr",
    description: "생년월일로 보는 다인이와 나의 사주 궁합. 입력 정보는 저장되지 않아요.",
    url: `${SITE_URL}/saju`,
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og-saju.png`,
        width: 1200,
        height: 630,
        alt: "다인이와 궁합테스트",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "다인이와 궁합테스트 | daeni.kr",
    description: "생년월일로 보는 다인이와 나의 사주 궁합. 입력 정보는 저장되지 않아요.",
    images: [`${SITE_URL}/og-saju.png`],
  },
};

export default function SajuPage() {
  return (
    <div className={`${notoSans.variable} ${notoSerif.variable} font-[family-name:var(--font-saju-sans)]`}>
      <SajuClient />
    </div>
  );
}
