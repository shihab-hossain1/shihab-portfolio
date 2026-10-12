// ===================================================================
//  Shihab Hossain — Portfolio API  (Node.js + Express, deploy on Render)
//
//  Endpoints
//    GET  /                -> simple status text
//    GET  /api/health      -> { ok: true }  (also used to wake the server)
//    POST /api/contact     -> { name, email, message } -> emails you
//
//  Environment variables (set them in Render → Environment):
//    RESEND_API_KEY   your key from https://resend.com (free)
//    TO_EMAIL         where messages go (the email you signed up to Resend with)
//    ALLOWED_ORIGINS  your Vercel URL(s), comma-separated
//                     e.g. https://shihab-hossain.vercel.app
// ===================================================================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;
const TO_EMAIL = process.env.TO_EMAIL || "hossainshihab2001@gmail.com";

// ---- Security & parsing ----
app.set("trust proxy", 1); // Render sits behind a proxy
app.use(helmet());
app.use(express.json({ limit: "20kb" }));

// ---- CORS: only your website may call this API ----
const allowed = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500")
  .split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // allow tools like curl/Postman (no origin) and your listed sites
    if (!origin || allowed.includes(origin) || allowed.includes("*")) return cb(null, true);
    cb(new Error("Not allowed by CORS: " + origin));
  },
}));

// ---- Routes ----
app.get("/", (_req, res) => res.type("text").send("Shihab Hossain portfolio API is running ✔"));
app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// max 5 messages per visitor every 15 minutes
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many messages — please try again in a few minutes." },
});

const escape = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

app.post("/api/contact", contactLimiter, async (req, res) => {
  const { name = "", email = "", message = "", website = "" } = req.body || {};

  // honeypot: real people never fill the hidden "website" field
  if (website) return res.json({ ok: true });

  const n = String(name).trim(), e = String(email).trim(), m = String(message).trim();
  if (!n || !e || !m) return res.status(400).json({ error: "Name, email and message are required." });
  if (!/^\S+@\S+\.\S+$/.test(e)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (n.length > 100 || e.length > 200 || m.length > 5000) return res.status(400).json({ error: "Message is too long." });

  console.log(`[contact] ${new Date().toISOString()} from ${n} <${e}>: ${m.slice(0, 200)}`);

  // No key yet? Keep working: the message is visible in Render → Logs.
  if (!process.env.RESEND_API_KEY) {
    console.warn("[contact] RESEND_API_KEY not set — message logged only, not emailed.");
    return res.json({ ok: true, emailed: false });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "Portfolio <onboarding@resend.dev>",
        to: [TO_EMAIL],
        reply_to: e,
        subject: `New portfolio message from ${n}`,
        html: `<h2>New message from your portfolio</h2>
               <p><b>Name:</b> ${escape(n)}<br><b>Email:</b> ${escape(e)}</p>
               <p style="white-space:pre-wrap">${escape(m)}</p>`,
        text: `From: ${n} <${e}>\n\n${m}`,
      }),
    });
    if (!r.ok) {
      console.error("[contact] Resend error", r.status, await r.text());
      return res.status(502).json({ error: "Email service error — please try again later." });
    }
    res.json({ ok: true, emailed: true });
  } catch (err) {
    console.error("[contact] failed:", err);
    res.status(500).json({ error: "Server error — please try again later." });
  }
});

// ---- 404 + error handler ----
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  if (String(err.message).startsWith("Not allowed by CORS")) return res.status(403).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
