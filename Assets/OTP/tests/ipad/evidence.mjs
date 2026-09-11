#!/usr/bin/env node
// Appends one evidence row to <evidence-root>/<Tn>/index.md, creating the
// file (with a header) on first use. Evidence root is OUTSIDE the repo
// worktree on purpose (handoff/research is untracked scratch space).
//
// usage: node evidence.mjs <Tn> <id> "<measured>" "<expected>" <PASS|FAIL> [file]

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EVIDENCE_ROOT =
  '/Users/igor/Library/CloudStorage/GoogleDrive-igor.sesar@ais.ae/My Drive/Digitech/Claude Igor Online/Data-Representation/handoff/research/2026-09-11-otp-ipad-test';

function main() {
  const [, , tn, id, measured, expected, verdict, file] = process.argv;
  if (!tn || !id || measured === undefined || expected === undefined || !verdict) {
    console.error('usage: evidence.mjs <Tn> <id> "<measured>" "<expected>" <PASS|FAIL> [file]');
    process.exit(1);
  }
  if (verdict !== 'PASS' && verdict !== 'FAIL') {
    console.error('verdict must be PASS or FAIL');
    process.exit(1);
  }

  const dir = join(EVIDENCE_ROOT, tn);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const indexPath = join(dir, 'index.md');
  if (!existsSync(indexPath)) {
    writeFileSync(
      indexPath,
      `# ${tn} evidence\n\n| id | measured | expected | verdict | file |\n|---|---|---|---|---|\n`
    );
  }

  const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const row = `| ${esc(id)} | ${esc(measured)} | ${esc(expected)} | ${verdict} | ${file ? esc(file) : ''} |\n`;
  appendFileSync(indexPath, row);
  console.log(`appended to ${indexPath}`);
}

main();
