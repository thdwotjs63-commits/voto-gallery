import { exhibitionMetadata, WorldcupPage } from "../exhibition-pages";

export const revalidate = 300;

export const metadata = exhibitionMetadata({
  title: "팬 봉드컵 | 생일 기념",
  description: "팬들이 생각하는 최고의 김다인은? 둘 중 더 마음에 드는 사진을 골라주세요. No.3 김다인 선수 생일 기념 봉드컵.",
  path: "/exhibition/fan",
});

export default function FanExhibitionPage() {
  return <WorldcupPage group="fan" />;
}
