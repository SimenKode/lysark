// Lifts project files written by older versions to the current format.
// Works on plain data, before validation, and imports nothing from the
// schema so it can be used by it.

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(richText: unknown): boolean {
  if (!isObject(richText) || !Array.isArray(richText.paragraphs)) return false;
  return richText.paragraphs.some(
    (p) =>
      isObject(p) &&
      Array.isArray(p.runs) &&
      p.runs.some((r) => isObject(r) && typeof r.text === 'string' && r.text.trim() !== ''),
  );
}

/**
 * Format 1 -> 2. The "Lær mer" box had its own title, text and media list.
 * In format 2 every element can carry such content (`more`): a title and a
 * list of blocks. The box keeps its label and gets its content as blocks.
 */
function lift1to2(project: Json): void {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  for (const scene of scenes) {
    if (!isObject(scene) || !Array.isArray(scene.elements)) continue;
    for (const el of scene.elements) {
      if (!isObject(el) || el.type !== 'deepdive') continue;
      const blocks: Json[] = [];
      // Ids only need to be unique inside the element; these are stable from run to run.
      const id = (): string => `b_${String(el.id)}_${blocks.length + 1}`;
      if (hasText(el.body)) blocks.push({ id: id(), kind: 'text', content: el.body });
      const media = Array.isArray(el.media) ? el.media : [];
      for (const item of media) {
        if (!isObject(item)) continue;
        if (item.kind === 'image') {
          blocks.push({ id: id(), kind: 'image', asset: item.asset, alt: item.alt ?? '' });
        } else if (item.kind === 'video') {
          blocks.push({ id: id(), kind: 'video', source: item.source, title: item.title ?? '' });
        } else if (item.kind === 'link' && typeof item.url === 'string' && item.url.trim()) {
          const label = typeof item.label === 'string' && item.label.trim() ? item.label : item.url;
          blocks.push({
            id: id(),
            kind: 'text',
            content: {
              paragraphs: [
                { level: 0, list: 'none', runs: [{ text: label, link: item.url.trim() }] },
              ],
            },
          });
        }
      }
      el.more = { title: typeof el.label === 'string' ? el.label : '', blocks };
      delete el.body;
      delete el.media;
    }
  }
  project.version = 2;
}

/** Returns the data in the current format. Data that is already current is returned as it is. */
export function migrateProject(data: unknown, currentVersion: number): unknown {
  if (!isObject(data) || typeof data.version !== 'number' || data.version >= currentVersion) {
    return data;
  }
  const project = structuredClone(data);
  if (project.version === 1) lift1to2(project);
  // 2 -> 3 only added an optional field (the stroke width of shapes).
  if (project.version === 2) project.version = 3;
  // 3 -> 4 only added optional things (sound on slides, choices for video).
  if (project.version === 3) project.version = 4;
  // 4 -> 5 only added things (a shape, and a choice on closing slides).
  if (project.version === 4) project.version = 5;
  // 5 -> 6 only added things (events on slides, tracks on the project).
  if (project.version === 5) project.version = 6;
  // 6 -> 7 only added things (the camera circle).
  if (project.version === 6) project.version = 7;
  // 7 -> 8 only added things (marks on pictures).
  if (project.version === 7) project.version = 8;
  // 8 -> 9 only added things (chapters, and slides shown once more).
  if (project.version === 8) project.version = 9;
  // 9 -> 10 only added things (groups, and lines fastened to elements).
  if (project.version === 9) project.version = 10;
  // 10 -> 11 only added things (figures that draw themselves from a form).
  if (project.version === 10) project.version = 11;
  // 11 -> 12 only added things (the time axis among the figures with a form).
  if (project.version === 11) project.version = 12;
  // 12 -> 13 only added things (bar and line diagrams, and the curve they draw).
  if (project.version === 12) project.version = 13;
  // 13 -> 14 only added things (a figure in a "Lær mer" box).
  if (project.version === 13) project.version = 14;
  // 14 -> 15 only added things (names along the axis of a line diagram).
  if (project.version === 14) project.version = 15;
  // 15 -> 16 only added things (more movements, and steps that mark, take away and zoom).
  if (project.version === 15) project.version = 16;
  // 16 -> 17 only added things (row heights, spacing, alignment and cell sizes of tables).
  if (project.version === 16) project.version = 17;
  return project;
}
