// Tests for time and sound: the clock that the video export, "Spill av" and
// the timeline share; editing a slide's sound; WAV files; captions.
import { describe, expect, it } from 'vitest';
import {
  appendSound,
  clipSpans,
  cutRange,
  insertPause,
  removeSound,
  replaceSound,
  setGain,
  setPauseDuration,
  setStepTime,
  splitAt,
} from '../src/shared/audio/edit';
import {
  encodeWav,
  gainFactor,
  peaks,
  readWavInfo,
  renderTrack,
  wavSamples,
} from '../src/shared/audio/wav';
import { newScene } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Project,
  type Scene,
} from '../src/shared/format/schema';
import {
  captionPieces,
  creditScenes,
  lectureCues,
  sceneCues,
  toWebVtt,
} from '../src/shared/render/captions';
import {
  FADE_SECONDS,
  SAMPLE_RATE,
  SILENT_SCENE_SECONDS,
  SILENT_STEP_SECONDS,
  formatTime,
  frameAt,
  hasSound,
  isAnimatingAt,
  sceneDuration,
  sceneStateAt,
  schedule,
  stepTimes,
  stepsShownAt,
  stillUntil,
  trackDuration,
  videoOptions,
} from '../src/shared/render/clock';
import { SCENE_STRINGS } from '../src/shared/render/scene';
import { sampleProject } from './fixtures/sampleProject';

let counter = 0;
const id = (): string => `c${++counter}`;

/** A slide with two steps (A fades in, B appears) and a ten second recording. */
function slide(): Scene {
  const scene = newScene('content', 'A');
  scene.timeline = [
    { id: 't1', actions: [{ target: 'e_a', effect: 'fade', duration: 0.4 }] },
    { id: 't2', actions: [{ target: 'e_b', effect: 'appear', duration: 0 }] },
  ];
  scene.audio = { clips: [{ id: 'c0', kind: 'sound', asset: 'a_rec', from: 0, to: 10 }] };
  return scene;
}

describe('the clock', () => {
  it('lets a slide stand as long as its sound, or a default time without sound', () => {
    const scene = slide();
    expect(trackDuration(scene.audio)).toBe(10);
    expect(sceneDuration(scene)).toBe(10);
    expect(hasSound(scene)).toBe(true);
    delete scene.audio;
    expect(sceneDuration(scene)).toBe(SILENT_SCENE_SECONDS + 2 * SILENT_STEP_SECONDS);
    scene.audio = { clips: [{ id: 'p', kind: 'pause', duration: 3 }] };
    expect(sceneDuration(scene)).toBe(3);
    expect(hasSound(scene)).toBe(false);
  });

  it('spreads steps without a time evenly, keeps the times set, and never goes backwards', () => {
    const scene = slide();
    const [first, second] = stepTimes(scene);
    expect(first).toBeCloseTo(10 / 3);
    expect(second).toBeCloseTo(20 / 3);
    scene.timeline[0]!.at = 8;
    scene.timeline[1]!.at = 2;
    expect(stepTimes(scene)).toEqual([8, 8]);
    scene.timeline[0]!.at = 99;
    expect(stepTimes(scene)[0]).toBe(10); // inside the slide
  });

  it('gives the state of a slide at any time, as a pure function', () => {
    const scene = slide();
    scene.timeline[0]!.at = 2;
    scene.timeline[1]!.at = 5;
    expect([...sceneStateAt(scene, 0)]).toEqual([
      ['e_a', 0],
      ['e_b', 0],
    ]);
    const fading = sceneStateAt(scene, 2.2).get('e_a')!;
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    expect(sceneStateAt(scene, 2.2)).toEqual(sceneStateAt(scene, 2.2));
    expect(sceneStateAt(scene, 4).get('e_a')).toBe(1);
    expect(sceneStateAt(scene, 5).get('e_b')).toBe(1);
    expect([0, 2, 4.9, 5].map((t) => stepsShownAt(scene, t))).toEqual([0, 1, 1, 2]);
    expect(isAnimatingAt(scene, 2.2)).toBe(true);
    expect(isAnimatingAt(scene, 3)).toBe(false);
  });

  it('lays the slides after each other and finds what is on screen at a time', () => {
    const a = slide();
    const b = slide();
    b.audio = { clips: [{ id: 'p', kind: 'pause', duration: 4 }] };
    const plan = schedule([a, b]);
    expect(plan.total).toBe(14);
    expect(plan.entries.map((e) => [e.start, e.duration])).toEqual([
      [0, 10],
      [10, 4],
    ]);
    expect(frameAt(plan, 3, 'cut')).toEqual({ index: 0, t: 3 });
    expect(frameAt(plan, 10, 'cut')).toEqual({ index: 1, t: 0 });
    expect(frameAt(plan, 99, 'cut')).toEqual({ index: 1, t: 4 });
    const fading = frameAt(plan, 10 + FADE_SECONDS / 2, 'fade');
    expect(fading.fade).toEqual({ from: 0, progress: expect.closeTo(0.5) });
    expect(frameAt(plan, 0.1, 'fade').fade).toBeUndefined(); // nothing to fade from
    expect(frameAt(plan, 11, 'fade').fade).toBeUndefined();
  });

  it('knows how long a picture stays the same, so the export need not draw it again', () => {
    const scene = slide();
    scene.timeline[0]!.at = 2;
    scene.timeline[1]!.at = 5;
    const scenes = [scene, slide()];
    const plan = schedule(scenes);
    expect(stillUntil(scenes, plan, 0, 'cut')).toBe(2); // until the first step
    expect(stillUntil(scenes, plan, 2.1, 'cut')).toBe(2.1); // something is fading in
    expect(stillUntil(scenes, plan, 3, 'cut')).toBe(5);
    expect(stillUntil(scenes, plan, 6, 'cut')).toBe(10); // until the next slide
    expect(stillUntil(scenes, plan, 10.1, 'fade')).toBe(10.1); // the slides are fading
  });

  it('writes times the way people read them, and has defaults for video', () => {
    expect([0, 65, 3723].map(formatTime)).toEqual(['0:00', '1:05', '1:02:03']);
    expect(videoOptions({})).toEqual({ transition: 'cut', evenLoudness: true, credits: false });
  });
});

describe('editing the sound of a slide', () => {
  const stepAts = (scene: Scene): Array<number | undefined> => scene.timeline.map((s) => s.at);
  const shape = (scene: Scene): unknown[] =>
    (scene.audio?.clips ?? []).map((c) => (c.kind === 'pause' ? c.duration : [c.from, c.to]));

  it('cuts a stretch out of the middle without touching the recording, and moves the steps along', () => {
    const scene = slide();
    scene.timeline[0]!.at = 3;
    scene.timeline[1]!.at = 8;
    cutRange(scene, 4, 6, id);
    expect(shape(scene)).toEqual([
      [0, 4],
      [6, 10],
    ]);
    expect(trackDuration(scene.audio)).toBe(8);
    expect(stepAts(scene)).toEqual([3, 6]); // the step after the cut comes two seconds earlier
    // A step inside what is cut happens where the cut is.
    scene.timeline[0]!.at = 2;
    cutRange(scene, 1, 3, id);
    expect(stepAts(scene)).toEqual([1, 4]);
  });

  it('cuts the start and the end', () => {
    const scene = slide();
    cutRange(scene, 0, 1.5, id);
    cutRange(scene, 7, 99, id);
    expect(shape(scene)).toEqual([[1.5, 8.5]]);
  });

  it('puts a pause in, moving what comes after, and changes or removes it again', () => {
    const scene = slide();
    scene.timeline[0]!.at = 2;
    scene.timeline[1]!.at = 6;
    insertPause(scene, 4, 1.5, id);
    expect(shape(scene)).toEqual([[0, 4], 1.5, [4, 10]]);
    expect(stepAts(scene)).toEqual([2, 7.5]);
    const pause = scene.audio!.clips[1]!;
    setPauseDuration(scene, pause.id, 3);
    expect(trackDuration(scene.audio)).toBe(13);
    expect(stepAts(scene)).toEqual([2, 9]);
    // Removing the pause joins the two halves of the recording again.
    const span = clipSpans(scene)[1]!;
    cutRange(scene, span.start, span.end, id);
    expect(shape(scene)).toEqual([[0, 10]]);
    expect(stepAts(scene)).toEqual([2, 6]);
  });

  it('gives a slide without sound a length of its own with a pause', () => {
    const scene = newScene('content', 'A');
    insertPause(scene, 0, 8, id);
    expect(sceneDuration(scene)).toBe(8);
    insertPause(scene, 0, 0.01, id); // too short to mean anything
    expect(sceneDuration(scene)).toBe(8);
  });

  it('splits only where there is something to split', () => {
    const scene = slide();
    expect(splitAt(scene, 0, id)).toBe(0);
    expect(splitAt(scene, 10, id)).toBe(1);
    expect(scene.audio!.clips).toHaveLength(1);
    expect(splitAt(scene, 4, id)).toBe(1);
    expect(scene.audio!.clips).toHaveLength(2);
  });

  it('replaces the sound with a new recording and takes the step times from it', () => {
    const scene = slide();
    setGain(scene, 6);
    replaceSound(scene, 'a_new', 7, [1.5, undefined], id);
    expect(scene.audio!.clips).toEqual([
      { id: expect.any(String), kind: 'sound', asset: 'a_new', from: 0, to: 7 },
    ]);
    expect(scene.audio!.gain).toBe(6); // the loudness choice stays
    expect(stepAts(scene)).toEqual([1.5, undefined]);
    appendSound(scene, 'a_more', 2, id);
    expect(trackDuration(scene.audio)).toBe(9);
    setStepTime(scene, 't2', 99);
    expect(stepAts(scene)).toEqual([1.5, 9]);
    setGain(scene, 0);
    expect(scene.audio!.gain).toBeUndefined();
    removeSound(scene);
    expect(scene.audio).toBeUndefined();
    expect(stepAts(scene)).toEqual([undefined, undefined]);
  });

  it('keeps a project with sound valid, and lifts format 3 files', () => {
    const { project } = sampleProject();
    const data = JSON.parse(JSON.stringify(project)) as Project;
    data.assets.a_rec = { kind: 'audio', file: 'media/opptak.wav', mime: 'audio/wav', bytes: 44 };
    data.scenes[1]!.audio = slide().audio;
    data.video = { transition: 'fade', evenLoudness: false, credits: true };
    expect(parseProject(data).scenes[1]!.audio!.clips).toHaveLength(1);
    expect(parseProject({ ...data, version: 3 }).version).toBe(FORMAT_VERSION);
    data.scenes[1]!.audio!.gain = 99;
    expect(() => parseProject(data)).toThrow(/gain/);
  });
});

describe('WAV files and the track of a slide', () => {
  const tone = (seconds: number, level: number): Float32Array =>
    new Float32Array(Math.round(seconds * SAMPLE_RATE)).fill(level);

  it('writes and reads mono 16-bit WAV at 48 kHz', () => {
    const wav = encodeWav(tone(0.5, 0.5));
    const info = readWavInfo(wav);
    expect(info).toMatchObject({ sampleRate: 48000, channels: 1, bitsPerSample: 16 });
    expect(info.seconds).toBeCloseTo(0.5);
    const samples = wavSamples(wav);
    expect(samples).toHaveLength(24000);
    expect(samples[100]).toBe(Math.round(0.5 * 0x7fff));
    expect(() => readWavInfo(new Uint8Array(20))).toThrow(/WAV/);
    expect(() => wavSamples(encodeWav(tone(0.1, 0), 44100))).toThrow(/48 kHz/);
  });

  it('puts clips and pauses after each other, sample for sample', () => {
    const source = wavSamples(encodeWav(tone(2, 0.25)));
    const scene = slide();
    scene.audio = {
      clips: [
        { id: 'a', kind: 'sound', asset: 'a_rec', from: 0, to: 1 },
        { id: 'p', kind: 'pause', duration: 0.5 },
        { id: 'b', kind: 'sound', asset: 'a_rec', from: 1.5, to: 2 },
      ],
    };
    const track = renderTrack(scene.audio, () => source);
    expect(track).toHaveLength(SAMPLE_RATE * 2);
    expect(track[SAMPLE_RATE / 2]).toBe(source[0]); // in the first clip
    expect(track[SAMPLE_RATE + 100]).toBe(0); // in the pause
    expect(track[0]).toBe(0); // a join starts from silence, so a cut never clicks
    // A missing recording is silence of the same length.
    expect(renderTrack(scene.audio, () => undefined)).toHaveLength(SAMPLE_RATE * 2);
  });

  it('applies the loudness change of the slide without running over', () => {
    const source = wavSamples(encodeWav(tone(1, 0.25)));
    const louder = renderTrack(
      { clips: [{ id: 'a', kind: 'sound', asset: 'a', from: 0, to: 1 }], gain: 6 },
      () => source,
    );
    expect(louder[24000]! / source[24000]!).toBeCloseTo(gainFactor(6), 2);
    const tooLoud = renderTrack(
      { clips: [{ id: 'a', kind: 'sound', asset: 'a', from: 0, to: 1 }], gain: 18 },
      () => source,
    );
    expect(Math.max(...tooLoud)).toBe(32767);
  });

  it('finds the peaks a waveform is drawn from', () => {
    const samples = new Int16Array(1000);
    samples[10] = 16384;
    samples[990] = -32768;
    const drawn = peaks(samples, 10);
    expect(drawn[0]).toBeCloseTo(0.5);
    expect(drawn[5]).toBe(0);
    expect(drawn[9]).toBe(1);
  });
});

describe('captions from the manuscript', () => {
  it('cuts the manuscript into pieces short enough to read', () => {
    expect(captionPieces('Setning A. Setning B!\n\nSetning C?')).toEqual([
      'Setning A.',
      'Setning B!',
      'Setning C?',
    ]);
    const long = `${'ord '.repeat(40).trim()}.`;
    const pieces = captionPieces(long);
    expect(pieces.length).toBeGreaterThan(1);
    expect(Math.max(...pieces.map((p) => p.length))).toBeLessThanOrEqual(84);
    expect(pieces.join(' ')).toBe(long);
    expect(captionPieces('  \n ')).toEqual([]);
  });

  it('spreads the pieces over the time something is said, skipping pauses', () => {
    const scene = slide();
    scene.script = 'Setning A.\nSetning B.';
    scene.audio = {
      clips: [
        { id: 'p0', kind: 'pause', duration: 2 },
        { id: 'a', kind: 'sound', asset: 'a_rec', from: 0, to: 4 },
        { id: 'p1', kind: 'pause', duration: 1 },
        { id: 'b', kind: 'sound', asset: 'a_rec', from: 4, to: 8 },
      ],
    };
    const cues = sceneCues(scene);
    expect(cues.map((c) => c.text)).toEqual(['Setning A.', 'Setning B.']);
    expect(cues[0]!.start).toBe(2); // not during the pause at the start
    expect(cues[0]!.end).toBeLessThanOrEqual(cues[1]!.start);
    expect(cues[1]!.end).toBe(11);
    expect(sceneCues({ ...scene, script: '' })).toEqual([]);
  });

  it('writes the whole lecture as WebVTT with times from the start of the video', () => {
    const a = slide();
    a.script = 'Setning A.';
    const b = slide();
    b.script = 'Setning B --> her.';
    const scenes = [a, b];
    const cues = lectureCues(scenes, schedule(scenes));
    expect(cues[1]!.start).toBe(10);
    const vtt = toWebVtt(cues, 'nb');
    expect(vtt.startsWith('WEBVTT\nLanguage: nb\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:10.000\nSetning A.');
    expect(vtt).toContain('00:00:10.000 --> 00:00:20.000\nSetning B → her.');
  });

  it('lists the picture credits on slides for the end of a video', () => {
    const { project } = sampleProject();
    const texts = { heading: 'Bildekilder', slide: (n: number[]) => `lysark ${n.join(', ')}` };
    const scenes = creditScenes(project, SCENE_STRINGS.nb, texts);
    expect(scenes).toHaveLength(1);
    expect(sceneDuration(scenes[0]!)).toBeGreaterThan(3);
    const list = scenes[0]!.elements[1]!;
    const lines = list.type === 'text' ? list.content.paragraphs.map((p) => p.runs[0]!.text) : [];
    expect(lines[0]).toContain('av Person A, CC BY 4.0 (lysark 2)');
    // The slides are ordinary slides: the project stays valid with them in it.
    expect(() =>
      parseProject({ ...project, scenes: [...project.scenes, ...scenes] }),
    ).not.toThrow();
    for (const asset of Object.values(project.assets)) delete asset.credit;
    expect(creditScenes(project, SCENE_STRINGS.nb, texts)).toEqual([]);
  });
});
