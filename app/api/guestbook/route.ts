import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GuestbookPostBody = {
  nickname?: string;
  content?: string;
  parentId?: number | null;
  adminPassword?: string;
};

const NICKNAME_MAX_LENGTH = 24;
const CONTENT_MAX_LENGTH = 180;
const ADMIN_KEYWORDS = ["voto", "실장"];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function hasAdminKeyword(nickname: string): boolean {
  const normalized = normalize(nickname);
  return ADMIN_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export async function POST(req: NextRequest) {
  try {
    const body = ((await req.json()) as GuestbookPostBody) ?? {};
    const nickname = (body.nickname ?? "").trim();
    const content = (body.content ?? "").trim();
    const parentId = body.parentId ?? null;
    const adminPassword = (body.adminPassword ?? "").trim();

    if (!nickname || !content) {
      return NextResponse.json(
        { error: "nickname and content are required" },
        { status: 400 }
      );
    }
    if (
      nickname.length > NICKNAME_MAX_LENGTH ||
      content.length > CONTENT_MAX_LENGTH
    ) {
      return NextResponse.json(
        { error: "nickname/content length exceeded" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    if (parentId !== null) {
      const { data: parent, error: parentError } = await supabase
        .from("guestbook")
        .select("id")
        .eq("id", parentId)
        .maybeSingle();
      if (parentError) throw parentError;
      if (!parent) {
        return NextResponse.json(
          { error: "Parent message not found" },
          { status: 400 }
        );
      }
    }

    const envAdminPassword = (process.env.ADMIN_PASSWORD ?? "").trim();
    const isAdmin =
      hasAdminKeyword(nickname) ||
      (envAdminPassword.length > 0 && adminPassword === envAdminPassword);

    const { data, error } = await supabase
      .from("guestbook")
      .insert({
        nickname,
        content,
        parent_id: parentId,
        is_admin: isAdmin,
      })
      .select("id,nickname,content,created_at,parent_id,is_admin")
      .single();

    if (error) throw error;

    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit guestbook";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
