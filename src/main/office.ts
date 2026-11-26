// Making a PDF of a PowerPoint file, so that its slides can keep the look
// they have. Lysark cannot draw a PowerPoint slide the way PowerPoint does;
// a program that can is asked to (the owner chose this on 25.11.2026):
// PowerPoint itself where it is installed (Windows), otherwise LibreOffice.
// Neither is part of Lysark, linked in or shipped with it: like FFmpeg they
// are separate programs that Lysark starts, here programs the lecturer has
// installed. They work on a copy of the file, in a folder of their own, show
// no window, and nothing is sent anywhere.
//
// LibreOffice does not draw quite as PowerPoint does, least of all where the
// fonts of the presentation are not on the machine. A PDF the lecturer has
// saved from PowerPoint is the real thing, so one that lies next to the
// PowerPoint file, with the same name and not older than it, is used before
// LibreOffice is asked. The lecturer is told which of them the look came from.
import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** How long a program gets to make the PDF before it is given up. */
const LIMIT_MS = 5 * 60 * 1000;

function run(file: string, args: string[], env?: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout: LIMIT_MS, windowsHide: true, env: env ?? process.env },
      (error) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
}

/** Where LibreOffice is on this machine, if it is installed. */
export function findLibreOffice(): string | undefined {
  // A test, or an owner with LibreOffice in an unusual place, can point at it.
  const chosen = process.env.LYSARK_SOFFICE;
  if (chosen !== undefined) return chosen !== '' && existsSync(chosen) ? chosen : undefined;
  const candidates: string[] = [];
  if (process.platform === 'win32') {
    for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
      if (root) candidates.push(join(root, 'LibreOffice', 'program', 'soffice.exe'));
    }
  } else {
    if (process.platform === 'darwin') {
      candidates.push('/Applications/LibreOffice.app/Contents/MacOS/soffice');
    }
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
      if (dir) candidates.push(join(dir, 'soffice'), join(dir, 'libreoffice'));
    }
  }
  return candidates.find((candidate) => existsSync(candidate));
}

async function withLibreOffice(program: string, source: string, work: string): Promise<string> {
  const out = join(work, 'ut');
  await run(program, [
    '--headless',
    '--norestore',
    '--nolockcheck',
    // Its own settings folder: the lecturer's LibreOffice may be open, and is not touched.
    `-env:UserInstallation=${pathToFileURL(join(work, 'profil')).href}`,
    '--convert-to',
    'pdf',
    '--outdir',
    out,
    source,
  ]);
  return join(out, 'inn.pdf');
}

/**
 * PowerPoint saves the copy as PDF, without a window. PowerPoint is left
 * running when the lecturer has other presentations open in it.
 *
 * The copy is closed whether or not the PDF was made. PowerPoint can open a
 * file and then refuse to save it: a presentation without slides gives "An
 * error occurred while PowerPoint was saving the file" (found in the owner's
 * Windows VM, 26.11.2026). Without the close PowerPoint was then left
 * running, out of sight, with the copy open. With a presentation that has
 * slides, this very request made the PDF there in under a second.
 */
export const POWERPOINT_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$app = New-Object -ComObject PowerPoint.Application',
  '$doc = $null',
  'try {',
  // Read-only, with its own name, without a window.
  '  $doc = $app.Presentations.Open($env:LYSARK_INN, -1, 0, 0)',
  // 32 is PowerPoint's number for PDF.
  '  $doc.SaveAs($env:LYSARK_UT, 32)',
  '} finally {',
  '  if ($doc) { $doc.Close() }',
  '  if ($app.Presentations.Count -eq 0) { $app.Quit() }',
  '}',
].join('\n');

async function withPowerPoint(source: string, work: string): Promise<string> {
  const out = join(work, 'ut.pdf');
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', POWERPOINT_SCRIPT], {
    ...process.env,
    LYSARK_INN: source,
    LYSARK_UT: out,
  });
  return out;
}

/** Where the PDF of a presentation came from. */
export type PdfMaker = 'powerpoint' | 'beside' | 'libreoffice';

export interface PresentationPdf {
  data: Uint8Array;
  by: PdfMaker;
  /** The name of the PDF that lay next to the presentation, when that was used. */
  file?: string;
}

/** A PDF next to the presentation, with its name, saved at the same time or later. */
function pdfBeside(file: string): string | undefined {
  const pdf = file.replace(/\.pptx$/i, '.pdf');
  try {
    if (pdf !== file && statSync(pdf).mtimeMs >= statSync(file).mtimeMs) return pdf;
  } catch {
    // There is none.
  }
  return undefined;
}

/**
 * A PDF of a PowerPoint file: made by PowerPoint (Windows), found next to
 * the file, or made by LibreOffice, in that order. Resolves with null when
 * there is none to be had on this machine: the lecturer is then asked for a
 * PDF of the presentation.
 */
export async function presentationToPdf(file: string): Promise<PresentationPdf | null> {
  const work = mkdtempSync(join(tmpdir(), 'lysark-pdf-'));
  try {
    const source = join(work, 'inn.pptx');
    copyFileSync(file, source);
    const made = async (way: () => Promise<string>): Promise<Uint8Array | undefined> => {
      try {
        const out = await way();
        if (existsSync(out)) return new Uint8Array(readFileSync(out));
      } catch {
        // This program is not there, or could not do it: the next way is tried.
      }
      return undefined;
    };
    if (process.platform === 'win32' && process.env.LYSARK_SOFFICE === undefined) {
      const data = await made(() => withPowerPoint(source, work));
      if (data) return { data, by: 'powerpoint' };
    }
    const beside = pdfBeside(file);
    if (beside) {
      return { data: new Uint8Array(readFileSync(beside)), by: 'beside', file: basename(beside) };
    }
    const libreOffice = findLibreOffice();
    if (libreOffice) {
      const data = await made(() => withLibreOffice(libreOffice, source, work));
      if (data) return { data, by: 'libreoffice' };
    }
    return null;
  } finally {
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {
      // A program that still holds the copy keeps the folder for now. That
      // is no reason to lose the PDF, or to keep the lecturer from the next way.
    }
  }
}
