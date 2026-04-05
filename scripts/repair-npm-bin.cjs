#!/usr/bin/env node
/**
 * Repara enlaces en `node_modules/.bin` cuando iCloud (u otra sync) renombra
 * ejecutables a `nombre 2` y deja de existir `nombre`. Idempotente.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

const binDirs = [
  path.join(repoRoot, 'node_modules', '.bin'),
  path.join(repoRoot, 'backend', 'node_modules', '.bin'),
  path.join(repoRoot, 'frontend', 'node_modules', '.bin'),
];

/** Enlaces que a veces no se crean tras conflictos de sync. */
const ensureIfMissing = [
  {
    binDir: path.join(repoRoot, 'backend', 'node_modules', '.bin'),
    name: 'tsx',
    target: '../tsx/dist/cli.mjs',
  },
  {
    binDir: path.join(repoRoot, 'backend', 'node_modules', '.bin'),
    name: 'nest',
    target: '../@nestjs/cli/bin/nest.js',
  },
];

function repairBinDir(binDir) {
  if (!fs.existsSync(binDir)) return;
  for (const f of fs.readdirSync(binDir)) {
    if (!f.endsWith(' 2')) continue;
    const full = path.join(binDir, f);
    let st;
    try {
      st = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (!st.isSymbolicLink()) continue;
    const baseName = f.replace(/ 2$/, '');
    if (!baseName || baseName === f) continue;
    const fixed = path.join(binDir, baseName);
    if (fs.existsSync(fixed)) continue;
    const linkTarget = fs.readlinkSync(full);
    fs.symlinkSync(linkTarget, fixed);
  }
}

function ensureSymlink({ binDir, name, target }) {
  if (!fs.existsSync(binDir)) return;
  const linkPath = path.join(binDir, name);
  if (fs.existsSync(linkPath)) return;
  const abs = path.join(binDir, target);
  try {
    fs.accessSync(abs, fs.constants.F_OK);
  } catch {
    return;
  }
  fs.symlinkSync(target, linkPath);
}

for (const d of binDirs) repairBinDir(d);
for (const e of ensureIfMissing) ensureSymlink(e);
