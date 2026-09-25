// otp-reflect · otp-v0.14 T1 · the Teacher Reflection / Plan form's Supabase
// read + write endpoint. Never gated, never carries the Supabase key beyond
// the publishable one baked into the ungated form (same trust model as
// otp-record's ?t= route: the teacher_token in the link is the credential).
//
// GET  ?t=<32hex>          -> { success:true, state } or the generic MISS
//                              { success:false, error:'Record not found' }
// POST { t, parts }        -> otp_reflect_write(t, parts); business errors
//                              (not_open, missing_answers + missing) pass
//                              through; success answers
//                              { success:true, sent, duplicate, state }
//                              (mirror_ref is stripped, never sent to the
//                              browser), then EdgeRuntime.waitUntil POSTs
//                              Apps Script { form:'otp', action:'reflect_mirror',
//                              record_token } (same URL/timeout/logging
//                              pattern as otp-submit's mirror) only when
//                              `sent` is non-empty.
//
// Hard rule 10/12: an exact match on the canonical 32-hex token is the only
// way in (nothing is lowercased beyond trimming), every miss answers the same
// generic body, and a token is never logged.
//
// Deployed with JWT verification OFF: the form calls it with the project's
// publishable key, which is not a JWT (same exposure as otp-submit/otp-record).
//
// Deploy: supabase functions deploy otp-reflect --project-ref rfbetrcevtmisknndpgg --no-verify-jwt --use-api

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbx3efKiQzs2MSwESEuNBCceXr5FqBCXuk1IgSzPFbOVgLSc3fvXy40e8V9lhw_KH0z2nQ/exec';
const CANONICAL_TOKEN = /^[0-9a-f]{32}$/;
const MAX_BODY_BYTES = 100_000;

// The one answer every miss gets: a wrong token, a short token, no token, a
// record that is not there. Byte-identical.
const MISS = { success: false, error: 'Record not found' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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

// Background: the OTP Reflections tab row + the teacher/coach emails, via
// Apps Script. Only the record token is sent: Apps Script reads the
// reflections' current state back from Supabase itself
// (otp_reflection_for_mirror), so an out-of-order arrival can never write a
// stale row. Capped at 120s; only logged; the heal sweep is the retry.
const MIRROR_TIMEOUT_MS = 120_000;
async function mirror(recordToken: string): Promise<void> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MIRROR_TIMEOUT_MS);
  try {
    const r = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ form: 'otp', action: 'reflect_mirror', record_token: recordToken }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const text = await r.text();
    let out: any = null;
    try { out = JSON.parse(text); } catch { /* an HTML error page from Google: logged below */ }
    console.log(JSON.stringify({
      reflectMirror: true, ms: Date.now() - t0, http: r.status,
      ok: !!(out && out.success), err: out ? out.error : text.slice(0, 120),
    }));
  } catch (e) {
    console.log(JSON.stringify({ reflectMirror: true, ms: Date.now() - t0, error: String(e) }));
  } finally {
    clearTimeout(timer);
  }
}

function tokenFromGet(req: Request): string {
  return String(new URL(req.url).searchParams.get('t') || '').trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return json(MISS, 405);

  const t0 = Date.now();
  try {
    if (!SB_URL || !SERVICE_KEY) return json(MISS);

    if (req.method === 'GET') {
      const token = tokenFromGet(req);
      if (!CANONICAL_TOKEN.test(token)) return json(MISS);
      const out = await rpc('otp_reflect_state', { p_teacher_token: token });
      if (!out || out.found !== true) return json(MISS);
      console.log(JSON.stringify({ reflectState: true, ms: Date.now() - t0 }));
      return json({ success: true, state: out });
    }

    // POST
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ success: false, error: 'too large' }, 413);
    let body: any;
    try { body = JSON.parse(raw); } catch { return json(MISS); }
    const token = String((body && body.t) || '').trim();
    if (!CANONICAL_TOKEN.test(token)) return json(MISS);
    const parts = body && typeof body.parts === 'object' && body.parts !== null ? body.parts : null;
    if (!parts) return json({ success: false, error: 'bad payload' });

    const out = await rpc('otp_reflect_write', { p_teacher_token: token, p_parts: parts });
    if (!out || out.success !== true) {
      // Record not found / not_open / missing_answers (+missing): business
      // answers, pass through as-is (never a different message, hard rule 12
      // only guards against a genuinely internal failure, handled below).
      return json(out || MISS);
    }

    const { mirror_ref, ...rest } = out;
    if (Array.isArray(out.sent) && out.sent.length > 0 && mirror_ref) {
      EdgeRuntime.waitUntil(mirror(mirror_ref));
    }
    console.log(JSON.stringify({ reflectWrite: true, ms: Date.now() - t0, sent: out.sent, duplicate: out.duplicate }));
    return json(rest);
  } catch (e) {
    // Never the caller's problem and never a different message (hard rule 12).
    console.log(JSON.stringify({ ms: Date.now() - t0, error: String(e) }));
    return json(MISS);
  }
});
