// Browser checks for the portfolio: accessibility (axe), layout, keyboard, form states.
// 1) Serve the frontend (VS Code Live Server on :5500)  2) cd qa && npm install && npx playwright install chromium && npm test
const { chromium } = require('@playwright/test');
const fs = require('fs');
const AXE = fs.readFileSync(__dirname + '/node_modules/axe-core/axe.min.js', 'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:5500/';
const OUT = __dirname + '/screenshots/';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page._errors = [];
  page.on('pageerror', e => page._errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|net::ERR|status of 404 \(File not found\)|status of 429/.test(m.text())) page._errors.push(m.text()); });
  // Mock the Render backend so the real config.js URL is exercised.
  await page.route(/onrender\.com\/api\/health/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  return { ctx, page };
}
async function axe(page, label) {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return res.violations.map(v => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`);
  });
  check(`axe accessibility — ${label}`, r.length === 0, r.join(' ; '));
}

(async () => {
  const browser = await chromium.launch();

  // ---------- Desktop ----------
  let { ctx, page } = await newPage(browser);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('page title', (await page.title()) === 'Shihab Hossain — Aspiring SQA Engineer');
  const meta = await page.evaluate(() => ({
    desc: document.querySelector('meta[name=description]')?.content,
    og: document.querySelector('meta[property="og:image"]')?.content,
    canon: document.querySelector('link[rel=canonical]')?.href,
    tw: document.querySelector('meta[name="twitter:card"]')?.content,
  }));
  check('meta description present', !!meta.desc && meta.desc.length > 80);
  check('og:image is absolute https URL', /^https:\/\/.+\/assets\/og-image\.png$/.test(meta.og || ''), meta.og);
  check('canonical + twitter card', !!meta.canon && meta.tw === 'summary_large_image');
  check('exactly one h1', (await page.locator('h1').count()) === 1);
  const heads = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,h5')].map(h => +h.tagName[1]));
  const skipped = heads.some((lvl, i) => i > 0 && lvl - heads[i - 1] > 1);
  check('heading levels never skip', !skipped, heads.join(','));
  await axe(page, 'desktop');

  // internal anchors
  const badAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h)));
  check('all in-page links resolve', badAnchors.length === 0, badAnchors.join(','));

  // external links open safely
  const unsafe = await page.evaluate(() => [...document.querySelectorAll('a[target=_blank]')].filter(a => !/noopener/.test(a.rel)).map(a => a.href));
  check('target=_blank links use rel=noopener', unsafe.length === 0, unsafe.join(','));

  // counters / zeros: no stat renders as a bare 0
  const zeros = await page.evaluate(() => [...document.querySelectorAll('.evidence dd')].map(d => d.firstChild.textContent.trim()));
  check('evidence numbers are real values (57, 8, 71)', zeros.join(',') === '57,8,71', zeros.join(','));

  // images
  const imgs = await page.evaluate(async () => {
    const list = [...document.images];
    for (const img of list) { img.loading = 'eager'; img.scrollIntoView(); await img.decode().catch(() => {}); }
    return list.map(i => ({ alt: i.alt, w: i.getAttribute('width'), h: i.getAttribute('height'), nat: i.naturalWidth, src: i.currentSrc }));
  });
  check('images have alt + width/height and load', imgs.every(i => i.alt && i.w && i.h && i.nat > 0), JSON.stringify(imgs));

  // skip link is first focusable and becomes visible
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { cls: a.className, top: r.top }; });
  check('first Tab focuses visible skip link', skip.cls === 'skip-link' && skip.top >= 0, JSON.stringify(skip));
  await page.keyboard.press('Enter');
  check('skip link moves focus to main', await page.evaluate(() => document.activeElement.id === 'main'));

  // focus indicator visible on a button
  await page.focus('.hero-actions .btn-primary');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  check('keyboard focus outline visible', outline !== 'none', outline);

  // arrow keys scroll normally (no hijack)
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.mouse.click(5, 300);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const y = await page.evaluate(() => window.scrollY);
  check('ArrowDown performs normal small scroll (not slide jump)', y > 0 && y < 200, 'scrollY=' + y);

  // CV hidden while PDF missing
  check('CV buttons hidden when PDF absent', await page.locator('#cvLink').isHidden());

  await page.screenshot({ path: OUT + 'desktop-full.png', fullPage: true });

  // ---------- Contact form ----------
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.click('#sendBtn');
  const inv = await page.evaluate(() => ['f-name', 'f-email', 'f-message'].map(id => document.getElementById(id).getAttribute('aria-invalid')));
  check('empty submit marks all 3 fields invalid', inv.every(v => v === 'true'), inv.join(','));
  check('focus moves to first invalid field', await page.evaluate(() => document.activeElement.id === 'f-name'));
  check('error text announced in status', /fix the highlighted/i.test(await page.textContent('#formStatus')));
  await page.fill('#f-name', 'QA Recruiter');
  await page.fill('#f-email', 'not-an-email');
  await page.fill('#f-message', 'short');
  await page.click('#sendBtn');
  check('invalid email message', /valid email/i.test(await page.textContent('#f-email-err')));
  check('too-short message error', /at least 10/i.test(await page.textContent('#f-message-err')));
  await page.screenshot({ path: OUT + 'form-errors.png', clip: await page.locator('#contactForm').boundingBox() });

  // success path
  let posted = null;
  await page.route(/onrender\.com\/api\/contact/, async r => { posted = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"emailed":true}' }); });
  await page.fill('#f-email', 'recruiter@example.com');
  await page.fill('#f-message', 'Hello Shihab, we have a junior QA opening.');
  await page.click('#sendBtn');
  await page.waitForSelector('.form-status.is-success');
  check('valid submit posts correct payload', posted && posted.email === 'recruiter@example.com' && posted.website === '', JSON.stringify(posted));
  check('success message shown + form reset', (await page.inputValue('#f-name')) === '' && /message was sent/i.test(await page.textContent('#formStatus')));
  await page.screenshot({ path: OUT + 'form-success.png', clip: await page.locator('#contactForm').boundingBox() });

  // server error path
  await page.unroute(/onrender\.com\/api\/contact/);
  await page.route(/onrender\.com\/api\/contact/, r => r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"Too many messages — please try again in a few minutes."}' }));
  await page.fill('#f-name', 'A'); await page.fill('#f-email', 'a@b.co'); await page.fill('#f-message', 'Testing the error path.');
  await page.click('#sendBtn');
  await page.waitForSelector('.form-status.is-error');
  const errTxt = await page.textContent('#formStatus');
  check('server error shows server message + email fallback', /Too many messages/.test(errTxt) && /hossainshihab2001@gmail\.com/.test(errTxt), errTxt);
  check('button re-enabled after error', await page.isEnabled('#sendBtn'));

  // network failure path
  await page.unroute(/onrender\.com\/api\/contact/);
  await page.route(/onrender\.com\/api\/contact/, r => r.abort('failed'));
  await page.click('#sendBtn');
  await page.waitForFunction(() => /couldn't reach/i.test(document.getElementById('formStatus').textContent));
  check('network failure shows fallback', true);
  check('no JS errors on desktop', page._errors.length === 0, page._errors.join(' | '));
  await ctx.close();

  // ---------- CV appears when the PDF exists ----------
  ({ ctx, page } = await newPage(browser));
  await page.route('**/assets/Shihab-Hossain-CV.pdf', r => r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('CV buttons appear when PDF exists', (await page.locator('#cvLink').isVisible()) && !(await page.locator('#cvContactItem').isHidden()));
  await ctx.close();

  // ---------- Responsive widths ----------
  for (const w of [320, 375, 414, 768, 1024, 1280]) {
    ({ ctx, page } = await newPage(browser, { viewport: { width: w, height: 800 } }));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no horizontal page scroll at ${w}px`, over <= 0, 'overflow=' + over);
    await ctx.close();
  }

  // ---------- Mobile ----------
  ({ ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('mobile menu collapsed by default', (await page.getAttribute('#menuToggle', 'aria-expanded')) === 'false' && await page.locator('#siteNav').isHidden());
  await page.click('#menuToggle');
  check('menu opens with aria-expanded=true', (await page.getAttribute('#menuToggle', 'aria-expanded')) === 'true' && await page.locator('#siteNav').isVisible());
  await axe(page, 'mobile, menu open');
  await page.keyboard.press('Escape');
  check('Escape closes menu and returns focus', (await page.getAttribute('#menuToggle', 'aria-expanded')) === 'false' && await page.evaluate(() => document.activeElement.id === 'menuToggle'));
  await page.click('#menuToggle'); await page.click('#siteNav a[href="#skills"]');
  check('tapping a menu link closes the menu', (await page.getAttribute('#menuToggle', 'aria-expanded')) === 'false');
  const tapSmall = await page.evaluate(() => [...document.querySelectorAll('.btn, .menu-toggle, .site-nav a, .contact-link')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 40).map(e => e.textContent.trim().slice(0, 20)));
  check('tap targets ≥ 40px tall', tapSmall.length === 0, tapSmall.join(','));
  // scroll through for reveal then screenshot
  const H = await page.evaluate(() => document.body.scrollHeight);
  for (let yy = 0; yy < H; yy += 500) { await page.evaluate(v => scrollTo(0, v), yy); await page.waitForTimeout(80); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + 'mobile-full.png', fullPage: true });
  await axe(page, 'mobile');
  check('no JS errors on mobile', page._errors.length === 0, page._errors.join(' | '));
  await ctx.close();

  // ---------- Reduced motion ----------
  ({ ctx, page } = await newPage(browser, { reducedMotion: 'reduce' }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('reduced motion: no reveal animations applied', (await page.locator('.reveal').count()) === 0);
  const sb = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  check('reduced motion: smooth scroll disabled', sb === 'auto', sb);
  await ctx.close();

  // ---------- JavaScript disabled ----------
  ({ ctx, page } = await newPage(browser, { javaScriptEnabled: false }));
  await page.goto(BASE);
  const noJs = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, cases: document.querySelectorAll('.case').length, ev: [...document.querySelectorAll('.evidence dd')].map(d => d.firstChild.textContent.trim()).join(','), hiddenCount: [...document.querySelectorAll('.case,.skill-group')].filter(e => getComputedStyle(e).opacity === '0').length }));
  check('no-JS: full content visible, real numbers', noJs.h1 === 'Shihab Hossain' && noJs.cases === 2 && noJs.ev === '57,8,71' && noJs.hiddenCount === 0, JSON.stringify(noJs));
  await ctx.close();

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
