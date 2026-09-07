/*
 * Registration page: create a maison account.
 */
(function () {
  "use strict";

  const page = document.querySelector("[data-register-page]");
  if (!page || !window.CITTACICO) return;

  const backend = window.CITTACICO;
  const loadingEl = page.querySelector("[data-register-loading]");
  const panelEl = page.querySelector("[data-register-panel]");
  const signUpForm = page.querySelector("[data-signup-form]");
  const signUpMessage = page.querySelector("[data-signup-message]");
  const resendSignUp = page.querySelector("[data-resend-signup]");

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

  async function resendFor(email) {
    if (!email) {
      say(signUpMessage, "Enter your email above, then ask again.", "error");
      return;
    }
    try {
      if (resendSignUp) resendSignUp.disabled = true;
      await backend.resendConfirmation(email);
      say(signUpMessage, "A new confirmation is on its way to " + email + ".", "success");
    } catch (error) {
      say(signUpMessage, error.message || "The confirmation could not be sent.", "error");
    } finally {
      if (resendSignUp) resendSignUp.disabled = false;
    }
  }

  signUpForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!signUpForm.reportValidity()) return;

    const data = new FormData(signUpForm);
    say(signUpMessage, "");
    busy(signUpForm, true, "Creating…");

    try {
      const locationRoot = signUpForm.querySelector("[data-location-fields]");
      const location = window.CITTACICO_LOCATIONS && locationRoot
        ? window.CITTACICO_LOCATIONS.getValues(locationRoot)
        : { country: "", region: String(data.get("region") || "").trim() };
      const regionValue = window.CITTACICO_LOCATIONS
        ? window.CITTACICO_LOCATIONS.formatProfileRegion(location.country, location.region)
        : location.region;

      const result = await backend.signUp({
        email: String(data.get("email")).trim(),
        password: String(data.get("password")),
        fullName: String(data.get("fullName") || "").trim(),
        birthday: String(data.get("birthday") || ""),
        sex: String(data.get("sex") || ""),
        region: regionValue,
        phone: String(data.get("phone") || "").trim(),
        marketingOptIn: data.get("marketingOptIn") === "yes"
      });

      if (result.session) {
        window.location.href = "shop.html";
        return;
      }

      busy(signUpForm, false);
      say(
        signUpMessage,
        "Your account is created. Confirm the link we sent to " +
          String(data.get("email")).trim() +
          " to sign in.",
        "success"
      );
      if (resendSignUp) {
        resendSignUp.hidden = false;
        resendSignUp.dataset.email = String(data.get("email")).trim();
      }
      signUpForm.reset();
    } catch (error) {
      busy(signUpForm, false);
      say(signUpMessage, error.message || "The account could not be created.", "error");
    }
  });

  if (resendSignUp) {
    resendSignUp.addEventListener("click", function () {
      const email =
        resendSignUp.dataset.email ||
        String(new FormData(signUpForm).get("email") || "").trim();
      resendFor(email);
    });
  }

  backend.ready.then(function () {
    if (loadingEl) loadingEl.hidden = true;

    if (backend.getSession()) {
      window.location.href = "shop.html";
      return;
    }

    if (panelEl) panelEl.hidden = false;
    page.querySelectorAll("[data-location-fields]").forEach(function (root) {
      if (window.CITTACICO_LOCATIONS) window.CITTACICO_LOCATIONS.bind(root);
    });
  });
})();
