// Transactional email through Resend. Without RESEND_API_KEY and EMAIL_FROM,
// messages are printed to the server console in development (so links can be
// followed locally) and dropped with an error in production. Created lazily,
// so builds work without the keys.
import "server-only";
import { Resend } from "resend";
import { CLIENT_SERVICES_EMAIL } from "@/lib/catalog";

let client: Resend | null = null;

export type Email = { to: string; subject: string; text: string; html: string };

// False only in production without Resend configured, where mail is dropped.
// Callers that use up something to send (restock alerts) check this first.
export function canSendEmail() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || process.env.NODE_ENV !== "production";
}

export async function sendEmail({ to, subject, text, html }: Email) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      console.error("Email not sent: RESEND_API_KEY or EMAIL_FROM is not set", { subject });
    } else {
      console.info(`\n[email] To: ${to}\n[email] Subject: ${subject}\n${text}\n`);
    }
    return;
  }

  client ??= new Resend(key);
  const { error } = await client.emails.send({
    from,
    to,
    subject,
    text,
    html,
    replyTo: CLIENT_SERVICES_EMAIL,
  });
  if (error) throw new Error(`Email not sent: ${error.message}`);
}

// Never lets a failed send break the request that triggered it. For mail the
// customer can ask for again (verification, order links, stock alerts).
export async function trySendEmail(email: Email) {
  try {
    await sendEmail(email);
    return true;
  } catch (error) {
    console.error("Email failed", { subject: email.subject, error });
    return false;
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

// One plain layout for every message: a heading, short paragraphs and an
// optional button. Paragraphs are text, escaped here, never HTML.
export function composeEmail(input: {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}): Email {
  const { heading, paragraphs, action, footnote } = input;
  const text = [
    heading,
    ...paragraphs,
    ...(action ? [`${action.label}: ${action.url}`] : []),
    ...(footnote ? [footnote] : []),
    "Atelier client services",
  ].join("\n\n");

  const p = (body: string, style = "") =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;${style}">${escapeHtml(body)}</p>`;
  const html = `<!doctype html>
<html lang="en-GB"><body style="margin:0;padding:32px 16px;background:#ffffff;color:#111111;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto">
<p style="margin:0 0 32px;font-size:13px;letter-spacing:0.35em;text-transform:uppercase">Atelier</p>
<h1 style="margin:0 0 24px;font-size:22px;font-weight:400">${escapeHtml(heading)}</h1>
${paragraphs.map((body) => p(body)).join("\n")}
${
  action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 24px;background:#111111;color:#ffffff;text-decoration:none;font-size:14px">${escapeHtml(action.label)}</a></p>
${p(`Or paste this link into your browser: ${action.url}`, "color:#666666;font-size:13px;word-break:break-all")}`
    : ""
}
${footnote ? p(footnote, "color:#666666;font-size:13px") : ""}
${p("Atelier client services", "color:#666666;font-size:13px")}
</div></body></html>`;

  return { to: input.to, subject: input.subject, text, html };
}
