// ========== Shihab Hossain — Portfolio script ==========
const API = (window.API_URL || "").replace(/\/$/, "");

// Wake the backend early (Render's free tier sleeps after 15 min idle)
if (API) fetch(API + "/api/health").catch(() => {});

// ---- Nav: shadow on scroll + mobile menu ----
const nav = document.getElementById("nav");
const links = document.getElementById("links");
const burger = document.getElementById("burger");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 30), { passive: true });
burger.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  burger.classList.toggle("open", open);
  document.body.style.overflow = open ? "hidden" : "";
});
links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  links.classList.remove("open"); burger.classList.remove("open"); document.body.style.overflow = "";
}));

// ---- Reveal on scroll + side dots ----
const slides = [...document.querySelectorAll("section.slide")];
const dots = document.getElementById("dots");
slides.forEach((s, i) => {
  const b = document.createElement("button");
  b.setAttribute("aria-label", "Go to section " + (i + 1));
  b.onclick = () => s.scrollIntoView({ behavior: "smooth" });
  dots.appendChild(b);
});
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add("in");
  const i = slides.indexOf(e.target);
  [...dots.children].forEach((d, j) => d.classList.toggle("on", j === i));
  e.target.querySelectorAll("[data-count]").forEach(countUp);
}), { threshold: 0.25 });
slides.forEach(s => io.observe(s));

// ---- Animated counters ----
function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || "";
  const t0 = performance.now(), dur = 1400;
  const step = t => {
    const p = Math.min((t - t0) / dur, 1), v = end * (1 - Math.pow(1 - p, 3));
    el.textContent = v.toFixed(dec) + (p === 1 ? suf : "");
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---- Year ----
document.getElementById("year").textContent = new Date().getFullYear();

// ---- Contact form → backend ----
const form = document.getElementById("contactForm");
const statusEl = document.getElementById("formStatus");
const btn = document.getElementById("sendBtn");
function setStatus(msg, kind) { statusEl.textContent = msg; statusEl.className = "status " + (kind || ""); }

form.addEventListener("submit", async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!data.name.trim() || !data.message.trim() || !/^\S+@\S+\.\S+$/.test(data.email)) {
    return setStatus("Please fill in your name, a valid email and a message.", "err");
  }
  btn.disabled = true; btn.textContent = "Sending…";
  setStatus("If the server was asleep this can take up to a minute.", "");
  try {
    const res = await fetch(API + "/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Something went wrong.");
    form.reset();
    setStatus("Thanks! Your message was sent — I'll reply soon.", "ok");
  } catch (err) {
    setStatus((err.message && err.message !== "Failed to fetch" ? err.message : "Couldn't reach the server.") +
      " You can also email hossainshihab2001@gmail.com directly.", "err");
  } finally {
    btn.disabled = false; btn.textContent = "Send message";
  }
});
