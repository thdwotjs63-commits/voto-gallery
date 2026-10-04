import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({
  put: vi.fn(async () => ({})),
  get: vi.fn(async () => null),
  head: vi.fn(async () => ({})),
  list: vi.fn(async () => ({ blobs: [], hasMore: false })),
  del: vi.fn(async () => undefined),
}));
const oidcMock = vi.hoisted(() => ({ getVercelOidcToken: vi.fn(async () => "oidc-token") }));

vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/blob")>()),
  ...blobMocks,
}));
vi.mock("@vercel/oidc", () => oidcMock);

import {
  BoothBlobConfigError,
  boothBlobDel,
  boothBlobGet,
  boothBlobList,
  boothBlobPutJpeg,
  hasBoothBlobCredentials,
} from "./booth-blob";

const ENV_KEYS = ["BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID", "VERCEL_OIDC_TOKEN"] as const;

function jwtWithExp(expSeconds: number) {
  const part = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${part({ alg: "none" })}.${part({ exp: expSeconds })}.sig`;
}

beforeEach(() => {
  for (const key of ENV_KEYS) vi.stubEnv(key, "");
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("booth blob auth", () => {
  it("uses BLOB_READ_WRITE_TOKEN when present", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "rw-token");
    vi.stubEnv("BLOB_STORE_ID", "store_abc");
    await boothBlobPutJpeg("test", "booth/x.jpg", Buffer.from([1]));
    expect(blobMocks.put).toHaveBeenCalledWith(
      "booth/x.jpg",
      expect.any(Buffer),
      expect.objectContaining({ access: "private", token: "rw-token" })
    );
    expect(oidcMock.getVercelOidcToken).not.toHaveBeenCalled();
  });

  it("falls back to BLOB_STORE_ID + OIDC token for every command", async () => {
    vi.stubEnv("BLOB_STORE_ID", "store_abc");
    const auth = { oidcToken: "oidc-token", storeId: "store_abc" };

    await boothBlobGet("test", "booth/x.jpg");
    await boothBlobList("test", { prefix: "booth/" });
    await boothBlobDel("test", ["https://example/x.jpg"]);

    expect(blobMocks.get).toHaveBeenCalledWith("booth/x.jpg", { access: "private", ...auth });
    expect(blobMocks.list).toHaveBeenCalledWith({ prefix: "booth/", ...auth });
    expect(blobMocks.del).toHaveBeenCalledWith(["https://example/x.jpg"], auth);
  });

  it("fails with the missing-env message when neither is set", async () => {
    expect(hasBoothBlobCredentials()).toBe(false);
    await expect(boothBlobGet("test", "booth/x.jpg")).rejects.toThrow(
      "missing BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID"
    );
  });

  it("logs the env pull hint when the local OIDC token expired", async () => {
    vi.stubEnv("BLOB_STORE_ID", "store_abc");
    vi.stubEnv("VERCEL_OIDC_TOKEN", jwtWithExp(Math.floor(Date.now() / 1000) - 60));
    oidcMock.getVercelOidcToken.mockRejectedValueOnce(new Error("token expired"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(boothBlobGet("test", "booth/x.jpg")).rejects.toBeInstanceOf(BoothBlobConfigError);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("VERCEL_OIDC_TOKEN 만료"));
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("vercel env pull 다시 하세요"));
  });
});
