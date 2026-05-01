/**
 * 빌드/개발 시작 전 실행: git log → public/changelog.json
 * Vercel 등 CI에서도 clone된 .git 기준으로 최신 목록이 생성됩니다.
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public");
const outPath = join(outDir, "changelog.json");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthKeyFromDate(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const yy = y % 100;
  return `${pad2(yy)}${pad2(m)}`;
}

function parseGitLog() {
  try {
    const fmt = "%H%x09%ad%x09%s";
    const out = execSync(`git log -n 400 --no-merges --date=iso-strict --pretty=format:${fmt}`, {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!out) return [];

    const lines = out.split(/\r?\n/).filter(Boolean);
    const rows = [];

    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const hash = parts[0];
      const iso = parts[1];
      const subject = parts.slice(2).join("\t").trim();
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) continue;
      rows.push({ hash, iso, subject, date });
    }

    rows.sort((a, b) => a.date.getTime() - b.date.getTime());

    const monthSeq = new Map();
    const withVersion = rows.map((row) => {
      const mk = monthKeyFromDate(row.date);
      const next = (monthSeq.get(mk) ?? 0) + 1;
      monthSeq.set(mk, next);
      const version = `${mk}-${pad2(next)}`;
      return {
        version,
        isoDate: row.iso,
        subject: row.subject || "(메시지 없음)",
      };
    });

    withVersion.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
    return withVersion;
  } catch {
    return [];
  }
}

const entries = parseGitLog();
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`, "utf-8");
console.log(`[changelog] wrote ${entries.length} entries → public/changelog.json`);
