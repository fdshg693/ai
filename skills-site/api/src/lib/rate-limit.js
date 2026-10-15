/** Simple in-memory sliding-window rate limit (per Functions instance). */

const buckets = new Map();

/**
 * @param {string} key
 * @param {{ max?: number, windowMs?: number }} [options]
 * @returns {{ allowed: boolean, retryAfterSec: number }}
 */
export function checkRateLimit(key, { max = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now - entry.start >= windowMs) {
    entry = { start: now, count: 0 };
    buckets.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Best-effort client IP from SWA / Functions headers. */
export function clientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-azure-clientip") || "unknown";
}
