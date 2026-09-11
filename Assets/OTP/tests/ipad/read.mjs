#!/usr/bin/env node
// safaridriver DOM-truth reader for the OTP form on the iPad Air 13-inch (M3)
// simulator, iPadOS 26.3. Read-only instrument: it can pass the gate and
// evaluate JS, but (proven on this rig, see README) it cannot type via
// sendKeys and clicking/tapping through it does not raise the real software
// keyboard. Use rig.sh + idb for real interaction instead.
//
// Each subcommand is a SELF-CONTAINED process: it starts (or reuses) the
// safaridriver on port 4445, opens its OWN session, does its job, and
// deletes the session before exit (Safari discards the automation tab when
// a session is deleted, so a later invocation cannot see an earlier one's
// page state - every subcommand that needs the OTP form re-passes the gate
// itself rather than assuming a prior `gate` call left it open).
//
// Subcommands:
//   dom "<js expression>"   gate, then evaluate the expression, print JSON
//   gate                     gate only, print true/false
//   draft                    print localStorage['ais-otp-form-v1'] (gates first)
//   clear-draft               remove that draft key (gates first)
//   url <url>                 navigate to an arbitrary URL, print location.href (no gate)

import { spawn } from 'node:child_process';

const UDID = '38AB16E5-8346-4C96-B0A5-CE876D3AE4F4';
const WD_PORT = 4445;
const WD_BASE = `http://127.0.0.1:${WD_PORT}`;
const GATE_URL = 'https://rogerceaser21.github.io/Data-Representation/Assets/OTP/otp-progress-form.html';
const GATE_PASSWORD = 'ais2026ais';
const DRAFT_KEY = 'ais-otp-form-v1';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function driverReady() {
  try {
    const r = await fetch(`${WD_BASE}/status`);
    if (!r.ok) return false;
    const j = await r.json();
    return !!j.value?.ready;
  } catch {
    return false;
  }
}

async function ensureDriverUp() {
  if (await driverReady()) return;
  // Not listening on 4445 - start our own. (On this Mac a safaridriver from
  // an earlier probe session is usually already listening here; this path
  // is the fallback for a fresh machine.)
  const child = spawn('/usr/bin/safaridriver', ['-p', String(WD_PORT)], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    if (await driverReady()) return;
  }
  throw new Error(`safaridriver did not become ready on port ${WD_PORT}`);
}

async function newSession() {
  const r = await fetch(`${WD_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          browserName: 'safari',
          // load-bearing: without this the driver defaults to the macOS
          // platform and refuses safari:useSimulator with a 500.
          platformName: 'ios',
          'safari:useSimulator': true,
          'safari:deviceUDID': UDID,
        },
      },
    }),
  });
  const j = await r.json();
  if (!j.value?.sessionId) throw new Error(`session create failed: ${JSON.stringify(j)}`);
  return j.value.sessionId;
}

async function deleteSession(sid) {
  try {
    await fetch(`${WD_BASE}/session/${sid}`, { method: 'DELETE' });
  } catch {
    // best effort - restores HID to the simulator either way once the
    // process holding the session exits
  }
}

async function navigate(sid, url) {
  await fetch(`${WD_BASE}/session/${sid}/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

async function execSync(sid, script) {
  const r = await fetch(`${WD_BASE}/session/${sid}/execute/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, args: [] }),
  });
  const j = await r.json();
  if (j.value === undefined) throw new Error(`execute/sync failed: ${JSON.stringify(j)}`);
  return j.value;
}

// Sets the StatiCrypt password through the real property setter (bypasses
// React/vanilla-listener quirks the same way typed input would trigger
// them) and submits the form. This is the WebDriver-only gate route - it is
// NOT the tap-and-type route proved on-device with idb (see README); it
// exists so DOM-assertion subcommands can reach the live form headlessly.
async function passGate(sid) {
  await navigate(sid, GATE_URL);
  await sleep(1500);
  const already = await execSync(sid, "return document.querySelector('#otp-form') !== null");
  if (already) return true;
  const setScript = `
    var i = document.querySelector('#staticrypt-password');
    if (!i) return false;
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(i, ${JSON.stringify(GATE_PASSWORD)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.form.requestSubmit();
    return true;
  `;
  await execSync(sid, `return (function(){ ${setScript} })();`);
  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    const ok = await execSync(sid, "return document.querySelector('#otp-form') !== null");
    if (ok) return true;
  }
  return await execSync(sid, "return document.querySelector('#otp-form') !== null");
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) {
    console.error('usage: read.mjs {dom "<expr>"|gate|draft|clear-draft|url <url>}');
    process.exit(1);
  }

  await ensureDriverUp();
  const sid = await newSession();
  try {
    if (cmd === 'gate') {
      const ok = await passGate(sid);
      console.log(JSON.stringify(ok));
    } else if (cmd === 'dom') {
      const expr = rest[0];
      if (!expr) throw new Error('usage: read.mjs dom "<js expression>"');
      await passGate(sid);
      const val = await execSync(sid, `return (${expr});`);
      console.log(JSON.stringify(val));
    } else if (cmd === 'draft') {
      await passGate(sid);
      const val = await execSync(sid, `return localStorage.getItem(${JSON.stringify(DRAFT_KEY)});`);
      console.log(val === null ? 'null' : val);
    } else if (cmd === 'clear-draft') {
      await passGate(sid);
      await execSync(sid, `localStorage.removeItem(${JSON.stringify(DRAFT_KEY)}); return true;`);
      console.log('cleared');
    } else if (cmd === 'url') {
      const target = rest[0];
      if (!target) throw new Error('usage: read.mjs url <url>');
      await navigate(sid, target);
      await sleep(1000);
      console.log(await execSync(sid, 'return location.href;'));
    } else {
      throw new Error(`unknown subcommand: ${cmd}`);
    }
  } finally {
    await deleteSession(sid);
  }
}

main().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(1);
});
