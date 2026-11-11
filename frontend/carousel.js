// =====================================================================
//  Course card carousel — accessible, auto-advancing, swipeable.
//  Markup: [data-carousel] > .cs-track > .cs-card  (+ .cs-prev/.cs-next/.cs-pause/.cs-dots/.cs-live)
//  Without JavaScript the cards simply show as a list.
// =====================================================================
(function () {
  "use strict";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var INTERVAL = 4500;

  function initCarousel(root) {
    var cards = Array.prototype.slice.call(root.querySelectorAll(".cs-card"));
    if (cards.length < 2) return;
    var prevBtn = root.querySelector(".cs-prev");
    var nextBtn = root.querySelector(".cs-next");
    var pauseBtn = root.querySelector(".cs-pause");
    var dotsBox = root.querySelector(".cs-dots");
    var live = root.querySelector(".cs-live");
    var index = 0, timer = null, userPaused = reduceMotion, hoverPaused = false;
    var n = cards.length;

    // Dots
    var dots = cards.map(function (card, i) {
      var d = document.createElement("button");
      d.type = "button";
      d.className = "cs-dot";
      d.setAttribute("aria-label", "Show course " + (i + 1) + " of " + n);
      d.addEventListener("click", function () { go(i, true); });
      dotsBox.appendChild(d);
      return d;
    });

    function render(announce) {
      cards.forEach(function (card, i) {
        var offset = (i - index + n) % n;
        card.classList.remove("is-active", "is-next", "is-prev", "is-far");
        if (offset === 0) card.classList.add("is-active");
        else if (offset === 1) card.classList.add("is-next");
        else if (offset === n - 1) card.classList.add("is-prev");
        else card.classList.add("is-far");
        var hidden = offset !== 0;
        card.setAttribute("aria-hidden", hidden ? "true" : "false");
        if ("inert" in card) card.inert = hidden;
      });
      dots.forEach(function (d, i) { d.setAttribute("aria-current", i === index ? "true" : "false"); });
      if (announce && live) live.textContent = cards[index].getAttribute("aria-label");
    }

    function go(i, byUser) {
      index = (i + n) % n;
      render(byUser);
      if (byUser) restart();
    }

    function stop() { clearInterval(timer); timer = null; }
    function restart() {
      stop();
      if (!userPaused && !hoverPaused) timer = setInterval(function () { go(index + 1, false); }, INTERVAL);
    }
    function setPaused(p) {
      userPaused = p;
      pauseBtn.textContent = p ? "▶" : "❚❚";
      pauseBtn.setAttribute("aria-label", p ? "Play automatic slide changes" : "Pause automatic slide changes");
      root.classList.toggle("is-paused", p);
      restart();
    }

    prevBtn.addEventListener("click", function () { go(index - 1, true); });
    nextBtn.addEventListener("click", function () { go(index + 1, true); });
    pauseBtn.addEventListener("click", function () { setPaused(!userPaused); });

    // Clicking a side card brings it to the front
    cards.forEach(function (card, i) {
      card.addEventListener("click", function () { if (i !== index) go(i, true); });
    });

    // Pause while the visitor is reading or using the keyboard inside
    root.addEventListener("mouseenter", function () { hoverPaused = true; stop(); });
    root.addEventListener("mouseleave", function () { hoverPaused = false; restart(); });
    root.addEventListener("focusin", function () { hoverPaused = true; stop(); });
    root.addEventListener("focusout", function (e) { if (!root.contains(e.relatedTarget)) { hoverPaused = false; restart(); } });

    // Arrow keys when focus is inside the carousel
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1, true); }
    });

    // Swipe on touch screens
    var startX = null;
    root.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") startX = e.clientX; });
    root.addEventListener("pointerup", function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX; startX = null;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1), true);
    });

    // Only run while visible (saves battery, avoids moving content off-screen)
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) restart(); else stop(); });
      }).observe(root);
    }

    root.classList.add("is-ready");
    if (reduceMotion) setPaused(true);
    render(false);
    restart();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-carousel]"), initCarousel);
})();
