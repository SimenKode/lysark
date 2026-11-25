// Tests for what the lecturer opens and plays while a slide is read in: a
// "Lær mer" box, a video. The clock tells what is open and where each film
// stands at any time; editing the sound moves these events along; and the
// sound of a film is put into the slide's sound.
import { describe, expect, it } from 'vitest';
import {
  continueSound,
  cutRange,
  insertPause,
  removeEvent,
  removeSound,
  replaceSound,
  setEventTime,
} from '../src/shared/audio/edit';
import { mixInto, spanAsset } from '../src/shared/audio/mix';
import { newScene } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Scene,
  type SceneEvent,
} from '../src/shared/format/schema';
import {
  POP_SECONDS,
  anchorAt,
  isAnimatingAt,
  moreAt,
  placeTracks,
  popProgress,
  sceneEvents,
  schedule,
  stillUntil,
  videoKey,
  videoSpans,
  videosAt,
} from '../src/shared/render/clock';
import { sampleProject } from './fixtures/sampleProject';

let counter = 0;
const id = (): string => `n${++counter}`;

/** A slide with a ten second recording, and the events given. */
function slide(events: SceneEvent[]): Scene {
  const scene = newScene('content', 'A');
  scene.audio = { clips: [{ id: 'c0', kind: 'sound', asset: 'a_rec', from: 0, to: 10 }] };
  scene.events = events;
  return scene;
}

const open = (at: number, element = 'e_a'): SceneEvent => ({
  id: `o${at}`,
  at,
  kind: 'more-open',
  element,
});
const close = (at: number): SceneEvent => ({ id: `x${at}`, at, kind: 'more-close' });
const play = (at: number, from = 0, duration = 4, block?: string): SceneEvent => ({
  id: `p${at}`,
  at,
  kind: 'video-play',
  element: 'e_v',
  ...(block === undefined ? {} : { block }),
  from,
  duration,
});
const pause = (at: number, block?: string): SceneEvent => ({
  id: `s${at}`,
  at,
  kind: 'video-pause',
  element: 'e_v',
  ...(block === undefined ? {} : { block }),
});

describe('what is open and what plays at a time', () => {
  it('knows which box is open, and for how long it has been', () => {
    const scene = slide([open(2), close(5), open(7, 'e_b')]);
    expect(moreAt(scene, 1)).toBeUndefined();
    expect(moreAt(scene, 2)).toEqual({ element: 'e_a', since: 0 });
    expect(moreAt(scene, 4.5)).toEqual({ element: 'e_a', since: 2.5 });
    expect(moreAt(scene, 5)).toBeUndefined();
    expect(moreAt(scene, 9)?.element).toBe('e_b');
    // A slide that was never read in has no events.
    expect(moreAt(newScene('content', 'A'), 3)).toBeUndefined();
  });

  it('lets one box take over from another without a close between them', () => {
    const scene = slide([open(2), open(4, 'e_b')]);
    expect(moreAt(scene, 3)?.element).toBe('e_a');
    expect(moreAt(scene, 4.1)).toEqual({ element: 'e_b', since: expect.closeTo(0.1) });
  });

  it('pops the box out over a short time', () => {
    expect(popProgress(0)).toBe(0);
    expect(popProgress(POP_SECONDS / 2)).toBeCloseTo(0.5);
    expect(popProgress(POP_SECONDS)).toBe(1);
    expect(popProgress(99)).toBe(1);
  });

  it('finds the stretches a film plays: until it is paused, runs out, or the slide ends', () => {
    // Paused after one second, started again, and then the film (4 s) runs out.
    expect(videoSpans(slide([play(1), pause(2), play(3, 1)]))).toEqual([
      { element: 'e_v', at: 1, from: 0, length: 1 },
      { element: 'e_v', at: 3, from: 1, length: 3 },
    ]);
    // A long film is stopped by the end of the slide.
    expect(videoSpans(slide([play(8, 0, 60)]))).toEqual([
      { element: 'e_v', at: 8, from: 0, length: 2 },
    ]);
    // Starting a film that already plays moves it.
    expect(videoSpans(slide([play(1, 0, 60), play(2, 30, 60)]))).toEqual([
      { element: 'e_v', at: 1, from: 0, length: 1 },
      { element: 'e_v', at: 2, from: 30, length: 8 },
    ]);
  });

  it('stops a film in a box when the box is put away, but not a film on the slide', () => {
    const scene = slide([open(1, 'e_v'), play(2, 0, 60, 'b1'), play(2.5, 0, 60), close(4)]);
    expect(videoSpans(scene)).toEqual([
      { element: 'e_v', block: 'b1', at: 2, from: 0, length: 2 },
      { element: 'e_v', at: 2.5, from: 0, length: 7.5 },
    ]);
  });

  it('tells where every film stands at a time', () => {
    const scene = slide([play(1), pause(2), play(3, 1)]);
    expect(videosAt(scene, 0.5).size).toBe(0);
    expect(videosAt(scene, 1.5).get(videoKey('e_v'))).toEqual({ time: 0.5, playing: true });
    expect(videosAt(scene, 2.5).get('e_v')).toEqual({ time: 1, playing: false });
    expect(videosAt(scene, 4).get('e_v')).toEqual({ time: 2, playing: true });
    // The film has run out: it stands on its last picture.
    expect(videosAt(scene, 9).get('e_v')).toEqual({ time: 4, playing: false });
    expect(videoKey('e_v', 'b1')).toBe('e_v/b1');
  });

  it('draws new pictures while a box pops out and while a film plays, and not otherwise', () => {
    const scene = slide([open(2), play(4, 0, 2), close(8)]);
    expect(isAnimatingAt(scene, 1)).toBe(false);
    expect(isAnimatingAt(scene, 2.1)).toBe(true); // popping out
    expect(isAnimatingAt(scene, 3)).toBe(false); // out, and standing still
    expect(isAnimatingAt(scene, 5)).toBe(true); // the film plays
    expect(isAnimatingAt(scene, 7)).toBe(false); // the film has run out
    // A picture that stands still holds until the next thing happens.
    const plan = schedule([scene]);
    expect(stillUntil([scene], plan, 0.5, 'cut')).toBe(2);
    expect(stillUntil([scene], plan, 3, 'cut')).toBe(4);
    expect(stillUntil([scene], plan, 7, 'cut')).toBe(8);
    expect(stillUntil([scene], plan, 9, 'cut')).toBe(10);
  });

  it('keeps events inside the slide and in order of time', () => {
    const scene = slide([close(99), open(3)]);
    expect(sceneEvents(scene).map((e) => [e.kind, e.at])).toEqual([
      ['more-open', 3],
      ['more-close', 10],
    ]);
  });
});

describe('editing the sound moves what was opened and played', () => {
  it('moves events after a cut forward, and gathers those inside it where the cut is', () => {
    const scene = slide([open(1), play(3, 0, 60), close(6), open(8, 'e_b')]);
    cutRange(scene, 2, 5, id);
    expect(scene.events!.map((e) => [e.kind, e.at])).toEqual([
      ['more-open', 1],
      ['video-play', 2],
      ['more-close', 3],
      ['more-open', 5],
    ]);
    // The film started inside the cut is as far in as it had come when the cut ends.
    const started = scene.events![1]!;
    expect(started.kind === 'video-play' && started.from).toBe(2);
  });

  it('moves events after a pause back', () => {
    const scene = slide([open(1), close(6)]);
    insertPause(scene, 4, 2, id);
    expect(scene.events!.map((e) => e.at)).toEqual([1, 8]);
  });

  it('takes the events of a new recording, and forgets them with the sound', () => {
    const scene = slide([open(1), close(6)]);
    replaceSound(scene, 'a_new', 5, [], id, [open(2, 'e_b'), close(99)]);
    expect(scene.events!.map((e) => [e.kind, e.at])).toEqual([
      ['more-open', 2],
      ['more-close', 5],
    ]);
    replaceSound(scene, 'a_newer', 5, [], id);
    expect(scene.events).toBeUndefined();
    scene.events = [open(1)];
    removeSound(scene);
    expect(scene.events).toBeUndefined();
  });

  it('keeps what happened before the point a new recording goes on from, and stops a running film there', () => {
    const scene = slide([open(1), play(2, 0, 60), close(7)]);
    continueSound(scene, 4, 'a_new', 3, [], id, [close(1)]);
    expect(scene.events!.map((e) => [e.kind, e.at])).toEqual([
      ['more-open', 1],
      ['video-play', 2],
      ['video-pause', 4],
      ['more-close', 5],
    ]);
    expect(videoSpans(scene)).toEqual([{ element: 'e_v', at: 2, from: 0, length: 2 }]);
    expect(moreAt(scene, 4.5)?.element).toBe('e_a');
    expect(moreAt(scene, 6)).toBeUndefined();
  });

  it('moves and removes a single event', () => {
    const scene = slide([open(1), close(6)]);
    setEventTime(scene, 'o1', 8);
    expect(scene.events!.map((e) => e.id)).toEqual(['x6', 'o1']);
    setEventTime(scene, 'o1', 99);
    expect(scene.events![1]!.at).toBe(10);
    removeEvent(scene, 'x6');
    removeEvent(scene, 'o1');
    expect(scene.events).toBeUndefined();
  });
});

describe('sound on top of sound', () => {
  it('adds one sound to another where it belongs, without running over', () => {
    const target = new Int16Array(2000).fill(1000);
    const source = new Int16Array(1000).fill(2000);
    mixInto(target, 500, source);
    expect(target[0]).toBe(1000);
    expect(target[499]).toBe(1000);
    expect(target[500]).toBe(1000); // comes in from silence
    expect(target[1000]).toBe(3000);
    expect(target[1499]).toBe(1000); // and goes out to it
    expect(target[1500]).toBe(1000);
    const loud = new Int16Array(1000).fill(30000);
    mixInto(loud, 0, new Int16Array(1000).fill(30000));
    expect(loud[500]).toBe(32767);
  });

  it('leaves out what falls outside, and takes a loudness factor', () => {
    const target = new Int16Array(1000);
    mixInto(target, -600, new Int16Array(1000).fill(1000), 0.5);
    expect(target[0]).toBe(500);
    expect(target[399]).toBe(0);
    expect(target[400]).toBe(0);
    mixInto(target, 900, new Int16Array(1000).fill(1000));
    expect(target[999]).toBeGreaterThan(0);
  });

  it('finds the video file of a film on the slide and of one in a box', () => {
    const scene = newScene('content', 'A');
    scene.elements.push({
      id: 'e_v',
      type: 'video',
      box: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
      source: { kind: 'asset', asset: 'a_film' },
      title: 'A',
      more: {
        title: 'A',
        blocks: [
          { id: 'b1', kind: 'video', source: { kind: 'asset', asset: 'a_inner' }, title: 'B' },
          {
            id: 'b2',
            kind: 'video',
            source: { kind: 'url', url: 'https://example.invalid/b' },
            title: 'C',
          },
        ],
      },
    });
    const span = { element: 'e_v', at: 0, from: 0, length: 1 };
    expect(spanAsset(scene, span)).toBe('a_film');
    expect(spanAsset(scene, { ...span, block: 'b1' })).toBe('a_inner');
    expect(spanAsset(scene, { ...span, block: 'b2' })).toBeUndefined();
    expect(spanAsset(scene, { ...span, element: 'e_none' })).toBeUndefined();
  });
});

describe('the format', () => {
  it('keeps a project with events and tracks valid, and lifts format 5 files', () => {
    const { project } = sampleProject();
    project.scenes[0]!.audio = {
      clips: [{ id: 'c0', kind: 'sound', asset: 'a_rec', from: 0, to: 10 }],
    };
    project.scenes[0]!.events = [open(1), play(2), pause(3), close(4)];
    project.tracks = {
      music: [
        { id: 'm1', asset: 'a_music', scene: project.scenes[0]!.id, offset: 2, from: 0, to: 30 },
      ],
      sound: [],
    };
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.scenes[0]!.events).toHaveLength(4);
    expect(parsed.tracks!.music[0]!.to).toBe(30);
    const old = JSON.parse(JSON.stringify(sampleProject().project)) as { version: number };
    old.version = 5;
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(8);
  });

  it('places the clips of the tracks in the lecture, fastened to their slides', () => {
    const { project } = sampleProject();
    const [first, second] = project.scenes;
    first!.audio = { clips: [{ id: 'c0', kind: 'sound', asset: 'a_rec', from: 0, to: 10 }] };
    project.tracks = {
      music: [{ id: 'm1', asset: 'a_music', scene: second!.id, offset: 1.5, from: 2, to: 6 }],
      sound: [
        { id: 's1', asset: 'a_sound', scene: first!.id, offset: 3, from: 0, to: 1 },
        { id: 's2', asset: 'a_sound', scene: 'gone', offset: 0, from: 0, to: 1 },
      ],
    };
    const placed = placeTracks(project);
    expect(placed.map((p) => [p.track, p.clip.id, p.start, p.end])).toEqual([
      ['sound', 's1', 3, 4],
      ['music', 'm1', 11.5, 15.5],
    ]);
    // And back: a time in the lecture is a slide and a time on it.
    const plan = schedule(project.scenes);
    expect(anchorAt(project.scenes, plan, 11.5)).toEqual({ scene: second!.id, offset: 1.5 });
    expect(anchorAt(project.scenes, plan, 3)).toEqual({ scene: first!.id, offset: 3 });
  });
});
