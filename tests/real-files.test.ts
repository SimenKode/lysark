// Imports every PowerPoint file in eksempler/ (the owner's real lectures,
// never in git) and checks that the result is a valid project. Skipped when
// the folder has no PPTX files. Prints a summary per file.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importPptx, layOutFrontScenes } from '../src/importer/pptx';
import { Project } from '../src/shared/format/schema';

const folder = resolve(__dirname, '../eksempler');
const files = existsSync(folder)
  ? readdirSync(folder)
      .filter((name) => name.toLowerCase().endsWith('.pptx'))
      .sort()
  : [];

describe.skipIf(files.length === 0)('the owner’s real lectures', () => {
  for (const name of files) {
    it(`imports ${name}`, () => {
      const started = Date.now();
      const result = importPptx(new Uint8Array(readFileSync(join(folder, name))), {
        fileName: name,
      });
      layOutFrontScenes(result.project);
      const seconds = (Date.now() - started) / 1000;
      const parsed = Project.safeParse(result.project);
      if (!parsed.success) {
        throw new Error(JSON.stringify(parsed.error.issues.slice(0, 5), null, 2));
      }
      const { report, project } = result;
      expect(project.scenes).toHaveLength(report.slides);

      // Every asset an element uses must exist, and every media file must be described.
      const mediaFiles = new Set(result.media.map((m) => m.file));
      for (const asset of Object.values(project.assets)) {
        expect(mediaFiles.has(asset.file), asset.file).toBe(true);
      }

      const byCode = new Map<string, number>();
      for (const warning of report.warnings) {
        byCode.set(warning.code, (byCode.get(warning.code) ?? 0) + 1);
      }
      const empty = project.scenes.filter((s) => s.elements.length === 0).length;
      const kinds = project.scenes.reduce<Record<string, number>>((acc, s) => {
        acc[s.kind] = (acc[s.kind] ?? 0) + 1;
        return acc;
      }, {});
      const megabytes = result.media.reduce((sum, m) => sum + m.data.byteLength, 0) / 1048576;
      console.log(
        [
          name,
          `  ${report.slides} lysark (${Object.entries(kinds)
            .map(([k, n]) => `${n} ${k}`)
            .join(', ')}), ${empty} tomme, ${seconds.toFixed(1)} s`,
          `  ${report.texts} tekster, ${report.images} bilder, ${report.tables} tabeller, ${report.shapes} former, ${report.videos} videoer, manus på ${report.notes}`,
          `  ${result.media.length} mediefiler, ${megabytes.toFixed(1)} MB`,
          `  merknader: ${[...byCode.entries()].map(([c, n]) => `${c}=${n}`).join(', ') || 'ingen'}`,
        ].join('\n'),
      );
    });
  }
});
