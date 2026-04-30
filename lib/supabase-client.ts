import { createClient } from "@supabase/supabase-js";

/**
 * Supabase expects the project base URL (scheme + host), e.g.
 * https://xxxx.supabase.co — not .../rest/v1/. The client appends /rest/v1 itself;
 * including /rest/v1 in the env var breaks requests ("Invalid path specified in request URL").
 */
function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `https://${withProtocol}`;
  }

  try {
    return new URL(withProtocol).origin;
  } catch {
    return trimmed
      .replace(/\/+$/, "")
      .replace(/\/rest\/v1\/?$/i, "")
      .replace(/\/+$/, "");
  }
}

const supabaseUrl = normalizeSupabaseUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
);
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] Set NEXT_PUBLIC_SUPABASE_URL (project URL only, no /rest/v1) and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
