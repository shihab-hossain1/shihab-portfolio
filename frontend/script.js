// =====================================================================
//  Shihab Hossain — SQA portfolio script
//  Progressive enhancement only: every section and link works without JS.
// =====================================================================
(function () {
  "use strict";

  var API = String(window.API_URL || "").replace(/\/+$/, "");
  var CONTACT_EMAIL = "hossainshihab2001@gmail.com";
  var CV_PATH = "assets/Shihab-Hossain-CV.pdf";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.add("js");

  // Wake the Render backend early (free instances sleep when idle).
  if (API) { fetch(API + "/api/health", { method: "GET", mode: "cors" }).catch(function () {}); }

  /* ---------- Header: border on scroll ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById("menuToggle");
  var nav = document.getElementById("siteNav");
  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  }
  toggle.addEventListener("click", function () { setMenu(toggle.getAttribute("aria-expanded") !== "true"); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); }
  });

  /* ---------- Active section in nav ---------- */
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  if ("IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.getAttribute("href") === "#" + entry.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) {
      var target = document.querySelector(a.getAttribute("href"));
      if (target) sectionObserver.observe(target);
    });
  }

  /* ---------- Gentle reveal (skipped for reduced motion) ---------- */
  if (!reduceMotion && "IntersectionObserver" in window) {
    var revealTargets = document.querySelectorAll(".section-head, .case, .feature-card, .mini-card, .skill-group, .about-grid, .contact-grid");
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); revealObserver.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(revealTargets, function (el) {
      // Anything already on screen stays visible (no flash of hidden content).
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add("reveal");
      revealObserver.observe(el);
    });
  }

  /* ---------- CV buttons appear only when the PDF really exists ---------- */
  fetch(CV_PATH, { method: "HEAD", cache: "no-cache" }).then(function (res) {
    var type = res.headers.get("content-type") || "";
    if (res.ok && type.indexOf("pdf") !== -1) {
      ["cvLink", "cvContactItem"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = false;
      });
    }
  }).catch(function () {});

  /* ---------- Footer year ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Contact form ---------- */
  var form = document.getElementById("contactForm");
  if (!form) return;
  var statusEl = document.getElementById("formStatus");
  var sendBtn = document.getElementById("sendBtn");
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var rules = {
    name: function (v) { return v.trim() ? "" : "Please enter your name."; },
    email: function (v) {
      if (!v.trim()) return "Please enter your email address.";
      return EMAIL_RE.test(v.trim()) ? "" : "Please enter a valid email address, like name@example.com.";
    },
    message: function (v) {
      if (!v.trim()) return "Please write a message.";
      return v.trim().length < 10 ? "Please write at least 10 characters." : "";
    }
  };

  function setFieldError(field, msg) {
    var err = document.getElementById(field.id + "-err");
    field.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) err.textContent = msg;
  }
  function validateField(field) {
    var rule = rules[field.name];
    if (!rule) return "";
    var msg = rule(field.value);
    setFieldError(field, msg);
    return msg;
  }
  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "form-status" + (kind ? " is-" + kind : "");
  }

  // Validate a field when the user leaves it; clear its error once fixed.
  Array.prototype.forEach.call(form.querySelectorAll("input[name], textarea[name]"), function (field) {
    if (!rules[field.name]) return;
    field.addEventListener("blur", function () { if (field.value) validateField(field); });
    field.addEventListener("input", function () { if (field.getAttribute("aria-invalid") === "true") validateField(field); });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstInvalid = null;
    ["name", "email", "message"].forEach(function (name) {
      var field = form.elements[name];
      if (validateField(field) && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      setStatus("Please fix the highlighted fields.", "error");
      firstInvalid.focus();
      return;
    }
    if (!API) {
      setStatus("The message service isn't configured. Please email " + CONTACT_EMAIL + " instead.", "error");
      return;
    }

    var payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim(),
      website: form.elements.website.value
    };

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    setStatus("Sending your message. The first request can take up to a minute while the server wakes up.", "pending");

    var controller = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 75000);

    fetch(API + "/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || "The server returned an error (" + res.status + ").");
          return body;
        });
      })
      .then(function () {
        form.reset();
        ["f-name", "f-email", "f-message"].forEach(function (id) { setFieldError(document.getElementById(id), ""); });
        setStatus("Thank you, your message was sent. I'll reply by email.", "success");
      })
      .catch(function (err) {
        var reason = err && err.name === "AbortError" ? "The request timed out."
          : (err && err.message && err.message !== "Failed to fetch" ? err.message : "I couldn't reach the server.");
        setStatus(reason + " Please email me directly at " + CONTACT_EMAIL + ".", "error");
      })
      .then(function () {
        clearTimeout(timer);
        sendBtn.disabled = false;
        sendBtn.textContent = "Send message";
      });
  });
})();
