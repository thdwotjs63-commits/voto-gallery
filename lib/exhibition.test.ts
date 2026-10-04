import { describe, expect, it } from "vitest";
import { parseTags, type DriveImage } from "./drive-gallery-data";
import { exhibitionOrder, selectExhibitionPhotos } from "./exhibition";

const image = (id: string, name: string, tags: string[]): DriveImage =>
  ({ id, name, tags, width: 1200, height: 1800 }) as DriveImage;

const ids = (images: DriveImage[]) => selectExhibitionPhotos(images).map((photo) => photo.photoId);

describe("exhibitionOrder", () => {
  it("reads the number after exhibition_ as an integer", () => {
    expect(exhibitionOrder(["#20261010", "#exhibition_01"])).toBe(1);
    expect(exhibitionOrder(["#Exhibition_12"])).toBe(12);
    expect(exhibitionOrder(["exhibition_2"])).toBe(2);
    expect(exhibitionOrder(["#exhibition_07", "#exhibition_03"])).toBe(3);
  });

  it("puts a plain #exhibition last and skips photos without the tag", () => {
    expect(exhibitionOrder(["#exhibition"])).toBe(Infinity);
    expect(exhibitionOrder(["#exhibition", "#exhibition_04"])).toBe(4);
    expect(exhibitionOrder(["#exhibition_99999999999999999999"])).toBe(Infinity);
    expect(exhibitionOrder(["#banner", "#exhibition_", "#exhibition_a1", "#myexhibition_1"])).toBeNull();
  });
});

describe("selectExhibitionPhotos", () => {
  it("keeps only exhibition photos and their sizes", () => {
    expect(
      selectExhibitionPhotos([
        image("x", "x.jpg", ["#banner"]),
        image("a", "a.jpg", ["#20261010", "#exhibition_01"]),
      ])
    ).toEqual([
      { photoId: "a", src: "https://lh3.googleusercontent.com/d/a=s2000", width: 1200, height: 1800 },
    ]);
  });

  it("sorts exhibition_01, _03, _02 into 1, 2, 3", () => {
    expect(
      ids([
        image("one", "c.jpg", ["#exhibition_01"]),
        image("three", "a.jpg", ["#exhibition_03"]),
        image("two", "b.jpg", ["#exhibition_02"]),
      ])
    ).toEqual(["one", "two", "three"]);
  });

  it("sorts by number, so exhibition_10 comes after exhibition_2", () => {
    expect(
      ids([
        image("ten", "a.jpg", ["#exhibition_10"]),
        image("two", "b.jpg", ["#exhibition_2"]),
      ])
    ).toEqual(["two", "ten"]);
  });

  it("breaks a tie on the same number by file name", () => {
    expect(
      ids([
        image("later", "20261012_b.jpg", ["#exhibition_01"]),
        image("second", "x.jpg", ["#exhibition_02"]),
        image("earlier", "20261010_a.jpg", ["#exhibition_01"]),
      ])
    ).toEqual(["earlier", "later", "second"]);
  });

  it("puts plain #exhibition photos after the numbered ones", () => {
    expect(
      ids([
        image("plain-b", "b.jpg", ["#exhibition"]),
        image("five", "z.jpg", ["#exhibition_05"]),
        image("plain-a", "a.jpg", ["#exhibition"]),
        image("one", "y.jpg", ["#exhibition_1"]),
      ])
    ).toEqual(["one", "five", "plain-a", "plain-b"]);
  });
});

describe("exhibition tags from Drive", () => {
  it("keeps exhibition_01 as one tag in a file name", () => {
    expect(parseTags("", "20261010_수원_exhibition_01.jpg")).toEqual([
      "#20261010",
      "#수원",
      "#exhibition_01",
    ]);
  });

  it("reads #exhibition_01 from the description", () => {
    expect(parseTags("#20261010 #수원 #서브 #Exhibition_01", "a.jpg")).toContain("#exhibition_01");
  });

  it("picks exhibition_01 from the file name even when the description has tags", () => {
    expect(parseTags("#20261010 #수원 #서브", "20261010_exhibition_03.jpg")).toEqual([
      "#20261010",
      "#수원",
      "#서브",
      "#exhibition_03",
    ]);
  });
});
