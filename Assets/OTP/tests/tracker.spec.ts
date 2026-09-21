/**
 * otp-v0.12 A2 · Teacher Tracker
 *
 * Tests the BUILT artifacts (the StatiCrypt-gated tracker, plus the gated
 * form's Check Teacher link and the ungated viewer's lock-out), not the
 * master, because the master's relative paths (../brand/) resolve from the
 * OUTPUT location. Run `bash Assets/OTP/encrypt.sh` before this spec.
 *
 * Every call to supabase.co (and, for the two Check-Teacher-link specs,
 * script.google.com) is mocked; nothing leaves the machine, except the ONE
 * documented live curl the builder ran by hand to confirm the payload shape
 * (not part of this spec).
 */
import { test, expect, Browser, Page, Locator, Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TRACKER_URL = '/Assets/OTP/otp-tracker.html';
const FORM_URL = '/Assets/OTP/otp-progress-form.html';
const VIEWER_URL = '/Assets/OTP/otp-record.html';
const GATE_PASSWORD = 'ais2026ais';

/** Mirrors the page's own fmtDayShort (STRIP-003 rule): a date-only value
 *  is a calendar date, parsed by hand as local, never through `new
 *  Date('YYYY-MM-DD')`. Computed here in Node, same host/timezone as the
 *  Playwright browser process, so it never needs a hardcoded day string. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function expectedDayShort(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()];
}

/** The seven required-coverage fixture teachers (PLAN-A.md section 4 + the
 *  builder brief): never observed; open with emails pending; open with
 *  emails sent; closed; open lap 2 with a closed lap 1 in history; closed
 *  lap 3 with two earlier; an on_roster:false test teacher with one open
 *  record. Field names are the REAL get_otp_tracker() keys (verified
 *  against the live function), never invented ones. Handed to mockTracker
 *  out of alphabetical order on purpose, to prove the page sorts them. */
const FIXTURES = [
  {
    name: 'Farah Nasser', section: 'secondary', on_roster: true, observation_count: 1,
    open: { lap: 1, observation_date: '2026-09-10', observer: 'Marcus Lee', emails_done: true },
    open_count: 1, last_closed: null,
    history: [{ lap: 1, state: 'open', observation_date: '2026-09-10', observer: 'Marcus Lee', closed_at: '', emails_done: true }],
  },
  {
    name: 'Zoe Larkin', section: 'secondary', on_roster: true, observation_count: 0,
    open: null, open_count: 0, last_closed: null, history: [],
  },
  {
    name: 'Amit Rao', section: 'primary', on_roster: true, observation_count: 1,
    open: { lap: 1, observation_date: '2026-09-14', observer: 'Dana Cole', emails_done: false },
    open_count: 1, last_closed: null,
    history: [{ lap: 1, state: 'open', observation_date: '2026-09-14', observer: 'Dana Cole', closed_at: '', emails_done: false }],
  },
  {
    name: 'Priya Menon', section: 'primary', on_roster: true, observation_count: 1,
    open: null, open_count: 0,
    last_closed: { lap: 1, observation_date: '2026-09-05', observer: 'Dana Cole', closed_at: '2026-09-06T08:00:00.000Z' },
    history: [{ lap: 1, state: 'closed', observation_date: '2026-09-05', observer: 'Dana Cole', closed_at: '2026-09-06T08:00:00.000Z', emails_done: true }],
  },
  {
    name: 'Idris Osei', section: 'secondary', on_roster: true, observation_count: 2,
    open: { lap: 2, observation_date: '2026-09-18', observer: 'Marcus Lee', emails_done: false },
    open_count: 1, last_closed: null,
    history: [
      { lap: 1, state: 'closed', observation_date: '2026-08-20', observer: 'Dana Cole', closed_at: '2026-08-21T08:00:00.000Z', emails_done: true },
      { lap: 2, state: 'open', observation_date: '2026-09-18', observer: 'Marcus Lee', closed_at: '', emails_done: false },
    ],
  },
  {
    name: 'Beatrix Yun', section: 'secondary', on_roster: true, observation_count: 3,
    open: null, open_count: 0,
    last_closed: { lap: 3, observation_date: '2026-09-15', observer: 'Dana Cole', closed_at: '2026-09-16T08:00:00.000Z' },
    history: [
      { lap: 1, state: 'closed', observation_date: '2026-08-10', observer: 'Marcus Lee', closed_at: '2026-08-11T08:00:00.000Z', emails_done: true },
      { lap: 2, state: 'closed', observation_date: '2026-08-25', observer: 'Dana Cole', closed_at: '2026-08-26T08:00:00.000Z', emails_done: true },
      { lap: 3, state: 'closed', observation_date: '2026-09-15', observer: 'Dana Cole', closed_at: '2026-09-16T08:00:00.000Z', emails_done: true },
    ],
  },
  {
    name: 'OTP Test Teacher (delete me)', section: null, on_roster: false, observation_count: 1,
    open: { lap: 1, observation_date: '2026-09-19', observer: 'Dana Cole', emails_done: true },
    open_count: 1, last_closed: null,
    history: [{ lap: 1, state: 'open', observation_date: '2026-09-19', observer: 'Dana Cole', closed_at: '', emails_done: true }],
  },
];
const SORTED_NAMES = [...FIXTURES].map((t) => t.name).sort((a, b) => a.localeCompare(b));

function trackerPayload(teachers: any[]) {
  return { success: true, school_year: '2026/2027', generated_at: '2026-09-21T12:00:00.000Z', teachers };
}

async function harness(page: Page): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.route('**/fonts.googleapis.com/**', (r: Route) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/fonts.gstatic.com/**', (r: Route) => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));
  await page.route('**/favicon.ico', (r: Route) => r.fulfill({ status: 200, contentType: 'image/x-icon', body: '' }));
  return { errors };
}

async function mockTracker(page: Page, teachers: any[]) {
  await page.route('**/rest/v1/rpc/get_otp_tracker', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(trackerPayload(teachers)) }),
  );
}

async function passGate(page: Page) {
  await page.fill('#staticrypt-password', GATE_PASSWORD);
  await page.click('#staticrypt-form .staticrypt-decrypt-button');
  await page.waitForSelector('#tt-rows', { state: 'attached' });
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
}

async function openTracker(page: Page, query = '') {
  await page.goto(TRACKER_URL + query);
  await passGate(page);
}

function rowByName(page: Page, name: string): Locator {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.locator('.tt-row').filter({ has: page.locator('.tt-name', { hasText: new RegExp(`^${escaped}$`) }) });
}

async function visibleNames(page: Page): Promise<string[]> {
  return page.locator('.tt-row:visible .tt-name').allTextContents();
}

/** Reads the class list of every main-row step icon and returns its
 *  'is-<state>' word, in order (index 0..5), the same shape stepsFor()
 *  builds on the page. */
async function stepStates(row: Locator): Promise<string[]> {
  const icons = row.locator('.tt-icons > .tt-step');
  const count = await icons.count();
  const states: string[] = [];
  for (let i = 0; i < count; i++) {
    const cls = (await icons.nth(i).getAttribute('class')) || '';
    const m = /is-(pending|coming|completed|current)/.exec(cls);
    states.push(m ? m[1] : '?');
  }
  return states;
}

const TT_WIDTHS = [
  { width: 744, height: 1133 },
  { width: 834, height: 1194 },
  { width: 1024, height: 1366 },
];

/* ==========================================================================
 * Row state mapping (the three shapes + the two open sub-cases)
 * ========================================================================== */

test('otp-v0.12 A2: never observed shows the badge and pending steps, no grey line', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Zoe Larkin');
  await expect(row.locator('.tt-obs-badge')).toHaveText('Not observed yet');
  await expect(row.locator('.tt-obs-badge')).not.toHaveClass(/has-obs/);
  await expect(row.locator('.tt-subline')).toHaveCount(0);
  expect(await stepStates(row)).toEqual(['pending', 'coming', 'pending', 'pending', 'coming', 'pending']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: open with emails pending shows the Active pill and an emails-pending grey line', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Amit Rao');
  await expect(row.locator('.tt-obs-badge')).toHaveText('Observation 1');
  await expect(row.locator('.tt-obs-badge')).toHaveClass(/has-obs/);
  await expect(row.locator('.tt-subline')).toHaveText(`open since ${expectedDayShort('2026-09-14')} · coach Dana Cole`);
  expect(await stepStates(row)).toEqual(['completed', 'coming', 'pending', 'current', 'coming', 'pending']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: open with emails sent shows the Active pill and an open-since grey line', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Farah Nasser');
  await expect(row.locator('.tt-obs-badge')).toHaveText('Observation 1');
  await expect(row.locator('.tt-subline')).toHaveText(`open since ${expectedDayShort('2026-09-10')} · coach Marcus Lee`);
  expect(await stepStates(row)).toEqual(['completed', 'coming', 'completed', 'current', 'coming', 'pending']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: closed shows all completed steps, ticks on every completed circle, and a completed grey line', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Priya Menon');
  await expect(row.locator('.tt-obs-badge')).toHaveText('Observation 1');
  await expect(row.locator('.tt-subline')).toHaveText(`completed ${expectedDayShort('2026-09-06T08:00:00.000Z')}`);
  expect(await stepStates(row)).toEqual(['completed', 'coming', 'completed', 'completed', 'coming', 'completed']);
  // 4 completed circles (indices 0, 2, 3, 5), each carrying its tick badge.
  expect(await row.locator('.tt-step.is-completed .tt-tick').count()).toBe(4);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: an on_roster false test teacher is shown like any other row', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'OTP Test Teacher (delete me)');
  await expect(row.locator('.tt-obs-badge')).toHaveText('Observation 1');
  await expect(row.locator('.tt-subline')).toHaveText(`open since ${expectedDayShort('2026-09-19')} · coach Dana Cole`);
  expect(await visibleNames(page)).toContain('OTP Test Teacher (delete me)');
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Counts, order, chips, search
 * ========================================================================== */

test('otp-v0.12 A2: the three top counts are correct', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await expect(page.locator('#tile-observed-num')).toHaveText('6 of 7');
  await expect(page.locator('#tile-open-num')).toHaveText('4');
  await expect(page.locator('#tile-none-num')).toHaveText('1');
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: teachers render A to Z regardless of payload order', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  expect(await visibleNames(page)).toEqual(SORTED_NAMES);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: chip Not observed shows exactly the never-observed rows', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await page.locator('.pill[data-chip="not-observed"]').click();
  expect(await visibleNames(page)).toEqual(['Zoe Larkin']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: chip Observation shows never-observed and latest-closed rows', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await page.locator('.pill[data-chip="observation"]').click();
  expect(await visibleNames(page)).toEqual(['Beatrix Yun', 'Priya Menon', 'Zoe Larkin']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: chip Emails shows only open rows with emails not yet sent', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await page.locator('.pill[data-chip="emails"]').click();
  expect(await visibleNames(page)).toEqual(['Amit Rao', 'Idris Osei']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: chip Feedback Meeting shows every open row, regardless of emails', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await page.locator('.pill[data-chip="feedback"]').click();
  expect(await visibleNames(page)).toEqual(['Amit Rao', 'Farah Nasser', 'Idris Osei', 'OTP Test Teacher (delete me)']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: chip Completed shows only rows with no open and a last closed lap', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await page.locator('.pill[data-chip="completed"]').click();
  expect(await visibleNames(page)).toEqual(['Beatrix Yun', 'Priya Menon']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: Reflection Form and Plan Form chips are disabled and marked Coming soon', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await expect(page.locator('.pill[data-chip="reflection"]')).toBeDisabled();
  await expect(page.locator('.pill[data-chip="reflection"]')).toContainText('Coming soon');
  await expect(page.locator('.pill[data-chip="plan"]')).toBeDisabled();
  await expect(page.locator('.pill[data-chip="plan"]')).toContainText('Coming soon');
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: search filters rows by name', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await page.fill('#search-input', 'idris');
  expect(await visibleNames(page)).toEqual(['Idris Osei']);
  await page.fill('#search-input', 'nobody matches this');
  await expect(page.locator('#list-empty')).toBeVisible();
  await page.fill('#search-input', '');
  expect(await visibleNames(page)).toEqual(SORTED_NAMES);
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * History expand/collapse
 * ========================================================================== */

test('otp-v0.12 A2: tap a row expands history in order, tap again collapses', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Idris Osei');
  await expect(row).not.toHaveClass(/is-open/);

  await row.locator('.tt-row-main').click();
  await expect(row).toHaveClass(/is-open/);
  const histRows = row.locator('.tt-hist-row');
  await expect(histRows).toHaveCount(2);
  await expect(histRows.nth(0).locator('.tt-hist-label')).toHaveText(`Observation 1 · Completed ${expectedDayShort('2026-08-21T08:00:00.000Z')}`);
  await expect(histRows.nth(1).locator('.tt-hist-label')).toHaveText('Observation 2');

  await row.locator('.tt-row-main').click();
  await expect(row).not.toHaveClass(/is-open/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: open lap 2 with a closed lap 1 in history renders two rows, oldest first, the active one named only', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Idris Osei');
  await row.locator('.tt-row-main').click();
  const histRows = row.locator('.tt-hist-row');
  await expect(histRows).toHaveCount(2);
  expect(await histRows.nth(0).locator('.tt-hist-icons > .tt-hist-step').evaluateAll((els) => els.map((e) => e.className)))
    .toEqual(['tt-hist-step is-completed', 'tt-hist-step is-coming', 'tt-hist-step is-completed', 'tt-hist-step is-completed', 'tt-hist-step is-coming', 'tt-hist-step is-completed']);
  expect(await histRows.nth(1).locator('.tt-hist-icons > .tt-hist-step').evaluateAll((els) => els.map((e) => e.className)))
    .toEqual(['tt-hist-step is-completed', 'tt-hist-step is-coming', 'tt-hist-step is-pending', 'tt-hist-step is-current', 'tt-hist-step is-coming', 'tt-hist-step is-pending']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: closed lap 3 with two earlier laps renders three history rows, oldest first', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Beatrix Yun');
  await row.locator('.tt-row-main').click();
  const histRows = row.locator('.tt-hist-row');
  await expect(histRows).toHaveCount(3);
  await expect(histRows.nth(0).locator('.tt-hist-label')).toHaveText(`Observation 1 · Completed ${expectedDayShort('2026-08-11T08:00:00.000Z')}`);
  await expect(histRows.nth(1).locator('.tt-hist-label')).toHaveText(`Observation 2 · Completed ${expectedDayShort('2026-08-26T08:00:00.000Z')}`);
  await expect(histRows.nth(2).locator('.tt-hist-label')).toHaveText(`Observation 3 · Completed ${expectedDayShort('2026-09-16T08:00:00.000Z')}`);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: a real touch tap expands a row (WebKit/touch)', async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 834, height: 1194 }, baseURL: 'http://127.0.0.1:8123' });
  const page = await ctx.newPage();
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Idris Osei');
  const box = (await row.locator('.tt-row-main').boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(row).toHaveClass(/is-open/, { timeout: 5_000 });
  expect(h.errors).toEqual([]);
  await ctx.close();
});

/* ==========================================================================
 * The Active pill: one element, measured-fit, never clipped, at 744/834/1024
 * ========================================================================== */

test('otp-v0.12 A2: the Active step renders as one pill at 744/834/1024, never clipped', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  for (const { width, height } of TT_WIDTHS) {
    await page.setViewportSize({ width, height });
    if (!page.url().includes(TRACKER_URL)) {
      await openTracker(page);
      // open one row so its history's own Active pill (Idris Osei lap 2) is measured too
      await rowByName(page, 'Idris Osei').locator('.tt-row-main').click();
    }
    // one pill element per Active step: the icon and its label live inside the SAME .tt-step/.tt-hist-step
    const pillCount = await page.locator('.tt-step.is-current, .tt-hist-step.is-current').count();
    expect(pillCount, `${width}px: expected at least one Active pill`).toBeGreaterThan(0);
    const labelInside = await page.locator('.tt-step.is-current > .tt-pill-label, .tt-hist-step.is-current > .tt-hist-pill-label').count();
    expect(labelInside, `${width}px: every Active pill's label must be its own child, not a floating sibling`).toBe(pillCount);

    const clipped = await page.evaluate(() => {
      const bad: string[] = [];
      document.querySelectorAll('.tt-icons, .tt-hist-icons').forEach((c) => {
        const el = c as HTMLElement;
        if (el.querySelector('.is-current') && el.scrollWidth > el.clientWidth + 1) bad.push(el.className);
      });
      return bad;
    });
    expect(clipped, `${width}px: an Active pill's row overflowed`).toEqual([]);
  }
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: the icon column starts at the same x for every row, one value per width', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);
  for (const { width, height } of TT_WIDTHS) {
    await page.setViewportSize({ width, height });
    const xs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.tt-row .tt-icons')).map((el) => (el.querySelector('.tt-step') as HTMLElement).getBoundingClientRect().x),
    );
    expect(xs.length).toBe(FIXTURES.length);
    const first = xs[0];
    xs.forEach((x, i) => expect(Math.abs(x - first), `${width}px: row ${i} icon column not aligned with row 0`).toBeLessThanOrEqual(1));
  }
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Theme
 * ========================================================================== */

test('otp-v0.12 A2: light and dark themes both render correctly', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  expect(await visibleNames(page)).toEqual(SORTED_NAMES);

  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('ais-form-theme'))).toBe('dark');
  expect(await visibleNames(page)).toEqual(SORTED_NAMES);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: a stored dark preference paints dark before first render', async ({ page, context }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await context.addInitScript(() => { try { localStorage.setItem('ais-form-theme', 'dark'); } catch (e) {} });
  await openTracker(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Resilience (hard rule 12: no error UI, ever)
 * ========================================================================== */

test('otp-v0.12 A2: a stalled first response retries silently and succeeds, no error text ever visible', async ({ page }) => {
  const h = await harness(page);
  let calls = 0;
  await page.route('**/rest/v1/rpc/get_otp_tracker', async (r: Route) => {
    calls++;
    if (calls === 1) {
      await new Promise(() => {}); // never resolves: the page's own AbortController (shortened via ?_tmo) times it out
      return;
    }
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(trackerPayload(FIXTURES)) });
  });
  await openTracker(page, '?_tmo=200');
  expect(await visibleNames(page)).toEqual(SORTED_NAMES);
  expect(calls, 'a second attempt must have been made').toBeGreaterThanOrEqual(2);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: a 500 then a 200 renders rows with no error UI', async ({ page }) => {
  const h = await harness(page);
  let calls = 0;
  await page.route('**/rest/v1/rpc/get_otp_tracker', (r: Route) => {
    calls++;
    if (calls === 1) return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(trackerPayload(FIXTURES)) });
  });
  await openTracker(page);
  expect(await visibleNames(page)).toEqual(SORTED_NAMES);
  expect(calls, 'a second attempt must have been made').toBeGreaterThanOrEqual(2);
  // the browser's own network log for the mocked 500 is the only line allowed
  // (otp.spec.ts's "an HTTP 500... the only allowed console line" pattern);
  // no error UI is ever rendered by the page itself.
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('otp-v0.12 A2: the Refresh button re-fetches', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, [FIXTURES[0]]);
  await openTracker(page);
  expect(await visibleNames(page)).toEqual([FIXTURES[0].name]);

  await page.unroute('**/rest/v1/rpc/get_otp_tracker');
  await mockTracker(page, FIXTURES);
  await page.locator('#btn-refresh').click();
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
  expect(await visibleNames(page)).toEqual(SORTED_NAMES);
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * No forbidden content is ever rendered
 * ========================================================================== */

test('otp-v0.12 A2: no token-looking string or forbidden key is ever rendered', async ({ page }) => {
  const h = await harness(page);
  const decoy = {
    name: 'Decoy Carter', section: 'secondary', on_roster: true, observation_count: 1,
    open: {
      lap: 1, observation_date: '2026-09-12', observer: 'Dana Cole', emails_done: true,
      record_token: 'deadbeefdeadbeefdeadbeefdeadbeef', rating: 5, next_step_1: 'Should never render',
    },
    open_count: 1, last_closed: null,
    history: [{ lap: 1, state: 'open', observation_date: '2026-09-12', observer: 'Dana Cole', closed_at: '', emails_done: true, record_token: 'deadbeefdeadbeefdeadbeefdeadbeef' }],
  };
  await mockTracker(page, [decoy]);
  await openTracker(page);
  // expand history too, so a leak hiding only in the collapsed section is not missed
  await rowByName(page, 'Decoy Carter').locator('.tt-row-main').click();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('deadbeef');
  expect(bodyText.toLowerCase()).not.toContain('rating');
  expect(bodyText).not.toContain('Should never render');
  expect(bodyText).not.toContain('sb_publishable');
  expect(bodyText).not.toContain('supabase.co');
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Lock-out (the owner: "it's not their business to know what other
 * teachers are up to")
 * ========================================================================== */

test('otp-v0.12 A2: the built tracker file holds no fixture data, no Supabase key, and shows only the password gate', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'otp-tracker.html'), 'utf8');
  expect(bytes).not.toContain('sb_publishable');
  expect(bytes).not.toContain('supabase.co');
  // fixture-only names/markers, never baked into a build that fetches live:
  expect(bytes).not.toContain('Amit Rao');
  expect(bytes).not.toContain('Idris Osei');
  expect(bytes).not.toContain('tt-rows');       // the real markup sits inside StatiCrypt's ciphertext
  expect(bytes).not.toContain('get_otp_tracker'); // the RPC name itself never appears in cleartext
  expect(bytes).toContain('staticrypt-password');
});

test('otp-v0.12 A2: the viewer build has no visible Check Teacher link, no reachable route to the tracker, and stays keyless', async ({ page }) => {
  const h = await harness(page);
  await page.route('**/*.supabase.co/**', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/script.google.com/**', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'no record' }) }));
  await page.goto(VIEWER_URL);

  await expect(page.locator('.float-link.check')).toBeHidden();
  const reachable = await page.locator('a:visible[href*="otp-tracker"]').count();
  expect(reachable, 'no visible, tappable route to the tracker from the viewer').toBe(0);

  const bytes = fs.readFileSync(path.join(__dirname, '..', 'otp-record.html'), 'utf8');
  expect(bytes).toMatch(/const SB_URL = '';/);
  expect(bytes).toMatch(/const SB_KEY = '';/);
  expect(h.errors).toEqual([]);
});

test("otp-v0.12 A2: the gated form's Check Teacher link points at the tracker, target=_blank", async ({ page }) => {
  const h = await harness(page);
  await page.route('**/*.supabase.co/**', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/script.google.com/**', (r: Route) => {
    const url = r.request().url();
    if (url.includes('action=options')) {
      return r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, options: { teachers: [], inspectors: [], curricula: [], schools: [], subjects: [] } }),
      });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'not needed for this spec' }) });
  });
  await page.goto(FORM_URL);
  await page.fill('#staticrypt-password', GATE_PASSWORD);
  await page.click('#staticrypt-form .staticrypt-decrypt-button');
  await page.waitForSelector('#otp-form', { state: 'attached' });

  const link = page.locator('a.float-link.check');
  await expect(link).toHaveAttribute('href', 'otp-tracker.html');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('title', 'See where every teacher is up to');
  expect(h.errors).toEqual([]);
});
