// What a PowerPoint file knows that a PDF of it does not: the manuscript
// (the notes), the names of the slides and the chapters (the sections).
// When a presentation keeps its look, the look comes from a PDF of it and
// these come from the PowerPoint file itself. Pure functions.
import type { Project } from '../shared/format/schema';

/** One slide of a presentation, as far as a PDF of it needs to be told. */
export interface PptxSlide {
  title: string;
  /** The notes of the slide. */
  script: string;
  /** The chapter that begins on the slide. */
  chapter?: string;
  /** The slide is hidden in PowerPoint; a PDF of the presentation leaves it out. */
  hidden: boolean;
}

/** The slides of an imported presentation, in order. */
export function pptxSlides(project: Pick<Project, 'scenes'>): PptxSlide[] {
  return project.scenes.map((scene) => ({
    title: scene.title,
    script: scene.script,
    ...(scene.chapter === undefined ? {} : { chapter: scene.chapter }),
    hidden: (scene.imported?.warnings ?? []).some((warning) => warning.code === 'hidden'),
  }));
}

/**
 * The slides that the pages of a PDF of the presentation show, one for each
 * page: all of them, or all but the hidden ones (programs leave those out
 * of a PDF). A chapter that begins on a slide that was left out begins on
 * the next one. Undefined when the number of pages fits neither: the PDF is
 * then not a PDF of this presentation as it is now.
 */
export function slidesForPages(
  slides: readonly PptxSlide[],
  pages: number,
): PptxSlide[] | undefined {
  const shown = slides.filter((slide) => !slide.hidden);
  if (pages === shown.length) {
    const out: PptxSlide[] = [];
    let waiting: string | undefined;
    for (const slide of slides) {
      if (slide.hidden) {
        waiting = slide.chapter ?? waiting;
        continue;
      }
      const chapter = slide.chapter ?? waiting;
      waiting = undefined;
      out.push({ ...slide, ...(chapter === undefined ? {} : { chapter }) });
    }
    return out;
  }
  return pages === slides.length ? [...slides] : undefined;
}

/**
 * Gives the scenes made from the pages of the PDF what the PowerPoint file
 * knows: names, manuscript and chapters. Returns false, and changes
 * nothing, when the pages and the slides do not fit each other.
 */
export function applyPptxSlides(
  project: Pick<Project, 'scenes'>,
  slides: readonly PptxSlide[],
): boolean {
  const fitting = slidesForPages(slides, project.scenes.length);
  if (!fitting) return false;
  project.scenes.forEach((scene, index) => {
    const slide = fitting[index]!;
    if (slide.title.trim() !== '') scene.title = slide.title;
    scene.script = slide.script;
    // The sections of the presentation are its chapters, whatever bookmarks the PDF got.
    if (slide.chapter === undefined) delete scene.chapter;
    else scene.chapter = slide.chapter;
  });
  return true;
}
