/**
 * otp-v0.6 · Progress in Lessons OTP form
 *
 * Tests the BUILT artifacts (the StatiCrypt-gated form and the ungated record
 * viewer), not the master, because the master's relative paths (../R3/lib/,
 * ../brand/) resolve from the OUTPUT location. Run `bash Assets/OTP/encrypt.sh`
 * before this spec; the tests below assert both outputs exist.
 *
 * Every call to script.google.com and supabase.co is mocked; nothing leaves
 * the machine.
 */
import { test, expect, Page, Route } from '@playwright/test';
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
 * rather than against a second hand typed copy of it. NB the heading of §2
 * reads "32 keys" while the list it governs names 31: the enumerated list is
 * the normative one (the 29 keys of otp-v0.5 plus the two new ones, sp1_notes
 * and rubric_version), and the form posts exactly those 31.
 */
const CONTRACT_DOC = path.join(
  __dirname, '..', '..', '..', '.planning', '2026-09-09-otp-v0.6-contract.md',
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
  inspector: 'Test Observer',
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
async function harness(page: Page, opts: { record?: any; extract?: string } = {}): Promise<Harness> {
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
      return json({ success: true, id: 'AIS-OTP-TEST' });
    }
    if (url.includes('action=options')) {
      expect(url).toContain('form=otp');
      return json(OPTIONS_PAYLOAD);
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
}

/** otp-v0.6 helpers: the chip, its "+" note button and the open panel. */
const chipAt = (page: Page, key: string, n: number) =>
  page.locator(`.rub-chip[data-level="${key}"][data-n="${n}"]`);
const noteBtnAt = (page: Page, key: string, n: number) =>
  page.locator(`.rub-note-btn[data-level="${key}"][data-n="${n}"]`);
const notePanel = (page: Page) => page.locator('tr.rub-note-row');
const noteText = (page: Page, key: string, n: number) =>
  page.locator(`#sp1_note_${key}_${n}`);

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
  await expect(page.locator('.form-footer')).toContainText(/otp-v0\.6/i);
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
    expect(s.glyph).toBe('+');
  }
  expect(shape[0].label).toBe('Add a note for Beginner 1');

  // hit area at least 36x36 (the button is a small circle plus a padded ::before)
  const hit = await page.evaluate(() => {
    const btn = document.querySelector('.rub-note-btn') as HTMLElement;
    const r = btn.getBoundingClientRect();
    const before = getComputedStyle(btn, '::before');
    const pad = Math.abs(parseFloat(before.top || '0'));
    return { w: r.width + 2 * pad, h: r.height + 2 * pad, content: before.content };
  });
  expect(hit.w).toBeGreaterThanOrEqual(36);
  expect(hit.h).toBeGreaterThanOrEqual(36);

  // and the "+" never covers a word: the chip reserves the bottom strip it sits in
  const clear = await page.evaluate(() => {
    const chip = document.querySelector('.rub-chip') as HTMLElement;
    const btn = chip.nextElementSibling as HTMLElement;
    const cs = getComputedStyle(chip);
    const chipBox = chip.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    const textBottom = chipBox.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom);
    return { gap: btnBox.top - textBottom, inside: chipBox.bottom - btnBox.bottom };
  });
  expect(clear.gap).toBeGreaterThan(0);
  expect(clear.inside).toBeGreaterThan(0);

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: "+" opens exactly one in-flow panel, toggles it, and swaps between chips', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  await expect(notePanel(page)).toHaveCount(0);

  await noteBtnAt(page, 'good', 3).click();
  await expect(notePanel(page)).toHaveCount(1);
  await expect(page.locator('#rub-note-head')).toHaveText('Note · Good 3 · Not assessed');
  await expect(page.locator('.rub-note-crit')).toHaveText(criterion('good', 3));
  await expect(noteText(page, 'good', 3)).toHaveCount(1);
  // no name attribute: the note is never posted or drafted from the textarea
  expect(
    await noteText(page, 'good', 3).evaluate((el) => (el as HTMLTextAreaElement).name),
  ).toBe('');

  // the panel is a normal table row directly after the chip row, one td colspan 5
  const flow = await page.evaluate(() => {
    const row = document.querySelector('tr.rub-note-row') as HTMLElement;
    const td = row.querySelector('td') as HTMLElement;
    return {
      afterChipRow: row.previousElementSibling!.id,
      parentTag: row.parentElement!.tagName,
      tdCount: row.querySelectorAll('td').length,
      colspan: td.getAttribute('colspan'),
      rowPosition: getComputedStyle(row).position,
      tdPosition: getComputedStyle(td).position,
      bodyPosition: getComputedStyle(document.body).position,
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyTop: document.body.style.top,
      focusIsTextarea: document.activeElement === document.querySelector('#sp1_note_good_3'),
    };
  });
  expect(flow.afterChipRow).toBe('rubric-row');
  expect(flow.parentTag).toBe('TBODY');
  expect(flow.tdCount).toBe(1);
  expect(flow.colspan).toBe('5');
  // iPad law: never a fixed overlay, never a scroll lock, never a body reposition
  expect(flow.rowPosition).not.toBe('fixed');
  expect(flow.tdPosition).not.toBe('fixed');
  expect(flow.bodyPosition).toBe('static');
  expect(flow.bodyOverflow).not.toBe('hidden');
  expect(flow.bodyTop).toBe('');
  // and no auto-focus: a Pencil user must not get the keyboard
  expect(flow.focusIsTextarea).toBe(false);

  // the panel carries this criterion's Evidence Pad buttons
  await expect(
    notePanel(page).locator('.pad-field-btn[data-pad-target="sp1_good_3_note"]'),
  ).toHaveCount(1);
  await expect(
    notePanel(page).locator('.pad-attach[data-pad-target="sp1_good_3_note"]'),
  ).toBeHidden();

  // another chip's "+" swaps the panel rather than opening a second one
  await noteBtnAt(page, 'great', 5).click();
  await expect(notePanel(page)).toHaveCount(1);
  await expect(page.locator('#rub-note-head')).toHaveText('Note · Great 5 · Not assessed');

  // the same "+" again closes it, and so does Done
  await noteBtnAt(page, 'great', 5).click();
  await expect(notePanel(page)).toHaveCount(0);
  await noteBtnAt(page, 'great', 5).click();
  await page.locator('.rub-note-done').click();
  await expect(notePanel(page)).toHaveCount(0);

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: "+" never cycles the colour, and the chip never opens the panel', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const chip = chipAt(page, 'good', 2);
  await expect(chip).toHaveAttribute('data-state', '');
  for (let i = 0; i < 3; i++) {
    await noteBtnAt(page, 'good', 2).click();
    await expect(chip).toHaveAttribute('data-state', '');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(page.locator('#sp1_good')).toHaveValue('');

  // and tapping the chip cycles the colour without opening a panel
  await noteBtnAt(page, 'good', 2).click();       // close the panel first
  await expect(notePanel(page)).toHaveCount(0);
  await chip.click();
  await expect(chip).toHaveAttribute('data-state', 'present');
  await expect(notePanel(page)).toHaveCount(0);

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: a typed note writes sp1_notes, sp1_selected_text and the badge', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const notes = page.locator('#sp1_notes');
  const txt = page.locator('#sp1_selected_text');
  await expect(notes).toHaveValue('');

  // a note on an UNCOLOURED chip reads "(Not assessed)" and still lands
  await noteBtnAt(page, 'good', 3).click();
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

  // colouring the chip while the panel is open updates the header live
  await chipAt(page, 'good', 3).click();
  await expect(page.locator('#rub-note-head')).toHaveText('Note · Good 3 · Present');
  await expect(txt).toHaveValue(
    `Good 3 (Present): ${criterion('good', 3)} Note: challenge is not provided`,
  );
  await chipAt(page, 'good', 3).click();
  await expect(page.locator('#rub-note-head')).toHaveText('Note · Good 3 · Partially present');

  // a second note, on a different level: keys stay in level order then ascending n
  await noteBtnAt(page, 'great', 5).click();
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
  // only one panel is ever open, so come back to Good 3 before clearing it
  await noteBtnAt(page, 'good', 3).click();
  await expect(page.locator('#rub-note-head')).toHaveText('Note · Good 3 · Partially present');
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
  await noteBtnAt(page, 'outstanding', 6).click();
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
  await noteBtnAt(page, 'outstanding', 6).click();
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

test('the CONTRACT key list is the contract §2 list verbatim, 31 keys', async () => {
  const fromDoc = contractKeysFromDoc();
  expect(fromDoc).toEqual(CONTRACT_KEYS);
  expect(fromDoc).toHaveLength(31);
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
  await noteBtnAt(page, 'outstanding', 1).click();
  await noteText(page, 'outstanding', 1).fill('pathway chosen from the exit ticket');
  await noteBtnAt(page, 'beginner', 2).click();
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
  expect(Object.keys(body)).toHaveLength(31);   // §2 list, counted not assumed
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
  await noteBtnAt(page, 'great', 5).click();
  await expect(notePanel(page)).toHaveCount(1);
  await expect(page.locator('#rub-note-head')).toHaveText('Note · Great 5 · Not assessed');
  await expect(noteText(page, 'great', 5)).toHaveValue('students still on SC1');
  expect(
    await noteText(page, 'great', 5).evaluate((el) => (el as HTMLTextAreaElement).readOnly),
  ).toBe(true);
  await expect(notePanel(page).locator('.pad-field-btn')).toBeHidden();
  // this criterion HAS a pad page, so its paperclip shows (slug sp1-great-5-note)
  await expect(
    notePanel(page).locator('.pad-attach[data-pad-target="sp1_great_5_note"]'),
  ).toBeVisible();
  await noteBtnAt(page, 'good', 3).click();
  await expect(page.locator('#rub-note-head')).toHaveText('Note · Good 3 · Partially present');
  // Good 3 has no pad page, so its paperclip stays hidden
  await expect(
    notePanel(page).locator('.pad-attach[data-pad-target="sp1_good_3_note"]'),
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
    'time_out',
    'num_sen',
  ]) {
    await expect(page.locator('#' + id), `#${id} should be gone`).toHaveCount(0);
    await expect(page.locator(`[name="${id}"]`), `[name=${id}] should be gone`).toHaveCount(0);
  }

  // the five pad targets replaced the four R3 ones (the 32 criterion-note
  // launchers live inside a note panel, which is closed here)
  await expect(page.locator('.pad-field-btn[data-pad-target]')).toHaveCount(5);
  expect(
    await page.locator('.pad-field-btn').evaluateAll((els) =>
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

test('the three recorded states paint the AIS state colours in the light theme', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);
  // pin the light palette: the runner's prefers-color-scheme must not decide it
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  const targets = [
    { sel: '.rub-chip[data-level="good"][data-n="1"]', taps: 1, paint: 'rgb(46, 161, 90)' },
    { sel: '.rub-chip[data-level="good"][data-n="2"]', taps: 2, paint: 'rgb(255, 186, 20)' },
    { sel: '.rub-chip[data-level="good"][data-n="3"]', taps: 3, paint: 'rgb(239, 52, 58)' },
  ];
  for (const t of targets) {
    for (let i = 0; i < t.taps; i++) await page.locator(t.sel).click();
  }
  await page.mouse.move(0, 0); // no chip left under the pointer
  await page.waitForTimeout(400); // the 0.16s colour transition has settled

  for (const t of targets) {
    const css = await page.locator(t.sel).evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, border: s.borderTopColor, color: s.color };
    });
    expect(css.bg, t.sel).toBe(t.paint);
    expect(css.border, t.sel).toBe(t.paint);
  }
  // yellow is the one state that takes the dark ink
  const yellow = await page
    .locator(targets[1].sel)
    .evaluate((el) => getComputedStyle(el).color);
  expect(yellow).toBe('rgb(20, 54, 66)');

  // otp-v0.6: a filled note badge paints the AIS blue, white glyph, in both themes
  await noteBtnAt(page, 'good', 1).click();
  await noteText(page, 'good', 1).fill('badge paint');
  const badge = noteBtnAt(page, 'good', 1);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.mouse.move(0, 0);      // no hover state on the badge
    await page.waitForTimeout(400);   // the 0.15s colour transition has settled
    const css = await badge.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, border: s.borderTopColor, color: s.color };
    });
    expect(css.bg, theme).toBe('rgb(18, 87, 255)');
    expect(css.border, theme).toBe('rgb(18, 87, 255)');
    expect(css.color, theme).toBe('rgb(255, 255, 255)');
  }

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
    'No colour: not assessed (does not count)',
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
    'Fill Teacher / Time In / Observer / Curriculum / Grade / Date / Subject to enable saving',
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

test('otp-v0.6: no console errors and no horizontal overflow at 1280 and at 820x1180', async ({ page }) => {
  const h = await harness(page);

  for (const size of [
    { width: 1280, height: 900 },
    { width: 820, height: 1180 },   // iPad portrait
  ]) {
    await page.setViewportSize(size);
    await openForm(page);

    // exercise the whole otp-v0.6 surface at this size
    await chipAt(page, 'good', 3).click();
    await noteBtnAt(page, 'good', 3).click();
    await expect(notePanel(page)).toHaveCount(1);
    await noteText(page, 'good', 3).fill('note typed at ' + size.width);
    await expect(noteBtnAt(page, 'good', 3)).toHaveClass(/has-note/);
    await noteBtnAt(page, 'outstanding', 8).click();
    await expect(notePanel(page)).toHaveCount(1);

    const box = await page.evaluate(() => ({
      bodyScroll: document.body.scrollWidth,
      bodyClient: document.body.clientWidth,
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
    }));
    expect(box.bodyScroll, `body at ${size.width}`).toBe(box.bodyClient);
    expect(box.docScroll, `doc at ${size.width}`).toBeLessThanOrEqual(box.docClient);

    // the panel is still in normal flow, never a fixed overlay
    expect(
      await notePanel(page).evaluate((el) => getComputedStyle(el).position),
    ).not.toBe('fixed');

    await expect(page.locator('.form-footer')).toContainText(/otp-v0\.6/i);
    await page.evaluate((k) => localStorage.removeItem(k), DRAFT_KEY);
  }

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: the pad writes a criterion note, and its extract call carries the criterion as context', async ({ page }) => {
  const h = await harness(page, { extract: 'only two of the six groups were stretched' });
  await openForm(page);

  // the pencil inside the note panel opens the pad on THAT criterion's page
  await noteBtnAt(page, 'good', 3).click();
  await notePanel(page).locator('.pad-field-btn[data-pad-target="sp1_good_3_note"]').click();
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
  await noteBtnAt(page, 'good', 3).click();
  await noteText(page, 'good', 3).fill('only one group was stretched');
  await noteBtnAt(page, 'beginner', 2).click();
  await noteText(page, 'beginner', 2).fill('bottom table idle for ten minutes');

  await page.emulateMedia({ media: 'print' });
  await expect(printBox).toBeVisible();
  await expect(printBox.locator('.rub-print-head')).toHaveText('Criterion notes');
  expect(await printBox.locator('.rub-print-item').allTextContents()).toEqual([
    'Beginner 2 (Not assessed): bottom table idle for ten minutes',
    'Good 3 (Present): only one group was stretched',
  ]);
  // the open panel and the empty "+" affordances do not print; a filled one does
  expect(await notePanel(page).evaluate((el) => getComputedStyle(el).display)).toBe('none');
  expect(
    await noteBtnAt(page, 'good', 1).evaluate((el) => getComputedStyle(el).display),
  ).toBe('none');
  await page.waitForTimeout(400);   // the 0.15s badge colour transition has settled
  expect(
    await noteBtnAt(page, 'good', 3).evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgb(18, 87, 255)');
  await page.emulateMedia({ media: 'screen' });

  expect(h.errors).toEqual([]);
});

test('otp-v0.6: Reset clears the notes and keeps rubric_version stamped', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  await chipAt(page, 'great', 1).click();
  await noteBtnAt(page, 'great', 1).click();
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
  await expect(notePanel(page)).toHaveCount(0);
  await expect(page.locator('#rub-print-notes')).toBeEmpty();

  expect(h.errors).toEqual([]);
});
