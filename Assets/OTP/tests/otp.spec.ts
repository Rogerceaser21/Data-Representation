/**
 * otp-v0.1 · Progress in Lessons OTP form
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
    sp1_good: '1,3',
    sp1_great: '2',
    sp1_selected_text: 'recorded selection',
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

  // header row + aspect cell mirror the source doc
  expect(await page.locator('#rubric-head th').allTextContents()).toEqual([
    'Aspect of Practice',
    ...RUBRIC.levels.map((l) => l.label),
  ]);
  await expect(page.locator('.rub-aspect')).toHaveText(RUBRIC.aspect);

  expect(h.errors).toEqual([]);
});

test('a chip toggles aria-pressed and its hidden sp1_* value', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  const chip = page.locator('.rub-chip[data-level="good"][data-n="2"]');
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#sp1_good')).toHaveValue('');

  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sp1_good')).toHaveValue('2');
  await expect(page.locator('#sp1_selected_text')).toHaveValue(
    'Good 2: ' + RUBRIC.levels.find((l) => l.key === 'good')!.paragraphs[1]
  );

  // second chip in another column: both selections coexist
  await page.locator('.rub-chip[data-level="beginner"][data-n="1"]').click();
  await expect(page.locator('#sp1_beginner')).toHaveValue('1');

  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#sp1_good')).toHaveValue('');
  await expect(page.locator('#sp1_beginner')).toHaveValue('1');

  expect(h.errors).toEqual([]);
});

test('a chip selection and a note survive a reload via the ais-otp-form-v1 draft', async ({ page }) => {
  const h = await harness(page);
  await openForm(page);

  await page.locator('.rub-chip[data-level="great"][data-n="4"]').click();
  await page.fill('#observer_comments', 'Draft survives the reload');
  await page.waitForTimeout(600); // debounced autosave is 220ms

  const key = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.indexOf('ais-otp-form-v1') > -1)
  );
  expect(key).toEqual(['ais-otp-form-v1']);

  await page.reload();
  await openFormAfterReload(page);

  await expect(page.locator('#observer_comments')).toHaveValue('Draft survives the reload');
  await expect(page.locator('#sp1_great')).toHaveValue('4');
  await expect(page.locator('.rub-chip[data-level="great"][data-n="4"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

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
  expect(body.sp1_outstanding).toBe('1');
  expect(body.sp1_beginner).toBe('');
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

  await expect(page.locator('.rub-chip[data-level="good"][data-n="1"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.locator('.rub-chip[data-level="good"][data-n="3"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.locator('.rub-chip[data-level="good"][data-n="2"]')).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await expect(page.locator('.rub-chip[data-level="great"][data-n="2"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

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
