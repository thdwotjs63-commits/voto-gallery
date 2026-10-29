/** KOVO 여자부 선수 명단 — public/players/<구단>/<등번호 이름>.webp */

export type RosterPlayer = {
  no: number;
  name: string;
  /** public/players/<team.folder>/ 아래 실제 파일명(정규화 그대로) */
  photo: string;
};

export type TierTeamId =
  | "현대건설"
  | "흥국생명"
  | "정관장"
  | "GS칼텍스"
  | "한국도로공사"
  | "IBK기업은행"
  | "SOOP";

export type TierTeam = {
  id: TierTeamId;
  /** public/players 하위 실제 폴더명 (macOS NFD 등) */
  folder: string;
  label: string;
  color: string;
};

/** 취향표 열 순서 */
export const TIER_TEAMS: readonly TierTeam[] = [
  { id: "현대건설", folder: "현대건설", label: "현대건설", color: "#F7C331" },
  { id: "흥국생명", folder: "흥국생명", label: "흥국생명", color: "#E6007E" },
  { id: "정관장", folder: "정관장", label: "정관장", color: "#D7152B" },
  { id: "GS칼텍스", folder: "GS칼텍스", label: "GS칼텍스", color: "#418FA5" },
  { id: "한국도로공사", folder: "한국도로공사", label: "한국도로공사", color: "#283585" },
  { id: "IBK기업은행", folder: "IBK기업은행", label: "IBK기업은행", color: "#4090D2" },
  { id: "SOOP", folder: "SOOP", label: "SOOP", color: "#0A5FBF" },
] as const;

export const PLAYERS_ROSTER: Readonly<Record<TierTeamId, readonly RosterPlayer[]>> = {
  "현대건설": [
    { no: 1, name: "이예림", photo: "1 이예림.webp" },
    { no: 2, name: "이채영", photo: "2 이채영.webp" },
    { no: 3, name: "김다인", photo: "3 김다인.webp" },
    { no: 5, name: "이영주", photo: "5 이영주.webp" },
    { no: 6, name: "김사랑", photo: "6 김사랑.webp" },
    { no: 8, name: "김연견", photo: "8 김연견.webp" },
    { no: 9, name: "나현수", photo: "9 나현수.webp" },
    { no: 10, name: "배유나", photo: "10 배유나.webp" },
    { no: 11, name: "강서우", photo: "11 강서우.webp" },
    { no: 13, name: "정지윤", photo: "13 정지윤.webp" },
    { no: 15, name: "김희진", photo: "15 김희진.webp" },
    { no: 17, name: "김수현", photo: "17 김수현.webp" },
    { no: 18, name: "한미르", photo: "18 한미르.webp" },
    { no: 20, name: "이민영", photo: "20 이민영.webp" },
    { no: 21, name: "조던", photo: "21 조던.webp" },
    { no: 28, name: "이한비", photo: "28 이한비.webp" },
    { no: 88, name: "메가", photo: "88 메가.webp" },
    { no: 99, name: "구솔", photo: "99 구솔.webp" },
  ],
  "흥국생명": [
    { no: 1, name: "김다은", photo: "1 김다은.webp" },
    { no: 2, name: "자스티스", photo: "2 자스티스.webp" },
    { no: 3, name: "신연경", photo: "3 신연경.webp" },
    { no: 4, name: "서채현", photo: "4 서채현.webp" },
    { no: 6, name: "이고은", photo: "6 이고은.webp" },
    { no: 7, name: "최은지", photo: "7 최은지.webp" },
    { no: 9, name: "변지수", photo: "9 변지수.webp" },
    { no: 11, name: "김수지", photo: "11 김수지.webp" },
    { no: 13, name: "박혜진", photo: "13 박혜진.webp" },
    { no: 14, name: "정윤주", photo: "14 정윤주.webp" },
    { no: 15, name: "박민지", photo: "15 박민지.webp" },
    { no: 16, name: "고민지", photo: "16 고민지.webp" },
    { no: 17, name: "정호영", photo: "17 정호영.webp" },
    { no: 18, name: "이신영", photo: "18 이신영.webp" },
    { no: 19, name: "표승주", photo: "19 표승주.webp" },
    { no: 20, name: "박수연", photo: "20 박수연.webp" },
    { no: 21, name: "임혜림", photo: "21 임혜림.webp" },
    { no: 23, name: "킨델란", photo: "23 킨델란.webp" },
    { no: 33, name: "이나연", photo: "33 이나연.webp" },
    { no: 71, name: "문지윤", photo: "71 문지윤.webp" },
  ],
  "정관장": [
    { no: 3, name: "염혜선", photo: "3 염혜선.webp" },
    { no: 4, name: "전다빈", photo: "4 전다빈.webp" },
    { no: 5, name: "노란", photo: "5 노란.webp" },
    { no: 6, name: "박은진", photo: "6 박은진.webp" },
    { no: 8, name: "도수빈", photo: "8 도수빈.webp" },
    { no: 10, name: "박혜민", photo: "10 박혜민.webp" },
    { no: 12, name: "김지윤", photo: "12 김지윤.webp" },
    { no: 13, name: "부키리치", photo: "13 부키리치.webp" },
    { no: 15, name: "이선우", photo: "15 이선우.webp" },
    { no: 16, name: "신은지", photo: "16 신은지.webp" },
    { no: 17, name: "종휘", photo: "17 종휘.webp" },
    { no: 18, name: "이지수", photo: "18 이지수.webp" },
    { no: 19, name: "최서현", photo: "19 최서현.webp" },
    { no: 20, name: "최효서", photo: "20 최효서.webp" },
    { no: 23, name: "박여름", photo: "23 박여름.webp" },
    { no: 24, name: "곽선옥", photo: "24 곽선옥.webp" },
  ],
  "GS칼텍스": [
    { no: 1, name: "최가은", photo: "1 최가은.webp" },
    { no: 2, name: "김효임", photo: "2 김효임.webp" },
    { no: 3, name: "이윤신", photo: "3 이윤신.webp" },
    { no: 4, name: "서채원", photo: "4 서채원.webp" },
    { no: 5, name: "실바", photo: "5 실바.webp" },
    { no: 6, name: "최윤영", photo: "6 최윤영.webp" },
    { no: 10, name: "최유림", photo: "10 최유림.webp" },
    { no: 11, name: "김주향", photo: "11 김주향.webp" },
    { no: 12, name: "이주아", photo: "12 이주아.webp" },
    { no: 14, name: "김지원", photo: "14 김지원.webp" },
    { no: 15, name: "박사랑", photo: "15 박사랑.webp" },
    { no: 17, name: "김미연", photo: "17 김미연.webp" },
    { no: 18, name: "권민지", photo: "18 권민지.webp" },
    { no: 19, name: "유서연", photo: "19 유서연.webp" },
    { no: 26, name: "타나차", photo: "26 타나차.webp" },
    { no: 47, name: "한수진", photo: "47 한수진.webp" },
    { no: 54, name: "오세연", photo: "54 오세연.webp" },
  ],
  "한국도로공사": [
    { no: 1, name: "박윤서", photo: "1 박윤서.webp" },
    { no: 3, name: "김다은", photo: "3 김다은.webp" },
    { no: 6, name: "이윤정", photo: "6 이윤정.webp" },
    { no: 7, name: "손혜진", photo: "7 손혜진.webp" },
    { no: 9, name: "박정아", photo: "9 박정아.webp" },
    { no: 10, name: "마미", photo: "10 마미.webp" },
    { no: 11, name: "김세빈", photo: "11 김세빈.webp" },
    { no: 12, name: "문정원", photo: "12 문정원.webp" },
    { no: 13, name: "이지윤", photo: "13 이지윤.webp" },
    { no: 16, name: "오은채", photo: "16 오은채.webp" },
    { no: 17, name: "김현지", photo: "17 김현지.webp" },
    { no: 18, name: "김세인", photo: "18 김세인.webp" },
    { no: 19, name: "이수연", photo: "19 이수연.webp" },
    { no: 97, name: "강소휘", photo: "97 강소휘.webp" },
    { no: 99, name: "모마", photo: "99 모마.webp" },
  ],
  "IBK기업은행": [
    { no: 1, name: "이소영", photo: "1 이소영.webp" },
    { no: 2, name: "이주아", photo: "2 이주아.webp" },
    { no: 3, name: "박은서", photo: "3 박은서.webp" },
    { no: 5, name: "김하경", photo: "5 김하경.webp" },
    { no: 7, name: "미와", photo: "7 미와.webp" },
    { no: 8, name: "임명옥", photo: "8 임명옥.webp" },
    { no: 11, name: "육서영", photo: "11 육서영.webp" },
    { no: 12, name: "김채연", photo: "12 김채연.webp" },
    { no: 13, name: "최정민", photo: "13 최정민.webp" },
    { no: 14, name: "김채원", photo: "14 김채원.webp" },
    { no: 15, name: "황민경", photo: "15 황민경.webp" },
    { no: 16, name: "전수민", photo: "16 전수민.webp" },
    { no: 17, name: "최연진", photo: "17 최연진.webp" },
    { no: 18, name: "강유정", photo: "18 강유정.webp" },
    { no: 19, name: "빅토리아", photo: "19 빅토리아.webp" },
    { no: 20, name: "정솔민", photo: "20 정솔민.webp" },
    { no: 21, name: "하예지", photo: "21 하예지.webp" },
    { no: 25, name: "남은서", photo: "25 남은서.webp" },
  ],
  "SOOP": [
    { no: 2, name: "오드리아나", photo: "2 오드리아나.webp" },
    { no: 4, name: "한다혜", photo: "4 한다혜.webp" },
    { no: 5, name: "임주은", photo: "5 임주은.webp" },
    { no: 8, name: "박연화", photo: "8 박연화.webp" },
    { no: 10, name: "고의정", photo: "10 고의정.webp" },
    { no: 11, name: "전새얀", photo: "11 전새얀.webp" },
    { no: 12, name: "송은채", photo: "12 송은채.webp" },
    { no: 13, name: "박은서", photo: "13 박은서.webp" },
    { no: 15, name: "박수빈", photo: "15 박수빈.webp" },
    { no: 16, name: "이즈쉬에", photo: "16 이즈쉬에.webp" },
    { no: 17, name: "고예림", photo: "17 고예림.webp" },
    { no: 18, name: "김서영", photo: "18 김서영.webp" },
    { no: 20, name: "전하리", photo: "20 전하리.webp" },
    { no: 21, name: "유가람", photo: "21 유가람.webp" },
    { no: 22, name: "서지혜", photo: "22 서지혜.webp" },
    { no: 23, name: "이원정", photo: "23 이원정.webp" },
    { no: 77, name: "하혜진", photo: "77 하혜진.webp" },
  ],
};

export function getTeamRoster(teamId: TierTeamId): readonly RosterPlayer[] {
  return PLAYERS_ROSTER[teamId];
}

export function findRosterPlayer(teamId: TierTeamId, no: number): RosterPlayer | undefined {
  return PLAYERS_ROSTER[teamId].find((p) => p.no === no);
}

export function getTierTeam(teamId: TierTeamId): TierTeam {
  const t = TIER_TEAMS.find((x) => x.id === teamId);
  if (!t) throw new Error(`unknown team: ${teamId}`);
  return t;
}

/**
 * 정적 이미지 URL.
 * - 폴더·파일명은 NFC로 맞춘 뒤 세그먼트별 encodeURIComponent (공백→%20, 한글 안전).
 * - macOS 소스는 NFD인 경우가 많고, git/리눅스 배포·iOS Safari는 NFC를 기대함.
 * - 세그먼트만 한 번 인코딩 (이미 % 인코딩된 문자열을 넣지 말 것).
 */
export function playerPhotoUrl(teamFolder: string, photoFile: string): string {
  const folder = teamFolder.normalize("NFC");
  const file = photoFile.normalize("NFC");
  return `/players/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
}

export function rosterPlayerUrl(teamId: TierTeamId, player: RosterPlayer): string {
  return playerPhotoUrl(getTierTeam(teamId).folder, player.photo);
}

