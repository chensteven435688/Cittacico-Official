/**
 * stripe-webhook
 *
 * Stripe tells us here, server to server, whether money actually moved. The
 * browser's return trip to payment-success.html is only a courtesy; this is
 * the single place an order is marked paid.
 *
 * Deployed with verify_jwt = false because Stripe cannot present a Supabase
 * JWT. Authentication is the Stripe signature check below, which rejects any
 * request not signed with STRIPE_WEBHOOK_SECRET.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^22";

import { sendOrderEmails } from "./order-email.ts";

/* Deno needs the Web Crypto provider for asynchronous signature checks. */
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function findOrder(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;

  const { data } = orderId
    ? await admin
      .from("orders")
      .select("id, user_id, payment_status")
      .eq("id", orderId)
      .maybeSingle()
    : await admin
      .from("orders")
      .select("id, user_id, payment_status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

  return data;
}

/** Reads the settled order back out of the database and writes the receipt. */
async function sendReceipt(orderId: string): Promise<void> {
  const { data: order } = await admin
    .from("orders")
    /* One unbroken literal: postgrest-js infers the row type from the text of
       this string, and a concatenation collapses it to an untyped result. */
    .select(`
      order_number, email, currency, subtotal_cents, total_cents,
      ship_full_name, ship_line1, ship_line2, ship_city, ship_region,
      ship_postal_code, ship_country
    `)
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const { data: items } = await admin
    .from("order_items")
    .select("product_name, product_collection, quantity, unit_price_cents, line_total_cents")
    .eq("order_id", orderId);

  await sendOrderEmails({
    orderNumber: order.order_number,
    email: order.email,
    currency: order.currency,
    subtotalCents: order.subtotal_cents,
    totalCents: order.total_cents,
    lines: (items ?? []).map((item) => ({
      name: item.product_name,
      collection: item.product_collection,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    })),
    shipping: {
      fullName: order.ship_full_name,
      line1: order.ship_line1,
      line2: order.ship_line2,
      city: order.ship_city,
      region: order.ship_region,
      postalCode: order.ship_postal_code,
      country: order.ship_country,
    },
    paid: true,
  });
}

Deno.serve(async (req: Request) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  /* Built per request, not at module load: the Stripe client throws on an
     empty key, which would take the whole function down before payments
     are configured. */
  if (!stripeKey || !secret) {
    return new Response("Payments are not configured.", { status: 503 });
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("Missing signature.", { status: 400 });
  }

  const stripe = new Stripe(stripeKey);

  /* The raw body is required: verification runs over the exact bytes sent. */
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      secret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error("signature verification failed", error);
    return new Response("Invalid signature.", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const order = await findOrder(session);
        if (!order) {
          console.error("no order matched session", session.id);
          break;
        }

        /* Stripe retries on any non-2xx, and a delayed payment method fires
           both events. Noting the prior state keeps the receipt to one. */
        const alreadySettled = order.payment_status === "paid";

        await admin
          .from("orders")
          .update({
            payment_status: "paid",
            status: "confirmed",
            stripe_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          })
          .eq("id", order.id);

        /* Paid, so the bag has served its purpose. */
        if (order.user_id) {
          await admin.from("cart_items").delete().eq("user_id", order.user_id);
        }

        if (!alreadySettled) await sendReceipt(order.id);
        break;
      }

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const order = await findOrder(session);
        /* Never overwrite a payment that already settled. */
        if (!order || order.payment_status === "paid") break;

        await admin
          .from("orders")
          .update({
            payment_status: event.type === "checkout.session.expired"
              ? "unpaid"
              : "failed",
            status: "cancelled",
          })
          .eq("id", order.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntent = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
        if (!paymentIntent) break;

        await admin
          .from("orders")
          .update({ payment_status: "refunded", status: "refunded" })
          .eq("stripe_payment_intent_id", paymentIntent);
        break;
      }

      default:
        /* Everything else is acknowledged so Stripe stops retrying. */
        break;
    }
  } catch (error) {
    console.error("webhook handling failed", event.type, error);
    /* A 500 asks Stripe to retry, which is what we want on a transient fault. */
    return new Response("Handler failed.", { status: 500 });
  }

  return Response.json({ received: true });
});
