/**
 * GA4 helpers. Set `NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX` in `.env.local` (and on Vercel).
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isValidGaMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(id.trim());
}

/** Trimmed GA4 measurement ID, or null if unset/invalid. */
export function getGaMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";
  if (!id || !isValidGaMeasurementId(id)) return null;
  return id;
}

export function isGaConfigured(): boolean {
  return getGaMeasurementId() !== null;
}

/**
 * Sends a GA4 recommended/custom event. No-op if gtag is not loaded or ID missing.
 */
export function trackGaEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  if (!isGaConfigured()) return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params ?? {});
}
