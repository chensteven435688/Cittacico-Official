/*
 * CITTÀCICO back office.
 *
 * Everything here is additionally enforced in the database: an account that is
 * not in public.admins simply reads and writes nothing, whatever this page
 * chooses to display.
 */
(function () {
  "use strict";

  const page = document.querySelector("[data-admin-page]");
  if (!page || !window.CITTACICO) return;

  const backend = window.CITTACICO;
  const db = backend.client;

  const loadingEl = page.querySelector("[data-admin-loading]");
  const deniedEl = page.querySelector("[data-admin-denied]");
  const consoleEl = page.querySelector("[data-admin-console]");

  const STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded"
  ];
  const STATUS_LABELS = {
    pending: "Awaiting confirmation",
    confirmed: "Confirmed",
    processing: "In the atelier",
    shipped: "Despatched",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded"
  };

  let orders = [];
  let products = [];
  let clients = [];

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  function money(cents, currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2
    }).format((cents || 0) / 100);
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
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

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* ------------------------------------------------------------------ *
   * Tabs
   * ------------------------------------------------------------------ */

  page.querySelectorAll("[data-admin-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      const name = tab.getAttribute("data-admin-tab");
      page.querySelectorAll("[data-admin-tab]").forEach(function (other) {
        other.classList.toggle("is-active", other === tab);
      });
      page.querySelectorAll("[data-admin-section]").forEach(function (section) {
        section.classList.toggle(
          "is-active",
          section.getAttribute("data-admin-section") === name
        );
      });
    });
  });

  /* ------------------------------------------------------------------ *
   * Orders
   * ------------------------------------------------------------------ */

  function renderStats() {
    const counted = orders.filter(function (order) {
      return order.status !== "cancelled" && order.status !== "refunded";
    });
    const revenue = counted.reduce(function (sum, order) {
      return sum + (order.total_cents || 0);
    }, 0);
    const open = orders.filter(function (order) {
      return ["pending", "confirmed", "processing"].indexOf(order.status) !== -1;
    }).length;

    page.querySelector("[data-admin-stats]").innerHTML =
      '<div class="admin-stat"><span>Orders</span><strong>' +
      orders.length +
      "</strong></div>" +
      '<div class="admin-stat"><span>Open</span><strong>' +
      open +
      "</strong></div>" +
      '<div class="admin-stat"><span>Revenue</span><strong>' +
      money(revenue) +
      "</strong></div>";
  }

  function renderOrders() {
    const filter = page.querySelector("[data-order-filter]").value;
    const root = page.querySelector("[data-admin-orders]");
    const visible = filter
      ? orders.filter(function (order) {
          return order.status === filter;
        })
      : orders;

    if (!visible.length) {
      root.innerHTML = '<p class="account-empty">No orders to show.</p>';
      return;
    }

    root.innerHTML = visible
      .map(function (order) {
        const lines = (order.order_items || [])
          .map(function (line) {
            return (
              "<li><span>" +
              escapeHtml(line.product_name) +
              " × " +
              line.quantity +
              "</span><span>" +
              money(line.line_total_cents, order.currency) +
              "</span></li>"
            );
          })
          .join("");

        const address = [
          order.ship_full_name,
          order.ship_line1,
          order.ship_line2,
          order.ship_city,
          order.ship_region,
          order.ship_postal_code,
          order.ship_country
        ]
          .filter(Boolean)
          .map(escapeHtml)
          .join(", ");

        const options = STATUSES.map(function (status) {
          return (
            '<option value="' +
            status +
            '"' +
            (status === order.status ? " selected" : "") +
            ">" +
            STATUS_LABELS[status] +
            "</option>"
          );
        }).join("");

        return (
          '<article class="admin-order">' +
          '<header class="admin-order-head">' +
          "<div>" +
          '<p class="admin-order-number">' +
          escapeHtml(order.order_number) +
          "</p>" +
          '<p class="admin-order-meta">' +
          formatDate(order.placed_at) +
          " · " +
          escapeHtml(order.email) +
          (order.user_id ? "" : " · guest") +
          "</p>" +
          "</div>" +
          '<div class="admin-order-head-right">' +
          '<strong class="admin-order-total">' +
          money(order.total_cents, order.currency) +
          "</strong>" +
          '<select class="admin-status-select" data-order-status="' +
          order.id +
          '">' +
          options +
          "</select>" +
          "</div>" +
          "</header>" +
          '<ul class="admin-order-lines">' +
          lines +
          "</ul>" +
          '<p class="admin-order-address">' +
          (address || "No delivery address recorded.") +
          "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  async function loadOrders() {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .order("placed_at", { ascending: false });

    if (error) {
      console.error("Orders failed to load.", error);
      return;
    }
    orders = data || [];
    page.querySelector("[data-count-orders]").textContent = orders.length;
    renderStats();
    renderOrders();
  }

  page.querySelector("[data-order-filter]").addEventListener("change", renderOrders);
  page.querySelector("[data-orders-refresh]").addEventListener("click", loadOrders);

  page.addEventListener("change", async function (event) {
    const select = event.target.closest("[data-order-status]");
    if (!select) return;

    const id = select.getAttribute("data-order-status");
    const status = select.value;
    select.disabled = true;

    const { error } = await db.from("orders").update({ status: status }).eq("id", id);
    select.disabled = false;

    if (error) {
      window.alert("The status could not be updated: " + error.message);
      return;
    }
    const order = orders.find(function (entry) {
      return entry.id === id;
    });
    if (order) order.status = status;
    renderStats();
  });

  /* ------------------------------------------------------------------ *
   * Catalogue
   * ------------------------------------------------------------------ */

  const productForm = page.querySelector("[data-product-form]");
  const productMessage = page.querySelector("[data-product-message]");
  const productTitle = page.querySelector("[data-product-editor-title]");
  const newProductButton = page.querySelector("[data-product-new]");
  const cancelEditButton = page.querySelector("[data-product-cancel]");

  function resetProductForm() {
    productForm.reset();
    productForm.elements.id.value = "";
    productForm.elements.sort_order.value = "0";
    productForm.elements.stock_quantity.value = "0";
    productTitle.textContent = "Add a piece";
    newProductButton.hidden = true;
    cancelEditButton.hidden = true;
    say(productMessage, "");
  }

  function editProduct(product) {
    productForm.elements.id.value = product.id;
    productForm.elements.name.value = product.name || "";
    productForm.elements.slug.value = product.slug || "";
    productForm.elements.category.value = product.category || "fashion";
    productForm.elements.collection.value = product.collection || "";
    productForm.elements.price.value = (product.price_cents / 100).toFixed(2);
    productForm.elements.number.value = product.number || "";
    productForm.elements.description.value = product.description || "";
    productForm.elements.material.value = product.material || "";
    productForm.elements.tone.value = product.tone || "";
    productForm.elements.details.value = product.details || "";
    productForm.elements.status.value = product.status || "active";
    productForm.elements.sort_order.value = product.sort_order || 0;
    productForm.elements.track_inventory.checked = Boolean(product.track_inventory);
    productForm.elements.stock_quantity.value = product.stock_quantity || 0;
    productForm.elements.image.value = "";

    productTitle.textContent = "Editing " + product.name;
    newProductButton.hidden = false;
    cancelEditButton.hidden = false;
    say(productMessage, "");
    productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  newProductButton.addEventListener("click", resetProductForm);
  cancelEditButton.addEventListener("click", resetProductForm);

  /* Suggest a slug while typing a new name, but never rewrite an existing one. */
  productForm.elements.name.addEventListener("input", function () {
    if (productForm.elements.id.value) return;
    productForm.elements.slug.value = slugify(productForm.elements.name.value);
  });

  async function uploadHeroImage(product, file) {
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = product.slug + "/hero-" + Date.now() + "." + extension;

    const { error: uploadError } = await db.storage
      .from("product-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data: publicData } = db.storage.from("product-images").getPublicUrl(path);

    await db
      .from("product_images")
      .delete()
      .eq("product_id", product.id)
      .eq("position", 0);

    const { error: linkError } = await db.from("product_images").insert({
      product_id: product.id,
      url: publicData.publicUrl,
      alt: product.name,
      position: 0
    });
    if (linkError) throw linkError;
  }

  productForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!productForm.reportValidity()) return;

    const data = new FormData(productForm);
    const id = String(data.get("id") || "");
    const record = {
      name: String(data.get("name")).trim(),
      slug: slugify(data.get("slug")),
      category: String(data.get("category")),
      collection: String(data.get("collection") || "").trim() || null,
      price_cents: Math.round(Number(data.get("price")) * 100),
      number: String(data.get("number") || "").trim() || null,
      description: String(data.get("description") || "").trim() || null,
      material: String(data.get("material") || "").trim() || null,
      tone: String(data.get("tone") || "").trim() || null,
      details: String(data.get("details") || "").trim() || null,
      status: String(data.get("status")),
      sort_order: Number(data.get("sort_order")) || 0,
      track_inventory: productForm.elements.track_inventory.checked,
      stock_quantity: Number(data.get("stock_quantity")) || 0
    };

    const button = productForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Saving…";
    say(productMessage, "");

    try {
      const query = id
        ? db.from("products").update(record).eq("id", id)
        : db.from("products").insert(record);
      const { data: saved, error } = await query.select().single();
      if (error) throw error;

      const file = productForm.elements.image.files[0];
      if (file) await uploadHeroImage(saved, file);

      await loadProducts();
      resetProductForm();
      say(productMessage, saved.name + " is saved.", "success");
    } catch (error) {
      const duplicate = error.code === "23505";
      say(
        productMessage,
        duplicate
          ? "Another piece already uses that slug. Choose a different one."
          : error.message || "The piece could not be saved.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "Save piece";
    }
  });

  function renderProducts() {
    const root = page.querySelector("[data-admin-products]");

    if (!products.length) {
      root.innerHTML = '<p class="account-empty">The catalogue is empty.</p>';
      return;
    }

    root.innerHTML = products
      .map(function (product) {
        const image = (product.product_images || []).find(function (entry) {
          return entry.position === 0;
        });
        const thumb = image
          ? '<img class="admin-product-thumb" src="' +
            escapeHtml(image.url) +
            '" alt="" />'
          : '<span class="admin-product-thumb admin-product-thumb--empty">' +
            escapeHtml(product.number || "—") +
            "</span>";

        return (
          '<article class="admin-product">' +
          thumb +
          '<div class="admin-product-body">' +
          "<h3>" +
          escapeHtml(product.name) +
          '<span class="admin-chip admin-chip--' +
          product.status +
          '">' +
          product.status +
          "</span></h3>" +
          '<p class="admin-product-meta">' +
          escapeHtml(product.collection || product.category) +
          " · " +
          money(product.price_cents, product.currency) +
          (product.track_inventory ? " · " + product.stock_quantity + " in stock" : "") +
          "</p>" +
          "</div>" +
          '<div class="admin-product-actions">' +
          '<button type="button" class="account-link-button" data-product-edit="' +
          product.id +
          '">Edit</button>' +
          '<button type="button" class="account-link-button is-danger" data-product-delete="' +
          product.id +
          '">Delete</button>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  async function loadProducts() {
    const { data, error } = await db
      .from("products")
      .select("*, product_images(url, position)")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Catalogue failed to load.", error);
      return;
    }
    products = data || [];
    page.querySelector("[data-count-products]").textContent = products.length;
    renderProducts();
  }

  page.addEventListener("click", async function (event) {
    const editButton = event.target.closest("[data-product-edit]");
    if (editButton) {
      const product = products.find(function (entry) {
        return entry.id === editButton.getAttribute("data-product-edit");
      });
      if (product) editProduct(product);
      return;
    }

    const deleteButton = event.target.closest("[data-product-delete]");
    if (!deleteButton) return;

    const id = deleteButton.getAttribute("data-product-delete");
    const product = products.find(function (entry) {
      return entry.id === id;
    });
    if (!product) return;

    const confirmed = window.confirm(
      "Delete " +
        product.name +
        " from the catalogue?\n\nPast orders keep their own record of it, so order " +
        "history is unaffected. To hide a piece instead, set its status to Archived."
    );
    if (!confirmed) return;

    const { error } = await db.from("products").delete().eq("id", id);
    if (error) {
      window.alert("The piece could not be deleted: " + error.message);
      return;
    }
    await loadProducts();
  });

  /* ------------------------------------------------------------------ *
   * Clients
   * ------------------------------------------------------------------ */

  function renderClients() {
    const term = page.querySelector("[data-client-search]").value.trim().toLowerCase();
    const root = page.querySelector("[data-admin-clients]");

    const visible = term
      ? clients.filter(function (client) {
          return [client.full_name, client.email, client.region]
            .filter(Boolean)
            .some(function (field) {
              return field.toLowerCase().indexOf(term) !== -1;
            });
        })
      : clients;

    if (!visible.length) {
      root.innerHTML = '<p class="account-empty">No clients to show.</p>';
      return;
    }

    root.innerHTML =
      '<table class="admin-table"><thead><tr>' +
      "<th>Name</th><th>Email</th><th>Born</th><th>Sex</th><th>Region</th>" +
      "<th>Orders</th><th>Spent</th>" +
      "</tr></thead><tbody>" +
      visible
        .map(function (client) {
          const theirs = orders.filter(function (order) {
            return order.user_id === client.id;
          });
          const spent = theirs.reduce(function (sum, order) {
            return order.status === "cancelled" || order.status === "refunded"
              ? sum
              : sum + (order.total_cents || 0);
          }, 0);

          return (
            "<tr>" +
            "<td>" +
            escapeHtml(client.full_name || "—") +
            "</td>" +
            "<td>" +
            escapeHtml(client.email || "—") +
            "</td>" +
            "<td>" +
            formatDate(client.birthday) +
            "</td>" +
            "<td>" +
            escapeHtml(client.sex ? client.sex.replace(/_/g, " ") : "—") +
            "</td>" +
            "<td>" +
            escapeHtml(client.region || "—") +
            "</td>" +
            "<td>" +
            theirs.length +
            "</td>" +
            "<td>" +
            money(spent) +
            "</td>" +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  async function loadClients() {
    const { data, error } = await db
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Clients failed to load.", error);
      return;
    }
    clients = data || [];
    page.querySelector("[data-count-clients]").textContent = clients.length;
    renderClients();
  }

  page.querySelector("[data-client-search]").addEventListener("input", renderClients);

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  document
    .querySelector("[data-admin-signout]")
    .addEventListener("click", async function () {
      await backend.signOut();
      window.location.href = "index.html";
    });

  backend.ready.then(async function () {
    loadingEl.hidden = true;

    if (!backend.getSession()) {
      deniedEl.hidden = false;
      return;
    }

    if (!backend.isAdmin()) {
      page.querySelector("[data-admin-denied-message]").textContent =
        "You are signed in, but this account does not hold back-office access.";
      deniedEl.hidden = false;
      document.querySelector("[data-admin-signout]").hidden = false;
      return;
    }

    consoleEl.hidden = false;
    document.querySelector("[data-admin-signout]").hidden = false;

    await loadOrders();
    await Promise.all([loadProducts(), loadClients()]);
    renderClients();
  });
})();
