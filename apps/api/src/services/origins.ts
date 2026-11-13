// Browser pages from arbitrary sites must not control a local video-processing
// server. CLI clients have no Origin header and remain usable.
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || origin !== url.origin) return false;
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return true;
    // Explicit origins support a separately hosted dashboard when required.
    const extra = (process.env.SPEED_TRAP_ALLOWED_ORIGINS ?? "")
      .split(",").map((entry) => entry.trim()).filter(Boolean);
    return extra.includes(origin);
  } catch {
    return false;
  }
}
