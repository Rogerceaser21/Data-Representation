/**
 * otp-v0.2 · Progress in Lessons OTP form
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

const RUBRIC = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'rubric-sp1.json'), 'utf8')
) as {
  aspect: string;
  levels: { key: string; label: string; paragraphs: string[] }[];
};

const FORM_URL = '/Assets/OTP/otp-progress-form.html';
const RECORD_URL = '/Assets/OTP/otp-record.html';
const GATE_PASSWORD = 'ais2026ais';

/** Exactly the CONTRACT the OTP backend tasks are built against. */
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
  'observer_comments',
  'other_observations',
  'next_step_1',
  'next_step_2',
  'next_step_3',
  'evidence_pad_id',
].sort();

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

const RECORD_PAYLOAD = {
  success: true,
  data: {
    record_id: 'AIS-OTP-20260903-101500',
    submitted_at: '2026-09-03T10:15:00.000Z',
    teacher: 'Test Teacher',
    support_teachers_cas: 'Ms Support CA',
    time_in: '09:15',
    inspector: 'Test Observer',
    curriculum: 'Australian',
    school: 'Primary',
    observation_date: '2026-09-03',
    room_number: '12B',
    subject: 'Mathematics',
    otp_ref: 'SP1',
    otp_aspect: 'Facilitating better than expected progress',
    // otp-v0.2 format, plus sp1_great as a legacy otp-v0.1 bare number
    sp1_good: '1:not present, 3:partially present',
    sp1_great: '2',
    sp1_selected_text: 'recorded selection',
    sp1_present: 'Great 2',
    sp1_partially_present: 'Good 3',
    sp1_not_present: 'Good 1',
    observer_comments: 'Record observer comments',
    other_observations: 'Record other observations',
    next_step_1: 'Record next step one',
    next_step_2: 'Record next step two',
    next_step_3: 'Record next step three',
  },
  pad_files: [],
};

type Harness = { errors: string[]; posts: any[] };

/** Route every outbound call and collect console/page errors. */
async function harness(page: Page): Promise<Harness> {
  const errors: string[] = [];
  const posts: any[] = [];

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
      return json({ success: true, id: 'AIS-OTP-TEST' });
    }
    if (url.includes('action=options')) {
      expect(url).toContain('form=otp');
      return json(OPTIONS_PAYLOAD);
    }
    if (url.includes('form=otp') && url.includes('token=')) {
      return json(RECORD_PAYLOAD);
    }
    return json({ success: false, error: 'unexpected request: ' + url });
  });

  return { errors, posts };
}

/** Open the gated form: pass the StatiCrypt gate, wait for options to land. */
async function openForm(page: Page) {
  await page.goto(FORM_URL);
  await page.fill('#staticrypt-password', GATE_PASSWORD);
  await page.click('#staticrypt-form .staticrypt-decrypt-button');
  await page.waitForSelector('#otp-form', { state: 'attached' });
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
}

async function pickTomSelect(page: Page, field: string, label: string) {
  await page.locator(`#${field}`).locator('xpath=following-sibling::div[1]').click();
  await page.locator('.ts-dropdown .option', { hasText: label }).first().click();
}

async function fillRequired(page: Page) {
  await pickTomSelect(page, 'teacher', 'Test Teacher');
  await pickTomSelect(page, 'inspector', 'Test Observer');
  await page.locator('#curriculum-pills .pill', { hasText: 'Australian' }).click();
  await page.locator('#school-pills .pill', { hasText: 'Primary' }).click();
  await pickTomSelect(page, 'subject', 'Mathematics');
  await page.fill('#date', '2026-09-03');
  await page.fill('#time_in', '09:15');
}

test.beforeAll(() => {
  for (const f of ['otp-progress-form.html', 'otp-record.html']) {
    const p = path.join(__dirname, '..', f);
    expect(fs.existsSync(p), `${f} missing — run: bash Assets/OTP/encrypt.sh`).toBeTruthy();
  }
});

test('renders all 26 SP1 rubric chips verbatim, in order', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const expected: string[] = [];
  for (const lvl of RUBRIC.levels) expected.push(...lvl.paragraphs);
  expect(expected).toHaveLength(26);

  const chips = page.locator('.rub-chip');
  await expect(chips).toHaveCount(26);
  expect(await chips.allTextContents()).toEqual(expected);

  // layout v2 (approved mock 2026-09-03): the level header carries only the five
  // levels; the aspect sits in a full-width caption row above it.
  expect(await page.locator('#rubric-head th').allTextContents()).toEqual(
    RUBRIC.levels.map((l) => l.label),
  );
  await expect(page.locator('tr.rub-caption .rub-cap-k')).toHaveText('Aspect of Practice');
  await expect(page.locator('tr.rub-caption .rub-cap-v')).toHaveText(RUBRIC.aspect);
  await expect(page.locator('.form-footer')).toContainText('otp-v0.2');

  expect(h.errors).toEqual([]);
});

test('a chip cycles clear -> present -> partial -> absent -> clear', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const good = RUBRIC.levels.find((l) => l.key === 'good')!;
  const beginner = RUBRIC.levels.find((l) => l.key === 'beginner')!;
  const chip = page.locator('.rub-chip[data-level="good"][data-n="2"]');
  const lvl = page.locator('#sp1_good');
  const txt = page.locator('#sp1_selected_text');
  const present = page.locator('#sp1_present');
  const partial = page.locator('#sp1_partially_present');
  const absent = page.locator('#sp1_not_present');

  await expect(chip).toHaveAttribute('data-state', '');
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect(lvl).toHaveValue('');

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

  // a chip in another column keeps its own state alongside
  await chip.click(); // Good 2 -> present
  const other = page.locator('.rub-chip[data-level="beginner"][data-n="1"]');
  await other.click();
  await other.click(); // Beginner 1 -> partially present
  await expect(chip).toHaveAttribute('data-state', 'present');
  await expect(other).toHaveAttribute('data-state', 'partial');
  await expect(lvl).toHaveValue('2:present');
  await expect(page.locator('#sp1_beginner')).toHaveValue('1:partially present');
  await expect(present).toHaveValue('Good 2');
  await expect(partial).toHaveValue('Beginner 1');
  await expect(absent).toHaveValue('');
  await expect(txt).toHaveValue(
    'Beginner 1 (Partially present): ' +
      beginner.paragraphs[0] +
      ' | Good 2 (Present): ' +
      good.paragraphs[1]
  );

  expect(h.errors).toEqual([]);
});

test('two chip states and a note survive a reload via the ais-otp-form-v1 draft', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const presentChip = page.locator('.rub-chip[data-level="great"][data-n="4"]');
  const absentChip = page.locator('.rub-chip[data-level="emerging"][data-n="2"]');
  await presentChip.click(); // one tap  -> present
  await absentChip.click();
  await absentChip.click();
  await absentChip.click(); // three taps -> not present
  await page.fill('#observer_comments', 'Draft survives the reload');
  await page.waitForTimeout(600); // debounced autosave is 220ms

  const key = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.indexOf('ais-otp-form-v1') > -1)
  );
  expect(key).toEqual(['ais-otp-form-v1']);

  await page.reload();
  await openFormAfterReload(page);

  await expect(page.locator('#observer_comments')).toHaveValue('Draft survives the reload');
  await expect(page.locator('#sp1_great')).toHaveValue('4:present');
  await expect(page.locator('#sp1_emerging')).toHaveValue('2:not present');
  await expect(page.locator('#sp1_present')).toHaveValue('Great 4');
  await expect(page.locator('#sp1_not_present')).toHaveValue('Emerging 2');
  await expect(page.locator('#sp1_partially_present')).toHaveValue('');
  await expect(presentChip).toHaveAttribute('data-state', 'present');
  await expect(presentChip).toHaveAttribute('aria-pressed', 'true');
  await expect(absentChip).toHaveAttribute('data-state', 'absent');
  await expect(absentChip).toHaveAttribute('aria-pressed', 'true');

  expect(h.errors).toEqual([]);
});

async function openFormAfterReload(page: Page) {
  await page.fill('#staticrypt-password', GATE_PASSWORD);
  await page.click('#staticrypt-form .staticrypt-decrypt-button');
  await page.waitForSelector('#otp-form', { state: 'attached' });
  await expect(page.locator('#form-loading')).toHaveClass(/is-hidden/, { timeout: 15_000 });
}

test('submit posts exactly the CONTRACT keys with form="otp"', async ({ page }) => {
  const h = await harness(page);
  page.on('dialog', (d) => d.accept());
  await openForm(page);

  await fillRequired(page);
  await page.fill('#room_number', '12B');
  await page.fill('#support_teachers_cas', 'Ms Support CA');
  await page.locator('.rub-chip[data-level="outstanding"][data-n="1"]').click();
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
  expect(body.form).toBe('otp');
  expect(body.otp_ref).toBe('SP1');
  expect(body.otp_aspect).toBe('Facilitating better than expected progress');
  expect(body.teacher).toBe('Test Teacher');
  expect(body.inspector).toBe('Test Observer');
  expect(body.subject).toBe('Mathematics');
  expect(body.school).toBe('Primary');
  expect(body.sp1_outstanding).toBe('1:present');
  expect(body.sp1_beginner).toBe('');
  expect(body.sp1_present).toBe('Outstanding 1');
  expect(body.sp1_partially_present).toBe('');
  expect(body.sp1_not_present).toBe('');
  expect(body.next_step_3).toBe('Step three');

  expect(h.errors).toEqual([]);
});

test('the record view repopulates header fields, chips and the five notes', async ({ page }) => {
  const h = await harness(page);
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });

  await expect(page.locator('#date')).toHaveValue('2026-09-03');
  await expect(page.locator('#room_number')).toHaveValue('12B');
  await expect(page.locator('#time_in')).toHaveValue('09:15');
  await expect(page.locator('#support_teachers_cas')).toHaveValue('Ms Support CA');
  await expect(page.locator('#curriculum')).toHaveValue('Australian');
  await expect(page.locator('#school')).toHaveValue('Primary');
  await expect(page.locator('#teacher')).toHaveValue('t0');
  await expect(page.locator('#inspector')).toHaveValue('i0');
  await expect(page.locator('#subject')).toHaveValue('s0');
  await expect(page.locator('#teacher').locator('xpath=following-sibling::div[1]')).toContainText(
    'Test Teacher'
  );
  await expect(page.locator('#inspector').locator('xpath=following-sibling::div[1]')).toContainText(
    'Test Observer'
  );

  const state = (level: string, n: number) =>
    page.locator(`.rub-chip[data-level="${level}"][data-n="${n}"]`);
  await expect(state('good', 1)).toHaveAttribute('data-state', 'absent');
  await expect(state('good', 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(state('good', 3)).toHaveAttribute('data-state', 'partial');
  await expect(state('good', 3)).toHaveAttribute('aria-pressed', 'true');
  await expect(state('good', 2)).toHaveAttribute('data-state', '');
  await expect(state('good', 2)).toHaveAttribute('aria-pressed', 'false');
  // legacy otp-v0.1 bare number reads as "present"
  await expect(state('great', 2)).toHaveAttribute('data-state', 'present');
  await expect(state('great', 2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sp1_present')).toHaveValue('Great 2');
  await expect(page.locator('#sp1_partially_present')).toHaveValue('Good 3');
  await expect(page.locator('#sp1_not_present')).toHaveValue('Good 1');

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

  // the five pad targets replaced the four R3 ones
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

  expect(h.errors).toEqual([]);
});

test('the Info button opens the colour legend, on the form and on a record', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const info = page.locator('.rub-info');
  const legend = page.locator('#rubric-legend');

  // the button lives in the caption row; the legend is its own header row, so
  // the rubric's scroll wrapper can never clip it
  await expect(page.locator('tr.rub-caption .rub-cap .rub-info')).toHaveCount(1);
  await expect(info).toHaveAttribute('aria-controls', 'rubric-legend');
  await expect(info).toHaveAttribute('aria-expanded', 'false');
  await expect(legend).toBeHidden();

  await info.click();
  await expect(legend).toBeVisible();
  await expect(info).toHaveAttribute('aria-expanded', 'true');
  expect(await legend.locator('.rub-legend-item').allTextContents()).toEqual([
    'Green: present in lesson',
    'Yellow: partially present in lesson',
    'Red: not present in lesson',
  ]);
  await expect(legend.locator('.rub-legend-hint')).toHaveText(
    'Tap a criterion to mark it green; tap again for yellow, again for red; a fourth tap clears it.'
  );

  await info.click();
  await expect(legend).toBeHidden();
  await expect(info).toHaveAttribute('aria-expanded', 'false');

  // and it still opens on a locked record view (lockForm disables fields only)
  await page.goto(RECORD_URL + '?token=abc');
  await expect(page.locator('#submitted-banner')).toHaveClass(/is-active/, { timeout: 20_000 });
  await expect(page.locator('#rubric-legend')).toBeHidden();
  await page.locator('.rub-info').click();
  await expect(page.locator('#rubric-legend')).toBeVisible();
  await expect(page.locator('#rubric-legend')).toContainText('Yellow: partially present in lesson');

  expect(h.errors).toEqual([]);
});
