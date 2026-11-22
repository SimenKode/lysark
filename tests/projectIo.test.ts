// Reading, writing, packing and unpacking projects on disk.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addMediaFile,
  createProject,
  mediaPath,
  packProject,
  readProject,
  saveProject,
  unpackProject,
} from '../src/main/projectIo';
import { testPng, writeSampleProject } from './fixtures/sampleProject';

let work: string;
beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'lysark-io-'));
});
afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('project folders', () => {
  it('creates, saves and reads a project', () => {
    const dir = join(work, 'Ny');
    const project = createProject(dir);
    expect(project.meta.title).toBe('Ny');
    expect(existsSync(join(dir, 'media'))).toBe(true);
    saveProject(dir, { ...project, meta: { ...project.meta, title: 'Endret' } });
    expect(readProject(dir).meta.title).toBe('Endret');
    expect(existsSync(join(dir, 'prosjekt.json.ny'))).toBe(false);
  });

  it('never creates a project on top of existing files', () => {
    const dir = join(work, 'Opptatt');
    writeSampleProject(dir);
    expect(() => createProject(dir)).toThrow(/ikke tom/);
  });

  it('refuses to save a project that could not be opened again', () => {
    const dir = join(work, 'Ny');
    const project = createProject(dir);
    const broken = { ...project, scenes: 'x' } as unknown as typeof project;
    expect(() => saveProject(dir, broken)).toThrow();
    expect(readProject(dir).scenes).toEqual([]);
  });

  it('keeps media inside the media folder', () => {
    expect(() => mediaPath(work, '../utenfor.png')).toThrow();
    expect(() => mediaPath(work, 'media/../../utenfor.png')).toThrow();
    expect(mediaPath(work, 'media/a.png')).toBe(join(work, 'media', 'a.png'));
  });

  it('copies added media under a name made from its content', () => {
    const dir = join(work, 'Ny');
    createProject(dir);
    const source = join(work, 'Mitt bilde.PNG');
    writeFileSync(source, testPng(4, 4));
    const first = addMediaFile(dir, source, 'image');
    const second = addMediaFile(dir, source, 'image');
    expect(first.asset.file).toMatch(/^media\/[0-9a-f]{16}\.png$/);
    expect(second.asset.file).toBe(first.asset.file);
    expect(first.asset.name).toBe('Mitt bilde.PNG');
    expect(existsSync(join(dir, first.asset.file))).toBe(true);
    expect(() => addMediaFile(dir, source, 'video')).toThrow(/MP4 eller WebM/);
  });
});

describe('one-file packages', () => {
  it('packs a project and unpacks it to an identical one', () => {
    const dir = join(work, 'Kilde');
    const project = writeSampleProject(dir);
    const zip = join(work, 'Kilde.lysark.zip');
    expect(packProject(dir, zip)).toBeGreaterThan(0);

    const target = join(work, 'Kopi');
    expect(unpackProject(zip, target)).toEqual(project);
    expect(readProject(target)).toEqual(project);
    expect(readFileSync(join(target, 'media/testbilde.png'))).toEqual(
      readFileSync(join(dir, 'media/testbilde.png')),
    );
  });

  it('ignores files in a package that try to land outside the project', () => {
    const project = writeSampleProject(join(work, 'Kilde'));
    const zip = join(work, 'ond.zip');
    writeFileSync(
      zip,
      zipSync({
        'prosjekt.json': strToU8(JSON.stringify(project)),
        '../utenfor.txt': strToU8('x'),
        'media/../../utenfor2.txt': strToU8('x'),
        'media/ok.png': new Uint8Array(testPng(2, 2)),
        'annet.txt': strToU8('x'),
      }),
    );
    const target = join(work, 'ut', 'Prosjekt');
    unpackProject(zip, target);
    expect(existsSync(join(target, 'media/ok.png'))).toBe(true);
    expect(existsSync(join(work, 'ut', 'utenfor.txt'))).toBe(false);
    expect(existsSync(join(work, 'utenfor2.txt'))).toBe(false);
    expect(existsSync(join(target, 'annet.txt'))).toBe(false);
  });

  it('explains when a file is not a packed project', () => {
    const notZip = join(work, 'tekst.zip');
    writeFileSync(notZip, 'ikke en zip');
    expect(() => unpackProject(notZip, join(work, 'A'))).toThrow(
      /ikke et Lysark-prosjekt lagret som én fil/,
    );
    const empty = join(work, 'tom.zip');
    writeFileSync(empty, zipSync({ 'annet.txt': strToU8('x') }));
    expect(() => unpackProject(empty, join(work, 'B'))).toThrow(
      /ikke et Lysark-prosjekt lagret som én fil/,
    );
  });
});
