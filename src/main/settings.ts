// Settings kept between runs: USN's logo files and recently used projects.
// Stored in the user's own data folder.
import { app } from 'electron';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import type { LogoLanguage, LogoStatus, LogoVariant } from '../shared/api';

interface LogoFile {
  file: string;
  mime: string;
}

type LogoKey = `${LogoLanguage}-${LogoVariant}`;

interface Settings {
  logo: Partial<Record<LogoKey, LogoFile>>;
  logoVersion: number;
  recent: string[];
  /** USN's closing animation, as the owner supplied it; `seconds` is its length. */
  closing?: LogoFile & { seconds: number; sha256: string };
}

/**
 * The files Lysark uses from USN's logo package: the primary logo in purple
 * for light surfaces and in white for purple and indigo surfaces, in
 * Norwegian and in English. The names are the package's own.
 */
const PACKAGE_FILES: Record<LogoKey, string> = {
  'nb-light': 'USN-logo_lilla.svg',
  'nb-dark': 'USN-logo_hvit.svg',
  'en-light': 'USN-logo_purple-EN.svg',
  'en-dark': 'USN-logo_white-EN.svg',
};
const KEYS = Object.keys(PACKAGE_FILES) as LogoKey[];

function settingsPath(): string {
  return join(app.getPath('userData'), 'innstillinger.json');
}

function brandDir(): string {
  return join(app.getPath('userData'), 'merkevare');
}

let cache: Settings | undefined;

function load(): Settings {
  if (cache) return cache;
  let loaded: Partial<Settings> = {};
  try {
    loaded = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<Settings>;
  } catch {
    // First run, or an unreadable file: start from empty settings.
  }
  cache = {
    logo: loaded.logo ?? {},
    logoVersion: loaded.logoVersion ?? 0,
    recent: Array.isArray(loaded.recent) ? loaded.recent : [],
    closing: loaded.closing,
  };
  return cache;
}

function save(): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(load(), null, 2), 'utf8');
}

function stored(key: LogoKey): LogoFile | undefined {
  const file = load().logo[key];
  return file && existsSync(file.file) ? file : undefined;
}

export function logoStatus(): LogoStatus {
  const closing = closingAnimation();
  return {
    nb: { light: !!stored('nb-light'), dark: !!stored('nb-dark') },
    en: { light: !!stored('en-light'), dark: !!stored('en-dark') },
    version: load().logoVersion,
    ...(closing ? { closing: { seconds: closing.seconds } } : {}),
  };
}

const CLOSING_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
};
export const CLOSING_EXTENSIONS = Object.keys(CLOSING_MIME).map((e) => e.slice(1));

/** USN's closing animation, when the owner has supplied it. */
export function closingAnimation(): (LogoFile & { seconds: number; sha256: string }) | undefined {
  const closing = load().closing;
  return closing && existsSync(closing.file) ? closing : undefined;
}

/**
 * Stores a copy of the closing animation, byte for byte, in the program's
 * own settings folder. Like the logo it is never altered and never put in a
 * project or in git. `seconds` is its length, measured by the caller.
 */
export function setClosingAnimation(source: string, seconds: number): void {
  const mime = CLOSING_MIME[extname(source).toLowerCase()];
  if (!mime) throw new Error('Avslutningsanimasjonen må være en MP4- eller WebM-fil.');
  if (!(seconds > 0)) throw new Error('Videofila kan ikke leses.');
  const data = readFileSync(source);
  mkdirSync(brandDir(), { recursive: true });
  const s = load();
  if (s.closing) rmSync(s.closing.file, { force: true });
  const target = join(brandDir(), `avslutning${extname(source).toLowerCase()}`);
  writeFileSync(target, data);
  s.closing = {
    file: target,
    mime,
    seconds,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
  s.logoVersion += 1;
  save();
}

export function clearClosingAnimation(): void {
  const s = load();
  if (s.closing) rmSync(s.closing.file, { force: true });
  delete s.closing;
  s.logoVersion += 1;
  save();
}

/**
 * The logo file for a language and surface. An English presentation uses
 * the Norwegian logo when the English one is not in the package.
 */
export function logoFile(language: LogoLanguage, variant: LogoVariant): LogoFile | undefined {
  return (
    stored(`${language}-${variant}`) ?? (language === 'en' ? stored(`nb-${variant}`) : undefined)
  );
}

function findFile(folder: string, name: string, depth = 0): string | undefined {
  if (depth > 6) return undefined;
  let entries;
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === name) return join(folder, entry.name);
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const found = findFile(join(folder, entry.name), name, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Finds the logo files in an unpacked copy of USN's logo package and stores
 * copies of them. The files are copied byte for byte; the logo is never
 * converted or altered.
 */
export function setLogosFromFolder(folder: string): void {
  const found = KEYS.map((key) => [key, findFile(folder, PACKAGE_FILES[key])] as const).filter(
    (entry): entry is readonly [LogoKey, string] => entry[1] !== undefined,
  );
  if (!found.some(([key]) => key.startsWith('nb-'))) {
    throw new Error(
      `Fant ikke logofilene i mappa. Velg mappa der USNs logopakke er pakket ut (den inneholder ${PACKAGE_FILES['nb-light']} og ${PACKAGE_FILES['nb-dark']}).`,
    );
  }
  mkdirSync(brandDir(), { recursive: true });
  const s = load();
  for (const [key, source] of found) {
    const target = join(brandDir(), `${key}.svg`);
    copyFileSync(source, target);
    s.logo[key] = { file: target, mime: 'image/svg+xml' };
  }
  s.logoVersion += 1;
  save();
}

export function clearLogos(): void {
  const s = load();
  for (const key of KEYS) {
    const current = s.logo[key];
    if (current) rmSync(current.file, { force: true });
  }
  s.logo = {};
  s.logoVersion += 1;
  save();
}

export function recentProjects(): string[] {
  return load().recent.filter((dir) => existsSync(join(dir, 'prosjekt.json')));
}

export function rememberProject(dir: string): void {
  const s = load();
  s.recent = [dir, ...s.recent.filter((d) => d !== dir)].slice(0, 8);
  save();
}
