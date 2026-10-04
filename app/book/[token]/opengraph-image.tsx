import { ImageResponse } from "next/og";
import { isValidBookToken } from "@/lib/book-auth";

export const alt = "Happy Birthday Kim Dain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RED = "#C8202C";
const NAVY = "#1E3E96";

/** 기본 폰트에 한글이 없어서 영문/숫자만 쓴다. 메시지 내용은 절대 넣지 않는다 */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidBookToken(token)) {
    return new Response("Not Found", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#FBFAF7",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -80,
            left: -140,
            width: 620,
            height: 120,
            background: RED,
            transform: "rotate(-24deg)",
            borderRadius: 60,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 70,
            left: -180,
            width: 520,
            height: 56,
            background: RED,
            opacity: 0.75,
            transform: "rotate(-24deg)",
            borderRadius: 28,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -90,
            right: -120,
            width: 640,
            height: 130,
            background: NAVY,
            transform: "rotate(-24deg)",
            borderRadius: 65,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: -160,
            width: 500,
            height: 50,
            background: NAVY,
            opacity: 0.7,
            transform: "rotate(-24deg)",
            borderRadius: 25,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 120px",
            width: "100%",
          }}
        >
          <div style={{ fontSize: 30, letterSpacing: 8, color: RED, fontWeight: 700 }}>
            BIRTHDAY MESSAGE BOOK
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 112,
              lineHeight: 1,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: -2,
            }}
          >
            HAPPY BIRTHDAY
          </div>
          <div style={{ marginTop: 14, fontSize: 64, fontWeight: 700, color: "#1C1C24" }}>
            KIM DAIN #3
          </div>
          <div style={{ marginTop: 28, fontSize: 32, color: "#55524B", letterSpacing: 4 }}>
            2026.10.15
          </div>
        </div>
      </div>
    ),
    size
  );
}
