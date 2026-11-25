// Builds the Windows installer from the unpacked program electron-builder
// has made in release/win-unpacked: one file a lecturer double-clicks.
// It installs for that person only, so no administrator is needed.
//
// Uses makensis (NSIS, zlib licence), a separate program that also runs on
// Linux (`sudo apt install nsis`). electron-builder's own installer target
// is not used: on Linux it needs Wine.
//
// Usage: node tools/windows-installer.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const source = join(root, 'release', 'win-unpacked');
const outFile = join(root, 'release', `Lysark-${version}-windows-installasjon.exe`);

if (!existsSync(join(source, 'Lysark.exe'))) {
  console.error('release/win-unpacked/Lysark.exe is missing. Run electron-builder --win first.');
  process.exit(1);
}
if (!existsSync(join(source, 'resources', 'ffmpeg', 'ffmpeg.exe'))) {
  console.error('FFmpeg is missing from the unpacked program. Run npm run fetch:ffmpeg -- win32-x64.');
  process.exit(1);
}

function folderBytes(dir) {
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    bytes += entry.isDirectory() ? folderBytes(path) : statSync(path).size;
  }
  return bytes;
}

const result = spawnSync(
  'makensis',
  [
    '-V2',
    '-INPUTCHARSET',
    'UTF8',
    `-DVERSION=${version}`,
    `-DSOURCE=${source}`,
    `-DOUTFILE=${outFile}`,
    `-DICON=${join(root, 'build', 'icon.ico')}`,
    `-DSIZE_KB=${Math.round(folderBytes(source) / 1024)}`,
    join(root, 'tools', 'windows-installer.nsi'),
  ],
  { stdio: 'inherit' },
);
if (result.error) {
  console.error('makensis could not be started. Install NSIS (on Linux: sudo apt install nsis).');
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`${outFile} (${(statSync(outFile).size / 1e6).toFixed(0)} MB)`);
