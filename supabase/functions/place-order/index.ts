/**
 * place-order
 *
 * The only path by which a row may enter `public.orders`. The browser sends
 * slugs and quantities; every price, name and total is re-read from the
 * catalogue here, so a tampered payload cannot buy a coat for one dollar.
 *
 * When STRIPE_SECRET_KEY is configured the same validated totals are handed to
 * a Stripe Checkout Session and the client is sent there to pay. Without that
 * secret the order is still recorded, simply as pending and unpaid, so the
 * boutique keeps working before payments are switched on.
 *
 * Accepts both guest checkouts and signed-in clients.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^22";

import { sendOrderEmails } from "./order-email.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_QUANTITY_PER_LINE = 25;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_SITE_URL = "https://www.cittacico.com";
/* Return addresses are never taken from the payload unchecked, or the
   checkout would become an open redirect. */
const ALLOWED_ORIGINS = [
  "https://www.cittacico.com",
  "https://cittacico.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5500",
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function text(value: unknown, limit = 300): string {
  return String(value ?? "").trim().slice(0, limit);
}

function siteOrigin(req: Request): string {
  const origin = req.headers.get("Origin") ?? "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) return origin;
  return Deno.env.get("SITE_URL") ?? DEFAULT_SITE_URL;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  /* ---------- who is ordering ---------- */
  let userId: string | null = null;
  let accountEmail: string | null = null;
  const bearer = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (bearer && bearer.split(".").length === 3) {
    const { data } = await admin.auth.getUser(bearer);
    if (data?.user) {
      userId = data.user.id;
      accountEmail = data.user.email ?? null;
    }
  }

  /* ---------- what they asked for ---------- */
  const requested = new Map<string, number>();
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  for (const raw of rawItems as Array<Record<string, unknown>>) {
    const slug = text(raw?.slug, 120);
    const quantity = Math.floor(Number(raw?.quantity ?? 0));
    if (!slug || !Number.isFinite(quantity) || quantity < 1) continue;
    const total = (requested.get(slug) ?? 0) + quantity;
    requested.set(slug, Math.min(total, MAX_QUANTITY_PER_LINE));
  }
  if (requested.size === 0) {
    return json({ error: "Your bag is empty." }, 400);
  }

  const email = text(payload.email, 200).toLowerCase() ||
    (accountEmail ?? "").toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return json({ error: "A valid email address is required." }, 400);
  }

  const shipping = (payload.shipping ?? {}) as Record<string, unknown>;
  const shipFullName = text(shipping.fullName, 200);
  const shipLine1 = text(shipping.line1, 200);
  const shipCity = text(shipping.city, 120);
  const shipCountry = text(shipping.country, 120);
  if (!shipFullName || !shipLine1 || !shipCity || !shipCountry) {
    return json({
      error: "A delivery name, street, city and country are required.",
    }, 400);
  }

  /* ---------- authoritative prices ---------- */
  const { data: products, error: catalogueError } = await admin
    .from("products")
    .select(
      "id, slug, name, collection, description, price_cents, currency, track_inventory, stock_quantity",
    )
    .in("slug", [...requested.keys()])
    .eq("status", "active");

  if (catalogueError) {
    console.error("catalogue lookup failed", catalogueError);
    return json({ error: "The boutique could not price your bag." }, 500);
  }

  const bySlug = new Map(products?.map((p) => [p.slug, p]) ?? []);
  const unavailable = [...requested.keys()].filter((s) => !bySlug.has(s));
  if (unavailable.length > 0) {
    return json({
      error: "Some pieces are no longer available.",
      unavailable,
    }, 409);
  }

  const outOfStock: string[] = [];
  const lines = [...requested.entries()].map(([slug, quantity]) => {
    const product = bySlug.get(slug)!;
    if (product.track_inventory && product.stock_quantity < quantity) {
      outOfStock.push(product.name);
    }
    return {
      product,
      quantity,
      lineTotal: product.price_cents * quantity,
    };
  });

  if (outOfStock.length > 0) {
    return json({ error: "Insufficient stock.", outOfStock }, 409);
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shippingCents = 0; // Complimentary worldwide delivery.
  const taxCents = 0; // Calculated at fulfilment.
  const currency = lines[0].product.currency ?? "USD";

  /* ---------- record it ---------- */
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      email,
      status: "pending",
      payment_status: "unpaid",
      currency,
      subtotal_cents: subtotal,
      shipping_cents: shippingCents,
      tax_cents: taxCents,
      total_cents: subtotal + shippingCents + taxCents,
      ship_full_name: shipFullName,
      ship_line1: shipLine1,
      ship_line2: text(shipping.line2, 200) || null,
      ship_city: shipCity,
      ship_region: text(shipping.region, 120) || null,
      ship_postal_code: text(shipping.postalCode, 40) || null,
      ship_country: shipCountry,
      ship_phone: text(shipping.phone, 40) || null,
      customer_note: text(payload.customerNote, 1000) || null,
      marketing_opt_in: payload.marketingOptIn === true,
    })
    .select("id, order_number, total_cents, currency, placed_at")
    .single();

  if (orderError || !order) {
    console.error("order insert failed", orderError);
    return json({ error: "The order could not be recorded." }, 500);
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    lines.map((line) => ({
      order_id: order.id,
      product_id: line.product.id,
      product_slug: line.product.slug,
      product_name: line.product.name,
      product_collection: line.product.collection,
      unit_price_cents: line.product.price_cents,
      quantity: line.quantity,
      line_total_cents: line.lineTotal,
    })),
  );

  if (itemsError) {
    console.error("order items insert failed", itemsError);
    await admin.from("orders").delete().eq("id", order.id);
    return json({ error: "The order could not be recorded." }, 500);
  }

  /* ---------- hand the total to Stripe ---------- */
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  let checkoutUrl: string | null = null;

  if (stripeKey) {
    const stripe = new Stripe(stripeKey);
    const origin = siteOrigin(req);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        client_reference_id: order.id,
        /* The webhook trusts only this, never the browser's return trip. */
        metadata: { order_id: order.id, order_number: order.order_number },
        success_url: origin + "/payment-success.html",
        cancel_url: origin + "/payment-failure.html",
        line_items: lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: line.product.price_cents,
            product_data: {
              name: line.product.name,
              description: line.product.description ?? undefined,
            },
          },
        })),
      });

      checkoutUrl = session.url;
      await admin
        .from("orders")
        .update({ stripe_session_id: session.id })
        .eq("id", order.id);
    } catch (stripeError) {
      console.error("stripe session failed", stripeError);
      /* Leave no phantom order behind if the client never reaches Stripe. */
      await admin.from("orders").delete().eq("id", order.id);
      return json({ error: "Payment could not be opened. Please try again." }, 502);
    }
  }

  for (const line of lines) {
    if (!line.product.track_inventory) continue;
    await admin.rpc("decrement_product_stock", {
      p_product_id: line.product.id,
      p_quantity: line.quantity,
    });
  }

  /* With Stripe in play the bag is cleared by the webhook, once paid, so an
     abandoned checkout leaves the client's selection intact. */
  if (userId && !checkoutUrl) {
    await admin.from("cart_items").delete().eq("user_id", userId);
  }

  /* The receipt goes out only when the order is already final. With Stripe in
     play the client is still on their way to pay, so the webhook writes to
     them instead, once the money has actually settled. */
  if (!checkoutUrl) {
    await sendOrderEmails({
      orderNumber: order.order_number,
      email,
      currency: order.currency,
      subtotalCents: subtotal,
      totalCents: order.total_cents,
      lines: lines.map((line) => ({
        name: line.product.name,
        collection: line.product.collection,
        quantity: line.quantity,
        unitPriceCents: line.product.price_cents,
        lineTotalCents: line.lineTotal,
      })),
      shipping: {
        fullName: shipFullName,
        line1: shipLine1,
        line2: text(shipping.line2, 200) || null,
        city: shipCity,
        region: text(shipping.region, 120) || null,
        postalCode: text(shipping.postalCode, 40) || null,
        country: shipCountry,
      },
      paid: false,
    });
  }

  return json({
    checkoutUrl,
    order: {
      id: order.id,
      orderNumber: order.order_number,
      email,
      currency: order.currency,
      subtotalCents: subtotal,
      shippingCents,
      taxCents,
      totalCents: order.total_cents,
      placedAt: order.placed_at,
      items: lines.map((line) => ({
        slug: line.product.slug,
        name: line.product.name,
        collection: line.product.collection,
        quantity: line.quantity,
        unitPriceCents: line.product.price_cents,
        lineTotalCents: line.lineTotal,
      })),
    },
  }, 201);
});
