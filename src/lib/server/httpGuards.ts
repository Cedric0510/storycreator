import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_TRACKED_IPS = 5_000;
const requestTimestampsByIp = new Map<string, number[]>();

export function jsonError(message: string, status = 400) {
  if (status >= 500) console.error(`[api] ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export function isRateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const now = Date.now();
  const recent = (requestTimestampsByIp.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  if (requestTimestampsByIp.size > RATE_LIMIT_MAX_TRACKED_IPS) requestTimestampsByIp.clear();
  requestTimestampsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}
