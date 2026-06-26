/**
 * AIS Observation Dashboard . Google Doc export (Phase D, #6/#7 Report).
 *
 * Builds a styled Google Doc from the Snapshot report model (sent as text/plain, no CORS preflight).
 * Design = the approved "AIS branded" concept (v3): Playfair Display headings + Lato body, AIS navy as
 * the lead colour with a gold accent, green/terracotta only on the small What-is-working / Where-to-focus
 * labels, one consistent bullet style, generous spacing. Cohesive, reads like a governance report.
 *
 * Two layouts (model.kind):
 *   'simple'  -> each section in a 1-cell-table card on a white page.
 *   'indepth' -> a formal report: cover, Contents, In summary, the phases, the comparison, and the
 *                How-to-move-Acceptable-to-Good coaching section.
 * Both: a navy cover image at the top (Docs API insertInlineImage by URL, no UrlFetchApp scope), a clean
 * MAIN tab where every claim ends with a numbered marker, and a linked REFERENCES tab. References never
 * name a teacher (the model omits names); each cites the locked R3 record.
 *
 * Deploy: web app, "Execute as: Me (admin.user@ais.ae)", "Who has access: Anyone".
 */

function doPost(e) {
  try { return json({ ok: true, url: buildDoc(JSON.parse(e.postData.contents)) }); }
  catch (err) { return json({ ok: false, error: String(err) }); }
}
function doGet() { return json({ ok: true, service: 'AIS dashboard Google Doc export' }); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// palette (gold is the darker, readable gold for text/accents; bright #FFBA14 lives only on the navy cover)
var NAVY = '#16224a', GOLD = '#9a7320', GREEN = '#2e7d4f', TERRA = '#b9543b', INK = '#1a1c22', GREY = '#8a8f98',
    MUTED = '#555a63', LINK = '#1257FF', CALLOUT_BG = '#f5f7fb', INS_BG = '#fbf7ef', INS_BORDER = '#efe2c8',
    CARD_BG = '#fbfaf8', CARD_BORDER = '#e3dfd5', RULE = '#e8e4d8';
var PLAY = 'Playfair Display', LATO = 'Lato';
var SH = DocumentApp.ParagraphHeading.HEADING1, SH2 = DocumentApp.ParagraphHeading.HEADING2, TT = DocumentApp.ParagraphHeading.TITLE;

// styled paragraph / list item in any container (body or table cell)
function P(c, text, o) {
  o = o || {};
  var p = o.bullet ? c.appendListItem(text).setGlyphType(DocumentApp.GlyphType.BULLET) : c.appendParagraph(text);
  if (o.heading) p.setHeading(o.heading);
  if (o.indent) p.setIndentStart(o.indent);
  if (o.spaceBefore != null) p.setSpacingBefore(o.spaceBefore);
  if (o.spaceAfter != null) p.setSpacingAfter(o.spaceAfter);
  var t = p.editAsText();
  t.setFontFamily(o.font || LATO);
  if (o.size) t.setFontSize(o.size);
  if (o.color) t.setForegroundColor(o.color);
  if (o.bold) t.setBold(true);
  if (o.italic) t.setItalic(true);
  return p;
}
// bold the lead-in (up to the first ': ' or first sentence '. ')
function boldLead(p) {
  var s = p.getText(), ci = s.indexOf(': '), pi = s.indexOf('. '), i = -1;
  if (ci >= 0 && (pi < 0 || ci < pi)) i = ci; else if (pi >= 0) i = pi;
  if (i > 0) p.editAsText().setBold(0, i, true);
}
// a full-width thin accent bar (1-cell table painted, ~3pt tall) -> the gold/navy brand rule
function bar(body, color) {
  var t = body.appendTable([['']]);
  t.setBorderWidth(0);
  var cl = t.getCell(0, 0);
  cl.setBackgroundColor(color).setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
  cl.getChild(0).asParagraph().editAsText().setFontSize(2);
  return t;
}
// a filled card (1-cell table) -> returns the cell to fill
function card(body, fill, border) {
  var t = body.appendTable([['']]);
  if (border) { t.setBorderColor(border); t.setBorderWidth(0.75); } else t.setBorderWidth(0);
  var cl = t.getCell(0, 0);
  cl.setBackgroundColor(fill).setPaddingTop(11).setPaddingBottom(11).setPaddingLeft(15).setPaddingRight(15);
  return cl;
}
function trim(cell) { try { var f = cell.getChild(0); if (f && f.getType() === DocumentApp.ElementType.PARAGRAPH && f.asParagraph().getText() === '') f.removeFromParent(); } catch (e) {} }

function buildDoc(model) {
  var label = (model.kind === 'indepth') ? 'In Depth' : 'Simple';
  var doc = DocumentApp.create('AIS R3 governance report . ' + label + ' . ' + (model.round || ''));
  var docId = doc.getId();

  var refTabId = null;
  try {
    var resp = Docs.Documents.batchUpdate({ requests: [{ addDocumentTab: { tabProperties: { title: 'References' } } }] }, docId);
    refTabId = resp.replies[0].addDocumentTab.tabProperties.tabId;
  } catch (e) { refTabId = null; }
  var tabUrl = 'https://docs.google.com/document/d/' + docId + '/edit' + (refTabId ? ('?tab=' + refTabId) : '');

  doc = DocumentApp.openById(docId);
  var firstTab = doc.getTabs()[0], firstTabId = firstTab.getId();
  var body = firstTab.asDocumentTab().getBody();
  body.setMarginTop(54).setMarginBottom(54).setMarginLeft(64).setMarginRight(64);

  var ctr = { n: 0 }, refEntries = [];
  function marker(para, claim) {
    if (!claim || !claim.refs || !claim.refs.length) return;
    ctr.n++;
    refEntries.push({ n: ctr.n, label: claim.text, refs: claim.refs });
    var te = para.editAsText(), start = te.getText().length;
    te.appendText(' [' + ctr.n + ']');
    var end = te.getText().length - 1;
    if (refTabId) te.setLinkUrl(start, end, tabUrl);
    te.setForegroundColor(start, end, LINK).setBold(start, end, false).setItalic(start, end, false);
  }

  if (model.kind === 'indepth') buildInDepth(body, model, marker);
  else buildSimple(body, model, marker);

  if (!refTabId) appendRefsSection(body, refEntries);
  dropSeed(body);
  doc.saveAndClose();

  try { Docs.Documents.batchUpdate({ requests: [{ updateDocumentTabProperties: { tabProperties: { tabId: firstTabId, title: 'Report' }, fields: 'title' } }] }, docId); } catch (e) {}
  if (model.cover) insertCoverImage(docId, firstTabId, model.cover);
  if (refTabId) writeRefsTab(docId, refTabId, refEntries);

  try { DriveApp.getFileById(docId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return 'https://docs.google.com/document/d/' + docId + '/edit';
}

function insertCoverImage(docId, tabId, uri) {
  try {
    Docs.Documents.batchUpdate({ requests: [{ insertText: { location: { tabId: tabId, index: 1 }, text: '\n' } }] }, docId);
    Docs.Documents.batchUpdate({ requests: [
      { insertInlineImage: { location: { tabId: tabId, index: 1 }, uri: uri, objectSize: { width: { magnitude: 468, unit: 'PT' }, height: { magnitude: 263, unit: 'PT' } } } },
      { updateParagraphStyle: { range: { tabId: tabId, startIndex: 1, endIndex: 2 }, paragraphStyle: { alignment: 'CENTER', spaceBelow: { magnitude: 14, unit: 'PT' } }, fields: 'alignment,spaceBelow' } }
    ] }, docId);
  } catch (e) {}
}

// ---- shared title block (kicker, Playfair title, meta, gold accent bar) ----
function titleBlock(body, kind) {
  P(body, kind === 'indepth' ? 'GOVERNANCE REPORT  .  IN DEPTH' : 'GOVERNANCE REPORT  .  SIMPLE',
    { font: LATO, size: 9, color: GOLD, bold: true, spaceAfter: 2 });
  P(body, 'The June R3 picture.', { font: PLAY, heading: TT, color: NAVY });
}

// ---- a strengths/develop group (label + evidence + summary + bullets + insights card) ----
function group(host, label, insLabel, g, colour, marker, carded) {
  if (!g) return;
  P(host, label.toUpperCase(), { font: LATO, size: 11, bold: true, color: colour, spaceBefore: 8, spaceAfter: 3 });
  if (g.evidence) marker(P(host, g.evidence.text, { font: LATO, size: 10.5, italic: true, color: GREY, spaceAfter: 4 }), g.evidence);
  if (g.summary) marker(P(host, g.summary.text, { font: LATO, size: 12.5, bold: true, color: INK, spaceAfter: 6 }), g.summary);
  (g.bullets || []).forEach(function (b) { marker(P(host, b.text, { font: LATO, size: 11.5, color: INK, bullet: true }), b); });
  if (g.insights && g.insights.length) {
    var cell = card(host, INS_BG, INS_BORDER);
    P(cell, 'INSIGHTS  .  ' + insLabel, { font: LATO, size: 9.5, bold: true, color: GOLD, spaceAfter: 4 });
    g.insights.forEach(function (it) { marker(P(cell, it.text, { font: LATO, size: 11.5, color: INK, bullet: true }), it); });
    trim(cell);
  }
}

// ---- SIMPLE: card-styled ----
function buildSimple(body, model, marker) {
  titleBlock(body, 'simple');
  P(body, 'AIS Sharjah  .  ' + (model.round || '') + '  .  generated ' + (model.generated_on || ''), { font: LATO, size: 10, color: GREY, spaceAfter: 6 });
  bar(body, GOLD);

  if (model.scope) { var sc = card(body, CALLOUT_BG); P(sc, model.scope, { font: LATO, size: 12.5, bold: true, color: NAVY }); trim(sc); }
  if (model.method) { var mc = card(body, CARD_BG, CARD_BORDER); P(mc, 'How these are counted. ' + model.method, { font: LATO, size: 10.5, italic: true, color: MUTED }); trim(mc); }

  (model.phases || []).forEach(function (ph) {
    sectionHead(body, ph.label || '');
    if (ph.scope) P(body, ph.scope, { font: LATO, size: 10.5, color: GREY, spaceAfter: 4 });
    var cell = card(body, CARD_BG, CARD_BORDER);
    group(cell, 'What is working', 'Strengths', ph.strengths, GREEN, marker, true);
    group(cell, 'Where to focus next', 'Areas to develop', ph.develop, TERRA, marker, true);
    trim(cell);
  });

  if (model.compare && model.compare.length) {
    sectionHead(body, 'Primary & Kindy compared with Secondary');
    var cc = card(body, CARD_BG, CARD_BORDER);
    model.compare.forEach(function (it) { marker(P(cc, it.text, { font: LATO, size: 11.5, color: INK, bullet: true }), it); });
    trim(cc);
  }
}

// a navy Playfair section heading with a gold number prefix
function sectionHead(body, text, num) {
  var p = P(body, (num ? num + '   ' : '') + text, { font: PLAY, heading: SH, color: NAVY, spaceBefore: 14, spaceAfter: 4 });
  if (num) p.editAsText().setForegroundColor(0, String(num).length - 1, GOLD);
  return p;
}

// ---- IN DEPTH: formal report ----
function buildInDepth(body, model, marker) {
  titleBlock(body, 'indepth');
  P(body, 'AIS Sharjah  .  ' + (model.round || '') + '  .  generated ' + (model.generated_on || ''), { font: LATO, size: 10, color: GREY, spaceAfter: 6 });
  bar(body, GOLD);

  // Contents
  P(body, 'Contents', { font: PLAY, heading: SH, color: NAVY, spaceBefore: 12, spaceAfter: 4 });
  ['In summary', 'Primary & Kindy', 'Secondary', 'Primary & Kindy compared with Secondary', 'How to move Acceptable to Good']
    .forEach(function (t, i) { var p = P(body, (i + 1) + '   ' + t, { font: LATO, size: 12, color: INK, spaceAfter: 2 }); p.editAsText().setForegroundColor(0, 0, GOLD).setBold(0, 0, true); });

  // 1 In summary
  sectionHead(body, 'In summary', 1);
  if (model.scope) { var sc = card(body, CALLOUT_BG); P(sc, model.scope, { font: LATO, size: 12.5, bold: true, color: NAVY }); if (model.method) P(sc, 'How these are counted. ' + model.method, { font: LATO, size: 10, italic: true, color: MUTED, spaceBefore: 4 }); trim(sc); }
  if (model.summary && model.summary.lead) marker(P(body, model.summary.lead.text, { font: LATO, size: 12.5, color: INK, spaceBefore: 6, spaceAfter: 6 }), model.summary.lead);
  if (model.summary && model.summary.points) model.summary.points.forEach(function (pt) { var p = P(body, pt.text, { font: LATO, size: 11.5, color: INK, bullet: true }); boldLead(p); marker(p, pt); });

  // 2/3 phases
  var nums = { 'Primary & Kindy': 2, 'Secondary': 3 };
  (model.phases || []).forEach(function (ph) {
    sectionHead(body, ph.label || '', nums[ph.label] || null);
    if (ph.scope) P(body, ph.scope, { font: LATO, size: 10.5, color: GREY, spaceAfter: 4 });
    group(body, 'What is working', 'Strengths', ph.strengths, GREEN, marker, false);
    group(body, 'Where to focus next', 'Areas to develop', ph.develop, TERRA, marker, false);
  });

  // 4 compare
  if (model.compare && model.compare.length) {
    sectionHead(body, 'Primary & Kindy compared with Secondary', 4);
    model.compare.forEach(function (it) { marker(P(body, it.text, { font: LATO, size: 11.5, color: INK, bullet: true }), it); });
  }

  // 5 coaching
  if (model.coaching && model.coaching.length) {
    sectionHead(body, 'How to move Acceptable to Good', 5);
    if (model.coachingIntro) P(body, model.coachingIntro, { font: LATO, size: 11, italic: true, color: MUTED, spaceAfter: 3 });
    if (model.rubricUrl) { var rl = P(body, 'View the AIS progress rubric', { font: LATO, size: 10, color: LINK, spaceAfter: 6 }); rl.editAsText().setLinkUrl(0, rl.getText().length - 1, model.rubricUrl); }
    model.coaching.forEach(function (cp) {
      P(body, cp.label || '', { font: PLAY, heading: SH2, color: INK, spaceBefore: 8, spaceAfter: 3 });
      if (cp.summary) marker(P(body, cp.summary.text, { font: LATO, size: 12, bold: true, color: INK, spaceAfter: 4 }), cp.summary);
      P(body, 'WHERE COACHING COULD HELP', { font: LATO, size: 10, bold: true, color: GREEN, spaceAfter: 3 });
      (cp.points || []).forEach(function (pt) {
        var p = P(body, pt.text, { font: LATO, size: 11.5, color: INK, bullet: true }); boldLead(p); marker(p, pt);
        if (pt.method) { var rb = P(body, 'AIS rubric, Facilitating: ' + pt.method, { font: LATO, size: 10, color: MUTED, indent: 18 }); var lbl = 'AIS rubric, Facilitating:'.length; rb.editAsText().setBold(0, lbl - 1, true).setForegroundColor(0, lbl - 1, GOLD); }
      });
    });
  }
}

function refMeta(r) { return [r.area, r.date, (r.progress ? r.progress + ' progress' : '')].filter(function (x) { return x; }).join('  .  '); }

function appendRefsSection(body, refEntries) {
  bar(body, NAVY);
  P(body, 'References', { font: PLAY, heading: SH, color: NAVY, spaceBefore: 10, spaceAfter: 4 });
  P(body, 'Each entry supports the matching number above. Identifying teacher details are withheld.', { font: LATO, size: 10, italic: true, color: GREY, spaceAfter: 6 });
  refEntries.forEach(function (e) {
    P(body, '[' + e.n + ']  ' + e.label, { font: LATO, size: 11, bold: true, color: NAVY, spaceBefore: 8 });
    e.refs.forEach(function (r) {
      var meta = refMeta(r);
      if (meta) P(body, meta, { font: LATO, size: 9, color: GREY, indent: 18 });
      if (r.quote) P(body, '“' + r.quote + '”', { font: LATO, size: 10, italic: true, color: INK, indent: 18 });
      if (r.explanation) P(body, 'Why this counts. ' + r.explanation, { font: LATO, size: 9, color: GREY, indent: 18 });
      if (r.url) { var lp = P(body, 'Open the R3 record', { font: LATO, size: 9, color: LINK, indent: 18 }); lp.editAsText().setLinkUrl(0, lp.getText().length - 1, r.url); }
    });
  });
}

// References tab via the Docs API (running-index batchUpdate)
function writeRefsTab(docId, tabId, entries) {
  var reqs = [], idx = 1;
  function ins(text, o) {
    o = o || {}; var start = idx;
    reqs.push({ insertText: { location: { tabId: tabId, index: idx }, text: text } });
    idx += text.length;
    var end = idx - (text.charAt(text.length - 1) === '\n' ? 1 : 0);
    if (end <= start) return;
    var ts = { weightedFontFamily: { fontFamily: o.font || LATO } }, tf = ['weightedFontFamily'];
    if (o.bold) { ts.bold = true; tf.push('bold'); }
    if (o.italic) { ts.italic = true; tf.push('italic'); }
    if (o.size) { ts.fontSize = { magnitude: o.size, unit: 'PT' }; tf.push('fontSize'); }
    if (o.color) { ts.foregroundColor = { color: { rgbColor: rgb(o.color) } }; tf.push('foregroundColor'); }
    if (o.link) { ts.link = { url: o.link }; tf.push('link'); }
    reqs.push({ updateTextStyle: { range: { tabId: tabId, startIndex: start, endIndex: end }, textStyle: ts, fields: tf.join(',') } });
    var ps = {}, pf = [];
    if (o.title) { ps.namedStyleType = 'TITLE'; pf.push('namedStyleType'); }
    if (o.indent) { ps.indentStart = { magnitude: o.indent, unit: 'PT' }; ps.indentFirstLine = { magnitude: o.indent, unit: 'PT' }; pf.push('indentStart', 'indentFirstLine'); }
    if (pf.length) reqs.push({ updateParagraphStyle: { range: { tabId: tabId, startIndex: start, endIndex: end }, paragraphStyle: ps, fields: pf.join(',') } });
  }
  ins('References\n', { title: true, font: PLAY, color: NAVY });
  ins('Each entry supports the matching number in the report. Identifying teacher details are withheld.\n', { italic: true, color: GREY, size: 10 });
  entries.forEach(function (e) {
    ins('[' + e.n + ']  ' + e.label + '\n', { bold: true, color: NAVY, size: 11 });
    e.refs.forEach(function (r) {
      var meta = refMeta(r);
      if (meta) ins(meta + '\n', { color: GREY, size: 9, indent: 18 });
      if (r.quote) ins('“' + r.quote + '”\n', { italic: true, color: INK, size: 10, indent: 18 });
      if (r.explanation) ins('Why this counts. ' + r.explanation + '\n', { color: GREY, size: 9, indent: 18 });
      if (r.url) ins('Open the R3 record\n', { link: r.url, color: LINK, size: 9, indent: 18 });
    });
  });
  Docs.Documents.batchUpdate({ requests: reqs }, docId);
}

function rgb(hex) { hex = hex.replace('#', ''); return { red: parseInt(hex.substr(0, 2), 16) / 255, green: parseInt(hex.substr(2, 2), 16) / 255, blue: parseInt(hex.substr(4, 2), 16) / 255 }; }
function dropSeed(body) { try { var c = body.getChild(0); if (c && c.getType() === DocumentApp.ElementType.PARAGRAPH && c.asParagraph().getText() === '') c.removeFromParent(); } catch (e) {} }

function authorize() { var d = DocumentApp.create('AIS export authorization check'); DriveApp.getFileById(d.getId()).setTrashed(true); return 'authorized: Docs + Drive granted'; }
