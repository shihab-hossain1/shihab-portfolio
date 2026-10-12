# Shihab Hossain — Portfolio Website

A complete personal portfolio: **frontend** (HTML/CSS/JS) on **Vercel** + **backend** (Node.js/Express) on **Render**.
Total cost: **$0**.

```
shihab-portfolio/
├── frontend/              ← deploy to Vercel
│   ├── index.html         all your content (edit text here)
│   ├── style.css          design
│   ├── script.js          animations + contact form
│   ├── config.js          ← put your Render URL here after deploying
│   └── assets/profile.jpg your photo
├── backend/               ← deploy to Render
│   ├── server.js          API: /api/health, /api/contact
│   ├── package.json
│   └── .env.example
└── .gitignore
```

---

## Step 0 — Install the tools (one time)

1. **VS Code** → https://code.visualstudio.com
2. **Node.js (LTS)** → https://nodejs.org — after installing, open a terminal and check: `node -v`
3. **Git** → https://git-scm.com
4. In VS Code, install the extension **Live Server** (by Ritwick Dey).
5. Create free accounts: **GitHub**, **Vercel** (sign in with GitHub), **Render** (sign in with GitHub), **Resend** (for emails).

## Step 1 — Open the project in VS Code

1. Unzip `shihab-portfolio.zip`.
2. VS Code → **File → Open Folder…** → choose `shihab-portfolio`.
3. Open the terminal: **View → Terminal**.

## Step 2 — Run it on your computer

**Backend**

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```

You should see `API listening on http://localhost:5000`.
Open http://localhost:5000/api/health → `{"ok":true,...}`.

**Frontend**

Right-click `frontend/index.html` → **Open with Live Server**. It opens at `http://127.0.0.1:5500`.
Fill in the contact form → the message appears in the backend terminal. ✅

> Until you add a Resend key, messages are only printed in the terminal / Render logs. Step 5 makes them arrive in your Gmail.

## Step 3 — Put the code on GitHub

1. GitHub → **New repository** → name `shihab-portfolio` → Public → **Create**.
2. In the VS Code terminal (in the `shihab-portfolio` folder, not `backend`):

```bash
cd ..
git init
git add .
git commit -m "My portfolio"
git branch -M main
git remote add origin https://github.com/shihab-hossain1/shihab-portfolio.git
git push -u origin main
```

`.gitignore` makes sure `node_modules` and your secret `.env` are **not** uploaded.

## Step 4 — Deploy the backend on Render (free)

1. https://dashboard.render.com → **New + → Web Service** → connect your `shihab-portfolio` repo.
2. Settings:
   | Field | Value |
   |---|---|
   | Name | `shihab-portfolio-api` |
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
3. **Environment Variables** (add these):
   | Key | Value |
   |---|---|
   | `TO_EMAIL` | `hossainshihab2001@gmail.com` |
   | `ALLOWED_ORIGINS` | `*` for now (we fix it in Step 6) |
   | `RESEND_API_KEY` | from Step 5 (you can add it later) |
4. **Create Web Service**. Wait for "Live", then copy your URL, e.g.
   `https://shihab-portfolio-api.onrender.com`.
   Test: open `https://shihab-portfolio-api.onrender.com/api/health`.

## Step 5 — Get contact-form emails in Gmail (free)

Render's free plan **blocks normal email (SMTP)**, so the backend uses Resend's email API.

1. Sign up at https://resend.com **with `hossainshihab2001@gmail.com`** (the free test sender can only email the address you signed up with).
2. **API Keys → Create API Key** → copy it (starts with `re_`).
3. Render → your service → **Environment** → add `RESEND_API_KEY` = your key → **Save** (it redeploys).

## Step 6 — Deploy the frontend on Vercel (free)

1. Open `frontend/config.js` and set your Render URL:
   ```js
   window.API_URL = "https://shihab-portfolio-api.onrender.com";
   ```
2. Push the change:
   ```bash
   git add .
   git commit -m "Connect to live backend"
   git push
   ```
3. https://vercel.com/new → **Import** `shihab-portfolio`.
   - **Root Directory** → `frontend`
   - **Framework Preset** → Other
   - Leave build settings empty → **Deploy**.
4. You get a URL like `https://shihab-portfolio.vercel.app`. 🎉
   (Project → Settings → Domains lets you rename it, e.g. `shihab-hossain.vercel.app`.)
5. Lock the backend to your site: Render → **Environment** → set
   `ALLOWED_ORIGINS` = `https://shihab-portfolio.vercel.app` (your exact Vercel URL, no trailing slash) → Save.

Send a test message from the live site — it should land in your Gmail. ✅

## Updating your site later

Edit files in VS Code → then:

```bash
git add .
git commit -m "Update projects"
git push
```

Vercel and Render redeploy automatically within a minute.

## Good to know

- **Render free tier sleeps** after ~15 min without visitors; the first request takes ~30–60 s to wake it. The site pings the backend as soon as someone opens it, so it's usually awake by the time they reach the form.
- **Add a project:** copy one `<article class="proj">…</article>` block in `index.html` and change the text and link.
- **Change your photo:** replace `frontend/assets/profile.jpg` (square image works best).
- **Add your CV download:** put `cv.pdf` in `frontend/assets/` and add
  `<a href="assets/cv.pdf" class="btn ghost" download>Download CV</a>` next to the hero buttons.
- Your phone number and home address are intentionally **not** on the public site.

## Troubleshooting

| Problem | Fix |
|---|---|
| Form says "Couldn't reach the server" | Check `config.js` has the right Render URL and you pushed it; open `/api/health` to wake the server. |
| Error mentioning **CORS** | `ALLOWED_ORIGINS` on Render must exactly match your Vercel URL (https, no `/` at the end). |
| Message sent but no email | `RESEND_API_KEY` missing, or Resend account email ≠ `TO_EMAIL`. Check Render → **Logs**. |
| Vercel shows 404 | Root Directory must be `frontend`. |
