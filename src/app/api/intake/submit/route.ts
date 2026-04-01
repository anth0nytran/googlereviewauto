import { NextRequest, NextResponse } from "next/server";
import { processQueuedMessages } from "@/lib/email-queue";
import { supabase } from "@/lib/supabase";
import { isValidEmail, sanitize } from "@/lib/validate";

export async function POST(request: NextRequest) {
  // Verify PIN first
  const pin = request.headers.get("x-intake-pin");
  const correctPin = process.env.INTAKE_PIN;
  if (!correctPin || pin !== correctPin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { slug?: string; name?: string; email?: string; delay_minutes?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = sanitize(body.slug);
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const email = sanitize(body.email)?.toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const name = sanitize(body.name);
  const delayMinutes = typeof body.delay_minutes === "number" && body.delay_minutes >= 0 && body.delay_minutes <= 10080
    ? body.delay_minutes
    : undefined;

  // Look up client
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, email_delay_minutes, active")
    .eq("slug", slug)
    .single();

  if (clientError || !client || !client.active) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Upsert contact
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      { client_id: client.id, email, name, source: "manual" },
      { onConflict: "client_id,email" }
    )
    .select("id")
    .single();

  if (contactError || !contact) {
    return NextResponse.json({ error: "Failed to save contact" }, { status: 500 });
  }

  // Queue email
  const delay = delayMinutes !== undefined ? delayMinutes : client.email_delay_minutes;
  const scheduledFor = new Date(Date.now() + delay * 60 * 1000).toISOString();

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
    return NextResponse.json({ error: "Failed to queue message" }, { status: 500 });
  }

  let sentImmediately = false;

  // Instant send: process the queued message inline instead of self-fetching.
  if (delay === 0) {
    try {
      const result = await processQueuedMessages({
        limit: 1,
        messageIds: [queuedMessage.id],
      });
      sentImmediately = result.sent > 0;
    } catch (error) {
      console.error("Immediate send failed for intake submit:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    scheduled_for: scheduledFor,
    sent_immediately: sentImmediately,
  });
}
