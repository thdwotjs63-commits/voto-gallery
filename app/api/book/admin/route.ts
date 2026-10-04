import { NextRequest, NextResponse } from "next/server";
import {
  hasBookAdminKey,
  isValidBookAdminKey,
  isValidBookToken,
  readBookAuthHeaders,
} from "@/lib/book-auth";
import {
  BOOK_HIDDEN_IDS_MAX,
  loadAllBirthdayMessages,
  loadHiddenMessageIdsForBook,
  saveHiddenMessageIds,
} from "@/lib/book-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "book/admin";
const NO_INDEX_HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_INDEX_HEADERS });
}

/** 토큰이 틀리면 존재를 숨기려고 404, 검토 키가 틀리면 401 */
function rejectInvalid(req: NextRequest): NextResponse | null {
  const { token, adminKey } = readBookAuthHeaders(req.headers);
  if (!isValidBookToken(token)) {
    return new NextResponse("Not Found", { status: 404, headers: NO_INDEX_HEADERS });
  }
  if (!hasBookAdminKey()) {
    console.error(`[${SCOPE}] missing env: BOOK_ADMIN_KEY`);
    return json({ error: "missing BOOK_ADMIN_KEY" }, 500);
  }
  if (!isValidBookAdminKey(adminKey)) return json({ error: "Invalid admin key" }, 401);
  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(req: NextRequest) {
  const denied = rejectInvalid(req);
  if (denied) return denied;
  try {
    const [messages, hiddenIds] = await Promise.all([
      loadAllBirthdayMessages(),
      loadHiddenMessageIdsForBook(SCOPE),
    ]);
    return json({ messages, hiddenIds });
  } catch (error) {
    console.error(`[${SCOPE}] load failed: ${errorMessage(error)}`);
    return json({ error: `load failed: ${errorMessage(error)}` }, 500);
  }
}

export async function PUT(req: NextRequest) {
  const denied = rejectInvalid(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const ids = (body as { hiddenIds?: unknown })?.hiddenIds;
  if (!Array.isArray(ids) || ids.length > BOOK_HIDDEN_IDS_MAX) {
    return json({ error: "hiddenIds must be an array of message ids" }, 400);
  }

  try {
    const hiddenIds = await saveHiddenMessageIds(SCOPE, ids);
    return json({ hiddenIds });
  } catch (error) {
    console.error(`[${SCOPE}] save failed: ${errorMessage(error)}`);
    return json({ error: `save failed: ${errorMessage(error)}` }, 500);
  }
}
