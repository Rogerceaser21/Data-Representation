/**
 * otp-v0.7 · Progress in Lessons OTP form
 *
 * Tests the BUILT artifacts (the StatiCrypt-gated form and the ungated record
 * viewer), not the master, because the master's relative paths (../R3/lib/,
 * ../brand/) resolve from the OUTPUT location. Run `bash Assets/OTP/encrypt.sh`
 * before this spec; the tests below assert both outputs exist.
 *
 * Every call to script.google.com and supabase.co is mocked; nothing leaves
 * the machine.
 */
import { test, expect, Browser, Page, Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

type Rubric = {
  aspect: string;
  levels: { key: string; label: string; paragraphs: string[] }[];
};

/** otp-v0.6: v2 is LIVE (32 single-sentence criteria); v1 renders legacy records. */
const RUBRIC = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'rubric-sp1-v2.json'), 'utf8'),
) as Rubric;
const RUBRIC_V1 = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'rubric-sp1.json'), 'utf8'),
) as Rubric;

const level = (key: string) => RUBRIC.levels.find((l) => l.key === key)!;
const criterion = (key: string, n: number) => level(key).paragraphs[n - 1];

/** Every "<Level> <n>" criterion label, level order then ascending n. */
const criteriaOf = (r: Rubric): string[] =>
  r.levels.flatMap((l) => l.paragraphs.map((_p, i) => `${l.label} ${i + 1}`));
const ALL_CRITERIA = criteriaOf(RUBRIC);
const ALL_CRITERIA_V1 = criteriaOf(RUBRIC_V1);

/** The complement list, i.e. everything that is NOT one of `coloured`. */
const notSeenWithout = (...coloured: string[]) =>
  ALL_CRITERIA.filter((c) => !coloured.includes(c)).join(', ');
const notSeenWithoutV1 = (...coloured: string[]) =>
  ALL_CRITERIA_V1.filter((c) => !coloured.includes(c)).join(', ');

/** Both record fixtures colour Good 1, Good 3 and Great 2. */
const RECORD_NOT_SEEN = notSeenWithout('Good 1', 'Good 3', 'Great 2');
const RECORD_NOT_SEEN_V1 = notSeenWithoutV1('Good 1', 'Good 3', 'Great 2');

const FORM_URL = '/Assets/OTP/otp-progress-form.html';
const RECORD_URL = '/Assets/OTP/otp-record.html';
const GATE_PASSWORD = 'ais2026ais';
const DRAFT_KEY = 'ais-otp-form-v1';

/** Exactly the CONTRACT the OTP backend tasks are built against (otp-v0.6 §2). */
const CONTRACT_KEYS = [
  'form',
  'teacher',
  'curriculum',
  'inspector',
  'date',
  'room_number',
  'time_in',
  'time_out',   // otp-v0.8
  'subject',
  'school',
  'grade',
  'support_teachers_cas',
  'otp_ref',
  'otp_aspect',
  'sp1_beginner',
  'sp1_emerging',
  'sp1_good',
  'sp1_great',
  'sp1_outstanding',
  'sp1_selected_text',
  'sp1_present',
  'sp1_partially_present',
  'sp1_not_present',
  'sp1_not_seen',
  'sp1_notes',
  'rubric_version',
  'observer_comments',
  'other_observations',
  'next_step_1',
  'next_step_2',
  'next_step_3',
  'evidence_pad_id',
].sort();

/**
 * The contract document itself, so the list above is proved against the spec
 * rather than against a second hand typed copy of it. otp-v0.8: the §2 list
 * of the v0.8 contract names 32 keys (the 31 of otp-v0.6 plus time_out), and
 * the form posts exactly those 32.
 */
const CONTRACT_DOC = path.join(
  __dirname, '..', '..', '..', '.planning', '2026-09-10-otp-v0.8-contract.md',
);

/** The §2 code block of the contract, read as a sorted key list. */
const contractKeysFromDoc = (): string[] => {
  const section = fs
    .readFileSync(CONTRACT_DOC, 'utf8')
    .split(/^## /m)
    .find((part) => part.startsWith('2. Payload'));
  const block = /```\n([\s\S]*?)```/.exec(section || '');
  return (block ? block[1] : '').split(/[,\s]+/).filter(Boolean).sort();
};

const OPTIONS_PAYLOAD = {
  success: true,
  options: {
    teachers: [{ name: 'Test Teacher', email: 'test.teacher@ais.ae' }],
    inspectors: ['Test Observer'],
    curricula: ['Australian', 'MoE'],
    schools: ['Kindy', 'Primary', 'Secondary'],
    subjects: [
      { name: 'Mathematics', active: true, kindy: true, primary: true, secondary: true },
      { name: 'Science', active: true, kindy: false, primary: true, secondary: true },
    ],
  },
};

const RECORD_HEADER = {
  record_id: 'AIS-OTP-20260903-101500',
  submitted_at: '2026-09-03T10:15:00.000Z',
  teacher: 'Test Teacher',
  support_teachers_cas: 'Ms Support CA',
  time_in: '09:15',
  time_out: '10:05',   // otp-v0.8
  observer: 'Test Observer',   // the OTP Sheet's header (the form field is `inspector`); otp-v0.9 proof caught the missing mapping
  curriculum: 'Australian',
  school: 'Primary',
  grade: '3',
  observation_date: '2026-09-03',
  room_number: '12B',
  subject: 'Mathematics',
  otp_ref: 'SP1',
  otp_aspect: 'Facilitating better than expected progress',
  observer_comments: 'Record observer comments',
  other_observations: 'Record other observations',
  next_step_1: 'Record next step one',
  next_step_2: 'Record next step two',
  next_step_3: 'Record next step three',
};

const RECORD_NOTES = {
  'Good 3': 'challenge is not provided',
  'Great 5': 'students still on SC1',
};

/** otp-v0.6 record: rubric_version "sp1-v2", so it renders on the 32 criteria. */
const RECORD_PAYLOAD = {
  success: true,
  data: {
    ...RECORD_HEADER,
    // otp-v0.2 format, plus sp1_great as a legacy otp-v0.1 bare number
    sp1_good: '1:not present, 3:partially present',
    sp1_great: '2',
    sp1_selected_text: [
      `Good 1 (Not present): ${criterion('good', 1)}`,
      `Good 3 (Partially present): ${criterion('good', 3)} Note: ${RECORD_NOTES['Good 3']}`,
      `Great 2 (Present): ${criterion('great', 2)}`,
      `Great 5 (Not assessed): ${criterion('great', 5)} Note: ${RECORD_NOTES['Great 5']}`,
    ].join(' | '),
    sp1_present: 'Great 2',
    sp1_partially_present: 'Good 3',
    sp1_not_present: 'Good 1',
    sp1_not_seen: RECORD_NOT_SEEN,
    sp1_notes: JSON.stringify(RECORD_NOTES),
    rubric_version: 'sp1-v2',
  },
  // otp-v0.6: a handwritten pad page for the Great 5 note, none for Good 3
  pad_files: ['sp1-great-5-note.jpg'],
};

/** otp-v0.9: the token GET now also carries status, closed_at and lap. */
const EDIT_TOKEN_FIXTURE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

const RECORD_PAYLOAD_OPEN = {
  ...RECORD_PAYLOAD,
  data: {
    ...RECORD_PAYLOAD.data,
    status: 'observed',
    closed_at: '',
    lap: '1',
    round: 'OTP Term 1 26-27',
    evidence_pad_id: 'pad-abc123',
  },
};

const RECORD_PAYLOAD_CLOSED = {
  ...RECORD_PAYLOAD,
  data: {
    ...RECORD_PAYLOAD.data,
    status: 'closed',
    closed_at: '2026-09-08T07:20:00.000Z',
    lap: '2',
    round: 'OTP Term 1 26-27',
    evidence_pad_id: 'pad-abc123',
  },
};

/** otp-v0.9: the previous (closed) lap, as ?action=prev_next_steps returns it.
 *  otp-v0.9.3: lap/date/observer match the contract's own worked example
 *  (Lap 8, 11 Sept 2026, Igor Sesar) so the card/echo text specs read verbatim. */
const PREV_NS_FOUND = {
  success: true,
  found: true,
  lap: '8',
  observation_date: '2026-09-11',
  observer: 'Igor Sesar',
  next_step_1: 'Plan a stretch task for the top table',
  next_step_2: 'Give thinking time before taking answers',
  next_step_3: 'Share the success criteria at the start',
};
const PREV_NS_STEPS = [
  PREV_NS_FOUND.next_step_1,
  PREV_NS_FOUND.next_step_2,
  PREV_NS_FOUND.next_step_3,
];

/** otp-v0.5 record: no rubric_version, so it renders on the 26 v1 paragraphs. */
const RECORD_PAYLOAD_LEGACY = {
  success: true,
  data: {
    ...RECORD_HEADER,
    sp1_good: '1:not present, 3:partially present',
    sp1_great: '2',
    sp1_selected_text: 'recorded selection',
    sp1_present: 'Great 2',
    sp1_partially_present: 'Good 3',
    sp1_not_present: 'Good 1',
    sp1_not_seen: RECORD_NOT_SEEN_V1,
  },
  pad_files: [],
};

type Harness = { errors: string[]; posts: any[] };

/** Route every outbound call and collect console/page errors. */
async function harness(
  page: Page,
  opts: { record?: any; extract?: string; prev?: any | 'fail'; options?: any } = {},
): Promise<Harness> {
  const errors: string[] = [];
  const posts: any[] = [];
  const record = opts.record || RECORD_PAYLOAD;

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.route('**/fonts.googleapis.com/**', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  await page.route('**/fonts.gstatic.com/**', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'font/woff2', body: '' })
  );
  await page.route('**/favicon.ico', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'image/x-icon', body: '' })
  );
  await page.route('**/*.supabase.co/**', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  );

  await page.route('**/script.google.com/**', (r: Route) => {
    const req = r.request();
    const url = req.url();
    const json = (body: unknown) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (req.method() === 'POST') {
      let parsed: any = {};
      try {
        parsed = JSON.parse(req.postData() || '{}');
      } catch {
        /* keep the raw failure visible via an empty object */
      }
      posts.push(parsed);
      // the Evidence Pad extract call shares this endpoint
      if (parsed.action === 'extract_pad') {
        return json({ success: true, items: [{ text: opts.extract || 'transcribed pad text' }] });
      }
      // otp-v0.9: the coaching lifecycle writes back to the same row
      if (parsed.action === 'update') {
        return json({ success: true, id: 'AIS-OTP-TEST', status: 'observed' });
      }
      if (parsed.action === 'close') {
        return json({
          success: true,
          id: 'AIS-OTP-TEST',
          status: 'closed',
          closed_at: '2026-09-11T09:30:00.000Z',
        });
      }
      return json({ success: true, id: 'AIS-OTP-TEST' });
    }
    if (url.includes('action=options')) {
      expect(url).toContain('form=otp');
      return json(opts.options || OPTIONS_PAYLOAD);
    }
    // otp-v0.9: the previous lap's Next Steps. 'fail' kills the call outright,
    // so the form has to cope with a dead network, not just with "none found".
    if (url.includes('action=prev_next_steps')) {
      expect(url).toContain('form=otp');
      expect(url).toContain('teacher=');
      // a garbled answer: 200, but not JSON. The page must swallow it whole.
      if (opts.prev === 'fail') {
        return r.fulfill({ status: 200, contentType: 'text/plain', body: 'upstream is down' });
      }
      return json(opts.prev || { success: true, found: false });
    }
    if (url.includes('form=otp') && url.includes('token=')) {
      return json(record);
    }
    return json({ success: false, error: 'unexpected request: ' + url });
  });

  return { errors, posts };
}

/** Open the gated form: pass the StatiCrypt gate, wait for options to land. */
async function openForm(page: Page) {
  await page.goto(FORM_URL);
  await passGate(page);
}

/** otp-v0.9: the gated form, reopened on an existing record with ?edit=. */
async function openEdit(page: Page, token: string = EDIT_TOKEN_FIXTURE) {
  await page.goto(`${FORM_URL}?edit=${token}`);
  await passGate(page);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
}

/** The visible text of the whole submitted / lap banner. */
const bannerText = (page: Page) => page.locator('#submitted-banner').innerText();

/** The date as the form renders it in a lap banner or a card heading, as a
 *  pattern: engines disagree on the short month (Chromium "Sept", WebKit
 *  "Sep"), so the month is matched by its first three letters. */
const dayPat = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3);
  return `${dd} ${mon}[a-z]* ${d.getFullYear()}`;
};
const dayRe = (prefix: string, iso: string) => new RegExp(prefix + dayPat(iso));

async function passGate(page: Page) {
  await page.fill('#staticrypt-password', GATE_PASSWORD);
  await page.click('#staticrypt-form .staticrypt-decrypt-button');
  await page.waitForSelector('#otp-form', { state: 'attached' });
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
}

async function pickTomSelect(page: Page, field: string, label: string) {
  await page.locator(`#${field}`).locator('xpath=following-sibling::div[1]').click();
  await page.locator('.ts-dropdown .option', { hasText: label }).first().click();
}

/** The visible Tom Select control rendered next to a wrapped <select>. */
const gradeControl = (page: Page) =>
  page.locator('#grade').locator('xpath=following-sibling::div[1]');

/** The same, for any wrapped <select> (otp-v0.9.1). */
const tsControl = (page: Page, field: string) =>
  page.locator(`#${field}`).locator('xpath=following-sibling::div[1]');

/** Grade is a number-picker grid: exact option text, no typing. */
async function pickGrade(page: Page, label: string) {
  await page.locator('#grade').locator('xpath=following-sibling::div[1]').click();
  await page.locator('.ts-dropdown.number-picker .option').filter({ hasText: new RegExp(`^${label}$`) }).click();
}

async function fillRequired(page: Page) {
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await pickTomSelect(page, 'inspector', 'Test Observer');
  await page.locator('#curriculum-pills .pill', { hasText: 'Australian' }).click();
  await pickGrade(page, '3');   // otp-v0.5: grade 3 derives school "Primary"
  await pickTomSelect(page, 'subject', 'Mathematics');
  await page.fill('#date', '2026-09-03');
  await page.fill('#time_in', '09:15');
  await page.fill('#time_out', '10:05');   // otp-v0.8: required, at the bottom
}

/** otp-v0.6/v0.7 helpers: the chip, its "+" note button and the note card. */
const chipAt = (page: Page, key: string, n: number) =>
  page.locator(`.rub-chip[data-level="${key}"][data-n="${n}"]`);
const noteBtnAt = (page: Page, key: string, n: number) =>
  page.locator(`.rub-note-btn[data-level="${key}"][data-n="${n}"]`);
/** otp-v0.7: ONE permanently mounted card; open/closed lives on data-state. */
const notePop = (page: Page) => page.locator('#rub-note-pop');
const noteScrim = (page: Page) => page.locator('#rub-note-scrim');
const expectPop = (page: Page, state: 'open' | 'closed') =>
  expect(notePop(page)).toHaveAttribute('data-state', state);
const noteText = (page: Page, key: string, n: number) =>
  page.locator(`#sp1_note_${key}_${n}`);

/** otp-v0.7: the viewport point of an element (its centre, or `dy` px below
 *  its top edge), with the page scrolled so that point sits mid-viewport,
 *  clear of the sticky masthead. */
async function pointOf(page: Page, sel: string, dy?: number) {
  return page.evaluate(
    ([s, d]) => {
      const el = document.querySelector(s as string)!;
      const at = (r: DOMRect) => (d === null ? r.top + r.height / 2 : r.top + (d as number));
      window.scrollBy(0, at(el.getBoundingClientRect() as DOMRect) - window.innerHeight * 0.5);
      const r = el.getBoundingClientRect() as DOMRect;
      return { x: r.left + r.width / 2, y: at(r) };
    },
    [sel, dy === undefined ? null : dy] as [string, number | null],
  );
}

/** A real tap at that point: whatever the browser paints on top receives it
 *  (while a card is open that is the scrim, never the chip underneath). */
async function tapAt(page: Page, sel: string, dy?: number) {
  const p = await pointOf(page, sel, dy);
  await page.mouse.click(p.x, p.y);
}

/** Everything stacked at that same point, topmost first. */
async function stackAt(page: Page, sel: string, dy?: number): Promise<string[]> {
  const p = await pointOf(page, sel, dy);
  return page.evaluate(
    ([x, y]) => document.elementsFromPoint(x, y).map((e) => e.id || e.getAttribute('class') || e.tagName),
    [p.x, p.y] as [number, number],
  );
}

/** A tap on a chip, 8px below its top edge: never behind a card anchored at
 *  that chip's own "+", which sits at its bottom-right corner. */
const chipSel = (key: string, n: number) => `.rub-chip[data-level="${key}"][data-n="${n}"]`;
const tapChip = (page: Page, key: string, n: number) => tapAt(page, chipSel(key, n), 8);

/** A tap on a "+". With the card shut this is an ordinary click; while it is
 *  open the scrim covers the table, so the tap lands on the scrim and the form
 *  routes it to the button underneath (Playwright's own click would refuse an
 *  intercepted element). */
async function tapNoteBtn(page: Page, key: string, n: number) {
  if ((await notePop(page).getAttribute('data-state')) === 'open') {
    await tapAt(page, `.rub-note-btn[data-level="${key}"][data-n="${n}"]`);
    return;
  }
  await noteBtnAt(page, key, n).click();
}

/** The three viewports the otp-v0.7 contract measures at. */
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1180, height: 820 },   // iPad Pro landscape
  { width: 820, height: 1180 },   // iPad portrait
];

/** The built teacher viewer is the master, unencrypted, so its CSS is readable. */
const viewerSrc = () =>
  fs.readFileSync(path.join(__dirname, '..', 'otp-record.html'), 'utf8');

test.beforeAll(() => {
  for (const f of ['otp-progress-form.html', 'otp-record.html']) {
    const p = path.join(__dirname, '..', f);
    expect(fs.existsSync(p), `${f} missing, run: bash Assets/OTP/encrypt.sh`).toBeTruthy();
  }
});

test('renders all 32 SP1 v2 rubric chips verbatim, in order, 4/5/7/8/8', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const expected: string[] = [];
  for (const lvl of RUBRIC.levels) expected.push(...lvl.paragraphs);
  expect(expected).toHaveLength(32);
  expect(RUBRIC.levels.map((l) => l.paragraphs.length)).toEqual([4, 5, 7, 8, 8]);

  const chips = page.locator('.rub-chip');
  await expect(chips).toHaveCount(32);
  expect(await chips.allTextContents()).toEqual(expected);

  // per-level counts on the page itself, not just in the JSON
  for (const l of RUBRIC.levels) {
    await expect(
      page.locator(`.rub-chip[data-level="${l.key}"]`),
      l.key,
    ).toHaveCount(l.paragraphs.length);
  }

  // layout v2 (approved mock 2026-09-03): the level header carries only the five
  // levels; the aspect sits in a full-width caption row above it.
  expect(await page.locator('#rubric-head th').allTextContents()).toEqual(
    RUBRIC.levels.map((l) => l.label),
  );
  await expect(page.locator('tr.rub-caption .rub-cap-k')).toHaveText('Aspect of Practice');
  await expect(page.locator('tr.rub-caption .rub-cap-v')).toHaveText(RUBRIC.aspect);
  // the footer renders uppercase through CSS, so match the text case-insensitively
  await expect(page.locator('.form-footer')).toContainText(/otp-v0\.9/i);
  await expect(page.locator('#rubric_version')).toHaveValue('sp1-v2');

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: every chip carries a sibling "+" note button, never a nested one', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  await expect(page.locator('.rub-note-btn')).toHaveCount(32);
  // a button inside a button is invalid HTML and would swallow the tap cycle
  await expect(page.locator('.rub-chip .rub-note-btn')).toHaveCount(0);

  const shape = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.rub-chip')).map((chip) => {
      const next = chip.nextElementSibling as HTMLElement | null;
      const c = chip as HTMLElement;
      return {
        sibling: !!next && next.classList.contains('rub-note-btn'),
        sameCell: !!next && next.parentElement === chip.parentElement,
        inCell: !!chip.closest('.rub-cell') && !!(next && next.closest('.rub-cell')),
        matches: !!next && next.dataset.level === c.dataset.level && next.dataset.n === c.dataset.n,
        type: next ? (next as HTMLButtonElement).type : '',
        glyph: next ? (next.textContent || '').trim() : '',
        label: next ? next.getAttribute('aria-label') : '',
      };
    }),
  );
  expect(shape).toHaveLength(32);
  for (const s of shape) {
    expect(s.sibling).toBe(true);
    expect(s.sameCell).toBe(true);
    expect(s.inCell).toBe(true);
    expect(s.matches).toBe(true);
    expect(s.type).toBe('button');
    // otp-v0.7: the plus is drawn in CSS, so the button carries no text glyph
    expect(s.glyph).toBe('');
  }
  expect(shape[0].label).toBe('Add a note for Beginner 1');

  // otp-v0.7: the v0.6 note ROW is gone; one permanent card and one permanent
  // scrim replace it, mounted inside the rubric section
  await expect(page.locator('tr.rub-note-row')).toHaveCount(0);
  await expect(notePop(page)).toHaveCount(1);
  await expect(noteScrim(page)).toHaveCount(1);
  expect(
    await notePop(page).evaluate((el) => !!el.closest('#rubric-section')),
  ).toBe(true);
  expect(
    await noteScrim(page).evaluate((el) => !!el.closest('#rubric-section')),
  ).toBe(true);

  expect(h.errors).toEqual([]);
});

test('otp-v0.7.1: the "+" is a 20px circle inset 4px, hit area 36x32, clear of every word, plus dead-centre', async ({ page }) => {
  const h = await harness(page);

  for (const size of [VIEWPORTS[0], VIEWPORTS[2]]) {
    await page.setViewportSize(size);
    await openForm(page);

    const geo = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.rub-note-btn')).map((el) => {
        const btn = el as HTMLElement;
        const chip = btn.previousElementSibling as HTMLElement;
        const cb = chip.getBoundingClientRect();
        const bb = btn.getBoundingClientRect();
        const before = getComputedStyle(btn, '::before');
        const padLeft = Math.abs(parseFloat(before.left || '0'));
        const padRight = Math.abs(parseFloat(before.right || '0'));
        const padTop = Math.abs(parseFloat(before.top || '0'));
        const padBottom = Math.abs(parseFloat(before.bottom || '0'));
        // otp-v0.7.1: every client rect of the chip's TEXT span (the trailing
        // float spacer is the corner the button owns, by design)
        const text = chip.querySelector('.rub-chip-text') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(text);
        const ccs = getComputedStyle(chip);
        // otp-v0.7.1: the plus is an SVG path; its geometry box must sit on
        // the exact centre of the circle
        const path = btn.querySelector('svg path') as SVGPathElement | null;
        const pr = path ? path.getBoundingClientRect() : null;
        const hits = Array.from(range.getClientRects()).filter(
          (r) => r.right > bb.left && r.left < bb.right && r.bottom > bb.top && r.top < bb.bottom,
        ).length;
        return {
          w: bb.width, h: bb.height,
          insetRight: cb.right - bb.right,
          insetBottom: cb.bottom - bb.bottom,
          hitW: bb.width + padLeft + padRight, hitH: bb.height + padTop + padBottom,
          padBottomEndsAtChip: Math.abs((bb.bottom + padBottom) - cb.bottom),
          padRightEndsAtChip: Math.abs((bb.right + padRight) - cb.right),
          text: (btn.textContent || '').trim(),
          textRects: range.getClientRects().length,
          hits,
          gap: !!chip.querySelector('.rub-note-gap'),
          chipPadTop: parseFloat(ccs.paddingTop), chipPadBottom: parseFloat(ccs.paddingBottom),
          plusDx: pr ? ((pr.left + pr.right) / 2 - (bb.left + bb.right) / 2) : 99,
          plusDy: pr ? ((pr.top + pr.bottom) / 2 - (bb.top + bb.bottom) / 2) : 99,
          plusW: pr ? pr.width : 0, plusH: pr ? pr.height : 0,
        };
      }),
    );
    expect(geo, String(size.width)).toHaveLength(32);
    for (const g of geo) {
      expect(g.w, String(size.width)).toBe(20);
      expect(g.h, String(size.width)).toBe(20);
      expect(Math.abs(g.insetRight - 4), String(size.width)).toBeLessThan(0.01);
      expect(Math.abs(g.insetBottom - 4), String(size.width)).toBeLessThan(0.01);
      expect(g.hitW, String(size.width)).toBeGreaterThanOrEqual(36);
      expect(g.hitH, String(size.width)).toBeGreaterThanOrEqual(32);
      // the tap pad ends exactly on the chip's right and bottom edges, never
      // beyond them (beyond the last column it would widen the wrapper)
      expect(g.padBottomEndsAtChip, String(size.width)).toBeLessThan(0.01);
      expect(g.padRightEndsAtChip, String(size.width)).toBeLessThan(0.01);
      expect(g.text, String(size.width)).toBe('');
      expect(g.textRects, String(size.width)).toBeGreaterThan(0);
      expect(g.hits, String(size.width)).toBe(0);
      // otp-v0.7.1: the chip hugs its text: no reserved strip, the float
      // spacer does the corner
      expect(g.gap, String(size.width)).toBe(true);
      expect(Math.abs(g.chipPadBottom - g.chipPadTop), String(size.width)).toBeLessThan(0.01);
      // the plus is dead-centre in the circle, 12px arms
      expect(Math.abs(g.plusDx), String(size.width)).toBeLessThan(0.02);
      expect(Math.abs(g.plusDy), String(size.width)).toBeLessThan(0.02);
      expect(Math.abs(g.plusW - 12), String(size.width)).toBeLessThan(0.05);
      expect(Math.abs(g.plusH - 12), String(size.width)).toBeLessThan(0.05);
    }

    // the plus itself: an inline SVG on integer coordinates, no pseudo-element
    const plus = await page.evaluate(() => {
      const btn = document.querySelector('.rub-note-btn') as HTMLElement;
      const path = btn.querySelector('svg path') as SVGPathElement;
      const ps = getComputedStyle(path);
      return {
        after: getComputedStyle(btn, '::after').content,
        viewBox: btn.querySelector('svg')!.getAttribute('viewBox'),
        d: path.getAttribute('d'),
        stroke: ps.strokeWidth, cap: ps.strokeLinecap, fill: ps.fill,
        pe: getComputedStyle(btn.querySelector('svg')!).pointerEvents,
      };
    });
    expect(plus.after).toBe('none');
    expect(plus.viewBox).toBe('0 0 18 18');
    expect(plus.d).toBe('M9 3v12M3 9h12');
    expect(plus.stroke).toBe('2px');
    expect(plus.cap).toBe('butt');
    expect(plus.fill).toBe('none');
    expect(plus.pe).toBe('none');
  }

  expect(h.errors).toEqual([]);
});

test('otp-v0.7: "+" opens the one anchored card, in flow rules, with this criterion\'s pad buttons', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  // permanently mounted, and closed until a "+" is tapped
  await expect(notePop(page)).toHaveCount(1);
  await expectPop(page, 'closed');
  await expect(notePop(page)).toHaveAttribute('aria-hidden', 'true');
  expect(
    await notePop(page).evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe('none');
  // never display, hidden or visibility toggled (the iOS raster rule)
  const shut = await notePop(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { display: cs.display, visibility: cs.visibility, hidden: (el as HTMLElement).hidden, opacity: cs.opacity };
  });
  expect(shut.display).not.toBe('none');
  expect(shut.visibility).toBe('visible');
  expect(shut.hidden).toBe(false);
  expect(shut.opacity).toBe('0');

  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await expect(notePop(page)).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#rub-note-head')).toHaveText('Good 3 · Not assessed');
  await expect(page.locator('#rub-note-dot')).toHaveAttribute('data-state', '');
  await expect(page.locator('#rub-note-crit')).toHaveText(criterion('good', 3));
  // the textarea takes this criterion's id on open
  await expect(noteText(page, 'good', 3)).toHaveCount(1);
  // no name attribute: the note is never posted or drafted from the textarea
  expect(
    await noteText(page, 'good', 3).evaluate((el) => (el as HTMLTextAreaElement).name),
  ).toBe('');
  expect(
    await noteText(page, 'good', 3).evaluate((el) => (el as HTMLTextAreaElement).rows),
  ).toBe(3);

  const flow = await page.evaluate(() => {
    const pop = document.getElementById('rub-note-pop') as HTMLElement;
    const scrim = document.getElementById('rub-note-scrim') as HTMLElement;
    return {
      popPosition: getComputedStyle(pop).position,
      scrimPosition: getComputedStyle(scrim).position,
      inSection: pop.parentElement!.id,
      sectionPosition: getComputedStyle(document.getElementById('rubric-section')!).position,
      bodyPosition: getComputedStyle(document.body).position,
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyTop: document.body.style.top,
      focusIsTextarea: document.activeElement === document.querySelector('#sp1_note_good_3'),
      rows: document.querySelectorAll('tr.rub-note-row').length,
    };
  });
  // iPad law: absolute, never fixed; no scroll lock, no body reposition
  expect(flow.popPosition).toBe('absolute');
  expect(flow.scrimPosition).toBe('absolute');
  expect(flow.inSection).toBe('rubric-section');
  expect(flow.sectionPosition).toBe('relative');
  expect(flow.bodyPosition).toBe('static');
  expect(flow.bodyOverflow).not.toBe('hidden');
  expect(flow.bodyTop).toBe('');
  // and no auto-focus: a Pencil user must not get the keyboard
  expect(flow.focusIsTextarea).toBe(true);   // otp-v0.8: the note IS focused on open (Igor)
  // the v0.6 table row is gone for good
  expect(flow.rows).toBe(0);

  // the card carries this criterion's Evidence Pad buttons, set on open
  await expect(
    notePop(page).locator('.pad-field-btn[data-pad-target="sp1_good_3_note"]'),
  ).toHaveCount(1);
  await expect(
    notePop(page).locator('.pad-attach[data-pad-target="sp1_good_3_note"]'),
  ).toBeHidden();

  // and it hands them back on close, so the page carries only the five
  // standing pad launchers while the card is shut
  await page.locator('.rub-note-done').click();
  await expectPop(page, 'closed');
  await expect(page.locator('.pad-field-btn[data-pad-target]')).toHaveCount(5);
  await expect(noteText(page, 'good', 3)).toHaveCount(0);

  expect(h.errors).toEqual([]);
});

test('otp-v0.7: Done, the scrim, Esc and the same "+" close the card; another "+" re-anchors it', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  // Done
  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await page.locator('.rub-note-done').click();
  await expectPop(page, 'closed');

  // the scrim: it covers the rubric section and closes on a tap. otp-v0.7:
  // that tap lands on a CHIP, because the scrim paints OVER the table. The
  // card closes and the chip underneath keeps its colour, so an observer
  // tapping "outside" to dismiss never changes their data by accident.
  const dismissChip = chipAt(page, 'beginner', 1);
  await dismissChip.click();                       // card shut: the tap cycles
  await expect(dismissChip).toHaveAttribute('data-state', 'present');
  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await expect(noteScrim(page)).toHaveAttribute('data-state', 'open');
  const scrimBox = await page.evaluate(() => {
    const sc = document.getElementById('rub-note-scrim')!.getBoundingClientRect();
    const se = document.getElementById('rubric-section')!.getBoundingClientRect();
    return { dl: sc.left - se.left, dt: sc.top - se.top, dw: sc.width - se.width, dh: sc.height - se.height };
  });
  expect(Math.abs(scrimBox.dl)).toBeLessThan(0.5);
  expect(Math.abs(scrimBox.dt)).toBeLessThan(0.5);
  expect(Math.abs(scrimBox.dw)).toBeLessThan(0.5);
  expect(Math.abs(scrimBox.dh)).toBeLessThan(0.5);
  // the scrim, not the chip, is what that tap point hits
  const dismissStack = await stackAt(page, chipSel('beginner', 1), 8);
  expect(dismissStack[0]).toBe('rub-note-scrim');
  expect(dismissStack.some((c) => c.includes('rub-chip'))).toBe(true);
  await tapChip(page, 'beginner', 1);
  await expectPop(page, 'closed');
  await expect(noteScrim(page)).toHaveAttribute('data-state', 'closed');
  // the chip it landed on did NOT cycle
  await expect(dismissChip).toHaveAttribute('data-state', 'present');
  await expect(page.locator('#sp1_beginner')).toHaveValue('1:present');
  expect(
    await notePop(page).evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe('none');
  // back to clear, so the rest of the spec starts where it did
  await dismissChip.click();
  await dismissChip.click();
  await dismissChip.click();
  await expect(dismissChip).toHaveAttribute('data-state', '');

  // Esc
  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await page.keyboard.press('Escape');
  await expectPop(page, 'closed');

  // the same "+" again
  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'closed');

  // another "+" re-anchors the one card: still open, at a new spot
  await tapNoteBtn(page, 'beginner', 1);
  await expectPop(page, 'open');
  const first = await notePop(page).evaluate((el) => ({
    left: (el as HTMLElement).style.left,
    top: (el as HTMLElement).style.top,
    origin: (el as HTMLElement).style.transformOrigin,
  }));
  await tapNoteBtn(page, 'outstanding', 8);
  await expectPop(page, 'open');
  await expect(page.locator('#rub-note-head')).toHaveText('Outstanding 8 · Not assessed');
  const second = await notePop(page).evaluate((el) => ({
    left: (el as HTMLElement).style.left,
    top: (el as HTMLElement).style.top,
    origin: (el as HTMLElement).style.transformOrigin,
  }));
  expect(second.left).not.toBe(first.left);
  expect(second.top).not.toBe(first.top);
  expect(second.origin).not.toBe('');
  // still exactly one card, never a second one
  await expect(notePop(page)).toHaveCount(1);
  await expect(page.locator('[data-state="open"].rub-note-pop')).toHaveCount(1);

  expect(h.errors).toEqual([]);
});

test('otp-v0.7: a tap through the scrim on another "+" re-anchors the card there', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  await tapNoteBtn(page, 'good', 1);
  await expectPop(page, 'open');
  await expect(noteText(page, 'good', 1)).toHaveCount(1);

  // the point over Great 2's "+" belongs to the scrim now, with the button
  // still underneath it: the tap is routed, not swallowed
  const stack = await stackAt(page, '.rub-note-btn[data-level="great"][data-n="2"]');
  expect(stack[0]).toBe('rub-note-scrim');
  expect(stack.some((c) => c.includes('rub-note-btn'))).toBe(true);

  await tapNoteBtn(page, 'great', 2);
  await expectPop(page, 'open');
  await expect(noteText(page, 'great', 2)).toHaveCount(1);
  await expect(noteText(page, 'good', 1)).toHaveCount(0);
  await expect(page.locator('#rub-note-head')).toHaveText('Great 2 · Not assessed');
  await expect(page.locator('#rub-note-crit')).toHaveText(criterion('great', 2));
  // still one card, and the chip under that tap kept its colour
  await expect(page.locator('[data-state="open"].rub-note-pop')).toHaveCount(1);
  await expect(chipAt(page, 'great', 2)).toHaveAttribute('data-state', '');
  await expect(page.locator('#sp1_great')).toHaveValue('');

  expect(h.errors).toEqual([]);
});

test('otp-v0.7: the scrim paints over the table, under the card, and its dim shows', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  // shut: no dim, no hit area, still mounted (never display or visibility)
  const shut = await noteScrim(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { opacity: s.opacity, pe: s.pointerEvents, display: s.display, visibility: s.visibility };
  });
  expect(shut.opacity).toBe('0');
  expect(shut.pe).toBe('none');
  expect(shut.display).not.toBe('none');
  expect(shut.visibility).toBe('visible');

  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  // the 200ms fade SETTLES at 1: the dim itself is the alpha of the
  // background, so a stalled fade would leave the card looking unopened
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('rub-note-scrim')!).opacity === '1',
    null, { timeout: 5_000 },
  );
  const open = await page.evaluate(() => {
    const z = (sel: string) => getComputedStyle(document.querySelector(sel)!).zIndex;
    const s = getComputedStyle(document.getElementById('rub-note-scrim')!);
    return {
      wrap: z('.rub-wrap'), scrim: z('#rub-note-scrim'), pop: z('#rub-note-pop'),
      bg: s.backgroundColor, pe: s.pointerEvents, opacity: s.opacity,
    };
  });
  // above the table and every chip in it, below the card
  expect(Number(open.scrim)).toBeGreaterThan(Number(open.wrap));
  expect(Number(open.scrim)).toBeLessThan(Number(open.pop));
  expect(open.bg).toBe('rgba(20, 54, 66, 0.16)');
  expect(open.pe).toBe('auto');
  expect(open.opacity).toBe('1');
  // and that layering is what a tap sees, across the table: at every chip
  // outside the card's own rect the scrim is on top; inside it, the card is
  // (otp-v0.7.1: probed geometrically, since the compact chips moved the
  // card's anchor and a fixed list of chips could sit under the card)
  const probes = await page.evaluate(() => {
    const y0 = window.scrollY;
    const out = Array.from(document.querySelectorAll('.rub-chip')).map((el) => {
      // each chip scrolled into view first: elementsFromPoint sees only the
      // viewport, and the card (absolute in the section) scrolls with the page
      el.scrollIntoView({ block: 'center' });
      const card = document.getElementById('rub-note-pop')!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // the chip's horizontal centre (as pointOf does): the wrapper bleeds
      // past the section's padding by design, and the scrim covers the
      // section box, so a probe at the outer edge of the first or last
      // column would sample the bleed, not the layering
      const x = (r.left + r.right) / 2, y = r.top + 8;
      const inside = x >= card.left && x <= card.right && y >= card.top && y <= card.bottom;
      const top = document.elementsFromPoint(x, y)[0] as HTMLElement | undefined;
      const topId = !top ? 'nothing' : top.closest('#rub-note-pop') ? 'rub-note-pop' : (top.id || top.getAttribute('class') || top.tagName);
      return { key: (el as HTMLElement).dataset.level, n: (el as HTMLElement).dataset.n, inside, topId };
    });
    window.scrollTo(0, y0);
    return out;
  });
  const outside = probes.filter((q) => !q.inside);
  expect(outside.length).toBeGreaterThanOrEqual(20);
  for (const q of outside) expect(q.topId, `${q.key} ${q.n}`).toBe('rub-note-scrim');
  for (const q of probes.filter((r) => r.inside)) expect(q.topId, `${q.key} ${q.n}`).toBe('rub-note-pop');
  // the card itself stays fully interactive above it
  await noteText(page, 'good', 3).fill('typed while the dim is up');
  await expect(page.locator('#sp1_notes')).toHaveValue('{"Good 3":"typed while the dim is up"}');

  // closed: the dim goes, the element stays
  await page.locator('.rub-note-done').click();
  await expectPop(page, 'closed');
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('rub-note-scrim')!).opacity === '0',
    null, { timeout: 5_000 },
  );
  const after = await noteScrim(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { pe: s.pointerEvents, display: s.display, visibility: s.visibility };
  });
  expect(after.pe).toBe('none');
  expect(after.display).not.toBe('none');
  expect(after.visibility).toBe('visible');

  expect(h.errors).toEqual([]);
});

test('otp-v0.7: the open card lies inside the rubric section at every viewport', async ({ page }) => {
  const h = await harness(page);

  for (const size of VIEWPORTS) {
    await page.setViewportSize(size);
    await openForm(page);

    for (const [key, n] of [['beginner', 1], ['good', 4], ['great', 8], ['outstanding', 8]] as const) {
      await tapNoteBtn(page, key, n);
      await expectPop(page, 'open');
      const box = await page.evaluate(() => {
        const pop = document.getElementById('rub-note-pop')!.getBoundingClientRect();
        const sec = document.getElementById('rubric-section')!.getBoundingClientRect();
        return {
          left: pop.left - sec.left, right: sec.right - pop.right,
          top: pop.top - sec.top, bottom: sec.bottom - pop.bottom,
          width: pop.width, secWidth: sec.width,
        };
      });
      const at = `${size.width} ${key} ${n}`;
      expect(box.left, at).toBeGreaterThanOrEqual(-0.5);
      expect(box.right, at).toBeGreaterThanOrEqual(-0.5);
      expect(box.top, at).toBeGreaterThanOrEqual(-0.5);
      expect(box.bottom, at).toBeGreaterThanOrEqual(-0.5);
      // 380px, capped at 92% of the section
      expect(box.width, at).toBeLessThanOrEqual(Math.min(380, box.secWidth * 0.92) + 0.5);
      // and the card grew out of the button that opened it
      await expect(noteText(page, key, n)).toHaveCount(1);
      await page.locator('.rub-note-done').click();
      await expectPop(page, 'closed');
    }
  }

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: "+" never cycles the colour, and the chip never opens the panel', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const chip = chipAt(page, 'good', 2);
  await expect(chip).toHaveAttribute('data-state', '');
  for (let i = 0; i < 3; i++) {
    await tapNoteBtn(page, 'good', 2);
    await expect(chip).toHaveAttribute('data-state', '');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(page.locator('#sp1_good')).toHaveValue('');

  // and tapping the chip cycles the colour without opening the card
  await tapNoteBtn(page, 'good', 2);       // close the card first
  await expectPop(page, 'closed');
  await chip.click();
  await expect(chip).toHaveAttribute('data-state', 'present');
  await expectPop(page, 'closed');
  // otp-v0.7: a chip tap while the card IS open closes the card and leaves
  // that chip's colour exactly as it was
  await tapNoteBtn(page, 'good', 2);
  await expectPop(page, 'open');
  await tapChip(page, 'good', 2);
  await expect(chip).toHaveAttribute('data-state', 'present');
  await expectPop(page, 'closed');
  // and with the card shut the same chip cycles again
  await chip.click();
  await expect(chip).toHaveAttribute('data-state', 'partial');
  await expectPop(page, 'closed');

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: a typed note writes sp1_notes, sp1_selected_text and the badge', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const notes = page.locator('#sp1_notes');
  const txt = page.locator('#sp1_selected_text');
  await expect(notes).toHaveValue('');

  // a note on an UNCOLOURED chip reads "(Not assessed)" and still lands
  await tapNoteBtn(page, 'good', 3);
  await noteText(page, 'good', 3).fill('challenge is not provided');
  await expect(notes).toHaveValue('{"Good 3":"challenge is not provided"}');
  await expect(txt).toHaveValue(
    `Good 3 (Not assessed): ${criterion('good', 3)} Note: challenge is not provided`,
  );
  await expect(noteBtnAt(page, 'good', 3)).toHaveClass(/has-note/);
  await expect(noteBtnAt(page, 'good', 3)).toHaveAttribute(
    'aria-label',
    'Edit the note for Good 3',
  );

  // colouring the chip while the card is open updates the header and its dot
  // live. otp-v0.7: the scrim swallows a real tap on a chip (spec below), so
  // the cycle is driven straight on the row's own click handler here.
  await chipAt(page, 'good', 3).dispatchEvent('click');
  await expect(page.locator('#rub-note-head')).toHaveText('Good 3 · Present');
  await expect(page.locator('#rub-note-dot')).toHaveAttribute('data-state', 'present');
  await expect(txt).toHaveValue(
    `Good 3 (Present): ${criterion('good', 3)} Note: challenge is not provided`,
  );
  await chipAt(page, 'good', 3).dispatchEvent('click');
  await expect(page.locator('#rub-note-head')).toHaveText('Good 3 · Partially present');
  await expect(page.locator('#rub-note-dot')).toHaveAttribute('data-state', 'partial');

  // a second note, on a different level: keys stay in level order then ascending n
  await tapNoteBtn(page, 'great', 5);
  await noteText(page, 'great', 5).fill('students still on SC1');
  await expect(notes).toHaveValue(
    '{"Good 3":"challenge is not provided","Great 5":"students still on SC1"}',
  );
  await expect(txt).toHaveValue(
    `Good 3 (Partially present): ${criterion('good', 3)} Note: challenge is not provided` +
      ` | Great 5 (Not assessed): ${criterion('great', 5)} Note: students still on SC1`,
  );

  // a multi-line note is trimmed, keeps its newlines in sp1_notes, and collapses
  // its whitespace inside the one-line sp1_selected_text cell
  await noteText(page, 'great', 5).fill('  line one\nline two  ');
  expect(JSON.parse(await notes.inputValue())['Great 5']).toBe('line one\nline two');
  expect(await txt.inputValue()).toContain('Note: line one line two');

  // clearing the text removes the key and the badge
  await noteText(page, 'great', 5).fill('');
  await expect(notes).toHaveValue('{"Good 3":"challenge is not provided"}');
  await expect(noteBtnAt(page, 'great', 5)).not.toHaveClass(/has-note/);
  await expect(noteBtnAt(page, 'great', 5)).toHaveAttribute(
    'aria-label',
    'Add a note for Great 5',
  );
  // only one card is ever open, so come back to Good 3 before clearing it
  await tapNoteBtn(page, 'good', 3);
  await expect(page.locator('#rub-note-head')).toHaveText('Good 3 · Partially present');
  await noteText(page, 'good', 3).fill('');
  await expect(notes).toHaveValue('');
  await expect(txt).toHaveValue(
    `Good 3 (Partially present): ${criterion('good', 3)}`,
  );

  expect(h.errors).toEqual([]);
});

test('a chip cycles clear -> present -> partial -> absent -> clear', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const good = level('good');
  const beginner = level('beginner');
  const chip = chipAt(page, 'good', 2);
  const lvl = page.locator('#sp1_good');
  const txt = page.locator('#sp1_selected_text');
  const present = page.locator('#sp1_present');
  const partial = page.locator('#sp1_partially_present');
  const absent = page.locator('#sp1_not_present');
  const notSeen = page.locator('#sp1_not_seen');

  await expect(chip).toHaveAttribute('data-state', '');
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect(lvl).toHaveValue('');
  // otp-v0.6: nothing coloured yet, so every one of the 32 is "not assessed"
  expect(ALL_CRITERIA).toHaveLength(32);
  await expect(notSeen).toHaveValue(ALL_CRITERIA.join(', '));
  expect((await notSeen.inputValue()).split(', ')).toHaveLength(32);

  const cycle = [
    { state: 'present', word: 'present', cap: 'Present' },
    { state: 'partial', word: 'partially present', cap: 'Partially present' },
    { state: 'absent', word: 'not present', cap: 'Not present' },
  ];

  for (const step of cycle) {
    await chip.click();
    await expect(chip).toHaveAttribute('data-state', step.state);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(lvl).toHaveValue('2:' + step.word);
    await expect(txt).toHaveValue(`Good 2 (${step.cap}): ` + good.paragraphs[1]);
    await expect(present).toHaveValue(step.state === 'present' ? 'Good 2' : '');
    await expect(partial).toHaveValue(step.state === 'partial' ? 'Good 2' : '');
    await expect(absent).toHaveValue(step.state === 'absent' ? 'Good 2' : '');
    // whatever the colour, the coloured criterion drops out of "not assessed"
    await expect(notSeen).toHaveValue(notSeenWithout('Good 2'));
  }

  // fourth tap clears it
  await chip.click();
  await expect(chip).toHaveAttribute('data-state', '');
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect(lvl).toHaveValue('');
  await expect(txt).toHaveValue('');
  await expect(present).toHaveValue('');
  await expect(partial).toHaveValue('');
  await expect(absent).toHaveValue('');
  await expect(notSeen).toHaveValue(ALL_CRITERIA.join(', '));

  // a chip in another column keeps its own state alongside
  await chip.click(); // Good 2 -> present
  const other = chipAt(page, 'beginner', 1);
  await other.click();
  await other.click(); // Beginner 1 -> partially present
  await expect(chip).toHaveAttribute('data-state', 'present');
  await expect(other).toHaveAttribute('data-state', 'partial');
  await expect(lvl).toHaveValue('2:present');
  await expect(page.locator('#sp1_beginner')).toHaveValue('1:partially present');
  await expect(present).toHaveValue('Good 2');
  await expect(partial).toHaveValue('Beginner 1');
  await expect(absent).toHaveValue('');
  await expect(notSeen).toHaveValue(notSeenWithout('Beginner 1', 'Good 2'));
  await expect(txt).toHaveValue(
    'Beginner 1 (Partially present): ' +
      beginner.paragraphs[0] +
      ' | Good 2 (Present): ' +
      good.paragraphs[1]
  );

  expect(h.errors).toEqual([]);
});

test('chip states, a note and its badge survive a reload via the ais-otp-form-v1 draft', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const presentChip = chipAt(page, 'great', 4);
  const absentChip = chipAt(page, 'emerging', 2);
  await presentChip.click(); // one tap  -> present
  await absentChip.click();
  await absentChip.click();
  await absentChip.click(); // three taps -> not present
  await pickGrade(page, '9');   // otp-v0.5: derives school "Secondary"
  await page.fill('#observer_comments', 'Draft survives the reload');
  // otp-v0.6: a note on a chip that is NOT coloured, so the draft has to carry
  // the note in its own right
  await tapNoteBtn(page, 'outstanding', 6);
  await noteText(page, 'outstanding', 6).fill('group work ran out of time');
  await page.waitForTimeout(600); // debounced autosave is 220ms

  const key = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.indexOf('ais-otp-form-v1') > -1)
  );
  expect(key).toEqual([DRAFT_KEY]);
  const draft = JSON.parse(
    await page.evaluate((k) => localStorage.getItem(k)!, DRAFT_KEY),
  );
  expect(draft.rubric_version).toBe('sp1-v2');
  expect(draft.sp1_notes).toBe('{"Outstanding 6":"group work ran out of time"}');

  await page.reload();
  await passGate(page);

  await expect(page.locator('#observer_comments')).toHaveValue('Draft survives the reload');
  await expect(page.locator('#grade')).toHaveValue('9');
  await expect(gradeControl(page)).toContainText('9');
  await expect(page.locator('#school')).toHaveValue('Secondary');
  await expect(page.locator('#sp1_great')).toHaveValue('4:present');
  await expect(page.locator('#sp1_emerging')).toHaveValue('2:not present');
  await expect(page.locator('#sp1_present')).toHaveValue('Great 4');
  await expect(page.locator('#sp1_not_present')).toHaveValue('Emerging 2');
  await expect(page.locator('#sp1_partially_present')).toHaveValue('');
  await expect(page.locator('#sp1_not_seen')).toHaveValue(
    notSeenWithout('Emerging 2', 'Great 4'),
  );
  await expect(presentChip).toHaveAttribute('data-state', 'present');
  await expect(presentChip).toHaveAttribute('aria-pressed', 'true');
  await expect(absentChip).toHaveAttribute('data-state', 'absent');
  await expect(absentChip).toHaveAttribute('aria-pressed', 'true');

  // otp-v0.6: the note, its badge and the panel content all come back
  await expect(page.locator('#sp1_notes')).toHaveValue(
    '{"Outstanding 6":"group work ran out of time"}',
  );
  await expect(page.locator('#rubric_version')).toHaveValue('sp1-v2');
  await expect(noteBtnAt(page, 'outstanding', 6)).toHaveClass(/has-note/);
  await expect(noteBtnAt(page, 'good', 3)).not.toHaveClass(/has-note/);
  await tapNoteBtn(page, 'outstanding', 6);
  await expect(noteText(page, 'outstanding', 6)).toHaveValue('group work ran out of time');

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: a draft without rubric_version restores its header fields but no chips', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  // an otp-v0.5 draft: paragraph numbering, no rubric_version, no sp1_notes
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    [
      DRAFT_KEY,
      JSON.stringify({
        observer_comments: 'Carried over from otp-v0.5',
        room_number: '9A',
        support_teachers_cas: 'Ms Legacy CA',
        sp1_good: '4:present',
        sp1_great: '2:not present',
        sp1_present: 'Good 4',
        sp1_not_present: 'Great 2',
        sp1_selected_text: 'stale v1 selection',
        sp1_not_seen: 'stale v1 complement',
      }),
    ] as [string, string],
  );

  await page.reload();
  await passGate(page);

  // every non-rubric field still restores
  await expect(page.locator('#observer_comments')).toHaveValue('Carried over from otp-v0.5');
  await expect(page.locator('#room_number')).toHaveValue('9A');
  await expect(page.locator('#support_teachers_cas')).toHaveValue('Ms Legacy CA');

  // and every sp1_* value is dropped, so nothing lights the wrong criterion
  await expect(page.locator('#sp1_good')).toHaveValue('');
  await expect(page.locator('#sp1_great')).toHaveValue('');
  await expect(page.locator('#sp1_present')).toHaveValue('');
  await expect(page.locator('#sp1_not_present')).toHaveValue('');
  await expect(page.locator('#sp1_selected_text')).toHaveValue('');
  await expect(page.locator('#sp1_notes')).toHaveValue('');
  await expect(page.locator('#rubric_version')).toHaveValue('sp1-v2');
  await expect(page.locator('#sp1_not_seen')).toHaveValue(ALL_CRITERIA.join(', '));
  await expect(page.locator('.rub-chip[data-state="present"]')).toHaveCount(0);
  await expect(page.locator('.rub-chip[data-state="partial"]')).toHaveCount(0);
  await expect(page.locator('.rub-chip[data-state="absent"]')).toHaveCount(0);
  await expect(page.locator('.rub-note-btn.has-note')).toHaveCount(0);

  expect(h.errors).toEqual([]);
});

test('the CONTRACT key list is the contract §2 list verbatim, 32 keys', async () => {
  const fromDoc = contractKeysFromDoc();
  expect(fromDoc).toEqual(CONTRACT_KEYS);
  expect(fromDoc).toHaveLength(32);   // otp-v0.8: + time_out
  expect(fromDoc).toContain('sp1_notes');
  expect(fromDoc).toContain('rubric_version');
});

test('submit posts exactly the CONTRACT keys with form="otp" and rubric_version="sp1-v2"', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  await fillRequired(page);
  await page.fill('#room_number', '12B');
  await page.fill('#support_teachers_cas', 'Ms Support CA');
  await chipAt(page, 'outstanding', 1).click();
  // otp-v0.6: one note on the coloured criterion, one on an untouched one
  await tapNoteBtn(page, 'outstanding', 1);
  await noteText(page, 'outstanding', 1).fill('pathway chosen from the exit ticket');
  await tapNoteBtn(page, 'beginner', 2);
  await noteText(page, 'beginner', 2).fill('bottom table had nothing to do');
  await page.fill('#observer_comments', 'Comments');
  await page.fill('#other_observations', 'Other');
  await page.fill('#next_step_1', 'Step one');
  await page.fill('#next_step_2', 'Step two');
  await page.fill('#next_step_3', 'Step three');

  const submit = page.locator('#btn-submit');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });

  expect(h.posts).toHaveLength(1);
  const body = h.posts[0];
  expect(Object.keys(body).sort()).toEqual(CONTRACT_KEYS);
  expect(Object.keys(body)).toHaveLength(32);   // §2 list, counted not assumed (otp-v0.8: + time_out)
  expect(body.form).toBe('otp');
  expect(body.otp_ref).toBe('SP1');
  expect(body.otp_aspect).toBe('Facilitating better than expected progress');
  expect(body.teacher).toBe('Test Teacher');
  expect(body.inspector).toBe('Test Observer');
  expect(body.subject).toBe('Mathematics');
  expect(body.school).toBe('Primary');
  expect(body.grade).toBe('3');
  expect(body.sp1_outstanding).toBe('1:present');
  expect(body.sp1_beginner).toBe('');
  expect(body.sp1_present).toBe('Outstanding 1');
  expect(body.sp1_partially_present).toBe('');
  expect(body.sp1_not_present).toBe('');
  expect(body.sp1_not_seen).toBe(notSeenWithout('Outstanding 1'));
  expect(body.next_step_3).toBe('Step three');
  // otp-v0.6 value formats (contract §3)
  expect(body.rubric_version).toBe('sp1-v2');
  expect(body.sp1_notes).toBe(
    '{"Beginner 2":"bottom table had nothing to do","Outstanding 1":"pathway chosen from the exit ticket"}',
  );
  expect(JSON.parse(body.sp1_notes)).toEqual({
    'Beginner 2': 'bottom table had nothing to do',
    'Outstanding 1': 'pathway chosen from the exit ticket',
  });
  expect(body.sp1_selected_text).toBe(
    `Beginner 2 (Not assessed): ${criterion('beginner', 2)} Note: bottom table had nothing to do` +
      ` | Outstanding 1 (Present): ${criterion('outstanding', 1)} Note: pathway chosen from the exit ticket`,
  );
  // the four by-state lists still partition the 32 criteria
  const buckets = ['sp1_present', 'sp1_partially_present', 'sp1_not_present', 'sp1_not_seen']
    .flatMap((k) => String(body[k]).split(', ').filter(Boolean));
  expect(buckets.sort()).toEqual([...ALL_CRITERIA].sort());

  expect(h.errors).toEqual([]);
});

test('the record view repopulates header fields, chips, notes and the five sections', async ({ page }) => {
  const h = await harness(page);
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });

  await expect(page.locator('#date')).toHaveValue('2026-09-03');
  await expect(page.locator('#room_number')).toHaveValue('12B');
  await expect(page.locator('#time_in')).toHaveValue('09:15');
  await expect(page.locator('#time_out')).toHaveValue('10:05');   // otp-v0.8
  await expect(page.locator('#support_teachers_cas')).toHaveValue('Ms Support CA');
  await expect(page.locator('#curriculum')).toHaveValue('Australian');
  await expect(page.locator('#school')).toHaveValue('Primary');
  await expect(page.locator('#grade')).toHaveValue('3');
  await expect(gradeControl(page)).toContainText('3');
  await expect(page.locator('#teacher')).toHaveValue('t0');
  await expect(page.locator('#inspector')).toHaveValue('i0');
  await expect(page.locator('#subject')).toHaveValue('s0');
  await expect(page.locator('#teacher').locator('xpath=following-sibling::div[1]')).toContainText(
    'Test Teacher'
  );
  await expect(page.locator('#inspector').locator('xpath=following-sibling::div[1]')).toContainText(
    'Test Observer'
  );

  // otp-v0.6: rubric_version "sp1-v2", so the 32 v2 criteria render
  await expect(page.locator('.rub-chip')).toHaveCount(32);
  await expect(chipAt(page, 'good', 1)).toHaveAttribute('data-state', 'absent');
  await expect(chipAt(page, 'good', 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', 'partial');
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('aria-pressed', 'true');
  await expect(chipAt(page, 'good', 2)).toHaveAttribute('data-state', '');
  await expect(chipAt(page, 'good', 2)).toHaveAttribute('aria-pressed', 'false');
  // legacy otp-v0.1 bare number reads as "present"
  await expect(chipAt(page, 'great', 2)).toHaveAttribute('data-state', 'present');
  await expect(chipAt(page, 'great', 2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sp1_present')).toHaveValue('Great 2');
  await expect(page.locator('#sp1_partially_present')).toHaveValue('Good 3');
  await expect(page.locator('#sp1_not_present')).toHaveValue('Good 1');
  await expect(page.locator('#sp1_not_seen')).toHaveValue(RECORD_NOT_SEEN);
  await expect(page.locator('#rubric_version')).toHaveValue('sp1-v2');

  // otp-v0.6: the two recorded notes show as badges, and the panel is read-only
  await expect(page.locator('.rub-note-btn.has-note')).toHaveCount(2);
  await expect(noteBtnAt(page, 'good', 3)).toHaveClass(/has-note/);
  await expect(noteBtnAt(page, 'great', 5)).toHaveClass(/has-note/);
  await tapNoteBtn(page, 'great', 5);
  await expectPop(page, 'open');
  await expect(page.locator('#rub-note-head')).toHaveText('Great 5 · Not assessed');
  await expect(noteText(page, 'great', 5)).toHaveValue('students still on SC1');
  expect(
    await noteText(page, 'great', 5).evaluate((el) => (el as HTMLTextAreaElement).readOnly),
  ).toBe(true);
  await expect(notePop(page).locator('.pad-field-btn')).toBeHidden();
  // this criterion HAS a pad page, so its paperclip shows (slug sp1-great-5-note)
  await expect(
    notePop(page).locator('.pad-attach[data-pad-target="sp1_great_5_note"]'),
  ).toBeVisible();
  await page.locator('.rub-note-done').click();
  await expectPop(page, 'closed');
  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await expect(page.locator('#rub-note-head')).toHaveText('Good 3 · Partially present');
  await expect(page.locator('#rub-note-dot')).toHaveAttribute('data-state', 'partial');
  // Good 3 has no pad page, so its paperclip stays hidden
  await expect(
    notePop(page).locator('.pad-attach[data-pad-target="sp1_good_3_note"]'),
  ).toBeHidden();

  // hard rule 13: a record view never writes the shared draft
  await page.waitForTimeout(600);
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();

  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  await expect(page.locator('#other_observations')).toHaveValue('Record other observations');
  await expect(page.locator('#next_step_1')).toHaveValue('Record next step one');
  await expect(page.locator('#next_step_2')).toHaveValue('Record next step two');
  await expect(page.locator('#next_step_3')).toHaveValue('Record next step three');

  // hard rule 14: the ungated viewer must never carry the Supabase key
  expect(
    fs.readFileSync(path.join(__dirname, '..', 'otp-record.html'), 'utf8')
  ).not.toContain('sb_publishable');

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: a legacy record (no rubric_version) renders the 26 v1 paragraphs', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_LEGACY });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });

  const expected: string[] = [];
  for (const lvl of RUBRIC_V1.levels) expected.push(...lvl.paragraphs);
  expect(expected).toHaveLength(26);
  await expect(page.locator('.rub-chip')).toHaveCount(26);
  expect(await page.locator('.rub-chip').allTextContents()).toEqual(expected);
  await expect(page.locator('.rub-note-btn')).toHaveCount(26);
  // one caption row and one legend row, not two of each
  await expect(page.locator('tr.rub-caption')).toHaveCount(1);
  await expect(page.locator('#rubric-legend')).toHaveCount(1);

  // the v1 selection lights the v1 paragraphs
  await expect(chipAt(page, 'good', 1)).toHaveAttribute('data-state', 'absent');
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', 'partial');
  await expect(chipAt(page, 'great', 2)).toHaveAttribute('data-state', 'present');
  await expect(page.locator('#sp1_not_seen')).toHaveValue(RECORD_NOT_SEEN_V1);
  await expect(page.locator('#rubric_version')).toHaveValue('');
  // legacy records carry no criterion notes
  await expect(page.locator('#sp1_notes')).toHaveValue('');
  await expect(page.locator('.rub-note-btn.has-note')).toHaveCount(0);

  expect(h.errors).toEqual([]);
});

test('the removed R3 fields are absent from the DOM', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  for (const id of [
    'evidence_type',
    'focus_context',
    'j_attainment',
    'summary_strengths',
    'summary_weakness',
    'grade_class',
    'num_sen',
  ]) {
    await expect(page.locator('#' + id), `#${id} should be gone`).toHaveCount(0);
    await expect(page.locator(`[name="${id}"]`), `[name=${id}] should be gone`).toHaveCount(0);
  }

  // the five pad targets replaced the four R3 ones (the 32 criterion-note
  // launchers live inside a note panel, which is closed here)
  await expect(page.locator('.pad-field-btn[data-pad-target]')).toHaveCount(5);
  expect(
    await page.locator('.pad-field-btn[data-pad-target]').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.padTarget)
    )
  ).toEqual([
    'observer_comments',
    'other_observations',
    'next_step_1',
    'next_step_2',
    'next_step_3',
  ]);

  // the page body never scrolls horizontally, the rubric scrolls in its wrapper
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(overflow).toBeTruthy();

  expect(h.errors).toEqual([]);
});

test('rubric layout v2: caption row above the levels, five even columns, edge-to-edge, chips 2px smaller', async ({ page }) => {
  await harness(page);
  await openForm(page);
  const table = page.locator('.rub-table');
  await expect(table.locator('thead tr').first()).toHaveClass(/rub-caption/);
  await expect(table.locator('tr.rub-caption th')).toHaveAttribute('colspan', '5');
  await expect(table.locator('tr.rub-caption')).toContainText('Facilitating better than expected progress');
  await expect(page.locator('.rub-aspect')).toHaveCount(0);
  await expect(page.locator('#rubric-head th')).toHaveCount(5);
  const widths = await page.locator('#rubric-head th').evaluateAll(ths => ths.map(t => t.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  const wrap = await page.locator('.rub-wrap').boundingBox();
  const title = await page.locator('.rub-wrap').locator('xpath=preceding-sibling::h2[1]').boundingBox();
  expect(wrap!.width).toBeGreaterThan(title!.width + 20);
  const px = await page.evaluate(() => {
    const probe = document.createElement('span'); probe.style.fontSize = 'var(--tiny)'; document.body.appendChild(probe);
    const tiny = parseFloat(getComputedStyle(probe).fontSize); probe.remove();
    return { tiny, chip: parseFloat(getComputedStyle(document.querySelector('.rub-chip')!).fontSize) };
  });
  expect(Math.abs(px.tiny - 2 - px.chip)).toBeLessThan(0.1);
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth)).toBe(0);
});

test('otp-v0.7.1: the three recorded states paint calm tints, no coloured edge, normal 1px border', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);
  // pin the light palette: the runner's prefers-color-scheme must not decide it
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  const targets = [
    { state: 'present', sel: '.rub-chip[data-level="good"][data-n="1"]', taps: 1, tint: 'rgb(232, 243, 236)', edge: 'rgb(47, 125, 79)' },
    { state: 'partial', sel: '.rub-chip[data-level="good"][data-n="2"]', taps: 2, tint: 'rgb(251, 243, 220)', edge: 'rgb(194, 142, 14)' },
    { state: 'absent', sel: '.rub-chip[data-level="good"][data-n="3"]', taps: 3, tint: 'rgb(251, 233, 234)', edge: 'rgb(178, 59, 59)' },
  ];
  for (const t of targets) {
    for (let i = 0; i < t.taps; i++) await page.locator(t.sel).click();
  }
  await page.mouse.move(0, 0); // no chip left under the pointer
  await page.waitForTimeout(400); // the 0.16s colour transition has settled

  const plain = await page
    .locator('.rub-chip[data-level="good"][data-n="6"]')
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, border: s.borderTopColor, width: s.borderLeftWidth, color: s.color };
    });
  // the untouched chip is unchanged: same 1px edge all round
  expect(plain.width).toBe('1px');

  for (const t of targets) {
    const css = await page.locator(t.sel).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        left: s.borderLeftColor, leftWidth: s.borderLeftWidth,
        top: s.borderTopColor, right: s.borderRightColor, bottom: s.borderBottomColor,
        color: s.color,
      };
    });
    expect(css.bg, t.sel).toBe(t.tint);
    // otp-v0.7.1: no coloured left edge, the border is the chip's usual 1px
    // rule on all four sides
    expect(css.left, t.sel).toBe(plain.border);
    expect(css.left, t.sel).not.toBe(t.edge);
    expect(css.leftWidth, t.sel).toBe('1px');
    expect(css.top, t.sel).toBe(plain.border);
    expect(css.right, t.sel).toBe(plain.border);
    expect(css.bottom, t.sel).toBe(plain.border);
    // and the ink stays the chip's normal ink, never white
    expect(css.color, t.sel).toBe(plain.color);
    expect(css.color, t.sel).not.toBe('rgb(255, 255, 255)');

    // hover keeps the same tint, no darkening jump
    await page.locator(t.sel).hover();
    await page.waitForTimeout(250);
    expect(
      await page.locator(t.sel).evaluate((el) => getComputedStyle(el).backgroundColor),
      t.sel + ' hover',
    ).toBe(t.tint);
    await page.mouse.move(0, 0);

    // the legend swatch carries the same tint and its normal 1px border
    const sw = await page
      .locator(`.rub-legend-sw[data-state="${t.state}"]`)
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, left: s.borderLeftColor, top: s.borderTopColor, leftWidth: s.borderLeftWidth, w: s.width };
      });
    expect(sw.bg, t.state).toBe(t.tint);
    expect(sw.left, t.state).toBe(sw.top);
    expect(sw.left, t.state).not.toBe(t.edge);
    expect(sw.leftWidth, t.state).toBe('1px');
    expect(parseFloat(sw.w), t.state).toBeGreaterThanOrEqual(8);
  }

  // the dark theme keeps the same hues as translucent tints, no edge either
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(400);
  const dark = await page.locator(targets[0].sel).evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, left: s.borderLeftColor, top: s.borderTopColor, leftWidth: s.borderLeftWidth, color: s.color };
  });
  expect(dark.bg).toBe('rgba(47, 125, 79, 0.24)');
  expect(dark.left).toBe(dark.top);
  expect(dark.leftWidth).toBe('1px');
  expect(dark.color).toBe('rgb(242, 239, 230)');
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  // otp-v0.7: a filled note badge is solid AIS navy with white bars, and the
  // dark theme mirrors it on the dark ink
  await tapNoteBtn(page, 'good', 1);
  await expectPop(page, 'open');
  await noteText(page, 'good', 1).fill('badge paint');
  const badge = noteBtnAt(page, 'good', 1);
  const paint = [
    { theme: 'light', bg: 'rgb(20, 54, 66)', bars: 'rgb(255, 255, 255)' },
    { theme: 'dark', bg: 'rgb(242, 239, 230)', bars: 'rgb(10, 13, 31)' },
  ];
  for (const p of paint) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), p.theme);
    await page.mouse.move(0, 0);      // no hover state on the badge
    await page.waitForTimeout(400);   // the 0.15s colour transition has settled
    const css = await badge.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, border: s.borderTopColor, color: s.color };
    });
    expect(css.bg, p.theme).toBe(p.bg);
    expect(css.border, p.theme).toBe(p.bg);
    // the bars are drawn from currentColor
    expect(css.color, p.theme).toBe(p.bars);
    // no electric blue anywhere on the badge
    expect(css.bg, p.theme).not.toBe('rgb(18, 87, 255)');
  }
  // and an empty badge is a hairline outline, never a fill
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.waitForTimeout(300);
  const empty = await noteBtnAt(page, 'good', 5).evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, border: s.borderTopColor, color: s.color, width: s.borderTopWidth };
  });
  expect(empty.bg).toBe('rgba(0, 0, 0, 0)');
  expect(empty.border).toBe('rgba(20, 54, 66, 0.28)');
  expect(empty.color).toBe('rgba(20, 54, 66, 0.55)');
  expect(empty.width).toBe('1px');

  expect(h.errors).toEqual([]);
});

test('otp-v0.7: the card materialises and settles on transform and opacity only', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const closed = await notePop(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      prop: s.transitionProperty, dur: s.transitionDuration, ease: s.transitionTimingFunction,
      transform: s.transform, opacity: s.opacity,
    };
  });
  // exit: 200ms, the mirrored easing
  expect(closed.prop).toBe('transform, opacity');
  expect(closed.dur).toBe('0.2s, 0.2s');
  expect(closed.ease).toBe('cubic-bezier(0.64, 0, 0.78, 0), linear');
  expect(closed.opacity).toBe('0');
  expect(closed.transform).not.toBe('none');

  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  // the enter transition is 280ms, so the computed values are mid-flight the
  // instant data-state flips; wait for it to SETTLE, which also proves the
  // card actually arrives at full opacity and the identity transform rather
  // than stalling part way (the freeze class of bug the iPad law guards).
  await page.waitForFunction(() => {
    const s = getComputedStyle(document.getElementById('rub-note-pop')!);
    return s.opacity === '1' && s.transform === 'matrix(1, 0, 0, 1, 0, 0)';
  }, null, { timeout: 5_000 });
  const open = await notePop(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      prop: s.transitionProperty, dur: s.transitionDuration, ease: s.transitionTimingFunction,
      origin: (el as HTMLElement).style.transformOrigin, opacity: s.opacity,
      transform: s.transform,
    };
  });
  // enter: 280ms transform, 200ms opacity, no overshoot in the curve
  expect(open.prop).toBe('transform, opacity');
  expect(open.dur).toBe('0.28s, 0.2s');
  expect(open.ease).toBe('cubic-bezier(0.22, 1, 0.36, 1), linear');
  expect(open.opacity).toBe('1');
  expect(open.transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
  // transform-origin is set from the "+" button that opened it
  expect(open.origin).toMatch(/^-?[\d.]+px -?[\d.]+px$/);
  // the scrim fades on opacity alone
  const scrim = await noteScrim(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { prop: s.transitionProperty, dur: s.transitionDuration, bg: s.backgroundColor };
  });
  expect(scrim.prop).toBe('opacity');
  expect(scrim.dur).toBe('0.2s');
  expect(scrim.bg).toBe('rgba(20, 54, 66, 0.16)');

  // reduced motion drops the scale and translate, keeping the fade
  const css = viewerSrc();
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  expect(block.slice(0, 400)).toContain('.rub-note-pop');
  expect(block.slice(0, 400)).toContain('transform: none');
  expect(block.slice(0, 400)).toContain('opacity 150ms linear');
  // the press feedback and the badge pop, per the contract
  expect(css).toContain('.rub-note-btn:active { transform: scale(0.97); }');
  expect(css).toContain('@keyframes rub-badge-pop');
  expect(css).toContain('animation: rub-badge-pop 220ms ease-out');

  expect(h.errors).toEqual([]);
});

test('otp-v0.7: the badge pops on user input only, never on a draft restore', async ({ page }) => {
  const h = await harness(page);
  /* Record every badge pop from the FIRST paint of the decrypted page, load
     and draft restore included. It has to be a MutationObserver: StatiCrypt
     renders the form with document.write, which implies document.open() and so
     strips every event listener registered on the document AND the window
     (measured), while a MutationObserver registered on the document node
     survives it. The observer is edge-triggered per button, because
     popNoteBadge removes the class and re-adds it to restart the keyframe. */
  await page.addInitScript(() => {
    (window as any).__pops = [];
    const popping = new Set<Element>();
    new MutationObserver((recs) => {
      recs.forEach((r) => {
        const el = r.target as HTMLElement;
        if (!el.classList || !el.classList.contains('rub-note-btn')) return;
        if (!el.classList.contains('badge-pop')) { popping.delete(el); return; }
        if (popping.has(el)) return;
        popping.add(el);
        (window as any).__pops.push(el.getAttribute('aria-label'));
      });
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await openForm(page);
  // and the keyframe itself, watched live now that the written document exists
  await page.evaluate(() => {
    (window as any).__anims = [];
    document.addEventListener('animationstart', (e) => {
      const t = e.target as HTMLElement;
      if (t && t.classList && t.classList.contains('rub-note-btn')) {
        (window as any).__anims.push((e as AnimationEvent).animationName);
      }
    }, true);
  });

  expect(await page.evaluate(() => (window as any).__pops)).toEqual([]);

  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await noteText(page, 'good', 3).fill('the badge pops on this');
  await expect(noteBtnAt(page, 'good', 3)).toHaveClass(/has-note/);
  expect(await page.evaluate(() => (window as any).__pops)).toEqual([
    'Edit the note for Good 3',
  ]);
  // the 220ms keyframe really ran on that button, once
  await expect
    .poll(() => page.evaluate(() => (window as any).__anims), { timeout: 5_000 })
    .toEqual(['rub-badge-pop']);
  // a second keystroke on an already-filled note does not pop again
  await noteText(page, 'good', 3).pressSequentially(' once');
  await expect(noteText(page, 'good', 3)).toHaveValue('the badge pops on this once');
  await page.waitForTimeout(400);   // longer than the 220ms keyframe
  expect(await page.evaluate(() => (window as any).__pops)).toHaveLength(1);
  expect(await page.evaluate(() => (window as any).__anims)).toEqual(['rub-badge-pop']);
  await page.waitForTimeout(600);   // the debounced autosave has run

  // the draft restore sets .has-note silently
  await page.reload();
  await passGate(page);
  await expect(page.locator('#sp1_notes')).toHaveValue(
    '{"Good 3":"the badge pops on this once"}',
  );
  await expect(noteBtnAt(page, 'good', 3)).toHaveClass(/has-note/);
  expect(await page.evaluate(() => (window as any).__pops)).toEqual([]);
  await page.evaluate((k) => localStorage.removeItem(k), DRAFT_KEY);

  expect(h.errors).toEqual([]);
});

test('the colour legend is a permanent strip under the level headers; the Info button is gone', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const legend = page.locator('#rubric-legend');

  // visible on load, no toggle to click
  await expect(legend).toBeVisible();
  // otp-v0.6 wording (contract §4)
  expect(await legend.locator('.rub-legend-item').allTextContents()).toEqual([
    'Not Applicable to this lesson',
    'Green: present in lesson',
    'Yellow: partially present in lesson',
    'Red: expected but not present in lesson',
  ]);
  // otp-v0.5: the "no colour" swatch is the untouched chip, not a fourth colour
  const swatches = legend.locator('.rub-legend-sw');
  expect(await swatches.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.state)))
    .toEqual(['', 'present', 'partial', 'absent']);
  const paint = await page.evaluate(() => ({
    swatch: getComputedStyle(document.querySelector('.rub-legend-sw[data-state=""]')!).backgroundColor,
    swatchBorder: getComputedStyle(document.querySelector('.rub-legend-sw[data-state=""]')!).borderTopColor,
    chip: getComputedStyle(document.querySelector('.rub-chip[data-state=""]')!).backgroundColor,
    chipBorder: getComputedStyle(document.querySelector('.rub-chip[data-state=""]')!).borderTopColor,
  }));
  expect(paint.swatch).toBe(paint.chip);
  expect(paint.swatchBorder).toBe(paint.chipBorder);
  // the tap hint is unchanged
  await expect(legend.locator('.rub-legend-hint')).toHaveText(
    'Tap a criterion to mark it green; tap again for yellow, again for red; a fourth tap clears it.'
  );

  // last row of thead: immediately after #rubric-head, before the first tbody row
  const rowOrder = await page.evaluate(() => {
    const table = document.querySelector('.rub-table')!;
    const theadIds = Array.from(table.querySelector('thead')!.children).map(
      (tr) => tr.id || tr.className
    );
    const legendEl = document.getElementById('rubric-legend')!;
    return {
      theadIds,
      legendParentTag: legendEl.parentElement!.tagName,
      legendIsLastInThead: legendEl.nextElementSibling === null,
      firstTbodyRowId: table.querySelector('tbody')!.firstElementChild!.id,
    };
  });
  expect(rowOrder.theadIds).toEqual(['rub-caption', 'rubric-head', 'rubric-legend']);
  expect(rowOrder.legendParentTag).toBe('THEAD');
  expect(rowOrder.legendIsLastInThead).toBe(true);
  expect(rowOrder.firstTbodyRowId).toBe('rubric-row');

  // otp-v0.4: caption centred; the four colour items spread evenly and
  // centred; the tap hint on its own centred line below them, as a quiet pill
  const geo = await page.evaluate(() => {
    const capTh = document.querySelector('tr.rub-caption th')!;
    const capK = capTh.querySelector('.rub-cap-k')!.getBoundingClientRect();
    const capV = capTh.querySelector('.rub-cap-v')!.getBoundingClientRect();
    const capRect = capTh.getBoundingClientRect();
    const row = document.querySelector('.rub-legend-row')!;
    const rowRect = row.getBoundingClientRect();
    const items = Array.from(row.querySelectorAll('.rub-legend-item')).map((el) =>
      el.getBoundingClientRect()
    );
    const hintEl = row.querySelector('.rub-legend-hint')!;
    const hint = hintEl.getBoundingClientRect();
    const hintCs = getComputedStyle(hintEl);
    return {
      capAlign: getComputedStyle(capTh).textAlign,
      capCentreDelta: Math.abs((capK.left + capV.right) / 2 - (capRect.left + capRect.right) / 2),
      justify: getComputedStyle(row).justifyContent,
      itemsOnOneLine: Math.max(...items.map((r) => r.top)) - Math.min(...items.map((r) => r.top)) < 2,
      spreadDelta: Math.abs(items[0].left - rowRect.left - (rowRect.right - items[items.length - 1].right)),
      itemCount: items.length,
      hintBelowItems: hint.top >= Math.max(...items.map((r) => r.bottom)),
      // otp-v0.5: nothing shares the hint's line, whether the items wrapped or not
      hintAloneOnLastLine: items.every((r) => r.bottom <= hint.top + 1),
      hintCentreDelta: Math.abs((hint.left + hint.right) / 2 - (rowRect.left + rowRect.right) / 2),
      hintIsPill: hint.width < rowRect.width * 0.9 && parseFloat(hintCs.borderRadius) > 20,
      hintBg: hintCs.backgroundColor,
      hintWeight: hintCs.fontWeight,
    };
  });
  expect(geo.capAlign).toBe('center');
  expect(geo.capCentreDelta).toBeLessThan(2);
  expect(geo.justify).toBe('space-evenly');
  expect(geo.itemCount).toBe(4);
  expect(geo.itemsOnOneLine).toBe(true);   // at this desktop width; iPad portrait may wrap
  expect(geo.spreadDelta).toBeLessThan(2);
  expect(geo.hintBelowItems).toBe(true);
  expect(geo.hintAloneOnLastLine).toBe(true);
  expect(geo.hintCentreDelta).toBeLessThan(2);
  expect(geo.hintIsPill).toBe(true);
  expect(geo.hintBg).not.toBe('rgba(0, 0, 0, 0)');
  expect(geo.hintWeight).toBe('600');

  // no Info button, no wrapper div, anywhere in the rubric
  await expect(page.locator('.rub-info')).toHaveCount(0);
  await expect(page.locator('.rub-cap')).toHaveCount(0);

  // the Agenda button now opens the OTP Sheet, not the inherited R3 agenda Doc
  await expect(page.locator('a.float-link.agenda')).toHaveAttribute(
    'href',
    'https://docs.google.com/spreadsheets/d/1CL6zQqxtoXx0MPxjViyiAbwOTPujDkmWCmLD4tJXgcU/edit?gid=0#gid=0'
  );

  // and the same permanent legend shows on a locked record view
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await expect(page.locator('#rubric-legend')).toBeVisible();
  await expect(page.locator('#rubric-legend')).toContainText('Yellow: partially present in lesson');
  await expect(page.locator('.rub-info')).toHaveCount(0);

  expect(h.errors).toEqual([]);
});

test('otp-v0.5: Grade replaces School and derives it, Kindy through Secondary', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  // the School pill group is gone; the hidden input that carries it stays
  await expect(page.locator('#school-pills')).toHaveCount(0);
  await expect(page.locator('#school')).toHaveAttribute('type', 'hidden');
  // (Tom Select rewrites label[for] to its own control input, so match by cell)
  const gradeCell = page.locator('.info-cell', { has: page.locator('#grade') });
  await expect(gradeCell.locator('label')).toHaveText('Grade');
  await expect(gradeCell.locator('label')).toHaveClass(/required-field/);

  // 15 options, Pre-Kindy / Kindy / Prep first, then 1..12
  await gradeControl(page).click();
  expect(await page.locator('.ts-dropdown.number-picker .option').allTextContents()).toEqual([
    'Pre-Kindy', 'Kindy', 'Prep',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
  ]);
  // consume the open dropdown with the first pick rather than closing it
  await page.locator('.ts-dropdown.number-picker .option').filter({ hasText: /^Pre-Kindy$/ }).click();
  await expect(page.locator('#grade')).toHaveValue('Pre-Kindy');
  await expect(page.locator('#school')).toHaveValue('Kindy');

  for (const [grade, school] of [
    ['Kindy', 'Kindy'],
    ['Prep', 'Primary'],
    ['6', 'Primary'],
    ['7', 'Secondary'],
    ['12', 'Secondary'],
  ] as const) {
    await pickGrade(page, grade);
    await expect(page.locator('#grade'), grade).toHaveValue(grade);
    await expect(page.locator('#school'), grade).toHaveValue(school);
  }

  // Secondary is showing, so Subject is enabled and filtered
  const subjectInput = page.locator('#subject').locator('xpath=following-sibling::div[1]').locator('input');
  await expect(page.locator('#subject')).toBeEnabled();
  await pickTomSelect(page, 'subject', 'Science');

  // clearing Grade clears School and puts Subject back to its resting state
  await gradeControl(page).locator('.clear-button').click();
  await expect(page.locator('#grade')).toHaveValue('');
  await expect(page.locator('#school')).toHaveValue('');
  await expect(page.locator('#subject')).toBeDisabled();
  await expect(subjectInput).toHaveAttribute('placeholder', 'Select Grade first');
  await expect(page.locator('#btn-submit')).toBeDisabled();
  await expect(page.locator('#btn-submit')).toHaveAttribute(
    'title',
    'Fill Teacher / Time In / Observer / Curriculum / Grade / Date / Subject / Time Out to enable saving',
  );

  expect(h.errors).toEqual([]);
});

test('otp-v0.5: the empty Grade control paints a placeholder and hides its clear button', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);
  const wrapper = page.locator('#grade').locator('xpath=following-sibling::div[1]');
  const placeholder = () => page.evaluate(() => {
    const ctl = document.querySelector('#grade')!.nextElementSibling!.querySelector('.ts-control')!;
    return getComputedStyle(ctl, '::before').content;
  });
  expect(await placeholder()).toBe('"Tap to pick a grade"');
  await expect(wrapper.locator('.clear-button')).toBeHidden();
  await pickGrade(page, '7');
  expect(await placeholder()).toBe('none');
  await expect(wrapper.locator('.clear-button')).toBeVisible();
  await expect(page.locator('#school')).toHaveValue('Secondary');
  await wrapper.locator('.clear-button').click();
  expect(await placeholder()).toBe('"Tap to pick a grade"');
  await expect(wrapper.locator('.clear-button')).toBeHidden();
  await expect(page.locator('#school')).toHaveValue('');
  expect(h.errors).toEqual([]);
});

test('otp-v0.7: no console errors and no horizontal overflow at 1280, 1180x820 and 820x1180', async ({ page }) => {
  const h = await harness(page);

  for (const size of VIEWPORTS) {
    await page.setViewportSize(size);
    await openForm(page);

    // exercise the whole note surface at this size
    await chipAt(page, 'good', 3).click();
    await tapNoteBtn(page, 'good', 3);
    await expectPop(page, 'open');
    await noteText(page, 'good', 3).fill('note typed at ' + size.width);
    await expect(noteBtnAt(page, 'good', 3)).toHaveClass(/has-note/);
    await tapNoteBtn(page, 'outstanding', 8);
    await expectPop(page, 'open');

    const box = await page.evaluate(() => ({
      bodyScroll: document.body.scrollWidth,
      bodyClient: document.body.clientWidth,
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
    }));
    expect(box.bodyScroll, `body at ${size.width}`).toBe(box.bodyClient);
    expect(box.docScroll, `doc at ${size.width}`).toBeLessThanOrEqual(box.docClient);

    // the card is absolute inside the rubric section, never a fixed overlay
    expect(
      await notePop(page).evaluate((el) => getComputedStyle(el).position),
    ).toBe('absolute');

    await expect(page.locator('.form-footer')).toContainText(/otp-v0\.9/i);
    await page.evaluate((k) => localStorage.removeItem(k), DRAFT_KEY);
  }

  expect(h.errors).toEqual([]);
});

test('otp-v0.7: the rubric wrapper never scrolls, at any of the three viewports', async ({ page }) => {
  const h = await harness(page);

  for (const size of VIEWPORTS) {
    await page.setViewportSize(size);
    await openForm(page);

    const m = await page.evaluate(() => {
      const w = document.querySelector('.rub-wrap') as HTMLElement;
      const computed = getComputedStyle(w);
      const before = { x: computed.overflowX, y: computed.overflowY };
      // force a scrollport: with the cause of the v0.6 overflow gone, the
      // scrollable overflow still equals the client box exactly
      const prev = w.style.overflow;
      w.style.overflow = 'auto';
      const out = {
        before,
        sw: w.scrollWidth, cw: w.clientWidth,
        sh: w.scrollHeight, ch: w.clientHeight,
      };
      w.style.overflow = prev;
      return out;
    });
    const at = String(size.width);
    expect(m.before.x, at).toBe('visible');
    expect(m.before.y, at).toBe('visible');
    expect(m.sw, at).toBe(m.cw);
    expect(m.sh, at).toBe(m.ch);
  }

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: the pad writes a criterion note, and its extract call carries the criterion as context', async ({ page }) => {
  const h = await harness(page, { extract: 'only two of the six groups were stretched' });
  await openForm(page);

  // the pencil inside the note panel opens the pad on THAT criterion's page
  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await notePop(page).locator('.pad-field-btn[data-pad-target="sp1_good_3_note"]').click();
  await expect(page.locator('#pad-modal')).toHaveClass(/open/, { timeout: 10_000 });
  await expect(page.locator('#pad-pageind')).toContainText('Note · Good 3');

  // draw one stroke, then Done
  const stage = await page.locator('#pad-stage').boundingBox();
  await page.mouse.move(stage!.x + 60, stage!.y + 60);
  await page.mouse.down();
  await page.mouse.move(stage!.x + 160, stage!.y + 110, { steps: 8 });
  await page.mouse.up();
  await page.locator('#pad-done').click();
  await expect(page.locator('#pad-modal')).not.toHaveClass(/open/);

  // the transcription lands in that criterion's note, not in any of the five fields
  await expect(page.locator('#sp1_notes')).toHaveValue(
    '{"Good 3":"only two of the six groups were stretched"}',
    { timeout: 15_000 },
  );
  await expect(noteBtnAt(page, 'good', 3)).toHaveClass(/has-note/);
  expect(await page.locator('#sp1_selected_text').inputValue()).toContain(
    'Note: only two of the six groups were stretched',
  );
  await expect(page.locator('#observer_comments')).toHaveValue('');

  // the request named the target and carried the criterion text as context
  const extract = h.posts.filter((p) => p.action === 'extract_pad');
  expect(extract).toHaveLength(1);
  expect(extract[0].target).toBe('sp1_good_3_note');
  expect(extract[0].context).toBe(criterion('good', 3));
  expect(String(extract[0].context).length).toBeLessThanOrEqual(400);

  // and the open panel shows it
  await expect(noteText(page, 'good', 3)).toHaveValue(
    'only two of the six groups were stretched',
  );

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: the notes print as a Criterion notes list under the rubric table', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const printBox = page.locator('#rub-print-notes');
  expect(await printBox.evaluate((el) => getComputedStyle(el).display)).toBe('none');
  await expect(printBox).toBeEmpty();

  await chipAt(page, 'good', 3).click();     // present
  await tapNoteBtn(page, 'good', 3);
  await noteText(page, 'good', 3).fill('only one group was stretched');
  await tapNoteBtn(page, 'beginner', 2);
  await noteText(page, 'beginner', 2).fill('bottom table idle for ten minutes');

  await page.emulateMedia({ media: 'print' });
  await expect(printBox).toBeVisible();
  await expect(printBox.locator('.rub-print-head')).toHaveText('Criterion notes');
  expect(await printBox.locator('.rub-print-item').allTextContents()).toEqual([
    'Beginner 2 (Not assessed): bottom table idle for ten minutes',
    'Good 3 (Present): only one group was stretched',
  ]);
  // the open card and the empty "+" affordances do not print; a filled one
  // does. The card is faded out, never display-toggled (the iPad law).
  await expect(notePop(page)).toHaveCSS('opacity', '0');   // retries: WebKit is still fading
  expect(await notePop(page).evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
  expect(
    await noteBtnAt(page, 'good', 1).evaluate((el) => getComputedStyle(el).display),
  ).toBe('none');
  await page.waitForTimeout(400);   // the 0.15s badge colour transition has settled
  expect(
    await noteBtnAt(page, 'good', 3).evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgb(20, 54, 66)');
  // otp-v0.7: on paper the filled badge is a marker, so it prints as a SOLID
  // dot: the plus (an SVG since otp-v0.7.1) comes off, the navy circle stays
  expect(
    await noteBtnAt(page, 'good', 3).evaluate(
      (el) => getComputedStyle(el.querySelector('svg') as SVGElement).display,
    ),
  ).toBe('none');
  // the calm tints print as they paint; otp-v0.7.1: no coloured edge
  expect(
    await chipAt(page, 'good', 3).evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgb(232, 243, 236)');
  expect(
    await chipAt(page, 'good', 3).evaluate((el) => getComputedStyle(el).borderLeftWidth),
  ).toBe('1px');
  await page.emulateMedia({ media: 'screen' });

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: Reset clears the notes and keeps rubric_version stamped', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  await chipAt(page, 'great', 1).click();
  await tapNoteBtn(page, 'great', 1);
  await noteText(page, 'great', 1).fill('to be wiped');
  await page.fill('#observer_comments', 'to be wiped too');
  await expect(page.locator('#sp1_notes')).toHaveValue('{"Great 1":"to be wiped"}');

  await page.locator('#btn-reset').click();

  await expect(page.locator('#observer_comments')).toHaveValue('');
  await expect(page.locator('#sp1_notes')).toHaveValue('');
  await expect(page.locator('#sp1_selected_text')).toHaveValue('');
  await expect(page.locator('#sp1_great')).toHaveValue('');
  await expect(page.locator('#sp1_not_seen')).toHaveValue(ALL_CRITERIA.join(', '));
  // the reset loop blanks every named input, so the stamp has to be re-applied
  await expect(page.locator('#rubric_version')).toHaveValue('sp1-v2');
  await expect(page.locator('.rub-note-btn.has-note')).toHaveCount(0);
  await expectPop(page, 'closed');
  await expect(page.locator('#rub-print-notes')).toBeEmpty();

  expect(h.errors).toEqual([]);
});

test('otp-v0.8: Time Out sits at the bottom and gates Save & Lock like the other required fields', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  // structure: inside the last Next Steps section, beside Support 3, above the action bar
  const place = await page.evaluate(() => {
    const t = document.getElementById('time_out') as HTMLInputElement;
    const ns3 = document.getElementById('next_step_3')!;
    const bar = document.querySelector('.action-bar')!;
    const label = document.querySelector('label[for="time_out"]')!;
    return {
      type: t.type, name: t.name, required: t.required,
      afterNs3: !!(ns3.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeBar: !!(t.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING),
      sameSection: t.closest('.form-section') === ns3.closest('.form-section'),
      layout: !!t.closest('.summary-with-timeout'),
      label: label.textContent!.trim(), labelRequired: label.classList.contains('required-field'),
      timeInStillTop: document.getElementById('time_in')!.closest('.info-grid') !== null,
    };
  });
  expect(place).toEqual({
    type: 'time', name: 'time_out', required: true,
    afterNs3: true, beforeBar: true, sameSection: true, layout: true,
    label: 'Time Out', labelRequired: true, timeInStillTop: true,
  });

  // otp-v0.9.3 (C5): below Support 3 and right-aligned to it, at every width
  for (const vp of [{ width: 1280, height: 800 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(vp);
    const geo = await page.evaluate(() => {
      const t = document.getElementById('time_out')!.getBoundingClientRect();
      const ns3 = document.getElementById('next_step_3')!.getBoundingClientRect();
      return { timeOutTop: t.top, ns3Bottom: ns3.bottom, timeOutRight: t.right, ns3Right: ns3.right };
    });
    expect(
      geo.timeOutTop,
      `#time_out sits beside Support 3 instead of below it at ${vp.width}x${vp.height} (otp-v0.9.3 C5)`,
    ).toBeGreaterThanOrEqual(geo.ns3Bottom);
    expect(
      Math.abs(geo.timeOutRight - geo.ns3Right),
      `#time_out is not right-aligned to Support 3 at ${vp.width}x${vp.height} (otp-v0.9.3 C5)`,
    ).toBeLessThanOrEqual(2);
  }

  // the gate: everything else filled, Save & Lock stays disabled until Time Out
  await fillRequired(page);
  await page.fill('#time_out', '');
  await expect(page.locator('#btn-submit')).toBeDisabled();
  expect(await page.locator('#btn-submit').getAttribute('title')).toContain('Time Out');
  await page.fill('#time_out', '10:05');
  await expect(page.locator('#btn-submit')).toBeEnabled();
  await page.fill('#time_out', '');
  await expect(page.locator('#btn-submit')).toBeDisabled();

  expect(h.errors).toEqual([]);
});

test('otp-v0.8: time_out survives a reload via the ais-otp-form-v1 draft', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);
  await page.fill('#time_out', '11:40');
  await page.waitForTimeout(600); // debounced autosave is 220ms
  const draft = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, DRAFT_KEY));
  expect(draft.time_out).toBe('11:40');
  await page.reload();
  await passGate(page);
  await expect(page.locator('#time_out')).toHaveValue('11:40');
  expect(h.errors).toEqual([]);
});

test('otp-v0.8: a "+" tap puts the cursor in the note, closing drops it, the record view never focuses', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const active = () => page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return a ? { id: a.id, cls: a.className, tag: a.tagName } : null;
  });

  await tapNoteBtn(page, 'good', 1);
  await expectPop(page, 'open');
  expect((await active())!.id).toBe('sp1_note_good_1');
  // typing straight away lands in the note's data
  await page.keyboard.type('typed straight away');
  await expect(page.locator('#sp1_notes')).toHaveValue('{"Good 1":"typed straight away"}');

  // a tap on the card's own dead space (header, criterion text) must NOT steal
  // the focus: the card regularly covers other "+" buttons and an observer
  // tapping there would otherwise lose the iPad keyboard for nothing
  await page.evaluate(() => {
    (window as any).__blurs = 0;
    document.querySelector('.rub-note-text')!.addEventListener('blur', () => { (window as any).__blurs++; });
  });
  await page.locator('#rub-note-crit').click();
  await page.locator('#rub-note-head').click();
  await page.waitForTimeout(100);
  expect((await active())!.id).toBe('sp1_note_good_1');
  await page.keyboard.type(' still here');
  await expect(page.locator('#sp1_notes')).toHaveValue('{"Good 1":"typed straight away still here"}');
  expect(await page.evaluate(() => (window as any).__blurs)).toBe(0);

  // re-anchoring keeps the focus on the (persistent) textarea, now the new
  // criterion's, WITHOUT a blur in between (a blur would drop the keyboard)
  await tapNoteBtn(page, 'great', 2);
  await expectPop(page, 'open');
  await page.waitForTimeout(100);   // the reopen runs on the next frame
  expect((await active())!.id).toBe('sp1_note_great_2');
  expect(await page.evaluate(() => (window as any).__blurs)).toBe(0);

  // Done drops the focus, so a keyboard would go away and keystrokes cannot land in the faded card
  await page.locator('.rub-note-done').click();
  await expectPop(page, 'closed');
  expect((await active())!.cls).not.toContain('rub-note-text');
  await page.keyboard.type('stray');
  await expect(page.locator('#sp1_notes')).toHaveValue('{"Good 1":"typed straight away still here"}');

  // Esc as well
  await tapNoteBtn(page, 'good', 1);
  expect((await active())!.id).toBe('sp1_note_good_1');
  await page.keyboard.press('Escape');
  await expectPop(page, 'closed');
  expect((await active())!.cls).not.toContain('rub-note-text');
  expect(h.errors).toEqual([]);

  // the record view: read-only card, no focus, no keyboard
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await tapNoteBtn(page, 'good', 3);   // the fixture's badge
  await expectPop(page, 'open');
  const rec = await active();
  expect(rec === null || !rec.cls.includes('rub-note-text')).toBe(true);
  expect(await noteText(page, 'good', 3).evaluate((el) => (el as HTMLTextAreaElement).readOnly)).toBe(true);
});

test('otp-v0.8: no floating Evidence Pad launcher; every in-form entry point stays', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  await expect(page.locator('#pad-open')).toHaveCount(0);
  await expect(page.locator('.float-link.pad')).toHaveCount(0);
  await expect(page.locator('#pad-modal')).toHaveCount(1);
  // the five section pencils + the note card's own pencil
  await expect(page.locator('.pad-field-btn[data-pad-target]')).toHaveCount(5);
  await expect(page.locator('#rub-note-pop .pad-field-btn')).toHaveCount(1);
  await expect(page.locator('.pad-attach')).toHaveCount(6);

  // a section pencil still opens the pad, Done closes it
  await page.locator('.pad-field-btn[data-pad-target="observer_comments"]').click();
  await expect(page.locator('body')).toHaveClass(/pad-open/, { timeout: 10_000 });
  await page.locator('#pad-done').click();
  await expect(page.locator('body')).not.toHaveClass(/pad-open/, { timeout: 10_000 });

  // and the criterion note card's pencil is wired to its criterion
  await tapNoteBtn(page, 'good', 2);
  await expectPop(page, 'open');
  expect(await page.locator('#rub-note-pop .pad-field-btn').getAttribute('data-pad-target')).toBe('sp1_good_2_note');
  expect(await page.locator('#rub-note-pop .pad-field-btn').isHidden()).toBe(false);

  expect(h.errors).toEqual([]);
});

/* ===================================================================
   otp-v0.9 · the coaching lifecycle on the form
   Edit mode by token (Save changes / Close Lap), the previous lap's
   Next Steps in two places, and the lap banner.
   =================================================================== */

test('otp-v0.9: ?edit= loads the record with the fields enabled and the Tom Selects populated', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await openEdit(page);

  // the banner says exactly where the lap stands
  const banner = await bannerText(page);
  expect(banner).toContain('Lap 1 · open');
  expect(banner).toMatch(dayRe('observed ', '2026-09-03'));
  expect(banner).toContain('by Test Observer');
  expect(banner).toContain('AIS-OTP-20260903-101500');

  // populated exactly as a locked record view is (hard rule 11: opaque values)
  await expect(page.locator('#teacher')).toHaveValue('t0');
  await expect(page.locator('#inspector')).toHaveValue('i0');
  await expect(page.locator('#subject')).toHaveValue('s0');
  await expect(page.locator('#teacher').locator('xpath=following-sibling::div[1]')).toContainText('Test Teacher');
  await expect(page.locator('#inspector').locator('xpath=following-sibling::div[1]')).toContainText('Test Observer');
  await expect(page.locator('#date')).toHaveValue('2026-09-03');
  await expect(page.locator('#time_out')).toHaveValue('10:05');
  await expect(page.locator('#grade')).toHaveValue('3');
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  await expect(page.locator('#next_step_3')).toHaveValue('Record next step three');
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', 'partial');
  await expect(chipAt(page, 'great', 2)).toHaveAttribute('data-state', 'present');
  await expect(page.locator('.rub-note-btn.has-note')).toHaveCount(2);

  // ...but nothing is locked: the lap is still open
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#observer_comments')).toBeEnabled();
  await expect(page.locator('#next_step_1')).toBeEnabled();
  await expect(page.locator('#time_out')).toBeEnabled();
  await page.fill('#next_step_1', 'Edited next step one');
  await expect(page.locator('#next_step_1')).toHaveValue('Edited next step one');

  // the action bar swaps: Save changes + Close Lap, no Save & Lock, no Reset
  await expect(page.locator('#btn-save-changes')).toBeVisible();
  await expect(page.locator('#btn-close-lap')).toBeVisible();
  await expect(page.locator('#btn-save-changes')).toBeEnabled();
  await expect(page.locator('#btn-close-lap')).toBeEnabled();
  await expect(page.locator('#btn-submit')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeHidden();

  // no new Evidence Pad pages in edit mode, but the existing ones still open
  for (const t of ['observer_comments', 'other_observations', 'next_step_1', 'next_step_2', 'next_step_3']) {
    await expect(page.locator(`.pad-field-btn[data-pad-target="${t}"]`)).toBeHidden();
  }
  await tapNoteBtn(page, 'great', 5);
  await expectPop(page, 'open');
  await expect(notePop(page).locator('.pad-field-btn')).toBeHidden();
  await expect(notePop(page).locator('.pad-attach[data-pad-target="sp1_great_5_note"]')).toBeVisible();
  await page.locator('.rub-note-done').click();

  expect(h.posts).toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.9: Save changes posts action "update" with the record_token and all 32 keys', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await openEdit(page);

  await page.fill('#next_step_1', 'Agreed in the meeting: model the worked example');
  await page.fill('#observer_comments', 'Edited observer comments');
  await page.locator('#btn-save-changes').click();
  // otp-v0.9.3: an open lap answers with the sticky notice, not the toast
  await expect(page.locator('#notice')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#notice-text')).toContainText('still OPEN');

  expect(h.posts).toHaveLength(1);
  const body = h.posts[0];
  expect(body.action).toBe('update');
  expect(body.record_token).toBe(EDIT_TOKEN_FIXTURE);
  // the submit contract, unchanged: the SAME 32 keys, plus action + record_token
  const contract = Object.keys(body).filter((k) => k !== 'action' && k !== 'record_token');
  expect(contract.sort()).toEqual(CONTRACT_KEYS);
  expect(contract).toHaveLength(32);
  expect(Object.keys(body)).toHaveLength(34);
  expect(body.form).toBe('otp');
  expect(body.teacher).toBe('Test Teacher');
  expect(body.inspector).toBe('Test Observer');
  expect(body.subject).toBe('Mathematics');
  expect(body.grade).toBe('3');
  expect(body.school).toBe('Primary');
  expect(body.next_step_1).toBe('Agreed in the meeting: model the worked example');
  expect(body.observer_comments).toBe('Edited observer comments');
  // the record keeps the pad it already has: posted back exactly as it came
  expect(body.evidence_pad_id).toBe('pad-abc123');
  expect(body.sp1_present).toBe('Great 2');
  expect(body.rubric_version).toBe('sp1-v2');

  // still editable afterwards, and still not locked
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#btn-save-changes')).toBeEnabled();
  await expect(page.locator('#next_step_1')).toBeEnabled();
  expect(h.errors).toEqual([]);
});

test('otp-v0.9: Close Lap, confirmed, posts "close", locks the form and the banner says closed', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  const asked: string[] = [];
  page.on('dialog', (d) => { asked.push(d.message()); d.accept(); });
  await openEdit(page);

  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });

  expect(asked).toHaveLength(1);
  expect(asked[0]).toBe(
    'Close Lap 1 for Test Teacher? Next Steps become final and Test Teacher is notified.',
  );

  expect(h.posts).toHaveLength(1);
  expect(h.posts[0].action).toBe('close');
  expect(h.posts[0].record_token).toBe(EDIT_TOKEN_FIXTURE);
  expect(Object.keys(h.posts[0])).toHaveLength(34);

  const banner = await bannerText(page);
  expect(banner).toMatch(dayRe('Lap 1 · closed ', '2026-09-11T09:30:00.000Z'));

  await expect(page.locator('#observer_comments')).toBeDisabled();
  await expect(page.locator('#next_step_1')).toBeDisabled();
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  expect(h.errors).toEqual([]);
});

test('otp-v0.9: Close Lap, dismissed, posts nothing and leaves the form editable', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  page.on('dialog', (d) => d.dismiss());
  await openEdit(page);

  await page.locator('#btn-close-lap').click();
  await page.waitForTimeout(600);

  expect(h.posts).toHaveLength(0);
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#btn-close-lap')).toBeEnabled();
  await expect(page.locator('#next_step_1')).toBeEnabled();
  expect(await bannerText(page)).toContain('Lap 1 · open');
  expect(h.errors).toEqual([]);
});

test('otp-v0.9: a record already closed opens read-only through ?edit=', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_CLOSED });
  await openEdit(page);

  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/);
  await expect(page.locator('#observer_comments')).toBeDisabled();
  await expect(page.locator('#next_step_1')).toBeDisabled();
  await expect(page.locator('#time_out')).toBeDisabled();

  const banner = await bannerText(page);
  expect(banner).toMatch(dayRe('Lap 2 · closed ', '2026-09-08T07:20:00.000Z'));
  expect(banner).toContain('Read-only view');

  // no dead buttons: neither edit action is offered on a closed lap
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#btn-submit')).toBeHidden();

  expect(h.posts).toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.9: edit mode never reads or writes the ais-otp-form-v1 draft', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  const draft = JSON.stringify({
    teacher: 'Someone Else',
    inspector: 'Another Observer',
    room_number: 'DRAFT ROOM',
    observer_comments: 'an unfinished observation on the same iPad',
    rubric_version: 'sp1-v2',
  });

  await page.goto(FORM_URL);
  await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [DRAFT_KEY, draft]);

  await openEdit(page);

  // the draft never bleeds into the record (hard rule 13)
  await expect(page.locator('#room_number')).toHaveValue('12B');
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  await expect(page.locator('#teacher').locator('xpath=following-sibling::div[1]')).toContainText('Test Teacher');

  // and the record never overwrites the draft, not even after typing
  await page.fill('#next_step_2', 'typed while editing the record');
  await page.fill('#observer_comments', 'edited while the draft sits underneath');
  await page.waitForTimeout(700);   // longer than the 220ms autosave debounce
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBe(draft);

  // the footer must not claim an autosave that is not happening
  await expect(page.locator('#save-status')).toBeHidden();
  expect(h.errors).toEqual([]);
});

test('otp-v0.9: the previous Next Steps card and echo render when a closed lap is found', async ({ page }) => {
  const h = await harness(page, { prev: PREV_NS_FOUND });
  await openForm(page);

  // hidden until a teacher is picked
  await expect(page.locator('#prev-ns-card')).toBeHidden();
  await expect(page.locator('#prev-ns-echo')).toBeHidden();

  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#prev-ns-card')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo')).toBeVisible();

  // otp-v0.9.3 (C1): the card is one line, "Teacher observed <date> · Lap <n> · goals below"
  const cardLine = new RegExp(
    `^Teacher observed ${dayPat(PREV_NS_FOUND.observation_date)} · Lap ${PREV_NS_FOUND.lap} · goals below$`,
  );
  await expect(
    page.locator('#prev-ns-card-head'),
    'prev-ns-card-head is not the otp-v0.9.3 one-line "Teacher observed ... goals below" format (C1)',
  ).toHaveText(cardLine);
  await expect(
    page.locator('#prev-ns-toggle'),
    '#prev-ns-toggle should have been removed in otp-v0.9.3 (C1: the card has nothing to expand)',
  ).toHaveCount(0);

  // otp-v0.9.3 (C2): the echo is the FIRST child of #rubric-section, above its heading
  expect(
    await page.evaluate(() => document.getElementById('rubric-section')?.firstElementChild?.id),
    'prev-ns-echo is not the first child of #rubric-section (otp-v0.9.3 C2: goals-above-rubric)',
  ).toBe('prev-ns-echo');

  const echoHead = new RegExp(
    `^Lap ${PREV_NS_FOUND.lap} Next Steps · ${dayPat(PREV_NS_FOUND.observation_date)} · ${PREV_NS_FOUND.observer}$`,
  );
  await expect(page.locator('#prev-ns-echo-head')).toHaveText(echoHead);
  await expect(page.locator('#prev-ns-echo-list li')).toHaveText(PREV_NS_STEPS);
  await expect(page.locator('#prev-ns-echo-list li')).toHaveCount(3);

  // it sits under the Teacher field
  expect(await page.locator('#prev-ns-card').evaluate(
    (el) => el.closest('.info-cell')!.querySelector('select')!.id)).toBe('teacher');

  // nothing fixed-position (iPad rules, hard rule 15)
  for (const sel of ['#prev-ns-card', '#prev-ns-echo']) {
    expect(await page.locator(sel).evaluate((el) => getComputedStyle(el).position)).toBe('static');
  }

  // clearing the teacher hides both again
  await page.locator('#teacher').locator('xpath=following-sibling::div[1]').locator('.clear-button').click();
  await expect(page.locator('#prev-ns-card')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo')).toBeHidden();

  expect(h.errors).toEqual([]);
});

test('otp-v0.9: no previous lap, a garbled answer, or the viewer build: card and echo stay hidden', async ({ page }) => {
  // 1. the backend has no closed lap for this teacher
  const h = await harness(page);            // default: { success: true, found: false }
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(700);
  await expect(page.locator('#prev-ns-card')).toBeHidden();
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  expect(h.errors).toEqual([]);

  // 2. the call comes back garbled: still nothing shown, still no error UI (hard rule 12)
  const h2 = await harness(page, { prev: 'fail' });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(900);
  await expect(page.locator('#prev-ns-card')).toBeHidden();
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  expect(h2.errors).toEqual([]);

  // 3. the ungated teacher viewer never shows another teacher's history
  const src = viewerSrc();
  expect(src).toContain('body.is-viewer .prev-ns { display: none !important; }');
  const h3 = await harness(page, { prev: PREV_NS_FOUND, record: RECORD_PAYLOAD_OPEN });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await expect(page.locator('#prev-ns-card')).toBeHidden();
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  // ...and the viewer's banner carries the lap and its state
  expect(await bannerText(page)).toContain('Lap 1 · open');
  expect(h3.errors).toEqual([]);

  // 4. a row written before otp-v0.9 has no lap at all, and reads as Lap 1
  const h4 = await harness(page, { record: RECORD_PAYLOAD });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  expect(await bannerText(page)).toContain('Lap 1 · open');
  expect(h4.errors).toEqual([]);
});

test('otp-v0.9.3: the card is one line with no toggle and shows no steps', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, prev: PREV_NS_FOUND });
  // edit mode loads the teacher from the record, so the card renders with no tap
  await openEdit(page);
  await expect(page.locator('#prev-ns-card')).toBeVisible({ timeout: 10_000 });

  await expect(
    page.locator('#prev-ns-card button'),
    'a button still lives inside #prev-ns-card (otp-v0.9.3 C1: nothing to expand)',
  ).toHaveCount(0);
  await expect(
    page.locator('#prev-ns-card li'),
    'a step list still lives inside #prev-ns-card (otp-v0.9.3 C1: goals moved to the echo, not shown here)',
  ).toHaveCount(0);

  const box = await page.locator('#prev-ns-card').boundingBox();
  expect(box, '#prev-ns-card has no bounding box').not.toBeNull();
  expect(
    box!.height,
    `#prev-ns-card is ${box!.height}px tall, expected a single collapsed line under 48px (otp-v0.9.3 C1)`,
  ).toBeLessThan(48);

  expect(h.errors).toEqual([]);
});

test('otp-v0.9: the keep-focus guards are on mousedown only, never pointerdown', async () => {
  const src = viewerSrc();
  // a cancelled TOUCH pointerdown suppresses WebKit's synthesized mousedown AND
  // click, so every tap on the element dies on a real iPad (the otp-v0.8 lesson)
  expect(src).toContain("pop.addEventListener('mousedown', keepNoteFocus)");
  expect(src).toContain("scrim.addEventListener('mousedown'");
  expect(src).not.toContain("addEventListener('pointerdown', keepNoteFocus");
  // the ONLY pointerdown in the whole form is the pad's own drawing surface
  expect((src.match(/addEventListener\('pointerdown'/g) || [])).toHaveLength(1);
  // and every otp-v0.9 control is wired on click
  expect(src).toContain("document.getElementById('btn-save-changes').addEventListener('click', saveEditChanges);");
  expect(src).toContain("document.getElementById('btn-close-lap').addEventListener('click', closeCurrentLap);");
  // otp-v0.9.3: the card has no toggle any more; the notice close is the new control
  expect(src).toContain("b.addEventListener('click', hideNotice)");
});

test('otp-v0.9.3: WebKit taps drive Save changes and Close Lap', async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({
    hasTouch: true,
    viewport: { width: 820, height: 1180 },
    baseURL: 'http://127.0.0.1:8123',
  });
  const page = await ctx.newPage();
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, prev: PREV_NS_FOUND });
  page.on('dialog', (d) => d.accept());
  await openEdit(page);

  await expect(page.locator('#prev-ns-card')).toBeVisible({ timeout: 10_000 });

  // Save changes on a real tap: an open lap shows the sticky #notice, not the
  // toast (otp-v0.9.3 C4), and a real tap on its close button must dismiss it
  // (iPad tap law: click-family events only, never pointerdown)
  await page.locator('#btn-save-changes').tap();
  const notice = page.locator('#notice');
  await expect(notice, '#notice never appears after a real tap on Save changes (otp-v0.9.3 C4)').toBeVisible({ timeout: 10_000 });
  expect(h.posts).toHaveLength(1);
  expect(h.posts[0].action).toBe('update');

  await page.locator('#notice-close').tap();
  await expect(notice, '#notice-close does not dismiss #notice on a real tap (otp-v0.9.3 C4)').toBeHidden();

  // Close Lap on a real tap
  await page.locator('#btn-close-lap').tap();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });
  expect(h.posts).toHaveLength(2);
  expect(h.posts[1].action).toBe('close');
  expect(await bannerText(page)).toContain('Lap 1 · closed');

  expect(h.errors).toEqual([]);
  await ctx.close();
});

test('otp-v0.9: no console errors and no horizontal overflow in edit mode at 1280x800 and 820x1180', async ({ page }) => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(vp);
    const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, prev: PREV_NS_FOUND });
    await openEdit(page);
    await expect(page.locator('#prev-ns-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#prev-ns-echo')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(1);
    expect(h.errors, `console errors at ${vp.width}x${vp.height}`).toEqual([]);
  }
});

test('otp-v0.9: a long teacher name never grows the focused control, so a REAL click on the card right after the pick lands (no layout jump on blur)', async ({ page }) => {
  // Live proof 2026-09-11: with 'OTP Test Teacher (delete me)' the focused
  // teacher control was 73 px and 50 px after blur; the card under it jumped
  // 23 px at mousedown-blur and the mouseup landed on the cell above.
  const LONG = 'OTP Test Teacher (delete me) with a deliberately very long display name';
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.unshift({ name: LONG, email: 'long.name@ais.ae' });
  const h = await harness(page, { prev: PREV_NS_FOUND, options });
  await page.setViewportSize({ width: 820, height: 1180 });   // iPad portrait: the narrow column
  await page.goto(FORM_URL);
  await passGate(page);
  await pickTomSelect(page, 'teacher', LONG);
  await expect(page.locator('#prev-ns-card')).toBeVisible({ timeout: 10_000 });
  const control = page.locator('#teacher').locator('xpath=following-sibling::div[1]').locator('.ts-control');
  const focusedH = (await control.boundingBox())!.height;    // still focused after the pick
  const card = page.locator('#prev-ns-card');
  const box = (await card.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);   // a real click: the blur happens under it
  const blurredH = (await control.boundingBox())!.height;
  expect(Math.abs(focusedH - blurredH)).toBeLessThan(2);
  // otp-v0.9.3: the card is one line with nothing to open, so the proof is that
  // it does not move under the click
  expect(Math.abs(box.y - (await card.boundingBox())!.y)).toBeLessThan(2);
  expect(h.errors).toEqual([]);
});


/* === otp-v0.9.1 · the four defects the observers hit on the live form ====== */

test('otp-v0.9.1 D1 reload: a part-filled draft keeps teacher, observer and subject', async ({ page }) => {
  // Live 2026-09-11: any reload or reopen wiped exactly these three out of the
  // draft while every other field survived. The staff and subject lists land
  // seconds after the page, so the delay below is the defect's whole window.
  const h = await harness(page);
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().url().includes('action=options')) {
      await new Promise((done) => setTimeout(done, 1500));
    }
    await r.fallback();
  });

  const DRAFT = {
    teacher: 'Test Teacher',
    inspector: 'Test Observer',    // the form field for Observer
    subject: 'Mathematics',
    grade: '3',                    // derives school "Primary", which the Subject list needs
    room_number: '12B',
    next_step_3: 'Draft survives a reload',
  };
  await page.addInitScript(
    ([k, v]) => localStorage.setItem(k as string, v as string),
    [DRAFT_KEY, JSON.stringify(DRAFT)] as [string, string],
  );

  await page.goto(FORM_URL);
  await passGate(page);   // waits for the overlay to go, i.e. the options landed

  // the three texts are still in the draft, not blanked by the autosave that
  // ran 220 ms in, long before any option existed to match them
  const draft = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, DRAFT_KEY));
  expect(draft.teacher).toBe('Test Teacher');
  expect(draft.inspector).toBe('Test Observer');
  expect(draft.subject).toBe('Mathematics');
  // the fields that never broke still restore
  expect(draft.grade).toBe('3');
  await expect(page.locator('#room_number')).toHaveValue('12B');
  await expect(page.locator('#next_step_3')).toHaveValue('Draft survives a reload');

  // and all three controls show the restored name once the options arrive
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher');
  await expect(tsControl(page, 'inspector')).toContainText('Test Observer');
  await expect(page.locator('#school')).toHaveValue('Primary');
  await expect(tsControl(page, 'subject')).toContainText('Mathematics');

  // the restored pick is spent, so a deliberate clear by the observer stands
  await tsControl(page, 'teacher').locator('.clear-button').click();
  await page.waitForTimeout(600);   // debounced autosave is 220 ms
  const after = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, DRAFT_KEY));
  expect(after.teacher).toBe('');
  expect(after.inspector).toBe('Test Observer');

  expect(h.errors).toEqual([]);
});

test('otp-v0.9.1 D3 subject guard: Subject is disabled and says "Select Grade first" until a Grade is picked', async ({ page }) => {
  // Live 2026-09-11: the guard was set while the options landed and then wiped
  // by the loading state being cleared, so Subject opened on an empty list and
  // answered "No results found" before any Grade was picked.
  const h = await harness(page);
  await openForm(page);

  const subject = tsControl(page, 'subject');
  await expect(subject).toHaveClass(/disabled/);
  const subjectInput = subject.locator('.ts-control input').first();
  await expect(subjectInput).toHaveAttribute('placeholder', 'Select Grade first');
  await expect(subjectInput).toBeDisabled();
  await subject.click();
  await expect(page.locator('.ts-dropdown .no-results')).toHaveCount(0);
  await expect(page.locator('#subject')).toHaveValue('');

  // Teacher and Observer are NOT guarded: they open as soon as the list lands
  await expect(tsControl(page, 'teacher')).not.toHaveClass(/disabled/);
  await expect(tsControl(page, 'inspector')).not.toHaveClass(/disabled/);

  // a Grade opens Subject on its school's list
  await pickGrade(page, '3');
  await expect(subject).not.toHaveClass(/disabled/);
  await expect(subjectInput).toHaveAttribute(
    'placeholder', 'Tap to browse subjects, or type to search…',
  );
  await pickTomSelect(page, 'subject', 'Mathematics');
  await expect(subject).toContainText('Mathematics');

  expect(h.errors).toEqual([]);
});

test('otp-v0.9.1 D4 viewer miss: a wrong or expired link lands on the calm card, never a toast', async ({ page }) => {
  // Hard rule 12. Live 2026-09-11: the ungated viewer answered a stale link
  // with a red "Could not load record: Record not found" over a blank form
  // carrying a dead SAVE & LOCK.
  const h = await harness(page, { record: { success: false, error: 'Record not found' } });
  await page.goto(RECORD_URL + '?token=00000000000000000000000000000000');

  const card = page.locator('#form-loading .form-loading-card');
  await expect(card).toContainText(
    'This link is not valid or has expired. Ask your observer for a new link.',
    { timeout: 15_000 },
  );
  await expect(card).toContainText('Please open your personal record link to view an observation record.');
  await expect(page.locator('#form-loading')).not.toHaveClass(/is-hidden/);
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  // the options fetch finishing later must not pull the card away
  await page.waitForTimeout(1000);
  await expect(page.locator('#form-loading')).not.toHaveClass(/is-hidden/);
  await expect(card).toContainText('This link is not valid or has expired.');

  // the GATED form is unchanged: it still says so out loud
  await page.goto(`${FORM_URL}?token=00000000000000000000000000000000`);
  await passGate(page);
  await expect(page.locator('#toast')).toHaveClass(/error/, { timeout: 15_000 });
  await expect(page.locator('#toast')).toHaveText(/Could not load record/);

  expect(h.errors).toEqual([]);
});

test('otp-v0.9.1 D6 confirm wording: Save & Lock no longer claims the record cannot be edited', async ({ page }) => {
  const h = await harness(page);
  const asked: string[] = [];
  page.on('dialog', (d) => { asked.push(d.message()); d.dismiss(); });   // dismissed: nothing posts
  await openForm(page);
  await fillRequired(page);
  await page.locator('#btn-submit').click();

  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]).toBe(
    'Save and lock this Progress in Lessons OTP form? You can still change it from the link in your confirmation email until you close the lap.',
  );
  expect(asked[0]).toContain('until you close the lap');
  expect(asked[0]).not.toContain('Cannot be edited after');
  expect(h.posts).toEqual([]);

  expect(h.errors).toEqual([]);
});

/* otp-v0.9.2 · keyboard engine vs the iPadOS 26 accessory-strip inset.
   Device-measured 2026-09-11 (iPad Air 13-inch M3 simulator, HUD build): the
   keyboard's dismiss key restores visualViewport.height to the baseline (1309)
   and 0.5 s later iPadOS re-insets it to 1137 for the docked accessory strip;
   the old engine read that 172 pt inset as a keyboard and kept body.kb-open.
   The test replaces visualViewport before the page scripts run and replays
   the measured heights. */
async function fakeViewport(page: Page) {
  await page.addInitScript(() => {
    const listeners: Record<string, Array<() => void>> = { resize: [], scroll: [] };
    const fake: any = {
      height: 1309, width: 1024, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
      addEventListener(t: string, fn: () => void) { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener() {},
      set(h: number) { fake.height = h; (listeners.resize || []).forEach(fn => fn()); },
    };
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
    (window as any).__fakeVV = fake;
  });
}
const vvSet = (page: Page, h: number) => page.evaluate(n => (window as any).__fakeVV.set(n), h);
const kbOpen = (page: Page) => page.evaluate(() => document.body.classList.contains('kb-open'));

test('otp-v0.9.2 D2 keyboard dismiss: the accessory-strip inset after the dismiss key does not keep the controls hidden', async ({ page }) => {
  await fakeViewport(page);
  const h = await harness(page);
  await openForm(page);
  await expect(page.locator('body')).not.toHaveClass(/kb-open/);

  // full keyboard: 1309 -> 906 (403 pt) opens the state
  await vvSet(page, 906);
  await expect.poll(() => kbOpen(page)).toBe(true);

  // dismiss key: back to the baseline, then the strip inset 0.5 s later
  await vvSet(page, 1309);
  await page.waitForTimeout(500);
  await vvSet(page, 1137);
  await page.waitForTimeout(600);
  expect(await kbOpen(page)).toBe(false);          // old engine: true (stuck)

  // strip still up, the real keyboard comes back: opens again
  await vvSet(page, 906);
  await expect.poll(() => kbOpen(page)).toBe(true);
  // and a fast dismiss (strip inset before the settle timer fires) still closes
  await vvSet(page, 1309);
  await page.waitForTimeout(100);
  await vvSet(page, 1137);
  await page.waitForTimeout(600);
  expect(await kbOpen(page)).toBe(false);
  void h;
});

test('otp-v0.9.2 D2 keyboard engine: a strip-only focus never hides the controls, a full keyboard still does', async ({ page }) => {
  await fakeViewport(page);
  const h = await harness(page);
  await openForm(page);
  await vvSet(page, 1208);                          // accessory strip only (101 pt), below KB_DELTA
  await page.waitForTimeout(500);
  expect(await kbOpen(page)).toBe(false);
  await vvSet(page, 906);                           // full keyboard
  await expect.poll(() => kbOpen(page)).toBe(true);
  await vvSet(page, 1309);                          // plain blur close
  await page.waitForTimeout(600);
  expect(await kbOpen(page)).toBe(false);
  void h;
});

/* ===================================================================
   otp-v0.9.3 · card-line goals-above-rubric, Close Lap pulse, the
   sticky notice on an open-lap save, Time Out geometry (see above) and
   the five long-text boxes auto-growing.
   =================================================================== */

test('otp-v0.9.3: Close Lap pulses (close-lap-pulse) in an open edit view, never when disabled, closed or in the plain form', async ({ page }) => {
  const msg = 'Close Lap does not carry the close-lap-pulse animation (otp-v0.9.3 C3)';
  const noneMsg = (why: string) => `Close Lap keeps pulsing ${why} (otp-v0.9.3 C3)`;

  // 1. an open edit view: the button pulses
  await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await openEdit(page);
  const btn = page.locator('#btn-close-lap');
  expect(await btn.evaluate((el) => getComputedStyle(el).animationName), msg).toBe('close-lap-pulse');

  // 2. disabled (a required field cleared): no pulse
  await page.fill('#time_out', '');
  await expect(btn).toBeDisabled();
  expect(await btn.evaluate((el) => getComputedStyle(el).animationName), noneMsg('while disabled')).toBe('none');

  // 3. confirmed Close Lap, now closed: no pulse
  await page.fill('#time_out', '10:05');
  await expect(btn).toBeEnabled();
  page.on('dialog', (d) => d.accept());
  await btn.click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });
  expect(await btn.evaluate((el) => getComputedStyle(el).animationName), noneMsg('after the lap closed')).toBe('none');

  // 4. the plain (non-edit) form: never pulses
  await harness(page);
  await openForm(page);
  expect(
    await page.locator('#btn-close-lap').evaluate((el) => getComputedStyle(el).animationName),
    noneMsg('on the plain form'),
  ).toBe('none');
});

test('otp-v0.9.3: Save changes on an open lap shows the sticky notice until dismissed or the lap closes', async ({ page }) => {
  const RECORD_LAP7 = { ...RECORD_PAYLOAD_OPEN, data: { ...RECORD_PAYLOAD_OPEN.data, lap: '7' } };
  const h = await harness(page, { record: RECORD_LAP7 });
  await openEdit(page);

  await page.locator('#btn-save-changes').click();
  const notice = page.locator('#notice');
  await expect(notice, '#notice never appears after Save changes on an open lap (otp-v0.9.3 C4)').toBeVisible({ timeout: 10_000 });
  const text = await notice.innerText();
  expect(text, '#notice text does not say the lap is still OPEN (otp-v0.9.3 C4)').toContain('still OPEN');
  expect(text, `#notice text does not name Lap ${RECORD_LAP7.data.lap} (otp-v0.9.3 C4)`).toContain('Lap 7');

  // sticky: no auto-hide timer
  await page.waitForTimeout(6000);
  await expect(notice, '#notice auto-hid instead of staying sticky (otp-v0.9.3 C4)').toBeVisible();

  // dismissed by its own close button
  await page.locator('#notice-close').click();
  await expect(notice, '#notice-close does not dismiss #notice (otp-v0.9.3 C4)').toBeHidden();

  // a second save shows it again
  await page.locator('#btn-save-changes').click();
  await expect(notice, '#notice does not reappear on a second Save changes (otp-v0.9.3 C4)').toBeVisible({ timeout: 10_000 });

  // a confirmed Close Lap hides it
  page.on('dialog', (d) => d.accept());
  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });
  await expect(notice, '#notice stays visible after the lap closed (otp-v0.9.3 C4)').toBeHidden();
  expect(h.errors).toEqual([]);

  // the viewer build never shows the notice, the card or the echo
  const h2 = await harness(page, { record: RECORD_LAP7, prev: PREV_NS_FOUND });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await expect(page.locator('#notice'), '#notice shows in the ungated viewer build (otp-v0.9.3 C4)').toBeHidden();
  await expect(page.locator('#prev-ns-card')).toBeHidden();
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  expect(h2.errors).toEqual([]);
});

test('otp-v0.9.3: the five long-text boxes grow with their text and Reset restores the start height', async ({ page }) => {
  await harness(page);
  await openForm(page);

  // the contract names exactly these five; a build that wires auto-grow on
  // only some of them must not pass this spec (otp-v0.9.3 C6)
  const LONG_TEXT_IDS = ['observer_comments', 'other_observations', 'next_step_1', 'next_step_2', 'next_step_3'];
  await expect(
    page.locator('textarea.long-text'),
    `textarea.long-text does not match the five contract boxes (${LONG_TEXT_IDS.join(', ')}) (otp-v0.9.3 C6)`,
  ).toHaveCount(LONG_TEXT_IDS.length);

  const lines = (n: number) => Array.from({ length: n }, (_, i) => `Line ${i + 1}`).join('\n');
  const startHeights: Record<string, number> = {};

  for (const id of LONG_TEXT_IDS) {
    const box = page.locator(`#${id}`);
    startHeights[id] = await box.evaluate((el) => (el as HTMLElement).clientHeight);
    await box.fill(lines(12));
    const grown = await box.evaluate((el) => {
      const e = el as HTMLTextAreaElement;
      return { clientHeight: e.clientHeight, scrollHeight: e.scrollHeight };
    });
    expect(
      grown.clientHeight,
      `#${id} stayed at ${startHeights[id]}px instead of growing with 12 lines of text (otp-v0.9.3 C6)`,
    ).toBeGreaterThan(startHeights[id]);
    expect(
      grown.scrollHeight,
      `#${id} still scrolls internally instead of growing to fit its text (otp-v0.9.3 C6)`,
    ).toBeLessThanOrEqual(grown.clientHeight + 2);
  }

  page.on('dialog', (d) => d.accept());
  await page.locator('#btn-reset').click();
  for (const id of LONG_TEXT_IDS) {
    const afterReset = await page.locator(`#${id}`).evaluate((el) => (el as HTMLElement).clientHeight);
    expect(
      afterReset,
      `Reset left #${id} at ${afterReset}px instead of its ${startHeights[id]}px start height (otp-v0.9.3 C6)`,
    ).toBe(startHeights[id]);
  }

  // a record whose other_observations has 12 lines renders tall on load, no inner scrollbar
  const longObs = lines(12);
  const record = { ...RECORD_PAYLOAD_OPEN, data: { ...RECORD_PAYLOAD_OPEN.data, other_observations: longObs } };
  await harness(page, { record });
  await openEdit(page);
  const loaded = await page.locator('#other_observations').evaluate((el) => {
    const e = el as HTMLTextAreaElement;
    return { clientHeight: e.clientHeight, scrollHeight: e.scrollHeight };
  });
  expect(
    loaded.scrollHeight,
    'other_observations does not auto-grow to fit a loaded 12-line record on open (otp-v0.9.3 C6)',
  ).toBeLessThanOrEqual(loaded.clientHeight + 2);
});

test('otp-v0.9.3: the footer reads otp-v0.9.3', async ({ page }) => {
  await harness(page);
  await openForm(page);
  await expect(
    page.locator('.form-footer'),
    'footer version was not bumped to otp-v0.9.3',
  ).toContainText(/otp-v0\.9\.3/i);
});
