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
    history: [{ lap: 1, state: 'open', observation_date: '2026-09-10', observer: 'Marcus Lee', closed_at: '', emails_done: true, next_steps: ['Set up a vocabulary wall', 'Model think-alouds twice a week'] }],
  },
  {
    name: 'Zoe Larkin', section: 'secondary', on_roster: true, observation_count: 0,
    open: null, open_count: 0, last_closed: null, history: [],
  },
  {
    name: 'Amit Rao', section: 'primary', on_roster: true, observation_count: 1,
    open: { lap: 1, observation_date: '2026-09-14', observer: 'Dana Cole', emails_done: false },
    open_count: 1, last_closed: null,
    history: [{ lap: 1, state: 'open', observation_date: '2026-09-14', observer: 'Dana Cole', closed_at: '', emails_done: false, next_steps: [] }],
  },
  {
    name: 'Priya Menon', section: 'primary', on_roster: true, observation_count: 1,
    open: null, open_count: 0,
    last_closed: { lap: 1, observation_date: '2026-09-05', observer: 'Dana Cole', closed_at: '2026-09-06T08:00:00.000Z' },
    history: [{ lap: 1, state: 'closed', observation_date: '2026-09-05', observer: 'Dana Cole', closed_at: '2026-09-06T08:00:00.000Z', emails_done: true, next_steps: ['Share the marking rubric with the department'] }],
  },
  {
    name: 'Idris Osei', section: 'secondary', on_roster: true, observation_count: 2,
    open: { lap: 2, observation_date: '2026-09-18', observer: 'Marcus Lee', emails_done: false },
    open_count: 1, last_closed: null,
    history: [
      { lap: 1, state: 'closed', observation_date: '2026-08-20', observer: 'Dana Cole', closed_at: '2026-08-21T08:00:00.000Z', emails_done: true, next_steps: ['Introduce cold-call questioning'] },
      { lap: 2, state: 'open', observation_date: '2026-09-18', observer: 'Marcus Lee', closed_at: '', emails_done: false, next_steps: [] },
    ],
  },
  {
    name: 'Beatrix Yun', section: 'secondary', on_roster: true, observation_count: 3,
    open: null, open_count: 0,
    last_closed: { lap: 3, observation_date: '2026-09-15', observer: 'Dana Cole', closed_at: '2026-09-16T08:00:00.000Z' },
    history: [
      { lap: 1, state: 'closed', observation_date: '2026-08-10', observer: 'Marcus Lee', closed_at: '2026-08-11T08:00:00.000Z', emails_done: true, next_steps: ['Build a retrieval starter for every lesson'] },
      { lap: 2, state: 'closed', observation_date: '2026-08-25', observer: 'Dana Cole', closed_at: '2026-08-26T08:00:00.000Z', emails_done: true, next_steps: ['Pair weaker readers with a talk partner', 'Add a cold-call round to plenary'] },
      { lap: 3, state: 'closed', observation_date: '2026-09-15', observer: 'Dana Cole', closed_at: '2026-09-16T08:00:00.000Z', emails_done: true, next_steps: [] },
    ],
  },
  {
    name: 'OTP Test Teacher (delete me)', section: null, on_roster: false, observation_count: 1,
    open: { lap: 1, observation_date: '2026-09-19', observer: 'Dana Cole', emails_done: true },
    open_count: 1, last_closed: null,
    history: [{ lap: 1, state: 'open', observation_date: '2026-09-19', observer: 'Dana Cole', closed_at: '', emails_done: true, next_steps: ['Test next step for QA'] }],
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
    const m = /is-(pending|coming|completed|current|waiting)/.exec(cls);
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

/* ==========================================================================
 * otp-v0.14 T5: reflection-flow rows (get_otp_tracker now carries
 * reflection_flow/part1_at/part2_at per open/last_closed/history entry;
 * FIXTURES above has none of these fields, so every one of its rows stays
 * on the pre-v0.14 legacy rendering, proven throughout this file already).
 * ========================================================================== */
const REFLECTION_FIXTURES = [
  {
    // open, reflection_flow, teacher has not sent Part 1 yet.
    name: 'Layla Haddad', section: 'secondary', on_roster: true, observation_count: 1,
    open: {
      lap: 1, observation_date: '2026-09-20', observer: 'Marcus Lee', emails_done: true,
      reflection_flow: true, part1_at: null,
    },
    open_count: 1, last_closed: null,
    history: [{
      lap: 1, state: 'open', observation_date: '2026-09-20', observer: 'Marcus Lee', closed_at: '',
      emails_done: true, next_steps: [], reflection_flow: true, part1_at: null, part2_at: null,
    }],
  },
  {
    // open, reflection_flow, Part 1 already sent.
    name: 'Karim Atallah', section: 'primary', on_roster: true, observation_count: 1,
    open: {
      lap: 1, observation_date: '2026-09-18', observer: 'Dana Cole', emails_done: true,
      reflection_flow: true, part1_at: '2026-09-19T07:00:00.000Z',
    },
    open_count: 1, last_closed: null,
    history: [{
      lap: 1, state: 'open', observation_date: '2026-09-18', observer: 'Dana Cole', closed_at: '',
      emails_done: true, next_steps: [], reflection_flow: true, part1_at: '2026-09-19T07:00:00.000Z', part2_at: null,
    }],
  },
  {
    // closed, reflection_flow, Part 1 sent, Part 2 (the plan) still owed.
    name: 'Noor Salim', section: 'secondary', on_roster: true, observation_count: 1,
    open: null, open_count: 0,
    last_closed: {
      lap: 1, observation_date: '2026-09-10', observer: 'Marcus Lee', closed_at: '2026-09-12T08:00:00.000Z',
      reflection_flow: true, part1_at: '2026-09-11T07:00:00.000Z', part2_at: null,
    },
    history: [{
      lap: 1, state: 'closed', observation_date: '2026-09-10', observer: 'Marcus Lee', closed_at: '2026-09-12T08:00:00.000Z',
      emails_done: true, next_steps: ['Agree a shared vocabulary list'],
      reflection_flow: true, part1_at: '2026-09-11T07:00:00.000Z', part2_at: null,
    }],
  },
  {
    // closed, reflection_flow, both parts sent.
    name: 'Ravi Chandran', section: 'primary', on_roster: true, observation_count: 1,
    open: null, open_count: 0,
    last_closed: {
      lap: 1, observation_date: '2026-09-01', observer: 'Dana Cole', closed_at: '2026-09-03T08:00:00.000Z',
      reflection_flow: true, part1_at: '2026-09-02T07:00:00.000Z', part2_at: '2026-09-05T09:00:00.000Z',
    },
    history: [{
      lap: 1, state: 'closed', observation_date: '2026-09-01', observer: 'Dana Cole', closed_at: '2026-09-03T08:00:00.000Z',
      emails_done: true, next_steps: [],
      reflection_flow: true, part1_at: '2026-09-02T07:00:00.000Z', part2_at: '2026-09-05T09:00:00.000Z',
    }],
  },
];

test('otp-v0.14 T5: an open reflection-flow lap shows step 2 waiting until Part 1 lands, then completed', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, REFLECTION_FIXTURES);
  await openTracker(page);

  const waiting = rowByName(page, 'Layla Haddad');
  expect(await stepStates(waiting)).toEqual(['completed', 'waiting', 'completed', 'current', 'pending', 'pending']);

  const sent = rowByName(page, 'Karim Atallah');
  expect(await stepStates(sent)).toEqual(['completed', 'completed', 'completed', 'current', 'pending', 'pending']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5: a closed reflection-flow lap shows step 5 waiting until Part 2 lands, then completed', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, REFLECTION_FIXTURES);
  await openTracker(page);

  const waiting = rowByName(page, 'Noor Salim');
  expect(await stepStates(waiting)).toEqual(['completed', 'completed', 'completed', 'completed', 'waiting', 'completed']);

  const sent = rowByName(page, 'Ravi Chandran');
  expect(await stepStates(sent)).toEqual(['completed', 'completed', 'completed', 'completed', 'completed', 'completed']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5: Reflection Form and Plan Form chips are enabled and filter to rows waiting on the teacher', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, REFLECTION_FIXTURES);
  await openTracker(page);

  await expect(page.locator('.pill[data-chip="reflection"]')).toBeEnabled();
  await expect(page.locator('.pill[data-chip="reflection"]')).not.toContainText('Coming soon');
  await expect(page.locator('.pill[data-chip="plan"]')).toBeEnabled();
  await expect(page.locator('.pill[data-chip="plan"]')).not.toContainText('Coming soon');

  await page.locator('.pill[data-chip="reflection"]').click();
  expect(await visibleNames(page)).toEqual(['Layla Haddad']);

  await page.locator('.pill[data-chip="plan"]').click();
  expect(await visibleNames(page)).toEqual(['Noor Salim']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5: the two per-observation placeholders read sent/waiting/after Close Lap, no answers shown', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, REFLECTION_FIXTURES);
  await openTracker(page);

  const waitingRow = rowByName(page, 'Layla Haddad');
  await waitingRow.locator('.tt-row-main').click();
  const waitingPh = waitingRow.locator('.tt-hist-block').first().locator('.tt-placeholder');
  await expect(waitingPh.nth(0)).toHaveText('Teacher Reflection · waiting on teacher');
  await expect(waitingPh.nth(1)).toHaveText('Teacher Plan · after Close Lap');

  const sentRow = rowByName(page, 'Karim Atallah');
  await sentRow.locator('.tt-row-main').click();
  const sentPh = sentRow.locator('.tt-hist-block').first().locator('.tt-placeholder');
  await expect(sentPh.nth(0)).toHaveText(`Teacher Reflection · sent ${expectedDayShort('2026-09-19T07:00:00.000Z')}`);
  await expect(sentPh.nth(1)).toHaveText('Teacher Plan · after Close Lap');

  const closedWaitingRow = rowByName(page, 'Noor Salim');
  await closedWaitingRow.locator('.tt-row-main').click();
  const closedWaitingPh = closedWaitingRow.locator('.tt-hist-block').first().locator('.tt-placeholder');
  await expect(closedWaitingPh.nth(0)).toHaveText(`Teacher Reflection · sent ${expectedDayShort('2026-09-11T07:00:00.000Z')}`);
  await expect(closedWaitingPh.nth(1)).toHaveText('Teacher Plan · waiting on teacher');

  const bothSentRow = rowByName(page, 'Ravi Chandran');
  await bothSentRow.locator('.tt-row-main').click();
  const bothSentPh = bothSentRow.locator('.tt-hist-block').first().locator('.tt-placeholder');
  await expect(bothSentPh.nth(0)).toHaveText(`Teacher Reflection · sent ${expectedDayShort('2026-09-02T07:00:00.000Z')}`);
  await expect(bothSentPh.nth(1)).toHaveText(`Teacher Plan · sent ${expectedDayShort('2026-09-05T09:00:00.000Z')}`);

  // answers are never on Check Teacher: no q1..q8 text anywhere in the row.
  await expect(bothSentRow).not.toContainText(/How did the lesson go/);
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
 * Layout stability: a search that shrinks the list to where the vertical
 * scrollbar disappears must never shift or resize the card (scrollbar-gutter
 * reserves the space up front, see hard rule 12's neighbour: no layout jump).
 * ========================================================================== */

test('otp-v0.12 A2: a search that leaves one row does not move or resize the card', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const shell = page.locator('.tt-shell');
  const before = await shell.boundingBox();
  expect(before).not.toBeNull();

  await page.fill('#search-input', 'farah');
  expect(await visibleNames(page)).toEqual(['Farah Nasser']);

  const after = await shell.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x), 'card left edge moved').toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.width - before!.width), 'card width changed').toBeLessThanOrEqual(0.5);

  const gutter = await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter);
  expect(gutter, 'html must reserve a stable scrollbar gutter').toBe('stable');
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * History expand/collapse: each observation's own block, newest first,
 * heading + Next Steps (otp-v0.12 preview 2, P2-A). The old repeated
 * icon-row history (.tt-hist-icons/.tt-hist-step) is gone; these tests
 * replace the three that asserted it (icon classes, oldest-first order).
 * ========================================================================== */

test('otp-v0.12 A2: tap a row expands history newest first, tap again collapses', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Idris Osei');
  await expect(row).not.toHaveClass(/is-open/);

  await row.locator('.tt-row-main').click();
  await expect(row).toHaveClass(/is-open/);
  const blocks = row.locator('.tt-hist-block');
  await expect(blocks).toHaveCount(2);
  // newest first: lap 2 (open) before lap 1 (closed)
  await expect(blocks.nth(0).locator('.tt-hist-heading')).toHaveText('Observation 2 · Observation Feedback Meeting · Marcus Lee');
  await expect(blocks.nth(1).locator('.tt-hist-heading')).toHaveText(`Observation 1 · Completed ${expectedDayShort('2026-08-21T08:00:00.000Z')} · Dana Cole`);

  await row.locator('.tt-row-main').click();
  await expect(row).not.toHaveClass(/is-open/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: an open observation with Next Steps lists them word for word, no icon row', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Farah Nasser');
  await row.locator('.tt-row-main').click();
  const block = row.locator('.tt-hist-block').first();
  await expect(block.locator('.tt-hist-heading')).toHaveText('Observation 1 · Observation Feedback Meeting · Marcus Lee');
  await expect(block.locator('.tt-next-list li')).toHaveCount(2);
  await expect(block.locator('.tt-next-list li').nth(0)).toHaveText('Set up a vocabulary wall');
  await expect(block.locator('.tt-next-list li').nth(1)).toHaveText('Model think-alouds twice a week');
  await expect(block.locator('.tt-next-empty')).toHaveCount(0);
  await expect(block.locator('.tt-hist-icons')).toHaveCount(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: an observation with no Next Steps shows the "No Next Steps yet" line', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Amit Rao');
  await row.locator('.tt-row-main').click();
  const block = row.locator('.tt-hist-block').first();
  await expect(block.locator('.tt-next-empty')).toHaveText('No Next Steps yet');
  await expect(block.locator('.tt-next-list')).toHaveCount(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: a closed observation with Next Steps shows Completed + observer, no icon row', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Priya Menon');
  await row.locator('.tt-row-main').click();
  const block = row.locator('.tt-hist-block').first();
  await expect(block.locator('.tt-hist-heading')).toHaveText(`Observation 1 · Completed ${expectedDayShort('2026-09-06T08:00:00.000Z')} · Dana Cole`);
  await expect(block.locator('.tt-next-list li')).toHaveCount(1);
  await expect(block.locator('.tt-next-list li').nth(0)).toHaveText('Share the marking rubric with the department');
  await expect(block.locator('.tt-hist-icons')).toHaveCount(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: closed lap 3 with two earlier laps renders three blocks, newest first, no icon row anywhere', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  const row = rowByName(page, 'Beatrix Yun');
  await row.locator('.tt-row-main').click();
  const blocks = row.locator('.tt-hist-block');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.nth(0).locator('.tt-hist-heading')).toHaveText(`Observation 3 · Completed ${expectedDayShort('2026-09-16T08:00:00.000Z')} · Dana Cole`);
  await expect(blocks.nth(1).locator('.tt-hist-heading')).toHaveText(`Observation 2 · Completed ${expectedDayShort('2026-08-26T08:00:00.000Z')} · Dana Cole`);
  await expect(blocks.nth(2).locator('.tt-hist-heading')).toHaveText(`Observation 1 · Completed ${expectedDayShort('2026-08-11T08:00:00.000Z')} · Marcus Lee`);
  await expect(blocks.nth(0).locator('.tt-next-empty')).toHaveText('No Next Steps yet');
  await expect(blocks.nth(1).locator('.tt-next-list li')).toHaveCount(2);
  await expect(blocks.nth(2).locator('.tt-next-list li')).toHaveCount(1);
  await expect(row.locator('.tt-hist-icons')).toHaveCount(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: two dashed placeholders sit under EACH observation (legacy laps), and under the row when never observed', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  await openTracker(page);

  // otp-v0.14: FIXTURES carries no reflection_flow at all, so every lap is
  // legacy - one pair per OBSERVATION now (Beatrix Yun has 3), not one pair
  // for the whole row; each pair keeps the old wording verbatim.
  const observedRow = rowByName(page, 'Beatrix Yun');
  await observedRow.locator('.tt-row-main').click();
  const blocks = observedRow.locator('.tt-hist-block');
  await expect(blocks).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const ph = blocks.nth(i).locator('.tt-placeholder');
    await expect(ph).toHaveCount(2);
    await expect(ph.nth(0)).toHaveText('Teacher Reflection · not yet available');
    await expect(ph.nth(1)).toHaveText('Teacher Plan · not yet available');
  }
  // none of these sit directly under .tt-history any more (that spot is now
  // only for the never-observed fallback, checked below).
  await expect(observedRow.locator('.tt-history > .tt-placeholder')).toHaveCount(0);

  const neverRow = rowByName(page, 'Zoe Larkin');
  await neverRow.locator('.tt-row-main').click();
  await expect(neverRow.locator('.tt-hist-row')).toHaveText('No observations recorded yet this school year.');
  const neverPlaceholders = neverRow.locator('.tt-history > .tt-placeholder');
  await expect(neverPlaceholders).toHaveCount(2);
  await expect(neverPlaceholders.nth(0)).toHaveText('Teacher Reflection · not yet available');
  await expect(neverPlaceholders.nth(1)).toHaveText('Teacher Plan · not yet available');
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 A2: a real touch tap expands a row (WebKit/touch)', async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 834, height: 1194 }, baseURL: `http://127.0.0.1:${process.env.OTP_PORT || '8123'}` });
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
      // open one row too (P2-A: its expanded section no longer carries a
      // .tt-hist-step Active pill, that history is now text-only, but this
      // still exercises the main row's own Active pill while a row is open)
      await rowByName(page, 'Idris Osei').locator('.tt-row-main').click();
    }
    // one pill element per Active step: the icon and its label live inside the SAME .tt-step
    // (the .tt-hist-step alternative is dead since P2-A removed the icon history, kept here
    // so this check still holds if that markup ever returns)
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

test('otp-v0.12 P4: the Active pill shows the step name only, never the word "Active"', async ({ page }) => {
  const h = await harness(page);
  await mockTracker(page, FIXTURES);
  for (const { width, height } of TT_WIDTHS) {
    await page.setViewportSize({ width, height });
    if (!page.url().includes(TRACKER_URL)) {
      await openTracker(page);
    }
    const pills = page.locator('.tt-step.is-current');
    const count = await pills.count();
    expect(count, `${width}px: expected at least one Active pill`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const pill = pills.nth(i);
      const fullText = await pill.locator('.tier-full').textContent();
      const shortText = await pill.locator('.tier-short').textContent();
      const tinyText = await pill.locator('.tier-tiny').textContent();
      expect(fullText, `${width}px pill ${i}: full tier must not say Active`).not.toContain('Active');
      expect(shortText, `${width}px pill ${i}: short tier must not say Active`).not.toContain('Active');
      expect(tinyText, `${width}px pill ${i}: tiny tier must not say Active`).not.toContain('Active');
      // every fixture with an open observation lands on step 4 (index 3),
      // "Observation Feedback Meeting" (stepsForState always marks it 'current' when open)
      expect(fullText, `${width}px pill ${i}: full tier must equal the step name exactly`).toBe('Observation Feedback Meeting');
    }
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
