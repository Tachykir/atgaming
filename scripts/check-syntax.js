// Sprawdza składnię wszystkich plików JS (serwer i przeglądarka) — szybki "lint" bez zależności
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const skip = new Set(['node_modules', '.git']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p);
  }
})(root);
let bad = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { bad++; console.error(`✗ ${path.relative(root, f)}\n${e.stderr}`); }
}
console.log(`${files.length - bad}/${files.length} plików OK`);
process.exit(bad ? 1 : 0);
