/** 행사 모드 사진 Blob — 서버 전용. put/get/head/list/del 은 모두 여기를 거친다 */

import { BlobAccessError, del, get, head, list, put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";

/** 스토어가 Private 이라 모든 사진은 인증된 서버 요청으로만 읽고 쓴다 */
export const BOOTH_BLOB_ACCESS = "private" as const;

export const BOOTH_BLOB_MISSING_ENV = "BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID";

const OIDC_REFRESH_HINT = "vercel env pull 다시 하세요";

type BoothBlobAuth =
  | { kind: "token"; token: string }
  | { kind: "oidc"; oidcToken: string; storeId: string };

/** 인증 정보가 없거나 OIDC 토큰을 못 가져온 경우 */
export class BoothBlobConfigError extends Error {}

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function hasBoothBlobCredentials(): boolean {
  return Boolean(readEnv("BLOB_READ_WRITE_TOKEN") || readEnv("BLOB_STORE_ID"));
}

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

/**
 * BLOB_READ_WRITE_TOKEN 이 있으면 그 토큰, 없으면 BLOB_STORE_ID + OIDC 토큰.
 * OIDC 토큰은 Vercel 런타임에선 요청 헤더, 로컬에선 VERCEL_OIDC_TOKEN 에서 SDK 가 가져온다.
 */
async function resolveBoothBlobAuth(scope: string): Promise<BoothBlobAuth> {
  const token = readEnv("BLOB_READ_WRITE_TOKEN");
  if (token) return { kind: "token", token };

  const storeId = readEnv("BLOB_STORE_ID");
  if (!storeId) throw new BoothBlobConfigError(`missing ${BOOTH_BLOB_MISSING_ENV}`);

  try {
    const oidcToken = (await getVercelOidcToken()).trim();
    if (!oidcToken) throw new Error("empty OIDC token");
    return { kind: "oidc", oidcToken, storeId };
  } catch (error) {
    const envToken = readEnv("VERCEL_OIDC_TOKEN");
    const reason = !envToken
      ? "VERCEL_OIDC_TOKEN 없음"
      : isJwtExpired(envToken)
        ? "VERCEL_OIDC_TOKEN 만료"
        : "OIDC 토큰을 가져오지 못함";
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}] ${reason} — ${OIDC_REFRESH_HINT} (${detail})`);
    throw new BoothBlobConfigError(`OIDC token unavailable: ${reason}`);
  }
}

function authOptions(auth: BoothBlobAuth) {
  return auth.kind === "token"
    ? { token: auth.token }
    : { oidcToken: auth.oidcToken, storeId: auth.storeId };
}

function isAuthRejected(error: unknown): boolean {
  if (error instanceof BlobAccessError) return true;
  const message = error instanceof Error ? error.message : "";
  return /\b(401|403)\b/.test(message);
}

async function withBoothBlob<T>(
  scope: string,
  run: (auth: ReturnType<typeof authOptions>) => Promise<T>
): Promise<T> {
  const auth = await resolveBoothBlobAuth(scope);
  try {
    return await run(authOptions(auth));
  } catch (error) {
    if (auth.kind === "oidc" && isAuthRejected(error)) {
      console.error(`[${scope}] Blob 이 OIDC 토큰을 거부함 (만료됐을 수 있음) — ${OIDC_REFRESH_HINT}`);
    }
    throw error;
  }
}

export function boothBlobPutJpeg(scope: string, pathname: string, body: Buffer) {
  return withBoothBlob(scope, (auth) =>
    put(pathname, body, {
      access: BOOTH_BLOB_ACCESS,
      addRandomSuffix: false,
      contentType: "image/jpeg",
      ...auth,
    })
  );
}

export function boothBlobGet(scope: string, pathname: string) {
  return withBoothBlob(scope, (auth) => get(pathname, { access: BOOTH_BLOB_ACCESS, ...auth }));
}

export function boothBlobHead(scope: string, pathname: string) {
  return withBoothBlob(scope, (auth) => head(pathname, auth));
}

export function boothBlobList(
  scope: string,
  options: { prefix: string; cursor?: string; limit?: number }
) {
  return withBoothBlob(scope, (auth) => list({ ...options, ...auth }));
}

export function boothBlobDel(scope: string, urls: string[]) {
  return withBoothBlob(scope, (auth) => del(urls, auth));
}
