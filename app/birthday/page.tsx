import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo-metadata";
import BirthdayClient from "./birthday-client";

const TITLE = "HAPPY BONG'S DAY | daeni.kr";
const DESCRIPTION = "김다인 선수의 생일을 함께 축하해요";
const OG_IMAGE = `${SITE_URL.replace(/\/$/, "")}/hero.jpg`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/birthday" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/birthday",
    siteName: "daeni.kr",
    type: "website",
    locale: "ko_KR",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "배구선수 김다인" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function BirthdayPage() {
  return <BirthdayClient />;
}
