import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY,
    NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID:
      process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
