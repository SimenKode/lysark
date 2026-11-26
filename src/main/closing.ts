// USN's closing animation. In the owner's lectures the last slide is the
// university's logo animation as a video. The owner wants it to belong to
// the program as a suggested ending that starts by itself when the slide is
// shown, not to be a video with a play button (22.11.2026).
//
// The film is USN's material: it is never in git and never redrawn. Like
// the logo files it is kept, unchanged, in the program's settings folder.
// It gets there when the owner points at the file, or the first time a
// lecture that has it is imported.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stageOf, type Stage } from '../shared/format/constants';
import type { Project, Scene } from '../shared/format/schema';
import { mediaSeconds } from './ffmpeg';
import { mediaPath } from './projectIo';
import { closingAnimation, setClosingAnimation } from './settings';

/** A film longer than this is not a logo animation. */
const LONGEST_FILM_SECONDS = 30;

/**
 * The one video that fills a slide, when the slide is an ending: either a
 * closing slide, or the last slide of the lecture with nothing else on it
 * (USN's template does not always mark its last slide as a closing slide).
 */
function fullSlideVideo(
  scene: Scene,
  last: boolean,
  stage: Stage,
): { index: number; asset: string } | undefined {
  if (scene.kind !== 'closing' && !(last && scene.elements.length === 1)) return undefined;
  const videos = scene.elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.type === 'video');
  const only = videos[0];
  if (videos.length !== 1 || !only || only.element.type !== 'video') return undefined;
  const { source, box } = only.element;
  if (source.kind !== 'asset') return undefined;
  const covered = (box.w * box.h) / (stage.width * stage.height);
  return covered >= 0.7 ? { index: only.index, asset: source.asset } : undefined;
}

/**
 * After a PowerPoint import: a closing slide whose only video fills the
 * slide is the closing animation. The first time, the film is taken into
 * the settings. After that, a slide that carries the very same film (byte
 * for byte) is set to play it by itself, and its video element is taken
 * out; a slide with another film is left as it was imported.
 * Returns the project, changed or not, and the slides (numbered from 1)
 * that now play the film.
 */
export function adoptClosingAnimation(
  dir: string,
  project: Project,
): { project: Project; slides: number[] } {
  let out = project;
  const slides: number[] = [];
  project.scenes.forEach((scene, sceneIndex) => {
    const video = fullSlideVideo(scene, sceneIndex === project.scenes.length - 1, stageOf(project));
    const asset = video ? project.assets[video.asset] : undefined;
    if (!video || !asset) return;
    let file: string;
    let hash: string;
    try {
      file = mediaPath(dir, asset.file);
      hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    } catch {
      return;
    }
    let kept = closingAnimation();
    if (!kept) {
      // Without FFmpeg the length cannot be measured; the slide then stays a video.
      const seconds = mediaSeconds(file);
      if (seconds === undefined || seconds > LONGEST_FILM_SECONDS) return;
      try {
        setClosingAnimation(file, seconds);
      } catch {
        return;
      }
      kept = closingAnimation();
    }
    if (!kept || kept.sha256 !== hash) return;
    if (out === project) out = structuredClone(project);
    slides.push(sceneIndex + 1);
    const target = out.scenes[sceneIndex]!;
    target.elements.splice(video.index, 1);
    target.kind = 'closing';
    target.closingAnimation = { seconds: kept.seconds };
    if (/^Lysark \d+$/.test(target.title.trim()) || !target.title.trim()) {
      target.title = project.meta.language === 'en' ? 'Closing' : 'Avslutning';
    }
    // The import noted that the video covered the logo's place; that is settled now.
    if (target.imported) {
      target.imported.warnings = target.imported.warnings.filter(
        (warning) => !warning.message.startsWith('Logoen er slått av'),
      );
    }
    // The film plays on a white slide and carries the logo itself.
    target.background = 'hvit';
    target.showLogo = false;
    target.decoration = false;
    target.timeline = target.timeline
      .map((step) => ({
        ...step,
        actions: step.actions.filter((a) => target.elements.some((e) => e.id === a.target)),
      }))
      .filter((step) => step.actions.length > 0);
    // The project does not carry the film; it comes from the settings.
    const stillUsed = out.scenes.some((s) =>
      s.elements.some(
        (e) =>
          e.type === 'video' &&
          ((e.source.kind === 'asset' && e.source.asset === video.asset) ||
            e.poster === video.asset),
      ),
    );
    if (!stillUsed) delete out.assets[video.asset];
  });
  return { project: out, slides };
}
