/**
 * Evidence Pad extraction + storage fetch (v0.50; field-scoped pages v0.51).
 *
 * handlePadExtract: routed from doPost when the form sends
 *   { action: 'extract_pad', image: <base64 JPEG, no data: prefix>, target: <field> }
 * One pad PAGE per call; the form fans pages out in parallel, so each call
 * stays far inside UrlFetchApp's ~60s outbound cap. The page image (Apple
 * Pencil handwriting, sometimes around photos of the board/slides/handouts)
 * goes to Claude (claude-sonnet-5, vision) with a forced JSON schema.
 * v0.51: each pad page belongs to ONE form field (the form sends `target`),
 * so the model only transcribes; no classification guessing. A request
 * without `target` (pre-v0.51 form during deploy skew) falls back to the
 * v0.50 classify-into-four-fields behaviour.
 * The form shows the result in a review step; nothing is auto-inserted.
 *
 * Responses (mirrors the submit contract):
 *   { success: true,  items: [{ target, text }, ...] }
 *   { success: false, error: "..." }
 *
 * fetchPadImages: reads a pad's page JPEGs from the PRIVATE evidence-pads
 * bucket with the service key (anon can only write), for the backup-email
 * attachments in 01_doPost.gs.
 */

const PAD_EXTRACT_MODEL = 'claude-sonnet-5';

const PAD_EXTRACT_TARGETS = ['focus_context', 'observer_notes', 'summary_strengths', 'summary_weakness'];

const PAD_EXTRACT_LABELS = {
  focus_context:     'Focus / Context (the main purpose of the inspection activity)',
  observer_notes:    'Observer Notes (running observations during the lesson)',
  summary_strengths: 'Summary of Strengths (things that went well, effective practice)',
  summary_weakness:  'Summary of Weakness (areas to develop, problems, coaching suggestions)'
};

const PAD_EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target: { type: 'string', enum: PAD_EXTRACT_TARGETS },
          text: { type: 'string' }
        },
        required: ['target', 'text'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
};

// v0.51 field-scoped page: transcription only, no target field to guess
const PAD_EXTRACT_SCHEMA_TARGETED = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' }
        },
        required: ['text'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
};

function padExtractTargetedPrompt(target) {
  return [
    'You are reading ONE page of a handwritten evidence pad from a school lesson observation at AIS Sharjah.',
    'An observer wrote notes with an Apple Pencil, often around photos of the classroom board, slides or handouts, with arrows linking notes to photos or to other notes.',
    '',
    'This whole page belongs to ONE form field: ' + (PAD_EXTRACT_LABELS[target] || target) + '.',
    'Transcribe ALL the handwriting on this page for that field. Rules:',
    '- Transcribe faithfully in the observer\'s own words; fix only obvious letter-level slips.',
    '- Turn arrows and layout into readable prose (e.g. "Referring to the challenge slide: ...").',
    '- Use a photo\'s content only when a note refers to it (to name what the note points at); never describe photos no note refers to.',
    '- Each distinct note becomes one item; keep each item one readable sentence or short line.',
    '- If the page is blank or has no readable handwriting, return an empty items array. Never invent content.'
  ].join('\n');
}

const PAD_EXTRACT_PROMPT = [
  'You are reading ONE page of a handwritten evidence pad from a school lesson observation at AIS Sharjah.',
  'An observer wrote notes with an Apple Pencil, often around photos of the classroom board, slides or handouts, with arrows linking notes to photos or to other notes.',
  '',
  'Transcribe ALL the handwriting on this page and group it into form fields. Rules:',
  '- Transcribe faithfully in the observer\'s own words; fix only obvious letter-level slips.',
  '- Turn arrows and layout into readable prose (e.g. "Referring to the challenge slide: ...").',
  '- Use a photo\'s content only when a note refers to it (to name what the note points at); never describe photos no note refers to.',
  '- Each distinct note becomes one item with exactly one target:',
  '  * summary_strengths: things that went well, praise, effective practice.',
  '  * summary_weakness: areas to develop, problems, and coaching suggestions ("perhaps...", "try...", "next time...").',
  '  * focus_context: notes about the lesson\'s focus, topic, activity or context.',
  '  * observer_notes: everything else (running observations, questions, neutral descriptions).',
  '- Keep each item one readable sentence or short line. When unsure of the target, use observer_notes.',
  '- If the page is blank or has no readable handwriting, return an empty items array. Never invent content.'
].join('\n');

function handlePadExtract(data) {
  try {
    const image = String(data.image || '');
    // ~4M base64 chars ≈ 3MB image; the form sends ~150-400KB pages.
    if (!image || image.length > 4 * 1024 * 1024) {
      return jsonOut({ success: false, error: 'bad image' });
    }
    const key = getAnthropicKey();
    if (!key) return jsonOut({ success: false, error: 'extraction unavailable' });

    // v0.51: page tied to one form field -> transcription-only prompt/schema.
    // No target (older form during deploy skew) -> v0.50 classification.
    const target = PAD_EXTRACT_TARGETS.indexOf(String(data.target || '')) > -1 ? String(data.target) : '';

    const payload = {
      model: PAD_EXTRACT_MODEL,
      max_tokens: 3000,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: target ? PAD_EXTRACT_SCHEMA_TARGETED : PAD_EXTRACT_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: target ? padExtractTargetedPrompt(target) : PAD_EXTRACT_PROMPT }
        ]
      }]
    };

    const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Pad extract HTTP ' + code + ': ' + resp.getContentText().slice(0, 300));
      return jsonOut({ success: false, error: 'extract failed (' + code + ')' });
    }

    const msg = JSON.parse(resp.getContentText());
    if (msg.stop_reason === 'refusal') {
      return jsonOut({ success: true, items: [] });
    }
    let text = '';
    (msg.content || []).forEach(function(b) { if (b.type === 'text') text += b.text; });
    const parsed = JSON.parse(text);   // schema-enforced JSON
    const items = (parsed && parsed.items || [])
      .map(function(it) {
        // targeted pages carry no per-item target; stamp the page's field
        return it && target ? { target: target, text: it.text } : it;
      })
      .filter(function(it) {
        return it && PAD_EXTRACT_TARGETS.indexOf(it.target) > -1 && String(it.text || '').trim();
      });
    return jsonOut({ success: true, items: items });
  } catch (err) {
    return jsonOut({ success: false, error: String(err && err.message || err) });
  }
}

/**
 * Fetches a pad's page JPEGs from the private bucket (service key; anon has
 * no read path). Returns [] on any problem so the caller's email still sends.
 */
function fetchPadImages(padId) {
  const out = [];
  const id = String(padId || '').trim();
  if (!/^[a-f0-9]{32}$/.test(id)) return out;   // client pad ids are 32-hex
  const secret = getSupabaseSecret();
  if (!secret) return out;
  const headers = { apikey: secret, Authorization: 'Bearer ' + secret };

  const listResp = UrlFetchApp.fetch(SUPABASE_URL + '/storage/v1/object/list/' + PAD_BUCKET, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({ prefix: id, limit: 24, sortBy: { column: 'name', order: 'asc' } }),
    muteHttpExceptions: true
  });
  if (listResp.getResponseCode() !== 200) return out;

  const files = JSON.parse(listResp.getContentText());
  files.forEach(function(f) {
    if (!f || !/\.jpg$/.test(String(f.name || ''))) return;
    const r = UrlFetchApp.fetch(
      SUPABASE_URL + '/storage/v1/object/' + PAD_BUCKET + '/' + id + '/' + f.name,
      { headers: headers, muteHttpExceptions: true }
    );
    if (r.getResponseCode() === 200) {
      out.push(r.getBlob().setName('evidence-pad-' + f.name));
    }
  });
  return out;
}
