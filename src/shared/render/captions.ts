// Captions for the video, made from the manuscript of each slide, the
// chapters of the video file, and the slides that list picture credits at
// the end of a video. Pure functions.
//
// Lysark does not listen to the recording. The captions of a slide are its
// manuscript, cut into short pieces and spread over the time the slide has
// sound, in proportion to how long each piece is. That follows a reader who
// keeps an even pace; it is an estimate, not a transcript.
import { STAGE } from '../format/constants';
import type { Project, Scene } from '../format/schema';
import { chapters } from '../layout/slides';
import { clipDuration, sceneDuration, type Schedule } from './clock';
import { collectCredits, creditText } from './more';
import type { SceneStrings } from './scene';

export interface Cue {
  /** Seconds from the start of the video. */
  start: number;
  end: number;
  text: string;
}

/** Longest caption: two lines of about 42 characters. */
const MAX_CUE_CHARS = 84;
const MIN_CUE_SECONDS = 0.6;

/** Cuts a manuscript into pieces short enough to be read as captions. */
export function captionPieces(script: string, maxChars = MAX_CUE_CHARS): string[] {
  const pieces: string[] = [];
  for (const line of script.split(/\n+/)) {
    const text = line.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    // Sentences first; a sentence that is still too long is cut at commas, then between words.
    for (const sentence of text.match(/[^.!?…]+[.!?…]*["»)]*\s*/g) ?? [text]) {
      let rest = sentence.trim();
      while (rest.length > maxChars) {
        const window = rest.slice(0, maxChars + 1);
        let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; ')) + 1;
        if (cut < maxChars / 2) cut = window.lastIndexOf(' ');
        if (cut <= 0) cut = maxChars;
        pieces.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) pieces.push(rest);
    }
  }
  return pieces;
}

/** The stretches of a slide where something is said, in seconds from its start. */
function speechSpans(scene: Pick<Scene, 'audio' | 'timeline'>): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = 0;
  for (const clip of scene.audio?.clips ?? []) {
    const end = start + clipDuration(clip);
    if (clip.kind === 'sound') spans.push([start, end]);
    start = end;
  }
  // A slide without sound: the text is spread over the whole slide.
  return spans.length > 0 ? spans : [[0, sceneDuration(scene)]];
}

/** Captions of one slide, with times from the start of the slide. */
export function sceneCues(scene: Pick<Scene, 'audio' | 'timeline' | 'script'>): Cue[] {
  const pieces = captionPieces(scene.script);
  if (pieces.length === 0) return [];
  const spans = speechSpans(scene);
  const speech = spans.reduce((sum, [a, b]) => sum + (b - a), 0);
  if (speech <= 0) return [];
  // Speech time (pauses taken out) back to time on the slide.
  const toSceneTime = (s: number): number => {
    let left = s;
    for (const [a, b] of spans) {
      if (left <= b - a) return a + left;
      left -= b - a;
    }
    return spans[spans.length - 1]![1];
  };
  const weights = pieces.map((p) => p.length + 8); // a short piece still takes a moment to say
  const total = weights.reduce((a, b) => a + b, 0);
  const cues: Cue[] = [];
  let used = 0;
  pieces.forEach((text, i) => {
    const start = toSceneTime((used / total) * speech);
    used += weights[i]!;
    const end = toSceneTime((used / total) * speech);
    cues.push({ start, end: Math.max(end, start + Math.min(MIN_CUE_SECONDS, speech)), text });
  });
  // No caption may run into the next one.
  for (let i = 0; i < cues.length - 1; i++) {
    cues[i]!.end = Math.min(cues[i]!.end, cues[i + 1]!.start);
  }
  return cues.filter((cue) => cue.end > cue.start);
}

/** Captions of the whole lecture, with times from the start of the video. */
export function lectureCues(
  scenes: ReadonlyArray<Pick<Scene, 'audio' | 'timeline' | 'script'>>,
  plan: Schedule,
): Cue[] {
  const cues: Cue[] = [];
  for (const entry of plan.entries) {
    const scene = scenes[entry.index];
    // A slide that is left out of the video says nothing in it.
    if (!scene || entry.duration <= 0) continue;
    for (const cue of sceneCues(scene)) {
      cues.push({
        start: entry.start + cue.start,
        end: Math.min(entry.start + entry.duration, entry.start + cue.end),
        text: cue.text,
      });
    }
  }
  return cues;
}

function vttTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** Lays a caption out on at most two lines of similar length. */
function twoLines(text: string): string {
  if (text.length <= MAX_CUE_CHARS / 2) return text;
  const middle = text.length / 2;
  let best = -1;
  for (let i = text.indexOf(' '); i >= 0; i = text.indexOf(' ', i + 1)) {
    if (best < 0 || Math.abs(i - middle) < Math.abs(best - middle)) best = i;
  }
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
}

/** The captions as a WebVTT file. */
export function toWebVtt(cues: readonly Cue[], language: string): string {
  const lines = ['WEBVTT', `Language: ${language}`, ''];
  cues.forEach((cue, index) => {
    // "-->" inside a caption would end it; no manuscript needs that arrow.
    const text = twoLines(cue.text.replace(/-->/g, '→'));
    lines.push(String(index + 1), `${vttTime(cue.start)} --> ${vttTime(cue.end)}`, text, '');
  });
  return lines.join('\n');
}

/** How many credits fit on one slide in the body size. */
const CREDITS_PER_SCENE = 9;
/** How long each credits slide stands in the video. */
export const CREDITS_SCENE_SECONDS = 8;

/**
 * Slides that list the picture credits, for the end of a video (a video
 * has no "Bildekilder" button). Empty when nothing is credited.
 */
export function creditScenes(
  project: Project,
  strings: SceneStrings,
  texts: { heading: string; slide: (numbers: number[]) => string },
): Scene[] {
  const lines = collectCredits(project).map(
    (entry) => `${creditText(entry.credit, strings, entry.cropped)} (${texts.slide(entry.scenes)})`,
  );
  const scenes: Scene[] = [];
  for (let i = 0; i < lines.length; i += CREDITS_PER_SCENE) {
    const page = Math.floor(i / CREDITS_PER_SCENE) + 1;
    const id = `s_credits_${page}`;
    scenes.push({
      id,
      title: texts.heading,
      kind: 'content',
      decoration: false,
      shapeVariant: 0,
      showLogo: true,
      timeline: [],
      script: '',
      audio: { clips: [{ id: `${id}_pause`, kind: 'pause', duration: CREDITS_SCENE_SECONDS }] },
      elements: [
        {
          id: `${id}_title`,
          type: 'text',
          role: 'title',
          align: 'left',
          valign: 'top',
          content: { paragraphs: [{ level: 0, list: 'none', runs: [{ text: texts.heading }] }] },
          box: { x: 120, y: 96, w: STAGE.width - 240, h: 110, rotation: 0 },
        },
        {
          id: `${id}_list`,
          type: 'text',
          role: 'caption',
          fontSize: 28,
          align: 'left',
          valign: 'top',
          content: {
            paragraphs: lines.slice(i, i + CREDITS_PER_SCENE).map((text) => ({
              level: 0,
              list: 'none' as const,
              runs: [{ text }],
            })),
          },
          spaceBefore: [0.6, 0.6, 0.6, 0.6, 0.6],
          box: { x: 120, y: 230, w: STAGE.width - 240, h: 680, rotation: 0 },
        },
      ],
    });
  }
  return scenes;
}

// ---------- Chapters in the video file ----------

/** A chapter of a video: its name, and when it starts and ends, in seconds. */
export interface ChapterMark {
  title: string;
  start: number;
  end: number;
}

/**
 * The chapters of a video that holds the scenes `from` to `to` of the
 * lecture (and, after them, `extra` seconds of picture credits, when there
 * are any). A video that starts in the middle of a chapter starts with that
 * chapter. The slides before the first chapter go by the lecture's title.
 * Empty when the lecture has no chapters, or the video lies inside one.
 */
export function chapterMarks(
  scenes: ReadonlyArray<Pick<Scene, 'chapter' | 'repeat'>>,
  plan: Schedule,
  from: number,
  to: number,
  names: { lecture: string; credits?: string },
): ChapterMark[] {
  const marks: ChapterMark[] = [];
  for (const chapter of chapters(scenes)) {
    const first = Math.max(chapter.first, from);
    const last = Math.min(chapter.last, to);
    if (first > last) continue;
    const head = plan.entries[first - from];
    const tail = plan.entries[last - from];
    // A chapter whose slides are all left out of the video is not in it.
    if (!head || !tail || tail.start + tail.duration <= head.start + 1e-6) continue;
    marks.push({
      title: chapter.name.trim() || names.lecture,
      start: head.start,
      end: tail.start + tail.duration,
    });
  }
  if (marks.length < 2) return [];
  const end = marks[marks.length - 1]!.end;
  if (names.credits && plan.total > end + 1e-6) {
    marks.push({ title: names.credits, start: end, end: plan.total });
  }
  return marks;
}

/** The chapters as FFmpeg reads them ("ffmetadata"), with times in milliseconds. */
export function toFfmetadata(marks: readonly ChapterMark[]): string {
  // These five mean something in the format and are written with a backslash before them.
  const safe = (text: string): string => text.replace(/[=;#\\\n]/g, (c) => `\\${c}`);
  const lines = [';FFMETADATA1'];
  for (const mark of marks) {
    lines.push(
      '[CHAPTER]',
      'TIMEBASE=1/1000',
      `START=${Math.round(mark.start * 1000)}`,
      `END=${Math.round(mark.end * 1000)}`,
      `title=${safe(mark.title)}`,
    );
  }
  return `${lines.join('\n')}\n`;
}
