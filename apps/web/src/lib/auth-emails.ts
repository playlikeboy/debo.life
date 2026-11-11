import type { Email } from "@/lib/email";

// The emails Debo sends to sign people in. Plain words (docs/WRITING.md),
// Debo's colours, no tracking pixels and no remote images. Every value is
// escaped before it goes into HTML.

export type CodePurpose = "sign-in" | "email-verification" | "forget-password";

const SUBJECTS: Record<CodePurpose, { code: string; link: string; action: string }> = {
  "sign-in": { code: "Your Debo sign-in code", link: "Your link to sign in to Debo", action: "sign in to Debo" },
  "email-verification": {
    code: "Your code to confirm your email",
    link: "Confirm your email for Debo",
    action: "confirm your email for Debo",
  },
  "forget-password": {
    code: "Your code to reset your Debo password",
    link: "Reset your Debo password",
    action: "reset your Debo password",
  },
};

export function codeEmail(to: string, code: string, purpose: CodePurpose, expiresAt: string): Email {
  const s = SUBJECTS[purpose];
  const minutes = minutesUntil(expiresAt);
  const text = [
    `Hi,`,
    ``,
    `Here is your code to ${s.action}: ${code}`,
    ``,
    `It works for ${minutes}. Never share it: Debo will never ask you for it.`,
    `If you did not ask for this, you can ignore this email. Nothing changes.`,
    ``,
    `Debo`,
  ].join("\n");
  const html = layout(`
    <p style="margin:0 0 16px">Here is your code to ${escape(s.action)}:</p>
    <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">${escape(code)}</p>
    <p style="margin:0 0 16px">It works for ${escape(minutes)}. Never share it: Debo will never ask you for it.</p>
    <p style="margin:0;color:#4a4f7a">If you did not ask for this, you can ignore this email. Nothing changes.</p>`);
  return { to, subject: s.code, html, text };
}

export function linkEmail(to: string, url: string, purpose: CodePurpose, expiresAt: string): Email {
  const s = SUBJECTS[purpose];
  const minutes = minutesUntil(expiresAt);
  const button = purpose === "sign-in" ? "Sign in to Debo" : purpose === "email-verification" ? "Confirm my email" : "Reset my password";
  const text = [
    `Hi,`,
    ``,
    `Open this link to ${s.action}:`,
    url,
    ``,
    `It works once, for ${minutes}.`,
    `If you did not ask for this, you can ignore this email. Nothing changes.`,
    ``,
    `Debo`,
  ].join("\n");
  const html = layout(`
    <p style="margin:0 0 20px">Press the button to ${escape(s.action)}. It works once, for ${escape(minutes)}.</p>
    <p style="margin:0 0 20px"><a href="${escape(url)}" style="display:inline-block;padding:12px 24px;border:2px solid #1b1f4b;border-radius:999px;background:#1b1f4b;color:#ffffff;font-weight:600;text-decoration:none">${escape(button)}</a></p>
    <p style="margin:0 0 16px;color:#4a4f7a">Or copy this link into your browser:<br><span style="word-break:break-all">${escape(url)}</span></p>
    <p style="margin:0;color:#4a4f7a">If you did not ask for this, you can ignore this email. Nothing changes.</p>`);
  return { to, subject: s.link, html, text };
}

function layout(body: string): string {
  return `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#e9eeff;color:#1b1f4b;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6">
<div style="max-width:520px;margin:0 auto;padding:24px;background:#ffffff;border:2px solid #1b1f4b;border-radius:24px">
<p style="margin:0 0 16px;font-size:22px;font-weight:700">Debo</p>${body}
</div></body></html>`;
}

function minutesUntil(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now();
  const minutes = Number.isFinite(ms) ? Math.max(1, Math.round(ms / 60_000)) : 5;
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
