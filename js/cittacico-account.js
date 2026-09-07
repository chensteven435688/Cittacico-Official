/*
 * Client account page: sign in, registration, personal details, default
 * delivery address, and the full order history.
 */
(function () {
  "use strict";

  const page = document.querySelector("[data-account-page]");
  if (!page || !window.CITTACICO) return;

  const backend = window.CITTACICO;
  const loadingEl = page.querySelector("[data-account-loading]");
  const gateEl = page.querySelector("[data-account-auth]");
  const dashboardEl = page.querySelector("[data-account-dashboard]");

  const STATUS_LABELS = {
    pending: "Awaiting confirmation",
    confirmed: "Confirmed",
    processing: "In the atelier",
    shipped: "Despatched",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded"
  };

  function money(cents, currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2
    }).format((cents || 0) / 100);
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function say(el, message, tone) {
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
    el.classList.toggle("is-error", tone === "error");
    el.classList.toggle("is-success", tone === "success");
  }

  function busy(form, isBusy, label) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (isBusy) {
      button.dataset.idleLabel = button.dataset.idleLabel || button.textContent;
      button.disabled = true;
      button.textContent = label || "Working…";
    } else {
      button.disabled = false;
      button.textContent = button.dataset.idleLabel || button.textContent;
    }
  }

  /* ------------------------------------------------------------------ *
   * Signed out
   * ------------------------------------------------------------------ */

  const signInForm = page.querySelector("[data-signin-form]");
  const signInMessage = page.querySelector("[data-signin-message]");

  signInForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!signInForm.reportValidity()) return;

    const data = new FormData(signInForm);
    say(signInMessage, "");
    busy(signInForm, true, "Signing in…");

    try {
      await backend.signIn(
        String(data.get("email")).trim(),
        String(data.get("password"))
      );
      window.location.reload();
    } catch (error) {
      busy(signInForm, false);
      say(signInMessage, error.message || "Those details were not recognised.", "error");
    }
  });

  page.querySelector("[data-reset-password]").addEventListener("click", async function () {
    const email = String(new FormData(signInForm).get("email") || "").trim();
    if (!email) {
      say(signInMessage, "Enter your email above, then ask again.", "error");
      return;
    }
    try {
      await backend.sendPasswordReset(email);
      say(signInMessage, "A reset link is on its way to " + email + ".", "success");
    } catch (error) {
      say(signInMessage, error.message || "The reset could not be sent.", "error");
    }
  });

  const signUpForm = page.querySelector("[data-signup-form]");
  const signUpMessage = page.querySelector("[data-signup-message]");

  signUpForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!signUpForm.reportValidity()) return;

    const data = new FormData(signUpForm);
    say(signUpMessage, "");
    busy(signUpForm, true, "Creating…");

    try {
      const result = await backend.signUp({
        email: String(data.get("email")).trim(),
        password: String(data.get("password")),
        fullName: String(data.get("fullName") || "").trim(),
        birthday: String(data.get("birthday") || ""),
        sex: String(data.get("sex") || ""),
        region: String(data.get("region") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        marketingOptIn: data.get("marketingOptIn") === "yes"
      });

      if (result.session) {
        window.location.reload();
        return;
      }
      /* Email confirmation is switched on for this project. */
      busy(signUpForm, false);
      say(
        signUpMessage,
        "Your account is created. Confirm the link we sent to " +
          String(data.get("email")).trim() +
          " to sign in.",
        "success"
      );
      signUpForm.reset();
    } catch (error) {
      busy(signUpForm, false);
      say(signUpMessage, error.message || "The account could not be created.", "error");
    }
  });

  /* ------------------------------------------------------------------ *
   * Signed in
   * ------------------------------------------------------------------ */

  const profileForm = page.querySelector("[data-profile-form]");
  const profileMessage = page.querySelector("[data-profile-message]");

  function fillProfileForm(profile) {
    if (!profile) return;
    profileForm.elements.full_name.value = profile.full_name || "";
    profileForm.elements.birthday.value = profile.birthday || "";
    profileForm.elements.sex.value = profile.sex || "";
    profileForm.elements.region.value = profile.region || "";
    profileForm.elements.phone.value = profile.phone || "";
    profileForm.elements.marketing_opt_in.checked = Boolean(profile.marketing_opt_in);
  }

  profileForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(profileForm);
    say(profileMessage, "");
    busy(profileForm, true, "Saving…");

    try {
      const saved = await backend.updateProfile({
        full_name: String(data.get("full_name") || "").trim() || null,
        birthday: String(data.get("birthday") || "") || null,
        sex: String(data.get("sex") || "") || null,
        region: String(data.get("region") || "").trim() || null,
        phone: String(data.get("phone") || "").trim() || null,
        marketing_opt_in: profileForm.elements.marketing_opt_in.checked
      });
      fillProfileForm(saved);
      busy(profileForm, false);
      say(profileMessage, "Your details are saved.", "success");
    } catch (error) {
      busy(profileForm, false);
      say(profileMessage, error.message || "Your details could not be saved.", "error");
    }
  });

  const addressForm = page.querySelector("[data-address-form]");
  const addressMessage = page.querySelector("[data-address-message]");
  let defaultAddressId = null;

  async function loadDefaultAddress() {
    const { data, error } = await backend.client
      .from("addresses")
      .select("*")
      .eq("is_default", true)
      .maybeSingle();
    if (error || !data) return;

    defaultAddressId = data.id;
    ["full_name", "line1", "line2", "city", "region", "postal_code", "country"].forEach(
      function (field) {
        addressForm.elements[field].value = data[field] || "";
      }
    );
  }

  addressForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!addressForm.reportValidity()) return;

    const data = new FormData(addressForm);
    const record = {
      user_id: backend.getUser().id,
      full_name: String(data.get("full_name")).trim(),
      line1: String(data.get("line1")).trim(),
      line2: String(data.get("line2") || "").trim() || null,
      city: String(data.get("city")).trim(),
      region: String(data.get("region") || "").trim() || null,
      postal_code: String(data.get("postal_code") || "").trim() || null,
      country: String(data.get("country")).trim(),
      is_default: true
    };

    say(addressMessage, "");
    busy(addressForm, true, "Saving…");

    try {
      const query = defaultAddressId
        ? backend.client.from("addresses").update(record).eq("id", defaultAddressId)
        : backend.client.from("addresses").insert(record);
      const { data: saved, error } = await query.select().single();
      if (error) throw error;

      defaultAddressId = saved.id;
      busy(addressForm, false);
      say(addressMessage, "Your address is saved.", "success");
    } catch (error) {
      busy(addressForm, false);
      say(addressMessage, error.message || "The address could not be saved.", "error");
    }
  });

  page.querySelector("[data-signout]").addEventListener("click", async function () {
    await backend.signOut();
    window.location.href = "index.html";
  });

  /* ------------------------------------------------------------------ *
   * Order history
   * ------------------------------------------------------------------ */

  function renderOrders(orders) {
    const root = page.querySelector("[data-account-orders]");

    if (!orders.length) {
      root.innerHTML =
        '<p class="account-empty">No acquisitions yet. ' +
        '<a class="link-gold" href="shop.html">Begin shopping</a>.</p>';
      return;
    }

    root.innerHTML = orders
      .map(function (order) {
        const lines = (order.order_items || [])
          .map(function (line) {
            return (
              '<li><span class="account-order-line-name">' +
              escapeHtml(line.product_name) +
              " × " +
              line.quantity +
              '</span><span>' +
              money(line.line_total_cents, order.currency) +
              "</span></li>"
            );
          })
          .join("");

        const shipTo = [order.ship_city, order.ship_country].filter(Boolean).join(", ");

        return (
          '<article class="account-order">' +
          '<header class="account-order-head">' +
          "<div>" +
          '<p class="account-order-number">' +
          escapeHtml(order.order_number) +
          "</p>" +
          '<p class="account-order-date">' +
          formatDate(order.placed_at) +
          (shipTo ? " · " + escapeHtml(shipTo) : "") +
          "</p>" +
          "</div>" +
          '<span class="account-status account-status--' +
          order.status +
          '">' +
          (STATUS_LABELS[order.status] || order.status) +
          "</span>" +
          "</header>" +
          '<ul class="account-order-lines">' +
          lines +
          "</ul>" +
          '<footer class="account-order-foot"><span>Total</span><strong>' +
          money(order.total_cents, order.currency) +
          "</strong></footer>" +
          "</article>"
        );
      })
      .join("");
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  backend.ready.then(async function () {
    if (loadingEl) loadingEl.hidden = true;

    if (!backend.getSession()) {
      gateEl.hidden = false;
      return;
    }

    dashboardEl.hidden = false;

    const profile = backend.getProfile();
    const greeting = page.querySelector("[data-account-greeting]");
    const name = (profile && profile.full_name) || backend.getUser().email;
    greeting.textContent = "Welcome, " + name + ".";

    if (backend.isAdmin()) {
      page.querySelector("[data-account-admin-link]").hidden = false;
    }

    fillProfileForm(profile);

    const [orders] = await Promise.all([backend.listMyOrders(), loadDefaultAddress()]);
    renderOrders(orders);
  });
})();
