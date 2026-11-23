#!/usr/bin/env node
// Fetches the FFmpeg programs that Lysark starts for video export and sound.
//
// FFmpeg is never linked into Lysark and never committed to git: it is a
// separate program placed in vendor/ffmpeg/ (git-ignored) and shipped next
// to Lysark by electron-builder (see "extraResources" in package.json).
//
// One fixed, named build is used, not "latest": the GPL build with libx264
// from https://github.com/BtbN/FFmpeg-Builds (the owner's choice,
// 22.11.2026). Each archive is checked against its SHA-256 before anything
// is unpacked. To move to another build, change BUILD below; the checksums
// are listed on the release page (and by `gh api` as "digest").
//
// Usage: node tools/fetch-ffmpeg.mjs [linux-x64] [win32-x64]   (default: both)
//        node tools/fetch-ffmpeg.mjs source
//
// "source" fetches what a release must carry next to the programs, because
// Lysark hands FFmpeg on under the GPL: the FFmpeg source at the exact
// commit the build was made from, and the build scripts at the exact tag
// (they name every library in the build and the commit it was built from).
// Both land in vendor/ffmpeg/source/ with a note that says what they are;
// attach all three files to the release.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(root, 'vendor', 'ffmpeg');

const BUILD = {
  tag: 'autobuild-2026-10-31-12-59',
  version: 'n9.0.2-39-g7adfbe40dc',
  /** The FFmpeg source this build was made from. */
  source: 'https://github.com/FFmpeg/FFmpeg/tree/7adfbe40dc',
  buildScripts: 'https://github.com/BtbN/FFmpeg-Builds/tree/autobuild-2026-10-31-12-59',
  /** The same two, as the commits they are. */
  sourceCommit: '7adfbe40dcde598f93a6963d2f7b22cd75202ccc',
  scriptsCommit: '5031c6f1082414e53688d39e521849905071070d',
  targets: {
    'linux-x64': {
      file: 'ffmpeg-n9.0.2-39-g7adfbe40dc-linux64-gpl-9.0.tar.xz',
      sha256: '73e29a56974ae5a651133a04584c7483b21afe941e17dc91d79814a758b608d3',
      program: 'ffmpeg',
    },
    'win32-x64': {
      file: 'ffmpeg-n9.0.2-39-g7adfbe40dc-win64-gpl-9.0.zip',
      sha256: '693f3e224bc184b40524a62ca47526cfebaf2504414021b92fe75f677ad868b9',
      program: 'ffmpeg.exe',
    },
  },
};

async function sha256(file) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

async function download(url, file) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`${url}: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
}

async function fetchTarget(name) {
  const target = BUILD.targets[name];
  if (!target) throw new Error(`Unknown target ${name}`);
  const outDir = join(vendor, name);
  const program = join(outDir, target.program);
  const stamp = join(outDir, 'BUILD.txt');
  if (
    existsSync(program) &&
    existsSync(stamp) &&
    readFileSync(stamp, 'utf8').includes(target.sha256)
  ) {
    console.log(`${name}: already in place (${BUILD.version})`);
    return;
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const archive = join(vendor, target.file);
  if (!existsSync(archive) || (await sha256(archive)) !== target.sha256) {
    const url = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${BUILD.tag}/${target.file}`;
    console.log(`${name}: fetching ${url}`);
    await download(url, archive);
  }
  const actual = await sha256(archive);
  if (actual !== target.sha256) {
    rmSync(archive, { force: true });
    throw new Error(`${name}: checksum mismatch (got ${actual}); nothing was unpacked`);
  }
  const top = target.file.replace(/\.(tar\.xz|zip)$/, '');
  if (target.file.endsWith('.zip')) {
    const wanted = new Set([`${top}/bin/${target.program}`, `${top}/LICENSE.txt`]);
    const files = unzipSync(new Uint8Array(readFileSync(archive)), {
      filter: (entry) => wanted.has(entry.name),
    });
    for (const [entry, data] of Object.entries(files)) {
      writeFileSync(join(outDir, entry.split('/').pop()), data);
    }
  } else {
    execFileSync('tar', [
      '-xJf',
      archive,
      '-C',
      outDir,
      '--strip-components=1',
      `${top}/LICENSE.txt`,
      `${top}/bin/${target.program}`,
    ]);
    execFileSync('mv', [join(outDir, 'bin', target.program), program]);
    rmSync(join(outDir, 'bin'), { recursive: true, force: true });
    chmodSync(program, 0o755);
  }
  if (!existsSync(program) || !existsSync(join(outDir, 'LICENSE.txt'))) {
    throw new Error(`${name}: the archive did not contain what was expected`);
  }
  writeFileSync(
    stamp,
    [
      `FFmpeg ${BUILD.version}, GPL build with libx264, from BtbN/FFmpeg-Builds ${BUILD.tag}.`,
      `Archive: ${target.file}`,
      `SHA-256: ${target.sha256}`,
      `Source code of this build: ${BUILD.source}`,
      `Build scripts: ${BUILD.buildScripts}`,
      'Both are also attached, as files, to every release of Lysark.',
      'Licence: GNU General Public License, version 3 or later (see LICENSE.txt).',
      'FFmpeg is a separate program that Lysark starts; it is not part of Lysark.',
      '',
    ].join('\n'),
    'utf8',
  );
  rmSync(archive, { force: true });
  console.log(`${name}: ${program}`);
}

/** The commit a source archive from GitHub was made from; it is written into the archive. */
function archiveCommit(file) {
  return execFileSync('sh', ['-c', 'gzip -dc "$1" | git get-tar-commit-id', 'sh', file], {
    encoding: 'utf8',
  }).trim();
}

/** The configure line of the Linux program, when it has been fetched. */
function configureLine() {
  const program = join(vendor, 'linux-x64', 'ffmpeg');
  if (!existsSync(program)) return undefined;
  const said = execFileSync(program, ['-hide_banner', '-version'], { encoding: 'utf8' });
  return /^configuration: (.*)$/m.exec(said)?.[1];
}

async function fetchSource() {
  const outDir = join(vendor, 'source');
  mkdirSync(outDir, { recursive: true });
  const parts = [
    {
      what: 'FFmpeg',
      file: `FFmpeg-${BUILD.version}-source.tar.gz`,
      url: `https://github.com/FFmpeg/FFmpeg/archive/${BUILD.sourceCommit}.tar.gz`,
      commit: BUILD.sourceCommit,
    },
    {
      what: 'the build scripts',
      file: `FFmpeg-Builds-${BUILD.tag}.tar.gz`,
      url: `https://github.com/BtbN/FFmpeg-Builds/archive/${BUILD.scriptsCommit}.tar.gz`,
      commit: BUILD.scriptsCommit,
    },
  ];
  const lines = [];
  for (const part of parts) {
    const file = join(outDir, part.file);
    if (!existsSync(file) || archiveCommit(file) !== part.commit) {
      console.log(`source: fetching ${part.url}`);
      await download(part.url, file);
    }
    // The archive says itself which commit it holds. Nothing in it is unpacked or run.
    const actual = archiveCommit(file);
    if (actual !== part.commit) {
      rmSync(file, { force: true });
      throw new Error(`source: ${part.file} holds commit ${actual}, not ${part.commit}`);
    }
    lines.push(`  ${part.file}`, `    commit ${part.commit}`, `    SHA-256 ${await sha256(file)}`);
    console.log(`source: ${file}`);
  }
  const configure = configureLine();
  writeFileSync(
    join(outDir, 'FFMPEG-SOURCE.txt'),
    [
      'Source code for the FFmpeg program that comes with Lysark',
      '',
      `Lysark starts FFmpeg as a separate program. The one that comes with it is FFmpeg`,
      `${BUILD.version}, the GPL build made by BtbN/FFmpeg-Builds on its tag`,
      `${BUILD.tag}, unchanged. FFmpeg is licensed under the GNU General Public`,
      'License, version 3 or later; the licence text lies next to the program (LICENSE.txt).',
      '',
      'These files are attached to the same release as this note:',
      '',
      ...lines,
      '',
      'The first is the FFmpeg source at the exact commit the build was made from.',
      'The second is the build scripts at the exact tag. The directory scripts.d in it',
      'names every library that is built into the program, where its source is, and the',
      'commit it was built from; patches that were applied lie in the directory patches.',
      'The sources of those libraries are not copied here. They are fetched by the',
      'scripts from the places named there.',
      '',
      'The programs themselves are the ones BtbN published:',
      ...Object.values(BUILD.targets).map((t) => `  ${t.file}  SHA-256 ${t.sha256}`),
      '',
      ...(configure ? ['How the Linux program was configured:', '', configure, ''] : []),
      'Norsk: Dette er kildekoden til FFmpeg-programmet som følger med Lysark, slik',
      'lisensen (GNU GPL versjon 3) krever. Du trenger den ikke for å bruke Lysark.',
      '',
    ].join('\n'),
    'utf8',
  );
  console.log(`source: ${join(outDir, 'FFMPEG-SOURCE.txt')}`);
}

const wanted = process.argv.slice(2);
if (wanted.includes('source')) {
  await fetchSource();
} else {
  for (const name of wanted.length ? wanted : Object.keys(BUILD.targets)) {
    await fetchTarget(name);
  }
}
