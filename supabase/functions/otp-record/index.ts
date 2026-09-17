// otp-record · otp-v0.10 Phase 3 · the OTP form's Supabase-first RECORD read.
//
// GET ?token=<32hex>   or   POST { token: '<32hex>' }
//   1. otp_record_by_token(token) in Postgres (service key, server-side only):
//      the record's content minus record_token, in about a second where the
//      Apps Script Sheet scan takes 3-45 s.
//   2. Answers the form the SAME shape doGetOtp does, plus its source:
//      { success:true, data, pad_files?, form:'otp', source:'supabase' }.
//   3. A record carrying an evidence_pad_id also gets its pad page names,
//      listed from the private bucket with the service key, mirroring
//      Assets/R3/apps-script/06_PadExtract.gs listPadFiles. A storage failure
//      only drops pad_files; the record still answers. The pad page IMAGES
//      stay on Apps Script (?action=pad_image), token-gated and lazy.
//
// Hard rule 10: an exact match on the canonical 32-hex token is the only way
// in (nothing is lowercased, only surrounding whitespace is trimmed, exactly
// as Apps Script compares), and every miss answers the SAME generic body, so a
// caller cannot probe. Hard rule 12: an internal failure answers that same
// body too, never a stack and never a different message, and the form falls
// back to the Apps Script read. A token is never logged.
//
// Deployed with JWT verification OFF: the ungated teacher viewer carries no
// Supabase key at all (hard rule 14), so the token in the record link is the
// only credential, exactly as on the Apps Script endpoint it sits in front of.
//
// Deploy: supabase functions deploy otp-record --project-ref rfbetrcevtmisknndpgg --no-verify-jwt --use-api

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PAD_BUCKET = 'evidence-pads';
const CANONICAL_TOKEN = /^[0-9a-f]{32}$/;
const MAX_BODY_BYTES = 10_000;

// The one answer every miss gets: a wrong token, a short token, no token, a
// record that is not there, a database or storage failure. Byte-identical.
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
  if (!r.ok) throw new Error(`${fn} HTTP ${r.status}`);
  return text ? JSON.parse(text) : null;
}

// The pad's page JPEGs, by name, exactly as listPadFiles reads them: a list of
// the private bucket under the pad id's prefix, newest schema and legacy alike.
// Any problem answers [] so the record still loads (hard rule 12).
async function listPadFiles(padId: string): Promise<string[]> {
  const id = String(padId || '').trim();
  if (!CANONICAL_TOKEN.test(id)) return [];
  try {
    const r = await fetch(`${SB_URL}/storage/v1/object/list/${PAD_BUCKET}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: id, limit: 24, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!r.ok) return [];
    const files = await r.json();
    if (!Array.isArray(files)) return [];
    return files
      .map((f: any) => String((f && f.name) || ''))
      .filter((n: string) => /\.jpg$/.test(n));
  } catch (_e) {
    return [];
  }
}

function tokenFromRequest(req: Request, raw: string): string {
  if (req.method === 'GET') {
    return String(new URL(req.url).searchParams.get('token') || '').trim();
  }
  try {
    const body = JSON.parse(raw || '{}');
    return String((body && body.token) || '').trim();
  } catch (_e) {
    return '';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return json(MISS, 405);

  const t0 = Date.now();
  try {
    if (!SB_URL || !SERVICE_KEY) return json(MISS);

    const raw = req.method === 'POST' ? await req.text() : '';
    if (raw.length > MAX_BODY_BYTES) return json(MISS);
    const token = tokenFromRequest(req, raw);
    // Not the canonical form: a miss on both backends, so never a DB call.
    if (!CANONICAL_TOKEN.test(token)) return json(MISS);

    const out = await rpc('otp_record_by_token', { p_token: token });
    if (!out || out.found !== true || !out.data) return json(MISS);

    const answer: Record<string, unknown> = {
      success: true,
      data: out.data,
      form: 'otp',
      source: 'supabase',
    };
    const padId = String((out.data as any).evidence_pad_id || '').trim();
    if (padId) {
      const files = await listPadFiles(padId);
      if (files.length) answer.pad_files = files;
    }
    console.log(JSON.stringify({ record: (out.data as any).record_id, ms: Date.now() - t0 }));
    return json(answer);
  } catch (e) {
    // Never the caller's problem and never a different message (hard rule 12):
    // the form falls back to the Apps Script read on this exact body.
    console.log(JSON.stringify({ record: '', ms: Date.now() - t0, error: String(e) }));
    return json(MISS);
  }
});
