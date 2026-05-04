import type { Metadata } from "next";
import { VotoCategoryHome } from "@/components/voto-category-home";

export const metadata: Metadata = {
  title: "Voto Photo | 4 Categories",
  description: "현대건설 · 팀코리아 · 브이리그 · 실업배구 — Voto Photo 카테고리 갤러리",
};

export default function VotoPage() {
  return <VotoCategoryHome />;
}
