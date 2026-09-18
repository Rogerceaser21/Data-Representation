// otp-submit · otp-v0.10 Phase 2 · the OTP form's Supabase-first WRITE endpoint.
//
// POST { form:'otp', action?: 'update'|'close', ...fields }  (no action = submit)
//   1. otp_write(action, payload) in Postgres (service key, server-side only):
//      builds/updates the record, idempotent on record_token, answers in ~1 s.
//   2. Answers the form: { success, id, token, status, closed_at, source:'supabase' }.
//   3. AFTER answering (EdgeRuntime.waitUntil) hands the finished record to the
//      Apps Script /exec as { form:'otp', action:'mirror', record, pending_since }:
//      Apps Script writes the Google Sheet row AS GIVEN, sends the emails, and
//      marks the record mirrored. A failed or slow mirror is picked up by the
//      Apps Script heal sweep (every 5 min); the Sheet may lag, never lose.
//
// Deployed with JWT verification OFF: the form calls it with the project's
// publishable key, which is not a JWT. The exposure is the same as the
// anonymous Apps Script endpoint it sits in front of (tightened later by the
// @ais.ae sign-in). Nothing here ever sends an email: that stays on Apps Script.
//
// Deploy: supabase functions deploy otp-submit --project-ref rfbetrcevtmisknndpgg --no-verify-jwt --use-api

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ/exec';
const MAX_BODY_BYTES = 1_000_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function rpc(fn: string, body: unknown): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${fn} HTTP ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// Background: the Sheet + emails, via Apps Script. Only the TOKEN is sent:
// Apps Script reads the record's current state back from Supabase itself
// (otp_record_for_mirror), so an out-of-order arrival can never write a stale
// row. Apps Script answers a 302 to script.googleusercontent.com; fetch
// follows it. Capped at 120 s; only logged; the heal sweep is the retry.
const MIRROR_TIMEOUT_MS = 120_000;
async function mirror(record: Record<string, unknown>, pendingSince: string): Promise<void> {
  const t0 = Date.now();
  const id = record.record_id;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MIRROR_TIMEOUT_MS);
  try {
    const r = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ form: 'otp', action: 'mirror', record_token: record.record_token, pending_since: pendingSince }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const text = await r.text();
    let out: any = null;
    try { out = JSON.parse(text); } catch { /* an HTML error page from Google: logged below */ }
    console.log(JSON.stringify({
      mirror: id, ms: Date.now() - t0, http: r.status,
      ok: !!(out && out.success), appended: out?.appended, updated: out?.updated, marked: out?.marked,
      err: out ? out.error : text.slice(0, 120),
    }));
  } catch (e) {
    console.log(JSON.stringify({ mirror: id, ms: Date.now() - t0, error: String(e) }));
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405);
  if (!SB_URL || !SERVICE_KEY) return json({ success: false, error: 'not configured' }, 500);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ success: false, error: 'too large' }, 413);
  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ success: false, error: 'bad json' }, 400); }
  if (!body || typeof body !== 'object' || body.form !== 'otp') {
    return json({ success: false, error: 'not an otp payload' }, 400);
  }
  const action = body.action === 'update' || body.action === 'close' ? body.action : 'submit';

  const t0 = Date.now();
  let out: any;
  try {
    out = await rpc('otp_write', { p_action: action, p_payload: body });
  } catch (e) {
    console.log(JSON.stringify({ action, ms: Date.now() - t0, error: String(e) }));
    return json({ success: false, error: 'write failed' }, 500);
  }
  if (!out || out.success !== true) {
    // e.g. 'Record not found' for an update/close of a closed or unknown lap:
    // the same generic miss Apps Script answers, so the form treats it alike.
    const errCode = (out && out.error) || 'write failed';
    // otp-v0.11 task 7 (plan 3.6): open_observation / already_closed are
    // business answers, not failures. Pass through an allowlist of their
    // metadata so the form can name the right Observation N even when its
    // own strip read was stale or its refresh times out. Nothing else changes.
    if (out && (errCode === 'open_observation' || errCode === 'already_closed')) {
      const extra: Record<string, unknown> = {};
      for (const k of ['lap', 'id', 'status', 'closed_at']) {
        if (out[k] !== undefined) extra[k] = out[k];
      }
      return json({ success: false, error: errCode, ...extra });
    }
    return json({ success: false, error: errCode });
  }

  const { record, pending_since, ...rest } = out;
  // A duplicate answer with a record = the same token re-applied as an update
  // (a retry with more typed in): it needs the mirror too. A duplicate without
  // a record (a closed lap answered as it stands) does not.
  if (record) EdgeRuntime.waitUntil(mirror(record, pending_since));
  console.log(JSON.stringify({ action, id: rest.id, ms: Date.now() - t0, duplicate: !!out.duplicate }));
  return json({ ...rest, source: 'supabase' });
});
