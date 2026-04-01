import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyReviewToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  let body: { token?: string; rating?: number; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 1. Verify token
  if (!body.token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const verified = verifyReviewToken(body.token);
  if (!verified) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const { contactId, clientId } = verified;

  // 2. Validate rating
  const rating = body.rating;
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  // 3. Verify this contact was actually sent a message
  const { data: message } = await supabase
    .from("messages")
    .select("id")
    .eq("contact_id", contactId)
    .eq("client_id", clientId)
    .limit(1)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  }

  // 4. Save feedback
  const feedbackMessage =
    typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

  const { error } = await supabase.from("feedback").insert({
    contact_id: contactId,
    client_id: clientId,
    rating,
    message: feedbackMessage || null,
  });

  if (error) {
    console.error("Feedback insert error:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  // 5. Update message status to 'clicked'
  await supabase
    .from("messages")
    .update({ status: "clicked" })
    .eq("contact_id", contactId)
    .eq("client_id", clientId)
    .eq("status", "sent");

  return NextResponse.json({ ok: true });
}
