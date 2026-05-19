export function placementDurationLabel(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso + "T00:00:00");
  const end = endIso ? new Date(endIso + "T00:00:00") : new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
  if (totalDays < 7) return `Day ${totalDays}`;
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  if (endIso) {
    const parts: string[] = [];
    parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`);
    if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    return parts.join(" ");
  }
  return `Week ${weeks}${days ? `, Day ${days + 1}` : ""}`;
}

export function formatDateNice(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}