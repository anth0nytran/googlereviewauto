interface EmailTemplateParams {
  customerName: string;
  businessName: string;
  reviewUrl: string;
  brandColor: string;
  logoUrl?: string;
}

/**
 * Default email HTML template for review requests.
 * Kept intentionally simple and plain-text-like to avoid spam/promotions filters.
 * Reads like a personal email from the business owner, not a marketing blast.
 */
export function getDefaultEmailHtml({
  customerName,
  businessName,
  reviewUrl,
  brandColor,
  logoUrl,
}: EmailTemplateParams): string {
  const firstName = customerName ? customerName.split(" ")[0] : "";
  const greeting = firstName ? `Hey ${firstName},` : "Hey,";
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${businessName}" width="120" style="display:block;height:auto;object-fit:contain;" />`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td style="padding:32px 24px;max-width:560px;">
        <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;">${greeting}</p>
        <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;">Thanks again for choosing us for your recent project. Hope everything turned out the way you wanted!</p>
        <p style="font-size:15px;color:#1a1a1a;margin:0 0 24px;line-height:1.6;">If you have a sec, it'd mean a lot if you could let us know how we did. Just tap below — takes about 30 seconds.</p>
        <p style="margin:0 0 32px;">
          <a href="${reviewUrl}" style="display:inline-block;padding:12px 28px;background:${brandColor};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Leave a quick review</a>
        </p>
        <p style="font-size:15px;color:#1a1a1a;margin:0 0 4px;line-height:1.6;">Thanks again,</p>
        <p style="font-size:15px;color:#1a1a1a;margin:0 0 24px;line-height:1.6;font-weight:600;">The ${businessName} Team</p>
        ${logoBlock ? `<p style="margin:0;">${logoBlock}</p>` : ""}
        <p style="font-size:12px;color:#999;margin:24px 0 0;">You're getting this because we recently worked with you. No worries if you'd rather not leave a review — we appreciate your business either way.</p>
        <p style="font-size:10px;color:#ccc;margin:12px 0 0;"><a href="mailto:unsubscribe@quicklaunchweb.us?subject=unsubscribe" style="color:#ccc;text-decoration:none;">unsubscribe</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Render a custom template with placeholder replacement.
 */
export function renderCustomTemplate(
  template: string,
  params: EmailTemplateParams
): string {
  return template
    .replace(/\{\{name\}\}/g, params.customerName || "")
    .replace(/\{\{business_name\}\}/g, params.businessName)
    .replace(/\{\{review_url\}\}/g, params.reviewUrl);
}
