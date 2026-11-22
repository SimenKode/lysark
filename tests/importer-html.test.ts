// Opening an exported HTML file as a project again: the round trip, large
// videos next to the file, and refusal of files and paths that are not what
// an export contains.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHtml, type ExportSources } from '../src/exporter/html';
import { importHtml, sidecarPath, type SidecarReader } from '../src/importer/html';
import { FORMAT_VERSION } from '../src/shared/format/schema';
import { readHtmlExport, readProject, writeHtmlExport } from '../src/main/projectIo';
import { newId, newScene } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { INLINE_VIDEO_LIMIT_BYTES } from '../src/shared/limits';
import { sampleProject } from './fixtures/sampleProject';

const noSidecar: SidecarReader = () => undefined;

function hash16(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/** Exports a project the way the program does, with stand-ins for the player and the fonts. */
function exported(
  project: Project,
  media: Record<string, Uint8Array>,
  sidecarFolder = 'Eksport_filer',
): string {
  const sources: ExportSources = {
    // Text that looks like the elements the importer searches for must not confuse it.
    playerJs:
      'var a = "<script type=\\"application/json\\" id=\\"lysark-data\\">{}"; var b = "</script>";',
    readFont: () => new Uint8Array([1, 2, 3]),
    readAsset: (file) => media[file]!,
    logo: {},
    sidecarHref: (_id, file) =>
      `${encodeURIComponent(sidecarFolder)}/${file.replace(/^media\//, '')}`,
  };
  return buildHtml(project, sources).html;
}

/** The sample project with a large video on its second scene. */
function withLargeVideo(): { project: Project; videoId: string; video: Uint8Array } {
  const { project } = sampleProject();
  const videoId = newId('a');
  const video = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 1, 2, 3]);
  project.assets[videoId] = {
    kind: 'video',
    file: 'media/storvideo.mp4',
    mime: 'video/mp4',
    // What decides is the size the project states; the test file itself is tiny.
    bytes: INLINE_VIDEO_LIMIT_BYTES + 1,
    name: 'Video A.mp4',
  };
  project.scenes[1]!.elements.push({
    id: newId('e'),
    type: 'video',
    source: { kind: 'asset', asset: videoId },
    title: 'Video A',
    box: { x: 1400, y: 700, w: 320, h: 180, rotation: 0 },
  });
  return { project, videoId, video };
}

/** Replaces the project data inside an exported file. */
function withData(html: string, change: (data: Record<string, any>) => void): string {
  const match = /(<script type="application\/json" id="lysark-data">)([\s\S]*?)(<\/script>)/.exec(
    html,
  )!;
  const data = JSON.parse(match[2]!) as Record<string, any>;
  change(data);
  // "<" is written the way the exporter writes it, so the JSON cannot end its own element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return html.replace(match[0], () => `${match[1]}${json}${match[3]}`);
}

describe('an exported HTML file as a project again', () => {
  it('gives back the same project and the same media', () => {
    const { project, media } = sampleProject();
    project.meta.title = 'Tittel <script id="lysark-data"> & «A»';
    const png = media[0]!.data;
    const html = exported(project, { 'media/testbilde.png': png });

    const result = importHtml(html, noSidecar);
    const [imageId] = Object.keys(project.assets);
    const file = `media/${hash16(png)}.png`;
    expect(result.project).toEqual({
      ...project,
      assets: { [imageId!]: { ...project.assets[imageId!]!, file, bytes: png.length } },
    });
    expect(result.media).toHaveLength(1);
    expect(result.media[0]!.file).toBe(file);
    expect(Buffer.from(result.media[0]!.data).equals(png)).toBe(true);
    expect(result.sidecar).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it('lifts a file exported in an older format', () => {
    const { project, media } = sampleProject();
    const html = withData(exported(project, { 'media/testbilde.png': media[0]!.data }), (data) => {
      data.project.version = 2;
    });
    const result = importHtml(html, noSidecar);
    expect(result.project.version).toBe(FORMAT_VERSION);
    expect(result.project.scenes).toEqual(project.scenes);
  });

  it('says so when media that were not in use did not come along', () => {
    const { project, media } = sampleProject();
    const unused = newId('a');
    project.assets[unused] = {
      kind: 'image',
      file: 'media/ubrukt.png',
      mime: 'image/png',
      bytes: 3,
      name: 'ubrukt.png',
    };
    const result = importHtml(
      exported(project, { 'media/testbilde.png': media[0]!.data }),
      noSidecar,
    );
    expect(Object.keys(result.project.assets)).not.toContain(unused);
    expect(result.notes).toEqual([
      'Én mediefil som lå i prosjektet uten å være brukt i noe lysark, fulgte ikke med i HTML-fila.',
    ]);
  });

  it('takes a large video from the folder next to the file', () => {
    const { project, videoId, video } = withLargeVideo();
    const { media } = sampleProject();
    const html = exported(
      project,
      { 'media/testbilde.png': media[0]!.data },
      'Forelesning A_filer',
    );
    expect(html).toContain('"href":"Forelesning%20A_filer/storvideo.mp4"');

    const asked: string[][] = [];
    const result = importHtml(html, (path) => {
      asked.push(path);
      return { hash: 'ab'.repeat(32), bytes: video.length };
    });
    expect(asked).toEqual([['Forelesning A_filer', 'storvideo.mp4']]);
    const file = `media/${'ab'.repeat(8)}.mp4`;
    expect(result.project.assets[videoId]).toEqual({
      ...project.assets[videoId]!,
      file,
      bytes: video.length,
    });
    expect(result.sidecar).toEqual([{ path: ['Forelesning A_filer', 'storvideo.mp4'], file }]);
    expect(result.media.map((m) => m.file)).not.toContain(file);
    expect(result.notes).toEqual([]);
  });

  it('leaves a video out, and says where it was used, when its folder is gone', () => {
    const { project, videoId } = withLargeVideo();
    const { media } = sampleProject();
    const result = importHtml(
      exported(project, { 'media/testbilde.png': media[0]!.data }),
      noSidecar,
    );
    expect(result.project.assets[videoId]).toBeUndefined();
    // The element stays, and shows that its file is missing.
    expect(result.project.scenes).toEqual(project.scenes);
    expect(result.notes).toEqual([
      'Videoen «Video A.mp4» (lysark 2) lå ikke i mappa ved siden av HTML-fila og er ikke med. ' +
        'Lysarket viser at fila mangler; sett den inn på nytt.',
    ]);
  });
});

describe('files that are not an export from Lysark', () => {
  const { project, media } = sampleProject();
  const good = exported(project, { 'media/testbilde.png': media[0]!.data });

  it('refuses other HTML files with an explanation', () => {
    for (const html of [
      '',
      '<!doctype html><html><head><title>A</title></head><body><p>B</p></body></html>',
      '<!doctype html><html><head><meta name="generator" content="Annet program"></head></html>',
      // Saying so further down in the file is not enough.
      good.replace('<meta name="generator" content="Lysark">', ''),
      `<html><head></head><body><meta name="generator" content="Lysark">${good.slice(good.indexOf('<div id="lysark-app">'))}`,
    ]) {
      expect(() => importHtml(html, noSidecar)).toThrow(
        'Fila er ikke en forelesning eksportert fra Lysark.',
      );
    }
  });

  it('refuses a file whose project cannot be read', () => {
    const start = good.indexOf('id="lysark-data">') + 'id="lysark-data">'.length;
    const broken = [
      `${good.slice(0, start)}{"project":${good.slice(start + 40)}`,
      good.replace('id="lysark-data"', 'id="noe-annet"'),
      withData(good, (data) => {
        delete data.project;
      }),
      good.slice(0, start + 200),
    ];
    for (const html of broken) {
      expect(() => importHtml(html, noSidecar)).toThrow(/innholdet er skadet/);
    }
    expect(() =>
      importHtml(
        withData(good, (data) => {
          data.project.scenes = 'x';
        }),
        noSidecar,
      ),
    ).toThrow(/Prosjektfila er skadet/);
    expect(() =>
      importHtml(
        withData(good, (data) => {
          data.project.version = 99;
        }),
        noSidecar,
      ),
    ).toThrow(/nyere utgave av Lysark/);
  });

  it('accepts only a plain path downwards as the place of a video', () => {
    expect(sidecarPath('Mappe%20A_filer/video.mp4')).toEqual(['Mappe A_filer', 'video.mp4']);
    expect(sidecarPath('a%3Ab/video.mp4')).toEqual(['a:b', 'video.mp4']);
    for (const href of [
      '',
      '../video.mp4',
      'a/../../video.mp4',
      'a/./video.mp4',
      'a//video.mp4',
      '/etc/passwd',
      'C:/video.mp4',
      'C%3A/video.mp4',
      'a\\..\\video.mp4',
      'a/%2e%2e/video.mp4',
      'a/..%2Fvideo.mp4',
      'a/%5C..%5Cvideo.mp4',
      'a/%00/video.mp4',
      'a/%zz/video.mp4',
      'https://example.org/video.mp4',
      'file:///etc/passwd',
      '//example.org/video.mp4',
      'a/video.mp4?x=1',
      'a/video.mp4#x',
    ]) {
      expect(sidecarPath(href), href).toBeNull();
    }
  });

  it('never looks outside the folder for a video, whatever the file says', () => {
    const { project, videoId } = withLargeVideo();
    const html = exported(project, { 'media/testbilde.png': media[0]!.data });
    for (const href of ['../../hemmelig.mp4', '/etc/passwd', 'https://example.org/v.mp4', 7]) {
      const reader = vi.fn<SidecarReader>(() => ({ hash: 'cd'.repeat(32), bytes: 1 }));
      const result = importHtml(
        withData(html, (data) => {
          data.assets[videoId].href = href;
        }),
        reader,
      );
      expect(reader).not.toHaveBeenCalled();
      expect(result.project.assets[videoId]).toBeUndefined();
      expect(result.notes).toHaveLength(1);
    }
  });

  it('names media after their content, never after what the file calls them', () => {
    const { project: tricky, media: files } = sampleProject();
    const [imageId] = Object.keys(tricky.assets);
    const png = files[0]!.data;
    const base = exported(tricky, { 'media/testbilde.png': png });

    // An asset id that is not a plain name is not taken along at all.
    for (const badId of ['../../ute', '__proto__', 'a"><script>alert(1)</script>', 'a b']) {
      const html = withData(base, (data) => {
        // defineProperty, so that "__proto__" becomes a key of its own in the file.
        for (const table of [data.project.assets, data.assets]) {
          Object.defineProperty(table, badId, { value: table[imageId!], enumerable: true });
        }
        for (const el of data.project.scenes[1].elements) {
          if (el.type === 'image') el.asset = badId;
        }
      });
      expect(html).toContain(JSON.stringify(badId).replace(/</g, '\\u003c'));
      const result = importHtml(html, noSidecar);
      expect(Object.keys(result.project.assets)).toEqual([imageId]);
      expect(Object.getPrototypeOf(result.project.assets)).toBe(Object.prototype);
      expect(result.media.map((item) => item.file)).toEqual([`media/${hash16(png)}.png`]);
      // The project check itself throws "__proto__" away; the others are named in a note.
      expect(result.notes).toHaveLength(badId === '__proto__' ? 0 : 1);
    }

    // A file name inside the project that is not a media file gives no file.
    for (const file of ['media/..', 'media/program.exe', 'media/side.html', 'media/x']) {
      const result = importHtml(
        withData(base, (data) => {
          data.project.assets[imageId!].file = file;
        }),
        noSidecar,
      );
      expect(result.media).toEqual([]);
      expect(result.project.assets).toEqual({});
      expect(result.notes[0]).toContain('er i et format Lysark ikke kan ta imot');
    }

    // Content that is not base64 is not written anywhere.
    const garbled = base.replace(
      new RegExp(`(id="ls-asset-${imageId}">)[^<]{20}`),
      (_all, start: string) => `${start}!!!! ikke base64 !!!!`,
    );
    const result = importHtml(garbled, noSidecar);
    expect(result.media).toEqual([]);
    expect(result.notes[0]).toContain('kunne ikke hentes ut av HTML-fila');
  });
});

describe('an exported HTML file on disk', () => {
  let work: string;
  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'lysark-html-'));
  });
  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  it('becomes a project folder with its media and the video from the folder next to it', () => {
    const { project, videoId, video } = withLargeVideo();
    const { media } = sampleProject();
    const png = media[0]!.data;
    const source = join(work, 'Eksport.html');
    writeFileSync(source, exported(project, { 'media/testbilde.png': png }));
    mkdirSync(join(work, 'Eksport_filer'));
    writeFileSync(join(work, 'Eksport_filer', 'storvideo.mp4'), video);

    const read = readHtmlExport(source);
    expect(read.content.notes).toEqual([]);
    const dir = join(work, 'Prosjekt');
    expect(existsSync(dir)).toBe(false); // reading writes nothing
    writeHtmlExport(read, dir);

    const opened = readProject(dir);
    const videoFile = `media/${hash16(video)}.mp4`;
    expect(opened.assets[videoId]).toMatchObject({ file: videoFile, bytes: video.length });
    expect(readdirSync(join(dir, 'media')).sort()).toEqual(
      [`${hash16(png)}.png`, `${hash16(video)}.mp4`].sort(),
    );
    expect(readFileSync(join(dir, videoFile)).equals(Buffer.from(video))).toBe(true);
    expect(opened.scenes).toEqual(project.scenes);
  });

  it('does not follow a link out of the folder, and never writes over an existing project', () => {
    const { project, videoId } = withLargeVideo();
    const { media } = sampleProject();
    const outside = join(work, 'utenfor.mp4');
    writeFileSync(outside, 'hemmelig');
    const folder = join(work, 'mappe');
    mkdirSync(join(folder, 'Eksport_filer'), { recursive: true });
    symlinkSync(outside, join(folder, 'Eksport_filer', 'storvideo.mp4'));
    const source = join(folder, 'Eksport.html');
    writeFileSync(source, exported(project, { 'media/testbilde.png': media[0]!.data }));

    const read = readHtmlExport(source);
    expect(read.content.project.assets[videoId]).toBeUndefined();
    expect(read.content.notes).toHaveLength(1);
    expect(() => writeHtmlExport(read, folder)).toThrow(/ikke tom/);
  });

  it('refuses a file that is not from Lysark', () => {
    const source = join(work, 'annet.html');
    writeFileSync(source, '<!doctype html><title>A</title><p>B</p>');
    expect(() => readHtmlExport(source)).toThrow(
      'Fila er ikke en forelesning eksportert fra Lysark.',
    );
    expect(() => readHtmlExport(join(work, 'finnes-ikke.html'))).toThrow(
      'HTML-fila kan ikke leses.',
    );
  });
});

describe('scenes that refer to what did not come along', () => {
  it('names every scene an asset was used on', () => {
    const { project, videoId } = withLargeVideo();
    const { media } = sampleProject();
    const extra = newScene('content', 'Mer');
    extra.elements.push({
      id: newId('e'),
      type: 'deepdive',
      label: 'Mer',
      more: {
        title: 'Mer',
        blocks: [
          { id: 'b1', kind: 'video', source: { kind: 'asset', asset: videoId }, title: 'Video A' },
        ],
      },
      box: { x: 120, y: 120, w: 320, h: 76, rotation: 0 },
    });
    project.scenes.push(extra);
    const result = importHtml(
      exported(project, { 'media/testbilde.png': media[0]!.data }),
      noSidecar,
    );
    expect(result.notes[0]).toContain('Videoen «Video A.mp4» (lysark 2 og 4) lå ikke i mappa');
  });
});
