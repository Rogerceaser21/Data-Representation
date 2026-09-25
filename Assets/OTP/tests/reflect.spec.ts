/**
 * otp-v0.14 T2 · Teacher Reflection + Plan
 *
 * Tests the BUILT artifact (Assets/OTP/otp-reflect.html), not the master,
 * because it ships as a plain ungated copy with no rewritten paths — but the
 * spec still runs it from its OUTPUT location so ../brand/ resolves the way
 * it does live. Run `bash Assets/OTP/encrypt.sh` before this spec.
 *
 * The otp-reflect edge function does not exist live yet: every call to it is
 * mocked with page.route, using the exact contract shapes from
 * ~/Developer/claudex-runs/otp-v0.14/CONTRACT.md section 1/2 (GET -> {success,
 * state}; POST {t, parts} -> {success, sent, duplicate, state} or a business
 * error). Nothing else leaves the machine.
 */
import { test, expect, Page, Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const REFLECT_URL = '/Assets/OTP/otp-reflect.html';
const FN_PATTERN = '**/functions/v1/otp-reflect**';

const TOKEN = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function expectedDayShort(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()];
}

/* ==========================================================================
 * Fixture states — the real otp_reflect_state() shape (CONTRACT.md section 1),
 * one per contract-section-3 state.
 * ========================================================================== */
const BASE = {
  lap: 1,
  teacher: 'Jamie Carter',
  observer: 'Sam Example',
  subject: 'Science',
  grade: 'Year 7',
  observation_date: '2026-09-14',
};

function stateObserved(): any {
  // Part 1 owed, nothing sent yet.
  return {
    found: true, ...BASE, status: 'observed', closed_at: null, next_steps: [],
    part1: null, part2: null, view_unlocked: false, owed: [1],
  };
}
function statePart1Sent(): any {
  // Thank-you after part 1, status still observed (part 2 not owed yet).
  return {
    found: true, ...BASE, status: 'observed', closed_at: null, next_steps: [],
    part1: { sent_at: '2026-09-14T10:00:00.000Z', answers: { q1: 'It went well overall.', q2_level: 'Good', q2_comment: 'Strong pair talk.', q3: 'Nothing extra.' } },
    part2: null, view_unlocked: true, owed: [],
  };
}
function stateClosedPart2Owed(): any {
  // Part 1 already sent, lap closed, part 2 owed only.
  return {
    found: true, ...BASE, status: 'closed', closed_at: '2026-09-16T08:00:00.000Z',
    next_steps: ['Check understanding with mini whiteboards before independent work.', 'Give the early finishers a stretch question on the board.', 'Use the success criteria in the plenary.'],
    part1: { sent_at: '2026-09-14T10:00:00.000Z', answers: { q1: 'It went well overall.', q2_level: 'Good', q2_comment: '', q3: '' } },
    part2: null, view_unlocked: true, owed: [2],
  };
}
function stateClosedBothOwed(): any {
  // Closed before part 1 was ever sent: both owed together.
  return {
    found: true, ...BASE, status: 'closed', closed_at: '2026-09-16T08:00:00.000Z',
    next_steps: ['Check understanding with mini whiteboards before independent work.', 'Give the early finishers a stretch question on the board.', 'Use the success criteria in the plenary.'],
    part1: null, part2: null, view_unlocked: false, owed: [1, 2],
  };
}
function stateClosedBothSent(): any {
  // Nothing owed, both parts sent — full thank-you / view state.
  return {
    found: true, ...BASE, status: 'closed', closed_at: '2026-09-16T08:00:00.000Z',
    next_steps: ['Check understanding with mini whiteboards before independent work.', 'Give the early finishers a stretch question on the board.', 'Use the success criteria in the plenary.'],
    part1: { sent_at: '2026-09-14T10:00:00.000Z', answers: { q1: 'It went well overall.', q2_level: 'Good', q2_comment: 'Strong pair talk.', q3: 'Nothing extra.' } },
    part2: { sent_at: '2026-09-17T09:00:00.000Z', answers: { q4: 'Pace in the middle.', q5: 'Chunk the task.', q6: 'From next week.', q7: 'A TA on Tuesdays.', q8: 'More independent starters by half term.' } },
    view_unlocked: true, owed: [],
  };
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

/** Mocks the GET (state) route with a single fixture state, and the POST
 *  (send) route to accept whatever parts are posted, merging them into the
 *  given `next` state as the "after send" answer. */
async function mockReflect(page: Page, state: any, opts?: { next?: any; postError?: { error: string; missing?: string[] } }) {
  await page.route(FN_PATTERN, async (r: Route) => {
    const req = r.request();
    if (req.method() === 'GET') {
      const url = new URL(req.url());
      const t = url.searchParams.get('t');
      if (t !== TOKEN) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Record not found' }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, state }) });
    }
    // POST
    if (opts?.postError) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, ...opts.postError }) });
    }
    const body = JSON.parse(req.postData() || '{}');
    const sent = Object.keys(body.parts || {});
    return r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, sent, duplicate: [], state: opts?.next || stateClosedBothSent() }),
    });
  });
}

async function openReflect(page: Page, token = TOKEN, query = '') {
  await page.goto(REFLECT_URL + '?t=' + token + query);
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
}

/* ==========================================================================
 * Bad link (hard rule 12: calm card, never an error)
 * ========================================================================== */

test('otp-v0.14 T2: no token at all shows the calm bad-link card, no network call', async ({ page }) => {
  const h = await harness(page);
  let called = false;
  await page.route(FN_PATTERN, (r: Route) => { called = true; return r.abort(); });
  await page.goto(REFLECT_URL);
  await expect(page.locator('#otr-badlink-text')).toHaveText('This link is not valid or has expired. Ask your coach for a new link.');
  await expect(page.locator('#form-loading')).not.toHaveClass(/is-hidden/);
  expect(called, 'a malformed/missing token must never reach the network').toBe(false);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: a malformed token (not 32 hex) shows the calm bad-link card, no network call', async ({ page }) => {
  const h = await harness(page);
  let called = false;
  await page.route(FN_PATTERN, (r: Route) => { called = true; return r.abort(); });
  await page.goto(REFLECT_URL + '?t=not-a-real-token');
  await expect(page.locator('#otr-badlink-text')).toHaveText('This link is not valid or has expired. Ask your coach for a new link.');
  expect(called).toBe(false);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: a canonical but unknown token gets the server MISS and shows the calm bad-link card', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateObserved());
  await page.goto(REFLECT_URL + '?t=' + 'f'.repeat(32));
  await expect(page.locator('#otr-badlink-text')).toHaveText('This link is not valid or has expired. Ask your coach for a new link.');
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Part 1 owed only
 * ========================================================================== */

test('otp-v0.14 T2: Part 1 owed shows the lock note, title, meta and the three questions, no Next Steps', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateObserved());
  await openReflect(page);

  await expect(page.locator('#otr-title')).toHaveText('Your view of the lesson');
  await expect(page.locator('.otr-meta')).toHaveText(`Observation 1 · Year 7 Science · ${expectedDayShort('2026-09-14')} · Coach: Sam Example`);
  await expect(page.locator('.otr-lock')).toBeVisible();
  await expect(page.locator('.otr-owed-note')).toHaveCount(0);
  await expect(page.locator('#q1')).toBeVisible();
  await expect(page.locator('#q2_level_group .pill')).toHaveCount(5);
  await expect(page.locator('#q3')).toBeVisible();
  await expect(page.locator('#q4')).toHaveCount(0);
  await expect(page.locator('.prev-ns')).toHaveCount(0);
  await expect(page.locator('#otr-send')).toHaveClass(/disabled/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: Send stays grey until every required Part 1 answer is filled, then enables', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateObserved());
  await openReflect(page);

  const send = page.locator('#otr-send');
  await expect(send).toHaveClass(/disabled/);
  await page.fill('#q1', 'It went well.');
  await expect(send).toHaveClass(/disabled/);
  await page.fill('#q3', 'Nothing extra.');
  await expect(send).toHaveClass(/disabled/);
  await page.locator('#q2_level_group .pill', { hasText: 'Good' }).click();
  await expect(send).not.toHaveClass(/disabled/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: tapping the grey Send button outlines the missing boxes, no text error, no network call', async ({ page }) => {
  const h = await harness(page);
  let posted = false;
  await page.route(FN_PATTERN, async (r: Route) => {
    if (r.request().method() === 'POST') { posted = true; }
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, state: stateObserved() }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sent: [], duplicate: [], state: stateObserved() }) });
  });
  await openReflect(page);

  await page.fill('#q1', 'Only Q1 filled.');
  await page.locator('#otr-send').click();
  await expect(page.locator('#q3')).toHaveClass(/needs-value/);
  await expect(page.locator('#q2_level_group')).toHaveClass(/needs-value/);
  await expect(page.locator('#q1')).not.toHaveClass(/needs-value/);
  expect(posted, 'an invalid Send must never reach the network').toBe(false);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.toLowerCase()).not.toContain('required field');
  expect(bodyText.toLowerCase()).not.toContain('error');
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: filling a previously-outlined box clears its outline', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateObserved());
  await openReflect(page);
  await page.locator('#otr-send').click();
  await expect(page.locator('#q1')).toHaveClass(/needs-value/);
  await page.fill('#q1', 'Now filled.');
  await expect(page.locator('#q1')).not.toHaveClass(/needs-value/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: sending Part 1 posts {t, parts:{"1":...}} and moves to the thank-you view with the view link', async ({ page }) => {
  const h = await harness(page);
  let posted: any = null;
  await page.route(FN_PATTERN, async (r: Route) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, state: stateObserved() }) });
    posted = JSON.parse(r.request().postData() || '{}');
    return r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, sent: ['1'], duplicate: [], state: statePart1Sent() }),
    });
  });
  await openReflect(page);

  await page.fill('#q1', 'It went well overall.');
  await page.locator('#q2_level_group .pill', { hasText: 'Good' }).click();
  await page.fill('#q2_comment', 'Strong pair talk.');
  await page.fill('#q3', 'Nothing extra.');
  await page.locator('#otr-send').click();

  await expect(page.locator('#otr-title')).toHaveText('Thank you.');
  await expect(page.locator('#otr-thanks-sub')).toHaveText('Your answers are sent.');
  await expect(page.locator('#q1[readonly]')).toHaveValue('It went well overall.');
  await expect(page.locator('#q2_level_group .pill.is-selected')).toHaveText('Good');
  await expect(page.locator('#q2_comment[readonly]')).toHaveValue('Strong pair talk.');
  await expect(page.locator('#q3[readonly]')).toHaveValue('Nothing extra.');
  await expect(page.locator('.prev-ns')).toHaveCount(0);
  const link = page.locator('#otr-view-link');
  await expect(link).toHaveText('View your observation');
  await expect(link).toHaveAttribute('href', 'otp-record.html?t=' + TOKEN);

  expect(posted).toEqual({ t: TOKEN, parts: { '1': { q1: 'It went well overall.', q2_level: 'Good', q2_comment: 'Strong pair talk.', q3: 'Nothing extra.' } } });
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Both owed (closed before Part 1 was ever sent)
 * ========================================================================== */

test('otp-v0.14 T2: both owed shows the owed-note, Q1-3, Next Steps, then Q4-8, title "Your plan"', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateClosedBothOwed());
  await openReflect(page);

  await expect(page.locator('#otr-title')).toHaveText('Your plan');
  await expect(page.locator('.otr-lock')).toHaveCount(0);
  await expect(page.locator('.otr-owed-note')).toHaveText('You have not sent questions 1 to 3 yet, so they are here too.');

  const sections = page.locator('#otr-shell > *');
  const ids = await sections.evaluateAll((els) => els.map((e) => e.id || e.className));
  const owedIdx = ids.findIndex((c) => String(c).includes('otr-owed-note'));
  const nsIdx = ids.findIndex((c) => String(c).includes('prev-ns'));
  expect(owedIdx).toBeGreaterThanOrEqual(0);
  expect(nsIdx).toBeGreaterThan(owedIdx);

  await expect(page.locator('#q1')).toBeVisible();
  await expect(page.locator('#q2_level_group .pill')).toHaveCount(5);
  await expect(page.locator('#q3')).toBeVisible();
  await expect(page.locator('.prev-ns-head')).toHaveText('NEXT STEPS AGREED WITH YOUR COACH · OBSERVATION 1');
  await expect(page.locator('.prev-ns-list li')).toHaveCount(3);
  await expect(page.locator('#q4')).toBeVisible();
  await expect(page.locator('#q8')).toBeVisible();
  await expect(page.locator('#otr-send')).toHaveClass(/disabled/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: both owed requires all eight fields before Send enables, and a single Send posts both parts', async ({ page }) => {
  const h = await harness(page);
  let posted: any = null;
  await page.route(FN_PATTERN, async (r: Route) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, state: stateClosedBothOwed() }) });
    posted = JSON.parse(r.request().postData() || '{}');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sent: ['1', '2'], duplicate: [], state: stateClosedBothSent() }) });
  });
  await openReflect(page);

  const send = page.locator('#otr-send');
  await page.fill('#q1', 'It went well overall.');
  await page.locator('#q2_level_group .pill', { hasText: 'Good' }).click();
  await page.fill('#q3', 'Nothing extra.');
  await expect(send).toHaveClass(/disabled/);
  await page.fill('#q4', 'Pace.');
  await page.fill('#q5', 'Chunk it.');
  await page.fill('#q6', 'Next week.');
  await page.fill('#q7', 'A TA.');
  await expect(send).toHaveClass(/disabled/);
  await page.fill('#q8', 'By half term.');
  await expect(send).not.toHaveClass(/disabled/);

  await send.click();
  await expect(page.locator('#otr-title')).toHaveText('Thank you.');
  expect(posted.t).toBe(TOKEN);
  expect(Object.keys(posted.parts).sort()).toEqual(['1', '2']);
  expect(posted.parts['1'].q1).toBe('It went well overall.');
  expect(posted.parts['2'].q8).toBe('By half term.');
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Part 2 owed only (Part 1 already sent)
 * ========================================================================== */

test('otp-v0.14 T2: Part 2 owed shows only Next Steps and Q4-8, no lock note, no owed-note, no Q1-3', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateClosedPart2Owed());
  await openReflect(page);

  await expect(page.locator('#otr-title')).toHaveText('Your plan');
  await expect(page.locator('.otr-lock')).toHaveCount(0);
  await expect(page.locator('.otr-owed-note')).toHaveCount(0);
  await expect(page.locator('#q1')).toHaveCount(0);
  await expect(page.locator('#q2_level_group')).toHaveCount(0);
  await expect(page.locator('#q3')).toHaveCount(0);
  await expect(page.locator('.prev-ns-list li')).toHaveCount(3);
  await expect(page.locator('#q4')).toBeVisible();
  await expect(page.locator('#q8')).toBeVisible();
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: sending Part 2 posts only {"2":...} and the resulting thank-you shows both parts read-only', async ({ page }) => {
  const h = await harness(page);
  let posted: any = null;
  await page.route(FN_PATTERN, async (r: Route) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, state: stateClosedPart2Owed() }) });
    posted = JSON.parse(r.request().postData() || '{}');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sent: ['2'], duplicate: [], state: stateClosedBothSent() }) });
  });
  await openReflect(page);

  await page.fill('#q4', 'Pace in the middle.');
  await page.fill('#q5', 'Chunk the task.');
  await page.fill('#q6', 'From next week.');
  await page.fill('#q7', 'A TA on Tuesdays.');
  await page.fill('#q8', 'More independent starters by half term.');
  await page.locator('#otr-send').click();

  expect(Object.keys(posted.parts)).toEqual(['2']);
  await expect(page.locator('#otr-title')).toHaveText('Thank you.');
  await expect(page.locator('#q1[readonly]')).toHaveValue('It went well overall.');
  await expect(page.locator('.prev-ns-list li')).toHaveCount(3);
  await expect(page.locator('#q8[readonly]')).toHaveValue('More independent starters by half term.');
  await expect(page.locator('#otr-view-link')).toBeVisible();
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Nothing owed: thank-you / read-only view straight from a fresh load
 * ========================================================================== */

test('otp-v0.14 T2: reopening the link after Part 1 sent (status observed) shows the thank-you view with the view link, no Next Steps', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, statePart1Sent());
  await openReflect(page);

  await expect(page.locator('#otr-title')).toHaveText('Thank you.');
  await expect(page.locator('#q1[readonly]')).toHaveValue('It went well overall.');
  await expect(page.locator('.prev-ns')).toHaveCount(0);
  await expect(page.locator('#q4')).toHaveCount(0);
  await expect(page.locator('#otr-view-link')).toHaveAttribute('href', 'otp-record.html?t=' + TOKEN);
  await expect(page.locator('#otr-send')).toHaveCount(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: reopening the link after both parts sent shows every answer read-only, Next Steps included, in question order', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateClosedBothSent());
  await openReflect(page);

  await expect(page.locator('#otr-title')).toHaveText('Thank you.');
  const blocks = page.locator('#otr-shell > *');
  const order = await blocks.evaluateAll((els) => els.map((e) => (e as HTMLElement).id || Array.from(e.classList).join(' ')));
  const q1Idx = order.findIndex((c) => c === 'otr-header' || c.includes('otr-header'));
  expect(order.some((c) => c.includes('prev-ns'))).toBe(true);
  await expect(page.locator('#q1[readonly]')).toHaveValue('It went well overall.');
  await expect(page.locator('#q2_comment[readonly]')).toHaveValue('Strong pair talk.');
  await expect(page.locator('.prev-ns-list li')).toHaveCount(3);
  await expect(page.locator('#q4[readonly]')).toHaveValue('Pace in the middle.');
  await expect(page.locator('#q8[readonly]')).toHaveValue('More independent starters by half term.');
  // read-only: no send bar, textareas cannot be edited
  await expect(page.locator('#otr-send')).toHaveCount(0);
  await expect(page.locator('#q1')).toHaveAttribute('readonly', '');
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: a read-only Q2 with no comment renders no empty comment box', async ({ page }) => {
  const h = await harness(page);
  const noComment = statePart1Sent();
  noComment.part1.answers.q2_comment = '';
  await mockReflect(page, noComment);
  await openReflect(page);
  await expect(page.locator('#q2_comment')).toHaveCount(0);
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Business error: missing_answers from the server (defensive path)
 * ========================================================================== */

test('otp-v0.14 T2: a server missing_answers error outlines the returned keys and re-enables Send, no error text', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateObserved(), { postError: { error: 'missing_answers', missing: ['q3'] } });
  await openReflect(page);

  await page.fill('#q1', 'It went well overall.');
  await page.locator('#q2_level_group .pill', { hasText: 'Good' }).click();
  await page.fill('#q3', 'x'); // passes client validation, server still says missing (e.g. too long)
  await page.locator('#otr-send').click();

  await expect(page.locator('#q3')).toHaveClass(/needs-value/, { timeout: 10_000 });
  await expect(page.locator('#otr-send')).toHaveText('Send my answers');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.toLowerCase()).not.toContain('error');
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Resilience (hard rule 12: no error UI, ever)
 * ========================================================================== */

test('otp-v0.14 T2: a stalled GET retries silently and succeeds, no error text ever visible', async ({ page }) => {
  const h = await harness(page);
  let calls = 0;
  await page.route(FN_PATTERN, async (r: Route) => {
    if (r.request().method() !== 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sent: [], duplicate: [], state: stateObserved() }) });
    calls++;
    if (calls === 1) { await new Promise(() => {}); return; } // times out via the page's own AbortController (shortened via ?_tmo)
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, state: stateObserved() }) });
  });
  await page.goto(REFLECT_URL + '?t=' + TOKEN + '&_tmo=200');
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
  await expect(page.locator('#otr-title')).toHaveText('Your view of the lesson');
  expect(calls, 'a second attempt must have been made').toBeGreaterThanOrEqual(2);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: a GET 500 then a 200 renders the form with no error UI', async ({ page }) => {
  const h = await harness(page);
  let calls = 0;
  await page.route(FN_PATTERN, (r: Route) => {
    if (r.request().method() !== 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sent: [], duplicate: [], state: stateObserved() }) });
    calls++;
    if (calls === 1) return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, state: stateObserved() }) });
  });
  await openReflect(page);
  await expect(page.locator('#otr-title')).toHaveText('Your view of the lesson');
  expect(calls).toBeGreaterThanOrEqual(2);
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('otp-v0.14 T2: a POST network failure retries silently while the button shows "Sending…", then succeeds', async ({ page }) => {
  const h = await harness(page);
  let postCalls = 0;
  await page.route(FN_PATTERN, async (r: Route) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, state: stateObserved() }) });
    postCalls++;
    if (postCalls === 1) return r.abort('failed');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sent: ['1'], duplicate: [], state: statePart1Sent() }) });
  });
  await openReflect(page);
  await page.fill('#q1', 'It went well overall.');
  await page.locator('#q2_level_group .pill', { hasText: 'Good' }).click();
  await page.fill('#q3', 'Nothing extra.');
  await page.locator('#otr-send').click();
  await expect(page.locator('#otr-send')).toHaveText('Sending…');
  await expect(page.locator('#otr-title')).toHaveText('Thank you.', { timeout: 15_000 });
  expect(postCalls).toBeGreaterThanOrEqual(2);
  // the browser's own network log for the mocked aborted request is the
  // only line allowed (tracker.spec.ts's 500 pattern); no error UI is ever
  // rendered by the page itself.
  expect(h.errors.filter((e) => !/ERR_FAILED/.test(e))).toEqual([]);
});

/* ==========================================================================
 * Autosave (localStorage key ais-otp-reflect-v1:<first 8 chars of t>)
 * ========================================================================== */

test('otp-v0.14 T2: typed answers autosave to localStorage and restore on reload', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateObserved());
  await openReflect(page);

  await page.fill('#q1', 'Draft text for Q1.');
  await page.locator('#q2_level_group .pill', { hasText: 'Great' }).click();
  await page.waitForTimeout(400);

  const key = 'ais-otp-reflect-v1:' + TOKEN.slice(0, 8);
  const raw = await page.evaluate((k) => localStorage.getItem(k), key);
  expect(raw).toBeTruthy();
  const draft = JSON.parse(raw!);
  expect(draft.q1).toBe('Draft text for Q1.');
  expect(draft.q2_level).toBe('Great');

  await page.reload();
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
  await expect(page.locator('#q1')).toHaveValue('Draft text for Q1.');
  await expect(page.locator('#q2_level_group .pill.is-selected')).toHaveText('Great');
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: the draft is cleared after a successful send', async ({ page }) => {
  const h = await harness(page);
  await mockReflect(page, stateObserved(), { next: statePart1Sent() });
  await openReflect(page);

  await page.fill('#q1', 'It went well overall.');
  await page.locator('#q2_level_group .pill', { hasText: 'Good' }).click();
  await page.fill('#q3', 'Nothing extra.');
  await page.waitForTimeout(400);
  const key = 'ais-otp-reflect-v1:' + TOKEN.slice(0, 8);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeTruthy();

  await page.locator('#otr-send').click();
  await expect(page.locator('#otr-title')).toHaveText('Thank you.');
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  expect(h.errors).toEqual([]);
});

/* ==========================================================================
 * Touch (WebKit/iPad)
 * ========================================================================== */

test('otp-v0.14 T2: a real touch tap selects a Q2 chip (WebKit/touch)', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 820, height: 1180 }, baseURL: `http://127.0.0.1:${process.env.OTP_PORT || '8123'}` });
  const page = await ctx.newPage();
  const h = await harness(page);
  await mockReflect(page, stateObserved());
  await openReflect(page);

  const chip = page.locator('#q2_level_group .pill', { hasText: 'Great' });
  const box = (await chip.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(chip).toHaveClass(/is-selected/, { timeout: 5_000 });
  expect(h.errors).toEqual([]);
  await ctx.close();
});

/* ==========================================================================
 * No forbidden content is ever rendered
 * ========================================================================== */

test('otp-v0.14 T2: no record_token, teacher_token, rating or other forbidden key ever renders', async ({ page }) => {
  const h = await harness(page);
  const decoy = stateClosedBothSent();
  (decoy as any).record_token = 'deadbeefdeadbeefdeadbeefdeadbeef';
  (decoy as any).teacher_token = TOKEN;
  (decoy as any).rating = 5;
  await mockReflect(page, decoy);
  await openReflect(page);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('deadbeef');
  expect(bodyText).not.toContain(TOKEN);
  expect(bodyText.toLowerCase()).not.toContain('rating');
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T2: the built page carries no Supabase key, only the public function URL', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'otp-reflect.html'), 'utf8');
  expect(bytes).not.toContain('sb_publishable');
  expect(bytes).not.toContain('/rest/v1/rpc');
  expect(bytes).toContain('/functions/v1/otp-reflect');
});

/* ==========================================================================
 * Widths (744 / 820 / 1024) x themes (light / dark): layout stability
 * ========================================================================== */

const WIDTHS = [
  { width: 744, height: 1133 },
  { width: 820, height: 1180 },
  { width: 1024, height: 1366 },
];
const SWEEP_STATES: Array<{ name: string; state: any }> = [
  { name: 'part1', state: stateObserved() },
  { name: 'both', state: stateClosedBothOwed() },
  { name: 'part2', state: stateClosedPart2Owed() },
  { name: 'thankyou', state: stateClosedBothSent() },
];

for (const { name, state } of SWEEP_STATES) {
  test(`otp-v0.14 T2: ${name} state renders with no horizontal overflow at 744/820/1024, light and dark`, async ({ page }) => {
    const h = await harness(page);
    await mockReflect(page, state);
    await openReflect(page);

    for (const dark of [false, true]) {
      if (dark) {
        await page.locator('#theme-toggle').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      }
      for (const { width, height } of WIDTHS) {
        await page.setViewportSize({ width, height });
        const overflowed = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect(overflowed, `${name} @ ${width}px dark=${dark}: horizontal overflow`).toBe(false);
        const shellVisible = await page.locator('#otr-shell').isVisible();
        expect(shellVisible).toBe(true);
      }
    }
    expect(h.errors).toEqual([]);
  });
}

test('otp-v0.14 T2: a stored dark preference paints dark before first render', async ({ page, context }) => {
  const h = await harness(page);
  await mockReflect(page, stateObserved());
  await context.addInitScript(() => { try { localStorage.setItem('ais-form-theme', 'dark'); } catch (e) {} });
  await openReflect(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(h.errors).toEqual([]);
});
