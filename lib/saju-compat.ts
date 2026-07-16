import {
  BRANCHES,
  STEM_ELEMENT,
  STEM_KO,
  STEMS,
  compute,
  formatPillar,
  formatPillarKo,
  tenGod,
  tenGodFromBranch,
  type ElementCount,
  type ElementKey,
  type Pillar,
  type TenGodName,
} from "./saju";

export const DAENI = {
  pillars: { year: "戊寅", month: "壬戌", day: "乙未" }, // 시주 미상, 3기둥
  dayStem: 1, // 乙
  elements: { 목: 2, 화: 0, 토: 3, 금: 0, 수: 1 },
  missingElements: ["화", "금"] as const,
  branches: [2, 10, 7] as const, // 寅, 戌, 未
  sinsal: [
    "백호살(乙未)",
    "백호살·괴강(壬戌)",
    "귀문관살(寅未)",
    "천문성(戌)",
    "화개살(戌)",
    "암록(戌)",
  ],
} as const;

/** 싱크로율 배점 — 숫자만 조정하면 됨 */
export const SCORE = {
  BASE: 40,
  ELEMENT: {
    fillsDaeniFire: 8,
    fillsDaeniMetal: 8,
    daeniFillsVisitor: 6,
    MAX: 22,
  },
  BRANCH: {
    yukhap: 10,
    banhap: 8,
    wonjinGwimun: 5,
    chung: 4,
    MAX: 20,
  },
  DAY_STEM: {
    jeonginSiksin: 10,
    pyeoninSanggwan: 8,
    jaeGwan: 6,
    bigyeop: 4,
  },
  SINSAL: { perShared: 5, MAX: 15 },
} as const;

/** 등급 칭호 (경계값 포함, 높은 min부터) */
export const TITLES = [
  { min: 90, title: "사주에 새겨진 팬" },
  { min: 70, title: "사주가 밀어주는 팬" },
  { min: 50, title: "매 경기 진심인 팬" },
  { min: 30, title: "서서히 스며드는 팬" },
  { min: 0, title: "이제 막 도착한 팬" },
] as const;

export type BirthInput = {
  year: number;
  month: number;
  day: number;
  /** null = 시간 모름 */
  hour: number | null;
};

export type CompatBadge = {
  id: string;
  label: string;
};

export type TenGodGroupCount = {
  비겁: number;
  식상: number;
  재성: number;
  관성: number;
  인성: number;
};

export type SajuSummary = {
  dayStem: string;
  dayStemKo: string;
  dayStemIdx: number;
  dayBranchIdx: number;
  dayElement: ElementKey;
  pillars: { label: string; hanja: string; ko: string; stem: number; branch: number }[];
  elements: ElementCount;
  tenGodCount: TenGodGroupCount;
  sinsal: string[];
  nearTermBoundary: boolean;
  hasHour: boolean;
};

export type CompatResult = {
  score: number;
  title: string;
  dayRelation: string;
  dayRelationReverse: string;
  elementNotes: string[];
  badges: CompatBadge[];
  summary: SajuSummary;
};

const PILLAR_LABELS_WITH_HOUR = ["연주", "월주", "일주", "시주"] as const;
const PILLAR_LABELS_NO_HOUR = ["연주", "월주", "일주"] as const;

const DAY_TO_DAENI: Record<TenGodName, string> = {
  비견: "같은 결의 세터 본능 — 다인이의 선택을 설명 없이 알아채는 팬",
  겁재: "비슷한 승부욕으로 맞불을 놓는 케미. 직관석이 더 뜨거워져요",
  식신: "다인이의 토스를 자연스럽게 해설해 주는 식신형 팬",
  상관: "감각적인 한 수를 남들보다 먼저 알아보는 상관형 리액션",
  편재: "볼 배분의 흐름을 재물처럼 읽는 편재형 응원",
  정재: "요란하기보다 오래 남는 정재형 곁지킴",
  편관: "승부의 압박을 함께 짊어지는 편관형 팬",
  정관: "세터의 운영을 신뢰하는 정관형 배터리",
  편인: "한 장면이 오래 남는 편인형 여운 팬",
  정인: "다인이가 당신을 계속 타오르게 하는 연료",
};

const DAENI_TO_DAY: Record<TenGodName, string> = {
  비견: "다인이 쪽에서도 동질감을 느끼는 결",
  겁재: "서로를 자극하는 라이벌 기질의 끌림",
  식신: "다인이의 플레이가 당신 안에서 표현으로 피어나요",
  상관: "다인이가 던진 불꽃이 당신 리액션으로 튀어요",
  편재: "다인이의 흐름이 당신 덕질 스케줄을 움직입니다",
  정재: "다인이가 당신의 일상에 안정적으로 자리 잡아요",
  편관: "다인이의 승부가 당신에게 긴장과 몰입을 줘요",
  정관: "다인이가 당신 응원의 기준점이 됩니다",
  편인: "다인이가 당신 영감의 원천이 돼요",
  정인: "다인이가 당신을 키우는 정인 포지션",
};

const YUKHAP = new Set(["2-11", "3-10", "6-7"]); // 寅亥, 戌卯, 午未
const CHUNG = new Set(["2-8", "4-10", "1-7"]); // 寅申, 辰戌, 丑未
const WONJIN = new Set(["2-9", "0-10", "1-6", "3-8", "4-11", "5-7"]);
const GWIMUN = new Set(["2-7", "0-9", "3-6", "4-5", "1-8", "10-11"]);
const HWA_GUK = new Set([2, 6, 10]); // 寅午戌

const BAEKHO_PILLARS = new Set(["甲辰", "乙未", "丙戌", "丁丑", "戊辰", "壬戌", "癸丑"]);
const GOEGANG_PILLARS = new Set(["庚辰", "庚戌", "壬辰", "壬戌"]);

const SHARED_SINSAL_KEYS = ["백호", "귀문", "화개", "괴강"] as const;

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function emptyTenGodCount(): TenGodGroupCount {
  return { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
}

function bumpTenGod(count: TenGodGroupCount, god: TenGodName) {
  if (god === "비견" || god === "겁재") count.비겁++;
  else if (god === "식신" || god === "상관") count.식상++;
  else if (god === "정재" || god === "편재") count.재성++;
  else if (god === "정관" || god === "편관") count.관성++;
  else if (god === "정인" || god === "편인") count.인성++;
}

function missingElementsOf(el: ElementCount): ElementKey[] {
  return (["목", "화", "토", "금", "수"] as ElementKey[]).filter((k) => el[k] === 0);
}

export function titleForScore(score: number): string {
  return TITLES.find((t) => score >= t.min)!.title;
}

export function dayStemPoints(god: TenGodName): number {
  if (god === "정인" || god === "식신") return SCORE.DAY_STEM.jeonginSiksin;
  if (god === "편인" || god === "상관") return SCORE.DAY_STEM.pyeoninSanggwan;
  if (god === "정재" || god === "편재" || god === "정관" || god === "편관") {
    return SCORE.DAY_STEM.jaeGwan;
  }
  return SCORE.DAY_STEM.bigyeop;
}

/** 양방향 십성 중 높은 쪽 */
export function scoreDayStem(visitorDayStemIdx: number): number {
  const a = tenGod(visitorDayStemIdx, DAENI.dayStem);
  const b = tenGod(DAENI.dayStem, visitorDayStemIdx);
  return Math.max(dayStemPoints(a), dayStemPoints(b));
}

export function scoreElement(visitorElements: ElementCount): {
  points: number;
  notes: string[];
} {
  let raw = 0;
  const notes: string[] = [];

  if (visitorElements.화 > 0) {
    raw += SCORE.ELEMENT.fillsDaeniFire;
    notes.push("다인이의 없는 불(식상·기량의 별)을 채워주는 팬");
  }
  if (visitorElements.금 > 0) {
    raw += SCORE.ELEMENT.fillsDaeniMetal;
    notes.push("다인이에게 필요한 단단함(관성)을 보태는 팬");
  }

  const visitorMissing = missingElementsOf(visitorElements);
  const daeniFills = visitorMissing.some((miss) => DAENI.elements[miss] > 0);
  if (daeniFills) {
    raw += SCORE.ELEMENT.daeniFillsVisitor;
    for (const miss of visitorMissing) {
      if (DAENI.elements[miss] > 0) {
        notes.push(`당신의 빈자리(${miss})를 다인이의 ${miss} 기운이 메워 주는 케미`);
      }
    }
  }

  if (notes.length === 0) {
    notes.push("오행이 겹치기보다, 응원 방식에서 케미가 나는 타입");
  }

  return { points: Math.min(raw, SCORE.ELEMENT.MAX), notes };
}

export type BranchFlags = {
  yukhap: boolean;
  banhap: boolean;
  wonjinGwimun: boolean;
  chung: boolean;
};

export function detectBranchFlags(visitorBranches: number[]): BranchFlags {
  let yukhap = false;
  let chung = false;
  let wonjinGwimun = false;

  for (const vb of visitorBranches) {
    for (const db of DAENI.branches) {
      const key = pairKey(vb, db);
      if (YUKHAP.has(key)) yukhap = true;
      if (CHUNG.has(key)) chung = true;
      if (WONJIN.has(key) || GWIMUN.has(key)) wonjinGwimun = true;
    }
  }

  // 화국 寅午戌 반합: 다인 寅·戌 + 방문자 화국 지지
  const visitorTouchesHwa = visitorBranches.some((b) => HWA_GUK.has(b));
  const banhap = visitorTouchesHwa;

  return { yukhap, banhap, wonjinGwimun, chung };
}

export function scoreBranch(flags: BranchFlags): number {
  let raw = 0;
  if (flags.yukhap) raw += SCORE.BRANCH.yukhap;
  if (flags.banhap) raw += SCORE.BRANCH.banhap;
  if (flags.wonjinGwimun) raw += SCORE.BRANCH.wonjinGwimun;
  if (flags.chung) raw += SCORE.BRANCH.chung;
  return Math.min(raw, SCORE.BRANCH.MAX);
}

/** 백호·귀문·화개·괴강 겹침 개수 (종류당 1) */
export function countSharedSinsal(visitorSinsal: string[]): number {
  let n = 0;
  for (const key of SHARED_SINSAL_KEYS) {
    if (visitorSinsal.some((s) => s.includes(key))) n++;
  }
  return n;
}

export function scoreSinsal(sharedCount: number): number {
  return Math.min(sharedCount * SCORE.SINSAL.perShared, SCORE.SINSAL.MAX);
}

export function finalizeScore(parts: {
  element: number;
  branch: number;
  dayStem: number;
  sinsal: number;
}): number {
  const total =
    SCORE.BASE + parts.element + parts.branch + parts.dayStem + parts.sinsal;
  return Math.max(0, Math.min(100, total));
}

function detectVisitorSinsal(pillars: Pillar[]): string[] {
  const found: string[] = [];
  const branches = pillars.map((p) => p.branch);

  for (const p of pillars) {
    const name = formatPillar(p);
    if (BAEKHO_PILLARS.has(name)) {
      if (GOEGANG_PILLARS.has(name)) found.push(`백호살·괴강(${name})`);
      else found.push(`백호살(${name})`);
    } else if (GOEGANG_PILLARS.has(name)) {
      found.push(`괴강(${name})`);
    }
  }

  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      if (GWIMUN.has(pairKey(branches[i], branches[j]))) {
        found.push(
          `귀문관살(${BRANCHES[branches[i]]}${BRANCHES[branches[j]]})`
        );
      }
    }
  }

  const hwagaeOf = (b: number): number | null => {
    if (b === 2 || b === 6 || b === 10) return 10;
    if (b === 11 || b === 3 || b === 7) return 7;
    if (b === 8 || b === 0 || b === 4) return 4;
    if (b === 5 || b === 9 || b === 1) return 1;
    return null;
  };
  const yearBranch = pillars[0]?.branch;
  if (yearBranch !== undefined) {
    const hg = hwagaeOf(yearBranch);
    if (hg !== null && branches.includes(hg)) {
      found.push(`화개살(${BRANCHES[hg]})`);
    }
  }

  const yeokmaOf: Record<number, number> = {
    2: 8,
    6: 0,
    10: 4,
    8: 2,
    0: 6,
    4: 10,
    11: 5,
    3: 9,
    7: 1,
    5: 11,
    9: 3,
    1: 7,
  };
  if (yearBranch !== undefined) {
    const ym = yeokmaOf[yearBranch];
    if (ym !== undefined && branches.includes(ym)) {
      found.push("역마살");
    }
  }

  return found;
}

function buildSummary(input: BirthInput): SajuSummary {
  const hasHour = input.hour !== null;
  const raw = compute(input.year, input.month, input.day, input.hour);
  const day = raw.pillars[2];
  const labels = hasHour ? PILLAR_LABELS_WITH_HOUR : PILLAR_LABELS_NO_HOUR;

  const tenGodCount = emptyTenGodCount();
  for (let i = 0; i < raw.pillars.length; i++) {
    const p = raw.pillars[i];
    if (i !== 2) bumpTenGod(tenGodCount, tenGod(day.stem, p.stem));
    bumpTenGod(tenGodCount, tenGodFromBranch(day.stem, p.branch));
  }

  const sinsal = normalizeSinsalForMbti(detectVisitorSinsal(raw.pillars));

  return {
    dayStem: STEMS[day.stem],
    dayStemKo: STEM_KO[day.stem],
    dayStemIdx: day.stem,
    dayBranchIdx: day.branch,
    dayElement: STEM_ELEMENT[day.stem],
    pillars: raw.pillars.map((p, i) => ({
      label: labels[i],
      hanja: formatPillar(p),
      ko: formatPillarKo(p),
      stem: p.stem,
      branch: p.branch,
    })),
    elements: raw.elementCount,
    tenGodCount,
    sinsal,
    nearTermBoundary: raw.nearTermBoundary,
    hasHour,
  };
}

export function computeCompat(input: BirthInput): CompatResult {
  const summary = buildSummary(input);
  const badges: CompatBadge[] = [];

  const element = scoreElement(summary.elements);
  const branchFlags = detectBranchFlags(summary.pillars.map((p) => p.branch));
  const branchPoints = scoreBranch(branchFlags);
  const dayStemPts = scoreDayStem(summary.dayStemIdx);
  const sharedCount = countSharedSinsal(summary.sinsal);
  const sinsalPts = scoreSinsal(sharedCount);

  if (branchFlags.yukhap) badges.push({ id: "yukhap", label: "착 붙는 인연" });
  if (branchFlags.banhap) badges.push({ id: "banhab", label: "직관 증폭형" });
  if (branchFlags.chung) badges.push({ id: "chung", label: "심장 요동형" });
  if (branchFlags.wonjinGwimun) {
    badges.push({ id: "gravity", label: "못 벗어나는 중력" });
  }

  for (const key of SHARED_SINSAL_KEYS) {
    if (summary.sinsal.some((s) => s.includes(key))) {
      const label =
        key === "백호"
          ? "백호살"
          : key === "귀문"
            ? "귀문관살"
            : key === "화개"
              ? "화개살"
              : "괴강";
      badges.push({ id: `shared-${key}`, label: `다인이랑 같은 별: ${label}` });
    }
  }

  const god = tenGod(summary.dayStemIdx, DAENI.dayStem);
  const reverseGod = tenGod(DAENI.dayStem, summary.dayStemIdx);

  const score = finalizeScore({
    element: element.points,
    branch: branchPoints,
    dayStem: dayStemPts,
    sinsal: sinsalPts,
  });

  const seen = new Set<string>();
  const uniqueBadges = badges.filter((b) => {
    if (seen.has(b.label)) return false;
    seen.add(b.label);
    return true;
  });

  return {
    score,
    title: titleForScore(score),
    dayRelation: DAY_TO_DAENI[god],
    dayRelationReverse: DAENI_TO_DAY[reverseGod],
    elementNotes: element.notes,
    badges: uniqueBadges,
    summary,
  };
}

export function normalizeSinsalForMbti(sinsal: string[]): string[] {
  const next = [...sinsal];
  if (next.some((s) => s.includes("화개")) && !next.includes("화개살")) {
    next.push("화개살");
  }
  if (next.some((s) => s.includes("역마")) && !next.includes("역마살")) {
    next.push("역마살");
  }
  return next;
}
