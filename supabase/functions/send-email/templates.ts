/**
 * Email templates for the house.
 *
 * Written as plain inline-styled HTML rather than a component library: mail
 * clients understand tables and inline styles and little else, and keeping
 * the markup here means the wording lives in git rather than in a dashboard
 * text box.
 *
 * The palette is the site's, inverted. Ivory ground with ink text survives
 * Outlook and dark-mode clients far better than the black site chrome.
 */

const BRAND = {
  ground: "#f5f0eb",
  card: "#ffffff",
  ink: "#1a1a1a",
  gold: "#c9a96e",
  muted: "#6f6a65",
  hairline: "#e6ded4",
};

const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export type AuthEmailKind =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "email_change"
  | "reauthentication";

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bulletproof enough for Outlook, which ignores padding on anchors. */
function button(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
      <tr>
        <td align="center" bgcolor="${BRAND.ink}" style="border-radius:2px;">
          <a href="${escapeHtml(href)}"
             style="display:inline-block;padding:16px 34px;font-family:${SANS};font-size:12px;
                    letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.ground};
                    text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
}

function codeBlock(token: string): string {
  return `
    <p style="margin:0 0 8px;font-family:${SANS};font-size:12px;letter-spacing:0.14em;
              text-transform:uppercase;color:${BRAND.muted};">Or enter this code</p>
    <p style="margin:0 0 8px;font-family:${SANS};font-size:26px;letter-spacing:0.32em;
              color:${BRAND.ink};">${escapeHtml(token)}</p>`;
}

function layout(preheader: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>CITTÀCICO</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.ground};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${BRAND.ground};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.hairline};">
            <tr>
              <td style="padding:44px 44px 0;text-align:center;">
                <p style="margin:0;font-family:${SERIF};font-size:22px;letter-spacing:0.34em;
                          color:${BRAND.ink};">CITTÀCICO</p>
                <p style="margin:10px 0 0;font-family:${SANS};font-size:10px;letter-spacing:0.24em;
                          text-transform:uppercase;color:${BRAND.gold};">New York Maison</p>
                <div style="height:1px;background:${BRAND.hairline};margin:32px 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 44px 44px;">
                ${inner}
              </td>
            </tr>
            <tr>
              <td style="padding:0 44px 40px;">
                <div style="height:1px;background:${BRAND.hairline};margin-bottom:20px;"></div>
                <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.8;color:${BRAND.muted};">
                  Sent by Cittàcico. If this was not you, no action is needed and you may
                  disregard this message.
                </p>
                <p style="margin:12px 0 0;font-family:${SANS};font-size:11px;color:${BRAND.muted};">
                  © 2026 Cittàcico. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:26px;font-weight:400;
                     color:${BRAND.ink};">${text}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.75;
                    color:${BRAND.ink};">${text}</p>`;
}

function fallbackLink(href: string): string {
  return `
    <p style="margin:24px 0 0;font-family:${SANS};font-size:11px;line-height:1.7;color:${BRAND.muted};">
      If the button does not open, paste this address into your browser:<br />
      <span style="color:${BRAND.gold};word-break:break-all;">${escapeHtml(href)}</span>
    </p>`;
}

interface TemplateInput {
  actionUrl: string;
  token: string;
}

export function renderAuthEmail(
  kind: AuthEmailKind,
  { actionUrl, token }: TemplateInput,
): { subject: string; html: string } {
  switch (kind) {
    case "signup":
      return {
        subject: "Confirm your Cittàcico account",
        html: layout(
          "Confirm your email to open your Cittàcico account.",
          heading("Welcome to the house") +
            paragraph(
              "Confirm this address and your registry will be opened — your bag kept " +
                "between visits, and every acquisition held on record.",
            ) +
            button(actionUrl, "Confirm my email") +
            codeBlock(token) +
            fallbackLink(actionUrl),
        ),
      };

    case "recovery":
      return {
        subject: "Reset your Cittàcico password",
        html: layout(
          "A link to choose a new password for your Cittàcico account.",
          heading("A new password") +
            paragraph(
              "Choose a new password for your account using the link below. It may " +
                "be used once, and expires shortly.",
            ) +
            button(actionUrl, "Choose a new password") +
            codeBlock(token) +
            fallbackLink(actionUrl),
        ),
      };

    case "magiclink":
      return {
        subject: "Your Cittàcico sign-in link",
        html: layout(
          "Your single-use link to sign in to Cittàcico.",
          heading("Sign in") +
            paragraph("This link signs you in directly. It may be used once.") +
            button(actionUrl, "Sign in") +
            codeBlock(token) +
            fallbackLink(actionUrl),
        ),
      };

    case "invite":
      return {
        subject: "You are invited to Cittàcico",
        html: layout(
          "An invitation to open a Cittàcico account.",
          heading("An invitation") +
            paragraph(
              "The house invites you to open an account. Accept below to choose a " +
                "password and begin.",
            ) +
            button(actionUrl, "Accept the invitation") +
            fallbackLink(actionUrl),
        ),
      };

    case "email_change":
      return {
        subject: "Confirm your new Cittàcico email address",
        html: layout(
          "Confirm the new address on your Cittàcico account.",
          heading("A change of address") +
            paragraph(
              "Confirm this address to attach it to your account. Until you do, the " +
                "previous address stays in place.",
            ) +
            button(actionUrl, "Confirm this address") +
            codeBlock(token) +
            fallbackLink(actionUrl),
        ),
      };

    case "reauthentication":
      return {
        subject: "Your Cittàcico verification code",
        html: layout(
          "Your verification code for Cittàcico.",
          heading("Confirm it is you") +
            paragraph("Enter this code to continue.") +
            codeBlock(token),
        ),
      };
  }
}
