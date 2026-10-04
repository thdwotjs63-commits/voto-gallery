import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidBookToken } from "@/lib/book-auth";
import { BookAdminClient } from "./book-admin-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  if (!isValidBookToken(token)) notFound();
  return {
    title: "메시지북 검토",
    robots: { index: false, follow: false, nocache: true },
    alternates: { canonical: null },
  };
}

export default async function BookAdminPage({ params }: Props) {
  const { token } = await params;
  if (!isValidBookToken(token)) notFound();
  return (
    <div className="min-h-dvh bg-[#f6f3ee] [color-scheme:light]">
      <BookAdminClient token={token} />
    </div>
  );
}
