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
  return project;
}
