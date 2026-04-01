import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyReviewToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const verified = verifyReviewToken(body.token);
  if (!verified) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const { contactId, clientId } = verified;

  // Verify this contact was actually sent a message
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

  // Log the click
  await supabase.from("review_clicks").insert({
    contact_id: contactId,
    client_id: clientId,
  });

  // Update message status
  await supabase
    .from("messages")
    .update({ status: "clicked" })
    .eq("contact_id", contactId)
    .eq("client_id", clientId)
    .eq("status", "sent");

  return NextResponse.json({ ok: true });
}
