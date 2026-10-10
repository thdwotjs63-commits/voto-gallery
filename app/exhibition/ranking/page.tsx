import { exhibitionMetadata, RankingBoardPage } from "../exhibition-pages";

export const revalidate = 300;

export const metadata = exhibitionMetadata({
  title: "봉드컵 실시간 랭킹 | 생일 기념",
  description: "지금 이 순간 봉드컵 TOP 5. 현대건설배구단이 고른 최고의 김다인 사진을 실시간으로 확인하세요.",
  path: "/exhibition/ranking",
});

export default function WorldcupRankingPage() {
  return (
    <RankingBoardPage group="player" title="봉드컵 실시간 랭킹" joinHref="/exhibition" joinLabel="봉드컵 참여하러 가기 →" />
  );
}
