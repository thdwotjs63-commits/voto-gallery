/** 국제경기 국가명 → 국기 이모지 (긴 이름 우선 매칭) */

export type CountryFlagEntry = {
  match: string;
  flag: string;
};

/** 더 긴·구체적인 키워드를 앞에 둔다 (중국 홍콩 > 중국, 인도네시아 > 인도) */
export const COUNTRY_FLAGS: readonly CountryFlagEntry[] = [
  { match: "중국 홍콩", flag: "🇭🇰" },
  { match: "홍콩", flag: "🇭🇰" },
  { match: "인도네시아", flag: "🇮🇩" },
  { match: "카자흐스탄", flag: "🇰🇿" },
  { match: "우즈베키스탄", flag: "🇺🇿" },
  { match: "키르기스스탄", flag: "🇰🇬" },
  { match: "대한민국", flag: "🇰🇷" },
  { match: "한국", flag: "🇰🇷" },
  { match: "일본", flag: "🇯🇵" },
  { match: "중국", flag: "🇨🇳" },
  { match: "대만", flag: "🇹🇼" },
  { match: "태국", flag: "🇹🇭" },
  { match: "베트남", flag: "🇻🇳" },
  { match: "인도", flag: "🇮🇳" },
  { match: "필리핀", flag: "🇵🇭" },
  { match: "몽골", flag: "🇲🇳" },
  { match: "호주", flag: "🇦🇺" },
  { match: "카타르", flag: "🇶🇦" },
] as const;

export type CountryDisplay = {
  /** 매칭된 국기. 없으면 null */
  flag: string | null;
  /** 국기 없을 때·보조 표기용 짧은 이름 (앞 2글자) */
  short: string;
};

export function getCountryFlag(name: string): string | null {
  const n = (name ?? "").trim();
  if (!n) return null;
  for (const entry of COUNTRY_FLAGS) {
    if (n.includes(entry.match)) return entry.flag;
  }
  return null;
}

export function getCountryDisplay(name: string): CountryDisplay {
  const n = (name ?? "").trim();
  return {
    flag: getCountryFlag(n),
    short: n.slice(0, 2) || "?",
  };
}

export function isKoreaTeamName(name: string): boolean {
  const n = (name ?? "").trim();
  return n.includes("대한민국") || n.includes("한국");
}
