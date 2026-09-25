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

/** otp-v0.9: the previous (closed) lap, as ?action=prev_next_steps returns it
 *  (the get_teacher_lap_state fallback path, otp-v0.11). otp-v0.9.3:
 *  lap/date/observer match the contract's own worked example (Lap 8, 11 Sept
 *  2026, Igor Sesar) so the echo text specs read verbatim. */
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

/** otp-v0.9: the gated form, reopened on an existing record with ?edit=.
 *  otp-v0.11 FIX A (node 14): an OPEN record no longer shows the banner, so
 *  "the record has landed" is EDIT_RECORD being set (open, via enterEditMode)
 *  or the form locking (closed, via lockForm) - never the banner, which only
 *  the closed/locked path still shows. */
async function openEdit(page: Page, token: string = EDIT_TOKEN_FIXTURE) {
  await page.goto(`${FORM_URL}?edit=${token}`);
  await passGate(page);
  await page.waitForFunction(
    () => {
      const mode = (window as any).__otpFormMode && (window as any).__otpFormMode();
      return !!(mode && (mode.hasEditRecord || document.getElementById('otp-form')?.classList.contains('is-locked')));
    },
    { timeout: 20_000 },
  );
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
  await expect(page.locator('.form-footer')).toContainText(/otp-v0\.14/i);
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
  // otp-v0.10: the form mints the record_token itself (transport identity, like
  // `action` on the edit path); the §2 contract keys are unchanged around it.
  expect(body.record_token).toMatch(/^[0-9a-f]{32}$/);
  // otp-v0.11 Part C.1: enforce_open_block is a transport flag like
  // record_token/action, never stored in content (the server strips it), so
  // it sits outside the §2 contract the same way.
  expect(body.enforce_open_block).toBe('true');
  // otp-v0.14: reflection_flow is the ONLY new POST key, sent the same way -
  // a transport flag (the server mints teacher_token from it, never stores
  // the flag itself), outside the §2 contract.
  expect(body.reflection_flow).toBe('true');
  const contractKeys = Object.keys(body).filter(
    (k) => k !== 'record_token' && k !== 'enforce_open_block' && k !== 'reflection_flow',
  );
  expect(contractKeys.sort()).toEqual(CONTRACT_KEYS);
  expect(contractKeys).toHaveLength(32);   // §2 list, counted not assumed (otp-v0.8: + time_out)
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
  // otp-v0.10 Phase 3: the key-free viewer no longer loads the option lists;
  // each searchable gets ONE opaque-keyed option built from the record's own
  // text (hard rule 11), so the value is 'r0' where the list-fed gated form
  // gives t0 / i0 / s0.
  await expect(page.locator('#teacher')).toHaveValue('r0');
  await expect(page.locator('#inspector')).toHaveValue('r0');
  await expect(page.locator('#subject')).toHaveValue('r0');
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

    // otp-v0.13: the legend's own colour cue is the letter badge (the square
    // swatch is gone); it carries the same tint as a chip in that state
    const lb = await page
      .locator(`.rub-legend-badge[data-state="${t.state}"]`)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(lb, t.state).toBe(t.tint);
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
  // otp-v0.13: the square swatch is gone; the letter badge is the key's only
  // colour cue now, filled with the same tint the chip in that state uses
  await expect(legend.locator('.rub-legend-sw')).toHaveCount(0);
  const badges = legend.locator('.rub-legend-badge');
  expect(await badges.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.state)))
    .toEqual(['', 'present', 'partial', 'absent']);
  // tap each state onto a scratch chip so we have a live chip in every state
  // to compare the legend badges against
  const scratchChip = page.locator('.rub-chip[data-level="good"][data-n="4"]');
  for (const l of ['present', 'partial', 'absent'] as const) {
    const taps = { present: 1, partial: 2, absent: 3 }[l];
    for (let i = 0; i < taps; i++) await scratchChip.click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400); // the 0.16s colour transition has settled
    const [badge, chip] = await Promise.all([
      page.locator(`.rub-legend-badge[data-state="${l}"]`).evaluate((el) => getComputedStyle(el).backgroundColor),
      scratchChip.evaluate((el) => getComputedStyle(el).backgroundColor),
    ]);
    expect(badge, l).toBe(chip);
    for (let i = taps; i < 4; i++) await scratchChip.click(); // finish the cycle, back to N
  }
  const nBg = await page
    .locator('.rub-legend-badge[data-state=""]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(nBg).toBe('rgba(0, 0, 0, 0)');
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

test('otp-v0.13: a colour-blind-safe letter badge (N/G/Y/R) rides every chip, left of the "+", and the legend explains it', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const badgeLetter = (page: Page, key: string, n: number) =>
    chipAt(page, key, n).locator('.rub-state-badge').evaluate(
      (el) => getComputedStyle(el, '::before').content.replace(/"/g, ''),
    );

  // all 32 chips start unselected: every badge reads N
  const initial = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.rub-chip')).map(
      (chip) => getComputedStyle(chip.querySelector('.rub-state-badge')!, '::before').content.replace(/"/g, ''),
    ),
  );
  expect(initial).toHaveLength(32);
  expect(initial.every((l) => l === 'N')).toBe(true);

  // one chip through the full cycle: N -> G -> Y -> R -> N, letter follows
  // the SAME data-state the chip already carries (no new JS state logic)
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', '');
  expect(await badgeLetter(page, 'good', 3)).toBe('N');

  await tapChip(page, 'good', 3);
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', 'present');
  expect(await badgeLetter(page, 'good', 3)).toBe('G');

  await tapChip(page, 'good', 3);
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', 'partial');
  expect(await badgeLetter(page, 'good', 3)).toBe('Y');

  await tapChip(page, 'good', 3);
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', 'absent');
  expect(await badgeLetter(page, 'good', 3)).toBe('R');

  await tapChip(page, 'good', 3);
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', '');
  expect(await badgeLetter(page, 'good', 3)).toBe('N');

  // the badge sits inside the chip, left of the "+", the two never overlap
  const geo = await chipAt(page, 'good', 3).evaluate((chip) => {
    const badge = chip.querySelector('.rub-state-badge')!.getBoundingClientRect();
    const plus = (chip.nextElementSibling as HTMLElement).getBoundingClientRect();
    return { badge, plus };
  });
  expect(geo.badge.right, 'badge sits left of the +').toBeLessThanOrEqual(geo.plus.left);
  const overlaps =
    geo.badge.right > geo.plus.left &&
    geo.badge.left < geo.plus.right &&
    geo.badge.bottom > geo.plus.top &&
    geo.badge.top < geo.plus.bottom;
  expect(overlaps, 'badge and + bounding boxes must not overlap').toBe(false);
  // and on the same row/baseline as the "+" (bottom edges line up)
  expect(Math.abs(geo.badge.bottom - geo.plus.bottom)).toBeLessThan(1);
  expect(geo.badge.width).toBe(20);
  expect(geo.badge.height).toBe(20);

  // the badge is a plain child span (never a button), pointer-events:none, and
  // never eats the tap: a click at the badge's OWN coordinates still cycles
  // the chip underneath it.
  const badgeIsSpan = await chipAt(page, 'good', 5)
    .locator('.rub-state-badge')
    .evaluate((el) => el.tagName);
  expect(badgeIsSpan).toBe('SPAN');
  await chipAt(page, 'good', 5).scrollIntoViewIfNeeded();
  const badgeCentre = await chipAt(page, 'good', 5)
    .locator('.rub-state-badge')
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  await expect(chipAt(page, 'good', 5)).toHaveAttribute('data-state', '');
  await page.mouse.click(badgeCentre.x, badgeCentre.y);
  await expect(chipAt(page, 'good', 5)).toHaveAttribute('data-state', 'present');

  // the legend explains all four letters, in the same order as the words
  const legendLetters = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#rubric-legend .rub-legend-badge')).map(
      (el) => getComputedStyle(el, '::before').content.replace(/"/g, ''),
    ),
  );
  expect(legendLetters).toEqual(['N', 'G', 'Y', 'R']);

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

    await expect(page.locator('.form-footer')).toContainText(/otp-v0\.14/i);
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

  // otp-v0.11 FIX A (node 14): an open record in edit mode shows no top
  // banner any more (it only repeated the strip line above it, and its
  // appearance ~1s after the load pushed the whole grid down under the
  // coach's finger - a bigger version of the BUG-2 strip shift).
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);

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
  // CNL-001 (otp-v0.11 fix round 1): every write, including update, now
  // carries this transport flag too (plan 3.6), same treatment as action/record_token.
  expect(body.enforce_open_block).toBe('true');
  // otp-v0.14: reflection_flow rides along on every write, same treatment.
  expect(body.reflection_flow).toBe('true');
  // the submit contract, unchanged: the SAME 32 keys, plus action + record_token + enforce_open_block + reflection_flow
  const contract = Object.keys(body).filter(
    (k) => k !== 'action' && k !== 'record_token' && k !== 'enforce_open_block' && k !== 'reflection_flow',
  );
  expect(contract.sort()).toEqual(CONTRACT_KEYS);
  expect(contract).toHaveLength(32);
  expect(Object.keys(body)).toHaveLength(36);
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
    'Close Observation 1 for Test Teacher? Next Steps become final and Test Teacher is notified.',
  );

  expect(h.posts).toHaveLength(1);
  expect(h.posts[0].action).toBe('close');
  expect(h.posts[0].record_token).toBe(EDIT_TOKEN_FIXTURE);
  // CNL-001 (otp-v0.11 fix round 1): close also carries enforce_open_block now.
  expect(h.posts[0].enforce_open_block).toBe('true');
  // otp-v0.14: close also carries reflection_flow now, same treatment.
  expect(h.posts[0].reflection_flow).toBe('true');
  expect(Object.keys(h.posts[0])).toHaveLength(36);

  const banner = await bannerText(page);
  expect(banner).toMatch(dayRe('Observation 1 · closed ', '2026-09-11T09:30:00.000Z'));

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
  // otp-v0.11 FIX A: still open, still in edit mode - still no banner.
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
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
  expect(banner).toMatch(dayRe('Observation 2 · closed ', '2026-09-08T07:20:00.000Z'));
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

test('otp-v0.9/v0.11: the Next Steps echo renders when a closed lap is found (get_teacher_lap_state dead, Google prev_next_steps fallback)', async ({ page }) => {
  const h = await harness(page, { prev: PREV_NS_FOUND });
  await openForm(page);

  // hidden until a teacher is picked
  await expect(page.locator('#prev-ns-echo')).toBeHidden();

  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });

  // otp-v0.9.3 (C2): the echo is the FIRST child of #rubric-section, above its heading
  expect(
    await page.evaluate(() => document.getElementById('rubric-section')?.firstElementChild?.id),
    'prev-ns-echo is not the first child of #rubric-section (otp-v0.9.3 C2: goals-above-rubric)',
  ).toBe('prev-ns-echo');

  // otp-v0.11 R6: "Observation N Next Steps", never "Lap N"
  const echoHead = new RegExp(
    `^Observation ${PREV_NS_FOUND.lap} Next Steps · ${dayPat(PREV_NS_FOUND.observation_date)} · ${PREV_NS_FOUND.observer}$`,
  );
  await expect(page.locator('#prev-ns-echo-head')).toHaveText(echoHead);
  await expect(page.locator('#prev-ns-echo-list li')).toHaveText(PREV_NS_STEPS);
  await expect(page.locator('#prev-ns-echo-list li')).toHaveCount(3);

  // nothing fixed-position (iPad rules, hard rule 15)
  expect(await page.locator('#prev-ns-echo').evaluate((el) => getComputedStyle(el).position)).toBe('static');

  // clearing the teacher hides it again
  await page.locator('#teacher').locator('xpath=following-sibling::div[1]').locator('.clear-button').click();
  await expect(page.locator('#prev-ns-echo')).toBeHidden({ timeout: 10_000 });

  expect(h.errors).toEqual([]);
});

test('otp-v0.9/v0.11: no previous lap, a garbled answer, or the viewer build: the echo stays hidden', async ({ page }) => {
  // 1. the backend has no closed lap for this teacher
  const h = await harness(page);            // default: { success: true, found: false }
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(700);
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  expect(h.errors).toEqual([]);

  // 2. the call comes back garbled: still nothing shown, still no error UI (hard rule 12)
  const h2 = await harness(page, { prev: 'fail' });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(900);
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  expect(h2.errors).toEqual([]);

  // 3. the ungated teacher viewer never shows another teacher's history
  const src = viewerSrc();
  expect(src).toContain('body.is-viewer .prev-ns { display: none !important; }');
  const h3 = await harness(page, { prev: PREV_NS_FOUND, record: RECORD_PAYLOAD_OPEN });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  // ...and the viewer's banner carries the lap and its state
  expect(await bannerText(page)).toContain('Observation 1 · open');
  expect(h3.errors).toEqual([]);

  // 4. a row written before otp-v0.9 has no lap at all, and reads as Observation 1
  const h4 = await harness(page, { record: RECORD_PAYLOAD });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  expect(await bannerText(page)).toContain('Observation 1 · open');
  expect(h4.errors).toEqual([]);
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
    baseURL: `http://127.0.0.1:${process.env.OTP_PORT || '8123'}`,
  });
  const page = await ctx.newPage();
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, prev: PREV_NS_FOUND });
  page.on('dialog', (d) => d.accept());
  await openEdit(page);

  await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });

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
  expect(await bannerText(page)).toContain('Observation 1 · closed');

  expect(h.errors).toEqual([]);
  await ctx.close();
});

test('otp-v0.9: no console errors and no horizontal overflow in edit mode at 1280x800 and 820x1180', async ({ page }) => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(vp);
    const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, prev: PREV_NS_FOUND });
    await openEdit(page);
    await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(1);
    expect(h.errors, `console errors at ${vp.width}x${vp.height}`).toEqual([]);
  }
});

test('otp-v0.9/v0.11: a long teacher name never grows the focused control (no layout jump on blur)', async ({ page }) => {
  // Live proof 2026-09-11: with 'OTP Test Teacher (delete me)' the focused
  // teacher control was 73 px and 50 px after blur, shifting whatever sat
  // below it. otp-v0.11 removed the blue card that used to sit there
  // (#prev-ns-card); the regression this guards (the control itself must
  // not grow while focused) is unchanged, so the blur is now taken on the
  // status strip's line, which sits in a fixed position above Teacher.
  const LONG = 'OTP Test Teacher (delete me) with a deliberately very long display name';
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.unshift({ name: LONG, email: 'long.name@ais.ae' });
  const h = await harness(page, { prev: PREV_NS_FOUND, options });
  await page.setViewportSize({ width: 820, height: 1180 });   // iPad portrait: the narrow column
  await page.goto(FORM_URL);
  await passGate(page);
  await pickTomSelect(page, 'teacher', LONG);
  const control = page.locator('#teacher').locator('xpath=following-sibling::div[1]').locator('.ts-control');
  const focusedH = (await control.boundingBox())!.height;    // still focused after the pick
  const line = page.locator('#status-strip-line');
  const box = (await line.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);   // a real click: the blur happens under it
  const blurredH = (await control.boundingBox())!.height;
  expect(Math.abs(focusedH - blurredH)).toBeLessThan(2);
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
    'Save and lock this Progress in Lessons OTP form? You can still change it from the link in your confirmation email until you close the observation.',
  );
  expect(asked[0]).toContain('until you close the observation');
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
  expect(text, `#notice text does not name Observation ${RECORD_LAP7.data.lap} (otp-v0.9.3 C4)`).toContain('Observation 7');

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

  // the viewer build never shows the notice or the echo
  const h2 = await harness(page, { record: RECORD_LAP7, prev: PREV_NS_FOUND });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await expect(page.locator('#notice'), '#notice shows in the ungated viewer build (otp-v0.9.3 C4)').toBeHidden();
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

/* ===================================================================
   otp-v0.11 · the status strip + Next Steps echo (plan 2.1 / 2.3),
   driven by the new Supabase RPC get_teacher_lap_state.
   =================================================================== */

/** The AIS school year runs August to July; computed the same way the form
 *  computes it, so the "never observed" example reads correctly whenever
 *  this spec is run, not only on the day it was written. */
const schoolYearLabel = () => {
  const now = new Date();
  const y = now.getFullYear();
  const startYear = now.getMonth() >= 7 ? y : y - 1;
  return `${startYear}/${startYear + 1}`;
};

/** get_teacher_lap_state answer shapes (plan §3.2). Dates/names match the
 *  plan's own worked examples (2.1) so the on-screen text specs read
 *  verbatim where the plan gives one. */
const LAP_STATE_NEVER = {
  success: true, observation_count: 0, next_lap: 1, open_count: 0,
  open: null, predecessor: null, last_closed: null,
};

const LAP_STATE_OPEN_WITH_OWN_STEPS = {
  success: true, observation_count: 2, next_lap: 3, open_count: 1,
  open: {
    record_token: 'b2c3d4e5f60718293a4b5c6d7e8f9012',
    record_id: 'AIS-OTP-20260916-084514',
    lap: '2', observation_date: '2026-09-16', observer: 'Igor Sesar',
    submitted_at: '2026-09-16T08:45:14.000Z',
    next_step_1: 'Own step one', next_step_2: 'Own step two', next_step_3: 'Own step three',
    coach_emailed_at: '2026-09-16T08:50:00.000Z',
    teacher_emailed_at: '2026-09-16T08:51:00.000Z',
    emails_legacy: false,
  },
  predecessor: {
    lap: '1', observation_date: '2026-09-01', observer: 'Igor Sesar',
    closed_at: '2026-09-14T10:00:00.000Z',
    next_step_1: 'Predecessor step one',
    next_step_2: 'Predecessor step two',
    next_step_3: 'Predecessor step three',
  },
  last_closed: null,
};

/** Same open observation, but its own Next Steps are still blank: the echo
 *  must fall back to the predecessor's (R8). */
const LAP_STATE_OPEN_NO_OWN_STEPS = {
  ...LAP_STATE_OPEN_WITH_OWN_STEPS,
  open: {
    ...LAP_STATE_OPEN_WITH_OWN_STEPS.open,
    next_step_1: '', next_step_2: '', next_step_3: '',
  },
};

/** An open observation with blank own steps AND no predecessor: nothing at
 *  all for the echo (plan 2.3(a), reachable mid-lifecycle too). */
const LAP_STATE_OPEN_NO_PREDECESSOR = {
  ...LAP_STATE_OPEN_NO_OWN_STEPS,
  observation_count: 1, next_lap: 2, open_count: 1,
  open: { ...LAP_STATE_OPEN_NO_OWN_STEPS.open, lap: '1' },
  predecessor: null,
};

const LAP_STATE_STARTING_NEXT = {
  success: true, observation_count: 1, next_lap: 2, open_count: 0,
  open: null, predecessor: null,
  last_closed: {
    lap: '1', observation_date: '2026-09-14', observer: 'Igor Sesar',
    closed_at: '2026-09-14T10:00:00.000Z',
    next_step_1: 'Closed step one', next_step_2: 'Closed step two', next_step_3: 'Closed step three',
  },
};

/** otp-v0.14: an open reflection-flow lap, Part 1 not yet sent. */
const LAP_STATE_OPEN_REFLECTION_WAITING = {
  ...LAP_STATE_OPEN_WITH_OWN_STEPS,
  open: {
    ...LAP_STATE_OPEN_WITH_OWN_STEPS.open,
    reflection_flow: true, part1_at: null, part2_at: null,
  },
};
/** Same lap, Part 1 already sent. */
const LAP_STATE_OPEN_REFLECTION_SENT = {
  ...LAP_STATE_OPEN_WITH_OWN_STEPS,
  open: {
    ...LAP_STATE_OPEN_WITH_OWN_STEPS.open,
    reflection_flow: true, part1_at: '2026-09-17T07:00:00.000Z', part2_at: null,
  },
};

async function mockLapState(page: Page, answer: any) {
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) }),
  );
}

const stripLine = (page: Page) => page.locator('#status-strip-line');
const stripStatuses = async (page: Page) => {
  const words: string[] = [];
  for (let i = 1; i <= 6; i++) {
    words.push((await page.locator(`#strip-card-${i} .strip-status`).textContent()) || '');
  }
  return words;
};
/** otp-v0.12: the whole strip's visible text, to prove the retired word
 *  "Current" is gone everywhere, not just at the five spots the worked
 *  examples happen to name. */
const stripText = (page: Page) => page.locator('#status-strip').innerText();

test('otp-v0.11: the status strip renders the four worked examples of plan 2.1', async ({ page }) => {
  // 1. never observed this year
  let h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toHaveText(`Teacher not observed yet · ${schoolYearLabel()}`, { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Active', 'Coming soon', 'Pending', 'Pending', 'Coming soon', 'Pending']);
  expect(await stripText(page), 'otp-v0.12: "Current" is retired').not.toContain('Current');
  expect(h.errors).toEqual([]);

  // 2. open observation (Igor Sesar today): amended (Problem 2) - it auto-loads,
  // no Continue button any more.
  h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toHaveText(
    new RegExp(`^Observation 2 · open since ${dayPat('2026-09-16')} · coach Igor Sesar$`),
    { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Active', 'Coming soon', 'Pending']);
  expect(await stripText(page), 'otp-v0.12: "Current" is retired').not.toContain('Current');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => (window as any).__otpReadSource.lapState)).toBe('supabase');
  expect(h.errors).toEqual([]);

  // 3. last one closed, coach starts the next
  h = await harness(page);
  await mockLapState(page, LAP_STATE_STARTING_NEXT);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toHaveText(
    new RegExp(`^Observation 1 completed ${dayPat('2026-09-14')} · now starting Observation 2$`),
    { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Active', 'Coming soon', 'Pending', 'Pending', 'Coming soon', 'Pending']);
  expect(await stripText(page), 'otp-v0.12: "Current" is retired').not.toContain('Current');
  expect(h.errors).toEqual([]);

  // 4. straight after a successful Close Lap in this page: a direct, local
  // render (no re-fetch of get_teacher_lap_state; the mocked "open" answer
  // above never named lap 1, proving this render did not come from the RPC).
  h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openEdit(page);
  await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });
  const line4 = await stripLine(page).textContent();
  expect(line4).toMatch(dayRe('Observation 1 completed ', '2026-09-11T09:30:00.000Z'));
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Completed', 'Coming soon', 'Completed']);
  expect(await stripText(page), 'otp-v0.12: "Current" is retired').not.toContain('Current');
  expect(h.errors).toEqual([]);
});

/* ===================================================================
   otp-v0.14 T5 · the status strip / pinned bar for a reflection-flow lap
   (get_teacher_lap_state's open/last_closed now carry reflection_flow/
   part1_at/part2_at, migrate_27). A lap missing these fields (every fixture
   above) is unaffected - proven throughout this file already; these tests
   cover the NEW step 2/5 states, which must fail on the untouched otp-v0.13
   code (it has never heard of 'waiting' and always renders 'coming' here).
   =================================================================== */

test('otp-v0.14 T5: an open reflection-flow lap shows step 2 "Waiting on teacher" (never Active), step 5 Pending not "Coming soon"', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_REFLECTION_WAITING);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Waiting on teacher', 'Completed', 'Active', 'Pending', 'Pending']);
  await expect(page.locator('#strip-card-2')).toHaveClass(/\bis-waiting\b/);
  await expect(page.locator('#strip-card-2')).not.toHaveClass(/\bis-coming\b/);
  expect(await stripText(page)).not.toContain('Coming soon');
  // the pinned bar's own dot mirrors the card exactly (it reads the card's
  // own class straight off the DOM, see opBarBuildSteps).
  expect(await opBarStepStates(page)).toEqual(
    ['completed', 'waiting', 'completed', 'active', 'pending', 'pending']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5: once Part 1 lands, step 2 goes Completed - the rest of the strip is untouched', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_REFLECTION_SENT);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Completed', 'Completed', 'Active', 'Pending', 'Pending']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5: right after Save & Lock, a brand-new lap is reflection-flow - step 2 waits, step 5 is Pending not "Coming soon"', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await fillRequired(page);
  await page.locator('#btn-submit').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Waiting on teacher', 'Pending', 'Active', 'Pending', 'Pending']);
  expect(await stripText(page)).not.toContain('Coming soon');
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5: Close Lap on a reflection-flow lap whose Part 1 was already sent - step 2 stays Completed, step 5 goes "Waiting on teacher" (Part 2 cannot exist yet)', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  page.on('dialog', (d) => d.accept());
  await mockLapState(page, LAP_STATE_OPEN_REFLECTION_SENT);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Completed', 'Completed', 'Completed', 'Waiting on teacher', 'Completed']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5: Close Lap on a reflection-flow lap whose Part 1 was never sent renders step 2 "Waiting on teacher" too', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  page.on('dialog', (d) => d.accept());
  await mockLapState(page, LAP_STATE_OPEN_REFLECTION_WAITING);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Waiting on teacher', 'Completed', 'Completed', 'Waiting on teacher', 'Completed']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5: an ALREADY-CLOSED record loaded cold via ?edit= is untouched - no reflection cache to draw on, byte-identical to otp-v0.13', async ({ page }) => {
  // otp_record_by_token stays byte-identical (contract section 1): the
  // coach's own record GET never carries reflection_flow/part1_at, so this
  // path (loadClosedRecord's already-closed branch) must keep rendering
  // 'coming' regardless of what a stale/mismatched lap-state mock says.
  const h = await harness(page, { record: RECORD_PAYLOAD_CLOSED });
  await mockLapState(page, LAP_STATE_OPEN_REFLECTION_WAITING);   // deliberately irrelevant/mismatched
  await page.goto(`${FORM_URL}?edit=${EDIT_TOKEN_FIXTURE}`);
  await passGate(page);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Completed', 'Coming soon', 'Completed']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11: above Tenth, card 1 shows "Observation N" alone, no ordinal word', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, {
    ...LAP_STATE_OPEN_WITH_OWN_STEPS,
    open: { ...LAP_STATE_OPEN_WITH_OWN_STEPS.open, lap: '11' },
  });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#strip-title-1')).toHaveText('Observation 11', { timeout: 10_000 });
  await expect(page.locator('#strip-title-6')).toHaveText('Observation 11');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11: before a teacher is picked, the strip shows six grey cards and "Select a teacher"', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);
  await expect(stripLine(page)).toHaveText('Select a teacher');
  expect(await stripStatuses(page)).toEqual(['', '', '', '', '', '']);
  for (let i = 1; i <= 6; i++) {
    await expect(page.locator(`#strip-card-${i}`)).toHaveClass(/\bis-grey\b/);
  }
  expect(h.errors).toEqual([]);
});

test('otp-v0.11: get_teacher_lap_state down (500) shows the grey strip, no error UI, and Save & Lock still works', async ({ page }) => {
  const h = await harness(page);
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', (r: Route) =>
    r.fulfill({ status: 500, contentType: 'text/plain', body: 'upstream error' }));
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await fillRequired(page);
  await expect(stripLine(page)).toHaveText('Select a teacher', { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(['', '', '', '', '', '']);
  expect(await page.evaluate(() => (window as any).__otpReadSource.lapState)).toBe('none');
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await expect(page.locator('#btn-submit')).toHaveAttribute('aria-disabled', 'false');
  await page.locator('#btn-submit').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 10_000 });
  // the browser's own network log for the mocked 500 is the only line allowed
  // (same convention as the otp-v0.10 Phase 3 HTTP 500 spec).
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('otp-v0.11: a late get_teacher_lap_state answer for a previous teacher is dropped', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { options });
  let resolveFirst: () => void = () => {};
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    if (body.p_teacher === 'Test Teacher') {
      await new Promise<void>((res) => { resolveFirst = res; });
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_NEVER) });
    } else {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_STARTING_NEXT) });
    }
  });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');     // its answer stalls, released below
  await pickTomSelect(page, 'teacher', 'Second Teacher');   // resolves first
  const startingNextRe = new RegExp(
    `^Observation 1 completed ${dayPat('2026-09-14')} · now starting Observation 2$`);
  await expect(stripLine(page)).toHaveText(startingNextRe, { timeout: 10_000 });
  resolveFirst();
  await page.waitForTimeout(500);
  // the late answer for Test Teacher must not have overwritten Second Teacher's strip
  await expect(stripLine(page)).toHaveText(startingNextRe);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11: the Next Steps echo follows plan 2.3 (own steps, predecessor fallback, no predecessor, last closed)', async ({ page }) => {
  // (b) an open observation with its OWN Next Steps already saved
  let h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#prev-ns-echo-head')).toHaveText('Observation 2 Next Steps', { timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo-list li')).toHaveText(
    ['Own step one', 'Own step two', 'Own step three']);
  expect(h.errors).toEqual([]);

  // (b) an open observation whose own steps are all empty: the predecessor's,
  // labelled Observation N-1 (R8)
  h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_NO_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  const predecessorHead = new RegExp(`^Observation 1 Next Steps · ${dayPat('2026-09-01')} · Igor Sesar$`);
  await expect(page.locator('#prev-ns-echo-head')).toHaveText(predecessorHead, { timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo-list li')).toHaveText(
    ['Predecessor step one', 'Predecessor step two', 'Predecessor step three']);
  expect(h.errors).toEqual([]);

  // (a) open, own steps empty, no predecessor: nothing at all
  h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_NO_PREDECESSOR);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(700);
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  expect(h.errors).toEqual([]);

  // (c) nothing open, a completed observation exists
  h = await harness(page);
  await mockLapState(page, LAP_STATE_STARTING_NEXT);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  const lastClosedHead = new RegExp(`^Observation 1 Next Steps · ${dayPat('2026-09-14')} · Igor Sesar$`);
  await expect(page.locator('#prev-ns-echo-head')).toHaveText(lastClosedHead, { timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo-list li')).toHaveText(
    ['Closed step one', 'Closed step two', 'Closed step three']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11: the status strip is absent in the ungated teacher viewer', async ({ page }) => {
  const src = viewerSrc();
  expect(src).toContain('body.is-viewer .status-strip-section { display: none !important; }');
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await expect(page.locator('#status-strip-section')).toBeHidden();
  expect(h.errors).toEqual([]);
});

test('otp-v0.12: the status strip sits inside a titled "Observation Process" card on the gated form, hidden whole in the ungated viewer', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);
  const card = page.locator('#op-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.op-card-title')).toHaveText('Observation Process');
  // the status line and the six step cards live INSIDE the card, not beside it
  await expect(card.locator('#status-strip-section')).toBeVisible();
  await expect(card.locator('#status-strip-line')).toBeVisible();
  await expect(card.locator('#status-strip')).toBeVisible();
  for (let i = 1; i <= 6; i++) {
    await expect(card.locator(`#strip-card-${i}`)).toBeVisible();
  }
  expect(h.errors).toEqual([]);

  // the ungated teacher viewer shows none of it: no card, no title, no steps
  const src = viewerSrc();
  expect(src).toContain('body.is-viewer #op-card { display: none !important; }');
  const h2 = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await expect(page.locator('#op-card')).toBeHidden();
  expect(h2.errors).toEqual([]);
});

/** #strip-card-1's own box at each width, measured on the untouched master
 *  (HEAD 444a206, "otp-v0.12 preview 1 · branch start", before the
 *  Observation Process card wrapper existed), Chromium and WebKit:
 *  width 217.15625 / 243.984375 / 144.21875, height 125.96875(.953125) /
 *  125.96875(.953125) / 140.171875(.15625), at 744 / 834 / 1024px. Height
 *  must stay untouched by the wrapper (the strip cards' own CSS is not
 *  touched at all here); width narrows because the card adds its own
 *  left/right padding around the strip, exactly like the approved mock
 *  (process-bar-mock.html #op-card, measured the same way: 205.8125 /
 *  232.65625 / 137.75 wide, same heights). That narrower width IS the
 *  ported look, not a regression, so it is pinned here too. */
const STEP_CARD_SIZE_BY_WIDTH: { width: number; height: number; cardH: number; cardW: number }[] = [
  { width: 744, height: 1133, cardH: 125.97, cardW: 205.81 },
  { width: 834, height: 1194, cardH: 125.97, cardW: 232.66 },
  { width: 1024, height: 1366, cardH: 140.17, cardW: 137.75 },
];

test('otp-v0.12: the Observation Process card leaves each step card\'s own height untouched; width matches the card\'s own padding, exactly as the approved mock renders it', async ({ page }) => {
  for (const { width, height, cardH, cardW } of STEP_CARD_SIZE_BY_WIDTH) {
    const h = await harness(page);
    await page.setViewportSize({ width, height });
    await openForm(page);
    const box = await page.locator('#strip-card-1').boundingBox();
    expect(box, `card missing at ${width}px`).not.toBeNull();
    expect(Math.abs(box!.height - cardH), `height at ${width}px: ${box!.height}, expected ~${cardH}`)
      .toBeLessThanOrEqual(0.5);
    expect(Math.abs(box!.width - cardW), `width at ${width}px: ${box!.width}, expected ~${cardW}`)
      .toBeLessThanOrEqual(0.5);
    expect(h.errors).toEqual([]);
  }
});

test('otp-v0.11 task 7 (amended, Problem 2): no Continue button/link exists anywhere, and the open observation\'s token never appears in the DOM, even while it auto-loads', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  expect(await page.locator('#strip-continue').count(), 'the Continue element must not exist at all').toBe(0);
  const token = LAP_STATE_OPEN_WITH_OWN_STEPS.open.record_token;
  const tokenCount = () => page.evaluate(
    (t) => document.documentElement.outerHTML.split(t).length - 1, token,
  );
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  expect(await tokenCount(), 'the token must never appear in the DOM').toBe(0);

  // otp-v0.11 FIX A: an open record in edit mode shows no banner; #btn-close-lap
  // visible is the "auto-load has landed" signal instead.
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  expect(await page.locator('#strip-continue').count()).toBe(0);
  expect(await tokenCount(), 'the token must never appear in the DOM, even mid-edit').toBe(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 task 7 (2.2.2 / 2.2.7, amended): picking a teacher with an open observation loads the SAME state a matching ?edit= link would, with no page navigation', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  const startUrl = page.url();
  await page.evaluate(() => { (window as any).__navMarker = 'still here'; });
  await pickTomSelect(page, 'teacher', 'Test Teacher');

  await expect(page.locator('#btn-save-changes')).toBeVisible({ timeout: 15_000 });
  expect(page.url(), 'the auto-load must never navigate').toBe(startUrl);
  expect(await page.evaluate(() => (window as any).__navMarker)).toBe('still here');
  await expect(page.locator('#btn-close-lap')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeHidden();
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  // otp-v0.11 FIX A: no banner on either path any more; the strip line is
  // where the "same state" now shows.
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  await expect(stripLine(page)).toContainText('Observation 2 · open since', { timeout: 10_000 });

  // an ?edit= link to the same record lands on the same state. harness()'s
  // generic *.supabase.co route (registered fresh here) would otherwise win
  // over the earlier mockLapState for get_teacher_lap_state (newest route
  // wins), so it is re-applied after.
  const h2 = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openEdit(page);
  await expect(page.locator('#btn-save-changes')).toBeVisible();
  await expect(page.locator('#btn-close-lap')).toBeVisible();
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  await expect(stripLine(page)).toContainText('Observation 2 · open since', { timeout: 10_000 });
  expect(h.errors).toEqual([]);
  expect(h2.errors).toEqual([]);
});

test('otp-v0.11: the strip is fully visible with reduced motion and animations forced off', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openForm(page);
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toHaveText(
    new RegExp(`^Observation 2 · open since ${dayPat('2026-09-16')} · coach Igor Sesar$`),
    { timeout: 10_000 });
  for (let i = 1; i <= 6; i++) {
    await expect(page.locator(`#strip-card-${i}`)).toBeVisible();
  }
  expect(h.errors).toEqual([]);
});

test('otp-v0.11: the strip causes no horizontal overflow at 1440, 1024 and 820, and wraps to 3 columns under 900px', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  for (const width of [1440, 1024, 820]) {
    await page.setViewportSize({ width, height: 900 });
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(page.locator('#status-strip')).toBeVisible({ timeout: 10_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}`).toBeLessThanOrEqual(1);
    const cols = await page.evaluate(
      () => getComputedStyle(document.getElementById('status-strip')!).gridTemplateColumns.split(' ').length,
    );
    expect(cols, `column count at ${width}`).toBe(width <= 900 ? 3 : 6);
  }
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 F1: a late Next Steps fallback answer for a previous teacher never overwrites the next teacher\'s echo', async ({ page }) => {
  // B's own get_teacher_lap_state fails, so B falls into the old
  // Supabase-then-Google get_prev_next_steps path; that Supabase call is
  // held here. C is then picked and answers cleanly via the primary read,
  // and (Problem 2) auto-loads their OWN record - which must actually be
  // named for C, or its silent Teacher repopulation reads back as B and
  // spuriously restarts B's own lookup (a fixture bug, not a product one).
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const secondRecord = { ...RECORD_PAYLOAD, data: { ...RECORD_PAYLOAD.data, teacher: 'Second Teacher' } };
  const h = await harness(page, { options, record: secondRecord });
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    if (body.p_teacher === 'Test Teacher') {
      await r.fulfill({ status: 500, contentType: 'text/plain', body: 'upstream error' });
    } else {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_OPEN_WITH_OWN_STEPS) });
    }
  });
  let releaseB: () => void = () => {};
  await page.route('**/rest/v1/rpc/get_prev_next_steps', async (r: Route) => {
    const body = r.request().postDataJSON();
    expect(body.p_teacher).toBe('Test Teacher');   // only Test Teacher ever falls back here
    await new Promise<void>((res) => { releaseB = res; });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PREV_NS_FOUND) });
  });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');     // B: lap-state fails, fallback held
  await pickTomSelect(page, 'teacher', 'Second Teacher');   // C: lap-state answers directly, auto-loads
  await expect(page.locator('#prev-ns-echo-head')).toHaveText('Observation 2 Next Steps', { timeout: 10_000 });
  // let C's own auto-load fully settle before releasing B's stale answer, so
  // the two async chains never overlap.
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  releaseB();
  await page.waitForTimeout(500);
  // B's late fallback answer must not have overwritten C's echo
  await expect(page.locator('#prev-ns-echo-head')).toHaveText('Observation 2 Next Steps');
  await expect(page.locator('#prev-ns-echo-list li')).toHaveText(
    ['Own step one', 'Own step two', 'Own step three']);
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('otp-v0.11 F2: a late get_teacher_lap_state answer never redraws over a just-closed observation', async ({ page }) => {
  // enterEditMode's own refreshTeacherStatus() read is held here; Close Lap
  // is confirmed and succeeds (via the Google fallback, as the default
  // harness already does) before that held read is released, so example 4's
  // direct render must survive the late "open" answer that follows it.
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  let releaseLapState: () => void = () => {};
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    await new Promise<void>((res) => { releaseLapState = res; });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_OPEN_WITH_OWN_STEPS) });
  });
  page.on('dialog', (d) => d.accept());
  await openEdit(page);
  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });
  const justClosedRe = dayRe('Observation 1 completed ', '2026-09-11T09:30:00.000Z');
  await expect(stripLine(page)).toHaveText(justClosedRe, { timeout: 10_000 });
  releaseLapState();
  await page.waitForTimeout(500);
  // the held (stale) "open" answer must not have redrawn the strip, and must
  // never auto-load a "fresh" copy of the record we just closed
  await expect(stripLine(page)).toHaveText(justClosedRe);
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14: the footer reads otp-v0.14', async ({ page }) => {
  await harness(page);
  await openForm(page);
  await expect(
    page.locator('.form-footer'),
    'footer version was not bumped to otp-v0.14',
  ).toContainText(/otp-v0\.14/i);
  // release: the preview round label is gone from the shipped footer
  await expect(page.locator('.form-footer')).not.toContainText(/preview/i);
});

/** otp-v0.10 Phase 1: the dropdown lists and the previous-lap card are read from
 *  Supabase FIRST (anon RPCs get_form_options / get_prev_next_steps, 3 s cap);
 *  the Apps Script path is the fallback. The harness's default *.supabase.co
 *  route answers the JSON body `null`, which the form must read as a miss, so
 *  every older spec keeps exercising the Google path unchanged. A route added
 *  after harness() wins (Playwright matches the newest route first). */
const SB_OPTIONS = {
  ...OPTIONS_PAYLOAD.options,
  teachers: [{ name: 'Test Teacher' }, { name: 'Supabase Teacher' }],
  synced_at: '2026-09-16T02:30:00+00:00',
};

test('otp-v0.10: the lists come from Supabase when get_form_options answers, and Google is not asked', async ({ page }) => {
  const h = await harness(page);
  // The gate page itself prewarms ?action=options (password-template.html,
  // fire-and-forget, before the form exists); only calls made by the FORM,
  // after the gate is passed, count here.
  let armed = false;
  let googleOptionsCalls = 0;
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (armed && r.request().url().includes('action=options')) googleOptionsCalls++;
    await r.fallback();
  });
  await page.route('**/rest/v1/rpc/get_form_options', (r: Route) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SB_OPTIONS) }),
  );
  await page.goto(FORM_URL);
  await page.fill('#staticrypt-password', GATE_PASSWORD);
  armed = true;
  await page.click('#staticrypt-form .staticrypt-decrypt-button');
  await page.waitForSelector('#otp-form', { state: 'attached' });
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
  expect(await page.evaluate(() => (window as any).__otpReadSource.options)).toBe('supabase');
  const names = await page.evaluate(() =>
    Object.values((document.getElementById('teacher') as any).tomselect.options).map((o: any) => o.text),
  );
  expect(names).toEqual(['Test Teacher', 'Supabase Teacher']);
  expect(googleOptionsCalls, 'the Google options endpoint must not be called when Supabase answered').toBe(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.10: a null or failed Supabase answer falls back to the Google lists silently', async ({ page }) => {
  const h = await harness(page);          // *.supabase.co -> null
  await openForm(page);
  expect(await page.evaluate(() => (window as any).__otpReadSource.options)).toBe('google');
  const names = await page.evaluate(() =>
    Object.values((document.getElementById('teacher') as any).tomselect.options).map((o: any) => o.text),
  );
  expect(names).toEqual(['Test Teacher']);
  expect(h.errors).toEqual([]);
});

test('otp-v0.10/v0.11: the Next Steps echo comes from Supabase even when the Google read is dead (get_teacher_lap_state also dead)', async ({ page }) => {
  const h = await harness(page, { prev: 'fail' });
  await page.route('**/rest/v1/rpc/get_prev_next_steps', async (r: Route) => {
    const body = r.request().postDataJSON();
    expect(body.p_teacher).toBe('Test Teacher');
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PREV_NS_FOUND) });
  });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo')).toContainText('Observation 8');
  expect(await page.evaluate(() => (window as any).__otpReadSource.prevSteps)).toBe('supabase');
  expect(await page.evaluate(() => (window as any).__otpReadSource.lapState)).toBe('none');
  expect(h.errors).toEqual([]);
});

/** otp-v0.9.4: Safari on Mac paints an EMPTY date or time field as today's date
 *  or 12:30 PM in the field's own text colour, so an empty field looked filled.
 *  An empty one must be drawn blank (transparent text) until it is focused. */
const DATE_TIME_IDS = ['date', 'time_in', 'time_out'];
const CLEAR = 'rgba(0, 0, 0, 0)';
const textColour = (page: Page, id: string) =>
  page.locator('#' + id).evaluate((el) => getComputedStyle(el).color);

/** A real mouse click at the centre of a control, like a tap. */
async function tapCentre(page: Page, sel: string) {
  const b = (await page.locator(sel).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test('otp-v0.9.4: an empty date or time field is drawn blank, never as a fake value', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  // a fresh form: all three empty, all three drawn blank
  for (const id of DATE_TIME_IDS) {
    await expect(page.locator('#' + id)).toHaveValue('');
    await expect(page.locator('#' + id)).toHaveClass(/\bdt-empty\b/);
    expect(await textColour(page, id), `#${id} paints text while empty`).toBe(CLEAR);
  }

  // focused, its parts show so it can be typed into
  await page.locator('#time_in').focus();
  expect(await textColour(page, 'time_in')).not.toBe(CLEAR);

  // filled, each shows its value
  await page.fill('#date', '2026-09-03');
  await page.fill('#time_in', '09:15');
  await page.fill('#time_out', '10:05');
  await page.locator('#room_number').focus();
  for (const id of DATE_TIME_IDS) {
    await expect(page.locator('#' + id)).not.toHaveClass(/\bdt-empty\b/);
    expect(await textColour(page, id)).not.toBe(CLEAR);
  }

  // Reset empties them, and they are drawn blank again
  await page.locator('#btn-reset').click();
  for (const id of DATE_TIME_IDS) {
    await expect(page.locator('#' + id)).toHaveValue('');
    await expect(page.locator('#' + id)).toHaveClass(/\bdt-empty\b/);
    expect(await textColour(page, id)).toBe(CLEAR);
  }

  // a restored draft shows its date and times (never drawn blank over a value).
  // Set before any page script runs: Reset's own 220 ms autosave could otherwise
  // land between an injection and the reload and wipe the draft.
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    DRAFT_KEY,
    JSON.stringify({ date: '2026-09-03', time_in: '09:15', time_out: '10:05' }),
  ] as [string, string]);
  await openForm(page);
  await expect(page.locator('#date')).toHaveValue('2026-09-03');
  await expect(page.locator('#time_in')).toHaveValue('09:15');
  await expect(page.locator('#time_out')).toHaveValue('10:05');
  for (const id of DATE_TIME_IDS) {
    await expect(page.locator('#' + id)).not.toHaveClass(/\bdt-empty\b/);
    expect(await textColour(page, id)).not.toBe(CLEAR);
  }
  expect(h.errors).toEqual([]);
});

test('otp-v0.9.4: a tap on the grey Save & Lock names and outlines what is still empty, and never posts', async ({ page }) => {
  const h = await harness(page);
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await openForm(page);

  const submit = page.locator('#btn-submit');
  await expect(submit).toHaveAttribute('aria-disabled', 'true');
  expect(await submit.getAttribute('disabled'), 'a disabled button swallows the tap').toBeNull();
  await expect(submit).toHaveClass(/\bdisabled\b/);

  await tapCentre(page, '#btn-submit');
  await expect(page.locator('#toast')).toHaveText(
    'Still to fill: Teacher, Time In, Observer, Curriculum, Grade, Date, Subject, Time Out');
  await expect(page.locator('.needs-value')).toHaveCount(8);

  // each outline goes the moment its box is filled; an outline only comes back
  // with the next tap, so everything but Time Out leaves none until then
  await fillRequired(page);
  await page.fill('#time_out', '');
  await expect(page.locator('.needs-value')).toHaveCount(0);
  await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/, { timeout: 8_000 });
  await tapCentre(page, '#btn-submit');
  await expect(page.locator('#toast')).toHaveText('Still to fill: Time Out');
  await expect(page.locator('.needs-value')).toHaveCount(1);
  await expect(page.locator('.timeout-block.needs-value')).toHaveCount(1);

  // complete: no outline left, the button is ready
  await page.fill('#time_out', '10:05');
  await expect(page.locator('.needs-value')).toHaveCount(0);
  await expect(submit).toHaveAttribute('aria-disabled', 'false');
  await expect(submit).not.toHaveClass(/\bdisabled\b/);

  expect(dialogs, 'a grey Save & Lock must never reach the confirm step').toBe(0);
  expect(h.posts).toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.9.4/v0.11: Reset hides the Next Steps echo, and a late answer cannot bring it back', async ({ page }) => {
  const h = await harness(page, { prev: PREV_NS_FOUND });
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });
  await page.locator('#btn-reset').click();
  await expect(page.locator('#prev-ns-echo')).toBeHidden();

  // the same teacher picked again looks the lap up again
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });

  // an answer still on its way when Reset is tapped stays unseen
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().url().includes('prev_next_steps')) await new Promise((res) => setTimeout(res, 1500));
    await r.fallback();
  });
  await page.locator('#btn-reset').click();
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.locator('#btn-reset').click();
  await page.waitForTimeout(2500);
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  expect(h.errors).toEqual([]);
});

test('otp-v0.9.4/v0.11: Save & Lock stays shut while saving, and the automatic reset clears the Next Steps echo', async ({ page }) => {
  const h = await harness(page, { prev: PREV_NS_FOUND });
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await fillRequired(page);
  await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });

  // the save takes 2 s; a keystroke in the middle must not wake the button
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().method() === 'POST') await new Promise((res) => setTimeout(res, 2000));
    await r.fallback();
  });
  await tapCentre(page, '#btn-submit');
  await expect(page.locator('#btn-submit')).toHaveText(/Saving/);
  await page.locator('#room_number').fill('12B');
  await expect(page.locator('#btn-submit')).toBeDisabled();
  await tapCentre(page, '#btn-submit');

  // one record only; the automatic reset then leaves a clean form with no echo
  await expect(page.locator('#prev-ns-echo')).toBeHidden({ timeout: 10_000 });
  expect(h.posts.filter((p) => !p.action), 'a second tap mid-save posted again').toHaveLength(1);
  await expect(page.locator('#btn-submit')).toHaveAttribute('aria-disabled', 'true');
  expect(h.errors).toEqual([]);
});

test('otp-v0.9.4: a record view never takes a tap on Save & Lock, even before the record has landed', async ({ page }) => {
  const h = await harness(page);
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().method() === 'GET' && /[?&]token=/.test(r.request().url())) {
      await new Promise((res) => setTimeout(res, 3000));
    }
    await r.fallback();
  });
  await page.goto(RECORD_URL + '?token=abc');
  const submit = page.locator('#btn-submit');
  await expect(submit).toHaveAttribute('disabled', '', { timeout: 10_000 });
  await submit.dispatchEvent('click');
  await page.waitForTimeout(400);
  // the viewer's own "Loading record…" toast may show; the tap adds nothing
  await expect(page.locator('.needs-value')).toHaveCount(0);
  await expect(page.locator('#toast')).not.toContainText('Still to fill');
  expect(h.errors).toEqual([]);
});

/* ============================================================================
 * otp-v0.10 Phase 2 · Supabase-first WRITES + the Supabase draft.
 * The harness's default *.supabase.co route answers `null`, which the form
 * must read as a miss, so every older spec keeps exercising the Google path.
 * A route added after harness() wins (newest route first).
 * ========================================================================== */
const EDGE_FN = '**/functions/v1/otp-submit';

test('otp-v0.10: Save & Lock writes through the edge function first, Google gets no submit POST, the footer says "Auto saved"', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  const edgePosts: any[] = [];
  await page.route(EDGE_FN, async (r: Route) => {
    edgePosts.push(r.request().postDataJSON());
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, id: 'AIS-OTP-20260916-120000', token: edgePosts[0].record_token, status: 'observed', closed_at: '', source: 'supabase' }) });
  });
  await openForm(page);
  await expect(page.locator('#save-status .text')).toHaveText('Auto saved');
  await fillRequired(page);
  await page.fill('#next_step_1', 'Step one');
  await page.locator('#btn-submit').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect(page.locator('#submitted-meta')).toContainText('AIS-OTP-20260916-120000');
  expect(edgePosts).toHaveLength(1);
  expect(edgePosts[0].form).toBe('otp');
  expect(edgePosts[0].action).toBeUndefined();
  expect(edgePosts[0].record_token).toMatch(/^[0-9a-f]{32}$/);
  expect(edgePosts[0].teacher).toBe('Test Teacher');
  expect(edgePosts[0].next_step_1).toBe('Step one');
  expect(h.posts.filter((b) => b.form === 'otp' && !b.action), 'no submit POST may reach Google when Supabase answered').toHaveLength(0);
  expect(await page.evaluate(() => (window as any).__otpWriteSource.submit)).toBe('supabase');
  expect(h.errors).toEqual([]);
});

test('otp-v0.10: a failed edge function falls back to the Google POST with the SAME token, silently', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  const edgePosts: any[] = [];
  await page.route(EDGE_FN, async (r: Route) => {
    edgePosts.push(r.request().postDataJSON());
    await r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'write failed' }) });
  });
  await openForm(page);
  await fillRequired(page);
  await page.locator('#btn-submit').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  // a stalled or errored first try is retried once (same token), then Google
  expect(edgePosts).toHaveLength(2);
  expect(edgePosts[1].record_token).toBe(edgePosts[0].record_token);
  const google = h.posts.filter((b) => b.form === 'otp' && !b.action);
  expect(google).toHaveLength(1);
  expect(google[0].record_token).toBe(edgePosts[0].record_token);
  expect(await page.evaluate(() => (window as any).__otpWriteSource.submit)).toBe('google');
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  // the browser's own network log for the mocked 500 is the only line allowed
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('otp-v0.10: Save changes and Close Lap go through the edge function; a success:false answer takes the Google path', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  page.on('dialog', (d) => d.accept());
  const edgePosts: any[] = [];
  await page.route(EDGE_FN, async (r: Route) => {
    const body = r.request().postDataJSON();
    edgePosts.push(body);
    if (body.action === 'update') {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'AIS-OTP-TEST', token: body.record_token, status: 'observed', closed_at: '', source: 'supabase' }) });
    }
    // the close: Supabase does not hold this lap -> generic miss -> Google
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Record not found' }) });
  });
  await openEdit(page);
  await page.fill('#next_step_1', 'edited on supabase');
  await page.locator('#btn-save-changes').click();
  await expect(page.locator('#notice')).toBeVisible();
  expect(edgePosts.filter((b) => b.action === 'update')).toHaveLength(1);
  expect(edgePosts[0].record_token).toBe(EDIT_TOKEN_FIXTURE);
  expect(h.posts.filter((b) => b.action === 'update'), 'no update may reach Google when Supabase answered').toHaveLength(0);
  expect(await page.evaluate(() => (window as any).__otpWriteSource.edit)).toBe('supabase');

  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#submitted-banner')).toContainText(/closed/i, { timeout: 15_000 });
  expect(edgePosts.filter((b) => b.action === 'close')).toHaveLength(1);
  expect(h.posts.filter((b) => b.action === 'close'), 'the close fell back to Google').toHaveLength(1);
  expect(await page.evaluate(() => (window as any).__otpWriteSource.edit)).toBe('google');
  expect(h.errors).toEqual([]);
});

test('otp-v0.10: the draft is pushed to Supabase 2 s after typing, keyed by the observer; Save & Lock deletes it', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  const saves: any[] = [];
  const deletes: any[] = [];
  await page.route('**/rest/v1/rpc/save_draft', async (r: Route) => {
    saves.push(r.request().postDataJSON());
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, updated_at: '2026-09-16T12:00:00.000+00:00' }) });
  });
  await page.route('**/rest/v1/rpc/delete_draft', async (r: Route) => {
    deletes.push(r.request().postDataJSON());
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, deleted: 1 }) });
  });
  await page.route(EDGE_FN, async (r: Route) => {
    const body = r.request().postDataJSON();
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, id: 'AIS-OTP-20260916-120001', token: body.record_token, status: 'observed', closed_at: '', source: 'supabase' }) });
  });
  await openForm(page);
  await page.fill('#observer_comments', 'typed before the observer is known');
  await page.waitForTimeout(2600);
  expect(saves, 'nothing is keyed until an observer is picked').toHaveLength(0);
  await fillRequired(page);            // picks Test Observer among the rest
  await page.fill('#next_step_1', 'Step one');
  await expect.poll(() => saves.length, { timeout: 6_000 }).toBeGreaterThan(0);
  const last = saves[saves.length - 1];
  expect(last.p_form).toBe('otp');
  expect(last.p_observer).toBe('Test Observer');
  expect(last.p_data.observer_comments).toBe('typed before the observer is known');
  expect(last.p_data.teacher).toBe('Test Teacher');
  expect(typeof last.p_data.saved_at).toBe('number');
  expect(await page.evaluate(() => (window as any).__otpWriteSource.draftSave)).toBe('supabase');
  // a further keystroke re-syncs; an unchanged draft does not
  await page.waitForTimeout(2600);
  const n = saves.length;
  await page.fill('#next_step_1', 'Step one, longer');
  await expect.poll(() => saves.length, { timeout: 6_000 }).toBeGreaterThan(n);
  expect(saves[saves.length - 1].p_data.next_step_1).toBe('Step one, longer');

  await page.locator('#btn-submit').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect.poll(() => deletes.length, { timeout: 6_000 }).toBe(1);
  expect(deletes[0].p_observer).toBe('Test Observer');
  expect(await page.evaluate(() => localStorage.getItem('ais-otp-form-v1'))).toBeNull();
  expect(h.errors).toEqual([]);
});

const MAC_DRAFT = {
  teacher: 'Test Teacher', inspector: 'Test Observer', curriculum: 'Australian', grade: '3', school: 'Primary',
  subject: 'Mathematics', date: '2026-09-16', time_in: '09:15', time_out: '10:05',
  observer_comments: 'typed on the Mac', next_step_1: 'From the Mac', rubric_version: 'sp1-v2',
  sp1_outstanding: '1:present', sp1_present: 'Outstanding 1', saved_at: 1789560000000,
};

test('otp-v0.10: picking an observer pulls that observer\'s Supabase draft into an empty form, lists included', async ({ page }) => {
  const h = await harness(page);
  const loads: any[] = [];
  await page.route('**/rest/v1/rpc/load_draft', async (r: Route) => {
    loads.push(r.request().postDataJSON());
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, found: true, data: MAC_DRAFT, updated_at: '2026-09-16T12:00:00.000+00:00' }) });
  });
  await openForm(page);
  await pickTomSelect(page, 'inspector', 'Test Observer');
  await expect(page.locator('#next_step_1')).toHaveValue('From the Mac', { timeout: 6_000 });
  expect(loads[0].p_form).toBe('otp');
  expect(loads[0].p_observer).toBe('Test Observer');
  await expect(page.locator('#observer_comments')).toHaveValue('typed on the Mac');
  expect(await page.evaluate(() => (document.getElementById('teacher') as any).tomselect.getValue() !== '')).toBe(true);
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher');
  await expect(tsControl(page, 'subject')).toContainText('Mathematics');
  await expect(tsControl(page, 'grade')).toContainText('3');
  await expect(page.locator('#school')).toHaveValue('Primary');
  await expect(chipAt(page, 'outstanding', 1)).toHaveAttribute('data-state', 'present');
  await expect(page.locator('#btn-submit')).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__otpWriteSource.draftLoad)).toBe('supabase');
  expect(h.errors).toEqual([]);
});

test('otp-v0.10: a local draft with content newer than the Supabase copy is kept', async ({ page }) => {
  const h = await harness(page);
  await page.route('**/rest/v1/rpc/load_draft', async (r: Route) => {
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, found: true, data: MAC_DRAFT, updated_at: '2026-09-16T12:00:00.000+00:00' }) });
  });
  await page.goto(FORM_URL);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
    inspector: 'Test Observer', next_step_1: 'typed here, later', rubric_version: 'sp1-v2', saved_at: Date.now(),
  })), DRAFT_KEY);
  await passGate(page);
  await expect(tsControl(page, 'inspector')).toContainText('Test Observer');
  await page.waitForTimeout(1500);
  await expect(page.locator('#next_step_1')).toHaveValue('typed here, later');
  await expect(page.locator('#observer_comments')).toHaveValue('');
  expect(await page.evaluate(() => (window as any).__otpWriteSource.draftLoad)).not.toBe('supabase');
  expect(h.errors).toEqual([]);
});

/* ============================================================================
 * otp-v0.10 Phase 3 · record links read through the Supabase edge function.
 * loadClosedRecord asks otp-record first (one GET, 3 s cap, no key) and only
 * falls back to the Apps Script token GET; the key-free viewer build no longer
 * loads the option lists at all, so the record itself is what lifts the
 * 'Preparing form' overlay. The harness's default *.supabase.co route answers
 * `null`, which is not success:true, so every older spec keeps exercising the
 * Google path. A route added after harness() wins (newest route first).
 * ========================================================================== */
const EDGE_RECORD_FN = /\/functions\/v1\/otp-record/;

/** What the otp-record edge function answers for a fixture record. */
const edgeRecord = (payload: any = RECORD_PAYLOAD) => ({
  success: true,
  data: payload.data,
  ...(payload.pad_files && payload.pad_files.length ? { pad_files: payload.pad_files } : {}),
  form: 'otp',
  source: 'supabase',
});

/** The ONE answer every miss gets, from either backend (hard rule 10). */
const EDGE_MISS = { success: false, error: 'Record not found' };

/** Route otp-record; the returned array collects every URL it was called with. */
async function routeEdgeRecord(page: Page, handler: (r: Route) => Promise<void> | void) {
  const urls: string[] = [];
  await page.route(EDGE_RECORD_FN, async (r: Route) => {
    urls.push(r.request().url());
    await handler(r);
  });
  return urls;
}

/** Count every Apps Script request while the harness still serves them. */
async function countGoogle(page: Page) {
  const urls: string[] = [];
  await page.route('**/script.google.com/**', async (r: Route) => {
    urls.push(r.request().url());
    await r.fallback();
  });
  return urls;
}

const recordSource = (page: Page) =>
  page.evaluate(() => (window as any).__otpReadSource.record);

/** otp-v0.11 fix round 3, Part 2C: after any superseded or failed transition
 *  the page must be in exactly one of two consistent states, never a mix:
 *  blank form (EDIT_MODE false, no is-editing, normal buttons) or record
 *  loaded (EDIT_MODE true, EDIT_RECORD set, edit buttons). Call at the end
 *  of every race spec (CNL-006, 007, 009, 011, 013 and the sweep specs). */
async function expectConsistentFormState(page: Page) {
  const mode = await page.evaluate(() => (window as any).__otpFormMode());
  expect(mode.editMode).toBe(mode.isEditingClass);
  expect(mode.editMode).toBe(mode.hasEditRecord);
  if (mode.editMode) {
    await expect(page.locator('#btn-save-changes')).toBeVisible();
    await expect(page.locator('#btn-close-lap')).toBeVisible();
  } else {
    await expect(page.locator('#btn-save-changes')).toBeHidden();
    await expect(page.locator('#btn-close-lap')).toBeHidden();
  }
}

/** Tom Select's own disabled state for the three searchables. */
const searchablesDisabled = (page: Page) =>
  page.evaluate(() =>
    ['teacher', 'inspector', 'subject'].map(
      (id) => !!(document.getElementById(id) as any).tomselect.isDisabled,
    ),
  );

/** Every option key each searchable holds. Empty until applyDropdownOptions
 *  has run; the opaque t0 / i0 / s0 keys are its fingerprint (hard rule 11). */
const optionKeys = (page: Page) =>
  page.evaluate(() =>
    ['teacher', 'inspector', 'subject'].map((id) =>
      Object.keys((document.getElementById(id) as any).tomselect.options).sort(),
    ),
  );

/** An observer's half-written observation, already on this device when a
 *  record link is opened. Nothing about it may show, and nothing may rewrite
 *  it (hard rule 13). Deliberately different from RECORD_HEADER in every field. */
const DRAFT_SYNC_KEY = `${DRAFT_KEY}:sync`;
const SEEDED_DRAFT_JSON = JSON.stringify({
  teacher: 'Draft Teacher', inspector: 'Draft Observer', subject: 'Science',
  curriculum: 'MoE', grade: '9', school: 'Secondary',
  date: '2026-01-31', time_in: '08:00', time_out: '08:45', room_number: 'DRAFT-ROOM',
  observer_comments: 'DRAFT observer comments, must never show on a record',
  next_step_1: 'DRAFT next step one',
  rubric_version: 'sp1-v2', sp1_outstanding: '1:present', saved_at: 1789560000000,
});
const SEEDED_SYNC_JSON = JSON.stringify({
  observer: 'Draft Observer', updated_at: '2026-09-17T06:00:00.000+00:00', fp: 'seeded',
});

/** A real 1x1 JPEG, so a pad page opens without a broken image. */
const ONE_PX_JPEG =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

test('otp-v0.10 Phase 3: the viewer renders a Supabase record with every Apps Script call dead, and asks Google for nothing', async ({ page }) => {
  const h = await harness(page);
  // every Apps Script request, options included, hangs for ever: the viewer
  // must never need one. Nothing pends, because nothing is ever issued.
  const google: string[] = [];
  await page.route('**/script.google.com/**', (r: Route) => {
    google.push(r.request().url());
  });
  const edge = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord()) }),
  );

  await page.goto(`${RECORD_URL}?token=${EDIT_TOKEN_FIXTURE}`);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 10_000 });
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/);
  expect(edge).toHaveLength(1);
  expect(edge[0]).toContain(`token=${EDIT_TOKEN_FIXTURE}`);
  expect(await recordSource(page)).toBe('supabase');

  // the three searchables carry the record's own text, under an opaque key
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher');
  await expect(tsControl(page, 'inspector')).toContainText('Test Observer');
  await expect(tsControl(page, 'subject')).toContainText('Mathematics');
  await expect(page.locator('#teacher')).toHaveValue('r0');
  await expect(page.locator('#inspector')).toHaveValue('r0');
  await expect(page.locator('#subject')).toHaveValue('r0');
  await expect(gradeControl(page)).toContainText('3');
  await expect(page.locator('#grade')).toHaveValue('3');
  // the Curriculum pill is drawn from the record, and pressed
  await expect(page.locator('#curriculum-pills .pill')).toHaveCount(1);
  await expect(page.locator('#curriculum-pills .pill')).toHaveText('Australian');
  await expect(page.locator('#curriculum-pills .pill')).toHaveClass(/is-selected/);
  await expect(page.locator('#curriculum')).toHaveValue('Australian');
  // and the record's own text
  await expect(page.locator('#date')).toHaveValue('2026-09-03');
  await expect(page.locator('#time_in')).toHaveValue('09:15');
  await expect(page.locator('#time_out')).toHaveValue('10:05');
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  await expect(page.locator('#next_step_3')).toHaveValue('Record next step three');
  await expect(chipAt(page, 'good', 3)).toHaveAttribute('data-state', 'partial');
  expect(await searchablesDisabled(page)).toEqual([true, true, true]);
  expect(google, 'the viewer asked Apps Script for something').toEqual([]);

  // an OPEN record reads the same way in the viewer: still no Apps Script call
  const edgeOpen = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_OPEN)) }),
  );
  await page.goto(`${RECORD_URL}?token=${EDIT_TOKEN_FIXTURE}`);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 10_000 });
  expect(await bannerText(page)).toContain('Observation 1 · open');
  expect(edgeOpen).toHaveLength(1);
  expect(await recordSource(page)).toBe('supabase');
  expect(google, 'an open record made the viewer ask Apps Script').toEqual([]);
  expect(h.errors).toEqual([]);
});

test('otp-v0.10 Phase 3: a Supabase miss is not final, and a Google miss still lands on the calm card', async ({ page }) => {
  const h = await harness(page, { record: { success: false, error: 'Record not found' } });
  const google = await countGoogle(page);
  const edge = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EDGE_MISS) }),
  );

  await page.goto(`${RECORD_URL}?token=${EDIT_TOKEN_FIXTURE}`);
  const card = page.locator('#form-loading .form-loading-card');
  await expect(card).toContainText(
    'This link is not valid or has expired. Ask your observer for a new link.',
    { timeout: 15_000 },
  );
  expect(edge).toHaveLength(1);
  // the Sheet can still hold a row Supabase lacks, so Google IS asked
  expect(google.filter((u) => /[?&]token=/.test(u))).toHaveLength(1);
  expect(await recordSource(page)).toBe('google');
  await expect(page.locator('#form-loading')).not.toHaveClass(/is-hidden/);
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.10 Phase 3: a stalled edge function, and an HTTP 500, both fall to the Google record with no error UI', async ({ page }) => {
  // 1. the stall: no answer inside the 3 s cap
  const h = await harness(page);
  const google = await countGoogle(page);
  const edge = await routeEdgeRecord(page, async (r) => {
    await new Promise((res) => setTimeout(res, 4500));
    try { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord()) }); }
    catch { /* the page gave up on it at 3 s, as it must */ }
  });
  await page.goto(`${RECORD_URL}?token=${EDIT_TOKEN_FIXTURE}`);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/);
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  expect(edge).toHaveLength(1);
  expect(google.filter((u) => /[?&]token=/.test(u))).toHaveLength(1);
  expect(await recordSource(page)).toBe('google');
  await expect(page.locator('#toast')).not.toHaveClass(/error/);

  // 2. the HTTP 500
  const h2 = await harness(page);
  const google2 = await countGoogle(page);
  const edge2 = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'boom' }) }),
  );
  await page.goto(`${RECORD_URL}?token=${EDIT_TOKEN_FIXTURE}`);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  expect(edge2).toHaveLength(1);
  expect(google2.filter((u) => /[?&]token=/.test(u))).toHaveLength(1);
  expect(await recordSource(page)).toBe('google');
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  // the browser's own network log for the mocked 500 is the only line allowed
  // (the 3 s abort itself logs nothing); both harnesses listen to the one page,
  // so both see it.
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
  expect(h2.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('otp-v0.10 Phase 3: ?edit= served by the edge function unlocks exactly as the Google read does', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  const google = await countGoogle(page);
  const edge = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_OPEN)) }),
  );

  await openEdit(page);
  expect(edge).toHaveLength(1);
  expect(edge[0]).toContain(`token=${EDIT_TOKEN_FIXTURE}`);
  expect(await recordSource(page)).toBe('supabase');
  expect(google.filter((u) => /[?&]token=/.test(u)),
    'no record GET may reach Apps Script when Supabase answered').toHaveLength(0);

  // otp-v0.11 FIX A: an open record in edit mode shows no banner any more.
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#next_step_1')).toBeEnabled();
  await expect(page.locator('#teacher')).toHaveValue('t0');   // the gated form still loads its lists
  await expect(tsControl(page, 'inspector')).toContainText('Test Observer');
  await expect(page.locator('#btn-save-changes')).toBeEnabled();
  await expect(page.locator('#btn-close-lap')).toBeEnabled();
  expect(h.errors).toEqual([]);
});

test('otp-v0.10 Phase 3: pad_files from the edge function raise the paperclips', async ({ page }) => {
  const withPads = {
    ...RECORD_PAYLOAD,
    pad_files: ['observer-comments-1.jpg', 'sp1-great-5-note.jpg'],
  };
  const h = await harness(page);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord(withPads)) }),
  );

  await page.goto(`${RECORD_URL}?token=${EDIT_TOKEN_FIXTURE}`);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 10_000 });
  await expect(page.locator('.pad-attach[data-pad-target="observer_comments"]')).toBeVisible();
  await tapNoteBtn(page, 'great', 5);
  await expectPop(page, 'open');
  await expect(notePop(page).locator('.pad-attach[data-pad-target="sp1_great_5_note"]')).toBeVisible();
  await page.locator('.rub-note-done').click();
  // nothing else grew a paperclip
  await expect(page.locator('.pad-attach[data-pad-target="next_step_1"]')).toBeHidden();
  expect(await recordSource(page)).toBe('supabase');
  expect(h.errors).toEqual([]);
});

test('otp-v0.10 Phase 3: the built viewer carries the otp-record URL and no Supabase key', async () => {
  const src = viewerSrc();
  // hard rule 14: the publishable key can read every teacher name and rating
  expect(src).not.toContain('sb_publishable');
  expect(src).toContain("const SB_KEY = '';");
  expect(src).toContain("const SB_URL = '';");
  // ...but the keyless record endpoint must survive encrypt.sh's blanking
  expect(src).toContain("const SB_FN_RECORD = 'https://rfbetrcevtmisknndpgg.supabase.co/functions/v1/otp-record';");
});

test('otp-v0.10 Phase 3: a record view pulls no draft, pushes no draft and leaves a REAL draft byte-identical', async ({ page }) => {
  // hard rule 13, both directions: an observer's half-written observation is
  // sitting on this device (the viewer and the gated form share one origin),
  // and opening a record link must neither overwrite it nor show any of it.
  const h = await harness(page);
  const drafts: string[] = [];
  await page.route('**/rest/v1/rpc/save_draft', (r: Route) => { drafts.push('save'); return r.abort(); });
  await page.route('**/rest/v1/rpc/load_draft', (r: Route) => { drafts.push('load'); return r.abort(); });
  await page.route('**/rest/v1/rpc/delete_draft', (r: Route) => { drafts.push('delete'); return r.abort(); });
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord()) }),
  );
  // seeded BEFORE any page script runs, on every navigation in this test
  await page.addInitScript(
    ([k, s, draft, sync]) => {
      try {
        localStorage.setItem(k as string, draft as string);
        localStorage.setItem(s as string, sync as string);
      } catch { /* opaque origin (about:blank): nothing to seed */ }
    },
    [DRAFT_KEY, DRAFT_SYNC_KEY, SEEDED_DRAFT_JSON, SEEDED_SYNC_JSON] as [string, string, string, string],
  );

  const storedDraft = () =>
    page.evaluate(([k, s]) => [localStorage.getItem(k), localStorage.getItem(s)], [DRAFT_KEY, DRAFT_SYNC_KEY] as [string, string]);

  for (const [what, open] of [
    ['the ungated viewer', async () => { await page.goto(`${RECORD_URL}?token=${EDIT_TOKEN_FIXTURE}`); }],
    ['the gated locked ?token= view', async () => { await page.goto(`${FORM_URL}?token=${EDIT_TOKEN_FIXTURE}`); await passGate(page); }],
  ] as [string, () => Promise<void>][]) {
    await open();
    await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
    await page.waitForTimeout(2600);   // past the 2 s draft-sync debounce

    // 1. the record is what shows, never the draft underneath it
    await expect(page.locator('#room_number'), what).toHaveValue('12B');
    await expect(page.locator('#date'), what).toHaveValue('2026-09-03');
    await expect(page.locator('#time_in'), what).toHaveValue('09:15');
    await expect(page.locator('#observer_comments'), what).toHaveValue('Record observer comments');
    await expect(page.locator('#next_step_1'), what).toHaveValue('Record next step one');
    await expect(page.locator('#school'), what).toHaveValue('Primary');
    await expect(tsControl(page, 'teacher'), what).toContainText('Test Teacher');
    await expect(tsControl(page, 'teacher'), what).not.toContainText('Draft Teacher');
    await expect(tsControl(page, 'inspector'), what).toContainText('Test Observer');
    await expect(gradeControl(page), what).toContainText('3');
    // the draft's own chip must not light up on the record's rubric
    await expect(chipAt(page, 'outstanding', 1), what).toHaveAttribute('data-state', '');

    // 2. nothing was written back, to either key, not one byte
    expect(await storedDraft(), `${what} rewrote the local draft`).toEqual([SEEDED_DRAFT_JSON, SEEDED_SYNC_JSON]);
    // 3. and the Supabase draft was never touched either
    expect(drafts, `${what} called a draft RPC`).toEqual([]);
  }
  expect(h.errors).toEqual([]);
});

/** Hold the Apps Script option lists until the TEST releases them, so the
 *  "lists arrive after lockForm" race is identical on every machine instead of
 *  a sleep a slow gate could outrun. `landed` resolves with the real options
 *  response, so a test waits for the landing rather than guessing at it. */
async function holdOptions(page: Page, seen?: string[]) {
  let release = () => {};
  const gate = new Promise<void>((res) => { release = res; });
  await page.route('**/script.google.com/**', async (r: Route) => {
    const url = r.request().url();
    if (seen) seen.push(url);
    if (url.includes('action=options')) await gate;
    try { await r.fallback(); } catch { /* the page gave up on it first */ }
  });
  return { landed: page.waitForResponse((r) => r.url().includes('action=options'), { timeout: 20_000 }), release: () => release() };
}

/** applyDropdownOptions has demonstrably run: its curriculum pills are drawn
 *  and the three searchables hold the opaque keys it builds. */
async function expectListsApplied(page: Page) {
  await expect(page.locator('#curriculum-pills .pill')).toHaveCount(2, { timeout: 15_000 });
  expect(await optionKeys(page), 'the option lists never reached the searchables')
    .toEqual([['t0'], ['i0'], ['s0', 's1']]);
}

test('otp-v0.10 Phase 3: on a locked ?token= view the lists may land after the record, and nothing unlocks', async ({ page }) => {
  const h = await harness(page);
  const google: string[] = [];
  const options = await holdOptions(page, google);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord()) }),
  );

  await page.goto(`${FORM_URL}?token=${EDIT_TOKEN_FIXTURE}`);
  await passGate(page);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/);
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  // the record rendered on its own: the lists are still held at this point
  expect(await optionKeys(page), 'the lists landed before the record, so the race is untested')
    .toEqual([[], [], []]);

  // now let them land, and prove they were actually applied
  options.release();
  await options.landed;
  await expectListsApplied(page);
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher');
  await expect(tsControl(page, 'subject')).toContainText('Mathematics');
  // ...and a locked record is still locked
  expect(await searchablesDisabled(page)).toEqual([true, true, true]);
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/);
  expect(await recordSource(page)).toBe('supabase');
  expect(google.filter((u) => /[?&]token=/.test(u)),
    'no record GET may reach Apps Script when Supabase answered').toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.10 Phase 3: ?edit= of a CLOSED lap stays locked when the lists land after the record', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_CLOSED });
  const options = await holdOptions(page);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_CLOSED)) }),
  );

  await page.goto(`${FORM_URL}?edit=${EDIT_TOKEN_FIXTURE}`);
  await passGate(page);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/);
  // the closed lap locked on its own, before any list arrived
  expect(await optionKeys(page), 'the lists landed before the record, so the race is untested')
    .toEqual([[], [], []]);

  options.release();
  await options.landed;
  await expectListsApplied(page);
  expect(await searchablesDisabled(page)).toEqual([true, true, true]);
  await expect(page.locator('#btn-save-changes')).toBeDisabled();
  await expect(page.locator('#btn-close-lap')).toBeDisabled();
  expect(await recordSource(page)).toBe('supabase');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 F3/REV-003: an ?edit= of an ALREADY-CLOSED record renders ITS OWN closed state, never the teacher-history lookup', async ({ page }) => {
  // Reverse of the race just above: here the LISTS win, and the record (the
  // only thing that ever names the teacher) is held back.
  // REV-003 (otp-v0.11 final inspection round 1): before this fix, the
  // lockForm() branch fell back to refreshTeacherStatus(), which reads the
  // TEACHER's current coaching state via get_teacher_lap_state - mocked below
  // to a DIFFERENT, unrelated answer ("last one closed, now starting
  // Observation 2") that contradicted the actual closed record on screen.
  // Plan 2.1: "a closed observation always shows cards 1, 3, 4, 6 Completed"
  // for ITS OWN lap. The fix renders the loaded record's own state directly
  // (the same helper Close Lap uses) and never asks get_teacher_lap_state for
  // a closed-record view at all.
  const h = await harness(page, { record: RECORD_PAYLOAD_CLOSED });
  let releaseRecord: () => void = () => {};
  const edge = await routeEdgeRecord(page, async (r) => {
    await new Promise<void>((res) => { releaseRecord = res; });
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_CLOSED)) });
  });
  let lapStateCalls = 0;
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    lapStateCalls++;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_STARTING_NEXT) });
  });

  await page.goto(`${FORM_URL}?edit=${EDIT_TOKEN_FIXTURE}`);
  await passGate(page);              // resolves once the option lists land
  // proves the lists really did land first (Subject stays school-guarded:
  // no grade is known yet, since the record itself is still held, so
  // expectListsApplied's grade-derived subject list does not apply here).
  await expect(page.locator('#curriculum-pills .pill')).toHaveCount(2, { timeout: 15_000 });
  expect((await optionKeys(page)).slice(0, 2)).toEqual([['t0'], ['i0']]);
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);

  releaseRecord();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  // the closed-record contract (plan 2.1): THIS record's own lap and date...
  const stripLineRe = dayRe('Observation 2 completed ', RECORD_PAYLOAD_CLOSED.data.closed_at);
  await expect(page.locator('#status-strip-line')).toHaveText(stripLineRe, { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Completed', 'Coming soon', 'Completed']);
  // ...never the teacher-history lookup's contradictory "now starting" picture
  expect(lapStateCalls, 'a closed-record view must never ask get_teacher_lap_state').toBe(0);
  expect(edge).toHaveLength(1);
  expect(h.errors).toEqual([]);
});

test('otp-v0.10 Phase 3: an uppercase token skips Supabase and reaches Google unchanged, pad image included', async ({ page }) => {
  const UPPER = EDIT_TOKEN_FIXTURE.toUpperCase();
  const h = await harness(page, { record: { ...RECORD_PAYLOAD, pad_files: ['observer-comments-1.jpg'] } });
  const padImages: string[] = [];
  await page.route('**/script.google.com/**', async (r: Route) => {
    const url = r.request().url();
    if (url.includes('action=pad_image')) {
      padImages.push(url);
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, mime: 'image/jpeg', data: ONE_PX_JPEG }) });
    }
    await r.fallback();
  });
  const google = await countGoogle(page);
  const edge = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord()) }),
  );

  await page.goto(`${RECORD_URL}?token=${UPPER}`);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  // only the canonical lowercase 32-hex form is a token (hard rule 10)
  expect(edge, 'an uppercase token must never reach the edge function').toEqual([]);
  expect(await recordSource(page)).toBe('google');
  const recordGets = google.filter((u) => /[?&]token=/.test(u) && !u.includes('action=pad_image'));
  expect(recordGets).toHaveLength(1);
  expect(recordGets[0]).toContain(`token=${UPPER}`);

  // the pad image rides the SAME unchanged token
  await page.locator('.pad-attach[data-pad-target="observer_comments"]').click();
  await expect.poll(() => padImages.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(padImages[0]).toContain(`token=${UPPER}`);
  expect(padImages[0]).toContain('name=observer-comments-1.jpg');
  expect(h.errors).toEqual([]);
});

/* ============================================================================
 * otp-v0.14 T5 · the teacher viewer's OWN ?t= route (contract section 5).
 * Never the Apps Script GET, never `token`; Supabase is the only source, so
 * a stall retries silently forever and a parsed miss/reflection_needed is
 * final. These must fail on the untouched otp-v0.13 code (?t= was not a
 * recognised param at all before this task; the page fell to VIEWER_LANDING).
 * ========================================================================== */
const TEACHER_TOKEN_FIXTURE = 'aa11bb22cc33dd44ee55ff6600112233';

/** What the otp-record edge function's TEACHER branch answers. */
const teacherEdgeAnswer = (payload: any = RECORD_PAYLOAD_OPEN, padUrls?: { name: string; url: string }[]) => ({
  success: true,
  data: payload.data,
  form: 'otp',
  source: 'supabase',
  teacher_view: true,
  ...(padUrls && padUrls.length ? { pad_urls: padUrls } : {}),
});

test('otp-v0.14 T5 viewer: ?t= success renders the record read-only, calling the edge function with t= and never token=, never Google', async ({ page }) => {
  const h = await harness(page);
  const google = await countGoogle(page);
  const urls = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teacherEdgeAnswer()) }),
  );

  await page.goto(RECORD_URL + '?t=' + TEACHER_TOKEN_FIXTURE);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect(page.locator('#next_step_3')).toHaveValue('Record next step three');

  expect(urls.length).toBeGreaterThan(0);
  expect(urls.every((u) => u.includes('t=' + TEACHER_TOKEN_FIXTURE))).toBe(true);
  expect(urls.some((u) => u.includes('token='))).toBe(false);
  expect(google).toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5 viewer: ?t= reflection_needed shows the calm "answer first" card with a working Reflect button', async ({ page }) => {
  const h = await harness(page);
  const google = await countGoogle(page);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'reflection_needed' }) }),
  );

  await page.goto(RECORD_URL + '?t=' + TEACHER_TOKEN_FIXTURE);
  const card = page.locator('#form-loading .form-loading-card');
  await expect(card).toContainText(
    'Please answer three short questions about your lesson first.', { timeout: 15_000 },
  );
  const btn = page.locator('#btn-reflect-needed');
  await expect(btn).toHaveText('Reflect on your lesson');
  await expect(btn).toHaveAttribute('href', 'otp-reflect.html?t=' + TEACHER_TOKEN_FIXTURE);
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  expect(google).toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5 viewer: ?t= a miss shows the SAME calm landing card as a bad ?token= link', async ({ page }) => {
  const h = await harness(page);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EDGE_MISS) }),
  );

  await page.goto(RECORD_URL + '?t=' + TEACHER_TOKEN_FIXTURE);
  const card = page.locator('#form-loading .form-loading-card');
  await expect(card).toContainText(
    'This link is not valid or has expired. Ask your observer for a new link.', { timeout: 15_000 },
  );
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5 viewer: a non-canonical ?t= shows the calm landing card, no network call at all', async ({ page }) => {
  const h = await harness(page);
  const urls = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teacherEdgeAnswer()) }),
  );

  await page.goto(RECORD_URL + '?t=not-hex-at-all');
  const card = page.locator('#form-loading .form-loading-card');
  await expect(card).toContainText('This link is not valid or has expired.', { timeout: 15_000 });
  expect(urls).toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.14 T5 viewer: ?t= retries silently through a stall/500 before answering, no error UI, never falls to Google', async ({ page }) => {
  const h = await harness(page);
  const google = await countGoogle(page);
  let attempt = 0;
  await routeEdgeRecord(page, async (r) => {
    attempt++;
    if (attempt < 3) { await r.fulfill({ status: 500, contentType: 'text/plain', body: 'upstream error' }); return; }
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teacherEdgeAnswer()) });
  });

  await page.goto(RECORD_URL + '?t=' + TEACHER_TOKEN_FIXTURE);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  expect(attempt).toBeGreaterThanOrEqual(3);
  expect(google).toHaveLength(0);
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('otp-v0.14 T5 viewer: ?t= pad pages come from pad_urls (signed URLs), never the token-gated Apps Script route', async ({ page }) => {
  const h = await harness(page);
  const google = await countGoogle(page);
  const signedUrl = 'https://rfbetrcevtmisknndpgg.supabase.co/storage/v1/object/sign/evidence-pads/teacher-pad-1/observer-comments-1.jpg?token=signed-abc';
  // a regex, not the plain string: Playwright's glob route matcher treats a
  // bare `?` as a single-char wildcard, which the signed URL's own query
  // string would trip.
  await page.route(new RegExp(signedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), (r: Route) =>
    r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from(ONE_PX_JPEG, 'base64') }),
  );
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(teacherEdgeAnswer(RECORD_PAYLOAD_OPEN, [{ name: 'observer-comments-1.jpg', url: signedUrl }])) }),
  );

  await page.goto(RECORD_URL + '?t=' + TEACHER_TOKEN_FIXTURE);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect(page.locator('.pad-attach[data-pad-target="observer_comments"]')).toBeVisible();

  await page.locator('.pad-attach[data-pad-target="observer_comments"]').click();
  await expect(page.locator('#pad-view-scroll img')).toHaveAttribute('src', signedUrl, { timeout: 15_000 });
  expect(google.filter((u) => u.includes('action=pad_image'))).toHaveLength(0);
  expect(h.errors).toEqual([]);
});

/* ============================================================================
 * otp-v0.11 task 7 · Part A (STRIP-001..003, the three open findings of task 5)
 * ========================================================================== */

test('otp-v0.11 STRIP-001: switching teacher while a fetch is pending shows no stale line, cards or leaked token', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { options });
  let resolveB: () => void = () => {};
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    if (body.p_teacher === 'Test Teacher') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_OPEN_WITH_OWN_STEPS) });
    }
    await new Promise<void>((res) => { resolveB = res; });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_NEVER) });
  });
  const token = LAP_STATE_OPEN_WITH_OWN_STEPS.open.record_token;
  // A's own auto-load record fetch never lands in this test (amended for
  // Problem 2: A's answer is no longer held back behind a Continue tap, so
  // its record fetch is held instead, keeping A mid-load exactly as A's
  // un-clicked Continue button used to) - the point under test is B's own
  // pick clearing the strip at once, not A's eventual load.
  await page.route('**/script.google.com/**', async (r: Route) => {
    const url = r.request().url();
    if (r.request().method() === 'GET' && url.includes(`token=${token}`)) {
      await new Promise(() => {});   // never resolves
    }
    await r.fallback();
  });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('body')).toHaveClass(/is-editing/, { timeout: 10_000 });   // A's auto-load started

  await pickTomSelect(page, 'teacher', 'Second Teacher');   // B's answer stalls, released below
  // during the pending request: no previous line, no previous statuses, no
  // stray token in the DOM
  await expect(stripLine(page)).toHaveText('Select a teacher');
  expect(await stripStatuses(page)).toEqual(['', '', '', '', '', '']);
  const tokenCount = await page.evaluate(
    (t) => document.documentElement.outerHTML.split(t).length - 1, token,
  );
  expect(tokenCount, 'A\'s token must not be in the DOM while B is pending').toBe(0);

  resolveB();
  await page.waitForTimeout(300);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 STRIP-002: right after Save & Lock, the strip shows the observation now open (cards 1 and 4) for the whole locked interval', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await mockLapState(page, LAP_STATE_STARTING_NEXT);   // this teacher's next_lap is 2
  await openForm(page);
  await fillRequired(page);
  await expect(stripLine(page)).toContainText('now starting Observation 2', { timeout: 10_000 });
  // the Google fallback answers with no lap at all; STRIP-002 must still name
  // the right one from the cached get_teacher_lap_state read above.
  await page.route(EDGE_FN, (r: Route) =>
    r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'write failed' }) }));
  await page.locator('#btn-submit').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  const statuses = await stripStatuses(page);
  expect(statuses[0], 'card 1 Completed').toBe('Completed');
  expect(statuses[3], 'card 4 Active').toBe('Active');
  expect(await stripText(page), 'otp-v0.12: "Current" is retired').not.toContain('Current');
  await expect(stripLine(page)).toContainText('Observation 2 · open since');
  await page.waitForTimeout(1500);   // still well inside the 3 s locked interval
  const statusesLater = await stripStatuses(page);
  expect(statusesLater[0]).toBe('Completed');
  expect(statusesLater[3]).toBe('Active');
  expect(await stripText(page), 'otp-v0.12: "Current" is retired').not.toContain('Current');
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test.describe('otp-v0.11 STRIP-003: date-only values read as their own calendar day, never the day before', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('a west-of-UTC browser shows the correct day, spelled "Sep" not "Sept"', async ({ page }) => {
    const h = await harness(page);
    await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);   // open.observation_date = '2026-09-16'
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).toContainText('16 Sep 2026', { timeout: 10_000 });
    expect(h.errors).toEqual([]);
  });
});

/* ============================================================================
 * otp-v0.11 task 7 · Part B (plan 2.2, continue and close with no reload) and
 * Part C (plan 3.6, definitive answers)
 * ========================================================================== */

test('otp-v0.11 plan 2.2 point 1 (amended, Problem 2): a teacher with an open observation auto-loads worked example 2, no button to tap', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('Observation 2 · open since', { timeout: 10_000 });
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 2 (amended): the auto-load fills the form exactly as ?edit= does and swaps the bottom buttons', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  // otp-v0.11 FIX A: an open record in edit mode shows no banner any more.
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  await expect(page.locator('#btn-reset')).toBeHidden();
  await expect(page.locator('#btn-submit')).toBeHidden();
  await expect(page.locator('#btn-save-changes')).toBeVisible();
  await expect(page.locator('#next_step_3')).toHaveValue('Record next step three');
  await expect(page.locator('#room_number')).toHaveValue('12B');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 3 (amended): Close Lap after the auto-load locks the record and shows worked example 4', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 15_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Completed', 'Coming soon', 'Completed']);
  await expect(stripLine(page)).toContainText('completed');
  expect(h.posts.filter((p) => p.action === 'close')).toHaveLength(1);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 4 / R7 (amended, Problem 2): a teacher with an open observation auto-loads instead of leaving Save & Lock grey - that state is no longer reachable from the screen', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  page.on('dialog', (d) => d.accept());
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);   // lap 2 open
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  // amended: no grey Save & Lock to tap any more - picking them loads
  // Observation 2 straight into edit mode (the calm open_observation /
  // already_closed handling from a genuinely stale answer is unchanged and
  // covered separately by the "plan 3.6" specs).
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#btn-submit')).toBeHidden();
  expect(h.posts, 'no override: nothing was ever posted').toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 5 (amended, Problem 2): typed content on the blank form is flushed silently (no ask) into the draft when the teacher auto-loads', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  // typed BEFORE the pick: this is the "anything typed into the blank form
  // beforehand" the auto-load must flush, since there is no button tap left
  // to type in front of.
  await page.fill('#observer_comments', 'typed before continuing');
  await page.waitForTimeout(400);   // past the 220 ms autosave debounce

  let dialogSeen = false;
  page.on('dialog', () => { dialogSeen = true; });   // must never fire
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  expect(dialogSeen, 'no ask-first pop-up any more').toBe(false);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  expect(saved.observer_comments).toBe('typed before continuing');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 6 (amended round 2, Problem 2): the Teacher-box x returns to the blank new-observation form with Teacher EMPTY (fix round 2), and does not auto-load anything', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(400);   // past the 220 ms autosave: the pick itself is now the draft
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });

  let dialogSeen = false;
  page.on('dialog', () => { dialogSeen = true; });   // must never fire
  await tsControl(page, 'teacher').locator('.clear-button').click();
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  await expect(page.locator('#observer_comments')).toHaveValue('');
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  // fix round 2 (VERIFIER hand-walk, 2026-09-19): picking a teacher with an
  // open observation means "open that observation", never "start a draft for
  // this teacher" - the flush that ran when the pick auto-loaded never wrote
  // Test Teacher into the draft, so the blank form this x returns to shows an
  // EMPTY Teacher box and a grey "Select a teacher" strip, not the just-left
  // teacher with no way back in (the old behaviour this spec used to assert).
  await expect(page.locator('#teacher')).toHaveValue('');
  await expect(stripLine(page)).toHaveText('Select a teacher', { timeout: 10_000 });
  await page.waitForTimeout(500);   // give a wrongful second auto-load every chance to appear
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  expect(dialogSeen).toBe(false);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 6 / 3.5.7: with no draft at all, x returns to a genuinely empty grey strip', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  // wipe the draft that the earlier pick left behind, so this exit has
  // nothing at all to restore
  await page.evaluate((k) => localStorage.removeItem(k), DRAFT_KEY);

  await tsControl(page, 'teacher').locator('.clear-button').click();
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(stripLine(page)).toHaveText('Select a teacher');
  await expect(page.locator('#teacher')).toHaveValue('');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 hard rule 13: a record loaded via the auto-load or ?edit= never writes the localStorage or Supabase draft', async ({ page }) => {
  for (const [what, useAutoLoad] of [['auto-load', true], ['?edit=', false]] as [string, boolean][]) {
    const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
    await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
    const drafts: string[] = [];
    await page.route('**/rest/v1/rpc/save_draft', (r: Route) => {
      drafts.push('save');
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.route('**/rest/v1/rpc/load_draft', (r: Route) => {
      drafts.push('load');
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false }) });
    });
    if (useAutoLoad) {
      await openForm(page);
      await pickTomSelect(page, 'teacher', 'Test Teacher');
    } else {
      await openEdit(page);
    }
    await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
    const draftBefore = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    drafts.length = 0;
    await page.fill('#next_step_1', `edited via ${what}`);
    await page.waitForTimeout(2600);   // past both the local and the Supabase draft debounce
    expect(drafts, `${what}: an edited OPEN record must never touch the draft RPCs`).toEqual([]);
    expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY), what).toBe(draftBefore);
    expect(h.errors).toEqual([]);
  }
});

test('otp-v0.11 plan 3.5 point 5: Next Steps typed into the blank form do not survive into a continued record whose Next Steps are empty', async ({ page }) => {
  const openNoSteps = {
    ...RECORD_PAYLOAD_OPEN,
    data: { ...RECORD_PAYLOAD_OPEN.data, next_step_1: '', next_step_2: '', next_step_3: '' },
  };
  const h = await harness(page, { record: openNoSteps });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  // typed BEFORE the pick: the auto-load fires as soon as the teacher lands,
  // so this is what "the blank form beforehand" now means.
  await page.fill('#next_step_1', 'typed on the blank form, must not survive');
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#next_step_1')).toHaveValue('');
  await expect(page.locator('#next_step_2')).toHaveValue('');
  await expect(page.locator('#next_step_3')).toHaveValue('');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 3.5 point 2 (amended): a draft pull that resolves AFTER the auto-load changes nothing in the loaded record', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  let releaseDraftLoad: () => void = () => {};
  await page.route('**/rest/v1/rpc/load_draft', async (r: Route) => {
    await new Promise<void>((res) => { releaseDraftLoad = res; });
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, found: true, data: MAC_DRAFT, updated_at: '2026-09-16T12:00:00.000+00:00' }) });
  });
  await openForm(page);
  // inspector picked FIRST (starts the held pull), teacher picked SECOND
  // (starts the auto-load) - so the pull is genuinely in flight when the
  // record lands, and only resolves after.
  await pickTomSelect(page, 'inspector', 'Test Observer');   // triggers pullDraftFromSupabase, held above
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');

  releaseDraftLoad();
  await page.waitForTimeout(500);
  // the late draft pull must not have overwritten the loaded record
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  await expect(page.locator('#next_step_1')).toHaveValue('Record next step one');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 3.5 point 2 (amended): a pad extraction that resolves AFTER the auto-load changes nothing in the loaded record', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  let releaseExtract: () => void = () => {};
  await page.route('**/script.google.com/**', async (r: Route) => {
    const req = r.request();
    if (req.method() === 'POST') {
      let parsed: any = {};
      try { parsed = JSON.parse(req.postData() || '{}'); } catch { /* keep empty */ }
      if (parsed.action === 'extract_pad') {
        await new Promise<void>((res) => { releaseExtract = res; });
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, items: [{ text: 'late pad transcription' }] }) });
      }
    }
    await r.fallback();
  });

  // the whole pad interaction happens on the BLANK form, before the teacher
  // is even picked, so the extraction is already in flight when the auto-load
  // starts.
  await page.locator('.pad-field-btn[data-pad-target="observer_comments"]').click();
  await expect(page.locator('#pad-modal')).toHaveClass(/open/, { timeout: 10_000 });
  const stage = await page.locator('#pad-stage').boundingBox();
  await page.mouse.move(stage!.x + 60, stage!.y + 60);
  await page.mouse.down();
  await page.mouse.move(stage!.x + 160, stage!.y + 110, { steps: 8 });
  await page.mouse.up();
  await page.locator('#pad-done').click();     // fires the (held) background extraction
  await expect(page.locator('#pad-modal')).not.toHaveClass(/open/);

  await pickTomSelect(page, 'teacher', 'Test Teacher');   // auto-loads before the extraction answers
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');

  releaseExtract();
  await page.waitForTimeout(500);
  // the late transcription must never land on the loaded record...
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  // ...it stays with the draft it belongs to instead
  const draft = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  expect(draft.observer_comments).toBe('late pad transcription');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 3.5 point 6: teacher A\'s pad image is never shown for teacher B\'s same-named file', async ({ page }) => {
  const TOKEN_A = LAP_STATE_OPEN_WITH_OWN_STEPS.open.record_token;
  const TOKEN_B = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const recA = { ...RECORD_PAYLOAD_OPEN, pad_files: ['observer-comments-1.jpg'] };
  const recB = {
    ...RECORD_PAYLOAD_OPEN,
    data: { ...RECORD_PAYLOAD_OPEN.data, teacher: 'Second Teacher', observer_comments: 'Second teacher comments' },
    pad_files: ['observer-comments-1.jpg'],
  };
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { options });
  page.on('dialog', (d) => d.accept());

  const padImageCalls: string[] = [];
  await page.route('**/script.google.com/**', async (r: Route) => {
    const req = r.request();
    const url = req.url();
    if (req.method() === 'GET' && url.includes('form=otp') && url.includes('token=')) {
      const isB = url.includes(`token=${TOKEN_B}`);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isB ? recB : recA) });
    }
    if (url.includes('action=pad_image')) {
      padImageCalls.push(url);
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, mime: 'image/jpeg', data: ONE_PX_JPEG }) });
    }
    await r.fallback();
  });
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    const answer = body.p_teacher === 'Second Teacher'
      ? { ...LAP_STATE_OPEN_WITH_OWN_STEPS, open: { ...LAP_STATE_OPEN_WITH_OWN_STEPS.open, record_token: TOKEN_B } }
      : LAP_STATE_OPEN_WITH_OWN_STEPS;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });

  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await page.locator('.pad-attach[data-pad-target="observer_comments"]').click();
  await expect.poll(() => padImageCalls.filter((u) => u.includes(`token=${TOKEN_A}`)).length, { timeout: 15_000 }).toBe(1);
  await page.locator('#pad-view-close').click();

  // back to blank, then teacher B's open record auto-loads (same pad filename)
  await tsControl(page, 'teacher').locator('.clear-button').click();
  await pickTomSelect(page, 'teacher', 'Second Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await page.locator('.pad-attach[data-pad-target="observer_comments"]').click();
  await expect.poll(() => padImageCalls.filter((u) => u.includes(`token=${TOKEN_B}`)).length, { timeout: 15_000 }).toBe(1);

  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 3.5 point 2 (reference-data exemption): a record that arrives before its option lists still ends with Teacher, Observer and Subject filled and the edit buttons enabled', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  const options = await holdOptions(page);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_OPEN)) }),
  );

  await page.goto(`${FORM_URL}?edit=${EDIT_TOKEN_FIXTURE}`);
  await passGate(page);
  // otp-v0.11 FIX A: an open record in edit mode shows no banner; #btn-save-changes
  // existing (disabled, since the lists that fill Subject are still held) is
  // the "record has landed" signal instead.
  await expect(page.locator('#btn-save-changes')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  // the record rendered on its own: the lists are still held at this point
  expect(await optionKeys(page), 'the lists landed before the record, so the race is untested').toEqual([[], [], []]);
  await expect(page.locator('#btn-save-changes')).toBeDisabled();

  options.release();
  await options.landed;
  await expectListsApplied(page);
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher');
  await expect(tsControl(page, 'inspector')).toContainText('Test Observer');
  await expect(tsControl(page, 'subject')).toContainText('Mathematics');
  await expect(page.locator('#btn-save-changes')).toBeEnabled();
  await expect(page.locator('#btn-close-lap')).toBeEnabled();
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 3.6: open_observation on a submit makes no Google request, and the message names the lap from the answer', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await mockLapState(page, LAP_STATE_STARTING_NEXT);   // the strip's own cache would say lap 2; the answer says 5
  await openForm(page);
  await fillRequired(page);
  let submitPosts = 0;
  await page.route(EDGE_FN, async (r: Route) => {
    submitPosts++;
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'open_observation', lap: 5, id: 'AIS-OTP-OTHER' }) });
  });
  let googleSubmit = 0;
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().method() === 'POST') {
      const parsed = JSON.parse(r.request().postData() || '{}');
      if (parsed.form === 'otp' && !parsed.action) googleSubmit++;
    }
    await r.fallback();
  });
  await page.locator('#btn-submit').click();
  await expect(page.locator('#toast')).toHaveText('Observation 5 is still open. Continue it, or close it first.', { timeout: 10_000 });
  expect(googleSubmit, 'a business answer must never fall back to Google').toBe(0);
  expect(submitPosts, 'a definitive business error is not retried').toBe(1);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 3.6: already_closed on Save changes makes no Google request, and the message is calm', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  page.on('dialog', (d) => d.accept());
  await page.route(EDGE_FN, async (r: Route) => {
    const body = r.request().postDataJSON();
    if (body.action === 'update') {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'already_closed', id: 'AIS-OTP-TEST', status: 'closed', closed_at: '2026-09-11T09:30:00.000Z' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  let googleUpdate = 0;
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().method() === 'POST') {
      const parsed = JSON.parse(r.request().postData() || '{}');
      if (parsed.action === 'update') googleUpdate++;
    }
    await r.fallback();
  });
  await openEdit(page);
  await page.locator('#btn-save-changes').click();
  await expect(page.locator('#toast')).toHaveText('This observation was already closed.', { timeout: 10_000 });
  expect(googleUpdate, 'a business answer must never fall back to Google').toBe(0);
  expect(h.errors).toEqual([]);
});

/* ============================================================================
 * otp-v0.11 task 7 · fix round 1 (GPT-5.6 Terra review, 5 findings)
 * ========================================================================== */

test('CNL-001: Save changes on a teacher-changing update sends enforce_open_block, and a resulting open_observation answer is calm with no Google fallback', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, options });
  page.on('dialog', (d) => d.accept());
  const edgePosts: any[] = [];
  await page.route(EDGE_FN, async (r: Route) => {
    const body = r.request().postDataJSON();
    edgePosts.push(body);
    if (body.action === 'update') {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'open_observation', lap: 4, id: 'AIS-OTP-OTHER' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  let googleUpdate = 0;
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().method() === 'POST') {
      const parsed = JSON.parse(r.request().postData() || '{}');
      if (parsed.action === 'update') googleUpdate++;
    }
    await r.fallback();
  });
  await openEdit(page);
  await pickTomSelect(page, 'teacher', 'Second Teacher');
  await page.locator('#btn-save-changes').click();
  await expect(page.locator('#toast')).toHaveText('Observation 4 is still open. Continue it, or close it first.', { timeout: 10_000 });
  expect(edgePosts.filter((b) => b.action === 'update')).toHaveLength(1);
  expect(edgePosts[0].enforce_open_block).toBe('true');
  expect(googleUpdate, 'a business answer must never fall back to Google').toBe(0);
  expect(h.errors).toEqual([]);
});

test('CNL-002 (amended): typing then picking the teacher at once (no wait) still flushes the fresh text into the draft, with no confirm', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await page.fill('#observer_comments', 'typed right before continuing, no wait');
  // no waitForTimeout here: pick immediately, inside the 220 ms autosave
  // debounce - the auto-load's own saveForm() must still take a fresh
  // snapshot rather than relying on the debounced autosave having run.
  let dialogSeen = false;
  page.on('dialog', () => { dialogSeen = true; });   // must never fire
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  expect(dialogSeen).toBe(false);
  const draft = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  expect(draft.observer_comments).toBe('typed right before continuing, no wait');
  expect(h.errors).toEqual([]);
});

test('CNL-003: after the Teacher-box x from an ?edit= load, a field pencil opens the pad', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await openEdit(page);
  await tsControl(page, 'teacher').locator('.clear-button').click();
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('.pad-field-btn[data-pad-target="observer_comments"]')).toBeVisible();
  await page.locator('.pad-field-btn[data-pad-target="observer_comments"]').click();
  await expect(page.locator('#pad-modal')).toHaveClass(/open/, { timeout: 10_000 });
  expect(h.errors).toEqual([]);
});

test('CNL-004 (i) (amended): a late extraction for an ordinary field merges into the draft alongside its existing typed text', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await page.fill('#observer_comments', 'typed by hand first');
  await page.waitForTimeout(400);   // past the 220 ms autosave, so the draft already holds it

  let releaseExtract: () => void = () => {};
  await page.route('**/script.google.com/**', async (r: Route) => {
    const req = r.request();
    if (req.method() === 'POST') {
      let parsed: any = {};
      try { parsed = JSON.parse(req.postData() || '{}'); } catch { /* keep empty */ }
      if (parsed.action === 'extract_pad') {
        await new Promise<void>((res) => { releaseExtract = res; });
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, items: [{ text: 'late pad transcription' }] }) });
      }
    }
    await r.fallback();
  });

  await page.locator('.pad-field-btn[data-pad-target="observer_comments"]').click();
  await expect(page.locator('#pad-modal')).toHaveClass(/open/, { timeout: 10_000 });
  const stage = await page.locator('#pad-stage').boundingBox();
  await page.mouse.move(stage!.x + 60, stage!.y + 60);
  await page.mouse.down();
  await page.mouse.move(stage!.x + 160, stage!.y + 110, { steps: 8 });
  await page.mouse.up();
  await page.locator('#pad-done').click();
  await expect(page.locator('#pad-modal')).not.toHaveClass(/open/);

  await pickTomSelect(page, 'teacher', 'Test Teacher');   // auto-loads before the extraction answers
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');

  releaseExtract();
  await page.waitForTimeout(500);
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  const draft = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  expect(draft.observer_comments).toBe('typed by hand first\n\nlate pad transcription');
  expect(h.errors).toEqual([]);
});

test("CNL-004 (ii) (amended): a late criterion-note extraction lands in the draft's sp1_notes, not the loaded record", async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  let releaseExtract: () => void = () => {};
  await page.route('**/script.google.com/**', async (r: Route) => {
    const req = r.request();
    if (req.method() === 'POST') {
      let parsed: any = {};
      try { parsed = JSON.parse(req.postData() || '{}'); } catch { /* keep empty */ }
      if (parsed.action === 'extract_pad') {
        await new Promise<void>((res) => { releaseExtract = res; });
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, items: [{ text: 'a criterion note from the pad' }] }) });
      }
    }
    await r.fallback();
  });

  await tapNoteBtn(page, 'good', 3);
  await expectPop(page, 'open');
  await notePop(page).locator('.pad-field-btn[data-pad-target="sp1_good_3_note"]').click();
  await expect(page.locator('#pad-modal')).toHaveClass(/open/, { timeout: 10_000 });
  const stage = await page.locator('#pad-stage').boundingBox();
  await page.mouse.move(stage!.x + 60, stage!.y + 60);
  await page.mouse.down();
  await page.mouse.move(stage!.x + 160, stage!.y + 110, { steps: 8 });
  await page.mouse.up();
  await page.locator('#pad-done').click();
  await expect(page.locator('#pad-modal')).not.toHaveClass(/open/);

  await pickTomSelect(page, 'teacher', 'Test Teacher');   // auto-loads before the extraction answers
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  // the loaded record's own notes (Good 3, Great 5) show, untouched
  await expect(page.locator('#sp1_notes')).toHaveValue(JSON.stringify(RECORD_NOTES));

  releaseExtract();
  await page.waitForTimeout(500);
  await expect(page.locator('#sp1_notes')).toHaveValue(JSON.stringify(RECORD_NOTES));
  const draft = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  const notes = JSON.parse(draft.sp1_notes || '{}');
  expect(notes['Good 3']).toBe('a criterion note from the pad');
  expect(h.errors).toEqual([]);
});

test('CNL-005: a programmatic click on the hidden #btn-reset, mid-edit, exits to blank with the draft intact (never wipes or deletes it)', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(400);   // let the teacher pick land in the draft
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#btn-reset')).toBeHidden();   // still hidden, unchanged (no new control)

  await page.locator('#btn-reset').dispatchEvent('click');

  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  // fix round 2 (VERIFIER hand-walk, 2026-09-19): the flush that ran when the
  // pick auto-loaded never wrote Test Teacher into the draft, so Reset's own
  // return to blank shows an EMPTY Teacher box and the grey strip, not the
  // just-left teacher with no way back in (the old behaviour this spec used
  // to assert).
  await expect(page.locator('#teacher')).toHaveValue('');
  await expect(stripLine(page)).toHaveText('Select a teacher', { timeout: 10_000 });
  const draftKey = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
  expect(draftKey, 'the draft must still be present, never deleted').not.toBeNull();
  expect(h.errors).toEqual([]);
});

/* ============================================================================
 * otp-v0.11 task 7 · fix round 2 (GPT-5.6 Terra second review, 4 NEW findings)
 * All four are the same class: an await inside a mode transition applied
 * without rechecking the context that started it.
 * ========================================================================== */

test('CNL-006 (a) (amended): Reset during a held-back auto-load stops it; the form never enters edit mode and the record is never requested', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  let releaseSync: () => void = () => {};
  await page.route('**/rest/v1/rpc/save_draft', async (r: Route) => {
    await new Promise<void>((res) => { releaseSync = res; });
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, updated_at: '2026-09-18T00:00:00.000+00:00' }) });
  });
  const recordGets = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_OPEN)) }));
  await openForm(page);
  await pickTomSelect(page, 'inspector', 'Test Observer');   // so the draft sync actually fires
  await pickTomSelect(page, 'teacher', 'Test Teacher');      // auto-loads; held back inside syncDraftToSupabase
  await page.waitForTimeout(200);
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);

  await page.locator('#btn-reset').click();                  // confirm auto-accepted above
  releaseSync();
  await page.waitForTimeout(500);

  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeVisible();
  expect(recordGets, 'the record must never be requested once Reset stopped the auto-load').toHaveLength(0);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('CNL-006 (b) (amended): switching from A to B during a held-back auto-load stops it; B is shown and A\'s record is never requested', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, options });
  page.on('dialog', (d) => d.accept());
  let releaseSync: () => void = () => {};
  await page.route('**/rest/v1/rpc/save_draft', async (r: Route) => {
    await new Promise<void>((res) => { releaseSync = res; });
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, updated_at: '2026-09-18T00:00:00.000+00:00' }) });
  });
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    const answer = body.p_teacher === 'Second Teacher' ? LAP_STATE_NEVER : LAP_STATE_OPEN_WITH_OWN_STEPS;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  const recordGets = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_OPEN)) }));
  await openForm(page);
  await pickTomSelect(page, 'inspector', 'Test Observer');
  await pickTomSelect(page, 'teacher', 'Test Teacher');   // auto-loads; held back inside syncDraftToSupabase
  await page.waitForTimeout(200);

  await pickTomSelect(page, 'teacher', 'Second Teacher');
  releaseSync();
  await page.waitForTimeout(500);

  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  await expect(stripLine(page)).toContainText('Teacher not observed yet', { timeout: 10_000 });
  expect(recordGets, 'A\'s record must never be requested once B was picked').toHaveLength(0);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('CNL-007 (update): the Teacher-box x during a held-back Save changes causes no exception, and the write\'s UI effects are dropped', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  let releaseUpdate: () => void = () => {};
  await page.route(EDGE_FN, async (r: Route) => {
    const body = r.request().postDataJSON();
    if (body.action === 'update') {
      await new Promise<void>((res) => { releaseUpdate = res; });
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'AIS-OTP-TEST', token: body.record_token, status: 'observed', closed_at: '', source: 'supabase' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await openEdit(page);
  await page.fill('#next_step_1', 'edited before x');
  await page.locator('#btn-save-changes').click();
  await page.waitForTimeout(200);

  await tsControl(page, 'teacher').locator('.clear-button').click();
  await expect(page.locator('#btn-reset')).toBeVisible({ timeout: 10_000 });

  let pageError = '';
  page.on('pageerror', (e) => { pageError = e.message; });
  releaseUpdate();
  await page.waitForTimeout(500);

  expect(pageError, 'a late success must never throw dereferencing EDIT_RECORD').toBe('');
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#notice')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('CNL-007 (close): the Teacher-box x during a held-back Close Lap causes no exception, and never locks the blank form', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  let releaseClose: () => void = () => {};
  await page.route(EDGE_FN, async (r: Route) => {
    const body = r.request().postDataJSON();
    if (body.action === 'close') {
      await new Promise<void>((res) => { releaseClose = res; });
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'AIS-OTP-TEST', token: body.record_token, status: 'closed', closed_at: '2026-09-18T09:00:00.000Z', source: 'supabase' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await openEdit(page);
  await page.locator('#btn-close-lap').click();
  await page.waitForTimeout(200);

  await tsControl(page, 'teacher').locator('.clear-button').click();
  await expect(page.locator('#btn-reset')).toBeVisible({ timeout: 10_000 });

  let pageError = '';
  page.on('pageerror', (e) => { pageError = e.message; });
  releaseClose();
  await page.waitForTimeout(500);

  expect(pageError, 'a late success must never lockForm() a restored blank draft').toBe('');
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('CNL-008 (amended): a stale open-lap block for teacher A is cleared on any new lookup, even when re-checking on returning to A fails', async ({ page }) => {
  // amended: picking A with an open lap now auto-loads it (Problem 2), so
  // this replays "switch to B, back to A whose refetch fails" AROUND that -
  // load A, leave it (blank form; the isPick guard means this restore never
  // re-triggers), switch to B, back to A - the same aCalls shape the
  // original fix targeted (A's first lookup open, every later one failing).
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { options, record: RECORD_PAYLOAD_OPEN });
  page.on('dialog', (d) => d.accept());
  let aCalls = 0;
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    if (body.p_teacher === 'Test Teacher') {
      aCalls++;
      if (aCalls === 1) {
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_OPEN_WITH_OWN_STEPS) });
      }
      return r.fulfill({ status: 500, contentType: 'text/plain', body: 'upstream timeout' });
    }
    // Second Teacher's own answer never lands, so it can never incidentally
    // clear the block itself: this isolates the fix (clearing on a new
    // lookup / on a failed refetch) from B's own success path.
    await new Promise(() => {});
  });
  await openForm(page);
  // fill everything except Teacher first, so the auto-load's own flush below
  // carries a complete draft (all of fillRequired, teacher last).
  await pickTomSelect(page, 'inspector', 'Test Observer');
  await page.locator('#curriculum-pills .pill', { hasText: 'Australian' }).click();
  await pickGrade(page, '3');
  await pickTomSelect(page, 'subject', 'Mathematics');
  await page.fill('#date', '2026-09-03');
  await page.fill('#time_in', '09:15');
  await page.fill('#time_out', '10:05');

  await pickTomSelect(page, 'teacher', 'Test Teacher');   // aCalls=1, open -> auto-loads
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await tsControl(page, 'teacher').locator('.clear-button').click();   // leave; the restore never re-triggers (isPick)
  await expect(page.locator('#btn-reset')).toBeVisible();

  await pickTomSelect(page, 'teacher', 'Second Teacher');
  await page.waitForTimeout(200);   // B's own fetch is stuck; never resolves

  await pickTomSelect(page, 'teacher', 'Test Teacher');   // back to A; this refetch fails
  await page.waitForTimeout(500);

  await expect(page.locator('#btn-submit')).not.toHaveClass(/disabled/);
  await expect(page.locator('#btn-submit')).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('CNL-009 (amended round 2): the auto-load rolls back silently when both record sources fail, to a blank form with Teacher EMPTY', async ({ page }) => {
  const h = await harness(page, { record: { success: false, error: 'Record not found' } });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  const edgeGets = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EDGE_MISS) }));
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  // wait for proof the auto-load genuinely started (the Supabase record
  // fetch actually fired) before waiting out its round trip - #btn-reset
  // alone is a bad proxy, since it is ALSO true before the auto-load starts,
  // and both failures here are fast enough that a is-editing on/off toggle
  // can come and go between two Playwright polls.
  await expect.poll(() => edgeGets.length, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(400);   // the Google fallback + silent rollback settle

  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  // fix round 2 (VERIFIER hand-walk, 2026-09-19): a failed auto-load rolls
  // back through the SAME exitEditToBlank() as the Teacher-box x and Reset,
  // reading the SAME flushed draft, which never carried the picked teacher
  // (see saveForm). Rather than a form that shows Test Teacher again with no
  // way to reach the observation that failed to load (this spec used to
  // assert exactly that), the rollback is a genuinely blank form: the coach
  // re-picks, same as with any other empty new-observation form.
  await expect(page.locator('#teacher')).toHaveValue('');
  await expect(stripLine(page)).toHaveText('Select a teacher', { timeout: 10_000 });
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  await expect(page.locator('#toast')).not.toContainText('Could not load');
  await expect(page.locator('#toast')).not.toContainText('Still loading');
  const draft = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
  expect(draft, 'the draft must be intact').not.toBeNull();
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

/* ============================================================================
 * otp-v0.11 lap tracker · FIX B (node 14): the previous builder reported that
 * a permanently failing record fetch makes the auto-load quietly retry itself
 * forever (failed load -> exitEditToBlank -> draft restore ->
 * refreshTeacherStatus -> open observation seen again -> auto-load again).
 * This spec counts every record request either backend sees in the 10 s after
 * ONE teacher pick, with every record fetch answering a definitive miss (so
 * any extra request is a genuine second auto-load, never the Google loader's
 * own internal retry, which only fires on a stall/timeout, not a clean miss).
 * ========================================================================== */
test('otp-v0.11 FIX B: a permanently failing record fetch produces exactly one automatic load attempt, not a repeating loop', async ({ page }) => {
  const h = await harness(page, { record: EDGE_MISS });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  const edgeGets = await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EDGE_MISS) }));
  const googleRecordGets: string[] = [];
  await page.route('**/script.google.com/**', async (r: Route) => {
    const url = r.request().url();
    if (r.request().method() === 'GET' && url.includes('form=otp') && url.includes('token=')) googleRecordGets.push(url);
    await r.fallback();
  });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(10_000);   // the previous builder's own window

  // one teacher pick, one automatic load attempt: one Supabase try, one
  // Google try (a definitive miss stops the Google loader's own retry loop
  // at its first attempt, so there is nothing else to count here). More than
  // one of either means a second auto-load fired on its own.
  expect(edgeGets.length, `Supabase record requests: ${JSON.stringify(edgeGets)}`).toBe(1);
  expect(googleRecordGets.length, `Google record requests: ${JSON.stringify(googleRecordGets)}`).toBe(1);

  // the form stays calm and fully usable: no error UI, no stuck spinner, and
  // no further automatic attempt without the coach picking a teacher again.
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('sweep fix: submitForm never shows the just-opened strip for a teacher no longer picked', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { options });
  page.on('dialog', (d) => d.accept());
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    const answer = body.p_teacher === 'Second Teacher' ? LAP_STATE_NEVER : LAP_STATE_STARTING_NEXT;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  await openForm(page);
  await fillRequired(page);
  await expect(stripLine(page)).toContainText('now starting Observation 2', { timeout: 10_000 });

  let releaseSubmit: () => void = () => {};
  await page.route(EDGE_FN, async (r: Route) => {
    const body = r.request().postDataJSON();
    await new Promise<void>((res) => { releaseSubmit = res; });
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, id: 'AIS-OTP-20260918-999999', token: body.record_token, status: 'observed', closed_at: '', lap: 2, source: 'supabase' }) });
  });
  await page.locator('#btn-submit').click();
  await page.waitForTimeout(200);

  await pickTomSelect(page, 'teacher', 'Second Teacher');
  await expect(stripLine(page)).toContainText('Teacher not observed yet', { timeout: 10_000 });

  releaseSubmit();
  await page.waitForTimeout(500);

  // the strip must still show Second Teacher's own status, never Test
  // Teacher's "just opened" line; the submission itself still completed.
  await expect(stripLine(page)).toContainText('Teacher not observed yet');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

/* ============================================================================
 * otp-v0.11 fix round 3 (the LAST one). Three reviews in a row found a fresh
 * batch of the same family: a stale async continuation acting on a form
 * context that has moved on. This round closes it at the root (newFormContext,
 * a whole-script sweep, the invariant helper above) and adds specs for the
 * four newly-found instances plus one more the sweep itself turned up.
 * ========================================================================== */

test('CNL-010: a held-back load_draft spanning Save & Lock and the automatic reset changes nothing in the fresh form', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');

  let releaseDraft: () => void = () => {};
  await page.route('**/rest/v1/rpc/load_draft', async (r: Route) => {
    await new Promise<void>((res) => { releaseDraft = res; });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, found: true, updated_at: '2026-09-18T00:00:00.000+00:00',
      data: { next_step_1: 'STALE DRAFT LOADED LATE' },
    }) });
  });
  await pickTomSelect(page, 'inspector', 'Test Observer');   // fires the held pull
  await page.locator('#curriculum-pills .pill', { hasText: 'Australian' }).click();
  await pickGrade(page, '3');
  await pickTomSelect(page, 'subject', 'Mathematics');
  await page.fill('#date', '2026-09-03');
  await page.fill('#time_in', '09:15');
  await page.fill('#time_out', '10:05');

  await page.route(EDGE_FN, (r: Route) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, id: 'AIS-OTP-TEST', token: 'x', status: 'observed', closed_at: '', lap: 1, source: 'supabase' }) }));
  await page.locator('#btn-submit').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 10_000 });

  await page.waitForTimeout(3300);   // the automatic reset (setTimeout(softResetForm, 3000))
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#btn-reset')).toBeVisible();

  releaseDraft();
  await page.waitForTimeout(400);

  await expect(page.locator('#next_step_1')).toHaveValue('');
  await expect(tsControl(page, 'teacher')).not.toContainText('Test Teacher');
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('CNL-011 (amended round 2): changing A to B after the auto-load enters edit mode and before the record answers never strands the page in edit mode', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, options });
  let aCalls = 0;
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    let answer;
    if (body.p_teacher === 'Second Teacher') {
      answer = LAP_STATE_NEVER;
    } else {
      // fix round 2: A's rollback now restores an EMPTY Teacher (see below),
      // so refreshTeacherStatus's own "same teacher, keep what shows" guard
      // never re-asks for A once the blank form is back - this only ever
      // fires once, for A's own original pick.
      aCalls++;
      answer = LAP_STATE_OPEN_WITH_OWN_STEPS;
    }
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  let releaseRecord: () => void = () => {};
  const recordGets = await routeEdgeRecord(page, async (r) => {
    await new Promise<void>((res) => { releaseRecord = res; });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_OPEN)) });
  });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');   // auto-loads; EDIT_MODE flips synchronously
  await expect(page.locator('body')).toHaveClass(/is-editing/, { timeout: 10_000 });

  await pickTomSelect(page, 'teacher', 'Second Teacher');   // bumps the context; does not itself leave edit mode
  releaseRecord();
  await page.waitForTimeout(500);

  expect(recordGets.length, 'the record was requested once, by the auto-load, before B was picked').toBe(1);
  expect(aCalls, 'A is looked up once, by its own pick, never again').toBe(1);
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  // fix round 2 (VERIFIER hand-walk, 2026-09-19): exitEditToBlank restores the
  // draft (hard rule 13: nothing typed in edit mode is ever persisted, so B's
  // mid-flight pick was never saved) - and that draft never carried A either
  // (see saveForm): the page ends on a genuinely blank, grey form, never A
  // reappearing with no way back into the observation that was superseded,
  // and never B's stale mid-flight pick either.
  await expect(page.locator('#teacher')).toHaveValue('');
  await expect(stripLine(page)).toHaveText('Select a teacher', { timeout: 10_000 });
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('CNL-012: submit answered already_closed shows the calm message and makes no Google request', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await fillRequired(page);
  await page.route(EDGE_FN, (r: Route) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: false, error: 'already_closed', id: 'AIS-OTP-TEST', status: 'closed', closed_at: '2026-09-18T09:00:00.000Z' }) }));

  await page.locator('#btn-submit').click();
  await expect(page.locator('#toast')).toContainText('This observation was already closed.', { timeout: 10_000 });

  expect(h.posts.length, 'a business answer (already_closed) must never fall back to Google').toBe(0);
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#btn-submit')).not.toBeDisabled();
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('CNL-013: the Teacher-box x during a held-back pad-viewer open leaves no lightbox on the blank form', async ({ page }) => {
  const record = { ...RECORD_PAYLOAD_OPEN, pad_files: ['observer-comments-1.jpg'] };
  const h = await harness(page, { record });
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord(record)) }));
  await page.route('**/script.google.com/**', async (r: Route) => {
    const url = r.request().url();
    if (url.includes('action=pad_image')) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, mime: 'image/jpeg', data: ONE_PX_JPEG }) });
    }
    await r.fallback();
  });
  await openEdit(page);
  await expect(page.locator('.pad-attach[data-pad-target="observer_comments"]')).toBeVisible();

  // Both dispatched from one synchronous script turn, so the Teacher-box x's
  // exitEditToBlank() runs for certain while openPadView's blurAndSettle()
  // is still pending (a real await, unlike this synchronous click handler) -
  // deterministic, unlike racing two separate Playwright actions against a
  // ~120 ms window.
  await page.evaluate(() => {
    (document.querySelector('.pad-attach[data-pad-target="observer_comments"]') as HTMLElement).click();
    (document.getElementById('teacher')!.nextElementSibling!.querySelector('.clear-button') as HTMLElement).click();
  });
  await page.waitForTimeout(400);

  await expect(page.locator('#pad-view')).not.toHaveClass(/open/);
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  await expect(page.locator('#btn-reset')).toBeVisible();
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('sweep fix (round 3): Reset during "Reading pad..." on Save & Lock aborts the submit; no payload is built from wiped fields', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await fillRequired(page);

  await page.locator('.pad-field-btn[data-pad-target="observer_comments"]').click();
  await expect(page.locator('#pad-modal')).toHaveClass(/open/, { timeout: 10_000 });
  const stage = await page.locator('#pad-stage').boundingBox();
  await page.mouse.move(stage!.x + 60, stage!.y + 60);
  await page.mouse.down();
  await page.mouse.move(stage!.x + 160, stage!.y + 110, { steps: 8 });
  await page.mouse.up();

  let releaseExtract: () => void = () => {};
  await page.route('**/script.google.com/**', async (r: Route) => {
    const req = r.request();
    if (req.method() === 'POST') {
      let parsed: any = {};
      try { parsed = JSON.parse(req.postData() || '{}'); } catch { /* keep empty */ }
      if (parsed.action === 'extract_pad') {
        await new Promise<void>((res) => { releaseExtract = res; });
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, items: [{ text: 'late pad text' }] }) });
      }
    }
    await r.fallback();
  });
  await page.locator('#pad-done').click();   // fires the (held) background extraction
  await expect(page.locator('#pad-modal')).not.toHaveClass(/open/);

  const writeCalls: string[] = [];
  await page.route(EDGE_FN, async (r: Route) => {
    writeCalls.push(r.request().url());
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, id: 'AIS-OTP-TEST', token: 'x', status: 'observed', closed_at: '', source: 'supabase' }) });
  });

  await page.locator('#btn-submit').click();
  await expect(page.locator('#btn-submit')).toHaveText('Reading pad…', { timeout: 10_000 });

  await page.locator('#btn-reset').click();   // confirm auto-accepted above; wipes teacher + all fields
  await expect(tsControl(page, 'teacher')).not.toContainText('Test Teacher');

  releaseExtract();
  await page.waitForTimeout(500);

  expect(writeCalls, 'a superseded submit must never write a payload built from wiped fields').toHaveLength(0);
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#btn-submit')).not.toHaveText('Reading pad…');
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

/* ============================================================================
 * otp-v0.11 final inspection round 1 (GPT-6 Astra, 19 Sep 2026)
 * REV-001, REV-004, REV-005. REV-003 is folded into the existing F3 spec above.
 * ========================================================================== */

test('REV-001 (amended): continuing a legacy (v1) record then exiting through the Teacher-box x restores the live v2 rubric, not v1', async ({ page }) => {
  const legacyOpen = {
    ...RECORD_PAYLOAD_LEGACY,
    data: { ...RECORD_PAYLOAD_LEGACY.data, status: 'observed', closed_at: '', lap: '2', round: 'OTP Term 1 26-27' },
  };
  const h = await harness(page, { record: legacyOpen });
  let calls = 0;
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    calls++;
    // amended: only the FIRST pick is open, exactly enough to start the one
    // auto-load under test; once the x leaves it, the draft's own re-read
    // (plan 3.5.7) must not bounce straight back in, or the blank form this
    // spec checks the rubric on could never be observed.
    const answer = calls === 1 ? LAP_STATE_OPEN_WITH_OWN_STEPS : LAP_STATE_STARTING_NEXT;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  await openForm(page);

  // Good 7 exists only in the LIVE 32-criterion (v2) rubric ("good" tops out
  // at 6 in the legacy 26-paragraph v1); marking it on the BLANK form, before
  // the auto-load, puts a v2-numbered selection in the draft that a wrong
  // active rubric would misread or lose.
  await chipAt(page, 'good', 7).click();
  await expect(chipAt(page, 'good', 7)).toHaveAttribute('data-state', 'present');
  await page.waitForTimeout(400);   // past the 220ms autosave debounce

  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  // otp-v0.6: a legacy record (no rubric_version) renders on the 26 v1
  // paragraphs; "good" has 6 there, not 7.
  await expect(page.locator('.rub-chip')).toHaveCount(26);
  await expect(page.locator('.rub-chip[data-level="good"]')).toHaveCount(6);

  await tsControl(page, 'teacher').locator('.clear-button').click();
  await expect(page.locator('#btn-reset')).toBeVisible();

  // REV-001: back on the blank form, the LIVE v2 rubric must be rebuilt...
  await expect(page.locator('.rub-chip')).toHaveCount(32, { timeout: 10_000 });
  await expect(page.locator('.rub-chip[data-level="good"]')).toHaveCount(7);
  // ...with the draft's own v2 selection restored under the CORRECT
  // numbering (not lost, not shifted onto a different criterion by the v1
  // table still being on screen when the draft was applied).
  await expect(chipAt(page, 'good', 7)).toHaveAttribute('data-state', 'present');
  await expect(page.locator('#rubric_version')).toHaveValue('sp1-v2');
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('REV-004: Save changes refreshes the Next Steps echo to the observation\'s own just-saved steps (plan 2.3(b), R8)', async ({ page }) => {
  const openNoSteps = {
    ...RECORD_PAYLOAD_OPEN,
    data: { ...RECORD_PAYLOAD_OPEN.data, next_step_1: '', next_step_2: '', next_step_3: '' },
  };
  const h = await harness(page, { record: openNoSteps });
  // The backend answer changes after the save actually lands: the SECOND
  // get_teacher_lap_state read carries this observation's own, just-updated
  // Next Steps, exactly as a real Supabase re-read would.
  const afterSave = {
    ...LAP_STATE_OPEN_NO_OWN_STEPS,
    open: { ...LAP_STATE_OPEN_NO_OWN_STEPS.open, next_step_1: 'Give the new starter a buddy' },
  };
  let lapStateCalls = 0;
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    lapStateCalls++;
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(lapStateCalls === 1 ? LAP_STATE_OPEN_NO_OWN_STEPS : afterSave) });
  });
  await openEdit(page);
  // own steps are empty, so the predecessor's show first (R8)
  const predecessorHead = new RegExp(`^Observation 1 Next Steps · ${dayPat('2026-09-01')} · Igor Sesar$`);
  await expect(page.locator('#prev-ns-echo-head')).toHaveText(predecessorHead, { timeout: 10_000 });

  await page.fill('#next_step_1', 'Give the new starter a buddy');
  await page.locator('#btn-save-changes').click();
  await expect(page.locator('#notice')).toBeVisible({ timeout: 10_000 });   // the open-lap sticky notice

  // REV-004: the echo must switch to Observation 2's OWN just-saved step
  // (heading alone, no date/observer, plan 2.3(b)) instead of continuing to
  // show the predecessor's, and the teacher-status cache must have been
  // invalidated and re-read to get there.
  await expect(page.locator('#prev-ns-echo-head')).toHaveText('Observation 2 Next Steps', { timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo-list li')).toHaveText(['Give the new starter a buddy']);
  expect(lapStateCalls, 'Save changes must trigger a fresh teacher-status read').toBeGreaterThan(1);
  expect(h.errors).toEqual([]);
});

test('REV-005: a Google submit answer of open_observation shows the calm message and refreshes the strip, never the red Submit-failed toast', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  let lapStateCalls = 0;
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    lapStateCalls++;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_NEVER) });
  });
  await openForm(page);
  await fillRequired(page);
  expect(lapStateCalls, 'the teacher pick reads the strip once').toBe(1);

  // Supabase submit fails as a plain transport error (not a parsed business
  // answer), twice (sbWriteRetry's one retry) - the same setup as "a failed
  // edge function falls back to the Google POST" above - so the write falls
  // through to Google, whose own R7 check (plan 3.6, R13) then answers
  // open_observation instead of creating the row.
  let edgeCalls = 0;
  await page.route(EDGE_FN, async (r: Route) => {
    edgeCalls++;
    await r.fulfill({ status: 500, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'write failed' }) });
  });
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().method() === 'POST') {
      const parsed = JSON.parse(r.request().postData() || '{}');
      if (parsed.form === 'otp' && !parsed.action) {
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'open_observation', lap: 5, id: 'AIS-OTP-OTHER' }) });
      }
    }
    await r.fallback();
  });

  await page.locator('#btn-submit').click();
  await expect(page.locator('#toast')).toHaveText(
    'Observation 5 is still open. Continue it, or close it first.', { timeout: 10_000 });
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  expect(edgeCalls, 'the retry that precedes the Google fallback').toBe(2);
  expect(lapStateCalls, 'the strip is refreshed after the business answer').toBe(2);
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#btn-submit')).not.toBeDisabled();
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

/* ============================================================================
 * otp-v0.11 final inspection round 2 (GPT-6 Astra, 19 Sep 2026) · REV-008
 * ========================================================================== */

test('REV-008: a closed ?edit= record loaded BEFORE its option lists keeps its own strip once the lists resolve the teacher', async ({ page }) => {
  // The realistic common order on a live network (record ~1s, lists 2-4s):
  // the record renders its own closed strip first, while the Teacher Tom
  // Select still has no options (only dataset.pendingValue) - so
  // currentTeacherName() reads '' at that exact moment. Round 1's REV-003 fix
  // stamped lapStateTeacher from that empty read, which did not hold: once
  // the lists landed and resolved the teacher, applyDropdownOptions's own
  // refreshTeacherStatus() call saw a "new" name and overwrote the closed
  // strip with this teacher's general coaching history (LAP_STATE_STARTING_NEXT
  // below, a stand-in for "some other/no open observation").
  const h = await harness(page, { record: RECORD_PAYLOAD_CLOSED });
  let lapStateCalls = 0;
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    lapStateCalls++;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAP_STATE_STARTING_NEXT) });
  });
  const options = await holdOptions(page);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_CLOSED)) }),
  );

  await page.goto(`${FORM_URL}?edit=${EDIT_TOKEN_FIXTURE}`);
  await passGate(page);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  const stripLineRe = dayRe('Observation 2 completed ', RECORD_PAYLOAD_CLOSED.data.closed_at);
  await expect(page.locator('#status-strip-line')).toHaveText(stripLineRe, { timeout: 10_000 });
  // the record really did render before any list arrived
  expect(await optionKeys(page), 'the record landed before the lists, so the race is untested')
    .toEqual([[], [], []]);

  // now let the lists land and resolve the pending teacher
  options.release();
  await options.landed;
  await expectListsApplied(page);
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher');

  // REV-008: the closed record's own strip must still stand
  await expect(page.locator('#status-strip-line')).toHaveText(stripLineRe);
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Completed', 'Coming soon', 'Completed']);
  expect(lapStateCalls,
    'a closed-record view must never ask get_teacher_lap_state, even once the lists resolve the teacher').toBe(0);
  expect(h.errors).toEqual([]);
});

test('REV-008: a closed ?edit= record stands even if get_teacher_lap_state would answer 500 once the lists land', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_CLOSED });
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', (r: Route) =>
    r.fulfill({ status: 500, contentType: 'text/plain', body: 'upstream error' }));
  const options = await holdOptions(page);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_CLOSED)) }),
  );

  await page.goto(`${FORM_URL}?edit=${EDIT_TOKEN_FIXTURE}`);
  await passGate(page);
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  const stripLineRe = dayRe('Observation 2 completed ', RECORD_PAYLOAD_CLOSED.data.closed_at);
  await expect(page.locator('#status-strip-line')).toHaveText(stripLineRe, { timeout: 10_000 });

  options.release();
  await options.landed;
  await expectListsApplied(page);

  // no grey strip, no error UI: the closed record's own state stands
  await expect(page.locator('#status-strip-line')).toHaveText(stripLineRe);
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Completed', 'Coming soon', 'Completed']);
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

/* ============================================================================
 * otp-v0.11 lap tracker · BUG-1 (Igor's iPad report, 19 Sep 2026). His exact
 * sequence, one page session, no reload: close Observation 2, start a fresh
 * one, Save & Lock it, pick the same teacher again, Continue, edit, and Save
 * changes / Close Lap stayed grey. Root cause (proved below, not the
 * orchestrator's original lead): lockForm() stamps dataset.locked='1' on BOTH
 * #btn-save-changes and #btn-close-lap on every lock, including a plain
 * Save & Lock (mode 'submit'), where those two buttons are not even shown.
 * The automatic 3s reset after Save & Lock (softResetForm) clears is-locked
 * and re-enables every field, but never that dataset flag on those two
 * buttons - only exitEditToBlank does. So the NEXT time the SAME page enters
 * edit mode for an open record (Continue, or the amended auto-load),
 * updateSubmitState()'s own guard ("if (b.dataset.locked === '1') return")
 * permanently skips them, even though the record has landed and every
 * required field is filled. Fix: enterEditMode(), the ONE function that wires
 * up an open record for editing, clears any stale flag before wiring it up.
 * ========================================================================== */

test('BUG-1: Save changes and Close Lap are live on a re-entered open record, after an earlier Save & Lock in the SAME page session', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  let lapStateCalls = 0;
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    lapStateCalls++;
    // 1st pick (before Save & Lock): no open lap yet. 2nd pick (after the
    // automatic reset): the observation just saved is now open, lap 2 -
    // exactly what Igor picked back up with Continue.
    const answer = lapStateCalls === 1 ? LAP_STATE_NEVER : LAP_STATE_OPEN_WITH_OWN_STEPS;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  // Observation 1 (stands in for Igor's "Observation 2"): a plain Save & Lock.
  await fillRequired(page);
  await page.route(EDGE_FN, (r: Route) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, id: 'AIS-OTP-TEST-1', token: 'tok1', status: 'observed', closed_at: '', lap: 1, source: 'supabase' }) }));
  await page.locator('#btn-submit').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 10_000 });

  // the automatic reset 3s later: is-locked clears, fields re-enable. This is
  // exactly where the stale dataset.locked on Save changes / Close Lap survives.
  await page.waitForTimeout(3300);
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#btn-reset')).toBeVisible();

  // Re-pick the SAME teacher (Igor's "picked the same teacher again"): they
  // now have an open observation, so it auto-loads (Problem 2 amendment).
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });

  // edit the record, exactly as Igor described
  await page.fill('#next_step_1', 'edited after re-entering');

  // BUG-1: these must be live, not stuck grey from the earlier Save & Lock.
  await expect(page.locator('#btn-save-changes')).toBeEnabled();
  await expect(page.locator('#btn-close-lap')).toBeEnabled();
  expect(h.errors).toEqual([]);
});

/* Mirror case, as asked: "view an already-closed record through ?edit=,
 * leave it with the Teacher-box x, then open a teacher's open observation."
 * CHECKED against the real UI first (see the report): a locked record
 * (lockForm(...,'closed',...), which an already-closed ?edit= record always
 * is) disables every Tom Select via ts.disable(), and
 * ".ts-wrapper.disabled .clear-button{display:none}" then hides the x
 * itself - confirmed live (Playwright timed out waiting for it to become
 * visible; the Teacher combobox renders [disabled] with no clear button).
 * #btn-reset is also hidden while is-editing. So a real coach cannot reach
 * "leave it with the x" from a locked record at all; the only control left
 * is "New observation" (#btn-new), which reloads and trivially clears every
 * flag, proving nothing about the leak. The test below exercises the exact
 * same code (exitEditToBlank, the one place that already clears
 * dataset.locked) the way the UI itself would call it if the x were ever
 * reachable from a locked view, as a regression guard should that change. */
test('BUG-1 mirror: exitEditToBlank after viewing an already-closed ?edit= record leaves a DIFFERENT teacher\'s open observation fully editable', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { record: RECORD_PAYLOAD_CLOSED, options });
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    const answer = body.p_teacher === 'Second Teacher' ? LAP_STATE_OPEN_WITH_OWN_STEPS : LAP_STATE_STARTING_NEXT;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  // harness()'s generic Google mock answers every token= GET with the SAME
  // fixture; Second Teacher's own open observation needs its own (open) one,
  // distinguished by its lap-state token, added AFTER harness() so it wins.
  const secondToken = LAP_STATE_OPEN_WITH_OWN_STEPS.open.record_token;
  await page.route('**/script.google.com/**', async (r: Route) => {
    const url = r.request().url();
    if (r.request().method() === 'GET' && url.includes('form=otp') && url.includes(`token=${secondToken}`)) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RECORD_PAYLOAD_OPEN) });
    }
    await r.fallback();
  });

  // a closed record, opened via ?edit=: dataset.locked='1' on both buttons
  await openEdit(page);
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/);
  await expect(tsControl(page, 'teacher')).toHaveClass(/disabled/);   // the x is unreachable from here (see comment above)

  // the UI's own exit path, invoked the way a clickable x would
  await page.evaluate(() => (window as any).exitEditToBlank());
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);

  // a DIFFERENT teacher, who has an open observation: auto-loads
  await pickTomSelect(page, 'teacher', 'Second Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await page.fill('#next_step_1', 'edited via the mirror path');
  await expect(page.locator('#btn-save-changes')).toBeEnabled();
  await expect(page.locator('#btn-close-lap')).toBeEnabled();
  expect(h.errors).toEqual([]);
});

/* ============================================================================
 * otp-v0.11 lap tracker · BUG-2 layout shift (Igor's iPad report, 19 Sep
 * 2026; diagnosed in Developer/claudex-runs/otp-v0.11/tsdiag/). About a
 * second after a teacher is picked, the status strip repaints TALLER (card
 * 1's title grows a line via ordinalWord(n) + " Teacher Observation<br>
 * Observation " + n, and every blank .strip-status gets a word), pushing the
 * Teacher/Observer/Time In grid down under the coach's finger - measured 24
 * to 69 px pre-fix. Fix (CSS only, in .strip-title/.strip-status/
 * .status-strip-line): reserve the strip's resting height for its tallest
 * state up front, so the lap-state answer landing never grows it.
 *
 * The "never-observed" spec below isolates that reflow specifically: the
 * mocked get_teacher_lap_state answer is held on a gate the test releases
 * itself (rather than a blind timeout), and (there being no open observation)
 * no record ever loads, so the strip's own repaint is the only thing that can
 * move the grid. The "open-observation" spec goes further (node 14, FIX A):
 * it also lets the auto-loaded record itself land, ~600ms after the strip's
 * own answer, because that record used to show the #submitted-banner about a
 * second after the pick - a SECOND, BIGGER shift (77-85px) than the strip's
 * own (this one was measured, not estimated: RED before FIX A removed the
 * banner from an open record's edit mode, GREEN after). FIX A's decision: an
 * open record in edit mode shows no banner at all, on either path (auto-load
 * or ?edit=), so this is now one continuous measurement from the pick to a
 * second after the record has fully landed.
 *
 * Per instruction, neither spec uses Locator.click(): page.mouse.click /
 * page.touchscreen.tap only. passGate()'s StatiCrypt button (third-party,
 * unrelated to the strip under test) is the one exception.
 * ========================================================================== */

/** A held get_teacher_lap_state route: answers only once release() is
 *  called, so the test controls exactly when the strip's answer lands
 *  instead of racing a fixed timeout. */
function holdLapState(page: Page, answer: any): () => void {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    await gate;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  return () => release();
}

/** otp-v0.11's own auto-load (Problem 2 amendment) fetches the open record's
 *  token the instant the lap-state answer names one; leaving that request
 *  unresolved keeps enterEditMode() from ever firing, isolating the strip's
 *  own reflow (the "never-observed" spec below, and the touch spec, where no
 *  record ever loads anyway since d.open is null). */
async function blockRecordFetch(page: Page) {
  await page.route('**/script.google.com/**', async (r: Route) => {
    if (r.request().url().includes('token=')) return;   // never fulfilled
    await r.fallback();
  });
}

/** Like blockRecordFetch, but the held request resolves once release() is
 *  called instead of never - so a test can measure the grid across the
 *  record actually landing (node 14, FIX A), not just the strip's own
 *  answer. Supabase (the harness's default *.supabase.co route) still
 *  answers its own quick miss first, same as blockRecordFetch's tests. */
function holdRecordFetch(page: Page, record: any): () => void {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  page.route('**/script.google.com/**', async (r: Route) => {
    const url = r.request().url();
    if (!url.includes('token=')) { await r.fallback(); return; }
    await gate;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) });
  });
  return () => release();
}

/** getBoundingClientRect().top + scrollY (the page-absolute position, not
 *  just the viewport-relative one) of the Teacher, Observer and Time In
 *  controls: BUG-2's original two targets plus Teacher, extended for
 *  otp-v0.12's Observation Process card wrapper, which must not move any of
 *  the three either. */
const gridTops = (page: Page) => page.evaluate(() => {
  const top = (sel: string) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect().top + window.scrollY : null;
  };
  return {
    teacher: top('#teacher + .ts-wrapper'),
    observer: top('#inspector + .ts-wrapper'),
    timeIn: top('#time_in'),
  };
});

/** Opens a Tom Select control and picks one option, at real coordinates
 *  (mouse or touch), never via Locator.click(). */
async function rawPickTomSelect(page: Page, field: string, label: string, touch: boolean) {
  const ctrlBox = (await tsControl(page, field).boundingBox())!;
  const tap = (x: number, y: number) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  await tap(ctrlBox.x + ctrlBox.width / 2, ctrlBox.y + ctrlBox.height / 2);
  const opt = page.locator('.ts-dropdown .option', { hasText: label }).first();
  await opt.waitFor({ state: 'visible' });
  const optBox = (await opt.boundingBox())!;
  await tap(optBox.x + optBox.width / 2, optBox.y + optBox.height / 2);
}

const BUG2_WIDTHS: { width: number; height: number }[] = [
  { width: 834, height: 1194 },
  { width: 1024, height: 1366 },
  { width: 744, height: 1133 },
];

for (const lapName of ['never-observed'] as const) {
  test(`otp-v0.11 BUG-2: the strip's own lap-state answer never moves the Observer/Time In grid (${lapName})`, async ({ page }) => {
    const answer = LAP_STATE_NEVER;
    for (const { width, height } of BUG2_WIDTHS) {
      await page.setViewportSize({ width, height });
      const h = await harness(page);
      const release = holdLapState(page, answer);
      await blockRecordFetch(page);
      await openForm(page);

      await rawPickTomSelect(page, 'teacher', 'Test Teacher', false);

      await page.waitForTimeout(150);   // "the coach sees the Observer box" (early)
      const early = await gridTops(page);

      await page.waitForTimeout(750);   // ~900 ms total since the pick, per the diagnosis's own timing
      release();
      await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 5_000 });
      await page.waitForTimeout(50);    // let the reflow this answer causes settle

      const late = await gridTops(page);
      expect(early.teacher, `Teacher control missing at ${width}px`).not.toBeNull();
      expect(early.observer, `Observer control missing at ${width}px`).not.toBeNull();
      expect(early.timeIn, `Time In input missing at ${width}px`).not.toBeNull();
      expect(
        Math.abs(late.teacher! - early.teacher!),
        `Teacher top shift at ${width}px (${lapName}): ${early.teacher} -> ${late.teacher}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(late.observer! - early.observer!),
        `Observer top shift at ${width}px (${lapName}): ${early.observer} -> ${late.observer}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(late.timeIn! - early.timeIn!),
        `Time In top shift at ${width}px (${lapName}): ${early.timeIn} -> ${late.timeIn}`,
      ).toBeLessThanOrEqual(1);
      expect(h.errors).toEqual([]);
    }
  });
}

/* node 14, FIX A: the previous round's own "open-observation" case above was
 * isolated to the strip's own reflow (blockRecordFetch left the record
 * unresolved). This one continues past that: it lets the record land too,
 * ~600ms after the strip's own answer (holdRecordFetch, released instead of
 * left hanging), and samples the grid throughout - 150ms after the pick until
 * a second after the record has fully landed (fields filled, Save changes and
 * Close Lap visible) - so a shift from EITHER the strip's own repaint or the
 * record landing (the banner used to add one here, ~77-85px, FIX A) shows up.
 * Only the two widths the fix was measured against; the never-observed case
 * above already covers the 3-column width and has no record to load. */
const BUG2_RECORD_WIDTHS: { width: number; height: number }[] = [
  { width: 834, height: 1194 },
  { width: 1024, height: 1366 },
];

for (const { width, height } of BUG2_RECORD_WIDTHS) {
  test(`otp-v0.11 BUG-2 + FIX A: the strip's answer AND the record it auto-loads never move the Observer/Time In grid (open-observation, ${width}x${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
    const releaseLap = holdLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
    const releaseRecord = holdRecordFetch(page, RECORD_PAYLOAD_OPEN);
    await openForm(page);

    await rawPickTomSelect(page, 'teacher', 'Test Teacher', false);

    await page.waitForTimeout(150);   // "the coach sees the Observer box" (early)
    const early = await gridTops(page);
    expect(early.teacher, `Teacher control missing at ${width}px`).not.toBeNull();
    expect(early.observer, `Observer control missing at ${width}px`).not.toBeNull();
    expect(early.timeIn, `Time In input missing at ${width}px`).not.toBeNull();

    const deltas = { teacher: [] as number[], observer: [] as number[], timeIn: [] as number[] };
    const sample = async () => {
      const t = await gridTops(page);
      if (t.teacher != null) deltas.teacher.push(Math.abs(t.teacher - early.teacher!));
      if (t.observer != null) deltas.observer.push(Math.abs(t.observer - early.observer!));
      if (t.timeIn != null) deltas.timeIn.push(Math.abs(t.timeIn - early.timeIn!));
    };

    await page.waitForTimeout(750);   // ~900 ms total since the pick, same timing as the strip-only spec
    releaseLap();
    await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 5_000 });
    await sample();
    await page.waitForTimeout(100);   // let the strip's own reflow settle
    await sample();

    await page.waitForTimeout(500);   // ~600 ms after the strip's own answer landed
    releaseRecord();
    await expect(page.locator('#room_number')).toHaveValue('12B', { timeout: 5_000 });   // the record has landed
    await sample();
    await expect(page.locator('#btn-save-changes')).toBeVisible();
    await expect(page.locator('#btn-close-lap')).toBeVisible();
    await sample();

    // a second after the record has fully landed, sampled throughout rather
    // than only at the end, so a transient jump that later settles still counts
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(200);
      await sample();
    }

    const maxTeacher = Math.max(0, ...deltas.teacher);
    const maxObserver = Math.max(0, ...deltas.observer);
    const maxTimeIn = Math.max(0, ...deltas.timeIn);
    expect(
      maxTeacher,
      `Teacher top drifted more than 1px at ${width}px: samples ${JSON.stringify(deltas.teacher)}`,
    ).toBeLessThanOrEqual(1);
    expect(
      maxObserver,
      `Observer top drifted more than 1px at ${width}px: samples ${JSON.stringify(deltas.observer)}`,
    ).toBeLessThanOrEqual(1);
    expect(
      maxTimeIn,
      `Time In top drifted more than 1px at ${width}px: samples ${JSON.stringify(deltas.timeIn)}`,
    ).toBeLessThanOrEqual(1);
    // FIX A itself: an open record in edit mode never shows the banner.
    await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
    expect(h.errors).toEqual([]);
  });
}

test('otp-v0.11 BUG-2 touch: a stale tap 1.5s after picking Teacher still lands on Observer, then on Time In (WebKit/touch)', async ({ browser }) => {
  const ctx = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 834, height: 1194 },
    baseURL: `http://127.0.0.1:${process.env.OTP_PORT || '8123'}`,
  });
  const page = await ctx.newPage();
  const h = await harness(page);
  const release = holdLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await blockRecordFetch(page);
  await openForm(page);

  await rawPickTomSelect(page, 'teacher', 'Test Teacher', true);

  // the coach's eye, 150 ms after the pick: where Observer sits right now
  await page.waitForTimeout(150);
  const observerBox = (await tsControl(page, 'inspector').boundingBox())!;
  const staleObserver = { x: observerBox.x + observerBox.width / 2, y: observerBox.y + observerBox.height / 2 };

  // the answer lands ~900 ms after the pick, same timing as the layout spec,
  // followed by the reflow the strip's own answer causes (this is BUG-2)
  await page.waitForTimeout(750);
  release();
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 5_000 });
  await page.waitForTimeout(50);

  // the coach's finger, 1.5 s after the pick in total: the SAME coordinate,
  // now stale. A real touch tap, never Locator.click/.tap().
  await page.waitForTimeout(1_500 - 150 - 750 - 50);
  await page.touchscreen.tap(staleObserver.x, staleObserver.y);
  await page.waitForTimeout(300);

  const afterObserverTap = await page.evaluate(() => {
    const isOpen = (id: string) => {
      const el = document.getElementById(id) as (HTMLElement & { tomselect?: { isOpen: boolean } }) | null;
      return !!(el && el.tomselect && el.tomselect.isOpen);
    };
    return { teacher: isOpen('teacher'), inspector: isOpen('inspector') };
  });
  expect(afterObserverTap.inspector, 'the Observer list should be the one that opened').toBe(true);
  expect(afterObserverTap.teacher, 'the Teacher list must stay shut').toBe(false);
  // the real regression guard: the stale coordinate is still Observer's OWN
  // centre once the answer has landed - i.e. Observer never moved under it
  // (pre-fix this was off by the strip's own growth; post-fix, ~0).
  const observerBoxNow = (await tsControl(page, 'inspector').boundingBox())!;
  const nowCentre = observerBoxNow.y + observerBoxNow.height / 2;
  expect(
    Math.abs(nowCentre - staleObserver.y),
    `Observer's centre moved from the coach's stale aim point: ${staleObserver.y} -> ${nowCentre}`,
  ).toBeLessThanOrEqual(1);

  // pick an Observer for real (touch), then the same stale-tap test on Time In
  const obsOpt = page.locator('.ts-dropdown .option', { hasText: 'Test Observer' }).first();
  await obsOpt.waitFor({ state: 'visible' });
  const obsOptBox = (await obsOpt.boundingBox())!;
  await page.touchscreen.tap(obsOptBox.x + obsOptBox.width / 2, obsOptBox.y + obsOptBox.height / 2);

  await page.waitForTimeout(150);
  const timeInBox = (await page.locator('#time_in').boundingBox())!;
  const staleTimeIn = { x: timeInBox.x + timeInBox.width / 2, y: timeInBox.y + timeInBox.height / 2 };
  await page.waitForTimeout(1_500 - 150);

  await page.touchscreen.tap(staleTimeIn.x, staleTimeIn.y);
  await page.waitForTimeout(300);
  const anyDropdownOpen = await page.evaluate(
    () => Array.from(document.querySelectorAll('.ts-dropdown')).some((d) => (d as HTMLElement).offsetParent !== null),
  );
  expect(anyDropdownOpen, 'no Tom Select list should be open after the stale tap on Time In').toBe(false);
  const timeInBoxNow = (await page.locator('#time_in').boundingBox())!;
  expect(
    Math.abs((timeInBoxNow.y + timeInBoxNow.height / 2) - staleTimeIn.y),
    'Time In moved from the coach\'s stale aim point',
  ).toBeLessThanOrEqual(1);

  expect(h.errors).toEqual([]);
  await ctx.close();
});

/* ============================================================================
 * otp-v0.11 lap tracker · fix round 2 (VERIFIER hand-walk, 2026-09-19)
 * Picking a teacher who has an open observation means "open that
 * observation", never "start a draft for this teacher". The flush that
 * autoLoadOpenObservation runs before it starts loading used to persist the
 * just-picked teacher into the blank form's draft (both localStorage and the
 * Supabase copy); a later return to blank (a reload, Close Lap -> New
 * Observation, the Teacher-box x, Reset, or a failed load's own rollback)
 * then restored a BLANK new-observation form with that teacher pre-filled and
 * the strip reading "Observation N · open since ..." above it, with no way in
 * (no Continue button any more) except clearing the teacher and picking
 * again. Fix: saveForm() blanks the teacher in the draft for as long as
 * autoLoadToken is set (the whole flush-through-load span), so every save
 * landing in that window keeps it out, not just the first one.
 * ========================================================================== */

test('otp-v0.11 fix round 2: a page reload after the auto-load returns a blank form with Teacher EMPTY, the rest of the typed draft back', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  // typed BEFORE the pick, so it is what the flush carries into the draft.
  await page.fill('#observer_comments', 'typed before the pick, must survive the reload');
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await passGate(page);

  await expect(page.locator('#teacher')).toHaveValue('');
  await expect(stripLine(page)).toHaveText('Select a teacher');
  await expect(page.locator('#observer_comments')).toHaveValue('typed before the pick, must survive the reload');
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 fix round 2: Close Lap then New Observation returns a blank form with Teacher EMPTY, the rest of the typed draft back', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await page.fill('#observer_comments', 'typed before the pick, must survive');
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });

  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 15_000 });

  await page.locator('#btn-new').click();   // confirm auto-accepted above; reloads the page
  await passGate(page);

  await expect(page.locator('#teacher')).toHaveValue('');
  await expect(stripLine(page)).toHaveText('Select a teacher');
  await expect(page.locator('#observer_comments')).toHaveValue('typed before the pick, must survive');
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 fix round 2: a teacher with no open observation still drafts normally (unaffected by the flush guard)', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(400);   // past the 220 ms autosave debounce
  const draft = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  expect(draft.teacher).toBe('Test Teacher');
  await page.reload();
  await passGate(page);
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 fix round 2: the flush pushes the Supabase draft copy with the teacher blank too', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  const saves: any[] = [];
  await page.route('**/rest/v1/rpc/save_draft', async (r: Route) => {
    saves.push(r.request().postDataJSON());
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, updated_at: '2026-09-19T00:00:00.000+00:00' }) });
  });
  await openForm(page);
  await pickTomSelect(page, 'inspector', 'Test Observer');   // so the sync is keyed to someone
  await pickTomSelect(page, 'teacher', 'Test Teacher');      // auto-loads; its own flush syncs first
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });

  expect(saves.length, 'the flush must sync to Supabase too').toBeGreaterThan(0);
  expect(saves[0].p_data.teacher, 'the Supabase draft must not carry the picked teacher either').toBe('');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 fix round 2: a debounced autosave landing while the flush is still syncing must not put the teacher back', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  let releaseSync: () => void = () => {};
  await page.route('**/rest/v1/rpc/save_draft', async (r: Route) => {
    await new Promise<void>((res) => { releaseSync = res; });
    await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, updated_at: '2026-09-19T00:00:00.000+00:00' }) });
  });
  await openForm(page);
  await pickTomSelect(page, 'inspector', 'Test Observer');   // so the draft sync actually fires
  await pickTomSelect(page, 'teacher', 'Test Teacher');      // auto-loads; held back inside syncDraftToSupabase
  await page.waitForTimeout(200);
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);   // still held, mid-flight

  // a keystroke while the load is still in flight schedules its OWN debounced
  // autosave (EDIT_MODE is still false); it must land with the teacher still
  // blank, never reintroduce it once its own 220 ms debounce fires.
  await page.fill('#observer_comments', 'typed while the load was still in flight');
  await page.waitForTimeout(400);   // past that 220 ms debounce; still held

  releaseSync();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });

  const draft = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  expect(draft.teacher).toBe('');
  expect(draft.observer_comments).toBe('typed while the load was still in flight');
  expect(h.errors).toEqual([]);
});

/* ===================================================================
   otp-v0.12 B2 · the pinned Observation Process bar (Focus OS task 6)
   Ported from the approved look mock (handoff/research/2026-09-21-
   otp-v012/mock/process-bar-mock.html). No Next Steps button yet (that
   is B3, below). The bar is painted from the SAME renderStripView the
   full card uses, so these specs drive it with the suite's own
   mockLapState/LAP_STATE_* fixtures, exactly like the strip specs above.
   =================================================================== */

/** The three iPad widths B2 is proved at, reusing the sizes already
 *  measured against this master (STEP_CARD_SIZE_BY_WIDTH, above). */
const OP_WIDTHS = STEP_CARD_SIZE_BY_WIDTH.map(({ width, height }) => ({ width, height }));

/** Same open observation as LAP_STATE_OPEN_WITH_OWN_STEPS, but neither email
 *  has gone out yet: card 3 must read "pending", not "completed". */
const LAP_STATE_OPEN_EMAILS_PENDING = {
  ...LAP_STATE_OPEN_WITH_OWN_STEPS,
  open: { ...LAP_STATE_OPEN_WITH_OWN_STEPS.open, coach_emailed_at: null, teacher_emailed_at: null },
};

/** The bar's own box + visibility, read the same way the approved mock's
 *  verifier scripts do (foreman_verify.mjs barState). */
const opBarBox = (page: Page) => page.evaluate(() => {
  const bar = document.getElementById('op-bar')!;
  const wrap = document.getElementById('op-bar-wrap');
  const card = document.getElementById('op-card')!;
  const cs = getComputedStyle(bar);
  const r = bar.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  return {
    state: bar.dataset.state,
    opacity: +cs.opacity,
    display: cs.display,
    pointerEvents: cs.pointerEvents,
    visibility: cs.visibility,
    top: r.top, left: r.left, width: r.width, height: r.height,
    cardLeft: cr.left, cardWidth: cr.width,
    wrapAriaHidden: wrap ? wrap.getAttribute('aria-hidden') : null,
  };
});

/** Every step slot's state, in bar order 1-6: the dot's own is-* class, or
 *  'active' for the pill slot (mirrors the card's own strip-card classes). */
const opBarStepStates = (page: Page) => page.evaluate(() => {
  const steps = document.getElementById('op-bar-steps')!;
  return Array.from(steps.children).map((el) => {
    if (el.id === 'op-bar-active') return 'active';
    const m = el.className.match(/\bis-(\w+)\b/);
    return m ? m[1] : '';
  });
});

/** Bare "1".."6" number badges visible anywhere in the bar (there must be
 *  none, owner feedback round 1), plus the Active pill's own visible text
 *  and whether its name is clipped (foreman_verify.mjs's `fb`). */
const opBarPillInfo = (page: Page) => page.evaluate(() => {
  const bar = document.getElementById('op-bar')!;
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0;
  };
  const digitsBadges = Array.from(bar.querySelectorAll('*')).filter(
    (el) => el.children.length === 0 && /^[1-6]$/.test((el.textContent || '').trim()) && visible(el),
  ).length;
  const pill = bar.querySelector('#op-bar-active');
  if (!pill) return { digitsBadges, pillText: null as string | null, clipped: null as boolean | null };
  const name = pill.querySelector('.op-step-name') as HTMLElement | null;
  return {
    digitsBadges,
    pillText: (pill as HTMLElement).innerText.trim(),
    clipped: name ? name.scrollWidth > name.clientWidth + 1 : null,
  };
});

/** Scrolls to `y` and waits for the bar to actually settle - both its
 *  data-state (IntersectionObserver fires asynchronously, so a fixed sleep
 *  can flake under the CPU load of many sequential page loads in one spec)
 *  AND its own opacity, until the 220/320ms transition has actually
 *  finished (a fixed sleep here can also flake: 0.999993 is not === 1).
 *  Re-asserts the scroll position on EVERY poll tick, for the whole wait:
 *  a Tom Select pick's own focus/blur can - a couple of seconds later, on
 *  WebKit - wake the form's PRE-EXISTING iPad keyboard-void cleanup
 *  (unrelated to the bar, see the vv-delta engine around body.kb-open),
 *  which snaps scrollY back even after the bar first reached the wanted
 *  state; a one-shot scrollTo has no way to recover from a LATE reset. */
const scrollAndWaitForBar = async (page: Page, y: number, shown: boolean) => {
  await page.waitForFunction(
    ([yy, want]) => {
      if (Math.abs(window.scrollY - (yy as number)) > 2) window.scrollTo(0, yy as number);
      const bar = document.getElementById('op-bar');
      if (!bar || bar.dataset.state !== (want ? 'shown' : 'hidden')) return false;
      const o = +getComputedStyle(bar).opacity;
      return want ? o > 0.995 : o < 0.005;
    },
    [y, shown] as [number, boolean], { timeout: 10_000, polling: 100 },
  );
};

test('otp-v0.12 B2: the bar is invisible and not tappable at the top, stays hidden scrolled with no teacher picked, then pins flush with the card once it scrolls off', async ({ page }) => {
  for (const { width, height } of OP_WIDTHS) {
    const h = await harness(page);
    await page.setViewportSize({ width, height });
    await mockLapState(page, LAP_STATE_NEVER);
    // a fresh page per width iteration on the SAME origin: without this, the
    // previous iteration's picked-teacher draft would auto-restore here too.
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
    await openForm(page);

    let box = await opBarBox(page);
    expect(box.opacity, `${width}px: bar visible at the top before any pick`).toBeLessThan(0.01);
    expect(box.pointerEvents, `${width}px: bar tappable at the top`).toBe('none');
    expect(box.wrapAriaHidden, `${width}px: wrap aria-hidden at the top`).toBe('true');

    // scrolled down, but no teacher picked yet: still hidden
    await scrollAndWaitForBar(page, 2000, false);
    box = await opBarBox(page);
    expect(box.opacity, `${width}px: bar showed with no teacher picked`).toBeLessThan(0.01);
    await scrollAndWaitForBar(page, 0, false);

    // a teacher is picked, but the card is still fully on screen: bar stays hidden
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
    box = await opBarBox(page);
    expect(box.opacity, `${width}px: bar showed while the card is still on screen`).toBeLessThan(0.01);

    // scroll the card fully off the top: the bar pins, flush with the card
    await scrollAndWaitForBar(page, 1600, true);
    box = await opBarBox(page);
    expect(box.opacity, `${width}px: bar did not pin ${JSON.stringify(box)}`).toBeGreaterThan(0.99);
    expect(box.pointerEvents, `${width}px: pinned bar not tappable`).not.toBe('none');
    expect(box.visibility, `${width}px: pinned bar visibility`).toBe('visible');
    expect(Math.abs(box.width - box.cardWidth), `${width}px: bar width ${box.width} vs card ${box.cardWidth}`).toBeLessThanOrEqual(2);
    expect(Math.abs(box.left - box.cardLeft), `${width}px: bar left ${box.left} vs card ${box.cardLeft}`).toBeLessThanOrEqual(2);
    expect(box.height, `${width}px: bar not slim (${box.height}px)`).toBeLessThanOrEqual(72);
    expect(box.wrapAriaHidden, `${width}px: wrap aria-hidden while pinned`).toBe('false');

    expect(h.errors).toEqual([]);
  }
});

test('otp-v0.12 B2: all five strip states read correctly in the pinned bar - state classes match the card, no number badges, the Active pill names the step', async ({ page }) => {
  const cardStates = (p: Page) => p.evaluate(() =>
    Array.from({ length: 6 }, (_, i) => {
      const c = document.getElementById('strip-card-' + (i + 1))!;
      const m = c.className.match(/\bis-(\w+)\b/);
      return m ? m[1] : '';
    }));
  // registered once: a second page.on('dialog', ...) per width iteration
  // would double-handle the same Close Lap confirm below.
  page.on('dialog', (d) => d.accept());

  for (const { width, height } of OP_WIDTHS) {
    await page.setViewportSize({ width, height });
    // (no localStorage.clear() here: the open-observation states below go
    // through the app's own auto-load, which already blanks the draft's
    // teacher for as long as that token is set - otp-v0.11 fix round 2 -
    // so state 1 of the next width iteration starts naturally blank too.
    // Clearing localStorage on every navigation was tried and dropped: an
    // EMPTY draft changes the auto-load's own timing enough to race the
    // pre-existing keyboard-void engine's scroll clamp, unrelated to B2.)

    // 1. select a teacher: the bar stays hidden even scrolled
    let h = await harness(page);
    await openForm(page);
    await scrollAndWaitForBar(page, 1600, false);
    let box = await opBarBox(page);
    expect(box.opacity, `${width}px select-a-teacher: bar shown with nobody picked`).toBeLessThan(0.01);
    expect(h.errors).toEqual([]);

    const checkPinnedState = async (label: string, pattern: RegExp | null, forbidDigit: boolean) => {
      await scrollAndWaitForBar(page, 1600, true);
      const card = await cardStates(page);
      const barSteps = await opBarStepStates(page);
      const pill = await opBarPillInfo(page);
      const box2 = await opBarBox(page);
      expect(box2.opacity, `${width}px ${label}: bar not pinned`).toBeGreaterThan(0.99);
      const expected = card.map((s) => (s === 'current' ? 'active' : s));
      expect(barSteps, `${width}px ${label}: bar steps ${barSteps} vs card ${card}`).toEqual(expected);
      expect(pill.digitsBadges, `${width}px ${label}: number badge(s) visible in the bar`).toBe(0);
      if (pattern) {
        expect(pill.pillText, `${width}px ${label}: pill text "${pill.pillText}"`).toMatch(pattern);
        if (forbidDigit) expect(pill.pillText, `${width}px ${label}: digit leaked into the pill`).not.toMatch(/\d/);
        expect(pill.clipped, `${width}px ${label}: pill name clipped`).toBe(false);
      } else {
        expect(pill.pillText, `${width}px ${label}: a pill exists with no Active step`).toBeNull();
      }
    };

    // 2. not observed yet: step 1 Active, carries the Observation number
    h = await harness(page);
    await mockLapState(page, LAP_STATE_NEVER);
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
    await checkPinnedState('not observed yet', /^Observation \d+ · Active$/, false);
    expect(h.errors).toEqual([]);

    // 3. open, emails pending: step 4 Active, never a digit
    h = await harness(page);
    await mockLapState(page, LAP_STATE_OPEN_EMAILS_PENDING);
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
    await checkPinnedState('open, emails pending', /· Active$/, true);
    expect(h.errors).toEqual([]);

    // 4. open, emails sent: step 4 Active, never a digit
    h = await harness(page);
    await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
    await checkPinnedState('open, emails sent', /· Active$/, true);
    expect(h.errors).toEqual([]);

    // 5. just closed (a real Close Lap, not a mocked view): no Active step
    h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
    await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
    await openEdit(page);
    await page.locator('#btn-close-lap').click();
    await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 10_000 });
    await checkPinnedState('just closed', null, false);
    expect(h.errors).toEqual([]);
  }
});

test('otp-v0.12 B2: body.pad-open hides the pinned bar completely; it returns once the class is gone', async ({ page }) => {
  const h = await harness(page);
  await page.setViewportSize({ width: 834, height: 1194 });
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
  await scrollAndWaitForBar(page, 1600, true);
  let box = await opBarBox(page);
  expect(box.opacity, 'bar did not pin before the pad-open check').toBeGreaterThan(0.99);

  // body.pad-open collapses the page (hard rule 15's scrollhair note), which
  // clamps window.scrollY back to 0 on its own; the real pad always saves
  // and restores the scroll spot around that (hard rule 15f) - mirror it
  // here too, so this spec isolates the CSS-hiding behaviour on its own
  // rather than re-testing the scroll-restore the real-pad spec already covers.
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => document.body.classList.add('pad-open'));
  await page.waitForTimeout(200);
  box = await opBarBox(page);
  expect(box.display === 'none' || box.opacity === 0, `bar not hidden under body.pad-open: ${JSON.stringify(box)}`).toBeTruthy();

  await page.evaluate(() => document.body.classList.remove('pad-open'));
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  // the enter transition is 320ms plus a rAF scroll check, longer than a
  // fixed 300ms sleep can guarantee under load - poll instead of one read.
  await expect.poll(async () => (await opBarBox(page)).opacity, {
    timeout: 3_000, message: 'bar did not return once pad-open was removed',
  }).toBeGreaterThan(0.99);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B2: opening the real Evidence Pad while the bar is pinned hides it; closing the pad brings it back', async ({ page }) => {
  const h = await harness(page);
  await page.setViewportSize({ width: 834, height: 1194 });
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
  await scrollAndWaitForBar(page, 1600, true);
  let box = await opBarBox(page);
  expect(box.opacity, 'bar did not pin before opening the pad').toBeGreaterThan(0.99);

  await page.locator('.pad-field-btn[data-pad-target="observer_comments"]').click();
  await expect(page.locator('body')).toHaveClass(/pad-open/, { timeout: 10_000 });
  box = await opBarBox(page);
  expect(box.display === 'none' || box.opacity === 0, `bar not hidden while the pad is open: ${JSON.stringify(box)}`).toBeTruthy();

  await page.locator('#pad-done').click();
  await expect(page.locator('body')).not.toHaveClass(/pad-open/, { timeout: 10_000 });
  // same 320ms enter transition + rAF scroll check as the pad-open class
  // spec above - poll instead of a fixed sleep shorter than the transition.
  await expect.poll(async () => (await opBarBox(page)).opacity, {
    timeout: 3_000, message: 'bar did not come back once the pad closed',
  }).toBeGreaterThan(0.99);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B2: the pinned bar never shows in the ungated teacher viewer', async ({ page }) => {
  const src = viewerSrc();
  expect(src).toContain('body.is-viewer .op-bar-wrap { display: none !important; }');
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(500);
  await expect(page.locator('#op-bar-wrap')).toHaveCSS('display', 'none');
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B2: 0 px shift of Teacher, Observer and Time In before, while pinned, and after the bar', async ({ page }) => {
  for (const { width, height } of OP_WIDTHS) {
    const h = await harness(page);
    await page.setViewportSize({ width, height });
    await mockLapState(page, LAP_STATE_NEVER);
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
    await page.waitForTimeout(200);
    const before = await gridTops(page);

    await scrollAndWaitForBar(page, 1600, true);
    const pinned = await gridTops(page);

    await scrollAndWaitForBar(page, 0, false);
    const after = await gridTops(page);

    for (const key of ['teacher', 'observer', 'timeIn'] as const) {
      expect(before[key], `${width}px ${key} missing`).not.toBeNull();
      expect(Math.abs(pinned[key]! - before[key]!), `${width}px ${key} shifted when the bar pinned`).toBeLessThanOrEqual(1);
      expect(Math.abs(after[key]! - before[key]!), `${width}px ${key} shifted after the bar left`).toBeLessThanOrEqual(1);
    }
    expect(h.errors).toEqual([]);
  }
});

test("otp-v0.12 B2: Agenda and Check Teacher dock into the bar's two ends while pinned, keep their href/target, and return to the corners once the bar leaves", async ({ page }) => {
  for (const { width, height } of OP_WIDTHS) {
    const h = await harness(page);
    await page.setViewportSize({ width, height });
    await mockLapState(page, LAP_STATE_NEVER);
    await openForm(page);

    const agendaHref = await page.locator('.float-link.agenda').getAttribute('href');
    const checkHref = await page.locator('.float-link.check').getAttribute('href');
    const cornerAgenda = (await page.locator('.float-link.agenda').boundingBox())!;
    const cornerCheck = (await page.locator('.float-link.check').boundingBox())!;

    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
    await scrollAndWaitForBar(page, 1600, true);

    const barBox = (await page.locator('#op-bar').boundingBox())!;
    const dockedAgenda = (await page.locator('.float-link.agenda').boundingBox())!;
    const dockedCheck = (await page.locator('.float-link.check').boundingBox())!;
    expect(await page.locator('.float-link.agenda').getAttribute('href'), `${width}px agenda href changed while docked`).toBe(agendaHref);
    expect(await page.locator('.float-link.agenda').getAttribute('target'), `${width}px agenda target while docked`).toBe('_blank');
    expect(await page.locator('.float-link.check').getAttribute('href'), `${width}px check href changed while docked`).toBe(checkHref);
    expect(await page.locator('.float-link.check').getAttribute('target'), `${width}px check target while docked`).toBe('_blank');
    // otp-v0.12 P2-B: the docked pill keeps its OWN (shorter) height now
    // (position only changes while docking; see the "one identical pill
    // family" spec below) and is vertically CENTRED inside the 44px bar,
    // not top-aligned to it - this changed from a top-edge check to a
    // centre-to-centre check for that reason.
    expect(Math.abs((dockedAgenda.y + dockedAgenda.height / 2) - (barBox.y + barBox.height / 2)), `${width}px agenda not centred in the bar`).toBeLessThanOrEqual(2);
    expect(Math.abs((dockedCheck.y + dockedCheck.height / 2) - (barBox.y + barBox.height / 2)), `${width}px check not centred in the bar`).toBeLessThanOrEqual(2);
    expect(dockedAgenda.x, `${width}px agenda not at the bar's left end`).toBeGreaterThanOrEqual(barBox.x - 2);
    expect(dockedCheck.x + dockedCheck.width, `${width}px check not at the bar's right end`).toBeLessThanOrEqual(barBox.x + barBox.width + 2);

    await scrollAndWaitForBar(page, 0, false);
    const backAgenda = (await page.locator('.float-link.agenda').boundingBox())!;
    const backCheck = (await page.locator('.float-link.check').boundingBox())!;
    expect(Math.abs(backAgenda.x - cornerAgenda.x), `${width}px agenda did not return to its corner`).toBeLessThanOrEqual(2);
    expect(Math.abs(backCheck.x - cornerCheck.x), `${width}px check did not return to its corner`).toBeLessThanOrEqual(2);
    expect(h.errors).toEqual([]);
  }
});

/** Every style property that must be byte-identical between the form's
 *  undocked pill and the docked one (owner: "pop in, looking exactly the
 *  same... same shape, same everything") - position (top/left/right) is
 *  deliberately excluded, that's the only thing docking may change. */
const FL_STYLE_PROPS = [
  'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'backgroundColor', 'borderTopWidth', 'borderTopStyle', 'borderTopColor',
  'borderRadius', 'backdropFilter', 'webkitBackdropFilter', 'boxShadow',
  'fontSize', 'fontWeight',
] as const;

const readFlStyle = (page: Page, sel: string) => page.evaluate(
  ({ sel, props }) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const p of props) out[p] = (cs as any)[p] ?? '';
    return out;
  },
  { sel, props: FL_STYLE_PROPS },
);

const flIconBox = (page: Page, sel: string) => page.evaluate((s) => {
  const el = document.querySelector(s) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { width: r.width, height: r.height };
}, sel);

test("otp-v0.12 B2: Agenda, Check Teacher and the Next Steps button are one identical pill family - docking (incl. the icon-only tier) changes position only, never the pill's own style", async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    for (const { width, height } of OP_WIDTHS) {
      const h = await harness(page);
      await page.setViewportSize({ width, height });
      // an open observation WITH its own Next Steps: the button must be in
      // its normal ("has steps") look for the family-match check below, not
      // its deliberately different grey/empty state (that variant is its
      // own thing, out of scope here).
      await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
      await openForm(page);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(300);   // let the theme's colour transition settle before measuring

      const undockedAgenda = await readFlStyle(page, '.float-link.agenda');
      const undockedCheck = await readFlStyle(page, '.float-link.check');
      const undockedIcon = await flIconBox(page, '.float-link.agenda .fl-icon');

      await pickTomSelect(page, 'teacher', 'Test Teacher');
      await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
      await expect(page.locator('#op-bar-ns-btn')).not.toHaveClass(/is-empty/);
      await pinBarPastCard(page);
      await page.waitForTimeout(200);   // let the 260ms top/left/right transition settle

      const dockedAgenda = await readFlStyle(page, '.float-link.agenda');
      const dockedCheck = await readFlStyle(page, '.float-link.check');
      const dockedIcon = await flIconBox(page, '.float-link.agenda .fl-icon');
      const nsStyle = await readFlStyle(page, '#op-bar-ns-btn');

      for (const prop of FL_STYLE_PROPS) {
        expect(dockedAgenda?.[prop], `${theme}/${width}px agenda ${prop} changed while docked`).toBe(undockedAgenda?.[prop]);
        expect(dockedCheck?.[prop], `${theme}/${width}px check ${prop} changed while docked`).toBe(undockedCheck?.[prop]);
        expect(nsStyle?.[prop], `${theme}/${width}px Next Steps button ${prop} does not match the docked Agenda`).toBe(dockedAgenda?.[prop]);
      }
      expect(dockedIcon, `${theme}/${width}px agenda icon size changed while docked`).toEqual(undockedIcon);

      // vertical centring inside the 44px bar (offset <= 1px)
      const centre = await page.evaluate(() => {
        const bar = document.getElementById('op-bar')!.getBoundingClientRect();
        const a = document.querySelector('.float-link.agenda')!.getBoundingClientRect();
        const c = document.querySelector('.float-link.check')!.getBoundingClientRect();
        return {
          barMid: bar.top + bar.height / 2,
          agendaMid: a.top + a.height / 2,
          checkMid: c.top + c.height / 2,
        };
      });
      expect(Math.abs(centre.agendaMid - centre.barMid), `${theme}/${width}px agenda not centred in the bar (<=1px)`).toBeLessThanOrEqual(1);
      expect(Math.abs(centre.checkMid - centre.barMid), `${theme}/${width}px check not centred in the bar (<=1px)`).toBeLessThanOrEqual(1);

      // the .float-link transition list animates position only (+ the
      // existing hover colour/transform, which are not geometry)
      const transProps = await page.evaluate(
        () => getComputedStyle(document.querySelector('.float-link.agenda')!).transitionProperty,
      );
      expect(transProps, `${theme}/${width}px .float-link transitions width`).not.toMatch(/\bwidth\b/);
      expect(transProps, `${theme}/${width}px .float-link transitions padding`).not.toMatch(/\bpadding\b/);
      expect(transProps, `${theme}/${width}px .float-link transitions border-radius`).not.toMatch(/border-radius/);
      expect(transProps, `${theme}/${width}px .float-link must still animate top`).toMatch(/\btop\b/);
      expect(transProps, `${theme}/${width}px .float-link must still animate left`).toMatch(/\bleft\b/);
      expect(transProps, `${theme}/${width}px .float-link must still animate right`).toMatch(/\bright\b/);

      expect(h.errors).toEqual([]);
    }
  }
});

test('otp-v0.12 B2 touch: real-coordinate taps land correctly on a field below the pinned bar and on the docked buttons (WebKit/touch)', async ({ browser }) => {
  for (const { width, height } of OP_WIDTHS) {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width, height }, baseURL: `http://127.0.0.1:${process.env.OTP_PORT || '8123'}` });
    const page = await ctx.newPage();
    // the docked buttons are real links to docs.google.com; routed to a local
    // 200 so tapping them proves the tap landed without leaving the machine.
    await page.route('**/docs.google.com/**', (r: Route) => r.fulfill({ status: 200, contentType: 'text/html', body: '' }));
    const h = await harness(page);
    await mockLapState(page, LAP_STATE_NEVER);
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });

    // scroll just past the card's own bottom edge, not a guessed constant:
    // at the tall 1024x1366 iPad Pro portrait size the whole form fits in
    // far less scroll distance than at 744/834, so a fixed offset (or
    // pointOf's own auto-centring on a field further down the form) can
    // either undershoot (card still visible) or overshoot (field scrolled
    // past). room_number sits in the SAME info-grid row as the card, right
    // below it in the DOM at every width, so this lands it just under the
    // bar's own area - literally the field the engineering rule is about.
    const cardBottom = await page.evaluate(() => document.getElementById('op-card')!.getBoundingClientRect().bottom + window.scrollY);
    await scrollAndWaitForBar(page, cardBottom + 20, true);
    const box = await opBarBox(page);
    expect(box.opacity, `${width}px: the card should be off screen once scrolled past it`).toBeGreaterThan(0.99);

    const fieldBox = (await page.locator('#room_number').boundingBox())!;
    await page.touchscreen.tap(fieldBox.x + fieldBox.width / 2, fieldBox.y + fieldBox.height / 2);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.activeElement && (document.activeElement as HTMLElement).id),
      `${width}px: room_number did not focus on a real tap`).toBe('room_number');

    for (const cls of ['agenda', 'check']) {
      const btnBox = (await page.locator(`.float-link.${cls}`).boundingBox())!;
      const [popup] = await Promise.all([
        ctx.waitForEvent('page'),
        page.touchscreen.tap(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2),
      ]);
      expect(popup, `${width}px: tapping the docked ${cls} button did not open its link`).toBeTruthy();
      await popup.close();
    }

    expect(h.errors).toEqual([]);
    await ctx.close();
  }
});

test('otp-v0.12 B2: Reset while the bar is pinned hides it', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());   // Reset confirms before it wipes the form
  await page.setViewportSize({ width: 834, height: 1194 });
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
  await scrollAndWaitForBar(page, 1600, true);
  let box = await opBarBox(page);
  expect(box.opacity, 'bar did not pin before Reset').toBeGreaterThan(0.99);

  await page.locator('#btn-reset').click();
  await expect(stripLine(page)).toHaveText('Select a teacher', { timeout: 10_000 });
  await page.waitForTimeout(300);
  box = await opBarBox(page);
  expect(box.opacity, 'bar stayed shown after Reset').toBeLessThan(0.01);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B2: a thrown error inside the bar paint does not break the strip', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  // stub a low-level DOM API the bar's own icon-cloning relies on, so its
  // paint throws once; the full card must still render correctly and no
  // pageerror may escape (hard rule: the bar is enhancement only).
  await page.evaluate(() => {
    const orig = Element.prototype.cloneNode;
    let thrown = false;
    Element.prototype.cloneNode = function (this: Element, ...args: any[]) {
      if (!thrown && this.closest && this.closest('.strip-icon')) {
        thrown = true;
        throw new Error('otp-v0.12 B2 test: injected bar-paint failure');
      }
      return orig.apply(this, args as any);
    } as any;
  });
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toHaveText(`Teacher not observed yet · ${schoolYearLabel()}`, { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Active', 'Coming soon', 'Pending', 'Pending', 'Coming soon', 'Pending']);
  expect(h.errors).toEqual([]);
});

/* ===================================================================
   otp-v0.12 B3 · the "Next Steps" button + read-only drop-down
   (Focus OS task 7). Ported from the same approved mock as B2. Content is
   always #prev-ns-echo's own text, read at open time; nothing here types,
   saves or fetches.
   =================================================================== */

/** Scrolls just past the card's own bottom edge (never a guessed constant:
 *  the tall 1024x1366 iPad Pro portrait size fits the whole form in far
 *  less scroll distance than 744/834), waits for the bar to pin, then
 *  returns a real-coordinate tap function for the Next Steps button. */
async function pinBarPastCard(page: Page) {
  const cardBottom = await page.evaluate(() => document.getElementById('op-card')!.getBoundingClientRect().bottom + window.scrollY);
  await scrollAndWaitForBar(page, cardBottom + 20, true);
}

test('otp-v0.12 B3 touch: the Next Steps button opens and closes the drop-down by real touch taps at 744/834/1024 - a second tap, an outside tap, and Esc', async ({ browser }) => {
  for (const { width, height } of OP_WIDTHS) {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width, height }, baseURL: `http://127.0.0.1:${process.env.OTP_PORT || '8123'}` });
    const page = await ctx.newPage();
    const h = await harness(page);
    await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
    await pinBarPastCard(page);

    const tapNs = async () => {
      const box = (await page.locator('#op-bar-ns-btn').boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    };

    // open by a real tap
    await tapNs();
    await expect(page.locator('#op-ns-pop'), `${width}px: did not open`).toHaveAttribute('data-state', 'open', { timeout: 5_000 });
    await expect(page.locator('#op-bar-ns-btn')).toHaveAttribute('aria-expanded', 'true');

    // a second tap on the button closes it
    await tapNs();
    await expect(page.locator('#op-ns-pop'), `${width}px: a second tap did not close it`).toHaveAttribute('data-state', 'closed');

    // an outside tap (the scrim) closes it
    await tapNs();
    await expect(page.locator('#op-ns-pop')).toHaveAttribute('data-state', 'open', { timeout: 5_000 });
    const scrimBox = (await page.locator('#op-ns-scrim').boundingBox())!;
    await page.touchscreen.tap(scrimBox.x + 6, scrimBox.y + 6);
    await expect(page.locator('#op-ns-pop'), `${width}px: an outside tap did not close it`).toHaveAttribute('data-state', 'closed');

    // Esc closes it
    await tapNs();
    await expect(page.locator('#op-ns-pop')).toHaveAttribute('data-state', 'open', { timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#op-ns-pop'), `${width}px: Esc did not close it`).toHaveAttribute('data-state', 'closed');

    expect(h.errors).toEqual([]);
    await ctx.close();
  }
});

test('otp-v0.12 B3: the drop-down text equals #prev-ns-echo verbatim - an open observation\'s own steps, a last-closed one, and the grey "none" case', async ({ page }) => {
  const openPopAndRead = async () => {
    await page.locator('#op-bar-ns-btn').click();
    await expect(page.locator('#op-ns-pop')).toHaveAttribute('data-state', 'open', { timeout: 5_000 });
    return {
      head: await page.locator('#op-ns-head').textContent(),
      items: await page.locator('#op-ns-list li').allTextContents(),
      emptyVisible: await page.locator('#op-ns-empty').isVisible(),
    };
  };

  // 1. an open observation with its own Next Steps already saved
  let h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });
  const echoHead1 = await page.locator('#prev-ns-echo-head').textContent();
  const echoItems1 = await page.locator('#prev-ns-echo-list li').allTextContents();
  await pinBarPastCard(page);
  await expect(page.locator('#op-bar-ns-btn'), 'button must not read empty when steps exist').not.toHaveClass(/is-empty/);
  const r1 = await openPopAndRead();
  expect(r1.head).toBe(echoHead1);
  expect(r1.items).toEqual(echoItems1);
  expect(echoItems1.length).toBeGreaterThan(0);
  expect(r1.emptyVisible).toBe(false);
  expect(h.errors).toEqual([]);

  // 2. nothing open: the last CLOSED observation's Next Steps
  h = await harness(page);
  await mockLapState(page, LAP_STATE_STARTING_NEXT);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('now starting Observation', { timeout: 10_000 });
  await expect(page.locator('#prev-ns-echo')).toBeVisible({ timeout: 10_000 });
  const echoHead2 = await page.locator('#prev-ns-echo-head').textContent();
  const echoItems2 = await page.locator('#prev-ns-echo-list li').allTextContents();
  await pinBarPastCard(page);
  await expect(page.locator('#op-bar-ns-btn')).not.toHaveClass(/is-empty/);
  const r2 = await openPopAndRead();
  expect(r2.head).toBe(echoHead2);
  expect(r2.items).toEqual(echoItems2);
  expect(echoItems2.length).toBeGreaterThan(0);
  expect(r2.emptyVisible).toBe(false);
  expect(h.errors).toEqual([]);

  // 3. grey "none" case: a first observation, nothing loaded yet
  h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await expect(page.locator('#prev-ns-echo')).toBeHidden();
  await pinBarPastCard(page);
  await expect(page.locator('#op-bar-ns-btn'), 'button must read empty/grey with nothing loaded').toHaveClass(/is-empty/);
  const r3 = await openPopAndRead();
  expect(r3.emptyVisible).toBe(true);
  expect(r3.items).toEqual([]);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B3: opening the drop-down does not move the page and does not lock body scroll', async ({ page }) => {
  const h = await harness(page);
  await page.setViewportSize({ width: 834, height: 1194 });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
  await pinBarPastCard(page);

  const before = await page.evaluate(() => ({ y: window.scrollY, overflow: getComputedStyle(document.body).overflow }));
  await page.locator('#op-bar-ns-btn').click();
  await expect(page.locator('#op-ns-pop')).toHaveAttribute('data-state', 'open', { timeout: 5_000 });
  const after = await page.evaluate(() => ({ y: window.scrollY, overflow: getComputedStyle(document.body).overflow }));
  expect(after.y, 'opening the drop-down moved the page').toBe(before.y);
  expect(after.overflow, 'opening the drop-down locked body scroll').toBe(before.overflow);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B3: body.pad-open hides the drop-down completely, even when it was already open, and it does not silently reappear when the pad closes', async ({ page }) => {
  const h = await harness(page);
  await page.setViewportSize({ width: 834, height: 1194 });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
  await pinBarPastCard(page);
  await page.locator('#op-bar-ns-btn').click();
  await expect(page.locator('#op-ns-pop')).toHaveAttribute('data-state', 'open', { timeout: 5_000 });

  const scrollY = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => document.body.classList.add('pad-open'));
  await page.waitForTimeout(300);
  const pop = await page.evaluate(() => {
    const el = document.getElementById('op-ns-pop')!;
    return { display: getComputedStyle(el).display, dataState: el.dataset.state };
  });
  expect(pop.display, 'the drop-down must not still render under body.pad-open').toBe('none');
  expect(pop.dataState, 'the pad-open watcher must actually CLOSE it, not just visually hide it').toBe('closed');

  await page.evaluate(() => document.body.classList.remove('pad-open'));
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(300);
  await expect(page.locator('#op-ns-pop'), 'the drop-down must not silently reappear once the pad closes').toHaveAttribute('data-state', 'closed');
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B3: the drop-down closes whenever the bar leaves - scrolling back to the card, Reset, and a teacher change', async ({ page }) => {
  // (a) scrolling back to the card
  let h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
  await pinBarPastCard(page);
  await page.locator('#op-bar-ns-btn').click();
  await expect(page.locator('#op-ns-pop')).toHaveAttribute('data-state', 'open', { timeout: 5_000 });
  await scrollAndWaitForBar(page, 0, false);
  await expect(page.locator('#op-ns-pop'), 'scrolling back to the card did not close it').toHaveAttribute('data-state', 'closed');
  expect(h.errors).toEqual([]);

  // (b) Reset. LAP_STATE_NEVER, not an open observation: an open one
  // auto-loads into edit mode, where #btn-reset is hidden (Save
  // changes/Close Lap show instead) - Reset itself is what this proves.
  h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
  await pinBarPastCard(page);
  await page.locator('#op-bar-ns-btn').click();
  await expect(page.locator('#op-ns-pop')).toHaveAttribute('data-state', 'open', { timeout: 5_000 });
  // the open drop-down's own scrim (by design, same as an outside tap)
  // covers the fixed action-bar too, so a real tap on Reset would first
  // dismiss the drop-down rather than reach the button underneath - that
  // is the SAME "outside tap closes it" rule, already proved above; a
  // dispatched click (CNL-005's own pattern, elsewhere in this file)
  // reaches Reset directly, to prove Reset's OWN result closes the
  // drop-down too.
  await page.locator('#btn-reset').dispatchEvent('click');
  await expect(stripLine(page)).toHaveText('Select a teacher', { timeout: 10_000 });
  await expect(page.locator('#op-ns-pop'), 'Reset did not close it').toHaveAttribute('data-state', 'closed');
  expect(h.errors).toEqual([]);

  // (c) a teacher change
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  h = await harness(page, { options });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
  await pinBarPastCard(page);
  await page.locator('#op-bar-ns-btn').click();
  await expect(page.locator('#op-ns-pop')).toHaveAttribute('data-state', 'open', { timeout: 5_000 });
  await pickTomSelect(page, 'teacher', 'Second Teacher');
  await expect(page.locator('#op-ns-pop'), 'changing teacher did not close it').toHaveAttribute('data-state', 'closed');
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B3: the Next Steps button and drop-down never show in the ungated teacher viewer', async ({ page }) => {
  const src = viewerSrc();
  expect(src).toContain('body.is-viewer .op-ns-scrim { display: none !important; }');
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(500);
  await expect(page.locator('#op-bar-ns-btn')).toBeHidden();
  await expect(page.locator('#op-ns-pop')).toHaveCSS('display', 'none');
  await expect(page.locator('#op-ns-scrim')).toHaveCSS('display', 'none');
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 B3: the fit routine counts the Next Steps button - it never overlaps the steps or spills outside the bar, at every width', async ({ page }) => {
  for (const { width, height } of OP_WIDTHS) {
    const h = await harness(page);
    await page.setViewportSize({ width, height });
    await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
    await openForm(page);
    await pickTomSelect(page, 'teacher', 'Test Teacher');
    await expect(stripLine(page)).toContainText('open since', { timeout: 10_000 });
    await pinBarPastCard(page);

    const r = await page.evaluate(() => {
      const bar = document.getElementById('op-bar')!.getBoundingClientRect();
      const steps = document.getElementById('op-bar-steps')!.getBoundingClientRect();
      const ns = document.getElementById('op-bar-ns-btn')!.getBoundingClientRect();
      return { stepsRight: steps.right, nsLeft: ns.left, nsRight: ns.right, barRight: bar.right, barLeft: bar.left };
    });
    expect(r.stepsRight, `${width}px: the steps overlap the Next Steps button`).toBeLessThanOrEqual(r.nsLeft + 1);
    expect(r.nsRight, `${width}px: the Next Steps button spills outside the bar`).toBeLessThanOrEqual(r.barRight + 1);
    expect(r.nsLeft, `${width}px: the Next Steps button starts left of the bar`).toBeGreaterThanOrEqual(r.barLeft - 1);
    expect(h.errors).toEqual([]);
  }
});

/* ===================================================================
   otp-v0.12 P3 · docked buttons sit fully INSIDE the bar (owner's iPad
   screenshot: the docked Agenda/Check pills sat exactly on the bar's
   rounded ends and border, overlapping them). Approved fix (option A):
   the bar keeps its own size; the docked pills move inward by the same
   margin already used above/below them (bar height minus pill height,
   halved - the number opBarSyncBtnTop already computes for vertical
   centring), and the bar's own end padding grows by that same amount so
   the Active pill / step icons / Next Steps button never collide with
   them either. Reuses the B2/B3 fixtures and OP_WIDTHS verbatim, plus
   the three landscape mirrors of the same iPad sizes (width/height
   swapped) so both orientations are proved, not just portrait.
   =================================================================== */

const P3_LANDSCAPE_WIDTHS = OP_WIDTHS.map(({ width, height }) => ({ width: height, height: width }));
const P3_WIDTHS = [...OP_WIDTHS, ...P3_LANDSCAPE_WIDTHS];

const P3_SHOTS_DIR = '/Users/igor/Developer/claudex-runs/otp-v0.12/p3/shots';
fs.mkdirSync(P3_SHOTS_DIR, { recursive: true });

/** Every rect that shares the 44px bar: the bar itself, the docked Agenda/
 *  Check pills, the Active pill, and the Next Steps button. Returned as
 *  plain objects (a getBoundingClientRect() clone survives page.evaluate's
 *  JSON serialisation with the same left/right/top/bottom/width/height
 *  fields, just not the DOMRect prototype). */
const opBarP3Layout = (page: Page) => page.evaluate(() => {
  const rect = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
  return {
    bar: rect(document.getElementById('op-bar')),
    agenda: rect(document.querySelector('.float-link.agenda')),
    check: rect(document.querySelector('.float-link.check')),
    active: rect(document.getElementById('op-bar-active')),
    ns: rect(document.getElementById('op-bar-ns-btn')),
    dots: Array.from(document.querySelectorAll('#op-bar .op-step-dot')).map((el) => el.getBoundingClientRect()),
  };
});

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
const rectsOverlap = (a: Box, b: Box, tol = 1) =>
  a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol;

/** height/padding/background/border/radius/font-size, the look docking must
 *  never touch (position is the only thing that may change) - the same
 *  property list the existing B2 "one identical pill family" spec reads. */
const P3_STYLE_PROPS = ['height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'backgroundColor', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderRadius', 'fontSize'] as const;
const readP3Style = (page: Page, sel: string) => page.evaluate(({ sel, props }) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  if (!el) return null;
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const p of props) out[p] = (cs as any)[p] ?? '';
  return out;
}, { sel, props: P3_STYLE_PROPS });

const runP3Check = (stateName: 'step-1' | 'open', lapState: any, waitForStrip: (page: Page) => Promise<unknown>) => {
  for (const theme of ['light', 'dark'] as const) {
    test(`otp-v0.12 P3: bar: docked buttons sit inside the bar with an even inset, no overlap (${theme}/${stateName})`, async ({ page }) => {
      for (const { width, height } of P3_WIDTHS) {
        const h = await harness(page);
        await page.setViewportSize({ width, height });
        await mockLapState(page, lapState);
        await openForm(page);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(300);   // let the theme's colour transition settle before measuring

        const undockedAgenda = await readP3Style(page, '.float-link.agenda');
        const undockedCheck = await readP3Style(page, '.float-link.check');

        await pickTomSelect(page, 'teacher', 'Test Teacher');
        await waitForStrip(page);
        await pinBarPastCard(page);
        await page.waitForTimeout(300);   // theme transition + 260ms dock transition settle

        const tag = `${width}x${height} ${theme}/${stateName}`;
        const layout = await opBarP3Layout(page);
        expect(layout.bar, `${tag}: bar missing`).not.toBeNull();
        expect(layout.agenda, `${tag}: agenda missing`).not.toBeNull();
        expect(layout.check, `${tag}: check missing`).not.toBeNull();
        const bar = layout.bar as Box;
        const agenda = layout.agenda as Box;
        const check = layout.check as Box;

        // (1) each docked button's rect lies inside the bar's rect, side
        // margin >= 6px, and the side margin equals the top/bottom margin
        // within 1.5px (the button is centred vertically already; this
        // proves it is now centred the SAME amount horizontally too).
        const leftMargin = agenda.left - bar.left;
        const rightMargin = bar.right - check.right;
        const agendaTopMargin = agenda.top - bar.top;
        const agendaBottomMargin = bar.bottom - agenda.bottom;
        const checkTopMargin = check.top - bar.top;
        const checkBottomMargin = bar.bottom - check.bottom;

        expect(agenda.left, `${tag}: agenda left of the bar`).toBeGreaterThanOrEqual(bar.left - 0.5);
        expect(agenda.right, `${tag}: agenda spills past the bar's right edge`).toBeLessThanOrEqual(bar.right + 0.5);
        expect(check.left, `${tag}: check spills past the bar's left edge`).toBeGreaterThanOrEqual(bar.left - 0.5);
        expect(check.right, `${tag}: check right of the bar`).toBeLessThanOrEqual(bar.right + 0.5);

        expect(leftMargin, `${tag}: agenda left margin ${leftMargin.toFixed(2)} < 6px`).toBeGreaterThanOrEqual(6);
        expect(rightMargin, `${tag}: check right margin ${rightMargin.toFixed(2)} < 6px`).toBeGreaterThanOrEqual(6);
        expect(Math.abs(leftMargin - agendaTopMargin), `${tag}: agenda side (${leftMargin.toFixed(2)}) vs top (${agendaTopMargin.toFixed(2)}) margin`).toBeLessThanOrEqual(1.5);
        expect(Math.abs(leftMargin - agendaBottomMargin), `${tag}: agenda side (${leftMargin.toFixed(2)}) vs bottom (${agendaBottomMargin.toFixed(2)}) margin`).toBeLessThanOrEqual(1.5);
        expect(Math.abs(rightMargin - checkTopMargin), `${tag}: check side (${rightMargin.toFixed(2)}) vs top (${checkTopMargin.toFixed(2)}) margin`).toBeLessThanOrEqual(1.5);
        expect(Math.abs(rightMargin - checkBottomMargin), `${tag}: check side (${rightMargin.toFixed(2)}) vs bottom (${checkBottomMargin.toFixed(2)}) margin`).toBeLessThanOrEqual(1.5);

        // (2) no overlap between docked Agenda, the Active pill, the step
        // icons, the Next Steps button, docked Check Teacher.
        const named: [string, Box | null][] = [
          ['docked Agenda', agenda], ['Active pill', layout.active as Box | null],
          ['Next Steps button', layout.ns as Box | null], ['docked Check Teacher', check],
        ];
        const present = named.filter((pair): pair is [string, Box] => pair[1] !== null);
        for (let i = 0; i < present.length; i++) {
          for (let j = i + 1; j < present.length; j++) {
            const [nameA, boxA] = present[i];
            const [nameB, boxB] = present[j];
            expect(rectsOverlap(boxA, boxB), `${tag}: ${nameA} overlaps ${nameB}`).toBe(false);
          }
        }
        (layout.dots as Box[]).forEach((dot, i) => {
          expect(rectsOverlap(dot, agenda), `${tag}: step icon ${i + 1} overlaps docked Agenda`).toBe(false);
          expect(rectsOverlap(dot, check), `${tag}: step icon ${i + 1} overlaps docked Check Teacher`).toBe(false);
        });

        // (3) the docked buttons' own look is untouched by docking.
        const dockedAgenda = await readP3Style(page, '.float-link.agenda');
        const dockedCheck = await readP3Style(page, '.float-link.check');
        for (const prop of P3_STYLE_PROPS) {
          expect(dockedAgenda?.[prop], `${tag}: agenda ${prop} changed while docked`).toBe(undockedAgenda?.[prop]);
          expect(dockedCheck?.[prop], `${tag}: check ${prop} changed while docked`).toBe(undockedCheck?.[prop]);
        }

        // one PNG of the bar per width, light theme, open state, for the verifier.
        if (theme === 'light' && stateName === 'open') {
          await page.locator('#op-bar').screenshot({ path: `${P3_SHOTS_DIR}/bar-${width}.png` });
        }

        expect(h.errors).toEqual([]);
      }
    });
  }
};

runP3Check('step-1', LAP_STATE_NEVER, (page) =>
  expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 }));
runP3Check('open', LAP_STATE_OPEN_WITH_OWN_STEPS, (page) =>
  expect(stripLine(page)).toContainText('open since', { timeout: 10_000 }));

/* ===================================================================
   otp-v0.12 P2-C · visible-top pin
   iPad Safari pans the visual viewport DOWN inside the layout viewport
   while a text field is focused and the keyboard accessory strip is up
   (device-measured offsetTop 59-71px); position:fixed top elements stay
   at the LAYOUT top, so the pinned bar and the docked Agenda/Check
   Teacher buttons end up hidden under Safari's collapsed toolbar until
   the page scrolls back to the very top - the owner's exact report.
   These specs stub window.visualViewport as a real EventTarget so
   offsetTop can be changed and 'scroll' replayed; the existing
   fakeViewport() above only supports height + a resize dispatch, not
   offsetTop or a scroll event, so it is not reused here.
   =================================================================== */

/** Replaces window.visualViewport with a real EventTarget the test can
 *  drive directly (offsetTop/height/etc settable, 'scroll'/'resize'
 *  dispatchable), before any page script runs. */
async function stubVisualViewport(page: Page) {
  await page.addInitScript(() => {
    class FakeVisualViewport extends EventTarget {
      offsetTop = 0;
      offsetLeft = 0;
      pageTop = 0;
      pageLeft = 0;
      height = window.innerHeight;
      width = window.innerWidth;
      scale = 1;
    }
    const fake = new FakeVisualViewport();
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
    (window as any).__vv = fake;
  });
}

/** Sets one or more visualViewport properties then dispatches `type`
 *  ('scroll' by default), the same way the real API notifies listeners. */
async function setVV(page: Page, patch: Record<string, number>, type: 'scroll' | 'resize' = 'scroll') {
  await page.evaluate(
    ({ patch, type }) => {
      const vv = (window as any).__vv;
      Object.assign(vv, patch);
      vv.dispatchEvent(new Event(type));
    },
    { patch, type },
  );
}

/** Polls until documentElement's --vv-top custom property equals `px`+'px' -
 *  0 also accepts unset/empty (the ?d=notoppin case never sets it at all
 *  and relies on the CSS fallback). */
async function waitForVVTop(page: Page, px: number) {
  await page.waitForFunction(
    (wanted) => {
      const v = document.documentElement.style.getPropertyValue('--vv-top').trim();
      return wanted === 0 ? (v === '' || v === '0px') : v === wanted + 'px';
    },
    px,
    { timeout: 5_000 },
  );
}

const OP_TOP_WIDTH = { width: 834, height: 1194 };

test('otp-v0.12 P2-C (a): the pinned bar and its docked buttons follow visualViewport.offsetTop', async ({ page }) => {
  await stubVisualViewport(page);
  const h = await harness(page);
  await page.setViewportSize(OP_TOP_WIDTH);
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
  await scrollAndWaitForBar(page, 1600, true);

  // offsetTop 0: the bar's rendered top IS the computed --op-bar-top in px
  // (translate is 0 at this point), so this doubles as that measurement.
  const baseline = (await page.locator('#op-bar').boundingBox())!;

  await setVV(page, { offsetTop: 70 });
  await waitForVVTop(page, 70);

  const shifted = (await page.locator('#op-bar').boundingBox())!;
  expect(shifted.y - baseline.y, 'bar did not follow the visible top').toBeGreaterThanOrEqual(69);
  expect(shifted.y - baseline.y, 'bar over-shifted').toBeLessThanOrEqual(71);

  const vvHeight = await page.evaluate(() => (window as any).__vv.height);
  const agenda = (await page.locator('.float-link.agenda').boundingBox())!;
  const check = (await page.locator('.float-link.check').boundingBox())!;
  expect(agenda.y, 'docked Agenda hidden above the visible top').toBeGreaterThanOrEqual(69);
  expect(agenda.y, 'docked Agenda below the visible viewport').toBeLessThanOrEqual(70 + vvHeight);
  expect(check.y, 'docked Check Teacher hidden above the visible top').toBeGreaterThanOrEqual(69);
  expect(check.y, 'docked Check Teacher below the visible viewport').toBeLessThanOrEqual(70 + vvHeight);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 P2-C (b): the undocked Agenda / Check Teacher follow visualViewport.offsetTop at the page top', async ({ page }) => {
  await stubVisualViewport(page);
  const h = await harness(page);
  await page.setViewportSize(OP_TOP_WIDTH);
  await openForm(page);

  const agenda0 = (await page.locator('.float-link.agenda').boundingBox())!;
  const check0 = (await page.locator('.float-link.check').boundingBox())!;

  await setVV(page, { offsetTop: 70 });
  await waitForVVTop(page, 70);

  const agenda70 = (await page.locator('.float-link.agenda').boundingBox())!;
  const check70 = (await page.locator('.float-link.check').boundingBox())!;
  expect(agenda70.y - agenda0.y, 'Agenda did not shift with the visible top').toBeGreaterThanOrEqual(69);
  expect(agenda70.y - agenda0.y, 'Agenda over-shifted').toBeLessThanOrEqual(71);
  expect(check70.y - check0.y, 'Check Teacher did not shift with the visible top').toBeGreaterThanOrEqual(69);
  expect(check70.y - check0.y, 'Check Teacher over-shifted').toBeLessThanOrEqual(71);
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 P2-C (c): the scroll-driven "card gone" signal shows and hides the bar on its own, with the IntersectionObserver dead', async ({ page }) => {
  await page.addInitScript(() => {
    class DeadIO {
      constructor(_cb: any) { /* never calls back */ }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as any).IntersectionObserver = DeadIO;
  });
  const h = await harness(page);
  await page.setViewportSize(OP_TOP_WIDTH);
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });

  await scrollAndWaitForBar(page, 1600, true);   // IO is dead: only the scroll fallback can drive this
  await scrollAndWaitForBar(page, 0, false);     // and back
  expect(h.errors).toEqual([]);
});

test('otp-v0.12 P2-C (d): ?d=notoppin keeps --vv-top at 0px', async ({ page }) => {
  await stubVisualViewport(page);
  const h = await harness(page);
  await page.setViewportSize(OP_TOP_WIDTH);
  await mockLapState(page, LAP_STATE_NEVER);
  await page.goto(FORM_URL + '?d=notoppin');
  await passGate(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).not.toHaveText('Select a teacher', { timeout: 10_000 });
  await scrollAndWaitForBar(page, 1600, true);

  const baseline = (await page.locator('#op-bar').boundingBox())!;
  await setVV(page, { offsetTop: 70 });
  await page.waitForTimeout(300);   // give a (wrongly) attached listener every chance to fire

  const after = (await page.locator('#op-bar').boundingBox())!;
  expect(Math.abs(after.y - baseline.y), '?d=notoppin: bar shifted anyway').toBeLessThanOrEqual(1);
  const vvTop = await page.evaluate(() => document.documentElement.style.getPropertyValue('--vv-top'));
  expect(vvTop, '?d=notoppin: --vv-top must never be set').toBe('');
  expect(h.errors).toEqual([]);
});
