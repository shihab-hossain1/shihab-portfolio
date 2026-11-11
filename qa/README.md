# Portfolio QA checks

Automated checks that run on every push (see `.github/workflows/portfolio-tests.yml`):

- **HTML validation** with html-validate
- **Accessibility** scan with axe-core (WCAG 2.1 A/AA) on desktop and mobile
- **Links**: every in-page link resolves, each project links to its own verified repository, new-tab links are safe
- **CV download** is present and served as a PDF
- **Images** load and have alt text; the screenshot lightbox opens and closes
- **Sample bug report** contains steps, expected and actual result, and regression tests
- **Contact form**: empty, invalid email, success and server-error paths (the API is mocked; no real messages are sent)
- **Responsive**: no sideways scrolling from 320 px to 1280 px; the mobile menu works
- **Without JavaScript** the numbers show real values; **reduced-motion** users see everything

## Run locally

1. Serve the site: in VS Code, right-click `frontend/index.html` → **Open with Live Server** (port 5500).
2. Then:

```bash
cd qa
npm install
npx playwright install chromium
npm test
```

Test another address with `BASE_URL`, e.g. PowerShell: `$env:BASE_URL="https://shihab-portfolio-frontend.vercel.app/"; npm test`.
Screenshots are saved in `qa/screenshots/`.
