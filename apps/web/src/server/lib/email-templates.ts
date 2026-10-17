const BRAND = "ZindagiCare";
const BRAND_COLOR = "#0f766e";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared branded wrapper every transactional email renders inside. */
function layout(options: { preheader?: string; heading: string; bodyHtml: string }): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(BRAND)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    ${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="background:${BRAND_COLOR};padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(BRAND)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${escapeHtml(options.heading)}</h1>
                ${options.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
                This is an automated message from ${escapeHtml(BRAND)}. Please don't reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(text)}</p>`;
}

export function notificationEmail(input: {
  name?: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(input.ctaLabel)}</a>`
      : "";
  const bodyHtml = `
    ${paragraph(greeting)}
    ${paragraph(input.body)}
    ${cta}
  `;
  return {
    subject: input.title,
    html: layout({ heading: input.title, bodyHtml, preheader: input.body }),
    text: `${greeting}\n\n${input.body}${input.ctaUrl ? `\n\n${input.ctaUrl}` : ""}`,
  };
}

export function paymentConfirmationEmail(input: {
  name?: string;
  amount: number;
  description: string;
  receiptUrl?: string;
}) {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const bodyHtml = `
    ${paragraph(`${greeting} we've received your payment.`)}
    <div style="margin:0 0 16px;padding:16px;background:#f0fdfa;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Amount paid</p>
      <p style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND_COLOR};">Rs. ${input.amount.toLocaleString()}</p>
      <p style="margin:0;font-size:14px;color:#334155;">${escapeHtml(input.description)}</p>
    </div>
    ${input.receiptUrl ? `<a href="${escapeHtml(input.receiptUrl)}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View receipt</a>` : ""}
  `;
  return {
    subject: `Payment received — Rs. ${input.amount.toLocaleString()}`,
    html: layout({ heading: "Payment confirmed", bodyHtml, preheader: `We've received your payment of Rs. ${input.amount.toLocaleString()}` }),
    text: `${greeting} we've received your payment of Rs. ${input.amount.toLocaleString()} for ${input.description}.${input.receiptUrl ? ` Receipt: ${input.receiptUrl}` : ""}`,
  };
}

export function welcomeEmail(input: { name: string }) {
  const bodyHtml = `
    ${paragraph(`Hi ${input.name}, welcome to ${BRAND}!`)}
    ${paragraph("Your account is ready. You can now book consults, manage appointments, and chat with doctors from your dashboard.")}
  `;
  return {
    subject: `Welcome to ${BRAND}`,
    html: layout({ heading: `Welcome to ${BRAND}`, bodyHtml }),
    text: `Hi ${input.name}, welcome to ${BRAND}! Your account is ready.`,
  };
}
