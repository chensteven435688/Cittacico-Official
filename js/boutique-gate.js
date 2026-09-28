/* The boutique is built, but it is not open to visitors on the live site yet.
   Shop pages send people to the house, and shop links stay hidden.
   On this computer — localhost, or a file opened directly — the shop still
   shows, so the interface can keep being worked on.
   Set BOUTIQUE_OPEN to true when everyone should see it. */
(function () {
  "use strict";

  var BOUTIQUE_OPEN = false;

  var SHOP_PAGES = {
    "shop.html": true,
    "product.html": true,
    "collections.html": true,
    "collection-fashion.html": true,
    "collection-accessories.html": true,
    "collection-fragrance.html": true,
    "collection-jewelry.html": true,
    "checkout.html": true,
    "payment-success.html": true,
    "payment-failure.html": true
  };

  function localPreview() {
    var host = location.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]" ||
      host === ""
    );
  }

  var open = BOUTIQUE_OPEN || localPreview();
  window.CITTACICO_BOUTIQUE_OPEN = open;

  if (open) {
    document.documentElement.classList.add("boutique-open");
    return;
  }

  document.documentElement.classList.add("boutique-closed");

  var file = (location.pathname.split("/").pop() || "index.html").split("?")[0].toLowerCase();
  if (!file || file.indexOf(".") === -1) file = "index.html";
  if (SHOP_PAGES[file]) location.replace("house.html");
})();
