/*
 * CITTÀCICO backend layer.
 *
 * Sits between the Supabase project and the storefront in main.js. Owns the
 * session, the catalogue, the server-side bag, and order placement, and
 * exposes all of it on window.CITTACICO.
 *
 * Loaded after the supabase-js UMD bundle and before main.js.
 */
(function () {
  "use strict";

  const config = window.CITTACICO_SUPABASE || {};
  const hasSupabase = Boolean(window.supabase && config.url && config.publishableKey);

  const client = hasSupabase
    ? window.supabase.createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  const CART_KEY = "cittacico-cart-v1";
  const listeners = {};

  const state = {
    session: null,
    profile: null,
    isAdmin: false,
    products: [],
    productsBySlug: new Map(),
    online: hasSupabase
  };

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  function on(event, handler) {
    (listeners[event] = listeners[event] || []).push(handler);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(function (handler) {
      try {
        handler(payload);
      } catch (error) {
        console.error("CITTACICO listener failed for " + event, error);
      }
    });
  }

  function readLocalCart() {
    try {
      return JSON.parse(window.localStorage.getItem(CART_KEY)) || [];
    } catch (error) {
      return [];
    }
  }

  function writeLocalCart(cart) {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    if (window.CITTACICO_APP && window.CITTACICO_APP.refreshBag) {
      window.CITTACICO_APP.refreshBag();
    }
  }

  /* The storefront thinks in whole dollars; the database stores minor units. */
  function toStorefrontProduct(row) {
    return {
      id: row.id,
      slug: row.slug,
      category: row.category,
      collection: row.collection || "",
      name: row.name,
      price: row.price_cents / 100,
      priceCents: row.price_cents,
      currency: row.currency || "USD",
      description: row.description || "",
      material: row.material || "",
      tone: row.tone || "",
      details: row.details || "",
      number: row.number || "",
      status: row.status,
      trackInventory: row.track_inventory,
      stockQuantity: row.stock_quantity,
      sortOrder: row.sort_order
    };
  }

  /* ------------------------------------------------------------------ *
   * Catalogue
   * ------------------------------------------------------------------ */

  async function loadCatalogue() {
    if (!client) return state.products;

    const { data, error } = await client
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      /* Leave the bundled catalogue in place so the boutique still renders. */
      console.error("Catalogue load failed, using the bundled copy.", error);
      return state.products;
    }

    state.products = (data || []).map(toStorefrontProduct);
    state.productsBySlug = new Map(
      state.products.map(function (product) {
        return [product.slug, product];
      })
    );

    if (window.CITTACICO_APP && window.CITTACICO_APP.setProducts) {
      window.CITTACICO_APP.setProducts(state.products);
    }
    emit("catalogue", state.products);
    return state.products;
  }

  /* ------------------------------------------------------------------ *
   * Session
   * ------------------------------------------------------------------ */

  async function loadProfile() {
    if (!client || !state.session) {
      state.profile = null;
      state.isAdmin = false;
      return null;
    }

    const userId = state.session.user.id;

    const [profileResult, adminResult] = await Promise.all([
      client.from("profiles").select("*").eq("id", userId).maybeSingle(),
      client.from("admins").select("user_id").eq("user_id", userId).maybeSingle()
    ]);

    state.profile = profileResult.data || null;
    state.isAdmin = Boolean(adminResult.data);
    return state.profile;
  }

  async function signUp(details) {
    if (!client) throw new Error("The boutique is offline.");

    const { data, error } = await client.auth.signUp({
      email: details.email,
      password: details.password,
      options: {
        /* Read by the on-signup trigger to populate the profile row. */
        data: {
          full_name: details.fullName || "",
          birthday: details.birthday || "",
          sex: details.sex || "",
          region: details.region || "",
          phone: details.phone || "",
          marketing_opt_in: details.marketingOptIn === true
        }
      }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    if (!client) throw new Error("The boutique is offline.");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function sendPasswordReset(email) {
    if (!client) throw new Error("The boutique is offline.");
    const redirectTo = new URL("account.html", window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    /* A shared device must not keep the previous client's bag on screen. */
    writeLocalCart([]);
  }

  async function updateProfile(patch) {
    if (!client || !state.session) throw new Error("Please sign in first.");
    const { data, error } = await client
      .from("profiles")
      .update(patch)
      .eq("id", state.session.user.id)
      .select()
      .single();
    if (error) throw error;
    state.profile = data;
    return data;
  }

  /* ------------------------------------------------------------------ *
   * Bag, mirrored to the database for signed-in clients
   * ------------------------------------------------------------------ */

  function productIdForSlug(slug) {
    const product = state.productsBySlug.get(slug);
    return product ? product.id : null;
  }

  async function loadServerCart() {
    if (!client || !state.session) return null;

    const { data, error } = await client
      .from("cart_items")
      .select("quantity, products(slug, name, collection, price_cents)")
      .eq("user_id", state.session.user.id);

    if (error) {
      console.error("Bag load failed.", error);
      return null;
    }

    return (data || [])
      .filter(function (row) {
        return row.products;
      })
      .map(function (row) {
        return {
          slug: row.products.slug,
          name: row.products.name,
          category: row.products.collection,
          price: row.products.price_cents / 100,
          quantity: row.quantity
        };
      });
  }

  async function pushCart(cart) {
    if (!client || !state.session) return;
    const userId = state.session.user.id;

    const rows = cart
      .map(function (item) {
        const productId = productIdForSlug(item.slug);
        return productId
          ? { user_id: userId, product_id: productId, quantity: item.quantity }
          : null;
      })
      .filter(Boolean);

    if (rows.length) {
      const { error } = await client
        .from("cart_items")
        .upsert(rows, { onConflict: "user_id,product_id" });
      if (error) console.error("Bag save failed.", error);
    }

    /* Drop anything the client removed since the last save. */
    const keep = rows.map(function (row) {
      return row.product_id;
    });
    let removal = client.from("cart_items").delete().eq("user_id", userId);
    if (keep.length) removal = removal.not("product_id", "in", "(" + keep.join(",") + ")");
    const { error: removalError } = await removal;
    if (removalError) console.error("Bag cleanup failed.", removalError);
  }

  /* Signing in on a new device should add to the saved bag, not replace it. */
  async function mergeCartOnSignIn() {
    const local = readLocalCart();
    const server = (await loadServerCart()) || [];

    const merged = new Map();
    server.forEach(function (item) {
      merged.set(item.slug, Object.assign({}, item));
    });
    local.forEach(function (item) {
      const existing = merged.get(item.slug);
      if (existing) existing.quantity = Math.max(existing.quantity, item.quantity);
      else merged.set(item.slug, Object.assign({}, item));
    });

    const cart = Array.from(merged.values());
    writeLocalCart(cart);
    await pushCart(cart);
    return cart;
  }

  let cartSaveTimer = null;
  function scheduleCartSave() {
    if (!state.session) return;
    window.clearTimeout(cartSaveTimer);
    cartSaveTimer = window.setTimeout(function () {
      pushCart(readLocalCart());
    }, 600);
  }

  /* ------------------------------------------------------------------ *
   * Orders
   * ------------------------------------------------------------------ */

  async function placeOrder(payload) {
    if (!client) throw new Error("The boutique is offline.");

    const { data, error } = await client.functions.invoke("place-order", {
      body: payload
    });

    if (error) {
      /* Edge function errors carry the useful message in the response body. */
      let message = "The order could not be completed.";
      try {
        const body = await error.context.json();
        if (body && body.error) message = body.error;
      } catch (parseError) {
        /* Fall through to the generic message. */
      }
      throw new Error(message);
    }

    /* The bag is cleared by the caller once the client is actually paid up,
       so abandoning Stripe leaves the selection intact. */
    return data;
  }

  async function listMyOrders() {
    if (!client || !state.session) return [];
    const { data, error } = await client
      .from("orders")
      .select("*, order_items(*)")
      .order("placed_at", { ascending: false });
    if (error) {
      console.error("Order history failed to load.", error);
      return [];
    }
    return data || [];
  }

  /* ------------------------------------------------------------------ *
   * Account link in the header
   * ------------------------------------------------------------------ */

  function renderAccountNav() {
    const label = state.session
      ? state.isAdmin
        ? "Back office"
        : "My account"
      : "Sign in";
    const href = state.session && state.isAdmin ? "admin.html" : "account.html";

    const utilLinks = document.querySelector(".header-util-links");
    if (utilLinks) {
      let link = utilLinks.querySelector(".header-util-account");
      if (!link) {
        link = document.createElement("a");
        link.className = "header-util-account";
        utilLinks.insertBefore(link, utilLinks.firstChild);
      }
      link.href = href;
      link.textContent = label;
    }

    const mobileInner = document.querySelector(".mobile-overlay-inner");
    if (mobileInner) {
      let group = mobileInner.querySelector(".mobile-account-row");
      if (!group) {
        group = document.createElement("div");
        group.className = "mobile-nav-group mobile-account-row";
        mobileInner.appendChild(group);
      }
      group.innerHTML = '<a class="mobile-nav-cta" href="' + href + '">' + label + "</a>";
    }
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  async function applySession(session, event) {
    state.session = session || null;
    await loadProfile();
    renderAccountNav();

    if (event === "SIGNED_IN" && state.session) {
      await mergeCartOnSignIn();
    }

    emit("session", {
      session: state.session,
      profile: state.profile,
      isAdmin: state.isAdmin
    });
  }

  const ready = (async function boot() {
    if (!client) {
      console.warn("Supabase is unavailable; running on the bundled catalogue.");
      renderAccountNav();
      return state;
    }

    const { data } = await client.auth.getSession();
    await applySession(data.session, "INITIAL");
    await loadCatalogue();

    /* After the catalogue, because merging maps slugs onto product ids. */
    if (state.session) await mergeCartOnSignIn();

    client.auth.onAuthStateChange(function (event, session) {
      const changed = (session && session.user.id) !== (state.session && state.session.user.id);
      if (event === "SIGNED_OUT" || changed) {
        applySession(session, event);
      } else {
        state.session = session;
      }
    });

    return state;
  })();

  window.CITTACICO = {
    client: client,
    ready: ready,
    state: state,
    on: on,

    isOnline: function () {
      return Boolean(client);
    },
    paymentsEnabled: function () {
      return config.paymentsEnabled === true;
    },
    getSession: function () {
      return state.session;
    },
    getUser: function () {
      return state.session ? state.session.user : null;
    },
    getProfile: function () {
      return state.profile;
    },
    isAdmin: function () {
      return state.isAdmin;
    },
    getProducts: function () {
      return state.products;
    },

    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    sendPasswordReset: sendPasswordReset,
    updateProfile: updateProfile,
    loadProfile: loadProfile,
    loadCatalogue: loadCatalogue,

    scheduleCartSave: scheduleCartSave,
    pushCart: pushCart,
    placeOrder: placeOrder,
    listMyOrders: listMyOrders
  };
})();
