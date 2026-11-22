// Builds the exported HTML: one file that works offline. Fonts, images and
// the player are written into the file. Videos above a size limit are the
// one exception; they are placed in a folder next to the file.
import type { Project } from '../shared/format/schema';
import { INLINE_VIDEO_LIMIT_BYTES } from '../shared/limits';
import { MORE_CSS, STAGE_CSS } from '../shared/render/css';
import { moreAssets } from '../shared/render/more';
import { PLAYER_CSS } from '../player/css';
import { CLOSING_SCRIPT_ID, type PlayerAssetRef, type PlayerData } from '../player/player';

export type FontFace =
  | 'sans-regular'
  | 'sans-bold'
  | 'sans-italic'
  | 'sans-bolditalic'
  | 'serif-regular'
  | 'serif-italic';

const FONT_CSS: Record<FontFace, { family: string; weight: number; style: string }> = {
  'sans-regular': { family: 'Liberation Sans', weight: 400, style: 'normal' },
  'sans-bold': { family: 'Liberation Sans', weight: 700, style: 'normal' },
  'sans-italic': { family: 'Liberation Sans', weight: 400, style: 'italic' },
  'sans-bolditalic': { family: 'Liberation Sans', weight: 700, style: 'italic' },
  'serif-regular': { family: 'Liberation Serif', weight: 400, style: 'normal' },
  'serif-italic': { family: 'Liberation Serif', weight: 400, style: 'italic' },
};

export interface ExportSources {
  /** The built player bundle (an IIFE). */
  playerJs: string;
  readFont: (face: FontFace) => Uint8Array;
  /** Reads an asset's bytes from the project's media folder. */
  readAsset: (file: string) => Uint8Array;
  logo: { light?: { mime: string; data: Uint8Array }; dark?: { mime: string; data: Uint8Array } };
  /** USN's closing animation, when the owner has supplied it. */
  closing?: { mime: string; data: Uint8Array };
  /**
   * Where a video that is not inlined will be reachable from the HTML file.
   * Returning undefined means it cannot be placed, and it is inlined anyway.
   */
  sidecarHref: (assetId: string, file: string) => string | undefined;
}

export interface ExportResult {
  html: string;
  /** Assets that must be copied next to the HTML file: [asset file, href]. */
  sidecar: Array<{ file: string; href: string; bytes: number }>;
  /** Scenes that show no logo because the logo files are not set up. */
  logoMissing: boolean;
  inlinedBytes: number;
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** JSON that is safe inside a <script> element. */
function scriptJson(value: unknown): string {
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(lineSeparator)
    .join('\\u2028')
    .split(paragraphSeparator)
    .join('\\u2029');
}

/** Ids of the assets the scenes actually use, also inside "Lær mer" content. */
export function usedAssets(project: Project): Set<string> {
  const used = new Set<string>();
  for (const scene of project.scenes) {
    for (const el of scene.elements) {
      if (el.type === 'image') used.add(el.asset);
      else if (el.type === 'video') {
        if (el.source.kind === 'asset') used.add(el.source.asset);
        if (el.poster) used.add(el.poster);
      }
      for (const id of moreAssets(el.more)) used.add(id);
    }
    for (const clip of scene.audio?.clips ?? []) {
      if (clip.kind === 'sound') used.add(clip.asset);
    }
  }
  return used;
}

/** Which font files the project needs. Regular faces are always included. */
export function usedFonts(project: Project): FontFace[] {
  let italic = false;
  let boldItalic = false;
  let serifItalic = false;
  const visit = (
    rt: { paragraphs: Array<{ runs: Array<{ bold?: boolean; italic?: boolean }> }> },
    serif: boolean,
    alwaysBold: boolean,
  ): void => {
    for (const p of rt.paragraphs) {
      for (const run of p.runs) {
        const b = !serif && (alwaysBold || !!run.bold);
        if (serif && run.italic) serifItalic = true;
        if (b && run.italic) boldItalic = true;
        else if (!b && !serif && run.italic) italic = true;
      }
    }
  };
  for (const scene of project.scenes) {
    for (const el of scene.elements) {
      if (el.type === 'text') {
        const serif = el.role === 'title' || el.role === 'number';
        visit(el.content, serif, el.role === 'heading');
      } else if (el.type === 'shape' && el.content) visit(el.content, false, false);
      else if (el.type === 'table') {
        el.rows.forEach((row, i) =>
          row.forEach((cell) => visit(cell.content, false, el.headerRow && i === 0)),
        );
      }
      for (const block of el.more?.blocks ?? []) {
        if (block.kind === 'text') visit(block.content, false, false);
        else if (block.kind === 'table') {
          block.rows.forEach((row, i) =>
            row.forEach((cell) => visit(cell.content, false, block.headerRow && i === 0)),
          );
        }
      }
    }
  }
  // The player's own interface uses regular and bold sans, and serif headings.
  const faces: FontFace[] = ['sans-regular', 'sans-bold', 'serif-regular'];
  if (italic) faces.push('sans-italic');
  if (boldItalic) faces.push('sans-bolditalic');
  if (serifItalic) faces.push('serif-italic');
  return faces;
}

export function buildHtml(project: Project, sources: ExportSources): ExportResult {
  const assets: Record<string, PlayerAssetRef> = {};
  const assetScripts: string[] = [];
  const sidecar: ExportResult['sidecar'] = [];
  let inlinedBytes = 0;

  for (const id of usedAssets(project)) {
    const asset = project.assets[id];
    if (!asset) continue;
    if (asset.kind === 'video' && asset.bytes > INLINE_VIDEO_LIMIT_BYTES) {
      const href = sources.sidecarHref(id, asset.file);
      if (href) {
        assets[id] = { mime: asset.mime, href };
        sidecar.push({ file: asset.file, href, bytes: asset.bytes });
        continue;
      }
    }
    const bytes = sources.readAsset(asset.file);
    inlinedBytes += bytes.byteLength;
    assets[id] = { mime: asset.mime, inline: true };
    assetScripts.push(
      `<script type="application/base64" id="ls-asset-${escapeHtml(id)}">${base64(bytes)}</script>`,
    );
  }

  const logo: PlayerData['logo'] = {};
  for (const variant of ['light', 'dark'] as const) {
    const file = sources.logo[variant];
    if (file) logo[variant] = `data:${file.mime};base64,${base64(file.data)}`;
  }
  const wantsLogo = project.scenes.some((s) => s.showLogo);
  // The closing animation is written into the file once, when a slide plays it.
  const closing = project.scenes.some((s) => s.closingAnimation) ? sources.closing : undefined;
  if (closing) {
    inlinedBytes += closing.data.byteLength;
    assetScripts.push(
      `<script type="application/base64" id="${CLOSING_SCRIPT_ID}">${base64(closing.data)}</script>`,
    );
  }

  const fontCss = usedFonts(project)
    .map((face) => {
      const f = FONT_CSS[face];
      return `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:${f.style};font-display:block;src:url(data:font/ttf;base64,${base64(sources.readFont(face))}) format('truetype');}`;
    })
    .join('\n');

  const data: PlayerData = {
    project,
    assets,
    logo,
    ...(closing ? { closing: { mime: closing.mime } } : {}),
  };
  // No script may load from elsewhere and nothing may phone home. A frame
  // is only ever created when the viewer presses "play" on web content the
  // author has put in, and then only over https.
  const csp =
    "script-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; connect-src 'none'; form-action 'none'; frame-src https:";

  const html = `<!doctype html>
<html lang="${project.meta.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="generator" content="Lysark">
<title>${escapeHtml(project.meta.title)}</title>
<style>
${fontCss}
${STAGE_CSS}
${MORE_CSS}
${PLAYER_CSS}
</style>
</head>
<body>
<div id="lysark-app"></div>
<noscript>${project.meta.language === 'nb' ? 'Denne presentasjonen trenger JavaScript.' : 'This presentation needs JavaScript.'}</noscript>
<script type="application/json" id="lysark-data">${scriptJson(data)}</script>
${assetScripts.join('\n')}
<script>${sources.playerJs.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;

  return {
    html,
    sidecar,
    logoMissing: wantsLogo && !logo.light && !logo.dark,
    inlinedBytes,
  };
}
