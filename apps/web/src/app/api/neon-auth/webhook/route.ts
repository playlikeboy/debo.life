import { z } from "zod";
import { codeEmail, linkEmail } from "@/lib/auth-emails";
import { sendEmail } from "@/lib/email";
import { verifyNeonWebhook } from "@/lib/neon-webhook";
import { serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/**
 * Neon Auth calls this instead of sending its own email (events send.otp and
 * send.magic_link; set with `neon neon-auth config webhook update`). We check
 * Neon's signature, then send the code or link from mail.debo.life through
 * Cloudflare. Logs carry the event id and type only: never the address, code
 * or link.
 *
 * Replies: 200 sent; 401 not from Neon (Neon does not retry 4xx);
 * 502 the email could not be sent (Neon retries 5xx, up to 3 tries in 15 s).
 */

const Purpose = z.enum(["sign-in", "email-verification", "forget-password"]);
const Event = z.discriminatedUnion("event_type", [
  z.object({
    event_id: z.string(),
    event_type: z.literal("send.otp"),
    user: z.object({ email: z.string().email() }).passthrough(),
    event_data: z.object({ otp_code: z.string().regex(/^\d{4,10}$/), otp_type: Purpose, expires_at: z.string() }).passthrough(),
  }),
  z.object({
    event_id: z.string(),
    event_type: z.literal("send.magic_link"),
    user: z.object({ email: z.string().email() }).passthrough(),
    event_data: z.object({ link_url: z.string().url(), link_type: Purpose, expires_at: z.string() }).passthrough(),
  }),
]);

export async function POST(request: Request) {
  const env = serverEnv();
  const authBase = env.NEON_AUTH_BASE_URL;
  if (!authBase) return Response.json({ error: "Not configured" }, { status: 500 });
  const jwksUrl = env.NEON_AUTH_JWKS_URL ?? `${authBase}/.well-known/jwks.json`;

  const raw = await request.text();
  let payload: unknown;
  try {
    payload = await verifyNeonWebhook(raw, request.headers, jwksUrl);
  } catch (error) {
    console.warn("auth webhook rejected", { reason: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Event.safeParse(payload);
  if (!parsed.success) {
    // Signed by Neon but not an email event we handle: accept so Neon does not retry.
    console.info("auth webhook ignored", { type: (payload as { event_type?: string })?.event_type ?? "unknown" });
    return Response.json({ ignored: true });
  }
  const event = parsed.data;

  const email =
    event.event_type === "send.otp"
      ? codeEmail(event.user.email, event.event_data.otp_code, event.event_data.otp_type, event.event_data.expires_at)
      : linkEmail(event.user.email, event.event_data.link_url, event.event_data.link_type, event.event_data.expires_at);

  try {
    const { messageId } = await sendEmail(email, env);
    console.info("auth email sent", { eventId: event.event_id, type: event.event_type, messageId });
    return Response.json({ sent: true });
  } catch (error) {
    console.error("auth email failed", { eventId: event.event_id, type: event.event_type, reason: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "Email not sent" }, { status: 502 });
  }
}
