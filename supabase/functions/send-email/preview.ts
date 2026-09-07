/**
 * Renders every auth email to email-previews/ so the wording and styling can
 * be reviewed in a browser without sending anything.
 *
 *   deno run --allow-write --allow-read supabase/functions/send-email/preview.ts
 */

import { type AuthEmailKind, renderAuthEmail } from "./templates.ts";
import {
  type OrderEmailInput,
  renderClientReceipt,
  renderHouseNotice,
} from "../place-order/order-email.ts";

const KINDS: AuthEmailKind[] = [
  "signup",
  "recovery",
  "magiclink",
  "invite",
  "email_change",
  "reauthentication",
];

const outDir = new URL("../../../email-previews/", import.meta.url);
await Deno.mkdir(outDir, { recursive: true });

for (const kind of KINDS) {
  const { subject, html } = renderAuthEmail(kind, {
    actionUrl:
      "https://kivqswpbadoiucuvwpzm.supabase.co/auth/v1/verify?token=example-token" +
      "&type=" + kind + "&redirect_to=https://www.cittacico.com/account.html",
    token: "418902",
  });

  await Deno.writeTextFile(new URL(`${kind}.html`, outDir), html);
  console.log(kind.padEnd(18), subject);
}

const sampleOrder: OrderEmailInput = {
  orderNumber: "CC-100418",
  email: "client@example.com",
  currency: "USD",
  subtotalCents: 268000,
  totalCents: 268000,
  lines: [
    {
      name: "Cashmere Opera Coat",
      collection: "Atelier",
      quantity: 1,
      unitPriceCents: 198000,
      lineTotalCents: 198000,
    },
    {
      name: "Silk Charmeuse Scarf",
      collection: "Accessories",
      quantity: 2,
      unitPriceCents: 35000,
      lineTotalCents: 70000,
    },
  ],
  shipping: {
    fullName: "Eleanora Vance",
    line1: "412 West 14th Street",
    line2: "Apartment 6B",
    city: "New York",
    region: "NY",
    postalCode: "10014",
    country: "United States",
  },
  paid: false,
};

await Deno.writeTextFile(
  new URL("order-receipt.html", outDir),
  renderClientReceipt(sampleOrder),
);
await Deno.writeTextFile(
  new URL("order-house-notice.html", outDir),
  renderHouseNotice(sampleOrder),
);
console.log("order-receipt      Your Cittàcico order CC-100418");
console.log("order-house-notice New order CC-100418");

console.log("\nWritten to email-previews/");
