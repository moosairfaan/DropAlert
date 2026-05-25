import { labelForBrand } from "@/lib/brands";

function appBaseUrl(): string {
  return (
    process.env.DROPALERT_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://dropalert-sigma.vercel.app"
  ).replace(/\/$/, "");
}

function fromAddress(): string {
  const raw = (process.env.ALERT_FROM_EMAIL || "alerts@moosairfaan.dev").trim();
  if (raw.includes("<") && raw.includes(">")) return raw;
  return `DropAlert <${raw}>`;
}

function unsubscribePageUrl(token: string): string {
  return `${appBaseUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

function unsubscribeApiUrl(token: string): string {
  return `${appBaseUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWelcomeContent(
  email: string,
  brandValues: string[],
  unsubscribeToken: string
): { subject: string; text: string; html: string } {
  const labels = brandValues.map(labelForBrand);
  const unsub = unsubscribePageUrl(unsubscribeToken);
  const site = appBaseUrl();

  const subject = "You're on DropAlert — thanks for signing up";

  const text = `Thanks for signing up for DropAlert!

You're all set. We'll email you when we spot new sneaker drops for:
${labels.map((b) => `• ${b}`).join("\n")}

Visit your feed: ${site}

---
You're receiving this because you just subscribed with ${email}.
Unsubscribe anytime: ${unsub}
`;

  const listHtml = labels
    .map(
      (b) =>
        `<li style="margin:6px 0;font-weight:700">${escapeHtml(b)}</li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#0a0a0a;max-width:560px;margin:0 auto;padding:24px;background:#fff8f0">
  <div style="background:#ffffff;border:4px solid #0a0a0a;padding:28px;box-shadow:6px 6px 0 #0a0a0a">
    <p style="margin:0 0 8px;font-size:11px;font-weight:800;color:#ff2d6f;text-transform:uppercase;letter-spacing:0.12em">DropAlert</p>
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;font-style:italic;font-family:Georgia,serif;line-height:1.2">
      Thanks for signing up
    </h1>
    <p style="margin:0 0 20px;font-size:16px;color:#0a0a0a">
      If you're reading this, your email works. We'll notify you when new drops hit for:
    </p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#2d5bff">
      ${listHtml}
    </ul>
    <a href="${escapeHtml(site)}" style="display:block;background:#ff2d6f;color:#fff;text-align:center;padding:14px 20px;border:3px solid #0a0a0a;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.04em">
      View latest drops
    </a>
    <hr style="border:none;border-top:3px solid #0a0a0a;margin:28px 0 16px">
    <p style="margin:0;font-size:12px;color:#525252;line-height:1.6">
      Subscribed as <strong>${escapeHtml(email)}</strong>.
      <a href="${escapeHtml(unsub)}" style="color:#2d5bff;font-weight:700">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

export async function sendWelcomeEmail(
  toEmail: string,
  brandPrefs: string[],
  unsubscribeToken: string
): Promise<void> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const recipient = toEmail.trim().toLowerCase();
  const unsubApi = unsubscribeApiUrl(unsubscribeToken);
  const { subject, text, html } = buildWelcomeContent(
    recipient,
    brandPrefs,
    unsubscribeToken
  );

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [recipient],
      subject,
      text,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubApi}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API ${res.status}: ${body.slice(0, 200)}`);
  }
}
