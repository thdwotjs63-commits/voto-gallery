import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDriveGalleryImages } from "./drive-gallery-data";
import { cleanPhotoName, getWorldcupPhotos } from "./exhibition";
import { pickWorldcupEntrants } from "./worldcup";

const WORLDCUP = "worldcup-folder";
const ROOT = "gallery-root";

type DriveFile = Record<string, unknown>;

/** q 의 "'<폴더>' in parents" 와 종류(폴더/이미지)에 따라 응답하는 가짜 Drive API */
function mockDrive(tree: Record<string, { folders?: DriveFile[]; images?: DriveFile[] }>) {
  const fetchMock = vi.fn(async (...args: [input: string | URL, init?: unknown]) => {
    const url = new URL(String(args[0]));
    if (!url.pathname.endsWith("/files")) {
      return new Response(JSON.stringify({ name: "voto gallery" }));
    }
    const q = url.searchParams.get("q") ?? "";
    const parent = /'([^']+)' in parents/.exec(q)?.[1] ?? "";
    const node = tree[parent] ?? {};
    const files = q.includes("vnd.google-apps.folder") ? node.folders ?? [] : node.images ?? [];
    return new Response(JSON.stringify({ files }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const listedParents = (fetchMock: ReturnType<typeof mockDrive>) =>
  fetchMock.mock.calls
    .map(([input]) => /'([^']+)' in parents/.exec(new URL(String(input)).searchParams.get("q") ?? "")?.[1])
    .filter(Boolean);

const image = (id: string, name: string, mimeType = "image/jpeg") => ({
  id,
  name,
  mimeType,
  imageMediaMetadata: { width: 1000, height: 1500 },
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY", "test-key");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID", ROOT);
  vi.stubEnv("WORLDCUP_DRIVE_FOLDER_ID", WORLDCUP);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("cleanPhotoName", () => {
  it("drops the extension and the Drive copy suffix", () => {
    expect(cleanPhotoName("따봉.JPG의 사본")).toBe("따봉");
    expect(cleanPhotoName("봉켓몬스터.jpeg의 사본")).toBe("봉켓몬스터");
    expect(cleanPhotoName("서브 준비.png")).toBe("서브 준비");
    expect(cleanPhotoName("하트.heic 의 사본 (2)")).toBe("하트");
    expect(cleanPhotoName("Copy of 웃음.webp")).toBe("웃음");
    expect(cleanPhotoName("따봉.JPG의 사본의 사본")).toBe("따봉");
  });

  it("hides the order prefix used for sorting", () => {
    expect(cleanPhotoName("01_따봉.JPG의 사본")).toBe("따봉");
    expect(cleanPhotoName("2-세리머니.jpg")).toBe("세리머니");
    expect(cleanPhotoName("12. 블로킹.png")).toBe("블로킹");
  });

  it("keeps names that only look numeric", () => {
    expect(cleanPhotoName("2024_수원.jpg")).toBe("2024_수원");
    expect(cleanPhotoName("3번 유니폼.jpg")).toBe("3번 유니폼");
    expect(cleanPhotoName("07.jpg")).toBe("07");
    expect(cleanPhotoName("다인이.jpg.jpg")).toBe("다인이");
  });
});

describe("getWorldcupPhotos", () => {
  it("lists only images in the worldcup folder, sorted by file name", async () => {
    const fetchMock = mockDrive({
      [WORLDCUP]: {
        images: [
          image("c", "10_c.jpg"),
          image("v", "03_clip.mp4", "video/mp4"),
          image("a", "2_a.png", "image/png"),
          image("b", "01_b.jpg"),
        ],
      },
    });

    const photos = await getWorldcupPhotos();

    expect(photos).toEqual([
      { photoId: "b", src: "https://lh3.googleusercontent.com/d/b=s2000", width: 1000, height: 1500, name: "b" },
      { photoId: "a", src: "https://lh3.googleusercontent.com/d/a=s2000", width: 1000, height: 1500, name: "a" },
      { photoId: "c", src: "https://lh3.googleusercontent.com/d/c=s2000", width: 1000, height: 1500, name: "c" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    const q = new URL(String(input)).searchParams.get("q");
    expect(q).toBe(`'${WORLDCUP}' in parents and mimeType contains 'image/' and trashed = false`);
    expect(init).toEqual({ next: { revalidate: 300 } });
  });

  it("follows Drive pagination", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const token = new URL(String(input)).searchParams.get("pageToken");
      return new Response(
        JSON.stringify(
          token ? { files: [image("b", "b.jpg")] } : { files: [image("a", "a.jpg")], nextPageToken: "next" }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    expect((await getWorldcupPhotos()).map((p) => p.photoId)).toEqual(["a", "b"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses only the first 32 by file name when the folder has more", async () => {
    mockDrive({
      [WORLDCUP]: {
        images: Array.from({ length: 34 }, (_, i) => image(`p${i + 1}`, `${i + 1}.jpg`)).reverse(),
      },
    });

    const entrants = pickWorldcupEntrants(await getWorldcupPhotos());
    expect(entrants).toHaveLength(32);
    expect(entrants[0].photoId).toBe("p1");
    expect(entrants[31].photoId).toBe("p32");
  });

  it("fails without the folder id so the page can show the preparing notice", async () => {
    vi.stubEnv("WORLDCUP_DRIVE_FOLDER_ID", "");
    const fetchMock = mockDrive({});
    await expect(getWorldcupPhotos()).rejects.toThrow("WORLDCUP_DRIVE_FOLDER_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("main gallery isolation", () => {
  it("never reads the worldcup folder even if it sits inside the gallery tree", async () => {
    const fetchMock = mockDrive({
      [ROOT]: {
        folders: [
          { id: WORLDCUP, name: "김다인월드컵" },
          { id: "game", name: "20261010_수원" },
        ],
      },
      game: { images: [image("g1", "20261010_수원_서브.jpg")] },
      [WORLDCUP]: { images: [image("w1", "01.jpg")] },
    });

    const images = await fetchDriveGalleryImages();

    expect(images.map((img) => img.id)).toEqual(["g1"]);
    expect(listedParents(fetchMock)).not.toContain(WORLDCUP);
  });
});
