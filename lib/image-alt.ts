function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/u, "").trim();
}

function parseFilenameParts(fileName: string): {
  dateToken: string;
  team: string;
  player: string;
} {
  const base = stripExtension(fileName);
  const parts = base
    .split(/[_\s,-]+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const dateToken =
    parts.find((part) => /^(\d{6}|\d{8})$/u.test(part)) ??
    parts.find((part) => /^\d{6,8}/u.test(part)) ??
    "";

  const firstNonDateIdx = parts.findIndex((part) => part !== dateToken);
  const team = firstNonDateIdx >= 0 ? parts[firstNonDateIdx] : "";
  const player =
    firstNonDateIdx >= 0 ? parts.slice(firstNonDateIdx + 1).join(" ").trim() : "";

  return {
    dateToken: dateToken || "미상 날짜",
    team: team || "현대건설",
    player: player || "김다인",
  };
}

export function buildMatchPhotoAltFromFilename(fileName: string): string {
  const { dateToken, team, player } = parseFilenameParts(fileName);
  return `${dateToken} ${team} ${player} 경기 사진`;
}

