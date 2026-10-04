"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlipHorizontal2, RotateCcw, SwitchCamera } from "lucide-react";
import QRCode from "qrcode";
import {
  allocateNextBoothSequence,
  buildBoothCompositeFileName,
  buildBoothOriginalFileName,
  formatBoothSequenceLabel,
  isPhotoBoothMode,
  listFramesForMode,
  readBoothKey,
  readBoothSequence,
  resetBoothSequence,
  resolveInitialFrame,
  writeBoothKey,
} from "@/lib/photo-booth";
import {
  BOOTH_KEY_HEADER,
  BOOTH_NETWORK_ERROR_MESSAGE,
  boothDateKey,
  boothPhotoPagePath,
  boothUploadErrorMessage,
  encodeBoothKeyHeader,
  formatBoothDateLabel,
} from "@/lib/booth-share";
import {
  buildFourCutFileName,
  captureFromVideo,
  clearFrameLayoutCache,
  getCellVideoConstraints,
  clientPointToFrameCoords,
  composeFrameFromImages,
  findCellIndexAtPoint,
  getFrameCellOverlayImageStyle,
  loadFrameLayout,
  loadImage,
  paintStripToCanvas,
  renderFrameCellDebugPreview,
  waitForVideoReady,
  type CellStandHint,
  type FrameCellRect,
  type OverlayFrameDef,
} from "@/lib/photo-four-cut";

type Step = "frame" | "capture" | "result";

/** public/frames PNG 교체 시 rev만 올리면 썸네일·칸 감지 캐시가 갱신됩니다 */
const FRAME_PNG_REV = 3;

function frameAssetSrc(path: string) {
  return `${path}?v=${FRAME_PNG_REV}`;
}

const OVERLAY_FRAMES: OverlayFrameDef[] = [
  {
    id: "daein",
    label: "팀코리아 김다인",
    desc: "2026 아시안게임",
    src: frameAssetSrc("/frames/daein.png"),
  },
  {
    id: "daein-2",
    label: "팀코리아 김다인2",
    desc: "2026 아시안게임",
    src: frameAssetSrc("/frames/daein-2.png"),
  },
  {
    id: "hillstate-national",
    label: "팀코리아 현대건설",
    desc: "2026 아시안게임",
    src: frameAssetSrc("/frames/hillstate-national.png"),
  },
  {
    id: "baeyuna",
    label: "배유나 선수 커피차 기념",
    src: frameAssetSrc("/frames/baeyuna.png"),
    boothOnly: true,
  },
];

const DEFAULT_FRAME = resolveInitialFrame(OVERLAY_FRAMES, false);

type FrameLayout = {
  cells: FrameCellRect[];
  width: number;
  height: number;
  frameImage: HTMLImageElement;
  standHints: CellStandHint[];
};

const EMPTY_SLOTS: (string | null)[] = [null, null, null, null];

const COUNTDOWN_SECOND_OPTIONS = [3, 6, 9] as const;
type CountdownSeconds = (typeof COUNTDOWN_SECOND_OPTIONS)[number];

const BOOTH_COUNTDOWN_SECOND_OPTIONS = [3, 5, 10] as const;
type BoothCountdownSeconds = (typeof BOOTH_COUNTDOWN_SECOND_OPTIONS)[number];

const BOOTH_SHARE_UNSUPPORTED =
  "이 브라우저는 공유를 지원하지 않아요. 사파리로 열어주세요";

const BOOTH_UPLOAD_MAX_WIDTH = 1200;
/** Vercel 함수 요청 본문 한도(4.5MB)보다 여유 있게 */
const BOOTH_UPLOAD_TARGET_BYTES = 3.5 * 1024 * 1024;
const BOOTH_UPLOAD_QUALITIES = [0.85, 0.75, 0.65] as const;

type BoothQrState =
  | { status: "idle" }
  | { status: "no-key" }
  | { status: "uploading" }
  | { status: "ready"; qrDataUrl: string }
  | { status: "error"; message: string };

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
}

/** 다운로드 저장본과 별개로, 업로드용은 줄이고 용량이 크면 품질을 낮춰 다시 인코딩 */
async function buildBoothUploadBlob(source: HTMLCanvasElement): Promise<Blob | null> {
  let canvas = source;
  if (source.width > BOOTH_UPLOAD_MAX_WIDTH) {
    const scaled = document.createElement("canvas");
    scaled.width = BOOTH_UPLOAD_MAX_WIDTH;
    scaled.height = Math.round((source.height * BOOTH_UPLOAD_MAX_WIDTH) / source.width);
    const ctx = scaled.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, scaled.width, scaled.height);
      canvas = scaled;
    }
  }
  let blob: Blob | null = null;
  for (const quality of BOOTH_UPLOAD_QUALITIES) {
    blob = await canvasToJpeg(canvas, quality);
    if (!blob) return null;
    console.log(
      `[photo] booth upload jpeg ${canvas.width}x${canvas.height} q=${quality} → ${(blob.size / 1024).toFixed(0)}KB`
    );
    if (blob.size <= BOOTH_UPLOAD_TARGET_BYTES) break;
  }
  return blob;
}

const FACING_MODE_STORAGE_KEY = "voto-photo-facing-mode";

function readStoredFacingMode(): "user" | "environment" {
  try {
    const v = sessionStorage.getItem(FACING_MODE_STORAGE_KEY);
    return v === "environment" ? "environment" : "user";
  } catch {
    return "user";
  }
}

function defaultMirrorForFacing(facing: "user" | "environment") {
  return facing === "user";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

const DESKTOP_CAPTURE_MIN = 1024;
const DESKTOP_CAPTURE_GAP = 40;

function fitDesktopCaptureLayout(
  bodyWidth: number,
  bodyHeight: number,
  cellAspect: number,
  frameAspect: number,
  gap = DESKTOP_CAPTURE_GAP
) {
  if (bodyWidth <= gap || bodyHeight <= 0) return null;
  const h = Math.min(bodyHeight, (bodyWidth - gap) / (cellAspect + frameAspect));
  if (h <= 0) return null;
  return {
    cellW: h * cellAspect,
    cellH: h,
    stripH: h,
    stripW: h * frameAspect,
  };
}

function isStreamLive(stream: MediaStream | null): boolean {
  if (!stream) return false;
  const tracks = stream.getVideoTracks();
  return tracks.length > 0 && tracks.every((t) => t.readyState === "live");
}

function playShutter() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    window.setTimeout(() => void ctx.close(), 200);
  } catch {
    /* ignore */
  }
}

export default function PhotoPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stripCanvasMiniRef = useRef<HTMLCanvasElement>(null);
  const stripCanvasRef = useRef<HTMLCanvasElement>(null);
  const stripCanvasExpandedRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const mountedRef = useRef(true);
  const sequenceRunningRef = useRef(false);
  /** 값이 바뀌면 진행 중인 촬영 시퀀스는 다음 확인 지점에서 중단 */
  const captureRunIdRef = useRef(0);
  const layoutRef = useRef<FrameLayout | null>(null);
  const capturedImagesRef = useRef<(HTMLImageElement | null)[]>([null, null, null, null]);
  const capturedMirrorsRef = useRef<(boolean | null)[]>([null, null, null, null]);
  const shotIndexRef = useRef(0);
  const countdownRef = useRef<number | null>(null);
  const countdownSecondsRef = useRef<CountdownSeconds>(3);
  const debugModeRef = useRef(false);
  const photoSlotsRef = useRef<(string | null)[]>([...EMPTY_SLOTS]);
  const facingModeRef = useRef<"user" | "environment">("user");
  const mirrorHorizontalRef = useRef(true);
  const stepRef = useRef<Step>("frame");
  const framePickerRef = useRef<HTMLDivElement>(null);
  const startCameraRef = useRef<(options?: { forceNew?: boolean; isAutoRetry?: boolean }) => Promise<void>>(
    async () => undefined
  );
  const facingModeOnCaptureInitializedRef = useRef(false);
  const startCameraInFlightRef = useRef<Promise<void> | null>(null);
  const cameraSwitchPendingRef = useRef(false);
  const boothModeRef = useRef(false);
  const frameDefRef = useRef(DEFAULT_FRAME);
  const boothCountdownSecondsRef = useRef<BoothCountdownSeconds>(3);
  const boothSaveOriginalsRef = useRef(false);
  const resultShareFileRef = useRef<File | null>(null);
  const boothQrRunRef = useRef(0);
  const boothUploadBlobRef = useRef<Blob | null>(null);

  const [debugMode, setDebugMode] = useState(false);
  const [boothKey, setBoothKey] = useState(() =>
    typeof window !== "undefined" ? readBoothKey() : ""
  );
  const boothKeyRef = useRef(boothKey);
  const [boothQr, setBoothQr] = useState<BoothQrState>({ status: "idle" });
  const [boothClearConfirmOpen, setBoothClearConfirmOpen] = useState(false);
  const [boothClearing, setBoothClearing] = useState(false);
  const [boothClearMessage, setBoothClearMessage] = useState<string | null>(null);
  const [boothMode, setBoothMode] = useState(false);
  const [boothSettingsOpen, setBoothSettingsOpen] = useState(false);
  const [boothCountdownSeconds, setBoothCountdownSeconds] = useState<BoothCountdownSeconds>(3);
  const [boothSaveOriginals, setBoothSaveOriginals] = useState(false);
  const [boothSavedSeqLabel, setBoothSavedSeqLabel] = useState<string | null>(null);
  const [boothShareHint, setBoothShareHint] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(() =>
    typeof window !== "undefined" ? readStoredFacingMode() : "user"
  );
  const [mirrorHorizontal, setMirrorHorizontal] = useState(() =>
    typeof window !== "undefined" ? defaultMirrorForFacing(readStoredFacingMode()) : true
  );
  const [multipleVideoInputs, setMultipleVideoInputs] = useState(false);
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [stripExpanded, setStripExpanded] = useState(false);
  const [step, setStep] = useState<Step>("frame");
  const [frameDef, setFrameDef] = useState<OverlayFrameDef>(DEFAULT_FRAME);
  const [layout, setLayout] = useState<FrameLayout | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [cellsInvalid, setCellsInvalid] = useState(false);
  const [photoSlots, setPhotoSlots] = useState<(string | null)[]>([...EMPTY_SLOTS]);
  const [shotIndex, setShotIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<CountdownSeconds>(3);
  const [flash, setFlash] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRetryable, setCameraRetryable] = useState(false);
  const [needsPlayGesture, setNeedsPlayGesture] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [debugPreviewUrl, setDebugPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [desktopMetrics, setDesktopMetrics] = useState<{
    cellW: number;
    cellH: number;
    stripH: number;
    stripW: number;
  } | null>(null);

  const captureBodyRef = useRef<HTMLDivElement>(null);

  layoutRef.current = layout;
  photoSlotsRef.current = photoSlots;
  shotIndexRef.current = shotIndex;
  countdownRef.current = countdown;
  countdownSecondsRef.current = countdownSeconds;
  debugModeRef.current = debugMode;
  facingModeRef.current = facingMode;
  mirrorHorizontalRef.current = mirrorHorizontal;
  stepRef.current = step;
  boothModeRef.current = boothMode;
  frameDefRef.current = frameDef;
  boothCountdownSecondsRef.current = boothCountdownSeconds;
  boothSaveOriginalsRef.current = boothSaveOriginals;

  useEffect(() => {
    try {
      sessionStorage.setItem(FACING_MODE_STORAGE_KEY, facingMode);
    } catch {
      /* ignore */
    }
  }, [facingMode]);

  useEffect(() => {
    setMirrorHorizontal(defaultMirrorForFacing(facingMode));
  }, [facingMode]);

  const refreshVideoInputCount = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMultipleVideoInputs(false);
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const count = devices.filter((d) => d.kind === "videoinput").length;
      setMultipleVideoInputs(count >= 2);
    } catch {
      setMultipleVideoInputs(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get("debug") === "1";
    setDebugMode(debug);
    debugModeRef.current = debug;

    const booth = isPhotoBoothMode(params);
    setBoothMode(booth);
    boothModeRef.current = booth;

    setFrameDef(resolveInitialFrame(OVERLAY_FRAMES, booth, params.get("frame")?.trim()));
  }, []);

  useEffect(() => {
    if (!boothSavedSeqLabel) return;
    const t = window.setTimeout(() => setBoothSavedSeqLabel(null), 2000);
    return () => window.clearTimeout(t);
  }, [boothSavedSeqLabel]);

  const resetCapturedImages = useCallback(() => {
    capturedImagesRef.current = [null, null, null, null];
    capturedMirrorsRef.current = [null, null, null, null];
    setPhotoSlots([...EMPTY_SLOTS]);
    photoSlotsRef.current = [...EMPTY_SLOTS];
  }, []);

  const loadLayoutForFrame = useCallback(async (def: OverlayFrameDef) => {
    setLayoutLoading(true);
    setCellsInvalid(false);
    setDebugPreviewUrl(null);
    clearFrameLayoutCache(def.src);
    try {
      const loaded = await loadFrameLayout(def.src);
      const next: FrameLayout = {
        cells: loaded.cells,
        width: loaded.width,
        height: loaded.height,
        frameImage: loaded.frameImage,
        standHints: loaded.standHints,
      };
      if (loaded.cells.length < 4) {
        setCellsInvalid(true);
      }
      setLayout(next);
      if (
        new URLSearchParams(window.location.search).get("debug") === "1" &&
        loaded.cells.length >= 1
      ) {
        setDebugPreviewUrl(renderFrameCellDebugPreview(loaded.frameImage, loaded.cells));
      }
    } catch (e) {
      console.warn("[photo] frame layout load failed", e);
      setCellsInvalid(true);
      setLayout(null);
    } finally {
      setLayoutLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLayoutForFrame(frameDef);
  }, [frameDef, loadLayoutForFrame]);

  /** 모바일 가로 스크롤 피커는 목록 앞에 프레임이 끼어들어도 기존 카드에 스냅이 남아 있어서 선택 카드로 맞춰 줌 */
  useEffect(() => {
    if (step !== "frame") return;
    const picker = framePickerRef.current;
    const card = picker?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!picker || !card) return;
    const pickerRect = picker.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    picker.scrollLeft +=
      cardRect.left + cardRect.width / 2 - (pickerRect.left + pickerRect.width / 2);
  }, [step, boothMode, frameDef.id]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setNeedsPlayGesture(false);
  }, []);

  const tryPlayVideo = useCallback(async (video: HTMLVideoElement) => {
    try {
      await video.play();
      setNeedsPlayGesture(false);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") {
        return;
      }
      if (name === "NotAllowedError") {
        setNeedsPlayGesture(true);
        return;
      }
      if (process.env.NODE_ENV === "development") {
        console.warn("[photo] video.play() failed", name, err);
      }
    }
  }, []);

  const attachStreamToVideo = useCallback(
    async (stream: MediaStream) => {
      const video = videoRef.current;
      if (!video) return;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      await tryPlayVideo(video);
    },
    [tryPlayVideo]
  );

  const handleResumeCameraPlay = useCallback(() => {
    const video = videoRef.current;
    if (video) void tryPlayVideo(video);
  }, [tryPlayVideo]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = useCallback(
    (options?: { forceNew?: boolean; isAutoRetry?: boolean }) => {
      if (startCameraInFlightRef.current) {
        return startCameraInFlightRef.current;
      }

      const run = (async () => {
        if (!mountedRef.current) return;

        setCameraError(null);
        setCameraRetryable(false);

        const cell = layoutRef.current?.cells[Math.min(shotIndexRef.current, 3)];

        if (!options?.forceNew && isStreamLive(streamRef.current)) {
          await attachStreamToVideo(streamRef.current!);
          return;
        }

        stopCamera();

        let stream: MediaStream;
        try {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: getCellVideoConstraints(facingModeRef.current, cell),
              audio: false,
            });
          } catch (inner) {
            const innerName = inner instanceof Error ? inner.name : "";
            if (innerName === "NotFoundError" || innerName === "OverconstrainedError") {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } else {
              throw inner;
            }
          }
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "[photo] getUserMedia failed",
              err instanceof Error ? err.name : err,
              err instanceof Error ? err.message : err
            );
          }

          const name = err instanceof Error ? err.name : "UnknownError";

          if (name === "NotReadableError" && !options?.isAutoRetry) {
            stopCamera();
            await sleep(500);
            if (mountedRef.current) {
              startCameraInFlightRef.current = null;
              await startCamera({ forceNew: true, isAutoRetry: true });
            }
            return;
          }

          if (name === "NotAllowedError" || name === "SecurityError") {
            setCameraError("카메라 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요");
            setCameraRetryable(false);
          } else if (name === "NotReadableError" || name === "AbortError") {
            setCameraError("카메라를 다른 곳에서 쓰고 있어요");
            setCameraRetryable(true);
          } else {
            setCameraError(`카메라를 시작하지 못했어요 (${name})`);
            setCameraRetryable(false);
          }
          return;
        }

        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        await attachStreamToVideo(stream);
        await refreshVideoInputCount();
      })();

      startCameraInFlightRef.current = run;
      void run.finally(() => {
        if (startCameraInFlightRef.current === run) {
          startCameraInFlightRef.current = null;
        }
        if (cameraSwitchPendingRef.current) {
          cameraSwitchPendingRef.current = false;
          setCameraSwitching(false);
        }
      });
      return run;
    },
    [attachStreamToVideo, stopCamera, refreshVideoInputCount]
  );

  startCameraRef.current = startCamera;

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /** 새 촬영·다음 사람으로 넘어가면 runId 가 바뀌어 늦게 끝난 업로드 결과는 버림 */
  const uploadBoothPhoto = useCallback(async (blob: Blob) => {
    const runId = ++boothQrRunRef.current;
    boothUploadBlobRef.current = blob;
    const key = boothKeyRef.current.trim();
    if (!key) {
      setBoothQr({ status: "no-key" });
      return;
    }
    setBoothQr({ status: "uploading" });
    let res: Response;
    try {
      res = await fetch("/api/booth/upload", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
          [BOOTH_KEY_HEADER]: encodeBoothKeyHeader(key),
        },
        body: blob,
      });
    } catch (err) {
      if (runId !== boothQrRunRef.current) return;
      console.error("[photo] booth upload request failed", err);
      setBoothQr({ status: "error", message: BOOTH_NETWORK_ERROR_MESSAGE });
      return;
    }
    const bodyText = await res.text().catch(() => "");
    if (runId !== boothQrRunRef.current) return;
    let body: { id?: string; date?: string; error?: string } = {};
    try {
      body = JSON.parse(bodyText) as typeof body;
    } catch {
      /* HTML 오류 페이지 등 */
    }
    if (!res.ok || !body.id || !body.date) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[photo] booth upload failed: ${res.status}`, bodyText);
      }
      setBoothQr({
        status: "error",
        message: res.ok
          ? `업로드 응답이 이상해요 (${res.status})`
          : boothUploadErrorMessage(res.status, body.error),
      });
      return;
    }
    try {
      const pageUrl = `${window.location.origin}${boothPhotoPagePath(body.date, body.id)}`;
      const qrDataUrl = await QRCode.toDataURL(pageUrl, {
        width: 640,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      if (runId !== boothQrRunRef.current) return;
      setBoothQr({ status: "ready", qrDataUrl });
    } catch (err) {
      if (runId !== boothQrRunRef.current) return;
      console.error("[photo] booth QR render failed", err);
      setBoothQr({ status: "error", message: "QR을 만들지 못했어요" });
    }
  }, []);

  const runBoothAutoSave = useCallback(
    async (canvas: HTMLCanvasElement) => {
      const frameId = frameDefRef.current.id;
      const seq = allocateNextBoothSequence();
      const fileName = buildBoothCompositeFileName(frameId, seq);
      const blob = await canvasToJpeg(canvas, 0.92);
      if (blob) {
        downloadBlob(blob, fileName);
        resultShareFileRef.current = new File([blob], fileName, { type: "image/jpeg" });
      }
      void buildBoothUploadBlob(canvas).then((uploadBlob) => {
        if (uploadBlob) void uploadBoothPhoto(uploadBlob);
        else setBoothQr({ status: "error", message: "업로드용 사진을 만들지 못했어요" });
      });
      if (boothSaveOriginalsRef.current) {
        const slots = photoSlotsRef.current;
        for (let i = 0; i < 4; i++) {
          const url = slots[i];
          if (!url) continue;
          try {
            const res = await fetch(url);
            const originalBlob = await res.blob();
            downloadBlob(originalBlob, buildBoothOriginalFileName(frameId, seq, i));
          } catch {
            /* ignore single slot */
          }
        }
      }
      setBoothSavedSeqLabel(formatBoothSequenceLabel(seq));
    },
    [downloadBlob, uploadBoothPhoto]
  );

  const finishIfComplete = useCallback(() => {
    const L = layoutRef.current;
    if (!L) return;
    const imgs = capturedImagesRef.current;
    if (imgs.some((img) => !img)) return;

    const canvas = composeFrameFromImages(L.frameImage, L.cells, imgs, {
      debug: debugModeRef.current,
      capturedMirrors: [...capturedMirrorsRef.current],
    });
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.92));
    setBoothShareHint(null);

    if (boothModeRef.current) {
      boothQrRunRef.current += 1;
      setBoothQr({ status: "idle" });
      void runBoothAutoSave(canvas);
    } else {
      stopCamera();
    }
    setStep("result");
  }, [stopCamera, runBoothAutoSave]);

  const captureAtIndex = useCallback(
    async (index: number, runId: number) => {
      const cancelled = () => !mountedRef.current || captureRunIdRef.current !== runId;
      if (!videoRef.current || !layoutRef.current) return false;
      const video = videoRef.current;
      const ready = await waitForVideoReady(video);
      if (cancelled()) return false;
      if (!ready) {
        setCameraError("카메라가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
        return false;
      }

      setShotIndex(index);
      shotIndexRef.current = index;

      const seconds = boothModeRef.current
        ? boothCountdownSecondsRef.current
        : countdownSecondsRef.current;
      for (let c = seconds; c >= 1; c--) {
        if (cancelled()) return false;
        setCountdown(c);
        countdownRef.current = c;
        await sleep(1000);
      }
      if (cancelled()) return false;
      setCountdown(null);
      countdownRef.current = null;

      if (!videoRef.current) return false;

      playShutter();
      setFlash(true);
      window.setTimeout(() => setFlash(false), 120);

      const mirrorAtCapture = mirrorHorizontalRef.current;
      const dataUrl = captureFromVideo(videoRef.current, false);
      if (!dataUrl) {
        console.warn("[photo] capture skipped: video not ready");
        return false;
      }

      const img = await loadImage(dataUrl);
      if (cancelled()) return false;
      capturedImagesRef.current[index] = img;
      capturedMirrorsRef.current[index] = mirrorAtCapture;
      setPhotoSlots((prev) => {
        const next = [...prev];
        next[index] = dataUrl;
        photoSlotsRef.current = next;
        return next;
      });
      if (index < 3) {
        setShotIndex(index + 1);
        shotIndexRef.current = index + 1;
      }
      return true;
    },
    []
  );

  const runCaptureSequence = useCallback(
    async (onlyIndex?: number) => {
      if (sequenceRunningRef.current || !videoRef.current) return;
      const L = layoutRef.current;
      if (!L || L.cells.length !== 4) return;

      const runId = ++captureRunIdRef.current;
      const cancelled = () => !mountedRef.current || captureRunIdRef.current !== runId;
      sequenceRunningRef.current = true;
      setCapturing(true);
      try {
        if (cancelled()) return;

        const indices =
          onlyIndex !== undefined
            ? [onlyIndex]
            : [0, 1, 2, 3].filter((i) => !capturedImagesRef.current[i]);

        for (const i of indices) {
          if (cancelled()) break;
          const ok = await captureAtIndex(i, runId);
          if (!ok) break;
          if (indices.length > 1 && i !== indices[indices.length - 1]) {
            await sleep(2000);
          }
        }

        if (!cancelled() && capturedImagesRef.current.every(Boolean)) {
          finishIfComplete();
        }
      } finally {
        if (captureRunIdRef.current === runId) {
          setCapturing(false);
          sequenceRunningRef.current = false;
        }
      }
    },
    [captureAtIndex, finishIfComplete]
  );

  useEffect(() => {
    if (step === "result") {
      if (!boothModeRef.current) {
        stopCamera();
      }
      return;
    }
    const wantsCamera =
      step === "capture" || (boothModeRef.current && step === "frame");
    if (!wantsCamera) {
      return;
    }
    if (cellsInvalid || layoutLoading) return;
    if (!layoutRef.current || layoutRef.current.cells.length !== 4) return;
    void startCamera();
  }, [step, boothMode, startCamera, stopCamera, cellsInvalid, layoutLoading]);

  useEffect(() => {
    if (step !== "capture") {
      facingModeOnCaptureInitializedRef.current = false;
      return;
    }
    if (!facingModeOnCaptureInitializedRef.current) {
      facingModeOnCaptureInitializedRef.current = true;
      return;
    }
    stopCamera();
    void startCamera({ forceNew: true });
  }, [facingMode, step, startCamera, stopCamera]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopCamera();
        return;
      }
      if (document.visibilityState === "visible" && stepRef.current === "capture") {
        void startCameraRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stopCamera]);

  useEffect(() => {
    const wantsWakeLock = boothMode || step === "capture";
    if (!wantsWakeLock) {
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (!("wakeLock" in navigator)) return;
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        wakeLockRef.current = lock;
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, [step, boothMode]);

  useEffect(() => {
    if (step !== "capture") {
      document.body.style.overflow = "";
      return;
    }
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.body.style.overflow = "";
    };
  }, [step]);

  useEffect(() => {
    if (boothMode) return;
    if (step !== "capture" || cameraError || cellsInvalid || layoutLoading) return;
    if (!layout || layout.cells.length !== 4) return;
    if (photoSlots.some(Boolean)) return;
    const t = window.setTimeout(() => void runCaptureSequence(), 800);
    return () => window.clearTimeout(t);
  }, [
    boothMode,
    step,
    cameraError,
    cellsInvalid,
    layoutLoading,
    layout,
    photoSlots,
    runCaptureSequence,
  ]);

  const paintStripCanvases = useCallback(() => {
    if (!layout) return;
    const payload = {
      frameWidth: layout.width,
      frameHeight: layout.height,
      frameImage: layout.frameImage,
      cells: layout.cells,
    };
    const imgs = capturedImagesRef.current;
    const mirrors = capturedMirrorsRef.current;
    if (stripCanvasMiniRef.current) {
      paintStripToCanvas(stripCanvasMiniRef.current, payload, imgs, shotIndex, 110, debugMode, mirrors);
    }
    if (stripCanvasRef.current) {
      const stripH = desktopMetrics?.stripH ?? 200;
      paintStripToCanvas(stripCanvasRef.current, payload, imgs, shotIndex, stripH, debugMode, mirrors);
    }
    if (stripCanvasExpandedRef.current) {
      paintStripToCanvas(
        stripCanvasExpandedRef.current,
        payload,
        imgs,
        shotIndex,
        320,
        debugMode,
        mirrors
      );
    }
  }, [layout, shotIndex, debugMode, photoSlots, desktopMetrics?.stripH]);

  useEffect(() => {
    if (step !== "capture" || !layout || cellsInvalid) return;
    paintStripCanvases();
  }, [step, layout, cellsInvalid, paintStripCanvases, stripExpanded, desktopMetrics?.stripH]);

  useEffect(() => {
    if (step !== "capture" || !layout || layout.cells.length !== 4) {
      setDesktopMetrics(null);
      return;
    }
    const cell = layout.cells[Math.min(shotIndex, 3)];
    if (!cell) return;

    const el = captureBodyRef.current;
    if (!el) return;

    const mq = window.matchMedia(`(min-width: ${DESKTOP_CAPTURE_MIN}px)`);

    const compute = () => {
      if (!mq.matches) {
        setDesktopMetrics(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const next = fitDesktopCaptureLayout(
        rect.width,
        rect.height,
        cell.w / cell.h,
        layout.width / layout.height
      );
      setDesktopMetrics(next);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    mq.addEventListener("change", compute);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", compute);
      window.removeEventListener("resize", compute);
    };
  }, [step, layout, shotIndex]);

  const handleSelectFrame = (def: OverlayFrameDef) => {
    setFrameDef(def);
    resetCapturedImages();
    setPreviewUrl(null);
    setShotIndex(0);
    shotIndexRef.current = 0;
    setStripExpanded(false);
    sequenceRunningRef.current = false;
    setStep("capture");
  };

  const handleRetake = () => {
    resetCapturedImages();
    setPreviewUrl(null);
    setShotIndex(0);
    shotIndexRef.current = 0;
    setStripExpanded(false);
    sequenceRunningRef.current = false;
    setStep("capture");
  };

  const handleBackToFrameSelect = () => {
    resetCapturedImages();
    setPreviewUrl(null);
    setShotIndex(0);
    shotIndexRef.current = 0;
    setStripExpanded(false);
    sequenceRunningRef.current = false;
    setStep("frame");
  };

  const resetBoothResult = (nextStep: Step) => {
    resetCapturedImages();
    setPreviewUrl(null);
    resultShareFileRef.current = null;
    setBoothShareHint(null);
    boothQrRunRef.current += 1;
    boothUploadBlobRef.current = null;
    setBoothQr({ status: "idle" });
    setShotIndex(0);
    shotIndexRef.current = 0;
    setStripExpanded(false);
    sequenceRunningRef.current = false;
    setStep(nextStep);
  };

  const handleBoothNextPerson = () => resetBoothResult("capture");
  const handleBoothChooseFrame = () => resetBoothResult("frame");

  const handleBoothResetSequence = () => {
    resetBoothSequence();
    setBoothSettingsOpen(false);
  };

  const handleBoothKeyChange = (value: string) => {
    setBoothKey(value);
    boothKeyRef.current = value;
    writeBoothKey(value.trim());
  };

  const handleBoothQrRetry = () => {
    const blob = boothUploadBlobRef.current;
    if (blob) void uploadBoothPhoto(blob);
  };

  const handleBoothClearToday = async () => {
    const key = boothKey.trim();
    if (!key) {
      setBoothClearMessage("행사 키를 먼저 입력해 주세요");
      setBoothClearConfirmOpen(false);
      return;
    }
    setBoothClearing(true);
    try {
      const res = await fetch("/api/booth/clear", {
        method: "POST",
        headers: { [BOOTH_KEY_HEADER]: encodeBoothKeyHeader(key) },
      });
      const body = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string };
      if (res.ok) {
        setBoothClearMessage(`오늘 사진 ${body.deleted ?? 0}장을 삭제했어요`);
      } else {
        if (process.env.NODE_ENV !== "production") {
          console.error(`[photo] booth clear failed: ${res.status}`, body);
        }
        setBoothClearMessage(`삭제하지 못했어요 · ${boothUploadErrorMessage(res.status, body.error)}`);
      }
    } catch (err) {
      console.error("[photo] booth clear request failed", err);
      setBoothClearMessage(`삭제하지 못했어요 · ${BOOTH_NETWORK_ERROR_MESSAGE}`);
    } finally {
      setBoothClearing(false);
      setBoothClearConfirmOpen(false);
    }
  };

  const canShareResultFile = useCallback(() => {
    const file = resultShareFileRef.current;
    if (!file || !navigator.share) return false;
    try {
      return navigator.canShare?.({ files: [file] }) ?? false;
    } catch {
      return false;
    }
  }, []);

  const handleBoothShare = async () => {
    const file = resultShareFileRef.current;
    if (!file) return;
    if (!canShareResultFile()) {
      setBoothShareHint(BOOTH_SHARE_UNSUPPORTED);
      return;
    }
    setBoothShareHint(null);
    try {
      await navigator.share({
        title: "다인네컷",
        files: [file],
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
    }
  };

  const countdownPickerDisabled =
    capturing || countdown !== null || sequenceRunningRef.current;

  const countdownPicker = (
    <div className="photo-page__countdownPick">
      <p className="photo-page__sub text-center text-xs">촬영 전 카운트다운</p>
      <div
        className="photo-page__countdownPickRow"
        role="radiogroup"
        aria-label="카운트다운 시간"
      >
        {COUNTDOWN_SECOND_OPTIONS.map((sec) => (
          <button
            key={sec}
            type="button"
            role="radio"
            aria-checked={countdownSeconds === sec}
            disabled={countdownPickerDisabled}
            onClick={() => setCountdownSeconds(sec)}
            className={`photo-page__countdownOption${
              countdownSeconds === sec ? " photo-page__countdownOption--active" : ""
            }`}
          >
            {sec}초
          </button>
        ))}
      </div>
    </div>
  );

  const handleStripCanvasPointer = (
    event: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
    closeExpanded = false
  ) => {
    event.stopPropagation();
    if (capturing || sequenceRunningRef.current || !layout) return;
    const pt = clientPointToFrameCoords(
      event.clientX,
      event.clientY,
      canvas,
      layout.width,
      layout.height
    );
    if (!pt) return;
    const idx = findCellIndexAtPoint(pt.x, pt.y, layout.cells);
    if (idx < 0 || !capturedImagesRef.current[idx]) return;
    if (closeExpanded) setStripExpanded(false);
    capturedImagesRef.current[idx] = null;
    capturedMirrorsRef.current[idx] = null;
    setPhotoSlots((prev) => {
      const next = [...prev];
      next[idx] = null;
      photoSlotsRef.current = next;
      return next;
    });
    setShotIndex(idx);
    shotIndexRef.current = idx;
    void runCaptureSequence(idx);
  };

  /** 촬영 중 중단 → 전부 비우고 1번 칸부터 (일반 모드는 자동 시작 effect 가 다시 돌리고, 행사 모드는 촬영 시작 대기) */
  const handleRestartCapture = () => {
    captureRunIdRef.current += 1;
    sequenceRunningRef.current = false;
    setCapturing(false);
    setCountdown(null);
    countdownRef.current = null;
    setFlash(false);
    resetCapturedImages();
    setShotIndex(0);
    shotIndexRef.current = 0;
    setStripExpanded(false);
  };

  const exitCaptureToFrame = () => {
    setStripExpanded(false);
    setCameraError(null);
    setCameraRetryable(false);
    setStep("frame");
  };

  const cameraControlsDisabled = countdown !== null;

  const switchCamera = useCallback(() => {
    if (cameraControlsDisabled || cameraSwitching) return;
    cameraSwitchPendingRef.current = true;
    setCameraSwitching(true);
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, [cameraControlsDisabled, cameraSwitching]);

  const toggleMirrorHorizontal = useCallback(() => {
    if (cameraControlsDisabled) return;
    setMirrorHorizontal((prev) => !prev);
  }, [cameraControlsDisabled]);

  const captureBlocked = cellsInvalid || layoutLoading || !layout || layout.cells.length !== 4;
  const filledCount = photoSlots.filter(Boolean).length;
  const currentCell = layout?.cells[Math.min(shotIndex, 3)];
  const frameOverlayStyle =
    currentCell && layout
      ? getFrameCellOverlayImageStyle(currentCell, layout.width, layout.height)
      : null;
  const mirrorPreview = mirrorHorizontal;
  const shotLabel = `${Math.min(shotIndex, 3) + 1} / 4`;
  const activeShotIndex = Math.min(shotIndex, 3);
  const standHint = layout?.standHints[activeShotIndex] ?? null;
  const showStandGuide = countdown === null && Boolean(standHint?.message);

  const cellBox = currentCell ? (
    <div
      className="photo-page__mediaCard w-full lg:w-auto lg:shrink-0"
      style={
        desktopMetrics
          ? { width: desktopMetrics.cellW, height: desktopMetrics.cellH }
          : undefined
      }
    >
      <div
        className="photo-page__mediaCardInner h-full w-full"
        style={
          desktopMetrics
            ? undefined
            : { aspectRatio: `${currentCell.w} / ${currentCell.h}` }
        }
      >
      <span className="photo-page__shotPill hidden lg:inline-flex">
        {Math.min(shotIndex, 3) + 1}{" "}
        <span className="photo-page__shotPillSlash">/ 4</span>
      </span>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover ${mirrorPreview ? "scale-x-[-1]" : ""}`}
      />
      {needsPlayGesture ? (
        <button
          type="button"
          onClick={handleResumeCameraPlay}
          className="absolute inset-0 z-[25] flex items-center justify-center bg-black/50 px-4 text-center text-sm font-semibold text-white"
        >
          화면을 눌러 카메라 켜기
        </button>
      ) : null}
      {frameOverlayStyle ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frameDef.src}
          alt=""
          className="pointer-events-none absolute z-[18] max-w-none select-none"
          style={frameOverlayStyle}
        />
      ) : null}
      {cameraSwitching ? (
        <div
          className="absolute inset-0 z-[15] flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
          aria-live="polite"
        >
          <span className="text-sm font-medium text-white">카메라 전환 중…</span>
        </div>
      ) : null}
      {multipleVideoInputs ? (
        <div className="absolute bottom-2 left-2 z-20 flex flex-col items-center gap-0.5 lg:bottom-3 lg:left-3">
          <button
            type="button"
            onClick={switchCamera}
            disabled={cameraControlsDisabled || cameraSwitching}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm disabled:opacity-40"
            aria-label="카메라 전환"
          >
            <SwitchCamera className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <span className="text-[10px] font-medium leading-none text-white/90 drop-shadow-sm">
            카메라
          </span>
        </div>
      ) : null}
      <div className="absolute bottom-2 right-2 z-20 flex flex-col items-center gap-0.5 lg:bottom-3 lg:right-3">
        <button
          type="button"
          onClick={toggleMirrorHorizontal}
          disabled={cameraControlsDisabled}
          className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm disabled:opacity-40 ${
            mirrorHorizontal
              ? "bg-white text-black"
              : "bg-black/50 text-white"
          }`}
          aria-label="좌우 반전"
          aria-pressed={mirrorHorizontal}
        >
          <FlipHorizontal2 className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
        <span className="text-[10px] font-medium leading-none text-white/90 drop-shadow-sm">
          반전
        </span>
      </div>
      <button
        type="button"
        onClick={() => setStripExpanded(true)}
        className="absolute right-2 top-2 z-20 rounded-lg bg-black/55 p-1 backdrop-blur-sm max-md:block md:hidden"
        aria-label="전체 미리보기 펼치기"
      >
        <canvas
          ref={stripCanvasMiniRef}
          className="pointer-events-none block h-[110px] w-auto"
          style={{ height: 110 }}
        />
      </button>
      {countdown !== null ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
          <span className="text-7xl font-black tabular-nums text-white">{countdown}</span>
        </div>
      ) : null}
      {boothMode && !capturing && filledCount < 4 ? (
        <button
          type="button"
          onClick={() => void runCaptureSequence()}
          disabled={cameraSwitching}
          className="photo-page__btn-primary absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full px-8 py-4 text-lg font-bold shadow-lg disabled:opacity-50"
        >
          {filledCount === 0 ? "촬영 시작" : "이어서 촬영"}
        </button>
      ) : null}
      {capturing ? (
        <button
          type="button"
          onClick={handleRestartCapture}
          className="absolute bottom-2 left-1/2 z-20 flex h-11 -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-4 text-sm font-semibold text-white backdrop-blur-sm lg:bottom-3"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          다시 찍기
        </button>
      ) : null}
      {flash ? (
        <div className="pointer-events-none absolute inset-0 z-30 bg-white/80 animate-pulse" />
      ) : null}
      </div>
    </div>
  ) : null;

  const handleSave = async () => {
    if (!previewUrl) return;
    setSaving(true);
    const fileName = buildFourCutFileName();
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/jpeg" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: "다인네컷",
            text: "다인이와 인생네컷~ 📸 daeni.kr/photo",
            files: [file],
          });
          setSaving(false);
          return;
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            setSaving(false);
            return;
          }
        }
      }
      downloadBlob(blob, fileName);
    } catch {
      alert("저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const boothCountdownPicker = (
    <div className="photo-page__countdownPick">
      <p className="photo-page__sub text-center text-xs">촬영 전 카운트다운</p>
      <div
        className="photo-page__countdownPickRow"
        role="radiogroup"
        aria-label="카운트다운 시간"
      >
        {BOOTH_COUNTDOWN_SECOND_OPTIONS.map((sec) => (
          <button
            key={sec}
            type="button"
            role="radio"
            aria-checked={boothCountdownSeconds === sec}
            disabled={countdownPickerDisabled}
            onClick={() => setBoothCountdownSeconds(sec)}
            className={`photo-page__countdownOption${
              boothCountdownSeconds === sec ? " photo-page__countdownOption--active" : ""
            }`}
          >
            {sec}초
          </button>
        ))}
      </div>
    </div>
  );

  const boothQrBlock =
    boothQr.status === "ready" ? (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-center text-base font-bold text-zinc-900">
          사진 다운로드 QR
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={boothQr.qrDataUrl}
          alt="사진 받기 QR 코드"
          width={300}
          height={300}
          className="h-[300px] w-[300px] max-w-full bg-white [image-rendering:pixelated]"
        />
      </div>
    ) : boothQr.status === "no-key" ? (
      <p className="text-center text-xs text-zinc-500">
        QR 사용 불가 · 설정에서 행사 키 입력
        {boothKey.trim() ? (
          <>
            {" · "}
            <button type="button" onClick={handleBoothQrRetry} className="underline">
              다시 시도
            </button>
          </>
        ) : null}
      </p>
    ) : boothQr.status === "error" ? (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="break-words text-center text-sm font-medium text-zinc-700">{boothQr.message}</p>
        <button
          type="button"
          onClick={handleBoothQrRetry}
          className="photo-page__btn-outline rounded-lg px-5 py-2 text-sm font-semibold"
        >
          다시 시도
        </button>
      </div>
    ) : (
      <div
        className="flex min-h-[332px] items-center justify-center rounded-2xl border border-zinc-200 bg-white p-4"
        role="status"
      >
        <p className="text-sm font-medium text-zinc-500">QR 만드는 중…</p>
      </div>
    );

  const boothSettingsPanel = boothMode ? (
    <>
      <button
        type="button"
        onClick={() => {
          setBoothClearMessage(null);
          setBoothSettingsOpen((o) => !o);
        }}
        className="photo-page__boothGear fixed z-[70] flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/95 text-lg shadow-md backdrop-blur-sm"
        style={{
          top: "max(12px, env(safe-area-inset-top))",
          right: "max(12px, env(safe-area-inset-right))",
        }}
        aria-label="행사 모드 설정"
        aria-expanded={boothSettingsOpen}
      >
        <span className="leading-none text-zinc-800" aria-hidden>
          ⚙
        </span>
      </button>
      {boothSettingsOpen ? (
        <div
          className="photo-page__modalBackdrop fixed inset-0 z-[65]"
          role="presentation"
          onClick={() => setBoothSettingsOpen(false)}
        />
      ) : null}
      {boothSettingsOpen ? (
        <div
          className="photo-page__boothSettings photo-page__modalPanel fixed z-[70] w-[min(calc(100vw-2rem),20rem)] rounded-2xl p-4 shadow-xl"
          style={{
            top: "max(56px, calc(env(safe-area-inset-top) + 44px))",
            right: "max(12px, env(safe-area-inset-right))",
          }}
          role="dialog"
          aria-label="행사 모드 설정"
        >
          <p className="mb-3 text-sm font-semibold text-zinc-900">행사 모드 설정</p>
          {boothCountdownPicker}
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>원본 4장 저장</span>
            <input
              type="checkbox"
              checked={boothSaveOriginals}
              onChange={(e) => setBoothSaveOriginals(e.target.checked)}
              className="h-5 w-5 accent-[#1e3e96]"
            />
          </label>
          <button
            type="button"
            onClick={handleBoothResetSequence}
            className="photo-page__btn-outline mt-4 w-full rounded-lg px-3 py-2 text-xs font-medium"
          >
            저장 순번 초기화 (다음 {formatBoothSequenceLabel(readBoothSequence() + 1)}번)
          </button>
          <label className="mt-4 block text-sm">
            <span>행사 키</span>
            <input
              type="password"
              value={boothKey}
              onChange={(e) => handleBoothKeyChange(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="QR로 받기에 필요해요"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <button
            type="button"
            onClick={() => setBoothClearConfirmOpen(true)}
            className="mt-4 w-full rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600"
          >
            오늘 업로드한 사진 모두 삭제
          </button>
          {boothClearMessage ? (
            <p className="mt-2 text-center text-xs text-zinc-600" role="status">
              {boothClearMessage}
            </p>
          ) : null}
        </div>
      ) : null}
      {boothClearConfirmOpen ? (
        <div
          className="photo-page__modalBackdrop fixed inset-0 z-[90] flex items-center justify-center p-4"
          role="presentation"
          onClick={() => {
            if (!boothClearing) setBoothClearConfirmOpen(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="오늘 업로드한 사진 삭제"
            className="photo-page__modalPanel w-full max-w-sm rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold">오늘 업로드한 사진을 모두 삭제할까요?</p>
            <p className="photo-page__sub mt-2 text-sm leading-relaxed">
              {formatBoothDateLabel(boothDateKey())}에 올린 사진이 전부 지워지고, QR로 받은
              링크도 더 이상 열리지 않아요. 되돌릴 수 없어요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={boothClearing}
                onClick={() => setBoothClearConfirmOpen(false)}
                className="photo-page__btn-outline rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={boothClearing}
                onClick={() => void handleBoothClearToday()}
                className="photo-page__btn-primary rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {boothClearing ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {boothSavedSeqLabel ? (
        <div
          className="photo-page__boothToast pointer-events-none fixed left-1/2 z-[80] -translate-x-1/2 rounded-full bg-zinc-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg"
          style={{ top: "max(16px, env(safe-area-inset-top))" }}
          role="status"
        >
          ✅ 저장됨 · {boothSavedSeqLabel}번
        </div>
      ) : null}
    </>
  ) : null;

  return (
    <div
      className={`photo-page${step === "capture" ? " photo-page--capturing" : ""}${
        boothMode ? " photo-page--booth" : ""
      }`}
    >
      {boothSettingsPanel}
      {!boothMode ? (
      <header
        className={`photo-page__header mx-auto flex w-full max-w-lg items-center justify-between px-4 py-4 lg:max-w-[1400px] lg:px-12 lg:py-3 ${
          step === "capture" ? "max-md:hidden photo-page__header--capture" : ""
        }`}
      >
        <div>
          <p className="photo-page__brand">daeni.kr</p>
          <h1 className="photo-page__title">인생네컷</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="photo-page__btn-outline inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs"
          >
            ← 홈
          </Link>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="photo-page__btn-outline inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs"
          >
            ← Gallery
          </button>
        </div>
      </header>
      ) : null}

      <main
        className={`photo-page__main mx-auto max-w-lg px-4 pb-16 ${
          step === "capture"
            ? "max-md:overflow-hidden max-md:p-0 max-md:pb-0 photo-page__main--capture lg:flex lg:min-h-0 lg:max-w-[1400px] lg:flex-1 lg:flex-col lg:px-12 lg:pb-0"
            : ""
        }`}
      >
        {step === "frame" ? (
          <div className="space-y-4">
            <p className="photo-page__sub text-sm">프레임을 골라주세요.</p>
            <div ref={framePickerRef} className="photo-page__framePicker" role="listbox" aria-label="프레임 선택">
              {listFramesForMode(OVERLAY_FRAMES, boothMode).map((f) => {
                const selected = f.id === frameDef.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => handleSelectFrame(f)}
                    className={`photo-page__frameCard${selected ? " photo-page__frameCard--selected" : ""}`}
                  >
                    <div className="photo-page__frameThumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.src} alt="" className="photo-page__frameThumbImg" />
                    </div>
                    <p className="photo-page__frameCardLabel">{f.label}</p>
                    {f.desc ? (
                      <p className="photo-page__sub photo-page__frameCardDesc">{f.desc}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {!boothMode ? countdownPicker : null}
            {!boothMode ? (
              <p className="photo-page__sub text-center text-[11px]">
                사진은 서버로 보내지 않으며, 기기에만 저장됩니다.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === "capture" ? (
          <div
            className="photo-page__captureShell max-md:fixed max-md:inset-0 max-md:z-50 max-md:flex max-md:flex-col max-md:overflow-hidden max-md:px-[max(12px,env(safe-area-inset-left))] max-md:pr-[max(12px,env(safe-area-inset-right))] lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden"
            style={{
              paddingTop: "max(0px, env(safe-area-inset-top))",
              paddingBottom: "max(0px, env(safe-area-inset-bottom))",
            }}
          >
            {!boothMode ? (
              <div className="flex shrink-0 items-center justify-between py-2 md:hidden">
                <span className="photo-page__shotLabel text-sm font-semibold tabular-nums">
                  {shotLabel}
                </span>
                <button
                  type="button"
                  onClick={exitCaptureToFrame}
                  className="photo-page__iconBtn flex h-9 w-9 items-center justify-center rounded-full text-lg"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
            ) : null}

            {cellsInvalid ? (
              <p className="photo-page__alertWarn rounded-xl px-4 py-3 text-sm">
                프레임 칸을 찾지 못했어요. 개발자 도구 콘솔의{" "}
                <span className="font-mono text-[11px]">[photo-four-cut]</span> 로그를 확인해 주세요.
              </p>
            ) : null}
            {debugMode && debugPreviewUrl ? (
              <div className="photo-page__debugStrip hidden space-y-1 lg:block">
                <p className="photo-page__sub text-center text-[11px]">debug: 감지된 칸 (1~4)</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={debugPreviewUrl}
                  alt="칸 감지 디버그"
                  className="mx-auto w-full max-w-[240px] rounded-lg border border-red-500/50"
                />
              </div>
            ) : null}
            {layoutLoading ? (
              <p className="photo-page__sub text-center text-sm">프레임 분석 중…</p>
            ) : null}
            {cameraError ? (
              <div className="photo-page__alertError mx-auto w-full max-w-md space-y-2 rounded-xl px-4 py-3 text-sm">
                <p>{cameraError}</p>
                {cameraRetryable ? (
                  <button
                    type="button"
                    onClick={() => void startCamera({ forceNew: true })}
                    className="photo-page__btn-outline w-full rounded-lg px-3 py-2 text-xs font-medium"
                  >
                    다시 시도
                  </button>
                ) : null}
              </div>
            ) : null}

            <div
              ref={captureBodyRef}
              className="photo-page__captureBody max-md:flex max-md:min-h-0 max-md:flex-1 max-md:items-center max-md:px-0 lg:min-h-0 lg:flex-1"
            >
              {!cameraError && !captureBlocked && cellBox ? (
                <div className="photo-page__captureGrid mx-auto w-full max-md:max-w-[720px] lg:grid lg:h-full lg:max-w-none lg:grid-cols-[1fr_auto] lg:items-start lg:gap-10">
                  <div className="photo-page__captureCameraCol flex w-full min-w-0 flex-col items-center justify-center gap-2 max-lg:flex-col">
                    {showStandGuide && standHint?.message ? (
                      <p className="photo-page__standGuide w-full max-lg:px-2">
                        {standHint.message}
                      </p>
                    ) : null}
                    {cellBox}
                  </div>
                  <div className="photo-page__captureStripCol hidden lg:flex lg:flex-col lg:items-center">
                    <div
                      className="photo-page__stripCard overflow-hidden rounded-xl bg-white shadow-[0_2px_16px_rgba(28,28,36,0.12)]"
                      style={
                        desktopMetrics
                          ? { height: desktopMetrics.stripH, width: desktopMetrics.stripW }
                          : undefined
                      }
                    >
                      <canvas
                        ref={stripCanvasRef}
                        className="photo-page__stripCanvas block touch-manipulation"
                        style={
                          desktopMetrics
                            ? {
                                height: desktopMetrics.stripH,
                                width: desktopMetrics.stripW,
                              }
                            : { height: 200, width: "auto" }
                        }
                        onPointerDown={(e) => {
                          if (stripCanvasRef.current) {
                            handleStripCanvasPointer(e, stripCanvasRef.current);
                          }
                        }}
                      />
                    </div>
                    <p className="photo-page__sub mt-2 max-w-[12rem] text-center text-[11px] leading-snug">
                      전체 미리보기 · 찍은 칸 탭 = 다시 찍기
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="photo-page__captureFooter shrink-0 max-md:pb-2 lg:mt-4 lg:grid lg:grid-cols-[1fr_auto] lg:gap-10">
              <div className="photo-page__captureFooterBar flex items-center justify-between gap-4 max-lg:flex-col max-lg:gap-3">
                <div className="flex items-center gap-3 max-lg:w-full max-lg:justify-center">
                  <div className="flex gap-2.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`photo-page__dot ${
                          photoSlots[i]
                            ? "photo-page__dot--done"
                            : i === shotIndex
                              ? "photo-page__dot--current"
                              : ""
                        }`}
                      />
                    ))}
                  </div>
                  <p className="photo-page__sub hidden text-sm lg:block">
                    {capturing ? "촬영 중…" : `${filledCount}장 완료`}
                  </p>
                  <p className="photo-page__sub text-xs lg:hidden">
                    {capturing ? "촬영 중…" : `${filledCount}장 완료`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exitCaptureToFrame}
                  disabled={boothMode && capturing}
                  className={`photo-page__frameBackLink photo-page__frameBackBtn max-md:w-full max-md:py-1 max-lg:w-full max-lg:text-center lg:shrink-0 lg:rounded-lg lg:px-4 lg:py-2 lg:text-xs${
                    boothMode && capturing ? " invisible" : ""
                  }`}
                >
                  프레임 다시 고르기
                </button>
              </div>
              <div className="hidden lg:block" aria-hidden />
            </div>

            {!boothMode && !cameraError && !captureBlocked ? (
              <div className="mx-auto mt-3 w-full max-w-md shrink-0 px-0 max-lg:px-2">
                {countdownPicker}
              </div>
            ) : null}

            {!boothMode && !capturing && filledCount < 4 && !cameraError && !captureBlocked ? (
              <button
                type="button"
                onClick={() => void runCaptureSequence()}
                className="photo-page__btn-primary mx-auto mt-3 hidden w-full max-w-md rounded-xl py-3 text-sm font-semibold md:block lg:hidden"
              >
                {filledCount === 0 ? "촬영 시작" : "이어서 촬영"}
              </button>
            ) : null}

            {!boothMode ? (
              <p className="photo-page__captureFinePrint photo-page__sub hidden shrink-0 text-center text-[11px] lg:mt-3 lg:block">
                사진은 서버로 전송되지 않으며, 기기에만 저장됩니다. 찍은 칸을 탭하면 다시 찍을
                수 있어요.
              </p>
            ) : null}

            {stripExpanded ? (
              <div
                className="photo-page__modalBackdrop fixed inset-0 z-[60] flex items-center justify-center p-4 md:hidden"
                role="dialog"
                aria-label="전체 미리보기"
                onClick={() => setStripExpanded(false)}
              >
                <div
                  className="photo-page__modalPanel max-h-[85vh] w-full max-w-sm rounded-2xl p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">다시 찍을 칸 선택</p>
                    <button
                      type="button"
                      onClick={() => setStripExpanded(false)}
                      className="photo-page__sub"
                      aria-label="닫기"
                    >
                      ✕
                    </button>
                  </div>
                  <canvas
                    ref={stripCanvasExpandedRef}
                    className="photo-page__stripCanvas mx-auto max-h-[60vh] w-auto touch-manipulation"
                    onPointerDown={(e) => {
                      if (stripCanvasExpandedRef.current) {
                        handleStripCanvasPointer(e, stripCanvasExpandedRef.current, true);
                      }
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "result" && previewUrl ? (
          boothMode ? (
            <div className="photo-page__boothResult flex min-h-[calc(100dvh-2rem)] flex-col gap-4 pb-8 md:flex-row md:items-center md:justify-center md:gap-10 md:pb-0">
              <div className="flex min-h-0 flex-1 items-center justify-center md:flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="인생네컷 결과"
                  className="photo-page__boothResultImg max-h-[calc(100dvh-12rem)] w-auto max-w-full rounded-lg object-contain md:max-h-[calc(100dvh-4rem)]"
                />
              </div>
              <div className="flex w-full shrink-0 flex-col gap-3 px-1 md:w-[22rem]">
                {boothQrBlock}
                {boothShareHint ? (
                  <p className="text-center text-sm text-red-600">{boothShareHint}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleBoothShare()}
                  className="flex w-full flex-col items-center gap-0.5 rounded-xl border border-zinc-300 bg-white py-3 text-base font-bold text-zinc-900 shadow-sm"
                >
                  <span>📲 아이폰(AirDrop) 받기</span>
                  <span className="text-xs font-medium text-zinc-500">AirDrop ‘모두 검색 가능’으로 변경 필요</span>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleBoothChooseFrame}
                    className="photo-page__boothBtnNext w-full rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-600"
                  >
                    🖼️ 프레임 선택
                  </button>
                  <button
                    type="button"
                    onClick={handleBoothNextPerson}
                    className="photo-page__boothBtnNext w-full rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-600"
                  >
                    🔄 다시 찍기
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="인생네컷 결과"
                className="photo-page__resultImg mx-auto w-full max-w-[360px] rounded-lg"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="photo-page__btn-primary w-full rounded-xl py-3 text-sm font-bold disabled:opacity-60"
                >
                  {saving ? "처리 중…" : "💾 사진 저장"}
                </button>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="photo-page__btn-outline w-full rounded-xl py-3 text-sm font-medium"
                >
                  🔄 다시 찍기
                </button>
                <button
                  type="button"
                  onClick={handleBackToFrameSelect}
                  className="photo-page__btn-outline w-full rounded-xl py-3 text-sm font-medium"
                >
                  🖼️ 프레임 선택
                </button>
              </div>
              <p className="photo-page__sub text-center text-[11px]">
                모바일에서는 공유 시트가 열릴 수 있어요. PC는 JPG 파일이 내려받기 됩니다.
              </p>
            </div>
          )
        ) : null}
      </main>
    </div>
  );
}
