/**
 * Validate email format. Simple but effective regex.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Sanitize a string: trim whitespace, remove control characters.
 */
export function sanitize(str: string | undefined | null): string {
  if (!str) return "";
  // eslint-disable-next-line no-control-regex
  return str.trim().replace(/[\x00-\x1f\x7f]/g, "");
}
