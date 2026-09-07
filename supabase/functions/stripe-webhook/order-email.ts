/**
 * Order correspondence: a receipt for the client, a notice for the house.
 *
 * This file is deliberately self-contained and is deployed verbatim inside
 * both place-order and stripe-webhook. Each Edge Function is bundled on its
 * own, so a shared import across them is not available; if you change the
 * wording here, copy it to the other function too.
 *
 * Nothing in here may throw. Correspondence failing is an annoyance; an
 * order failing because correspondence failed is a lost sale.
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

export interface OrderEmailLine {
  name: string;
  collection: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderEmailShipping {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  country: string;
}

export interface OrderEmailInput {
  orderNumber: string;
  email: string;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  lines: OrderEmailLine[];
  shipping: OrderEmailShipping;
  /** True once money has actually settled, which changes the closing line. */
  paid: boolean;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function addressBlock(shipping: OrderEmailShipping): string {
  const region = [shipping.city, shipping.region, shipping.postalCode]
    .filter(Boolean).join(", ");
  return [shipping.fullName, shipping.line1, shipping.line2, region, shipping.country]
    .filter(Boolean)
    .map((part) => esc(part))
    .join("<br />");
}

function itemRows(lines: OrderEmailLine[], currency: string): string {
  return lines.map((line) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid ${BRAND.hairline};
                 font-family:${SANS};font-size:14px;color:${BRAND.ink};">
        ${esc(line.name)}
        ${
    line.collection
      ? `<br /><span style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;
                            color:${BRAND.gold};">${esc(line.collection)}</span>`
      : ""
  }
        <br /><span style="font-size:12px;color:${BRAND.muted};">Quantity ${line.quantity}</span>
      </td>
      <td align="right" style="padding:14px 0;border-bottom:1px solid ${BRAND.hairline};
                 font-family:${SANS};font-size:14px;color:${BRAND.ink};white-space:nowrap;">
        ${money(line.lineTotalCents, currency)}
      </td>
    </tr>`).join("");
}

export function renderClientReceipt(input: OrderEmailInput): string {
  const closing = input.paid
    ? "Your payment has settled. We will write again the moment your order leaves us."
    : "No payment has been taken. The house will write to you shortly to arrange " +
      "settlement and confirm despatch.";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Order ${esc(input.orderNumber)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.ground};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Your Cittàcico order ${esc(input.orderNumber)} has been received.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${BRAND.ground};padding:40px 16px;">
      <tr><td align="center">
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
            <td style="padding:36px 44px 0;">
              <h1 style="margin:0 0 14px;font-family:${SERIF};font-size:26px;font-weight:400;
                         color:${BRAND.ink};">Thank you</h1>
              <p style="margin:0 0 6px;font-family:${SANS};font-size:15px;line-height:1.75;
                        color:${BRAND.ink};">
                Your order has been received and recorded.
              </p>
              <p style="margin:0 0 28px;font-family:${SANS};font-size:12px;letter-spacing:0.16em;
                        text-transform:uppercase;color:${BRAND.gold};">
                Order ${esc(input.orderNumber)}
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemRows(input.lines, input.currency)}
                <tr>
                  <td style="padding:18px 0 0;font-family:${SANS};font-size:12px;
                             letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.muted};">
                    Delivery
                  </td>
                  <td align="right" style="padding:18px 0 0;font-family:${SANS};font-size:14px;
                             color:${BRAND.muted};">Complimentary</td>
                </tr>
                <tr>
                  <td style="padding:10px 0 0;font-family:${SANS};font-size:13px;
                             letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.ink};">
                    Total
                  </td>
                  <td align="right" style="padding:10px 0 0;font-family:${SERIF};font-size:20px;
                             color:${BRAND.ink};white-space:nowrap;">
                    ${money(input.totalCents, input.currency)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 44px 0;">
              <div style="height:1px;background:${BRAND.hairline};margin-bottom:22px;"></div>
              <p style="margin:0 0 8px;font-family:${SANS};font-size:11px;letter-spacing:0.18em;
                        text-transform:uppercase;color:${BRAND.muted};">Sent to</p>
              <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.8;
                        color:${BRAND.ink};">${addressBlock(input.shipping)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 44px 44px;">
              <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.75;
                        color:${BRAND.ink};">${closing}</p>
              <div style="height:1px;background:${BRAND.hairline};margin:26px 0 18px;"></div>
              <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.8;
                        color:${BRAND.muted};">
                Questions may be sent by replying to this message.
              </p>
              <p style="margin:10px 0 0;font-family:${SANS};font-size:11px;color:${BRAND.muted};">
                © 2026 Cittàcico. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Deliberately plain: this one is read on a phone, in a hurry. */
export function renderHouseNotice(input: OrderEmailInput): string {
  const rows = input.lines.map((line) =>
    `<tr>
       <td style="padding:6px 16px 6px 0;font-family:${SANS};font-size:14px;">
         ${line.quantity} × ${esc(line.name)}
       </td>
       <td align="right" style="padding:6px 0;font-family:${SANS};font-size:14px;">
         ${money(line.lineTotalCents, input.currency)}
       </td>
     </tr>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>New order</title></head>
  <body style="margin:0;padding:24px;background:#ffffff;font-family:${SANS};color:${BRAND.ink};">
    <h1 style="margin:0 0 4px;font-family:${SERIF};font-size:22px;font-weight:400;">
      New order — ${esc(input.orderNumber)}
    </h1>
    <p style="margin:0 0 20px;font-size:13px;color:${BRAND.muted};">
      ${input.paid ? "Paid" : "Awaiting settlement"} · ${esc(input.email)}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:460px;">
      ${rows}
      <tr>
        <td style="padding:12px 16px 0 0;border-top:1px solid ${BRAND.hairline};font-size:14px;">
          <strong>Total</strong>
        </td>
        <td align="right" style="padding:12px 0 0;border-top:1px solid ${BRAND.hairline};font-size:14px;">
          <strong>${money(input.totalCents, input.currency)}</strong>
        </td>
      </tr>
    </table>

    <h2 style="margin:24px 0 6px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;
               color:${BRAND.muted};font-weight:400;">Deliver to</h2>
    <p style="margin:0;font-size:14px;line-height:1.7;">${addressBlock(input.shipping)}</p>
  </body>
</html>`;
}

async function send(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!response.ok) {
    throw new Error(`resend ${response.status}: ${await response.text()}`);
  }
}

/**
 * Writes to the client, and to the house if HOUSE_EMAIL is set. Resolves
 * even when delivery fails; the failure is logged and nothing else.
 */
export async function sendOrderEmails(input: OrderEmailInput): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return; // Correspondence not configured yet.

  const from = Deno.env.get("EMAIL_FROM") ?? "CITTÀCICO <onboarding@resend.dev>";
  const house = Deno.env.get("HOUSE_EMAIL");

  const results = await Promise.allSettled([
    send(
      apiKey,
      from,
      input.email,
      `Your Cittàcico order ${input.orderNumber}`,
      renderClientReceipt(input),
    ),
    house
      ? send(
        apiKey,
        from,
        house,
        `New order ${input.orderNumber} — ${money(input.totalCents, input.currency)}`,
        renderHouseNotice(input),
      )
      : Promise.resolve(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("order email failed", result.reason);
    }
  }
}
