#!/usr/bin/env python3
"""Re-runnable real-Safari check for the OTP / R3 date and time fields.

Loads a form in real Safari (safaridriver), prints the required values and the
Save & Lock state, saves element screenshots of the Date / Time In / Time Out
cells, and FAILS (exit 1) when an EMPTY date or time field still paints text
(the Safari-on-Mac fake "today" / "12:30 PM"). Never submits: every POST is
blocked in the page, and nothing in the action bar is clicked.

  python3 safari_check.py URL [--out DIR] [--port 4448]

URL must be an UNGATED page: a copy of the master served at the live form's folder
depth (for example Assets/OTP/<name>.html from a local server), so its relative
../R3/lib/ and ../brand/ paths resolve. The check does not pass the StatiCrypt gate.
Needs: macOS Safari with Develop > Allow Remote Automation on. stdlib only.
Exit: 0 = every empty date/time looks empty, 1 = at least one fake value, 2 = setup problem.
"""
import argparse, base64, json, os, subprocess, sys, time, urllib.request, urllib.error

REQ = {'otp': ['teacher', 'inspector', 'curriculum', 'grade', 'subject', 'date', 'time_in', 'time_out'],
       'r3': ['teacher', 'inspector', 'curriculum', 'school', 'subject', 'date', 'time_in', 'time_out', 'evidence_type']}
GUARD = """
  document.querySelector('.action-bar') && document.querySelector('.action-bar').addEventListener('click', function(e){
    e.stopImmediatePropagation(); e.preventDefault(); }, true);
  var f0=window.fetch; window.fetch=function(u,o){ if(o&&String(o.method||'').toUpperCase()==='POST'){return Promise.reject(new Error('check guard'));} return f0.apply(this,arguments); };
  window.confirm=function(){ return false; };
"""
PROBE = """
  var form = document.getElementById('grade') && document.getElementById('grade').tagName==='SELECT' && !document.getElementById('evidence_type') ? 'otp' : 'r3';
  var F = document.querySelector('form'), req = arguments[0][form], vals = {};
  req.forEach(function(n){ var e = F.querySelector('[name="'+n+'"]'); vals[n] = e ? e.value : null; });
  var b = document.getElementById('btn-submit');
  var dt = ['date','time_in','time_out'].map(function(id){
    var e = document.getElementById(id), cs = getComputedStyle(e), h = e.nextElementSibling;
    var hint = h && h.classList && h.classList.contains('dt-hint') ? getComputedStyle(h).display : 'none';
    var transparent = /rgba\\(.*,\\s*0\\)$/.test(cs.color) || cs.color === 'transparent';
    return {id:id, value:e.value, valueMissing:e.validity.valueMissing, badInput:e.validity.badInput,
            color:cs.color, hint:hint, fakeValueShown: !e.value && !transparent};
  });
  return {form: form, version: (document.querySelector('.form-footer a')||{}).textContent,
          required: vals, empty: req.filter(function(n){ return !vals[n]; }),
          saveAndLock: {disabled: b.disabled, grey: b.classList.contains('disabled'), ariaDisabled: b.getAttribute('aria-disabled')},
          dateTime: dt};
"""


class WD:
    def __init__(self, port):
        self.base = 'http://127.0.0.1:%d' % port; self.port = port; self.sid = None; self.proc = None

    def req(self, method, path, body=None, timeout=90):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(self.base + path, data=data, method=method, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}

    def s(self, p):
        return '/session/%s%s' % (self.sid, p)

    def up(self):
        try:
            self.req('GET', '/status', timeout=2); return
        except Exception:
            pass
        self.proc = subprocess.Popen(['safaridriver', '-p', str(self.port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                self.req('GET', '/status', timeout=2); return
            except Exception:
                time.sleep(0.2)
        raise RuntimeError('safaridriver did not start on port %d' % self.port)

    def start(self):
        v = self.req('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})['value']
        self.sid = v['sessionId']
        try:
            self.req('POST', self.s('/window/rect'), {'x': 0, 'y': 0, 'width': 1440, 'height': 1000})
        except Exception:
            pass
        return v.get('capabilities', {}).get('browserVersion')

    def js(self, script, *args):
        return self.req('POST', self.s('/execute/sync'), {'script': script, 'args': list(args)})['value']

    def find(self, css):
        return list(self.req('POST', self.s('/element'), {'using': 'css selector', 'value': css})['value'].values())[0]

    def wait(self, expr, timeout):
        end = time.time() + timeout
        while time.time() < end:
            try:
                if self.js('return (' + expr + ');'):
                    return True
            except Exception:
                pass
            time.sleep(0.3)
        return False

    def quit(self):
        if self.sid:
            try:
                self.req('DELETE', self.s(''))
            except Exception:
                pass
        if self.proc:
            self.proc.terminate()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('url')
    ap.add_argument('--out', default='safari-check-shots')
    ap.add_argument('--port', type=int, default=4448)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    w = WD(a.port)
    try:
        w.up()
        ver = w.start()
        w.req('POST', w.s('/url'), {'url': a.url})
        time.sleep(1.0)
        if w.js("return !!document.getElementById('staticrypt-password');"):
            print('This page is behind the StatiCrypt gate: point the check at an ungated copy of the master.')
            return 2
        if not w.wait("document.getElementById('form-loading') && document.getElementById('form-loading').classList.contains('is-hidden')", 60):
            print('The form did not finish loading within 60 s.'); return 2
        time.sleep(1.0)
        w.js(GUARD)
        res = w.js(PROBE, REQ)
        res['safari'] = ver; res['url'] = a.url
        for fid in ['date', 'time_in', 'time_out']:
            w.js("document.getElementById(arguments[0]).scrollIntoView({block:'center'});", fid); time.sleep(0.3)
            try:
                el = w.find('.info-cell:has(#%s), .timeout-block:has(#%s)' % (fid, fid))
            except Exception:
                el = w.find('#' + fid)
            png = base64.b64decode(w.req('GET', w.s('/element/%s/screenshot' % el))['value'])
            p = os.path.join(a.out, '%s-%s.png' % (res['form'], fid))
            open(p, 'wb').write(png)
            res.setdefault('screenshots', []).append(p)
        print(json.dumps(res, indent=1))
        fakes = [d['id'] for d in res['dateTime'] if d['fakeValueShown']]
        print('RESULT:', 'FAIL, empty but painting a value: ' + ', '.join(fakes) if fakes else 'PASS, every empty date/time looks empty')
        return 1 if fakes else 0
    finally:
        w.quit()


if __name__ == '__main__':
    sys.exit(main())
