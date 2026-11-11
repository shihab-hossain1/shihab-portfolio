# Portfolio QA checks

45 automated checks for the portfolio frontend: HTML validation, axe-core accessibility (WCAG 2.1 A/AA),
keyboard and skip-link behaviour, mobile menu, no horizontal scroll from 320 px to 1280 px,
reduced motion, no-JavaScript rendering, metadata, and every contact-form state
(empty, invalid, success, server error, network failure). The backend is mocked, so no real messages are sent.

## Run

1. Serve the site: in VS Code, right-click `frontend/index.html` → **Open with Live Server** (port 5500).
2. In a terminal:

```bash
cd qa
npm install
npx playwright install chromium
npm test
```

Use another address with `BASE_URL`, e.g. `BASE_URL=https://shihab-portfolio-frontend.vercel.app/ npm test`
(PowerShell: `$env:BASE_URL="https://shihab-portfolio-frontend.vercel.app/"; npm test`).

Screenshots are saved to `qa/screenshots/`.
