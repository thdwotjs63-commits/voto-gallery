"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
const FRAME_PNG_REV = 2;

function frameAssetSrc(path: string) {
  return `${path}?v=${FRAME_PNG_REV}`;
}

const OVERLAY_FRAMES: OverlayFrameDef[] = [
  {
    id: "daein",
    label: "다인 국가대표",
    desc: "2026 아시안게임",
    src: frameAssetSrc("/frames/daein.png"),
  },
  {
    id: "hillstate-national",
    label: "현대건설 국가대표",
    desc: "2026 아시안게임",
    src: frameAssetSrc("/frames/hillstate-national.png"),
  },
];

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
  const layoutRef = useRef<FrameLayout | null>(null);
  const capturedImagesRef = useRef<(HTMLImageElement | null)[]>([null, null, null, null]);
  const shotIndexRef = useRef(0);
  const countdownRef = useRef<number | null>(null);
  const countdownSecondsRef = useRef<CountdownSeconds>(3);
  const debugModeRef = useRef(false);
  const photoSlotsRef = useRef<(string | null)[]>([...EMPTY_SLOTS]);
  const facingModeRef = useRef<"user" | "environment">("user");
  const stepRef = useRef<Step>("frame");
  const startCameraRef = useRef<(options?: { forceNew?: boolean; isAutoRetry?: boolean }) => Promise<void>>(
    async () => undefined
  );
  const facingModeOnCaptureInitializedRef = useRef(false);
  const startCameraInFlightRef = useRef<Promise<void> | null>(null);

  const [debugMode, setDebugMode] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [stripExpanded, setStripExpanded] = useState(false);
  const [step, setStep] = useState<Step>("frame");
  const [frameDef, setFrameDef] = useState<OverlayFrameDef>(OVERLAY_FRAMES[0]);
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
  stepRef.current = step;

  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    setDebugMode(debug);
    debugModeRef.current = debug;
  }, []);

  const resetCapturedImages = useCallback(() => {
    capturedImagesRef.current = [null, null, null, null];
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
      })();

      startCameraInFlightRef.current = run;
      void run.finally(() => {
        if (startCameraInFlightRef.current === run) {
          startCameraInFlightRef.current = null;
        }
      });
      return run;
    },
    [attachStreamToVideo, stopCamera]
  );

  startCameraRef.current = startCamera;

  const finishIfComplete = useCallback(() => {
    const L = layoutRef.current;
    if (!L) return;
    const imgs = capturedImagesRef.current;
    if (imgs.some((img) => !img)) return;

    stopCamera();
    const canvas = composeFrameFromImages(L.frameImage, L.cells, imgs, {
      debug: debugModeRef.current,
    });
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.92));
    setStep("result");
  }, [stopCamera]);

  const captureAtIndex = useCallback(
    async (index: number) => {
      if (!videoRef.current || !layoutRef.current) return false;
      const video = videoRef.current;
      const ready = await waitForVideoReady(video);
      if (!ready) {
        setCameraError("카메라가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
        return false;
      }

      setShotIndex(index);
      shotIndexRef.current = index;

      const seconds = countdownSecondsRef.current;
      for (let c = seconds; c >= 1; c--) {
        if (!mountedRef.current) return false;
        setCountdown(c);
        countdownRef.current = c;
        await sleep(1000);
      }
      setCountdown(null);
      countdownRef.current = null;

      if (!mountedRef.current || !videoRef.current) return false;

      playShutter();
      setFlash(true);
      window.setTimeout(() => setFlash(false), 120);

      const dataUrl = captureFromVideo(
        videoRef.current,
        facingModeRef.current === "user"
      );
      if (!dataUrl) {
        console.warn("[photo] capture skipped: video not ready");
        return false;
      }

      const img = await loadImage(dataUrl);
      capturedImagesRef.current[index] = img;
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

      sequenceRunningRef.current = true;
      setCapturing(true);
      try {
        if (!mountedRef.current) return;

        const indices =
          onlyIndex !== undefined
            ? [onlyIndex]
            : [0, 1, 2, 3].filter((i) => !capturedImagesRef.current[i]);

        for (const i of indices) {
          if (!mountedRef.current) break;
          const ok = await captureAtIndex(i);
          if (!ok) break;
          if (indices.length > 1 && i !== indices[indices.length - 1]) {
            await sleep(2000);
          }
        }

        if (mountedRef.current && capturedImagesRef.current.every(Boolean)) {
          finishIfComplete();
        }
      } finally {
        setCapturing(false);
        sequenceRunningRef.current = false;
      }
    },
    [captureAtIndex, finishIfComplete]
  );

  useEffect(() => {
    if (step === "result") {
      stopCamera();
      return;
    }
    if (step !== "capture") {
      return;
    }
    if (cellsInvalid || layoutLoading) return;
    if (!layoutRef.current || layoutRef.current.cells.length !== 4) return;
    void startCamera();
  }, [step, startCamera, stopCamera, cellsInvalid, layoutLoading]);

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
    if (step !== "capture") {
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
  }, [step]);

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
    if (step !== "capture" || cameraError || cellsInvalid || layoutLoading) return;
    if (!layout || layout.cells.length !== 4) return;
    if (photoSlots.some(Boolean)) return;
    const t = window.setTimeout(() => void runCaptureSequence(), 800);
    return () => window.clearTimeout(t);
  }, [
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
    if (stripCanvasMiniRef.current) {
      paintStripToCanvas(stripCanvasMiniRef.current, payload, imgs, shotIndex, 110, debugMode);
    }
    if (stripCanvasRef.current) {
      const stripH = desktopMetrics?.stripH ?? 200;
      paintStripToCanvas(stripCanvasRef.current, payload, imgs, shotIndex, stripH, debugMode);
    }
    if (stripCanvasExpandedRef.current) {
      paintStripToCanvas(stripCanvasExpandedRef.current, payload, imgs, shotIndex, 320, debugMode);
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
    setFacingMode("user");
    setStripExpanded(false);
    sequenceRunningRef.current = false;
    setStep("capture");
  };

  const handleRetake = () => {
    resetCapturedImages();
    setPreviewUrl(null);
    setShotIndex(0);
    shotIndexRef.current = 0;
    setFacingMode("user");
    setStripExpanded(false);
    sequenceRunningRef.current = false;
    setStep("capture");
  };

  const handleBackToFrameSelect = () => {
    resetCapturedImages();
    setPreviewUrl(null);
    setShotIndex(0);
    shotIndexRef.current = 0;
    setFacingMode("user");
    setStripExpanded(false);
    sequenceRunningRef.current = false;
    setStep("frame");
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

  const exitCaptureToFrame = () => {
    setStripExpanded(false);
    setCameraError(null);
    setCameraRetryable(false);
    setStep("frame");
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const captureBlocked = cellsInvalid || layoutLoading || !layout || layout.cells.length !== 4;
  const filledCount = photoSlots.filter(Boolean).length;
  const currentCell = layout?.cells[Math.min(shotIndex, 3)];
  const frameOverlayStyle =
    currentCell && layout
      ? getFrameCellOverlayImageStyle(currentCell, layout.width, layout.height)
      : null;
  const mirrorPreview = facingMode === "user";
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
      {showStandGuide && standHint?.zone ? (
        <div
          className="photo-page__standZone pointer-events-none absolute z-[15] border-2 border-dashed border-white/75"
          style={{
            left: `${standHint.zone.left * 100}%`,
            top: `${standHint.zone.top * 100}%`,
            width: `${standHint.zone.width * 100}%`,
            height: `${standHint.zone.height * 100}%`,
          }}
          aria-hidden
        />
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
      <button
        type="button"
        onClick={toggleFacingMode}
        className="absolute bottom-2 right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg backdrop-blur-sm lg:bottom-3 lg:right-3 max-lg:left-2 max-lg:right-auto"
        aria-label={facingMode === "user" ? "후면 카메라로 전환" : "전면 카메라로 전환"}
      >
        🔄
      </button>
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
      {flash ? (
        <div className="pointer-events-none absolute inset-0 z-30 bg-white/80 animate-pulse" />
      ) : null}
      </div>
    </div>
  ) : null;

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  return (
    <div className={`photo-page${step === "capture" ? " photo-page--capturing" : ""}`}>
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
            <div className="photo-page__framePicker" role="listbox" aria-label="프레임 선택">
              {OVERLAY_FRAMES.map((f) => {
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
            {countdownPicker}
            <p className="photo-page__sub text-center text-[11px]">
              사진은 서버로 보내지 않으며, 기기에만 저장됩니다.
            </p>
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
            <div className="flex shrink-0 items-center justify-between py-2 md:hidden">
              <span className="photo-page__shotLabel text-sm font-semibold tabular-nums">{shotLabel}</span>
              <button
                type="button"
                onClick={exitCaptureToFrame}
                className="photo-page__iconBtn flex h-9 w-9 items-center justify-center rounded-full text-lg"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

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
                      <p className="photo-page__standGuide w-full text-center text-sm font-medium max-lg:px-2">
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
                  className="photo-page__frameBackLink photo-page__frameBackBtn max-md:w-full max-md:py-1 max-lg:w-full max-lg:text-center lg:shrink-0 lg:rounded-lg lg:px-4 lg:py-2 lg:text-xs"
                >
                  프레임 다시 고르기
                </button>
              </div>
              <div className="hidden lg:block" aria-hidden />
            </div>

            {!cameraError && !captureBlocked ? (
              <div className="mx-auto mt-3 w-full max-w-md shrink-0 px-0 max-lg:px-2">
                {countdownPicker}
              </div>
            ) : null}

            {!capturing && filledCount < 4 && !cameraError && !captureBlocked ? (
              <button
                type="button"
                onClick={() => void runCaptureSequence()}
                className="photo-page__btn-primary mx-auto mt-3 hidden w-full max-w-md rounded-xl py-3 text-sm font-semibold md:block lg:hidden"
              >
                {filledCount === 0 ? "촬영 시작" : "이어서 촬영"}
              </button>
            ) : null}

            <p className="photo-page__captureFinePrint photo-page__sub hidden shrink-0 text-center text-[11px] lg:mt-3 lg:block">
              사진은 서버로 전송되지 않으며, 기기에만 저장됩니다. 찍은 칸을 탭하면 다시 찍을 수 있어요.
            </p>

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
        ) : null}
      </main>
    </div>
  );
}
