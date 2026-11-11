// =====================================================================
//  Portfolio QA checks — run locally or in GitHub Actions.
//  Serves nothing itself: point BASE_URL at a running copy of frontend/.
//    BASE_URL=http://localhost:5500/ node portfolio.check.js
//  The contact API is mocked, so no real messages are ever sent.
// =====================================================================
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5500/';
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

// Only these repositories exist and may be linked from project cards.
const VERIFIED_REPOS = [
  'https://github.com/shihab-hossain1/DiagnoCare_2.0',
  'https://github.com/shihab-hossain1/SQA-shihab-assignment',
  'https://github.com/shihab-hossain1/Database_Project',
];

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function openPage(browser, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await context.newPage();
  page.jsErrors = [];
  page.on('pageerror', e => page.jsErrors.push(e.message));
  // Mock the backend so tests never depend on (or spam) the real server.
  await page.route(/\/api\/health/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  return { context, page };
}

async function revealAll(page) {
  await page.evaluate(() => document.querySelectorAll('section.slide').forEach(s => s.classList.add('in')));
  await page.waitForTimeout(1200);
}

async function runAxe(page, label) {
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return r.violations.map(v => `${v.id} (${v.impact}) ×${v.nodes.length}`);
  });
  check(`accessibility (axe, WCAG 2.1 AA) — ${label}`, violations.length === 0, violations.join('; '));
}

(async () => {
  const browser = await chromium.launch();

  // ---------------- Content & links (desktop) ----------------
  let { context, page } = await openPage(browser);
  await page.goto(BASE, { waitUntil: 'networkidle' });

  check('title presents an SQA engineer', /SQA Engineer/.test(await page.title()), await page.title());
  const meta = await page.evaluate(() => ({
    desc: document.querySelector('meta[name=description]')?.content || '',
    og: document.querySelector('meta[property="og:image"]')?.content || '',
  }));
  check('meta description is present', meta.desc.length > 60);
  check('og:image is an absolute https URL', /^https:\/\//.test(meta.og), meta.og);

  const badAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
    .map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h)));
  check('every in-page link points to an existing section', badAnchors.length === 0, badAnchors.join(', '));

  const unsafe = await page.evaluate(() => [...document.querySelectorAll('a[target=_blank]')]
    .filter(a => !/noopener/.test(a.rel)).map(a => a.href));
  check('new-tab links use rel="noopener"', unsafe.length === 0, unsafe.join(', '));

  const projectLinks = await page.$$eval('#projects .proj-link', as => as.map(a => a.href.replace(/\/$/, '')));
  const wrong = projectLinks.filter(h => !VERIFIED_REPOS.includes(h));
  check('each project links to its own verified repository', projectLinks.length === 3 && wrong.length === 0, wrong.join(', ') || projectLinks.join(', '));

  const cvLinks = await page.$$eval('a[href$="Shihab-Hossain-CV.pdf"]', as => as.length);
  const cv = await page.evaluate(async () => {
    const r = await fetch('assets/Shihab-Hossain-CV.pdf', { method: 'HEAD' });
    return { status: r.status, type: r.headers.get('content-type') || '' };
  });
  check('CV download links exist and the PDF is served', cvLinks >= 2 && cv.status === 200 && cv.type.includes('pdf'), `${cvLinks} links, ${cv.status} ${cv.type}`);

  await revealAll(page);
  const imgs = await page.evaluate(async () => {
    // The site's own images (skip the lightbox placeholder and externally hosted badges).
    const list = [...document.querySelectorAll('main img')]
      .filter(i => !i.closest('dialog') && new URL(i.src).origin === location.origin);
    for (const img of list) { img.loading = 'eager'; await img.decode().catch(() => {}); }
    return list.map(i => ({ src: i.getAttribute('src'), alt: i.alt, ok: i.naturalWidth > 0 }));
  });
  const brokenImgs = imgs.filter(i => !i.ok || !i.alt);
  check('all images load and have alt text', brokenImgs.length === 0, brokenImgs.map(i => i.src).join(', '));

  const bug = await page.evaluate(() => [...document.querySelectorAll('#bug-report dt')].map(d => d.textContent.trim()));
  const needed = ['Steps to reproduce', 'Expected result', 'Actual result', 'Regression tests'];
  check('sample bug report has the essential fields', needed.every(n => bug.includes(n)), bug.join(', '));

  await runAxe(page, 'desktop');

  // Lightbox
  await page.click('#bug-report a[data-lightbox]');
  const opened = await page.evaluate(() => document.getElementById('lightbox').open);
  await page.click('.lb-close');
  const closed = await page.evaluate(() => !document.getElementById('lightbox').open);
  check('proof screenshot opens and closes in the lightbox', opened && closed);
  await page.screenshot({ path: path.join(OUT, 'desktop.png'), fullPage: false });

  // ---------------- Course carousel ----------------
  const cardCount = await page.$$eval('#courses .cs-card', c => c.length);
  const activeTitle = () => page.$eval('#courses .cs-card.is-active h3', e => e.textContent);
  const first = await activeTitle();
  await page.click('#courses .cs-next');
  const second = await activeTitle();
  await page.click('#courses .cs-prev');
  const back = await activeTitle();
  check('course carousel has 4 cards and the arrows change the card', cardCount === 4 && second !== first && back === first, `${cardCount} cards`);
  const hiddenReachable = await page.$$eval('#courses .cs-card[aria-hidden="true"]', cs => cs.filter(c => !c.inert).length);
  check('hidden course cards are not reachable by keyboard', hiddenReachable === 0);
  await page.click('#courses .cs-pause');
  check('course carousel can be paused', (await page.getAttribute('#courses .cs-pause', 'aria-label')) === 'Play automatic slide changes');

  // ---------------- Contact form ----------------
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.click('#sendBtn');
  check('empty form shows a validation message', /fill in/i.test(await page.textContent('#formStatus')));

  await page.fill('[name=name]', 'QA Recruiter');
  await page.fill('[name=email]', 'not-an-email');
  await page.fill('[name=message]', 'Hello');
  await page.click('#sendBtn');
  check('invalid email is rejected', /valid email/i.test(await page.textContent('#formStatus')));

  let posted = null;
  await page.route(/\/api\/contact/, async r => {
    posted = JSON.parse(r.request().postData());
    await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.fill('[name=email]', 'recruiter@example.com');
  await page.click('#sendBtn');
  await page.waitForFunction(() => /Thanks/.test(document.getElementById('formStatus').textContent));
  check('valid message is sent and confirmed', posted && posted.email === 'recruiter@example.com' && (await page.inputValue('[name=name]')) === '');

  await page.unroute(/\/api\/contact/);
  await page.route(/\/api\/contact/, r => r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"Too many messages — please try again in a few minutes."}' }));
  await page.fill('[name=name]', 'A'); await page.fill('[name=email]', 'a@b.co'); await page.fill('[name=message]', 'Error path');
  await page.click('#sendBtn');
  await page.waitForFunction(() => /Too many/.test(document.getElementById('formStatus').textContent));
  check('server errors are shown with an email fallback', /hossainshihab2001@gmail\.com/.test(await page.textContent('#formStatus')));
  check('no JavaScript errors (desktop)', page.jsErrors.length === 0, page.jsErrors.join(' | '));
  await context.close();

  // ---------------- Responsive layout ----------------
  for (const width of [320, 375, 768, 1024, 1280]) {
    ({ context, page } = await openPage(browser, { viewport: { width, height: 800 } }));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await revealAll(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no sideways scrolling at ${width}px`, overflow <= 0, `overflow ${overflow}px`);
    await context.close();
  }

  // ---------------- Mobile ----------------
  ({ context, page } = await openPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('#burger');
  const menuOpen = await page.evaluate(() => document.getElementById('links').classList.contains('open'));
  await page.click('#links a[href="#bug-report"]');
  const menuClosed = await page.evaluate(() => !document.getElementById('links').classList.contains('open'));
  check('mobile menu opens and closes after choosing a link', menuOpen && menuClosed);
  await revealAll(page);
  await runAxe(page, 'mobile');
  await page.screenshot({ path: path.join(OUT, 'mobile.png'), fullPage: true });
  check('no JavaScript errors (mobile)', page.jsErrors.length === 0, page.jsErrors.join(' | '));
  await context.close();

  // ---------------- Without JavaScript ----------------
  ({ context, page } = await openPage(browser, { javaScriptEnabled: false }));
  await page.goto(BASE);
  const stats = await page.$$eval('.stats strong', els => els.map(e => e.textContent.trim()));
  check('numbers show real values even without JavaScript (no "0")', stats.join(',') === '3.88,57,8,71', stats.join(','));
  await context.close();

  // ---------------- Reduced motion ----------------
  ({ context, page } = await openPage(browser, { reducedMotion: 'reduce' }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.rv')].filter(e => getComputedStyle(e).opacity === '0').length);
  check('reduced-motion users see all content immediately', hidden === 0, `${hidden} hidden`);
  const startCard = await page.$eval('#courses .cs-card.is-active', e => e.getAttribute('aria-label'));
  await page.waitForTimeout(5200);
  const laterCard = await page.$eval('#courses .cs-card.is-active', e => e.getAttribute('aria-label'));
  check('reduced-motion users get no automatic slide changes', startCard === laterCard);
  await context.close();

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
