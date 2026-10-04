import { describe, expect, it } from "vitest";
import {
  boothDateKey,
  boothDayPrefix,
  boothPhotoBlobPath,
  boothPhotoPagePath,
  boothUploadErrorMessage,
  decodeBoothKeyHeader,
  encodeBoothKeyHeader,
  formatBoothDateLabel,
  isBoothDateKey,
  isBoothPhotoId,
} from "./booth-share";

describe("booth-share", () => {
  it("uses the Korean calendar date", () => {
    expect(boothDateKey(new Date("2026-10-04T14:59:00Z"))).toBe("20261004");
    expect(boothDateKey(new Date("2026-10-04T15:00:00Z"))).toBe("20261005");
  });

  it("builds blob and page paths", () => {
    const id = "0b6f2c1e-6a4d-4b8e-9f3a-2c1d0e9b8a7f";
    expect(boothDayPrefix("20261005")).toBe("booth/20261005/");
    expect(boothPhotoBlobPath("20261005", id)).toBe(`booth/20261005/${id}.jpg`);
    expect(boothPhotoPagePath("20261005", id)).toBe(`/p/20261005/${id}`);
  });

  it("validates date keys and ids", () => {
    expect(isBoothDateKey("20261005")).toBe(true);
    expect(isBoothDateKey("2026-10-05")).toBe(false);
    expect(isBoothPhotoId("0b6f2c1e-6a4d-4b8e-9f3a-2c1d0e9b8a7f")).toBe(true);
    expect(isBoothPhotoId("../../secret")).toBe(false);
  });

  it("formats the date label", () => {
    expect(formatBoothDateLabel("20261005")).toBe("2026.10.05");
  });

  it("maps upload failures to distinct messages", () => {
    expect(boothUploadErrorMessage(401)).toBe("행사 키가 맞지 않아요 (⚙ 설정 확인)");
    expect(boothUploadErrorMessage(413)).toBe("사진 용량이 너무 커요");
    expect(boothUploadErrorMessage(404)).toBe("업로드 주소를 찾을 수 없어요");
    expect(boothUploadErrorMessage(500, "missing BLOB_READ_WRITE_TOKEN")).toBe(
      "서버 설정 오류 · missing BLOB_READ_WRITE_TOKEN"
    );
    expect(boothUploadErrorMessage(504)).toBe("서버 설정 오류 (504)");
    expect(boothUploadErrorMessage(415)).toBe("업로드 실패 (415)");
  });

  it("round-trips non-ASCII booth keys through the header", () => {
    expect(decodeBoothKeyHeader(encodeBoothKeyHeader(" 다인네컷1005 "))).toBe("다인네컷1005");
    expect(decodeBoothKeyHeader("%E0%A4%A")).toBe("");
    expect(decodeBoothKeyHeader(null)).toBe("");
  });
});
