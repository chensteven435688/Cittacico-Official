/**
 * send-email
 *
 * Auth hook that sends confirmation, recovery and related mail through
 * Resend instead of Supabase's built-in mailer.
 *
 * Deployed with verify_jwt = false: Auth signs the request with
 * SEND_EMAIL_HOOK_SECRET, not a user JWT. The standardwebhooks check
 * below is the authentication.
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY
 *   SEND_EMAIL_HOOK_SECRET   // copied from Authentication → Hooks
 *   RESEND_FROM              // e.g. "CITTÀCICO <hello@cittacico.com>"
 *
 * Until cittacico.com is verified in Resend, use:
 *   RESEND_FROM="CITTÀCICO <beth.t@example.com>"
 * which can only deliver to the Resend account owner's inbox.
 */

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4";

const DEFAULT_SITE = "https://www.cittacico.com";

type EmailAction =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email_change_new"
  | "reauthentication";

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: EmailAction | string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hookError(message: string, httpCode = 500): Response {
  return json({ error: { http_code: httpCode, message } }, httpCode);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function verifyUrl(
  supabaseUrl: string,
  tokenHash: string,
  type: string,
  redirectTo: string,
): string {
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("redirect_to", redirectTo || DEFAULT_SITE + "/account.html");
  return url.toString();
}

function copyFor(action: string): { subject: string; heading: string; body: string; cta: string } {
  switch (action) {
    case "signup":
    case "invite":
      return {
        subject: "Confirm your CITTÀCICO account",
        heading: "Confirm your email",
        body: "A maison account was opened with this address. Confirm below to finish registration. If you did not request this, ignore the message.",
        cta: "Confirm email",
      };
    case "recovery":
      return {
        subject: "Reset your CITTÀCICO password",
        heading: "Reset your password",
        body: "A password reset was requested for this account. Continue below to choose a new one. If you did not request this, ignore the message.",
        cta: "Choose a new password",
      };
    case "magiclink":
      return {
        subject: "Your CITTÀCICO sign-in link",
        heading: "Sign in to the house",
        body: "Use the link below to sign in. It expires shortly.",
        cta: "Sign in",
      };
    case "email_change":
    case "email_change_new":
      return {
        subject: "Confirm your new CITTÀCICO email",
        heading: "Confirm your new email",
        body: "This address was given as a new email for a maison account. Confirm below to complete the change.",
        cta: "Confirm new email",
      };
    case "reauthentication":
      return {
        subject: "Your CITTÀCICO verification code",
        heading: "Verification code",
        body: "Use this code to confirm a sensitive change to your account.",
        cta: "",
      };
    default:
      return {
        subject: "A message from CITTÀCICO",
        heading: "Confirm this action",
        body: "Use the link below to continue.",
        cta: "Continue",
      };
  }
}

function renderEmail(opts: {
  heading: string;
  body: string;
  cta: string;
  href: string;
  token?: string;
  showCode: boolean;
}): { html: string; text: string } {
  const heading = escapeHtml(opts.heading);
  const body = escapeHtml(opts.body);
  const cta = escapeHtml(opts.cta);
  const href = escapeHtml(opts.href);
  const token = opts.token ? escapeHtml(opts.token) : "";

  const button = opts.cta && opts.href
    ? `<p style="margin:32px 0 8px;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;background:#f5f0eb;color:#0a0a0a;text-decoration:none;letter-spacing:0.16em;font-size:11px;text-transform:uppercase;">${cta}</a>
      </p>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#9a9288;word-break:break-all;">${href}</p>`
    : "";

  const code = opts.showCode && token
    ? `<p style="margin:28px 0 0;font-size:28px;letter-spacing:0.28em;color:#c9a96e;">${token}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0a;color:#f5f0eb;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
            <tr>
              <td style="padding:0 8px 28px;letter-spacing:0.42em;font-size:13px;color:#c9a96e;text-align:center;">CITTÀCICO</td>
            </tr>
            <tr>
              <td style="padding:36px 32px;background:#111111;border:1px solid rgba(201,169,110,0.18);">
                <p style="margin:0 0 12px;font-size:22px;line-height:1.3;">${heading}</p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#cfc6bb;">${body}</p>
                ${code}
                ${button}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 8px 0;font-size:11px;line-height:1.6;color:#6f6a64;text-align:center;">
                The house in New York. This message concerns your account only.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textParts = [opts.heading, "", opts.body];
  if (opts.showCode && opts.token) textParts.push("", "Code: " + opts.token);
  if (opts.href) textParts.push("", opts.cta ? opts.cta + ": " + opts.href : opts.href);
  textParts.push("", "CITTÀCICO");

  return { html, text: textParts.join("\n") };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed.", { status: 405 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
  const from = Deno.env.get("RESEND_FROM") ?? "CITTÀCICO <beth.t@example.com>";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  if (!apiKey || !hookSecretRaw) {
    return hookError("Resend is not configured.", 503);
  }

  const hookSecret = hookSecretRaw.replace("v1,whsec_", "");
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let user: { email?: string };
  let email_data: EmailData;
  try {
    const verified = new Webhook(hookSecret).verify(payload, headers) as {
      user: { email?: string };
      email_data: EmailData;
    };
    user = verified.user;
    email_data = verified.email_data;
  } catch (error) {
    console.error("send-email signature failed", error);
    return hookError("Invalid hook signature.", 401);
  }

  const to = user?.email;
  if (!to) return hookError("No recipient on the auth event.", 400);

  const action = email_data.email_action_type;
  const copy = copyFor(action);
  const href = email_data.token_hash
    ? verifyUrl(supabaseUrl, email_data.token_hash, action, email_data.redirect_to)
    : "";
  const showCode = action === "reauthentication" || !email_data.token_hash;
  const rendered = renderEmail({
    heading: copy.heading,
    body: copy.body,
    cta: copy.cta,
    href,
    token: email_data.token,
    showCode,
  });

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: copy.subject,
    html: rendered.html,
    text: rendered.text,
  });

  if (error) {
    console.error("resend send failed", error);
    return hookError(error.message || "Resend rejected the message.", 500);
  }

  return json({});
});
