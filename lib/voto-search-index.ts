import type { VotoImage } from "@/lib/voto-gallery-data";

export type AggregatedSearchTag = {
  display: string;
  normalized: string;
  count: number;
};

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return Array.from(new Set(matches));
}

function tokenizeFilename(filename: string): string[] {
  const stem = filename.replace(/\.[^.]+$/iu, "").trim();
  if (!stem) return [];
  return stem
    .split(/[_\s\-.]+/u)
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
      const norm = display.toLowerCase();
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
  const q = query.trim().toLowerCase();
  if (!q) return images;
  return images.filter((img) => {
    if (img.name.toLowerCase().includes(q)) return true;
    if (img.description.toLowerCase().includes(q)) return true;
    return false;
  });
}

const MAX_SUGGESTIONS = 24;

export function matchingTagsForQuery(tags: AggregatedSearchTag[], query: string): AggregatedSearchTag[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matched = tags.filter(
    (t) => t.normalized.includes(q) || t.display.toLowerCase().includes(q)
  );
  return matched.slice(0, MAX_SUGGESTIONS);
}
