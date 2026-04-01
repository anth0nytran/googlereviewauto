import { NextRequest, NextResponse } from "next/server";
import { processQueuedMessages } from "@/lib/email-queue";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processQueuedMessages();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron send-emails failed:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
