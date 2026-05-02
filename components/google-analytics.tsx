import Script from "next/script";
import { getGaMeasurementId } from "@/lib/analytics";

/**
 * Loads gtag.js only when `NEXT_PUBLIC_GA_ID` is set and looks like a GA4 measurement ID.
 * Uses `afterInteractive` so LCP/initial paint is not blocked.
 */
export function GoogleAnalytics() {
  const gaId = getGaMeasurementId();
  if (!gaId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}', { send_page_view: true });
`}
      </Script>
    </>
  );
}
