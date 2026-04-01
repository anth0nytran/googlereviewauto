import { createHmac } from "crypto";

const SECRET = process.env.REVIEW_TOKEN_SECRET!;

/**
 * Create a signed token encoding contact_id and client_id.
 * Format: base64url(contact_id:client_id:signature)
 */
export function createReviewToken(
  contactId: string,
  clientId: string
): string {
  const payload = `${contactId}:${clientId}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  const token = Buffer.from(`${payload}:${sig}`).toString("base64url");
  return token;
}

/**
 * Verify and decode a signed token.
 * Returns { contactId, clientId } or null if invalid.
 */
export function verifyReviewToken(
  token: string
): { contactId: string; clientId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;

    const [contactId, clientId, sig] = parts;
    const expectedSig = createHmac("sha256", SECRET)
      .update(`${contactId}:${clientId}`)
      .digest("hex");

    // Timing-safe comparison
    if (sig.length !== expectedSig.length) return null;
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (!a.equals(b)) return null;

    return { contactId, clientId };
  } catch {
    return null;
  }
}
