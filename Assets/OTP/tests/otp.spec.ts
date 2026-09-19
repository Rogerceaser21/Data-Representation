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
  await expect(page.locator('.form-footer')).toContainText(/otp-v0\.10/i);
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
  const contractKeys = Object.keys(body).filter((k) => k !== 'record_token' && k !== 'enforce_open_block');
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

    await expect(page.locator('.form-footer')).toContainText(/otp-v0\.10/i);
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
  expect(banner).toContain('Observation 1 · open');
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
  // CNL-001 (otp-v0.11 fix round 1): every write, including update, now
  // carries this transport flag too (plan 3.6), same treatment as action/record_token.
  expect(body.enforce_open_block).toBe('true');
  // the submit contract, unchanged: the SAME 32 keys, plus action + record_token + enforce_open_block
  const contract = Object.keys(body).filter((k) => k !== 'action' && k !== 'record_token' && k !== 'enforce_open_block');
  expect(contract.sort()).toEqual(CONTRACT_KEYS);
  expect(contract).toHaveLength(32);
  expect(Object.keys(body)).toHaveLength(35);
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
  expect(Object.keys(h.posts[0])).toHaveLength(35);

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
  expect(await bannerText(page)).toContain('Observation 1 · open');
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
    baseURL: 'http://127.0.0.1:8123',
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

test('otp-v0.11: the status strip renders the four worked examples of plan 2.1', async ({ page }) => {
  // 1. never observed this year
  let h = await harness(page);
  await mockLapState(page, LAP_STATE_NEVER);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toHaveText(`Teacher not observed yet · ${schoolYearLabel()}`, { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Current', 'Coming soon', 'Pending', 'Pending', 'Coming soon', 'Pending']);
  await expect(page.locator('#strip-continue')).toBeHidden();
  expect(h.errors).toEqual([]);

  // 2. open observation (Igor Sesar today)
  h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(stripLine(page)).toHaveText(
    new RegExp(`^Observation 2 · open since ${dayPat('2026-09-16')} · coach Igor Sesar$`),
    { timeout: 10_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Current', 'Coming soon', 'Pending']);
  await expect(page.locator('#strip-continue')).toBeVisible();
  await expect(page.locator('#strip-continue')).toHaveText('Continue Observation 2');
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
    ['Current', 'Coming soon', 'Pending', 'Pending', 'Coming soon', 'Pending']);
  await expect(page.locator('#strip-continue')).toBeHidden();
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
  await expect(page.locator('#strip-continue')).toBeHidden();
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

test('otp-v0.11 task 7: Continue is a button (never a link), and its token never appears in the DOM', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  const btn = page.locator('#strip-continue');
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await expect(btn).toHaveText('Continue Observation 2');
  expect(await btn.evaluate((el) => el.tagName)).toBe('BUTTON');
  expect(await btn.evaluate((el) => el.hasAttribute('href'))).toBe(false);
  const token = LAP_STATE_OPEN_WITH_OWN_STEPS.open.record_token;
  const tokenCount = () => page.evaluate(
    (t) => document.documentElement.outerHTML.split(t).length - 1, token,
  );
  expect(await tokenCount(), 'the token must never appear in the DOM').toBe(0);

  await btn.click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  expect(await tokenCount(), 'the token must never appear in the DOM, even mid-edit').toBe(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 task 7 (2.2.2 / 2.2.7): Continue loads the SAME state a matching ?edit= link would, with no page navigation', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  const startUrl = page.url();
  await page.evaluate(() => { (window as any).__navMarker = 'still here'; });
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.locator('#strip-continue').click();

  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  expect(page.url(), 'Continue must never navigate').toBe(startUrl);
  expect(await page.evaluate(() => (window as any).__navMarker)).toBe('still here');
  await expect(page.locator('#btn-save-changes')).toBeVisible();
  await expect(page.locator('#btn-close-lap')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeHidden();
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  expect(await bannerText(page)).toContain('Observation 1 · open');

  // an ?edit= link to the same record lands on the same state
  const h2 = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await openEdit(page);
  await expect(page.locator('#btn-save-changes')).toBeVisible();
  await expect(page.locator('#btn-close-lap')).toBeVisible();
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  expect(await bannerText(page)).toContain('Observation 1 · open');
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
  // held here. C is then picked and answers cleanly via the primary read.
  // Releasing B's held answer must not repaint C's echo with B's history.
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { options });
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
  await pickTomSelect(page, 'teacher', 'Second Teacher');   // C: lap-state answers directly
  await expect(page.locator('#prev-ns-echo-head')).toHaveText('Observation 2 Next Steps', { timeout: 10_000 });
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
  // the held (stale) "open" answer must not have redrawn the strip
  await expect(stripLine(page)).toHaveText(justClosedRe);
  await expect(page.locator('#strip-continue')).toBeHidden();
  expect(h.errors).toEqual([]);
});

test('otp-v0.10: the footer reads otp-v0.10', async ({ page }) => {
  await harness(page);
  await openForm(page);
  await expect(
    page.locator('.form-footer'),
    'footer version was not bumped to otp-v0.10',
  ).toContainText(/otp-v0\.10/i);
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

  expect(await bannerText(page)).toContain('Observation 1 · open');
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
 * otp-v0.11 task 7 · Part A (STRIP-001..003, the three open findings of task 5)
 * ========================================================================== */

test('otp-v0.11 STRIP-001: switching teacher while a fetch is pending shows no stale line, cards or Continue token', async ({ page }) => {
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
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#strip-continue')).toBeVisible({ timeout: 10_000 });
  const token = LAP_STATE_OPEN_WITH_OWN_STEPS.open.record_token;

  await pickTomSelect(page, 'teacher', 'Second Teacher');   // B's answer stalls, released below
  // during the pending request: no previous line, no previous statuses, no
  // Continue control, the token nowhere in the DOM
  await expect(stripLine(page)).toHaveText('Select a teacher');
  expect(await stripStatuses(page)).toEqual(['', '', '', '', '', '']);
  await expect(page.locator('#strip-continue')).toBeHidden();
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
  expect(statuses[3], 'card 4 Current').toBe('Current');
  await expect(stripLine(page)).toContainText('Observation 2 · open since');
  await page.waitForTimeout(1500);   // still well inside the 3 s locked interval
  const statusesLater = await stripStatuses(page);
  expect(statusesLater[0]).toBe('Completed');
  expect(statusesLater[3]).toBe('Current');
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

test('otp-v0.11 plan 2.2 point 1: a teacher with an open observation shows worked example 2 with a Continue button', async ({ page }) => {
  const h = await harness(page);
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await expect(page.locator('#strip-continue')).toHaveText('Continue Observation 2', { timeout: 10_000 });
  await expect(stripLine(page)).toContainText('Observation 2 · open since');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 2: Continue fills the form exactly as ?edit= does and swaps the bottom buttons', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.locator('#strip-continue').click();
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
  await expect(page.locator('#btn-reset')).toBeHidden();
  await expect(page.locator('#btn-submit')).toBeHidden();
  await expect(page.locator('#btn-save-changes')).toBeVisible();
  await expect(page.locator('#btn-close-lap')).toBeVisible();
  await expect(page.locator('#next_step_3')).toHaveValue('Record next step three');
  await expect(page.locator('#room_number')).toHaveValue('12B');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 3: Close Lap after Continue locks the record and shows worked example 4', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await page.locator('#btn-close-lap').click();
  await expect(page.locator('#otp-form')).toHaveClass(/is-locked/, { timeout: 15_000 });
  expect(await stripStatuses(page)).toEqual(
    ['Completed', 'Coming soon', 'Completed', 'Completed', 'Coming soon', 'Completed']);
  await expect(stripLine(page)).toContainText('completed');
  expect(h.posts.filter((p) => p.action === 'close')).toHaveLength(1);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 4 / R7: Save & Lock stays grey while the teacher has an open observation, and names it exactly on tap', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);   // lap 2 open
  await openForm(page);
  await fillRequired(page);
  await expect(page.locator('#btn-submit')).toHaveClass(/disabled/, { timeout: 10_000 });
  await expect(page.locator('#btn-submit')).toHaveAttribute('aria-disabled', 'true');
  await tapCentre(page, '#btn-submit');
  await expect(page.locator('#toast')).toHaveText('Observation 2 is still open. Continue it, or close it first.');
  expect(h.posts, 'no override: nothing was ever posted').toHaveLength(0);
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 5: typed content on the blank form is asked about before Continue, and stays saved as the draft', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.fill('#observer_comments', 'typed before continuing');
  await page.waitForTimeout(400);   // past the 220 ms autosave debounce

  // decline: Continue is aborted, nothing changes
  let lastDialogMsg = '';
  page.once('dialog', (d) => { lastDialogMsg = d.message(); d.dismiss(); });
  await page.locator('#strip-continue').click();
  await page.waitForTimeout(300);
  expect(lastDialogMsg).toBe('Save what you have typed as your draft and continue this observation?');
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#observer_comments')).toHaveValue('typed before continuing');

  // accept: Continue proceeds, and the typed text stays saved as the draft
  page.once('dialog', (d) => d.accept());
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  expect(saved.observer_comments).toBe('typed before continuing');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 6: the Teacher-box x, while continuing, returns to the blank new-observation form (draft comes back, plan 3.5.7)', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(400);   // past the 220 ms autosave: the pick itself is now the draft
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });

  await tsControl(page, 'teacher').locator('.clear-button').click();
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#submitted-banner')).not.toHaveClass(/is-active/);
  await expect(page.locator('#observer_comments')).toHaveValue('');
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  // plan 3.5.7: the draft comes back, and it already named this teacher (the
  // pick that revealed Continue in the first place), so the strip correctly
  // re-reads their live status rather than sitting on a stale grey picture.
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher', { timeout: 10_000 });
  await expect(stripLine(page)).toContainText('Observation 2 · open since', { timeout: 10_000 });
  await expect(page.locator('#strip-continue')).toBeVisible();
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 2.2 point 6 / 3.5.7: with no draft at all, x returns to a genuinely empty grey strip', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  // wipe the draft that the earlier pick left behind, so this exit has
  // nothing at all to restore
  await page.evaluate((k) => localStorage.removeItem(k), DRAFT_KEY);

  await tsControl(page, 'teacher').locator('.clear-button').click();
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(stripLine(page)).toHaveText('Select a teacher');
  await expect(page.locator('#strip-continue')).toBeHidden();
  await expect(page.locator('#teacher')).toHaveValue('');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 hard rule 13: a record loaded via Continue or ?edit= never writes the localStorage or Supabase draft', async ({ page }) => {
  for (const [what, useContinue] of [['Continue', true], ['?edit=', false]] as [string, boolean][]) {
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
    if (useContinue) {
      await openForm(page);
      await pickTomSelect(page, 'teacher', 'Test Teacher');
      await page.locator('#strip-continue').click();
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
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.fill('#next_step_1', 'typed on the blank form, must not survive');
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#next_step_1')).toHaveValue('');
  await expect(page.locator('#next_step_2')).toHaveValue('');
  await expect(page.locator('#next_step_3')).toHaveValue('');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 3.5 point 2: a draft pull that resolves AFTER Continue changes nothing in the loaded record', async ({ page }) => {
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
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await pickTomSelect(page, 'inspector', 'Test Observer');   // triggers pullDraftFromSupabase, held above
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');

  releaseDraftLoad();
  await page.waitForTimeout(500);
  // the late draft pull must not have overwritten the loaded record
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  await expect(page.locator('#next_step_1')).toHaveValue('Record next step one');
  expect(h.errors).toEqual([]);
});

test('otp-v0.11 plan 3.5 point 2: a pad extraction that resolves AFTER Continue changes nothing in the loaded record', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');

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
  await page.locator('#pad-done').click();     // fires the (held) background extraction
  await expect(page.locator('#pad-modal')).not.toHaveClass(/open/);

  await page.locator('#strip-continue').click();   // Continue before the extraction answers
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
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await page.locator('.pad-attach[data-pad-target="observer_comments"]').click();
  await expect.poll(() => padImageCalls.filter((u) => u.includes(`token=${TOKEN_A}`)).length, { timeout: 15_000 }).toBe(1);
  await page.locator('#pad-view-close').click();

  // back to blank, then continue teacher B's open record (same pad filename)
  await tsControl(page, 'teacher').locator('.clear-button').click();
  await pickTomSelect(page, 'teacher', 'Second Teacher');
  await page.locator('#strip-continue').click();
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
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 15_000 });
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

test('CNL-002: typing then clicking Continue at once (no wait) still asks, and the draft holds the typed text', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.fill('#observer_comments', 'typed right before continuing, no wait');
  // no waitForTimeout here: click immediately, inside the 220 ms autosave debounce
  let dialogMsg = '';
  page.once('dialog', (d) => { dialogMsg = d.message(); d.accept(); });
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  expect(dialogMsg).toBe('Save what you have typed as your draft and continue this observation?');
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

test('CNL-004 (i): a late extraction for an ordinary field merges into the draft alongside its existing typed text', async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
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

  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');

  releaseExtract();
  await page.waitForTimeout(500);
  await expect(page.locator('#observer_comments')).toHaveValue('Record observer comments');
  const draft = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), DRAFT_KEY);
  expect(draft.observer_comments).toBe('typed by hand first\n\nlate pad transcription');
  expect(h.errors).toEqual([]);
});

test("CNL-004 (ii): a late criterion-note extraction lands in the draft's sp1_notes, not the loaded record", async ({ page }) => {
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');

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

  await page.locator('#strip-continue').click();
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
  await page.locator('#strip-continue').click();
  await expect(page.locator('#btn-close-lap')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#btn-reset')).toBeHidden();   // still hidden, unchanged (no new control)

  await page.locator('#btn-reset').dispatchEvent('click');

  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher', { timeout: 10_000 });
  await expect(stripLine(page)).toContainText('Observation 2 · open since', { timeout: 10_000 });
  const draftKey = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
  expect(draftKey, 'the draft must still be present, never deleted').not.toBeNull();
  expect(h.errors).toEqual([]);
});

/* ============================================================================
 * otp-v0.11 task 7 · fix round 2 (GPT-5.6 Terra second review, 4 NEW findings)
 * All four are the same class: an await inside a mode transition applied
 * without rechecking the context that started it.
 * ========================================================================== */

test('CNL-006 (a): Reset during a held-back Continue stops it; the form never enters edit mode and the record is never requested', async ({ page }) => {
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
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await pickTomSelect(page, 'inspector', 'Test Observer');   // so the draft sync actually fires
  await page.locator('#strip-continue').click();             // held back inside syncDraftToSupabase
  await page.waitForTimeout(200);
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);

  await page.locator('#btn-reset').click();                  // confirm auto-accepted above
  releaseSync();
  await page.waitForTimeout(500);

  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeVisible();
  expect(recordGets, 'the record must never be requested once Reset stopped Continue').toHaveLength(0);
  expect(h.errors).toEqual([]);
  await expectConsistentFormState(page);
});

test('CNL-006 (b): switching from A to B during a held-back Continue stops it; B is shown and A\'s record is never requested', async ({ page }) => {
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
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await pickTomSelect(page, 'inspector', 'Test Observer');
  await page.locator('#strip-continue').click();
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

test('CNL-008: teacher A (open), switch to B, back to A whose refetch fails - Save & Lock ends enabled with no message', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { options });
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
  await fillRequired(page);
  await expect(page.locator('#btn-submit')).toHaveClass(/disabled/, { timeout: 10_000 });

  await pickTomSelect(page, 'teacher', 'Second Teacher');
  await page.waitForTimeout(200);   // B's own fetch is stuck; never resolves

  await pickTomSelect(page, 'teacher', 'Test Teacher');   // back to A; this refetch fails
  await page.waitForTimeout(500);

  await expect(page.locator('#btn-submit')).not.toHaveClass(/disabled/);
  await expect(page.locator('#btn-submit')).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  expect(h.errors.filter((e) => !/status of 500/.test(e))).toEqual([]);
});

test('CNL-009: Continue rolls back silently when both record sources fail, with the draft and buttons restored', async ({ page }) => {
  const h = await harness(page, { record: { success: false, error: 'Record not found' } });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  await routeEdgeRecord(page, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EDGE_MISS) }));
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.waitForTimeout(400);
  await page.locator('#strip-continue').click();

  await expect(page.locator('#btn-reset')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  await expect(page.locator('#otp-form')).not.toHaveClass(/is-locked/);
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher', { timeout: 10_000 });
  await expect(page.locator('#toast')).not.toHaveClass(/error/);
  await expect(page.locator('#toast')).not.toContainText('Could not load');
  await expect(page.locator('#toast')).not.toContainText('Still loading');
  const draft = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
  expect(draft, 'the draft must be intact').not.toBeNull();
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

test('CNL-011: changing A to B after Continue enters edit mode and before the record answers never strands the page in edit mode', async ({ page }) => {
  const options = JSON.parse(JSON.stringify(OPTIONS_PAYLOAD));
  const list = options.options ? options.options.teachers : options.teachers;
  list.push({ name: 'Second Teacher' });
  const h = await harness(page, { record: RECORD_PAYLOAD_OPEN, options });
  await page.route('**/rest/v1/rpc/get_teacher_lap_state', async (r: Route) => {
    const body = r.request().postDataJSON();
    const answer = body.p_teacher === 'Second Teacher' ? LAP_STATE_NEVER : LAP_STATE_OPEN_WITH_OWN_STEPS;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
  });
  let releaseRecord: () => void = () => {};
  const recordGets = await routeEdgeRecord(page, async (r) => {
    await new Promise<void>((res) => { releaseRecord = res; });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edgeRecord(RECORD_PAYLOAD_OPEN)) });
  });
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await page.locator('#strip-continue').click();
  await expect(page.locator('body')).toHaveClass(/is-editing/, { timeout: 10_000 });   // Continue set EDIT_MODE synchronously

  await pickTomSelect(page, 'teacher', 'Second Teacher');   // bumps the context; does not itself leave edit mode
  releaseRecord();
  await page.waitForTimeout(500);

  expect(recordGets.length, 'the record was requested once, by Continue, before B was picked').toBe(1);
  await expect(page.locator('body')).not.toHaveClass(/is-editing/);
  await expect(page.locator('#btn-reset')).toBeVisible();
  await expect(page.locator('#btn-submit')).toBeVisible();
  await expect(page.locator('#btn-save-changes')).toBeHidden();
  await expect(page.locator('#btn-close-lap')).toBeHidden();
  // exitEditToBlank restores the draft (hard rule 13: nothing typed in edit
  // mode is ever persisted, so B's mid-flight pick was never saved); Test
  // Teacher (A, the draft's own last-saved value) comes back with its own
  // accurate, freshly re-fetched strip, never the stale "just opened" one.
  await expect(tsControl(page, 'teacher')).toContainText('Test Teacher');
  await expect(stripLine(page)).toContainText('Observation 2', { timeout: 10_000 });
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

test('REV-001: continuing a legacy (v1) record then exiting through the Teacher-box x restores the live v2 rubric, not v1', async ({ page }) => {
  const legacyOpen = {
    ...RECORD_PAYLOAD_LEGACY,
    data: { ...RECORD_PAYLOAD_LEGACY.data, status: 'observed', closed_at: '', lap: '2', round: 'OTP Term 1 26-27' },
  };
  const h = await harness(page, { record: legacyOpen });
  await mockLapState(page, LAP_STATE_OPEN_WITH_OWN_STEPS);
  page.on('dialog', (d) => d.accept());   // the chip mark below makes Continue ask first
  await openForm(page);
  await pickTomSelect(page, 'teacher', 'Test Teacher');

  // Good 7 exists only in the LIVE 32-criterion (v2) rubric ("good" tops out
  // at 6 in the legacy 26-paragraph v1); marking it before Continue puts a
  // v2-numbered selection in the draft that a wrong active rubric would
  // misread or lose.
  await chipAt(page, 'good', 7).click();
  await expect(chipAt(page, 'good', 7)).toHaveAttribute('data-state', 'present');
  await page.waitForTimeout(400);   // past the 220ms autosave debounce

  await page.locator('#strip-continue').click();
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
