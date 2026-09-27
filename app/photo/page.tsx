"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CssFrameId = "national" | "court" | "number" | "simple";
type FrameId = CssFrameId | "daein";
type Step = "frame" | "capture" | "result";

const DAEIN_FRAME_SRC = "/frames/daein.png";

const DAEIN_CELLS = [
  { top: 4.0, height: 17.1 },
  { top: 22.1, height: 17.1 },
  { top: 40.1, height: 17.1 },
  { top: 58.2, height: 17.1 },
] as const;
const DAEIN_CELL_LEFT = 6.7;
const DAEIN_CELL_WIDTH = 86.7;

const FRAMES: {
  id: FrameId;
  label: string;
  desc: string;
  src?: string;
  cellAspect: string;
}[] = [
  {
    id: "daein",
    label: "다인 국가대표",
    desc: "2026 아시안게임",
    src: DAEIN_FRAME_SRC,
    cellAspect: "2.9 / 1",
  },
  { id: "national", label: "태극", desc: "🇰🇷 국가대표 선발", cellAspect: "4 / 3" },
  { id: "court", label: "코트", desc: "배구 코트 라인", cellAspect: "4 / 3" },
  { id: "number", label: "등번호", desc: "No.3", cellAspect: "4 / 3" },
  { id: "simple", label: "기본", desc: "심플 블랙", cellAspect: "4 / 3" },
];

function getFrameMeta(id: FrameId) {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

function speakCaptureGuide() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance("얼굴이 네모 안에 오게 해요");
  utterance.lang = "ko-KR";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function CaptureGuideOverlay({
  cellAspect,
  showFaceHint,
}: {
  cellAspect: string;
  showFaceHint: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-3">
      <div
        className="relative max-h-[88%] max-w-[96%] shrink-0 border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
        style={{ aspectRatio: cellAspect }}
      >
        {showFaceHint ? (
          <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm font-semibold leading-snug text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
            여기에 얼굴이 오게 해요
          </p>
        ) : null}
      </div>
    </div>
  );
}

const EXPORT_WIDTH = 900;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function playShutter() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.width / img.height;
  const cr = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > cr) {
    sw = img.height * cr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / cr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawFrameBackground(
  ctx: CanvasRenderingContext2D,
  frame: CssFrameId,
  w: number,
  h: number
) {
  if (frame === "national") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#C8102E");
    g.addColorStop(0.45, "#1a1a1a");
    g.addColorStop(1, "#003478");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = `bold ${Math.round(w * 0.062)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🇰🇷 TEAM KOREA", w / 2, h * 0.046);
  } else if (frame === "court") {
    ctx.fillStyle = "#E8744A";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(2, w * 0.004);
    const midY = h * 0.42;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, midY);
    ctx.lineTo(w * 0.92, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, midY, w * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    for (let i = 1; i < 5; i++) {
      const y = h * 0.12 + (h * 0.55 * i) / 5;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, y);
      ctx.lineTo(w * 0.9, y);
      ctx.stroke();
    }
  } else if (frame === "number") {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.font = `900 ${Math.round(h * 0.55)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3", w / 2, h * 0.38);
  } else {
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, w, h);
  }
}

async function composeDaeinFrame(photoDataUrls: string[]): Promise<HTMLCanvasElement> {
  const scale = 2;
  const w = 600 * scale;
  const h = 1740 * scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const imgs = await Promise.all(photoDataUrls.map(loadImage));
  for (let i = 0; i < 4; i++) {
    const cell = DAEIN_CELLS[i];
    const x = (DAEIN_CELL_LEFT / 100) * w;
    const y = (cell.top / 100) * h;
    const cw = (DAEIN_CELL_WIDTH / 100) * w;
    const ch = (cell.height / 100) * h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cw, ch);
    ctx.clip();
    drawImageCover(ctx, imgs[i], x, y, cw, ch);
    ctx.restore();
  }

  const overlay = await loadImage(DAEIN_FRAME_SRC);
  ctx.drawImage(overlay, 0, 0, w, h);
  return canvas;
}

async function composeFourCut(frame: CssFrameId, photoDataUrls: string[]): Promise<HTMLCanvasElement> {
  const w = EXPORT_WIDTH;
  const h = Math.round((w * 8) / 5);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  drawFrameBackground(ctx, frame, w, h);

  const pad = w * 0.06;
  const logoH = h * 0.065;
  const headerH = frame === "national" ? h * 0.088 : h * 0.03;
  const gridTop = pad + headerH;
  const gridBottom = h - pad - logoH;
  const gap = w * 0.028;
  const cellW = (w - pad * 2 - gap) / 2;
  const cellH = (gridBottom - gridTop - gap) / 2;

  const imgs = await Promise.all(photoDataUrls.map(loadImage));
  const positions = [
    [pad, gridTop],
    [pad + cellW + gap, gridTop],
    [pad, gridTop + cellH + gap],
    [pad + cellW + gap, gridTop + cellH + gap],
  ] as const;

  for (let i = 0; i < 4; i++) {
    const [x, y] = positions[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellW, cellH);
    ctx.clip();
    drawImageCover(ctx, imgs[i], x, y, cellW, cellH);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cellW, cellH);
  }

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `600 ${Math.round(w * 0.028)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("daeni.kr", w / 2, h - pad * 0.85);

  return canvas;
}

async function composeResult(frame: FrameId, photoDataUrls: string[]): Promise<HTMLCanvasElement> {
  if (frame === "daein") return composeDaeinFrame(photoDataUrls);
  return composeFourCut(frame, photoDataUrls);
}

function captureFromVideo(video: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 720;
  canvas.height = video.videoHeight || 960;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function framePreviewClass(id: FrameId): string {
  if (id === "daein") return "bg-white";
  switch (id) {
    case "national":
      return "bg-gradient-to-br from-[#C8102E] via-zinc-900 to-[#003478]";
    case "court":
      return "bg-[#E8744A]";
    case "number":
      return "bg-black";
    default:
      return "bg-zinc-900";
  }
}

function PhotoFrameOverlay({ photos }: { photos: string[] }) {
  return (
    <div
      className="photo-frame relative mx-auto w-full max-w-[480px] bg-white"
      style={{ aspectRatio: `${600} / ${1740}` }}
    >
      <div className="photo-cells absolute inset-0 z-[1]">
        {DAEIN_CELLS.map((cell, i) => (
          <div
            key={i}
            className="absolute overflow-hidden"
            style={{
              left: `${DAEIN_CELL_LEFT}%`,
              width: `${DAEIN_CELL_WIDTH}%`,
              height: `${cell.height}%`,
              top: `${cell.top}%`,
            }}
          >
            {photos[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photos[i]}
                alt=""
                className="h-full min-h-0 w-full min-w-0 object-cover"
              />
            ) : null}
          </div>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={DAEIN_FRAME_SRC}
        alt=""
        className="frame-overlay pointer-events-none absolute inset-0 z-[2] h-full w-full object-contain"
      />
    </div>
  );
}

export default function PhotoPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const guideVoicePlayedRef = useRef(false);
  const sequenceRunningRef = useRef(false);

  const [step, setStep] = useState<Step>("frame");
  const [frame, setFrame] = useState<FrameId>("daein");
  const [photos, setPhotos] = useState<string[]>([]);
  const [shotIndex, setShotIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch {
      setCameraError(
        "카메라를 사용할 수 없어요. 브라우저 설정에서 카메라 권한을 허용한 뒤 다시 시도해 주세요."
      );
    }
  }, [stopCamera]);

  const runCaptureSequence = useCallback(async () => {
    if (sequenceRunningRef.current || capturing || !videoRef.current) return;
    sequenceRunningRef.current = true;
    try {
    if (!guideVoicePlayedRef.current) {
      speakCaptureGuide();
      guideVoicePlayedRef.current = true;
      await sleep(1400);
    }
    if (!mountedRef.current || !videoRef.current) return;
    setCapturing(true);
    setPhotos([]);
    setShotIndex(0);
    const collected: string[] = [];

    for (let i = 0; i < 4; i++) {
      if (!mountedRef.current) break;
      setShotIndex(i);
      for (let c = 3; c >= 1; c--) {
        if (!mountedRef.current) break;
        setCountdown(c);
        await sleep(1000);
      }
      setCountdown(null);
      if (!mountedRef.current || !videoRef.current) break;

      playShutter();
      setFlash(true);
      window.setTimeout(() => setFlash(false), 120);

      const dataUrl = captureFromVideo(videoRef.current);
      if (dataUrl) {
        collected.push(dataUrl);
        setPhotos([...collected]);
      }
      if (i < 3) await sleep(2000);
    }

    setCountdown(null);
    setCapturing(false);
    if (mountedRef.current && collected.length === 4) {
      stopCamera();
      const canvas = await composeResult(frame, collected);
      setPreviewUrl(canvas.toDataURL("image/png"));
      setStep("result");
    }
    } finally {
      sequenceRunningRef.current = false;
    }
  }, [capturing, frame, stopCamera]);

  useEffect(() => {
    if (step !== "capture") return;
    void startCamera();
  }, [step, startCamera]);

  useEffect(() => {
    if (step !== "capture" || cameraError || capturing) return;
    if (photos.length > 0) return;
    const t = window.setTimeout(() => void runCaptureSequence(), 800);
    return () => window.clearTimeout(t);
  }, [step, cameraError, capturing, photos.length, runCaptureSequence]);

  const handleSelectFrame = (id: FrameId) => {
    setFrame(id);
    setPhotos([]);
    setPreviewUrl(null);
    guideVoicePlayedRef.current = false;
    sequenceRunningRef.current = false;
    setStep("capture");
  };

  const handleRetake = () => {
    setPhotos([]);
    setPreviewUrl(null);
    setShotIndex(0);
    guideVoicePlayedRef.current = false;
    sequenceRunningRef.current = false;
    setStep("capture");
  };

  const frameMeta = getFrameMeta(frame);
  const showFaceHint = countdown === null;

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
    const fileName = `daeni-photo-${Date.now()}.png`;
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: "daeni.kr 네컷",
            text: "국가대표 선발 기념 네컷 📸",
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
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">daeni.kr</p>
          <h1 className="text-lg font-semibold">네컷 프레임</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
        >
          ← Gallery
        </button>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-16">
        {step === "frame" ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              국가대표 선발을 기념하는 네컷 프레임을 골라 주세요.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelectFrame(f.id)}
                  className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 text-left transition hover:border-zinc-500"
                >
                  <div
                    className={`relative w-full ${f.id === "daein" ? "aspect-[600/1740] bg-white" : "aspect-[5/8]"} ${framePreviewClass(f.id)}`}
                  >
                    {f.id === "daein" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.src}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    ) : (
                      <>
                    <div className="absolute inset-[12%] grid grid-cols-2 grid-rows-2 gap-1.5 p-0.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="rounded-sm bg-zinc-800/40 ring-1 ring-white/20"
                          style={{ aspectRatio: "3/4" }}
                        />
                      ))}
                    </div>
                    <p className="absolute bottom-2 left-0 right-0 text-center text-[9px] text-white/70">
                      daeni.kr
                    </p>
                    {f.id === "national" ? (
                      <span className="absolute left-0 right-0 top-[4%] text-center text-[10px] font-bold tracking-wide text-white/95">
                        🇰🇷 TEAM KOREA
                      </span>
                    ) : null}
                    {f.id === "number" ? (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black text-white/10">
                        3
                      </span>
                    ) : null}
                      </>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p className="text-[11px] text-zinc-500">{f.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-zinc-500">
              사진은 저장되지 않고 기기에만 다운로드됩니다.
            </p>
          </div>
        ) : null}

        {step === "capture" ? (
          <div className="space-y-4">
            <p className="text-center text-xs text-zinc-400">
              사진은 서버로 전송되지 않으며, 기기에만 저장됩니다.
            </p>
            {cameraError ? (
              <p className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                {cameraError}
              </p>
            ) : (
              <div className="relative mx-auto w-full max-h-[78vh] min-h-[min(72vw,420px)] overflow-hidden rounded-2xl bg-black aspect-[3/4]">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
                />
                <CaptureGuideOverlay
                  cellAspect={frameMeta.cellAspect}
                  showFaceHint={showFaceHint}
                />
                {countdown !== null ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
                    <span className="text-7xl font-black tabular-nums">{countdown}</span>
                  </div>
                ) : null}
                {flash ? (
                  <div className="pointer-events-none absolute inset-0 bg-white animate-pulse" />
                ) : null}
                <div className="absolute bottom-3 left-0 right-0 z-20 text-center text-xs text-white/80">
                  {capturing
                    ? `${Math.min(shotIndex + 1, 4)} / 4`
                    : frame === "daein"
                      ? "가로 네모 안에 얼굴을 맞춰 주세요"
                      : "네모 안에 얼굴을 맞춰 주세요"}
                </div>
              </div>
            )}
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${photos[i] ? "bg-emerald-400" : "bg-zinc-600"}`}
                />
              ))}
            </div>
            {!capturing && photos.length === 0 && !cameraError ? (
              <button
                type="button"
                onClick={() => void runCaptureSequence()}
                className="w-full rounded-xl bg-[#00287A] py-3 text-sm font-semibold"
              >
                촬영 시작
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setStep("frame");
              }}
              className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400"
            >
              프레임 다시 고르기
            </button>
          </div>
        ) : null}

        {step === "result" && previewUrl ? (
          <div className="space-y-4">
            {frame === "daein" && photos.length === 4 ? (
              <PhotoFrameOverlay photos={photos} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="네컷 결과"
                className="mx-auto w-full max-w-[360px] rounded-lg shadow-2xl"
              />
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="w-full rounded-xl bg-white py-3 text-sm font-bold text-zinc-900 disabled:opacity-60"
              >
                {saving ? "처리 중…" : "💾 사진 저장"}
              </button>
              <button
                type="button"
                onClick={handleRetake}
                className="w-full rounded-xl border border-zinc-600 py-3 text-sm font-medium"
              >
                🔄 다시 찍기
              </button>
            </div>
            <p className="text-center text-[11px] text-zinc-500">
              모바일에서는 공유 시트가 열릴 수 있어요. PC는 PNG 파일이 내려받기 됩니다.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
