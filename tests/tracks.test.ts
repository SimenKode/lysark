// Tests for the lecture's own tracks: music and other sound under the
// slides. Clips are moved, cut and faded by their time in the lecture; the
// music steps back while someone speaks; and a slide can be made longer or
// shorter by the pause at its end.
import { describe, expect, it } from 'vitest';
import {
  DUCK_BLOCK,
  DUCK_GAIN,
  duckGains,
  mixPiece,
  mixTracks,
  newDuckState,
} from '../src/shared/audio/mix';
import {
  addTrackClip,
  assetSeconds,
  clipStart,
  findTrackClip,
  leastSceneLength,
  moveTrackClip,
  releaseScene,
  removeTrackClip,
  setSceneLength,
  setTrackClip,
  splitTrackClip,
  trimTrackClip,
} from '../src/shared/audio/tracks';
import { newProject, newScene } from '../src/shared/format/factory';
import { parseProject, type Project } from '../src/shared/format/schema';
import { SAMPLE_RATE, placeTracks, sceneDuration } from '../src/shared/render/clock';

let counter = 0;
const id = (): string => `n${++counter}`;

/** Three slides of 10, 5 and 5 seconds, and a sound file of 60 seconds. */
function lecture(): Project {
  const project = newProject('A');
  const a = newScene('content', 'A');
  const b = newScene('content', 'B');
  const c = newScene('content', 'C');
  a.id = 's_a';
  b.id = 's_b';
  c.id = 's_c';
  a.audio = { clips: [{ id: 'c0', kind: 'sound', asset: 'a_rec', from: 0, to: 10 }] };
  project.scenes.push(a, b, c);
  project.assets.a_music = {
    kind: 'audio',
    file: 'media/musikk.wav',
    mime: 'audio/wav',
    bytes: 44 + 60 * 2 * SAMPLE_RATE,
  };
  return project;
}

const tone = (seconds: number, level: number): Int16Array =>
  new Int16Array(Math.round(seconds * SAMPLE_RATE)).fill(level);

describe('clips on the tracks of the lecture', () => {
  it('reads the length of a sound file from its size', () => {
    const project = lecture();
    expect(assetSeconds(project.assets.a_music)).toBe(60);
    expect(assetSeconds(undefined)).toBe(0);
  });

  it('puts a clip where the playhead is, fastened to the slide that stands there', () => {
    const project = lecture();
    const clip = addTrackClip(project, 'music', 'a_music', 60, 12, id)!;
    expect(project.tracks!.music[0]).toMatchObject({ scene: 's_b', offset: 2, from: 0, to: 60 });
    expect(clipStart(project, findTrackClip(project, clip)!.clip)).toBe(12);
    expect(parseProject(JSON.parse(JSON.stringify(project))).tracks!.music).toHaveLength(1);
  });

  it('follows its slide when the slides before it change length or place', () => {
    const project = lecture();
    addTrackClip(project, 'music', 'a_music', 60, 12, id);
    const first = project.scenes[0]!;
    first.audio!.clips.push({ id: 'p', kind: 'pause', duration: 3 });
    expect(placeTracks(project)[0]!.start).toBe(15);
    project.scenes.reverse();
    expect(placeTracks(project)[0]!.start).toBe(7); // slide B is now the second of three
  });

  it('moves a clip, and keeps it inside the lecture', () => {
    const project = lecture();
    const clip = addTrackClip(project, 'sound', 'a_music', 60, 0, id)!;
    moveTrackClip(project, clip, 17.5);
    expect(project.tracks!.sound[0]).toMatchObject({ scene: 's_c', offset: 2.5 });
    moveTrackClip(project, clip, -4);
    expect(project.tracks!.sound[0]).toMatchObject({ scene: 's_a', offset: 0 });
    moveTrackClip(project, clip, 999);
    expect(placeTracks(project)[0]!.start).toBeCloseTo(19.9);
  });

  it('draws the ends of a clip in and out, never past the file', () => {
    const project = lecture();
    const clip = addTrackClip(project, 'music', 'a_music', 60, 2, id)!;
    trimTrackClip(project, clip, 'end', 12);
    expect(project.tracks!.music[0]).toMatchObject({ from: 0, to: 10 });
    trimTrackClip(project, clip, 'start', 5);
    expect(project.tracks!.music[0]).toMatchObject({ scene: 's_a', offset: 5, from: 3, to: 10 });
    // Out again: the start cannot go before the start of the file.
    trimTrackClip(project, clip, 'start', 0);
    expect(project.tracks!.music[0]).toMatchObject({ offset: 2, from: 0 });
    trimTrackClip(project, clip, 'end', 999);
    expect(project.tracks!.music[0]!.to).toBe(60);
    // And never shorter than a tenth of a second.
    trimTrackClip(project, clip, 'end', 0);
    expect(project.tracks!.music[0]!.to).toBeCloseTo(0.1);
  });

  it('divides a clip in two that play on as one', () => {
    const project = lecture();
    const clip = addTrackClip(project, 'music', 'a_music', 60, 2, id)!;
    setTrackClip(project, clip, { fadeIn: 2, fadeOut: 3, gain: -6 });
    const second = splitTrackClip(project, clip, 12, id)!;
    const [a, b] = project.tracks!.music;
    expect(a).toMatchObject({ from: 0, to: 10, fadeIn: 2, gain: -6 });
    expect(a!.fadeOut).toBeUndefined();
    expect(b).toMatchObject({ id: second, scene: 's_b', offset: 2, from: 10, to: 60, fadeOut: 3 });
    expect(b!.fadeIn).toBeUndefined();
    expect(splitTrackClip(project, clip, 2.01, id)).toBeUndefined(); // too near the edge
    removeTrackClip(project, clip);
    removeTrackClip(project, second);
    expect(project.tracks).toBeUndefined();
  });

  it('keeps loudness and fades within bounds', () => {
    const project = lecture();
    const clip = addTrackClip(project, 'music', 'a_music', 4, 0, id)!;
    setTrackClip(project, clip, { gain: 99, fadeIn: 99, fadeOut: -1 });
    expect(project.tracks!.music[0]).toMatchObject({ gain: 18, fadeIn: 4 });
    expect(project.tracks!.music[0]!.fadeOut).toBeUndefined();
    setTrackClip(project, clip, { gain: 0 });
    expect(project.tracks!.music[0]!.gain).toBeUndefined();
  });

  it('does not lose the music with a slide that is removed', () => {
    const project = lecture();
    addTrackClip(project, 'music', 'a_music', 60, 12, id);
    releaseScene(project, 's_b');
    project.scenes.splice(1, 1);
    expect(project.tracks!.music[0]).toMatchObject({ scene: 's_c', offset: 0 });
    releaseScene(project, 's_c');
    project.scenes.splice(1, 1);
    expect(project.tracks!.music[0]!.scene).toBe('s_a');
    expect(placeTracks(project)).toHaveLength(1);
  });
});

describe('the length of a slide', () => {
  it('is changed by the pause at its end, and never cuts what is said', () => {
    const project = lecture();
    const [spoken, silent] = project.scenes;
    expect(leastSceneLength(spoken!)).toBe(10);
    setSceneLength(spoken!, 14, id);
    expect(spoken!.audio!.clips.map((c) => c.kind)).toEqual(['sound', 'pause']);
    expect(sceneDuration(spoken!)).toBe(14);
    setSceneLength(spoken!, 11.5, id);
    expect(sceneDuration(spoken!)).toBe(11.5);
    setSceneLength(spoken!, 3, id); // not shorter than the recording
    expect(spoken!.audio!.clips).toHaveLength(1);
    expect(sceneDuration(spoken!)).toBe(10);
    // A slide without sound gets a length of its own.
    setSceneLength(silent!, 8, id);
    expect(sceneDuration(silent!)).toBe(8);
    setSceneLength(silent!, 0, id);
    expect(sceneDuration(silent!)).toBe(0.5);
  });
});

describe('music under a voice', () => {
  it('steps back while someone speaks and comes back afterwards', () => {
    // Two seconds of silence, two of speech, four of silence.
    const voice = new Int16Array(8 * SAMPLE_RATE);
    voice.fill(4000, 2 * SAMPLE_RATE, 4 * SAMPLE_RATE);
    const gains = duckGains(voice, newDuckState());
    const at = (seconds: number): number =>
      gains[Math.floor((seconds * SAMPLE_RATE) / DUCK_BLOCK)]!;
    expect(at(0.5)).toBe(1);
    expect(at(1.5)).toBe(1);
    expect(at(1.95)).toBeLessThan(1); // on its way down just before the first word
    expect(at(3)).toBeCloseTo(DUCK_GAIN, 2);
    expect(at(4.5)).toBeCloseTo(DUCK_GAIN, 2); // held a moment after the last word
    expect(at(5.2)).toBeGreaterThan(DUCK_GAIN + 0.1);
    expect(at(7.5)).toBeGreaterThan(0.95);
    // It never jumps.
    for (let b = 1; b < gains.length; b++) {
      expect(Math.abs(gains[b]! - gains[b - 1]!)).toBeLessThan(0.16);
    }
  });

  it('carries on from one slide to the next without a jump', () => {
    const state = newDuckState();
    const first = duckGains(tone(2, 4000), state);
    const second = duckGains(tone(2, 0), state);
    expect(first[first.length - 1]).toBeCloseTo(DUCK_GAIN, 2);
    expect(second[0]).toBeCloseTo(DUCK_GAIN, 2);
    expect(second[second.length - 1]).toBeGreaterThan(0.9);
  });

  it('puts a clip where it lies in the lecture, with its fades and its loudness', () => {
    const part = new Int16Array(4 * SAMPLE_RATE); // a slide that starts 10 s into the lecture
    const source = tone(20, 1000);
    mixPiece(
      part,
      10 * SAMPLE_RATE,
      { asset: 'a', start: 11, from: 5, to: 8, gain: 0.5, fadeIn: 1, fadeOut: 0 },
      source,
    );
    const at = (seconds: number): number => part[Math.round(seconds * SAMPLE_RATE)]!;
    expect(at(0.5)).toBe(0); // before the clip
    expect(at(1.5)).toBeCloseTo(250, -1); // half way into the fade
    expect(at(3)).toBe(500);
    expect(at(3.9)).toBe(500);
    expect(at(3.9999)).toBeLessThan(100); // the clip ends with the slide, without a click
    // The next slide gets nothing of it.
    const next = new Int16Array(2 * SAMPLE_RATE);
    mixPiece(
      next,
      14 * SAMPLE_RATE,
      { asset: 'a', start: 11, from: 5, to: 8, gain: 0.5, fadeIn: 1, fadeOut: 0 },
      source,
    );
    expect(next.every((value) => value === 0)).toBe(true);
  });

  it('lowers the music, and not the other sound, under the voice of each slide', () => {
    const project = lecture();
    project.assets.a_sound = { ...project.assets.a_music! };
    addTrackClip(project, 'music', 'a_music', 60, 0, id);
    addTrackClip(project, 'sound', 'a_sound', 60, 0, id);
    const placed = placeTracks(project);
    const music = tone(60, 1000);
    const sound = tone(60, 100);
    const samplesOf = (asset: string): Int16Array | undefined =>
      asset === 'a_music' ? music : asset === 'a_sound' ? sound : undefined;
    const state = newDuckState();
    // The first slide: ten seconds of speech.
    const spoken = tone(10, 4000);
    mixTracks(spoken, 0, placed, samplesOf, state);
    expect(spoken[5 * SAMPLE_RATE]).toBe(4000 + 250 + 100);
    // The second: silence, and the music comes back up.
    const silent = tone(5, 0);
    mixTracks(silent, 10 * SAMPLE_RATE, placed, samplesOf, state);
    expect(silent[0]).toBeCloseTo(250 + 100, -1);
    expect(silent[silent.length - 1 - SAMPLE_RATE / 100]).toBeGreaterThan(1050);
    // Without the lowering, the music is as it is everywhere.
    const plain = tone(10, 4000);
    mixTracks(plain, 0, placed, samplesOf, null);
    expect(plain[5 * SAMPLE_RATE]).toBe(4000 + 1000 + 100);
  });

  it('can be put together apart from the voice, lowered the same (the HTML file)', () => {
    const project = lecture();
    addTrackClip(project, 'music', 'a_music', 60, 0, id);
    const placed = placeTracks(project);
    const music = tone(60, 1000);
    const samplesOf = (asset: string): Int16Array | undefined =>
      asset === 'a_music' ? music : undefined;
    const part = new Int16Array(10 * SAMPLE_RATE);
    mixTracks(part, 0, placed, samplesOf, newDuckState(), tone(10, 4000));
    // The music only, lowered to a quarter as under the voice above.
    expect(part[5 * SAMPLE_RATE]).toBe(250);
  });
});
