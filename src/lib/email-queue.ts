import {
  getDefaultEmailHtml,
  renderCustomTemplate,
} from "@/lib/email-template";
import { resend } from "@/lib/resend";
import { supabase } from "@/lib/supabase";
import { createReviewToken } from "@/lib/tokens";

const DEFAULT_BATCH_SIZE = 50;
const PROCESSING_LEASE_MS = 10 * 60 * 1000;
const DEFAULT_APP_URL = "https://reviews.quicklaunchweb.us";

const MESSAGE_SELECT = `
  id,
  status,
  sent_at,
  contact_id,
  client_id,
  contacts!inner (id, name, email),
  clients!inner (
    id, name, slug, brand_color, logo_url, email_from_name,
    email_subject, email_body_template, google_review_url
  )
`;

interface QueueContact {
  id: string;
  name: string;
  email: string;
}

interface QueueClient {
  id: string;
  name: string;
  slug: string;
  brand_color: string;
  logo_url: string | null;
  email_from_name: string | null;
  email_subject: string | null;
  email_body_template: string | null;
  google_review_url: string | null;
}

interface QueueMessage {
  id: string;
  status: "queued" | "processing";
  sent_at: string | null;
  contact_id: string;
  client_id: string;
  contacts: QueueContact;
  clients: QueueClient;
}

interface RawQueueMessage extends Omit<QueueMessage, "contacts" | "clients"> {
  contacts: QueueContact | QueueContact[];
  clients: QueueClient | QueueClient[];
}

interface ProcessQueuedMessagesOptions {
  limit?: number;
  messageIds?: string[];
}

export interface ProcessQueuedMessagesResult {
  sent: number;
  failed: number;
  skipped: number;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
}

function getSingleRelation<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeQueueMessage(message: RawQueueMessage): QueueMessage {
  return {
    ...message,
    contacts: getSingleRelation(message.contacts),
    clients: getSingleRelation(message.clients),
  };
}

async function fetchCandidateMessages(
  options: ProcessQueuedMessagesOptions
): Promise<QueueMessage[]> {
  const limit = options.limit ?? DEFAULT_BATCH_SIZE;
  const dueAt = new Date().toISOString();
  const leaseCutoff = new Date(Date.now() - PROCESSING_LEASE_MS).toISOString();

  let queuedQuery = supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("channel", "email")
    .eq("status", "queued")
    .lte("scheduled_for", dueAt)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (options.messageIds?.length) {
    queuedQuery = queuedQuery.in("id", options.messageIds);
  }

  const { data: queuedMessages, error: queuedError } = await queuedQuery;

  if (queuedError) {
    throw queuedError;
  }

  const candidates = ((queuedMessages ?? []) as unknown as RawQueueMessage[]).map(
    normalizeQueueMessage
  );

  if (candidates.length >= limit) {
    return candidates;
  }

  let staleProcessingQuery = supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("channel", "email")
    .eq("status", "processing")
    .lte("sent_at", leaseCutoff)
    .order("sent_at", { ascending: true })
    .limit(limit - candidates.length);

  if (options.messageIds?.length) {
    staleProcessingQuery = staleProcessingQuery.in("id", options.messageIds);
  }

  const { data: staleProcessingMessages, error: staleProcessingError } =
    await staleProcessingQuery;

  if (staleProcessingError) {
    throw staleProcessingError;
  }

  return candidates.concat(
    ((staleProcessingMessages ?? []) as unknown as RawQueueMessage[]).map(
      normalizeQueueMessage
    )
  );
}

async function claimMessage(message: QueueMessage): Promise<boolean> {
  const claimTime = new Date().toISOString();
  let claimQuery = supabase
    .from("messages")
    .update({ status: "processing", sent_at: claimTime })
    .eq("id", message.id)
    .eq("channel", "email")
    .select("id");

  if (message.status === "processing" && message.sent_at) {
    claimQuery = claimQuery
      .eq("status", "processing")
      .eq("sent_at", message.sent_at);
  } else {
    claimQuery = claimQuery.eq("status", "queued");
  }

  const { data: claimedMessage, error: claimError } =
    await claimQuery.maybeSingle();

  if (claimError) {
    console.error(`Failed to claim queued message ${message.id}:`, claimError);
    return false;
  }

  return Boolean(claimedMessage);
}

async function markMessageSent(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("status", "processing");

  if (error) {
    throw error;
  }
}

async function markMessageFailed(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ status: "failed", sent_at: null })
    .eq("id", messageId)
    .eq("status", "processing");

  if (error) {
    throw error;
  }
}

async function sendQueuedMessage(message: QueueMessage): Promise<void> {
  const contact = message.contacts;
  const client = message.clients;
  const baseUrl = getBaseUrl();

  const token = createReviewToken(contact.id, client.id);
  const reviewUrl = `${baseUrl}/review/${client.slug}?t=${token}`;

  const templateParams = {
    customerName: contact.name || "",
    businessName: client.name,
    reviewUrl,
    brandColor: client.brand_color || "#4F46E5",
    logoUrl: client.logo_url
      ? client.logo_url.startsWith("http")
        ? client.logo_url
        : `${baseUrl}${client.logo_url}`
      : undefined,
  };

  const html = client.email_body_template
    ? renderCustomTemplate(client.email_body_template, templateParams)
    : getDefaultEmailHtml(templateParams);

  const fromName = client.email_from_name || client.name;
  const subject = client.email_subject || "How was your experience?";

  await resend.emails.send({
    from: `${fromName} <reviews@quicklaunchweb.us>`,
    to: contact.email,
    subject,
    html,
    headers: {
      "List-Unsubscribe": `<mailto:unsubscribe@quicklaunchweb.us?subject=unsubscribe-${contact.id}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

export async function processQueuedMessages(
  options: ProcessQueuedMessagesOptions = {}
): Promise<ProcessQueuedMessagesResult> {
  const candidates = await fetchCandidateMessages(options);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const message of candidates) {
    const claimed = await claimMessage(message);

    if (!claimed) {
      skipped++;
      continue;
    }

    try {
      await sendQueuedMessage(message);
      await markMessageSent(message.id);
      sent++;
    } catch (error) {
      console.error(`Failed to send queued message ${message.id}:`, error);

      try {
        await markMessageFailed(message.id);
      } catch (markFailedError) {
        console.error(
          `Failed to update queued message ${message.id} after send failure:`,
          markFailedError
        );
      }

      failed++;
    }
  }

  return { sent, failed, skipped };
}
