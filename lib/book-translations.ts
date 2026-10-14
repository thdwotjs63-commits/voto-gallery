/** 생일 메시지북 — 외국어 메시지에 한국어 번역을 미리 붙인다 (서버 전용) */

import { isForeignBookMessage, type BookMessage } from "./book-pages";
import { guessSourceLanguage, translateToKorean } from "./translate";

/** 번역 하나가 이보다 오래 걸리면 원문만 싣는다 (translateToKorean 은 재시도까지 최대 16초) */
const TRANSLATE_DEADLINE_MS = 10_000;

/** 책을 열 때마다 MyMemory 를 다시 부르지 않게 성공한 번역만 기억한다 (서버 인스턴스 단위) */
const translationCache = new Map<string, string>();

type Translate = (text: string) => Promise<string | null>;

async function translateWithDeadline(text: string, translate: Translate): Promise<string | undefined> {
  const cached = translationCache.get(text);
  if (cached) return cached;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      translate(text),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), TRANSLATE_DEADLINE_MS);
      }),
    ]);
    if (!result) return undefined;
    translationCache.set(text, result);
    return result;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** 한국어 메시지는 그대로, 외국어 메시지에는 sourceLang 과 (성공하면) translation 을 붙인다 */
export async function attachBookTranslations(
  messages: readonly BookMessage[],
  translate: Translate = translateToKorean
): Promise<BookMessage[]> {
  return Promise.all(
    messages.map(async (m) => {
      if (!isForeignBookMessage(m.message)) return m;
      const translation = await translateWithDeadline(m.message, translate);
      return { ...m, sourceLang: guessSourceLanguage(m.message), ...(translation ? { translation } : {}) };
    })
  );
}
