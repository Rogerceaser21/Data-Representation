/**
 * otp-v0.14 T3 · dashboard Teacher portal, row 02 (OTP & APR self-assessment)
 *
 * Tests the MASTER (dashboard/src/index.html), not the generated dashboard/index.html,
 * since encrypt.sh is never run for this proof (hard rule: edit the master, the
 * generated artifact is StatiCrypt output and out of scope here).
 *
 * get_otp_portal and get_raw_snapshot are route-mocked with a small synthetic
 * snapshot (synthetic names only, never real staff). Nothing leaves the machine:
 * fonts, favicon and the cdnjs scripts (three.js / gsap / MotionPathPlugin) are
 * also routed, which is safe because every use of window.THREE / window.gsap in
 * the master is already guarded (motion is enhancement only, per the dashboard
 * house style), blocking them just proves the resting, un-animated end state.
 */
import { test, expect, Page, Route } from '@playwright/test';

const PAGE_URL = '/dashboard/src/index.html';

/** The contract's exact question wording (CONTRACT.md §3), Part 1 then Part 2. */
const QUESTIONS = [
  [1, 'How did the lesson go? What worked, and what did not?'],
  [2, 'Where was student progress?'],
  [3, 'Is there anything your coach should know before you meet?'],
  [4, 'What challenges do you expect?'],
  [5, 'What are your own ideas to overcome them?'],
  [6, 'How will you put them in place, and from when?'],
  [7, 'What support do you need and who would be most likely to provide it?'],
  [8, 'What change in student learning do you expect, and by when?'],
] as const;

/** A minimal but structurally valid __AIS_DATA (shapeSnapshot's OUTPUT shape), served as data.js.
 *  D must exist synchronously before any fetch resolves (`let D = window.__AIS_DATA`, `let WORD =
 *  D.scale`, both run at parse time), so this is the "page must still load" stub the task calls for. */
const DATA_JS_STUB = `window.__AIS_DATA = {
  generated_on: '2026-09-25 00:00 UTC', school: 'AIS Sharjah',
  rounds: ['R3 June 26','R3 February 26'],
  scale: {1:'Outstanding',2:'Very Good',3:'Good',4:'Acceptable',5:'Weak',6:'Very Weak'},
  criteria: [], inspectors: [], departments: [],
  coverage: {total_teachers:0,observed:0,not_observed:0,total_observations:0,by_round:{},distribution:[],not_observed_names:[]},
  quality: {distribution:{1:0,2:0,3:0,4:0,5:0,6:0}, by_criterion:{}},
  teachers: [{id:'stub',name:'Stub Teacher',section:null,dept:null,dept_role:null,photo_url:null,observed:false,n_obs:0,n_june:0,n_feb:0,overall:null,best:{},observations:[]}]
};`;

/** Synthetic RAW snapshot (shapeSnapshot's INPUT shape) for get_raw_snapshot: proves get_otp_portal
 *  is a genuinely separate fetch that still applies once loadLive() swaps D under it (matched by
 *  teacher NAME, not id). Four fictional teachers, never real AIS staff. */
const RAW_TEACHERS = [
  { id: 't-priya', full_name: 'Priya Fictional Teacher', section: 'primary', dept: null, dept_role: null, photo_url: null },
  { id: 't-zara', full_name: 'Zara Fictional Teacher', section: 'secondary', dept: null, dept_role: null, photo_url: null },
  { id: 't-miles', full_name: 'Miles Fictional Teacher', section: 'secondary', dept: null, dept_role: null, photo_url: null },
  { id: 't-noor', full_name: 'Noor Fictional Teacher', section: 'primary', dept: null, dept_role: null, photo_url: null },
];
const RAW_SNAPSHOT = { generated_on: '2026-09-25T00:00:00Z', criteria: [], inspectors: [], teachers: RAW_TEACHERS, assessments: [], scores: [] };

/** get_otp_portal response (CONTRACT.md §1): teachers A to Z, laps newest first.
 *  Priya = owed (a newer open lap owing part 1, plus an older fully-answered closed lap: also
 *  proves "newest first" ordering and mixed sent/not-sent within one teacher).
 *  Zara = up to date (one closed lap, both parts sent).
 *  Miles = absent entirely (not a reflection-flow teacher -> row 02 stays Not assessed).
 *  Noor = two open laps, one owing BOTH parts, proving the badge sums owed across laps (2+1=3),
 *  not just the newest lap. */
const OTP_PORTAL_PAYLOAD = [
  {
    teacher: 'Priya Fictional Teacher',
    laps: [
      {
        lap: 2, observation_date: '2026-09-14', subject: 'Mathematics', grade: 'Year 5',
        observer: 'Sam Example', status: 'observed', closed_at: null,
        part1: null, part2: null, owed: [1],
      },
      {
        lap: 1, observation_date: '2026-02-10', subject: 'Mathematics', grade: 'Year 5',
        observer: 'Sam Example', status: 'closed', closed_at: '2026-02-20T09:00:00Z',
        next_steps: ['Model the worked example before independent practice.', 'Circulate to the back row first.', 'Cold-call before hands go up.'],
        part1: {
          sent_at: '2026-02-11T08:00:00Z',
          answers: { q1: 'The lesson went well overall.', q2_level: 'Good', q2_comment: 'Progress showed in the exit tickets.', q3: 'No concerns.' },
        },
        part2: {
          sent_at: '2026-02-21T08:00:00Z',
          answers: {
            q4: 'Time management in group work.', q5: 'Use a visible timer.',
            q6: 'Starting next week, every lesson.', q7: 'My head of department, in our weekly meeting.',
            q8: 'More confident independent starts, by half term.',
          },
        },
        owed: [],
      },
    ],
  },
  {
    teacher: 'Zara Fictional Teacher',
    laps: [
      {
        lap: 1, observation_date: '2026-09-10', subject: 'English', grade: 'Year 8',
        observer: 'Alex Example', status: 'closed', closed_at: '2026-09-11T09:00:00Z',
        next_steps: ['Chunk the extended writing task.', 'Model the success criteria live.', 'Check in with the two quietest groups.'],
        part1: { sent_at: '2026-09-10T18:00:00Z', answers: { q1: 'Went smoothly.', q2_level: 'Great', q2_comment: '', q3: 'Nothing further.' } },
        part2: {
          sent_at: '2026-09-12T08:00:00Z',
          answers: {
            q4: 'Pacing.', q5: 'Chunk the tasks.', q6: 'From Monday, every lesson.',
            q7: 'My mentor, weekly.', q8: 'Faster starts, by next half term.',
          },
        },
        owed: [],
      },
    ],
  },
  {
    teacher: 'Noor Fictional Teacher',
    laps: [
      {
        lap: 2, observation_date: '2026-09-20', subject: 'Science', grade: 'Year 6',
        observer: 'Sam Example', status: 'observed', closed_at: null,
        part1: null, part2: null, owed: [1, 2],
      },
      {
        lap: 1, observation_date: '2026-01-15', subject: 'Science', grade: 'Year 6',
        observer: 'Sam Example', status: 'observed', closed_at: null,
        part1: null, part2: null, owed: [1],
      },
    ],
  },
];

type Harness = { errors: string[] };

/** Route every outbound call and collect console/page errors, mirroring Assets/OTP/tests/otp.spec.ts.
 *  cdnjs (three.js/gsap/MotionPathPlugin) is blocked too: every use in the master is guarded
 *  (`if(window.THREE)`, `if(window.gsap)`), so this just proves the resting end state renders
 *  correctly without motion, per the dashboard house style's rAF-safety rule. */
async function harness(page: Page): Promise<Harness> {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.route('**/fonts.googleapis.com/**', (r: Route) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/fonts.gstatic.com/**', (r: Route) => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));
  await page.route('**/favicon.ico', (r: Route) => r.fulfill({ status: 200, contentType: 'image/x-icon', body: '' }));
  await page.route('**/cdnjs.cloudflare.com/**', (r: Route) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/assets/**', (r: Route) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from([]) }));
  await page.route('**/*.supabase.co/**', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));

  // registered AFTER the generic supabase catch-all above, so these win (newest route wins).
  await page.route('**/data.js', (r: Route) => r.fulfill({ status: 200, contentType: 'application/javascript', body: DATA_JS_STUB }));
  await page.route('**/rest/v1/rpc/get_raw_snapshot', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RAW_SNAPSHOT) }));
  await page.route('**/rest/v1/rpc/get_otp_portal', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OTP_PORTAL_PAYLOAD) }));

  return { errors };
}

/** get_otp_portal fires ONCE at boot (loadOtpPortal(), like loadNarrative/loadNextSteps/loadPortalSeen).
 *  The listener MUST be registered before goto (a mocked/local response can resolve faster than the
 *  test gets back around to waiting for it, and a bare waitForResponse called afterwards would then
 *  hang for a response that already happened). Use this in place of a plain page.goto(PAGE_URL). */
async function gotoAndLoadOtp(page: Page) {
  const resp = page.waitForResponse((r) => r.url().includes('/rpc/get_otp_portal'));
  await page.goto(PAGE_URL);
  await resp;
}
/** Bypass the ~3s entry splash (pure visual, gated on document.fonts.ready + a fixed hold) by
 *  calling the page's own exposed functions directly; they are defined and usable the instant the
 *  inline script has run, independent of the entry overlay's own timing. */
async function selectTeacher(page: Page, teacherId: string) {
  await page.evaluate((id) => {
    (window as any).showBoard('portal');
    (window as any).openPortalTeacher(id);
  }, teacherId);
}

function otpRow(page: Page) {
  return page.locator('#portalPage [data-ptype="otp"]');
}
function otpBadge(page: Page) {
  return page.locator('#portalPage .hsecrow:has([data-ptype="otp"]) .hnew');
}

test('row 02: Not assessed for a non-reflection-flow teacher, owed for one with an unsent part, up to date once both parts are in', async ({ page }) => {
  const h = await harness(page);
  await gotoAndLoadOtp(page);

  await selectTeacher(page, 't-miles');
  await expect(otpRow(page).locator('.pl')).toHaveText('Not assessed');
  await expect(otpRow(page)).toBeDisabled();
  await expect(otpRow(page)).not.toHaveClass(/\bnew\b/);
  await expect(otpBadge(page)).toHaveCount(0);

  await selectTeacher(page, 't-priya');
  await expect(otpRow(page).locator('.pl')).toHaveText('Action needed');
  await expect(otpRow(page).locator('.tt small')).toHaveText('Observation 2 . 14 Sep');
  await expect(otpRow(page)).toHaveClass(/\bnew\b/);
  await expect(otpBadge(page)).toHaveText('1 form to fill in');
  await expect(otpRow(page)).toBeEnabled();

  await selectTeacher(page, 't-zara');
  await expect(otpRow(page).locator('.pl')).toHaveText('Up to date');
  await expect(otpRow(page).locator('.tt small')).toHaveText('Observation 1 . 10 Sep');
  await expect(otpRow(page)).not.toHaveClass(/\bnew\b/);
  await expect(otpBadge(page)).toHaveCount(0);

  expect(h.errors, 'console/page errors').toEqual([]);
});

test('badge sums owed across laps, including a lap owing both parts', async ({ page }) => {
  const h = await harness(page);
  await gotoAndLoadOtp(page);

  await selectTeacher(page, 't-noor');
  await expect(otpRow(page).locator('.pl')).toHaveText('Action needed');
  await expect(otpRow(page)).toHaveClass(/\bnew\b/);
  await expect(otpBadge(page)).toHaveText('3 forms to fill in');   // lap 2 owes [1,2] + lap 1 owes [1] = 3

  expect(h.errors, 'console/page errors').toEqual([]);
});

test('offline: get_otp_portal returns an empty response, row 02 stays Not assessed, no error UI', async ({ page }) => {
  const h = await harness(page);
  // registered AFTER harness()'s own get_otp_portal mock, so this wins (newest route wins). A 200
  // of `null` is how this codebase's own harness simulates "unreachable" everywhere else (the
  // generic *.supabase.co catch-all above does the same): loadOtpPortal's own guards (`!r.ok`,
  // `!Array.isArray(arr)`) bail out and OTP_PORTAL stays null. The next test below proves the same
  // resilience against a REAL network failure (r.abort()), which a browser logs to the console for
  // reasons unrelated to product code, so that test filters the console for it instead of skipping
  // the real-failure case.
  await page.route('**/rest/v1/rpc/get_otp_portal', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));

  // wait for the get_otp_portal response itself (not just get_raw_snapshot + a timer): proves the
  // fetch really fired, so a deleted/never-called loadOtpPortal() times out here instead of the
  // test passing on a page that never made the request at all.
  const rawResp = page.waitForResponse((r) => r.url().includes('/rpc/get_raw_snapshot'));
  const otpResp = page.waitForResponse((r) => r.url().includes('/rpc/get_otp_portal'));
  await page.goto(PAGE_URL);
  await Promise.all([rawResp, otpResp]);
  await page.evaluate((id) => {
    (window as any).showBoard('portal');
    (window as any).openPortalTeacher(id);
  }, 't-priya');
  // give the resolved fetch's .then() a moment to settle; the row must never flip to a live state.
  await page.waitForTimeout(300);

  await expect(otpRow(page).locator('.pl')).toHaveText('Not assessed');
  await expect(otpRow(page)).toBeDisabled();
  await expect(otpBadge(page)).toHaveCount(0);
  // #otpStack must exist in the DOM (row 02's markup was built) while staying hidden, not merely
  // "hidden" because it is absent (a hidden-or-missing locator also satisfies toBeHidden()).
  await expect(page.locator('#otpStack')).toHaveCount(1);
  await expect(page.locator('#otpStack')).toBeHidden();
  expect(h.errors, 'console/page errors').toEqual([]);
});

test('offline (real failure): get_otp_portal request aborted, row 02 stays Not assessed, no product error', async ({ page }) => {
  const h = await harness(page);
  // A genuine aborted request (not a well-formed empty response) proves loadOtpPortal's own
  // AbortController + try/catch actually swallows a real network failure, the case the test above
  // cannot reach. Registered AFTER harness()'s own get_otp_portal mock, so this wins.
  await page.route('**/rest/v1/rpc/get_otp_portal', (r: Route) => r.abort('failed'));

  // wait for the request to actually fail (Playwright's 'requestfailed' event), not just a timer:
  // proves the fetch really fired and really aborted, so a deleted/never-called loadOtpPortal()
  // times out here instead of the test passing on a page that never made the request at all.
  const rawResp = page.waitForResponse((r) => r.url().includes('/rpc/get_raw_snapshot'));
  const otpFailed = page.waitForEvent('requestfailed', (r) => r.url().includes('/rpc/get_otp_portal'));
  await page.goto(PAGE_URL);
  await Promise.all([rawResp, otpFailed]);
  await page.evaluate((id) => {
    (window as any).showBoard('portal');
    (window as any).openPortalTeacher(id);
  }, 't-priya');
  // give the aborted fetch's catch() a moment to settle; the row must never flip to a live state.
  await page.waitForTimeout(300);

  await expect(otpRow(page).locator('.pl')).toHaveText('Not assessed');
  await expect(otpRow(page)).toBeDisabled();
  await expect(otpRow(page)).not.toHaveClass(/\bnew\b/);
  await expect(otpBadge(page)).toHaveCount(0);
  // #otpStack must exist in the DOM (row 02's markup was built) while staying hidden, not merely
  // "hidden" because it is absent (a hidden-or-missing locator also satisfies toBeHidden()).
  await expect(page.locator('#otpStack')).toHaveCount(1);
  await expect(page.locator('#otpStack')).toBeHidden();

  // Chromium logs the browser's own net::ERR_FAILED line to the console for the aborted fetch;
  // that is not a product error, so it is filtered out here rather than asserted away entirely.
  const productErrors = h.errors.filter((e) => !/ERR_FAILED|Failed to load resource/i.test(e));
  expect(productErrors, 'non-network console/page errors').toEqual([]);
});

test('section cards: header, Next Steps only when closed, exact question wording, Not sent yet, action buttons absent', async ({ page }) => {
  const h = await harness(page);
  await gotoAndLoadOtp(page);
  await selectTeacher(page, 't-priya');
  await expect(otpRow(page).locator('.pl')).toHaveText('Action needed');

  await otpRow(page).click();
  const stack = page.locator('#otpStack');
  await expect(stack).toBeVisible();
  const cards = stack.locator('> .panel');
  await expect(cards).toHaveCount(2);

  // card 1 = the newer, open lap (2): no Closed badge, no Next Steps, both parts "Not sent yet".
  const card1 = cards.nth(0);
  await expect(card1).toContainText('OTP . Observation 2 . 14 Sep . Coach: Sam Example');
  await expect(card1.locator('.ns-badge.approved')).toHaveCount(0);
  await expect(card1.locator('.otpns')).toHaveCount(0);
  const notSent = card1.locator('.ns-empty');
  await expect(notSent).toHaveCount(2);
  await expect(notSent.nth(0)).toHaveText('Not sent yet.');
  await expect(notSent.nth(1)).toHaveText('Not sent yet.');

  // card 2 = the older, closed lap (1): Closed badge, Next Steps, both parts answered.
  const card2 = cards.nth(1);
  await expect(card2).toContainText('OTP . Observation 1 . 10 Feb . Coach: Sam Example');
  await expect(card2.locator('.ns-badge.approved')).toHaveText('Closed');
  const steps = card2.locator('.otpnsl li');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toHaveText('Model the worked example before independent practice.');

  for (const [n, q] of QUESTIONS) {
    const qEl = card2.locator('.otpq', { hasText: `${n}. ${q}` });
    await expect(qEl).toHaveCount(1);
  }
  await expect(card2.locator('.otpq p').nth(0)).toHaveText('The lesson went well overall.');
  await expect(card2.locator('.otpq p').nth(1)).toHaveText('Good. Progress showed in the exit tickets.');
  await expect(card2.locator('.otpq p').nth(2)).toHaveText('No concerns.');
  await expect(card2.locator('.otpq p').nth(7)).toHaveText('More confident independent starts, by half term.');

  // action buttons are built but stay off (PORTAL_TEACHER_ACTIONS = false, no SSO token yet).
  await expect(stack.locator('.otpacts')).toHaveCount(0);
  await expect(stack.locator('button.ns-btn')).toHaveCount(0);

  expect(h.errors, 'console/page errors').toEqual([]);
});

test('owed (Priya) and up-to-date (Zara) states, section cards, both themes at 820x1180 and 1280', async ({ page }) => {
  const h = await harness(page);
  for (const theme of ['light', 'dark'] as const) {
    for (const vp of [{ width: 820, height: 1180 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(vp);
      await gotoAndLoadOtp(page);
      if (theme === 'dark') await page.evaluate(() => (window as any).applyTheme('dark'));
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      // Priya: owed state, badge, .new ring, and both section cards (open + closed lap).
      await selectTeacher(page, 't-priya');
      await expect(otpRow(page).locator('.pl')).toHaveText('Action needed');
      await expect(otpRow(page)).toHaveClass(/\bnew\b/);
      await expect(otpBadge(page)).toHaveText('1 form to fill in');
      await otpRow(page).click();
      const priyaCards = page.locator('#otpStack > .panel');
      await expect(priyaCards).toHaveCount(2);
      const openCard = priyaCards.nth(0);
      const notSent = openCard.locator('.ns-empty');
      await expect(notSent).toHaveCount(2);
      await expect(notSent.nth(0)).toHaveText('Not sent yet.');
      const closedCard = priyaCards.nth(1);
      await expect(closedCard.locator('.ns-badge.approved')).toHaveText('Closed');
      await expect(closedCard.locator('.otpq', { hasText: '1. How did the lesson go? What worked, and what did not?' })).toHaveCount(1);
      await expect(closedCard.locator('.otpq', { hasText: '8. What change in student learning do you expect, and by when?' })).toHaveCount(1);
      await expect(priyaCards.locator('.otpacts')).toHaveCount(0);

      // Zara: up-to-date state, q2 with no comment renders the level alone.
      await selectTeacher(page, 't-zara');
      await expect(otpRow(page).locator('.pl')).toHaveText('Up to date');
      await expect(otpRow(page)).not.toHaveClass(/\bnew\b/);
      await otpRow(page).click();
      const card = page.locator('#otpStack > .panel').first();
      await expect(card).toContainText('OTP . Observation 1 . 10 Sep . Coach: Alex Example');
      await expect(card.locator('.otpq p').nth(1)).toHaveText('Great');   // q2_comment '' -> level alone, no trailing punctuation
      await expect(card.locator('.otpacts')).toHaveCount(0);
    }
  }
  expect(h.errors, `console/page errors across ${JSON.stringify(['light','dark'])} x [820x1180, 1280x900]`).toEqual([]);
});
