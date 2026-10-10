import { exhibitionMetadata, RankingBoardPage } from "../../exhibition-pages";

export const revalidate = 300;

export const metadata = exhibitionMetadata({
  title: "봉드컵 팬 랭킹 | 생일 기념",
  description: "지금 이 순간 팬 봉드컵 TOP 5. 팬들이 고른 최고의 김다인 사진을 실시간으로 확인하세요.",
  path: "/exhibition/fan/ranking",
});

export default function FanRankingPage() {
  return (
    <RankingBoardPage
      group="fan"
      title="봉드컵 팬 랭킹"
      joinHref="/exhibition/fan"
      joinLabel="팬 봉드컵 참여하러 가기 →"
    />
  );
}
