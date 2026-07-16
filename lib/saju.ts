export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const STEM_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export const BRANCH_KO = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;
export const STEM_ELEMENT = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"] as const;
export const BRANCH_ELEMENT = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"] as const;
export const STEM_YANG = [true, false, true, false, true, false, true, false, true, false] as const;
/** 지지별 지장간 정기(십성 판별용 대표 천간 인덱스) */
export const BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8] as const;
/** 절입일 근사(월별 대표일): 소한6 입춘4 경칩6 청명5 입하6 망종6 소서7 입추8 백로8 한로8 입동7 대설7 */
export const TERM_DAY = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7] as const;

export type ElementKey = "목" | "화" | "토" | "금" | "수";
export type ElementCount = Record<ElementKey, number>;

export type Pillar = { stem: number; branch: number };

export type SajuComputeResult = {
  /** 년 → 월 → 일 → (시) */
  pillars: Pillar[];
  elementCount: ElementCount;
  nearTermBoundary: boolean;
};

export type TenGodName =
  | "비견"
  | "겁재"
  | "식신"
  | "상관"
  | "편재"
  | "정재"
  | "편관"
  | "정관"
  | "편인"
  | "정인";

const ANCHOR = Date.UTC(1949, 9, 1); // 1949-10-01 = 甲子

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function emptyElements(): ElementCount {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
}

function pillarString(stem: number, branch: number): string {
  return `${STEMS[stem]}${BRANCHES[branch]}`;
}

/** 일주 60갑자 인덱스 (甲子 = 0) */
export function dayCycleIndex(year: number, month: number, day: number): number {
  const utc = Date.UTC(year, month - 1, day);
  const diffDays = Math.round((utc - ANCHOR) / 86_400_000);
  return mod(diffDays, 60);
}

export function dayPillar(year: number, month: number, day: number): string {
  const idx = dayCycleIndex(year, month, day);
  return pillarString(idx % 10, idx % 12);
}

/** 입춘 기준 년주용 연도 */
export function sajuYear(year: number, month: number, day: number): number {
  if (month < 2 || (month === 2 && day < TERM_DAY[1])) return year - 1;
  return year;
}

export function yearPillar(year: number, month: number, day: number): string {
  const y = sajuYear(year, month, day);
  const stem = mod(y - 4, 10);
  const branch = mod(y - 4, 12);
  return pillarString(stem, branch);
}

function monthPillarIndices(
  year: number,
  month: number,
  day: number
): { stem: number; branch: number; yearStem: number } {
  const y = sajuYear(year, month, day);
  const yearStem = mod(y - 4, 10);

  let effectiveMonth = month;
  if (day < TERM_DAY[month - 1]) {
    effectiveMonth = month - 1;
    if (effectiveMonth === 0) effectiveMonth = 12;
  }

  const branch = effectiveMonth % 12;
  const stem = mod((yearStem % 5) * 2 + 2 + mod(branch - 2, 12), 10);
  return { stem, branch, yearStem };
}

function hourPillarIndices(
  dayStem: number,
  hour: number
): { stem: number; branch: number } {
  const branch = Math.floor((hour + 1) / 2) % 12;
  const stem = mod((dayStem % 5) * 2 + branch, 10);
  return { stem, branch };
}

export function isNearTermBoundary(month: number, day: number): boolean {
  const term = TERM_DAY[month - 1];
  return day === term - 1 || day === term || day === term + 1;
}

/**
 * 만세력 계산. hour가 null/undefined이면 시주 없이 3기둥.
 * pillars 순서: 년 → 월 → 일 → 시
 */
export function compute(
  year: number,
  month: number,
  day: number,
  hour?: number | null
): SajuComputeResult {
  const y = sajuYear(year, month, day);
  const yearStem = mod(y - 4, 10);
  const yearBranch = mod(y - 4, 12);

  const monthP = monthPillarIndices(year, month, day);

  const dayIdx = dayCycleIndex(year, month, day);
  const dayStem = dayIdx % 10;
  const dayBranch = dayIdx % 12;

  const pillars: Pillar[] = [
    { stem: yearStem, branch: yearBranch },
    { stem: monthP.stem, branch: monthP.branch },
    { stem: dayStem, branch: dayBranch },
  ];

  if (hour !== null && hour !== undefined) {
    pillars.push(hourPillarIndices(dayStem, hour));
  }

  const elementCount = emptyElements();
  for (const p of pillars) {
    elementCount[STEM_ELEMENT[p.stem]]++;
    elementCount[BRANCH_ELEMENT[p.branch]]++;
  }

  return {
    pillars,
    elementCount,
    nearTermBoundary: isNearTermBoundary(month, day),
  };
}

const GENERATES: Record<ElementKey, ElementKey> = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
};

const CONTROLS: Record<ElementKey, ElementKey> = {
  목: "토",
  토: "수",
  수: "화",
  화: "금",
  금: "목",
};

/** 일간 대비 대상 천간의 십신 */
export function tenGod(dayStemIdx: number, targetStemIdx: number): TenGodName {
  const de = STEM_ELEMENT[dayStemIdx];
  const te = STEM_ELEMENT[targetStemIdx];
  const samePolarity = STEM_YANG[dayStemIdx] === STEM_YANG[targetStemIdx];

  if (de === te) return samePolarity ? "비견" : "겁재";
  if (GENERATES[de] === te) return samePolarity ? "식신" : "상관";
  if (CONTROLS[de] === te) return samePolarity ? "편재" : "정재";
  if (CONTROLS[te] === de) return samePolarity ? "편관" : "정관";
  if (GENERATES[te] === de) return samePolarity ? "편인" : "정인";
  return "비견";
}

/** 지지 → 지장간 정기로 십신 */
export function tenGodFromBranch(dayStemIdx: number, branchIdx: number): TenGodName {
  return tenGod(dayStemIdx, BRANCH_MAIN_STEM[branchIdx]);
}

export function formatPillar(p: Pillar): string {
  return pillarString(p.stem, p.branch);
}

export function formatPillarKo(p: Pillar): string {
  return `${STEM_KO[p.stem]}${BRANCH_KO[p.branch]}`;
}
