// ============================================================
// A Chapter — Shared email helper (Resend)
// ============================================================
// Notifikasi email untuk atelier. Jika RESEND_API_KEY atau alamat
// tujuan belum diatur, helper ini menjadi no-op sehingga alur
// pemesanan/vault tetap berjalan seperti biasa.
//
// Secret yang dibutuhkan (Supabase Dashboard -> Edge Functions ->
// Secrets, atau `supabase secrets set`):
//   RESEND_API_KEY            re_xxx
//   EMAIL_FROM                "A Chapter <notify@achapter.my.id>"
//   ADMIN_NOTIFICATION_EMAILS "atelier@achapter.my.id,owner@..."
// ============================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "A Chapter <notify@achapter.my.id>";
const ADMIN_EMAILS = (Deno.env.get("ADMIN_NOTIFICATION_EMAILS") || Deno.env.get("ADMIN_EMAIL") || "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.includes("@"));

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY && ADMIN_EMAILS.length > 0);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendAdminEmail(
  subject: string,
  html: string,
  options: { replyTo?: string } = {}
): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: ADMIN_EMAILS,
        subject,
        html,
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[EMAIL_ERROR] Resend rejected the message:", response.status, detail.slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "[EMAIL_ERROR]",
      error instanceof Error ? error.message : "Unexpected error."
    );
    return false;
  }
}

export function emailLayout(title: string, rows: string[][], footer = ""): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#7a7166;font-size:13px;vertical-align:top">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#2c2721;font-size:14px">${value}</td></tr>`
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#FBF8F3;font-family:Georgia,'Times New Roman',serif;color:#2c2721">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="letter-spacing:.22em;font-size:11px;color:#C5A880;margin:0 0 8px">A CHAPTER · ATELIER NOTIFICATION</p>
    <h1 style="font-size:24px;font-weight:500;margin:0 0 20px;color:#531B21">${escapeHtml(title)}</h1>
    <table style="width:100%;border-collapse:collapse">${cells}</table>
    ${footer ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#7a7166">${footer}</p>` : ""}
    <p style="margin:28px 0 0;font-size:11px;color:#a59c8f">Email otomatis dari sistem A Chapter.</p>
  </div></body></html>`;
}
