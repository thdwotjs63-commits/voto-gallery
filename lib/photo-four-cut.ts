/** 프레임 PNG 투명 구멍(사진 칸) — 프레임 원본 픽셀 좌표 */
export type FrameCellRect = { x: number; y: number; w: number; h: number };

export type OverlayFrameDef = {
  id: string;
  label: string;
  desc?: string;
  src: string;
  /** 행사 모드(?booth=1)에서만 노출 */
  boothOnly?: boolean;
  /** 일반 모드에도 보이지만, 행사 모드에선 boothOnly 프레임과 함께 행사 프레임 줄(맨 앞)에 놓임 */
  boothFeatured?: boolean;
  /** 어느 모드의 선택 목록에도 안 보임. ?frame=<id> 로 직접 열 때만 사용 */
  hidden?: boolean;
};

/** 칸 안 선수(불투명) 픽셀 분포 → 촬영 위치 안내 문구 */
export type CellStandHint = {
  message: string | null;
};

const ALPHA_OPAQUE = 128;

/** 반투명 가장자리까지 같은 구멍으로 묶기 */
const ALPHA_HOLE = 128;

type RawRegion = FrameCellRect & {
  area: number;
  touchesEdge: boolean;
};

type FrameLayoutLoaded = {
  cells: FrameCellRect[];
  width: number;
  height: number;
  frameImage: HTMLImageElement;
  standHints: CellStandHint[];
};

const cellCache = new Map<string, Promise<FrameLayoutLoaded>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

function sourcePixelSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height };
  }
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return { width: source.width, height: source.height };
  }
  return { width: 0, height: 0 };
}

/** 칸 안 cover 크롭 (미리보기·저장 공통) */
export function drawImageCoverInCell(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  mirrorHorizontal = false
) {
  const { width: iw, height: ih } = sourcePixelSize(source);
  if (iw <= 0 || ih <= 0) return;

  const ir = iw / ih;
  const cr = cellW / cellH;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (ir > cr) {
    sw = ih * cr;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / cr;
    sy = (ih - sh) / 2;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, cellW, cellH);
  ctx.clip();
  if (mirrorHorizontal) {
    ctx.translate(cellX + cellW, cellY);
    ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, cellW, cellH);
  } else {
    ctx.drawImage(source, sx, sy, sw, sh, cellX, cellY, cellW, cellH);
  }
  ctx.restore();
}

export type PaintFourCutInput = {
  frameWidth: number;
  frameHeight: number;
  frameImage: HTMLImageElement;
  cells: FrameCellRect[];
  /** 0~3, 찍은 사진 캐시 */
  capturedImages: (HTMLImageElement | null)[];
  /** 칸별 좌우 반전 (촬영 시점). capturedImages는 반전 없이 저장 */
  capturedMirrors?: (boolean | null)[];
  /** 지금 찍는 칸 (0~3). 라이브 미리보기 없으면 -1 */
  activeIndex: number;
  liveVideo?: HTMLVideoElement | null;
  /** 라이브 미리보기 좌우 반전 */
  liveMirrorHorizontal?: boolean;
  countdown?: number | null;
  nowMs?: number;
  reduceMotion?: boolean;
  debug?: boolean;
};

const ACTIVE_BORDER_PX = 3;

/** 흰 배경 → 칸별 사진/라이브/플레이스홀더 → 프레임 → 활성 테두리·카운트다운 */
export function paintFourCutFrame(ctx: CanvasRenderingContext2D, input: PaintFourCutInput) {
  const {
    frameWidth,
    frameHeight,
    frameImage,
    cells,
    capturedImages,
    capturedMirrors,
    activeIndex,
    liveVideo,
    liveMirrorHorizontal = true,
    countdown = null,
    nowMs = 0,
    reduceMotion = false,
    debug = false,
  } = input;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, frameWidth, frameHeight);

  for (let i = 0; i < 4; i++) {
    const cell = cells[i];
    if (!cell) continue;

    const captured = capturedImages[i];
    if (captured) {
      const mirror = capturedMirrors?.[i] ?? false;
      drawImageCoverInCell(ctx, captured, cell.x, cell.y, cell.w, cell.h, mirror);
    } else if (i === activeIndex && liveVideo && liveVideo.readyState >= 2 && liveVideo.videoWidth > 0) {
      drawImageCoverInCell(ctx, liveVideo, cell.x, cell.y, cell.w, cell.h, liveMirrorHorizontal);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cell.x, cell.y, cell.w, cell.h);
      ctx.clip();
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.fillStyle = "#9ca3af";
      const fontSize = Math.max(12, Math.round(cell.h * 0.32));
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), cell.x + cell.w / 2, cell.y + cell.h / 2);
      ctx.restore();
    }
  }

  ctx.drawImage(frameImage, 0, 0, frameWidth, frameHeight);

  if (debug && cells.length > 0) {
    drawCellDebugOverlay(ctx, cells, frameWidth);
  }

  if (activeIndex >= 0 && activeIndex < 4) {
    const cell = cells[activeIndex];
    if (cell) {
      const pulse = reduceMotion ? 1 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(nowMs / 180));
      ctx.save();
      ctx.strokeStyle = `rgba(255, 214, 0, ${pulse})`;
      ctx.lineWidth = ACTIVE_BORDER_PX;
      ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1);

      if (countdown !== null) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        ctx.fillStyle = "#ffffff";
        const cdSize = Math.max(18, Math.round(cell.h * 0.45));
        ctx.font = `800 ${cdSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(countdown), cell.x + cell.w / 2, cell.y + cell.h / 2);
      }
      ctx.restore();
    }
  }
}

export function computePreviewCanvasBackingSize(displayWidth: number, displayHeight: number) {
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  return {
    width: Math.max(1, Math.round(displayWidth * dpr)),
    height: Math.max(1, Math.round(displayHeight * dpr)),
    dpr,
  };
}

export function clientPointToFrameCoords(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const frameAspect = frameWidth / frameHeight;
  const rectAspect = rect.width / rect.height;
  let drawW: number;
  let drawH: number;
  let offsetX: number;
  let offsetY: number;

  if (frameAspect > rectAspect) {
    drawW = rect.width;
    drawH = rect.width / frameAspect;
    offsetX = 0;
    offsetY = (rect.height - drawH) / 2;
  } else {
    drawH = rect.height;
    drawW = rect.height * frameAspect;
    offsetX = (rect.width - drawW) / 2;
    offsetY = 0;
  }

  const localX = clientX - rect.left - offsetX;
  const localY = clientY - rect.top - offsetY;
  if (localX < 0 || localY < 0 || localX > drawW || localY > drawH) return null;

  return {
    x: (localX / drawW) * frameWidth,
    y: (localY / drawH) * frameHeight,
  };
}

export function findCellIndexAtPoint(x: number, y: number, cells: FrameCellRect[]): number {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return i;
  }
  return -1;
}

const MIN_INTERIOR_BLOB_FRAME_FRACTION = 0.002;

function verticalOverlapAmount(a: RawRegion, b: RawRegion): number {
  return Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function shouldMergeRegionsByY(a: RawRegion, b: RawRegion): boolean {
  const overlap = verticalOverlapAmount(a, b);
  const minH = Math.min(a.h, b.h);
  return minH > 0 && overlap >= minH * 0.5;
}

function mergeRegionBounds(a: RawRegion, b: RawRegion): RawRegion {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w);
  const y2 = Math.max(a.y + a.h, b.y + b.h);
  return {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    area: a.area + b.area,
    touchesEdge: a.touchesEdge || b.touchesEdge,
  };
}

/** 세로 범위가 크게 겹치는 투명 덩어리를 한 칸으로 합침 (분리된 사진 구멍) */
export function mergeRegionsByVerticalOverlap(regions: RawRegion[]): RawRegion[] {
  const list = regions.map((r) => ({ ...r }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (shouldMergeRegionsByY(list[i], list[j])) {
          list[i] = mergeRegionBounds(list[i], list[j]);
          list.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return list;
}

function logRegionSummary(
  label: string,
  frameWidth: number,
  frameHeight: number,
  regions: RawRegion[]
) {
  console.log(`[photo-four-cut] ${label}`, {
    frameSize: { width: frameWidth, height: frameHeight },
    count: regions.length,
    regions: regions.map((r, index) => ({
      index,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      pixels: r.area,
      touchesEdge: r.touchesEdge,
    })),
  });
}

function drawCellDebugOverlay(
  ctx: CanvasRenderingContext2D,
  cells: FrameCellRect[],
  frameWidth: number
) {
  const lineW = Math.max(2, Math.round(frameWidth * 0.004));
  const fontSize = Math.max(14, Math.round(frameWidth * 0.045));
  ctx.lineWidth = lineW;
  ctx.strokeStyle = "#ff0000";
  ctx.fillStyle = "#ff0000";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  cells.forEach((cell, i) => {
    ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1);
    ctx.fillText(String(i + 1), cell.x + cell.w / 2, cell.y + cell.h / 2);
  });
}

/** 오프스크린 canvas + flood fill (알파 < 128) */
export function detectFrameCellsFromImage(img: HTMLImageElement): FrameCellRect[] {
  const frameWidth = img.naturalWidth;
  const frameHeight = img.naturalHeight;
  if (frameWidth <= 0 || frameHeight <= 0) return [];

  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, frameWidth, frameHeight);
  return detectFrameCellsFromPixels(data, frameWidth, frameHeight, 4, true);
}

/** RGBA(또는 채널 수 지정) 픽셀에서 투명 구멍 4칸 찾기 — DOM 없이 테스트 가능 */
export function detectFrameCellsFromPixels(
  data: ArrayLike<number>,
  frameWidth: number,
  frameHeight: number,
  channels = 4,
  log = false
): FrameCellRect[] {
  const totalPixels = frameWidth * frameHeight;
  const visited = new Uint8Array(totalPixels);
  const logSummary: typeof logRegionSummary = (...args) => {
    if (log) logRegionSummary(...args);
  };

  const isHole = (x: number, y: number) =>
    data[(y * frameWidth + x) * channels + channels - 1] < ALPHA_HOLE;

  const allRegions: RawRegion[] = [];
  const stackX: number[] = [];
  const stackY: number[] = [];

  for (let sy = 0; sy < frameHeight; sy++) {
    for (let sx = 0; sx < frameWidth; sx++) {
      const startIdx = sy * frameWidth + sx;
      if (visited[startIdx] || !isHole(sx, sy)) continue;

      let minX = sx;
      let maxX = sx;
      let minY = sy;
      let maxY = sy;
      let area = 0;
      let touchesEdge = false;

      stackX.length = 0;
      stackY.length = 0;
      stackX.push(sx);
      stackY.push(sy);
      visited[startIdx] = 1;

      while (stackX.length > 0) {
        const x = stackX.pop()!;
        const y = stackY.pop()!;
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x === 0 || y === 0 || x === frameWidth - 1 || y === frameHeight - 1) {
          touchesEdge = true;
        }

        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ] as const;
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= frameWidth || ny >= frameHeight) continue;
          const ni = ny * frameWidth + nx;
          if (visited[ni] || !isHole(nx, ny)) continue;
          visited[ni] = 1;
          stackX.push(nx);
          stackY.push(ny);
        }
      }

      allRegions.push({
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        area,
        touchesEdge,
      });
    }
  }

  logSummary("all transparent blobs (before filter)", frameWidth, frameHeight, allRegions);

  const minInteriorArea = totalPixels * MIN_INTERIOR_BLOB_FRAME_FRACTION;
  const interior = allRegions.filter(
    (r) => !r.touchesEdge && r.area >= minInteriorArea
  );
  logSummary(
    `interior blobs (area >= ${MIN_INTERIOR_BLOB_FRAME_FRACTION * 100}% of frame, before merge)`,
    frameWidth,
    frameHeight,
    interior
  );

  const mergedInterior = mergeRegionsByVerticalOverlap(interior);
  logSummary("after merging vertically overlapping blobs", frameWidth, frameHeight, mergedInterior);

  const topFour = [...mergedInterior].sort((a, b) => b.area - a.area).slice(0, 4);
  const cells = topFour
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(({ x, y, w, h }) => ({ x, y, w, h }));

  if (log) {
    console.log("[photo-four-cut] selected photo cells (top 4 by area, ordered top→bottom)", {
      frameSize: { width: frameWidth, height: frameHeight },
      alphaThreshold: ALPHA_HOLE,
      minInteriorArea,
      cells: cells.map((c, i) => ({ number: i + 1, ...c })),
    });
  }

  if (cells.length < 4) {
    console.warn(
      `[photo-four-cut] expected 4 interior cells, got ${cells.length} (all blobs: ${allRegions.length}, interior: ${interior.length})`
    );
  }

  return cells;
}

/** 칸별 불투명 픽셀(선수 등) 좌·우 비교 → 서 있을 위치 */
export function computeCellStandHints(
  img: HTMLImageElement,
  cells: FrameCellRect[]
): CellStandHint[] {
  const frameWidth = img.naturalWidth;
  const frameHeight = img.naturalHeight;
  if (frameWidth <= 0 || frameHeight <= 0) {
    return cells.map(() => ({ message: null }));
  }

  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return cells.map(() => ({ message: null }));
  }

  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, frameWidth, frameHeight);

  return cells.map((cell) => {
    let leftOpaque = 0;
    let rightOpaque = 0;
    const midX = cell.x + cell.w / 2;

    for (let y = cell.y; y < cell.y + cell.h; y++) {
      for (let x = cell.x; x < cell.x + cell.w; x++) {
        const alpha = data[(y * frameWidth + x) * 4 + 3];
        if (alpha < ALPHA_OPAQUE) continue;
        if (x < midX) leftOpaque++;
        else rightOpaque++;
      }
    }

    if (leftOpaque + rightOpaque === 0) return { message: null };

    if (rightOpaque >= leftOpaque * 1.2) {
      return { message: "왼쪽에 서 주세요 👈" };
    }
    if (leftOpaque >= rightOpaque * 1.2) {
      return { message: "오른쪽에 서 주세요 👉" };
    }
    return { message: null };
  });
}

/** ?debug=1 미리보기: 프레임 위에 칸 테두리·번호 */
export function renderFrameCellDebugPreview(
  frameImage: HTMLImageElement,
  cells: FrameCellRect[]
): string {
  const w = frameImage.naturalWidth;
  const h = frameImage.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(frameImage, 0, 0);
  drawCellDebugOverlay(ctx, cells, w);
  return canvas.toDataURL("image/png");
}

export async function loadFrameLayout(src: string): Promise<FrameLayoutLoaded> {
  let pending = cellCache.get(src);
  if (!pending) {
    pending = (async () => {
      const frameImage = await loadImage(src);
      const width = frameImage.naturalWidth;
      const height = frameImage.naturalHeight;
      const cells = detectFrameCellsFromImage(frameImage);
      const standHints = computeCellStandHints(frameImage, cells);
      return { cells, width, height, frameImage, standHints };
    })();
    cellCache.set(src, pending);
  }
  return pending;
}

export function clearFrameLayoutCache(src?: string) {
  if (src) cellCache.delete(src);
  else cellCache.clear();
}

export type ComposeFrameOptions = {
  debug?: boolean;
  capturedMirrors?: (boolean | null)[];
};

/** 저장용 — Image 캐시로 합성 (미리보기와 동일 paintFourCutFrame) */
export function composeFrameFromImages(
  frameImage: HTMLImageElement,
  cells: FrameCellRect[],
  capturedImages: (HTMLImageElement | null)[],
  options?: ComposeFrameOptions
): HTMLCanvasElement {
  const w = frameImage.naturalWidth;
  const h = frameImage.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  paintFourCutFrame(ctx, {
    frameWidth: w,
    frameHeight: h,
    frameImage,
    cells,
    capturedImages,
    capturedMirrors: options?.capturedMirrors,
    activeIndex: -1,
    debug: options?.debug,
  });

  return canvas;
}

/** data URL → Image 로드 후 합성 */
export async function composeFrame(
  frameImage: HTMLImageElement,
  cells: FrameCellRect[],
  photoDataUrls: string[],
  options?: ComposeFrameOptions
): Promise<HTMLCanvasElement> {
  const imgs = await Promise.all(
    photoDataUrls.slice(0, 4).map((url) => (url ? loadImage(url) : Promise.resolve(null)))
  );
  return composeFrameFromImages(frameImage, cells, imgs, options);
}

export function captureFromVideo(
  video: HTMLVideoElement,
  mirrorHorizontal: boolean
): string | null {
  if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (mirrorHorizontal) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** @deprecated use captureFromVideo(video, true) */
export function captureFromVideoMirrored(video: HTMLVideoElement): string | null {
  return captureFromVideo(video, true);
}

/** 칸 비율에 맞춘 ideal 해상도 (가로로 긴 칸일수록 넓게 요청) */
export function getCellVideoConstraints(
  facingMode: "user" | "environment",
  cell?: FrameCellRect
): MediaTrackConstraints {
  const aspect = cell && cell.h > 0 ? cell.w / cell.h : 3 / 4;
  let idealWidth: number;
  let idealHeight: number;
  if (aspect >= 1.25) {
    idealWidth = 1920;
    idealHeight = Math.max(480, Math.round(idealWidth / aspect));
  } else {
    idealHeight = 1280;
    idealWidth = Math.max(480, Math.round(idealHeight * aspect));
  }
  return {
    facingMode: { ideal: facingMode },
    width: { ideal: idealWidth },
    height: { ideal: idealHeight },
  };
}

export async function waitForVideoReady(
  video: HTMLVideoElement,
  timeoutMs = 8000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      return true;
    }
    await new Promise((r) => window.setTimeout(r, 80));
  }
  return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
}

export function buildFourCutFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `daeni-4cut-${y}${mo}${d}-${hh}${mm}${ss}.jpg`;
}

export function cellAspectCss(cell: FrameCellRect): string {
  return `${cell.w} / ${cell.h}`;
}

/** 현재 칸 영역에 맞춰 전체 프레임 PNG를 올릴 때 쓰는 CSS (촬영 메인 박스) */
export function getFrameCellOverlayImageStyle(
  cell: FrameCellRect,
  frameWidth: number,
  frameHeight: number
): { width: string; height: string; left: string; top: string } {
  return {
    width: `${(frameWidth / cell.w) * 100}%`,
    height: `${(frameHeight / cell.h) * 100}%`,
    left: `${(-cell.x / cell.w) * 100}%`,
    top: `${(-cell.y / cell.h) * 100}%`,
  };
}

/** 작은 전체 프레임 미리보기 canvas 크기 (표시 높이 px, 비율 유지) */
export function getStripPreviewCanvasSize(
  frameWidth: number,
  frameHeight: number,
  displayHeightPx = 200,
  dpr = 1
) {
  const h = displayHeightPx * dpr;
  const w = (frameWidth / frameHeight) * h;
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}

export function paintStripToCanvas(
  canvas: HTMLCanvasElement,
  layout: {
    frameWidth: number;
    frameHeight: number;
    frameImage: HTMLImageElement;
    cells: FrameCellRect[];
  },
  capturedImages: (HTMLImageElement | null)[],
  activeIndex: number,
  displayHeightPx: number,
  debug?: boolean,
  capturedMirrors?: (boolean | null)[]
) {
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  const { width, height } = getStripPreviewCanvasSize(
    layout.frameWidth,
    layout.frameHeight,
    displayHeightPx,
    dpr
  );
  canvas.width = width;
  canvas.height = height;
  paintFrameStripPreview(canvas, {
    frameWidth: layout.frameWidth,
    frameHeight: layout.frameHeight,
    frameImage: layout.frameImage,
    cells: layout.cells,
    capturedImages,
    capturedMirrors,
    activeIndex,
    debug,
  });
}

export function paintFrameStripPreview(
  canvas: HTMLCanvasElement,
  input: Omit<PaintFourCutInput, "liveVideo" | "countdown" | "nowMs"> & {
    activeIndex: number;
  }
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const sx = canvas.width / input.frameWidth;
  const sy = canvas.height / input.frameHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(sx, sy);
  paintFourCutFrame(ctx, {
    ...input,
    liveVideo: null,
    countdown: null,
    nowMs: 0,
    reduceMotion: true,
  });
}
