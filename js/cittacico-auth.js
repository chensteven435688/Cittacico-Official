/*
 * Dedicated log-in and sign-up pages.
 * Email and password go through the existing maison auth on window.CITTACICO.
 * Credentials are never written to the console.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-auth-page]");
  if (!root) return;

  var backend = window.CITTACICO || null;
  var mode = root.getAttribute("data-auth-page");

  function say(el, message, tone) {
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
    el.classList.toggle("is-error", tone === "error");
    el.classList.toggle("is-success", tone === "success");
  }

  function busy(form, isBusy, label) {
    var button = form.querySelector("[data-auth-submit]");
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

  function destination() {
    return window.CITTACICO_BOUTIQUE_OPEN ? "shop.html" : "house.html";
  }

  function bindReveal(scope) {
    scope.querySelectorAll("[data-reveal]").forEach(function (button) {
      var input = document.getElementById(button.getAttribute("aria-controls") || "");
      if (!input) return;
      button.addEventListener("click", function () {
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        button.textContent = showing ? "Show" : "Hide";
        button.setAttribute("aria-pressed", showing ? "false" : "true");
        button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      });
    });
  }

  function revealReady() {
    var loading = root.querySelector("[data-auth-loading]");
    var ready = root.querySelector("[data-auth-ready]");
    if (loading) loading.hidden = true;
    if (ready) ready.hidden = false;
  }

  function boot(onReady) {
    if (!backend || !backend.ready) {
      revealReady();
      return;
    }
    backend.ready.then(onReady).catch(function () {
      revealReady();
    });
  }

  function requireBackend(messageEl) {
    if (backend && backend.signIn && backend.signUp) return true;
    say(messageEl, "The maison is offline.", "error");
    return false;
  }

  bindReveal(root);

  switch (mode) {
    case "login":
      initLogin();
      break;
    case "signup":
      initSignup();
      break;
    default: {
      var unexpected = mode;
      throw new Error("Unknown auth page: " + String(unexpected));
    }
  }

  function initLogin() {
    var form = root.querySelector("[data-login-form]");
    var message = root.querySelector("[data-auth-message]");
    var resetBtn = root.querySelector("[data-reset-password]");
    var resendBtn = root.querySelector("[data-resend-confirmation]");
    var notice = new URLSearchParams(window.location.search).get("notice") || "";

    if (notice) say(message, notice, "error");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!requireBackend(message)) return;

      var data = new FormData(form);
      var email = String(data.get("email") || "").trim();
      var password = String(data.get("password") || "");
      say(message, "");
      busy(form, true, "Logging in…");

      try {
        await backend.signIn(email, password);
        window.location.href = destination();
      } catch (error) {
        busy(form, false);
        var text = (error && error.message) || "Those details were not recognised.";
        say(message, text, "error");
        if (/not confirmed/i.test(text) && resendBtn) resendBtn.hidden = false;
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", async function () {
        var email = String(new FormData(form).get("email") || "").trim();
        if (!email) {
          say(message, "Enter your email above, then ask again.", "error");
          return;
        }
        if (!requireBackend(message)) return;
        try {
          resetBtn.disabled = true;
          await backend.sendPasswordReset(email);
          say(message, "A reset link is on its way to " + email + ".", "success");
        } catch (error) {
          say(message, (error && error.message) || "The reset could not be sent.", "error");
        } finally {
          resetBtn.disabled = false;
        }
      });
    }

    if (resendBtn) {
      resendBtn.addEventListener("click", async function () {
        var email = String(new FormData(form).get("email") || "").trim();
        if (!email) {
          say(message, "Enter your email above, then ask again.", "error");
          return;
        }
        if (!requireBackend(message)) return;
        try {
          resendBtn.disabled = true;
          await backend.resendConfirmation(email);
          say(message, "A new confirmation is on its way to " + email + ".", "success");
        } catch (error) {
          say(message, (error && error.message) || "The confirmation could not be sent.", "error");
        } finally {
          resendBtn.disabled = false;
        }
      });
    }

    boot(function () {
      if (backend.getSession()) {
        window.location.replace(destination());
        return;
      }
      revealReady();
    });
  }

  function initSignup() {
    var form = root.querySelector("[data-signup-form]");
    var message = root.querySelector("[data-auth-message]");
    var passwordStep = root.querySelector("[data-step-password]");
    var actions = root.querySelector("[data-auth-actions]");
    var submitBtn = root.querySelector("[data-auth-submit]");
    var editBtn = root.querySelector("[data-edit-email]");
    var resendBtn = root.querySelector("[data-resend-signup]");
    var emailInput = form.querySelector('input[name="email"]');
    var passwordInput = form.querySelector('input[name="password"]');
    var step = "email";

    function setStep(next) {
      switch (next) {
        case "email":
        case "password":
          break;
        default: {
          var unexpected = next;
          throw new Error("Unknown signup step: " + String(unexpected));
        }
      }
      step = next;
      var onPassword = next === "password";
      passwordStep.hidden = !onPassword;
      if (editBtn) editBtn.hidden = !onPassword;
      passwordInput.required = onPassword;
      submitBtn.textContent = onPassword ? "Sign up" : "Continue";
      submitBtn.dataset.idleLabel = submitBtn.textContent;
      actions.classList.toggle("auth-actions--end", !onPassword);
      actions.classList.toggle("auth-actions--split", onPassword);
      if (onPassword) passwordInput.focus();
    }

    if (editBtn) {
      editBtn.addEventListener("click", function () {
        say(message, "");
        setStep("email");
        emailInput.focus();
      });
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (step === "email") {
        if (!emailInput.checkValidity()) {
          emailInput.reportValidity();
          return;
        }
        say(message, "");
        setStep("password");
        return;
      }

      if (step !== "password") {
        var unexpected = step;
        throw new Error("Unknown signup step: " + String(unexpected));
      }

      if (!form.reportValidity()) return;
      if (!requireBackend(message)) return;

      var email = String(emailInput.value || "").trim();
      var password = String(passwordInput.value || "");
      say(message, "");
      busy(form, true, "Creating…");

      try {
        var result = await backend.signUp({
          email: email,
          password: password,
          fullName: "",
          birthday: "",
          sex: "",
          region: "",
          phone: "",
          marketingOptIn: false
        });
        passwordInput.value = "";

        if (result && result.session) {
          window.location.href = destination();
          return;
        }

        busy(form, false);
        say(
          message,
          "Your account is created. Confirm the link we sent to " + email + " to sign in.",
          "success"
        );
        if (resendBtn) {
          resendBtn.hidden = false;
          resendBtn.dataset.email = email;
        }
      } catch (error) {
        busy(form, false);
        say(message, (error && error.message) || "The account could not be created.", "error");
      }
    });

    if (resendBtn) {
      resendBtn.addEventListener("click", async function () {
        var email = resendBtn.dataset.email || String(emailInput.value || "").trim();
        if (!email) {
          say(message, "Enter your email above, then ask again.", "error");
          return;
        }
        if (!requireBackend(message)) return;
        try {
          resendBtn.disabled = true;
          await backend.resendConfirmation(email);
          say(message, "A new confirmation is on its way to " + email + ".", "success");
        } catch (error) {
          say(message, (error && error.message) || "The confirmation could not be sent.", "error");
        } finally {
          resendBtn.disabled = false;
        }
      });
    }

    boot(function () {
      if (backend.getSession()) {
        window.location.replace(destination());
        return;
      }
      revealReady();
    });
  }
})();
