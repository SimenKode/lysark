#!/usr/bin/env node
// Gathers the licence texts of everything that is built into Lysark into
// one folder, which is shipped next to the program (see "extraResources"
// in package.json). A release that is shared must carry these texts.
//
// What goes in: Lysark's own licence and the exception for exports, and the
// licence file of every package that the program is built from (the
// production dependencies in package-lock.json, with what they depend on).
// FFmpeg has its own folder with its licence; the Liberation fonts carry
// theirs next to the font files; Electron ships Chromium's.
//
// Usage: node tools/collect-licenses.mjs   (writes build/licenses/)
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build', 'licenses');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

copyFileSync(join(root, 'LICENSE'), join(out, 'Lysark-LICENSE.txt'));
copyFileSync(join(root, 'EXPORT-EXCEPTION.md'), join(out, 'Lysark-EXPORT-EXCEPTION.md'));

const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const packages = Object.entries(lock.packages)
  .filter(
    ([path, info]) =>
      path.startsWith('node_modules/') && !info.dev && !info.optional && !info.devOptional,
  )
  .map(([path, info]) => ({ name: path.replace(/^.*node_modules\//, ''), path, info }))
  .sort((a, b) => a.name.localeCompare(b.name));

const MIT = `MIT License

Copyright (c) <holder>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const parts = [
  'Lysark is built from the free software listed here. Each part is followed by',
  'its own licence text, as it comes with the package.',
  '',
];
const missing = [];
for (const { name, path, info } of packages) {
  const dir = join(root, path);
  const files = existsSync(dir)
    ? readdirSync(dir).filter((file) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file))
    : [];
  if (files.length === 0) {
    // A package that says "MIT" but ships no licence file: the licence's own
    // text is written out, with the author the package names.
    const own = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const author = typeof own.author === 'string' ? own.author : own.author?.name;
    if (own.license !== 'MIT' || !author) {
      missing.push(name);
      continue;
    }
    parts.push(
      '='.repeat(78),
      `${name} ${info.version} (MIT)`,
      '='.repeat(78),
      '',
      'This package comes without a licence file. Its package.json says: license "MIT",',
      `author "${author}". The MIT licence reads:`,
      '',
      MIT.replace('<holder>', author),
      '',
    );
    continue;
  }
  parts.push(
    '='.repeat(78),
    `${name} ${info.version} (${info.license ?? 'licence: see below'})`,
    '='.repeat(78),
    '',
  );
  for (const file of files.sort()) {
    parts.push(readFileSync(join(dir, file), 'utf8').trim(), '');
  }
}
if (missing.length > 0) {
  console.error(`No licence file found for: ${missing.join(', ')}`);
  process.exit(1);
}
writeFileSync(join(out, 'THIRD-PARTY-LICENSES.txt'), parts.join('\n'), 'utf8');
console.log(`${packages.length} packages: ${join(out, 'THIRD-PARTY-LICENSES.txt')}`);
