// Which files in a project's media folder are in use. Used by «Rydd i
// prosjektmappa», which moves the rest to the waste bin.
import type { Asset, Project } from './schema';

type Lecture = Pick<Project, 'assets' | 'scenes' | 'tracks'>;

/**
 * Notes every string in `value` that is the id of an asset. Objects already
 * seen are not walked again: the states of the undo history share most of
 * their parts.
 */
function collect(
  value: unknown,
  isAsset: (id: string) => boolean,
  used: Set<string>,
  seen: WeakSet<object>,
): void {
  if (typeof value === 'string') {
    if (isAsset(value)) used.add(value);
    return;
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    collect(item, isAsset, used, seen);
  }
}

/**
 * The files (`media/…`) that any of these projects uses: every asset whose
 * id a slide or a track points at, wherever in it that is (a picture, a
 * video and its still picture, the content of a "Lær mer" box, a figure
 * fetched into one, the sound of a slide, a clip of music), and the film of
 * the face that belongs to a recording in use. An asset that only stands in
 * the list of assets is not in use. The projects are the project as it is,
 * as it was saved, and every state "Angre" and "Gjør om" can bring back.
 */
export function usedMediaFiles(projects: ReadonlyArray<Lecture>): Set<string> {
  const assets = new Map<string, Asset>();
  for (const project of projects) {
    for (const [id, asset] of Object.entries(project.assets)) assets.set(id, asset);
  }
  const used = new Set<string>();
  const seen = new WeakSet<object>();
  for (const project of projects) {
    collect(project.scenes, (id) => assets.has(id), used, seen);
    collect(project.tracks, (id) => assets.has(id), used, seen);
  }
  for (const id of [...used]) {
    const film = assets.get(id)?.camera?.asset;
    if (film && assets.has(film)) used.add(film);
  }
  const files = new Set<string>();
  for (const id of used) files.add(assets.get(id)!.file);
  return files;
}
