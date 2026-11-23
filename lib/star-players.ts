/**
 * 선수별 NFC 허브 페이지(/star/<slug>)용 선수 명단.
 *
 * 각 선수는 영문 slug(URL)와, 허브에 모아 보여줄 링크들을 가진다.
 * 새 선수를 추가하려면 아래 배열에 객체 하나만 넣으면 /star/<slug> 페이지가 생긴다.
 *
 *   - slug: URL 경로. 영문 소문자+숫자만. (예: "kimdain" → daeni.kr/star/kimdain)
 *   - name: 표시 이름 (한글).
 *   - team: (선택) 소속팀.
 *   - galleryQuery: 보토 갤러리에서 그 선수 사진을 모으는 검색어 (보통 한글 이름).
 *                   비우면 "사진 보기" 버튼이 안 보인다.
 *   - instagram / youtube / naverSports: 각 링크 URL. 비우면 그 버튼은 안 보인다.
 *
 * 링크는 지금 비워 두고 나중에 URL만 채워 넣으면 된다. (빈 값이면 버튼이 자동으로 숨겨짐)
 */
export type StarPlayer = {
  slug: string;
  name: string;
  team?: string;
  galleryQuery?: string;
  /** "사진 보기" 버튼이 갈 경로를 직접 지정 (없으면 /star/<slug>/photos). 예: 다인이는 "/" (홈 전체 갤러리). */
  photoHref?: string;
  /** 사진 버튼 배경 이미지를 직접 지정 (없으면 그 선수 최신 사진 썸네일 사용). 예: 다인이는 "/hero.jpg". */
  photoBg?: string;
  instagram?: string;
  youtube?: string;
  homepage?: string;
  naverSports?: string;
  /**
   * 선수별 추가 링크 (daeni.kr 내부 기능 등). 위에서 아래 순서로 사진 버튼 다음에 표시된다.
   *   - href: 경로(내부는 "/records" 처럼, 외부는 전체 URL)
   *   - label / sub: 버튼 제목·설명
   *   - icon: 이모지 한 글자 (예: "📊")
   *   - external: 외부 링크면 true (새 탭)
   */
  extraLinks?: {
    href: string;
    label: string;
    sub: string;
    icon: string;
    external?: boolean;
  }[];
};

export const STAR_PLAYERS: StarPlayer[] = [
  {
    slug: "kimdain",
    name: "김다인",
    team: "현대건설 힐스테이트",
    galleryQuery: "김다인",
    photoHref: "/",
    photoBg: "/hero.jpg",
    instagram: "https://www.instagram.com/hdecvolleyballteam/",
    youtube: "https://www.youtube.com/@HDECVolleyballTeam",
    homepage: "https://hillstate.hdec.kr/",
    naverSports: "https://m.sports.naver.com/volleyball/news",
    extraLinks: [
      { href: "/records", label: "기록", sub: "통산·시즌별 성적", icon: "📊", external: false },
      { href: "/schedule", label: "일정·순위", sub: "경기 일정 · V리그 순위", icon: "📅", external: false },
      { href: "/saju", label: "궁합테스트", sub: "다인이와 궁합 보기", icon: "🔮", external: false },
    ],
  },
  {
    slug: "leeyelim",
    name: "이예림",
    team: "현대건설",
    galleryQuery: "이예림",
    instagram: "https://www.instagram.com/hdecvolleyballteam/",
    youtube: "https://www.youtube.com/@HDECVolleyballTeam",
    homepage: "https://hillstate.hdec.kr/",
    naverSports: "https://m.sports.naver.com/volleyball/news",
  },
  {
    slug: "junghoyoung",
    name: "정호영",
    team: "흥국생명",
    galleryQuery: "정호영",
    instagram: "https://www.instagram.com/hkpinkspiders/",
    youtube: "https://www.youtube.com/hkpinkspiders",
    homepage: "https://kovo.co.kr/pinkspiders",
    naverSports: "https://m.sports.naver.com/volleyball/news",
  },
  {
    slug: "jahstice",
    name: "자스티스",
    team: "흥국생명",
    galleryQuery: "자스티스",
    instagram: "https://www.instagram.com/hkpinkspiders/",
    youtube: "https://www.youtube.com/hkpinkspiders",
    homepage: "https://kovo.co.kr/pinkspiders",
    naverSports: "https://m.sports.naver.com/volleyball/news",
  },
  {
    slug: "leejuah",
    name: "이주아",
    team: "IBK기업은행",
    galleryQuery: "이주아",
    instagram: "https://www.instagram.com/ibk__altos/",
    youtube: "https://youtube.com/@IBKTV",
    homepage: "https://altos.kovo.co.kr/?gender=2",
    naverSports: "https://m.sports.naver.com/volleyball/news",
  },
  {
    slug: "kangsohwi",
    name: "강소휘",
    team: "한국도로공사",
    galleryQuery: "강소휘",
    instagram: "https://www.instagram.com/hipassvolleyclub/",
    youtube: "https://www.youtube.com/channel/UCVIMDvlsm6ThpS8ixu6Gwyg",
    homepage: "https://www.exsportsclub.com/",
    naverSports: "https://m.sports.naver.com/volleyball/news",
  },
  {
    slug: "moonjungwon",
    name: "문정원",
    team: "한국도로공사",
    galleryQuery: "문정원",
    instagram: "https://www.instagram.com/hipassvolleyclub/",
    youtube: "https://www.youtube.com/channel/UCVIMDvlsm6ThpS8ixu6Gwyg",
    homepage: "https://www.exsportsclub.com/",
    naverSports: "https://m.sports.naver.com/volleyball/news",
  },
  {
    slug: "choiyunyoung",
    name: "최윤영",
    team: "GS칼텍스",
    galleryQuery: "최윤영",
    instagram: "https://www.instagram.com/gscaltexkixx/",
    youtube: "https://www.youtube.com/@gscaltexkixx",
    homepage: "https://kixx.kovo.co.kr/?gender=2",
    naverSports: "https://m.sports.naver.com/volleyball/news",
  },
  {
    slug: "goyerim",
    name: "고예림",
    team: "SOOP SOOPers",
    galleryQuery: "고예림",
    instagram: "https://www.instagram.com/soop_soopers/",
    youtube: "https://youtube.com/@soopsoopersofficial",
    homepage: "https://soopers.kovo.co.kr/?gender=2",
    naverSports: "https://m.sports.naver.com/volleyball/news",
    extraLinks: [
      { href: "https://www.sooplive.com/station/soopsoopers", label: "SOOP방송국", sub: "구단 공식 방송", icon: "📺", external: true },
    ],
  },
  {
    slug: "eri.xue",
    name: "이즈쉬에",
    team: "SOOP SOOPers",
    galleryQuery: "이즈쉬에",
    instagram: "https://www.instagram.com/soop_soopers/",
    youtube: "https://youtube.com/@soopsoopersofficial",
    homepage: "https://soopers.kovo.co.kr/?gender=2",
    naverSports: "https://m.sports.naver.com/volleyball/news",
    extraLinks: [
      { href: "https://www.sooplive.com/station/soopsoopers", label: "SOOP방송국", sub: "구단 공식 방송", icon: "📺", external: true },
    ],
  },
];

/** slug(영문)로 선수 찾기. 대소문자 무시. 없으면 null. */
export function findStarPlayer(slug: string): StarPlayer | null {
  const s = slug.trim().toLowerCase();
  return STAR_PLAYERS.find((p) => p.slug.toLowerCase() === s) ?? null;
}

/** 모든 선수 slug */
export function allStarSlugs(): string[] {
  return STAR_PLAYERS.map((p) => p.slug);
}
