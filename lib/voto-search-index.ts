import type { VotoImage } from "@/lib/voto-gallery-data";

export type AggregatedSearchTag = {
  display: string;
  normalized: string;
  count: number;
};

function normalizeForSearch(input: string): string {
  // macOS(HFS+/APFS) 파일명에서 한글이 NFD(분해형)로 들어오는 경우가 있어,
  // UI 입력(대개 NFC)과의 includes 비교가 실패할 수 있다. 비교 전 NFC로 정규화한다.
  return input.normalize("NFC").toLowerCase();
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return Array.from(new Set(matches));
}

function tokenizeFilename(filename: string): string[] {
  const stem = filename.replace(/\.[^.]+$/iu, "").trim();
  if (!stem) return [];
  return stem
    .split(/[_\s\-,.]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/**
 * Per-image dedupe, then global counts: hashtags (description) + filename tokens.
 */
export function buildAggregatedTags(images: VotoImage[]): AggregatedSearchTag[] {
  const countByNorm = new Map<string, number>();
  const displayByNorm = new Map<string, string>();

  for (const img of images) {
    const seenNorm = new Set<string>();
    const bump = (raw: string) => {
      const display = raw.trim();
      if (display.length < 1) return;
      const norm = normalizeForSearch(display);
      if (seenNorm.has(norm)) return;
      seenNorm.add(norm);
      countByNorm.set(norm, (countByNorm.get(norm) ?? 0) + 1);
      if (!displayByNorm.has(norm)) displayByNorm.set(norm, display);
    };

    for (const h of extractHashtags(img.description)) bump(h);
    for (const t of tokenizeFilename(img.name)) bump(t);
  }

  const out: AggregatedSearchTag[] = [];
  for (const [norm, count] of countByNorm) {
    out.push({
      normalized: norm,
      display: displayByNorm.get(norm) ?? norm,
      count,
    });
  }
  out.sort((a, b) =>
    b.count !== a.count ? b.count - a.count : a.display.localeCompare(b.display, "ko", { numeric: true })
  );
  return out;
}

export function filterImagesByQuery(images: VotoImage[], query: string): VotoImage[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return images;
  return images.filter((img) => {
    if (normalizeForSearch(img.name).includes(q)) return true;
    if (normalizeForSearch(img.description).includes(q)) return true;
    return false;
  });
}

const MAX_SUGGESTIONS = 24;

export function matchingTagsForQuery(tags: AggregatedSearchTag[], query: string): AggregatedSearchTag[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return [];
  const matched = tags.filter(
    (t) => t.normalized.includes(q) || normalizeForSearch(t.display).includes(q)
  );
  return matched.slice(0, MAX_SUGGESTIONS);
}
