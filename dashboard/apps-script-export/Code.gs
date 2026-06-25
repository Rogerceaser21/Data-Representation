/**
 * AIS Observation Dashboard . Google Doc export (Phase D, #6/#7 Report Depth).
 *
 * Receives the Snapshot "Report Depth" model as JSON (sent as text/plain so the browser makes a
 * simple cross-origin request with no CORS preflight, the same pattern the R3 form uses), builds a
 * formatted Google Doc that mirrors the on-screen report, and returns { ok, url }.
 *
 * Layout: a clean MAIN tab (no inline quotes) where every claim ends with a small numbered marker,
 * plus a real REFERENCES tab holding the evidence; each marker links to the References tab.
 * The main tab is written with DocumentApp (easy styling). The References tab is created AND filled
 * with the Docs API (DocumentApp can neither create a tab nor write into a non-first tab). If tab
 * creation is unavailable, references fall back to a section at the end of the main tab (same
 * numbering), so the export never fails.
 *
 * Deploy: web app, "Execute as: Me (admin.user@ais.ae)", "Who has access: Anyone".
 * No password gate by design (Igor): dashboard access will be Google SSO + roles. No secrets here.
 * References never name a teacher (the model omits names); each cites the locked R3 record link.
 */

function doPost(e) {
  try {
    var model = JSON.parse(e.postData.contents);
    return json({ ok: true, url: buildDoc(model) });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// health check / smoke test in a browser
function doGet() {
  return json({ ok: true, service: 'AIS dashboard Google Doc export' });
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

var GREY = '#6b7280', INK = '#1f2937', LINK = '#1257FF', NAVY = '#1c2740', GREEN = '#2e7d4f', TERRA = '#c0563b';

function buildDoc(model) {
  var doc = DocumentApp.create('AIS R3 governance report . ' + (model.round || ''));
  var docId = doc.getId();

  // 1) create the References tab via the Docs API (DocumentApp cannot create tabs)
  var refTabId = null;
  try {
    var resp = Docs.Documents.batchUpdate({ requests: [{ addDocumentTab: { tabProperties: { title: 'References' } } }] }, docId);
    refTabId = resp.replies[0].addDocumentTab.tabProperties.tabId;
  } catch (e) { refTabId = null; }   // fall back to an in-doc References section
  var tabUrl = 'https://docs.google.com/document/d/' + docId + '/edit' + (refTabId ? ('?tab=' + refTabId) : '');

  // 2) main report via DocumentApp (first/active tab)
  doc = DocumentApp.openById(docId);
  var mainBody = doc.getTabs()[0].asDocumentTab().getBody();

  // running marker counter + the reference entries we collect while writing the main report
  var ctr = { n: 0 }, refEntries = [];
  function appendMarker(para, claim) {
    if (!claim || !claim.refs || !claim.refs.length) return;
    ctr.n++;
    refEntries.push({ n: ctr.n, label: claim.text, refs: claim.refs });
    var te = para.editAsText();
    var start = te.getText().length;
    te.appendText(' [' + ctr.n + ']');
    var end = te.getText().length - 1;
    if (refTabId) te.setLinkUrl(start, end, tabUrl);   // link the marker to the References tab
    te.setForegroundColor(start, end, LINK);
  }

  mainBody.appendParagraph('GOVERNANCE REPORT  .  SIMPLE').editAsText().setBold(true).setForegroundColor(GREY).setFontSize(8.5);
  mainBody.appendParagraph('The June R3 picture').setHeading(DocumentApp.ParagraphHeading.TITLE);
  mainBody.appendParagraph('AIS Sharjah  .  ' + (model.round || '') + '  .  generated ' + (model.generated_on || '')).editAsText().setForegroundColor(GREY).setFontSize(10);
  if (model.scope) mainBody.appendParagraph(model.scope).editAsText().setBold(true);
  if (model.method) mainBody.appendParagraph('How these are counted. ' + model.method).editAsText().setItalic(true).setForegroundColor(GREY).setFontSize(10);
  mainBody.appendHorizontalRule();

  (model.phases || []).forEach(function (ph) {
    mainBody.appendParagraph(ph.label || '').setHeading(DocumentApp.ParagraphHeading.HEADING1).editAsText().setForegroundColor(NAVY);
    if (ph.scope) mainBody.appendParagraph(ph.scope).editAsText().setForegroundColor(GREY).setFontSize(10);
    groupOut(mainBody, 'What is working', 'Strengths', ph.strengths, GREEN, appendMarker);
    groupOut(mainBody, 'Where to focus next', 'Areas to develop', ph.develop, TERRA, appendMarker);
  });

  if (model.compare && model.compare.length) {
    mainBody.appendParagraph('Primary & Kindy compared with Secondary').setHeading(DocumentApp.ParagraphHeading.HEADING1).editAsText().setForegroundColor(NAVY);
    mainBody.appendParagraph('Insights').editAsText().setBold(true).setForegroundColor(NAVY).setFontSize(10);
    model.compare.forEach(function (it, i) {
      var p = mainBody.appendParagraph((i + 1) + '.  ' + it.text); p.setIndentStart(18);
      appendMarker(p, it);
    });
  }

  // fallback only: if no References tab, append the references as a section in the main tab
  if (!refTabId) {
    mainBody.appendHorizontalRule();
    mainBody.appendParagraph('References').setHeading(DocumentApp.ParagraphHeading.HEADING1).editAsText().setForegroundColor(NAVY);
    mainBody.appendParagraph('Each entry supports the matching number above. Identifying teacher details are withheld.').editAsText().setItalic(true).setForegroundColor(GREY).setFontSize(10);
    refEntries.forEach(function (e) {
      mainBody.appendParagraph('[' + e.n + ']  ' + e.label).editAsText().setBold(true).setForegroundColor(INK).setFontSize(11);
      e.refs.forEach(function (r) {
        var meta = refMeta(r);
        if (meta) mainBody.appendParagraph(meta).setIndentStart(18).editAsText().setFontSize(9).setForegroundColor(GREY);
        if (r.quote) mainBody.appendParagraph('“' + r.quote + '”').setIndentStart(18).editAsText().setItalic(true).setFontSize(10).setForegroundColor(INK);
        if (r.explanation) mainBody.appendParagraph('Why this counts. ' + r.explanation).setIndentStart(18).editAsText().setFontSize(9).setForegroundColor(GREY);
        if (r.url) { var lp = mainBody.appendParagraph('Open the R3 record'); lp.setIndentStart(18); lp.editAsText().setLinkUrl(0, lp.getText().length - 1, r.url).setFontSize(9).setForegroundColor(LINK); }
      });
    });
  }

  dropSeed(mainBody);
  doc.saveAndClose();

  // 3) References tab content via the Docs API (DocumentApp cannot write a non-first tab)
  if (refTabId) writeRefsTab(docId, refTabId, refEntries);

  try { DriveApp.getFileById(docId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return 'https://docs.google.com/document/d/' + docId + '/edit';
}

function refMeta(r) {
  return [r.area, r.date, (r.progress ? r.progress + ' progress' : '')].filter(function (x) { return x; }).join('  .  ');
}

// one group (strengths or develop): coloured header, italic evidence, bold summary, bullets, insights
function groupOut(body, label, insLabel, g, colour, appendMarker) {
  if (!g) return;
  body.appendParagraph(label).setHeading(DocumentApp.ParagraphHeading.HEADING2).editAsText().setForegroundColor(colour);
  if (g.evidence) { var pe = body.appendParagraph(g.evidence.text); pe.editAsText().setItalic(true).setForegroundColor(GREY).setFontSize(10); appendMarker(pe, g.evidence); }
  if (g.summary) { var ps = body.appendParagraph(g.summary.text); ps.editAsText().setBold(true); appendMarker(ps, g.summary); }
  (g.bullets || []).forEach(function (b) { var li = body.appendListItem(b.text).setGlyphType(DocumentApp.GlyphType.BULLET); appendMarker(li, b); });
  if (g.insights && g.insights.length) {
    body.appendParagraph('Insights . ' + insLabel).editAsText().setBold(true).setForegroundColor(colour).setFontSize(10);
    g.insights.forEach(function (it, i) { var p = body.appendParagraph((i + 1) + '.  ' + it.text); p.setIndentStart(18); appendMarker(p, it); });
  }
}

// Write the References tab via the Docs API. Running-index batchUpdate: every insert appends at the
// current end, then styles that exact range, so indices stay consistent.
function writeRefsTab(docId, tabId, entries) {
  var reqs = [], idx = 1;
  function ins(text, o) {
    o = o || {};
    var start = idx;
    reqs.push({ insertText: { location: { tabId: tabId, index: idx }, text: text } });
    idx += text.length;
    var end = idx - (text.charAt(text.length - 1) === '\n' ? 1 : 0);
    if (end <= start) return;
    var ts = {}, tf = [];
    if (o.bold) { ts.bold = true; tf.push('bold'); }
    if (o.italic) { ts.italic = true; tf.push('italic'); }
    if (o.size) { ts.fontSize = { magnitude: o.size, unit: 'PT' }; tf.push('fontSize'); }
    if (o.color) { ts.foregroundColor = { color: { rgbColor: rgb(o.color) } }; tf.push('foregroundColor'); }
    if (o.link) { ts.link = { url: o.link }; tf.push('link'); }
    if (tf.length) reqs.push({ updateTextStyle: { range: { tabId: tabId, startIndex: start, endIndex: end }, textStyle: ts, fields: tf.join(',') } });
    var ps = {}, pf = [];
    if (o.title) { ps.namedStyleType = 'TITLE'; pf.push('namedStyleType'); }
    if (o.indent) { ps.indentStart = { magnitude: o.indent, unit: 'PT' }; ps.indentFirstLine = { magnitude: o.indent, unit: 'PT' }; pf.push('indentStart', 'indentFirstLine'); }
    if (pf.length) reqs.push({ updateParagraphStyle: { range: { tabId: tabId, startIndex: start, endIndex: end }, paragraphStyle: ps, fields: pf.join(',') } });
  }
  ins('References\n', { title: true });
  ins('Each entry supports the matching number in the report. Identifying teacher details are withheld.\n', { italic: true, color: GREY, size: 10 });
  entries.forEach(function (e) {
    ins('[' + e.n + ']  ' + e.label + '\n', { bold: true, color: INK, size: 11 });
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

function rgb(hex) {
  hex = hex.replace('#', '');
  return { red: parseInt(hex.substr(0, 2), 16) / 255, green: parseInt(hex.substr(2, 2), 16) / 255, blue: parseInt(hex.substr(4, 2), 16) / 255 };
}

// remove the seed empty paragraph Apps Script puts at the top of a body
function dropSeed(body) {
  try { var c = body.getChild(0); if (c && c.getType() === DocumentApp.ElementType.PARAGRAPH && c.asParagraph().getText() === '') c.removeFromParent(); } catch (e) {}
}

/**
 * Run this ONCE in the editor (Run button) to grant the Docs + Drive permissions the web app needs.
 * It creates a throwaway Doc and immediately trashes it, which forces the OAuth consent screen.
 */
function authorize() {
  var d = DocumentApp.create('AIS export authorization check');
  DriveApp.getFileById(d.getId()).setTrashed(true);
  return 'authorized: Docs + Drive granted';
}
