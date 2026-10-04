import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidBookAdminKey, isValidBookToken, readBookAuthHeaders } from "./book-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("book auth", () => {
  it("accepts only the exact BOOK_TOKEN", () => {
    vi.stubEnv("BOOK_TOKEN", "secret-token");
    expect(isValidBookToken("secret-token")).toBe(true);
    expect(isValidBookToken("secret-token-x")).toBe(false);
    expect(isValidBookToken("")).toBe(false);
  });

  it("rejects everything when BOOK_TOKEN is not set", () => {
    vi.stubEnv("BOOK_TOKEN", "");
    expect(isValidBookToken("")).toBe(false);
    expect(isValidBookToken("anything")).toBe(false);
  });

  it("checks the admin key separately", () => {
    vi.stubEnv("BOOK_ADMIN_KEY", "관리자키");
    expect(isValidBookAdminKey("관리자키")).toBe(true);
    expect(isValidBookAdminKey("secret-token")).toBe(false);
  });

  it("decodes encoded headers", () => {
    const headers = new Headers({
      "x-book-token": encodeURIComponent("secret-token"),
      "x-book-admin-key": encodeURIComponent("관리자키"),
    });
    expect(readBookAuthHeaders(headers)).toEqual({ token: "secret-token", adminKey: "관리자키" });
  });
});
