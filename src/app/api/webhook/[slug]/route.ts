import { NextRequest, NextResponse } from "next/server";
import { processQueuedMessages } from "@/lib/email-queue";
import { supabase } from "@/lib/supabase";
import { isValidEmail, sanitize } from "@/lib/validate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // 1. Look up client by slug
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, api_key, email_delay_minutes, active")
    .eq("slug", slug)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.active) {
    return NextResponse.json({ error: "Client inactive" }, { status: 403 });
  }

  // 2. Verify API key
  const authHeader = request.headers.get("authorization");
  const providedKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!providedKey || providedKey !== client.api_key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse and validate body
  let body: { name?: string; email?: string; phone?: string; source?: string; delay_minutes?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = sanitize(body.email)?.toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const name = sanitize(body.name);
  const phone = sanitize(body.phone);
  const source = sanitize(body.source) || "api";

  // 4. Upsert contact (skip if already exists)
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      { client_id: client.id, email, name, phone, source },
      { onConflict: "client_id,email" }
    )
    .select("id")
    .single();

  if (contactError || !contact) {
    console.error("Contact upsert error:", contactError);
    return NextResponse.json({ error: "Failed to save contact" }, { status: 500 });
  }

  // 5. Check if a message was already queued/sent for this contact
  // Skip duplicate check for manual intake submissions (repeat customers, testing)
  if (source !== "manual") {
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("client_id", client.id)
      .in("status", ["queued", "processing", "sent"])
      .limit(1)
      .single();

    if (existingMessage) {
      return NextResponse.json({ ok: true, message: "Already queued" });
    }
  }

  // 6. Queue the review request email
  const delayMinutes = body.delay_minutes !== undefined ? body.delay_minutes : client.email_delay_minutes;
  const scheduledFor = new Date(
    Date.now() + delayMinutes * 60 * 1000
  ).toISOString();

  const { data: queuedMessage, error: messageError } = await supabase
    .from("messages")
    .insert({
      contact_id: contact.id,
      client_id: client.id,
      channel: "email",
      status: "queued",
      scheduled_for: scheduledFor,
    })
    .select("id")
    .single();

  if (messageError || !queuedMessage) {
    console.error("Message insert error:", messageError);
    return NextResponse.json({ error: "Failed to queue message" }, { status: 500 });
  }

  let sentImmediately = false;

  // If instant send, process the queued message inside this request.
  if (delayMinutes === 0) {
    try {
      const result = await processQueuedMessages({
        limit: 1,
        messageIds: [queuedMessage.id],
      });
      sentImmediately = result.sent > 0;
    } catch (error) {
      console.error("Immediate send failed for webhook intake:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    scheduled_for: scheduledFor,
    sent_immediately: sentImmediately,
  });
}
