// Settings kept between runs: where the owner's USN logo files are, and
// recently used projects. Stored in the user's own data folder.
import { app } from 'electron';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { LogoStatus, LogoVariant } from '../shared/api';

interface LogoFile {
  file: string;
  mime: string;
}

interface Settings {
  logo: Partial<Record<LogoVariant, LogoFile>>;
  logoVersion: number;
  recent: string[];
}

const LOGO_MIME: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png' };

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
  };
  return cache;
}

function save(): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(load(), null, 2), 'utf8');
}

export function logoStatus(): LogoStatus {
  const s = load();
  return {
    light: !!s.logo.light && existsSync(s.logo.light.file),
    dark: !!s.logo.dark && existsSync(s.logo.dark.file),
    version: s.logoVersion,
  };
}

/** The stored logo file for a variant, if the owner has chosen one. */
export function logoFile(variant: LogoVariant): LogoFile | undefined {
  const file = load().logo[variant];
  return file && existsSync(file.file) ? file : undefined;
}

/**
 * Stores a copy of an original logo file. The file is copied byte for
 * byte; the logo is never converted or altered.
 */
export function setLogo(variant: LogoVariant, source: string): void {
  const ext = extname(source).toLowerCase();
  const mime = LOGO_MIME[ext];
  if (!mime) throw new Error('Logoen må være en SVG- eller PNG-fil fra USNs logopakke.');
  mkdirSync(brandDir(), { recursive: true });
  const target = join(brandDir(), `${variant}${ext}`);
  copyFileSync(source, target);
  const s = load();
  s.logo[variant] = { file: target, mime };
  s.logoVersion += 1;
  save();
}

export function clearLogo(variant: LogoVariant): void {
  const s = load();
  const current = s.logo[variant];
  if (current) rmSync(current.file, { force: true });
  delete s.logo[variant];
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
