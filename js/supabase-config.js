/*
 * Supabase connection details for the CITTÀCICO storefront.
 *
 * The publishable key is meant to travel to the browser. It grants nothing on
 * its own: every table is protected by row level security, so this key can
 * only read the active catalogue and act on the signed-in client's own rows.
 *
 * The service role key must never appear in this repository.
 */
window.CITTACICO_SUPABASE = {
  url: "https://kivqswpbadoiucuvwpzm.supabase.co",
  publishableKey: "sb_publishable_ZeNdEAXSlzClH8AMIUVI8A_DkRuH3Is",

  /*
   * Payments are built and deployed but deliberately dormant: the house has
   * no merchant account yet, so checkout records an order and stops there.
   *
   * To take payment, do both of these — neither alone is enough:
   *   1. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET under
   *      Supabase, Edge Functions, Secrets.
   *   2. Change the line below to true.
   *
   * This flag only decides what the checkout page says. The server refuses
   * to charge anyone until the Stripe secret genuinely exists, so setting
   * this to true on its own cannot take money by mistake.
   */
  paymentsEnabled: false
};
