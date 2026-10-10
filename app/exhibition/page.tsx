import { exhibitionMetadata, WorldcupPage } from "./exhibition-pages";

export const revalidate = 300;

export const metadata = exhibitionMetadata({
  title: "봉드컵 | 생일 기념",
  description: "둘 중 더 마음에 드는 사진을 골라주세요. No.3 김다인 선수 생일 기념 봉드컵.",
  path: "/exhibition",
});

export default function ExhibitionPage() {
  return <WorldcupPage group="player" />;
}
