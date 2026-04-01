import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limit (resets on cold start, which is fine for brute force protection)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const now = Date.now();

  // Check rate limit
  const entry = attempts.get(ip);
  if (entry) {
    if (now > entry.resetAt) {
      attempts.delete(ip);
    } else if (entry.count >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
  }

  const { pin } = await request.json();
  const correctPin = process.env.INTAKE_PIN;

  if (!correctPin) {
    return NextResponse.json({ error: "PIN not configured" }, { status: 500 });
  }

  if (pin !== correctPin) {
    // Track failed attempt
    const current = attempts.get(ip);
    if (current) {
      current.count++;
    } else {
      attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    }
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  // Clear attempts on success
  attempts.delete(ip);
  return NextResponse.json({ ok: true });
}
